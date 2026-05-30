import os
import json
import secrets
import threading
import time as _time
from datetime import datetime
from flask import Blueprint, render_template, request, session, jsonify, redirect, url_for
from core import QC_SUBMISSIONS_FILE, QC_UPLOAD_DIR, _read_json_list, _write_json_list, _next_json_id, _data_lock, zone_required, DATA_STORE_DIR

qc_bp = Blueprint('qc', __name__)

_FIREBASE_CONFIG = {
    'apiKey':            os.getenv('FIREBASE_API_KEY', ''),
    'authDomain':        os.getenv('FIREBASE_AUTH_DOMAIN', ''),
    'databaseURL':       os.getenv('FIREBASE_DATABASE_URL', ''),
    'projectId':         os.getenv('FIREBASE_PROJECT_ID', ''),
    'storageBucket':     os.getenv('FIREBASE_STORAGE_BUCKET', ''),
    'messagingSenderId': os.getenv('FIREBASE_MESSAGING_ID', ''),
    'appId':             os.getenv('FIREBASE_APP_ID', ''),
}

_qc_presence = {}
_qc_presence_lock = threading.Lock()
_QC_PRESENCE_TTL = 45

QC_CHAT_FILE = os.path.join(DATA_STORE_DIR, 'qc_chat.json')
_QC_CHAT_MAX = 200

VERIFIED_QC_USERS = {'hamza k. ghareb'}


# ── Push notification helpers ────────────────────────────────────────────────

def _push_bg(target, *args, **kwargs):
    threading.Thread(target=target, args=args, kwargs=kwargs, daemon=True).start()

def _do_push_to_qc(title, body, tag='qc-new'):
    from core import _read_push_subs, _send_push_notification
    for s in _read_push_subs().values():
        if s.get('qc_role') == 'qc':
            _send_push_notification(s['subscription'], title, body, tag=tag)

def _do_push_to_user(username, title, body, tag='qc-status'):
    from core import _read_push_subs, _send_push_notification
    for s in _read_push_subs().values():
        if s.get('username') == username:
            _send_push_notification(s['subscription'], title, body, tag=tag)

def _do_push_to_all_except(exclude, title, body, tag='qc-chat'):
    from core import _read_push_subs, _send_push_notification
    seen = set()
    for s in _read_push_subs().values():
        u = s.get('username', '')
        if u and u != exclude and u not in seen:
            seen.add(u)
            _send_push_notification(s['subscription'], title, body, tag=tag)


def _all_verified_usernames():
    try:
        from core import _db_connect
        with _db_connect() as conn:
            rows = conn.execute("SELECT username FROM users WHERE is_verified = 1 AND approved = 1").fetchall()
            return {r['username'].lower() for r in rows}
    except Exception:
        return set()


@qc_bp.route('/qc-workflow')
@zone_required
def qc_workflow_page():
    if session.get('zone') != 'qc':
        return redirect(url_for('zones.zones_page'))
    all_verified = VERIFIED_QC_USERS | _all_verified_usernames()
    return render_template(
        'qc.html',
        qc_role=session.get('qc_role', 'qc'),
        username=session.get('username', ''),
        verified_users=list(all_verified),
        firebase_config=_FIREBASE_CONFIG,
    )


@qc_bp.route('/api/qc/presence/ping', methods=['POST'])
@zone_required
def api_qc_presence_ping():
    if session.get('zone') != 'qc':
        return jsonify({'error': 'غير مصرح'}), 403
    username = session.get('username', '')
    role = session.get('qc_role', 'qc')
    if username:
        # Get gender for avatar fallback (cached in presence)
        _gender = 'male'
        try:
            from core import _db_connect
            with _db_connect() as _c:
                _row = _c.execute("SELECT gender FROM users WHERE lower(username)=lower(?)", (username,)).fetchone()
                if _row and _row[0]: _gender = _row[0].lower()
        except Exception:
            pass
        with _qc_presence_lock:
            _qc_presence[username] = {'role': role, 'ts': _time.time(), 'gender': _gender}
            now = _time.time()
            active = {u: d for u, d in _qc_presence.items() if now - d['ts'] < _QC_PRESENCE_TTL}
            users_payload = [{'username': u, 'role': d['role'], 'verified': u.lower() in VERIFIED_QC_USERS, 'gender': d.get('gender', 'male')} for u, d in active.items()]
        sse_payload = 'event: presence_update\ndata: ' + json.dumps({'users': users_payload}, ensure_ascii=False) + '\n\n'
        try:
            from app import _broadcast_qc_event
            _broadcast_qc_event(sse_payload)
        except Exception:
            pass
    return jsonify({'ok': True})


