"""Zone 1 — standalone Excel import / viewer / editor."""
import os
import re
import openpyxl
from datetime import datetime, date
from flask import Blueprint, render_template, jsonify, request, session, redirect, url_for

zone1_bp = Blueprint('zone1', __name__)

_Z1_DIR = os.path.join(
    os.getenv('RENDER_DISK_PATH',
              os.path.dirname(os.path.abspath(__file__))),
    'zone1_imports'
)


def _safe(name):
    name = re.sub(r'[^\w\-. ]', '', str(name)).strip()
    return name or 'file.xlsx'


def _cell(val):
    if val is None:
        return ''
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(val, date):
        return val.strftime('%Y-%m-%d')
    if isinstance(val, float):
        return int(val) if val == int(val) else round(val, 6)
    return val


# ── Pages ──────────────────────────────────────────────────────────

@zone1_bp.route('/zone1')
def zone1_page():
    from core import zone_required, get_firebase_config
    if not session.get('logged_in'):
        return redirect(url_for('auth.login_page'))
    allowed = session.get('zone') == 'zone1' or session.get('is_super')
    if not allowed:
        return redirect(url_for('pages.index'))
    os.makedirs(_Z1_DIR, exist_ok=True)
    return render_template('zone1.html',
                           username=session.get('username', ''),
                           firebase_config=get_firebase_config())


# ── API ────────────────────────────────────────────────────────────

@zone1_bp.route('/api/zone1/files')
def api_z1_files():
    if not (session.get('zone') == 'zone1' or session.get('is_super')):
        return jsonify({'error': 'Unauthorized'}), 403
    os.makedirs(_Z1_DIR, exist_ok=True)
    files = []
    for f in sorted(os.listdir(_Z1_DIR)):
        lf = f.lower()
        if lf.endswith(('.xlsx', '.xlsm', '.xls')) and not f.startswith('~$'):
            p = os.path.join(_Z1_DIR, f)
            try:
                files.append({
                    'name': f,
                    'size_kb': round(os.path.getsize(p) / 1024, 1),
                    'modified': datetime.fromtimestamp(
                        os.path.getmtime(p)).strftime('%Y-%m-%d %H:%M'),
                })
            except Exception:
                pass
    return jsonify({'files': files})


@zone1_bp.route('/api/zone1/import', methods=['POST'])
def api_z1_import():
    if not (session.get('zone') == 'zone1' or session.get('is_super')):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
    file = request.files.get('file')
    if not file or not file.filename:
        return jsonify({'success': False, 'message': 'No file selected'}), 400
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.xlsx', '.xlsm', '.xls'):
        return jsonify({'success': False,
                        'message': 'Only .xlsx / .xlsm / .xls files allowed'}), 400
    os.makedirs(_Z1_DIR, exist_ok=True)
    safe = _safe(file.filename)
    path = os.path.join(_Z1_DIR, safe)
    file.save(path)
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        sheets = wb.sheetnames
        wb.close()
    except Exception as e:
        os.remove(path)
        return jsonify({'success': False, 'message': f'Cannot read file: {e}'}), 400
    return jsonify({'success': True, 'name': safe, 'sheets': list(sheets)})


@zone1_bp.route('/api/zone1/sheets')
def api_z1_sheets():
    if not (session.get('zone') == 'zone1' or session.get('is_super')):
        return jsonify({'sheets': []}), 403
    fname = request.args.get('file', '').strip()
    path  = os.path.join(_Z1_DIR, _safe(fname))
    if not os.path.isfile(path):
        return jsonify({'sheets': []}), 404
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        sheets = list(wb.sheetnames)
        wb.close()
        return jsonify({'sheets': sheets})
    except Exception as e:
        return jsonify({'sheets': [], 'error': str(e)})


@zone1_bp.route('/api/zone1/data')
def api_z1_data():
    if not (session.get('zone') == 'zone1' or session.get('is_super')):
        return jsonify({'error': 'Unauthorized'}), 403
    fname  = request.args.get('file',   '').strip()
    sname  = request.args.get('sheet',  '').strip()
    offset = max(0, int(request.args.get('offset', 0)))
    limit  = min(1000, max(1, int(request.args.get('limit', 200))))
    if not fname:
        return jsonify({'error': 'No file'}), 400
    path = os.path.join(_Z1_DIR, _safe(fname))
    if not os.path.isfile(path):
        return jsonify({'error': 'File not found'}), 404
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        if sname not in wb.sheetnames:
            sname = wb.sheetnames[0]
        ws   = wb[sname]
        rows = list(ws.iter_rows(values_only=True))
        wb.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    if not rows:
        return jsonify({'headers': [], 'rows': [], 'total': 0, 'sheet': sname,
                        'offset': offset, 'limit': limit})

    # First non-empty row → headers
    header_row = rows[0]
    headers = [
        str(_cell(c)) if _cell(c) not in ('', None) else f'Col {i + 1}'
        for i, c in enumerate(header_row)
    ]
    data_rows = rows[1:]
    total     = len(data_rows)
    page      = data_rows[offset: offset + limit]
    serialised = [[_cell(c) for c in r] for r in page]

    return jsonify({'headers': headers, 'rows': serialised, 'total': total,
                    'sheet': sname, 'offset': offset, 'limit': limit})


@zone1_bp.route('/api/zone1/edit', methods=['POST'])
def api_z1_edit():
    if not (session.get('zone') == 'zone1' or session.get('is_super')):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
    body  = request.get_json(silent=True) or {}
    fname = body.get('file',  '').strip()
    sname = body.get('sheet', '').strip()
    row   = int(body.get('row', -1))   # 0-based (data row, excluding header)
    col   = int(body.get('col', -1))   # 0-based column
    value = body.get('value', '')
    if not fname or not sname or row < 0 or col < 0:
        return jsonify({'success': False, 'message': 'Missing params'}), 400
    path = os.path.join(_Z1_DIR, _safe(fname))
    if not os.path.isfile(path):
        return jsonify({'success': False, 'message': 'File not found'}), 404
    try:
        keep_vba = fname.lower().endswith('.xlsm')
        wb = openpyxl.load_workbook(path, keep_vba=keep_vba)
        if sname not in wb.sheetnames:
            return jsonify({'success': False, 'message': 'Sheet not found'}), 404
        ws = wb[sname]
        # row+2: skip header (+1) + openpyxl 1-based (+1)
        ws.cell(row=row + 2, column=col + 1).value = value if value != '' else None
        wb.save(path)
        wb.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@zone1_bp.route('/api/zone1/file/<path:filename>', methods=['DELETE'])
def api_z1_delete(filename):
    if not (session.get('zone') == 'zone1' or session.get('is_super')):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
    path = os.path.join(_Z1_DIR, _safe(filename))
    if not os.path.isfile(path):
        return jsonify({'success': False, 'message': 'Not found'}), 404
    try:
        os.remove(path)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
