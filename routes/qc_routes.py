import os
import json
import secrets
from datetime import datetime
from flask import Blueprint, render_template, request, session, jsonify, redirect, url_for
from core import QC_SUBMISSIONS_FILE, QC_UPLOAD_DIR, _read_json_list, _write_json_list, _next_json_id, _data_lock, zone_required

qc_bp = Blueprint('qc', __name__)


@qc_bp.route('/qc-workflow')
@zone_required
def qc_workflow_page():
    if session.get('zone') != 'qc':
        return redirect(url_for('pages.index'))
    return render_template('qc.html', qc_role=session.get('qc_role', 'qc'), username=session.get('username', ''))


@qc_bp.route('/api/qc/submissions', methods=['GET', 'POST'])
@zone_required
def api_qc_submissions():
    # runtime import to avoid circular import at module load
    from app import _broadcast_qc_event
    if session.get('zone') != 'qc':
        return jsonify({'error': 'غير مصرح'}), 403
    if request.method == 'GET':
        items = sorted(_read_json_list(QC_SUBMISSIONS_FILE), key=lambda x: x.get('id', 0), reverse=True)
        return jsonify({'items': items, 'role': session.get('qc_role', 'qc')})
    if session.get('qc_role') != 'labeling':
        return jsonify({'success': False, 'message': 'Only Labeling Assistant can submit photos'}), 403
    photo = request.files.get('photo')
    note = request.form.get('note', '').strip()
    if not photo:
        return jsonify({'success': False, 'message': 'Photo is required'}), 400
    os.makedirs(QC_UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(photo.filename or '')[1].lower()
    if ext not in {'.jpg', '.jpeg', '.png', '.webp'}:
        ext = '.jpg'
    filename = f"qc_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}{ext}"
    photo.save(os.path.join(QC_UPLOAD_DIR, filename))
    with _data_lock:
        items = _read_json_list(QC_SUBMISSIONS_FILE)
        item = {
            'id': _next_json_id(items),
            'image_url': '/static/qc_uploads/' + filename,
            'note': note,
            'status': 'pending',
            'created_by': session.get('username', ''),
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'reviewed_by': '',
            'reviewed_at': '',
            'review_note': '',
        }
        items.append(item)
        _write_json_list(QC_SUBMISSIONS_FILE, items)
    # Broadcast new submission to all QC clients instantly
    sse_payload = 'event: new_submission\ndata: ' + json.dumps(item, ensure_ascii=False) + '\n\n'
    try:
        _broadcast_qc_event(sse_payload)
    except Exception:
        pass
    return jsonify({'success': True, 'item': item})


@qc_bp.route('/api/qc/submissions/<int:item_id>', methods=['DELETE'])
@zone_required
def api_qc_submission_delete(item_id):
    from app import _broadcast_qc_event
    if session.get('zone') != 'qc':
        return jsonify({'success': False, 'message': 'غير مصرح'}), 403
    if session.get('qc_role') != 'labeling':
        return jsonify({'success': False, 'message': 'Only Labeling Assistant can delete submissions'}), 403
    with _data_lock:
        items = _read_json_list(QC_SUBMISSIONS_FILE)
        found_item = None
        new_items = []
        for item in items:
            if int(item.get('id', 0)) == item_id:
                found_item = item
            else:
                new_items.append(item)
        if not found_item:
            return jsonify({'success': False, 'message': 'Not found'}), 404
        # Delete the image file if it exists
        image_url = found_item.get('image_url', '')
        if image_url.startswith('/static/'):
            from core import APP_DIR
            img_path = os.path.join(APP_DIR, image_url.lstrip('/'))
            try:
                if os.path.isfile(img_path):
                    os.remove(img_path)
            except Exception:
                pass
        _write_json_list(QC_SUBMISSIONS_FILE, new_items)
    # Broadcast deletion to all QC clients
    sse_payload = 'event: deleted\ndata: ' + json.dumps({'id': item_id}, ensure_ascii=False) + '\n\n'
    try:
        _broadcast_qc_event(sse_payload)
    except Exception:
        pass
    return jsonify({'success': True})


@qc_bp.route('/api/qc/submissions/<int:item_id>/status', methods=['POST'])
@zone_required
def api_qc_submission_status(item_id):
    from app import _broadcast_qc_event
    if session.get('zone') != 'qc' or session.get('qc_role') != 'qc':
        return jsonify({'success': False, 'message': 'Only QC can review submissions'}), 403
    data = request.get_json(silent=True) or {}
    status = str(data.get('status', '')).strip().lower()
    if status not in {'approved', 'rejected', 'pending'}:
        return jsonify({'success': False, 'message': 'Invalid status'}), 400
    with _data_lock:
        items = _read_json_list(QC_SUBMISSIONS_FILE)
        found = False
        for item in items:
            if int(item.get('id', 0)) == item_id:
                item['status'] = status
                item['reviewed_by'] = session.get('username', '')
                item['reviewed_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                item['review_note'] = str(data.get('review_note', '')).strip()
                found = True
                break
        if not found:
            return jsonify({'success': False, 'message': 'Not found'}), 404
        _write_json_list(QC_SUBMISSIONS_FILE, items)
    # Broadcast status update to all QC clients
    updated = next((x for x in items if int(x.get('id',0)) == item_id), None)
    if updated:
        sse_payload = 'event: status_update\ndata: ' + json.dumps(updated, ensure_ascii=False) + '\n\n'
        try:
            _broadcast_qc_event(sse_payload)
        except Exception:
            pass
    return jsonify({'success': True})