@qc_bp.route('/api/qc/presence/leave', methods=['POST'])
@zone_required
def api_qc_presence_leave():
    username = session.get('username', '')
    if username:
        with _qc_presence_lock:
            _qc_presence.pop(username, None)
            now = _time.time()
            active = {u: d for u, d in _qc_presence.items() if now - d['ts'] < _QC_PRESENCE_TTL}
            users_payload = [{'username': u, 'role': d['role'], 'verified': u.lower() in VERIFIED_QC_USERS, 'gender': d.get('gender', 'male')} for u, d in active.items()]
        sse_payload = 'event: presence_update\ndata: ' + json.dumps({'users': users_payload}, ensure_ascii=False) + '\n\n'
        try:
            from app import _broadcast_qc_event
            _broadcast_qc_event(sse_payload)
        except Exception:
            pass
    return jsonify({'ok': True})


@qc_bp.route('/api/qc/presence')
@zone_required
def api_qc_presence():
    if session.get('zone') != 'qc':
        return jsonify({'error': 'غير مصرح'}), 403
    now = _time.time()
    with _qc_presence_lock:
        active = {u: d for u, d in _qc_presence.items() if now - d['ts'] < _QC_PRESENCE_TTL}
        _qc_presence.clear()
        _qc_presence.update(active)
    return jsonify({
        'users': [
            {'username': u, 'role': d['role'], 'verified': u.lower() in VERIFIED_QC_USERS}
            for u, d in active.items()
        ]
    })


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
    # Push notification to QC reviewers (background)
    submitter = session.get('username', '')
    _push_bg(_do_push_to_qc, 'New QC Submission', f'Photo from {submitter} is waiting for review', tag='qc-new')
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
            img_path = os.path.join(QC_UPLOAD_DIR, os.path.basename(image_url))
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


@qc_bp.route('/api/qc/chat', methods=['GET'])
@zone_required
def api_qc_chat_get():
    if session.get('zone') != 'qc':
        return jsonify({'error': 'غير مصرح'}), 403
    messages = _read_json_list(QC_CHAT_FILE)
    return jsonify({'messages': messages[-100:]})


@qc_bp.route('/api/qc/chat', methods=['POST'])
@zone_required
def api_qc_chat_post():
    from app import _broadcast_qc_event
    if session.get('zone') != 'qc':
        return jsonify({'error': 'غير مصرح'}), 403
    data = request.get_json(silent=True) or {}
    text = str(data.get('text', '')).strip()
    if not text or len(text) > 500:
        return jsonify({'success': False, 'message': 'رسالة غير صالحة'}), 400
    username = session.get('username', '')
    role = session.get('qc_role', 'qc')
    msg = {
        'id': int(_time.time() * 1000),
        'username': username,
        'role': role,
        'text': text,
        'sent_at': datetime.now().strftime('%H:%M'),
    }
    with _data_lock:
        messages = _read_json_list(QC_CHAT_FILE)
        messages.append(msg)
        if len(messages) > _QC_CHAT_MAX:
            messages = messages[-_QC_CHAT_MAX:]
        _write_json_list(QC_CHAT_FILE, messages)
    sse_payload = 'event: chat_message\ndata: ' + json.dumps(msg, ensure_ascii=False) + '\n\n'
    try:
        _broadcast_qc_event(sse_payload)
    except Exception:
        pass
    # Push chat message to all other QC users (background)
    preview = text[:80] + ('…' if len(text) > 80 else '')
    _push_bg(_do_push_to_all_except, username, 'QC Chat', f'{username}: {preview}', tag='qc-chat')
    return jsonify({'success': True, 'message': msg})


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
        # Push notification to the labeling assistant who submitted the photo
        creator = updated.get('created_by', '')
        if creator:
            label = {'approved': 'Approved', 'rejected': 'Rejected', 'pending': 'Pending'}.get(status, status.capitalize())
            note = updated.get('review_note', '')
            body = note if note else f'Your photo was marked {label}'
            _push_bg(_do_push_to_user, creator, f'Photo #{item_id} — {label}', body, tag='qc-status')
    return jsonify({'success': True})
