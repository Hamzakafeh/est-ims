"""
EST Inventory System - Full Read/Write
Alestesharia Animal Nutrition
"""
from dotenv import load_dotenv
load_dotenv()
import os
import sys
import json
import re
import warnings
import threading
import requests as _requests
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, jsonify, request, session, redirect, url_for

warnings.filterwarnings('ignore')

# ── Brute-force protection (in-memory, resets on restart) ──────────
from collections import defaultdict
import time as _time

_login_attempts  = defaultdict(list)   # ip -> [timestamp, ...]
_MAX_ATTEMPTS    = 5
_LOCKOUT_SECONDS = 300                 # 5 دقائق

def _get_ip():
    return request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()

def _is_locked_out(ip):
    now = _time.time()
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < _LOCKOUT_SECONDS]
    return len(_login_attempts[ip]) >= _MAX_ATTEMPTS

def _record_failed_attempt(ip):
    _login_attempts[ip].append(_time.time())

def _clear_attempts(ip):
    _login_attempts.pop(ip, None)

_LOGIN_LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'login_log.json')
_log_lock = threading.Lock()

def _read_login_log():
    try:
        with open(_LOGIN_LOG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def _write_login_log(entries):
    with open(_LOGIN_LOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(entries[-500:], f, ensure_ascii=False)  # keep last 500

def _record_login(username, zone_id, zone_label, ip):
    with _log_lock:
        entries = _read_login_log()
        entries.append({
            'username':   username,
            'zone_id':    zone_id,
            'zone_label': zone_label,
            'ip':         ip,
            'time':       datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        })
        _write_login_log(entries)


try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl not installed.")
    sys.exit(1)

app = Flask(__name__, static_folder='static')
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# ── Session Security ───────────────────────────────────────────────
app.config['SESSION_COOKIE_HTTPONLY']  = True   # لا يقرأها JavaScript
app.config['SESSION_COOKIE_SAMESITE']  = 'Lax'  # حماية CSRF جزئية
app.config['PERMANENT_SESSION_LIFETIME'] = 28800 # 8 ساعات

import logging
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
_logger = logging.getLogger('est_ims')

@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options']        = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-XSS-Protection']       = '1; mode=block'
    response.headers['Referrer-Policy']        = 'strict-origin-when-cross-origin'
    return response
_secret_key = os.getenv("SECRET_KEY")
if not _secret_key:
    raise RuntimeError("SECRET_KEY environment variable is not set. Refusing to start.")
app.secret_key = _secret_key

@app.route("/ping")
def ping():
    return {"status": "ok"}, 200
# ── بيانات الدخول ──────────────────────────────────────────────────
import os

USERS = {
    os.getenv("USER1"): os.getenv("PASS1"),
    os.getenv("USER2"): os.getenv("PASS2"),
    os.getenv("USER3"): os.getenv("PASS3"),
    os.getenv("USER4"): os.getenv("PASS4"),

}
EDIT_PASSWORD = os.getenv("EDIT_PASSWORD")

# ── Zone passwords ──────────────────────────────────────────────────
ZONES = [
    {'id': 'zone1', 'name': 'Zone 1', 'label': 'زون 1',   'icon': '🏭'},
    {'id': 'zone2', 'name': 'Zone 2', 'label': 'زون 2',   'icon': '🏭'},
    {'id': 'zone3', 'name': 'Zone 3', 'label': 'Packaging',   'icon': '🏭'},
    {'id': 'zone4', 'name': 'Zone 4', 'label': 'زون 4',   'icon': '🏭'},
    {'id': 'zone5', 'name': 'Zone 5', 'label': 'زون 5',   'icon': '🏭'},
    {'id': 'admin', 'name': 'Admin',  'label': 'Administration', 'icon': '🏢'},
    {'id': 'dev',   'name': 'Dev',    'label': 'Dev',      'icon': '💻'},
]

ZONE_PASSWORDS = {
    'zone1': os.getenv("ZONE1_PASSWORD"),
    'zone2': os.getenv("ZONE2_PASSWORD"),
    'zone3': os.getenv("ZONE3_PASSWORD"),
    'zone4': os.getenv("ZONE4_PASSWORD"),
    'zone5': os.getenv("ZONE5_PASSWORD"),
    'admin': os.getenv("ADMIN_PASSWORD"),
    'dev':   os.getenv("DEV_PASSWORD"),
}

# Zones that can see all 5 zones and switch between them
SUPER_ZONES = {'admin', 'dev'}
# Zones that can use edit mode
EDIT_ZONES  = {'dev'}
# ───────────────────────────────────────────────────────────────────

from flask import send_from_directory

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(app.static_folder, 'est.ico')

@app.route('/manifest.json')
def manifest():
    return send_from_directory(app.static_folder, 'manifest.json',
                               mimetype='application/manifest+json')

@app.route('/service-worker.js')
def service_worker():
    resp = send_from_directory(app.static_folder, 'service-worker.js',
                               mimetype='application/javascript')
    resp.headers['Service-Worker-Allowed'] = '/'
    resp.headers['Cache-Control'] = 'no-cache'
    return resp

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated

def zone_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login_page'))
        if not session.get('zone'):
            return redirect(url_for('zones_page'))
        return f(*args, **kwargs)
    return decorated

@app.route('/login', methods=['GET'])
def login_page():
    if session.get('logged_in'):
        if session.get('zone'):
            return redirect(url_for('index'))
        return redirect(url_for('zones_page'))
    return render_template('login.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/help')           # ← برا الدالة، بدون indentation
def help_page():
    return render_template('help.html')

@app.route('/login', methods=['POST'])
def do_login():
    ip = _get_ip()
    if _is_locked_out(ip):
        return jsonify({'success': False, 'message': 'تم تجاوز عدد المحاولات المسموح بها. حاول مرة أخرى بعد 5 دقائق'}), 429

    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    if USERS.get(username) == password and username in USERS and USERS[username] is not None:
        _clear_attempts(ip)
        session['logged_in'] = True
        session['username']  = username
        session.pop('zone', None)
        return jsonify({'success': True, 'redirect': '/zones'})
    _record_failed_attempt(ip)
    return jsonify({'success': False, 'message': '  Incorrect username or password    '}), 401

# ── ZONES PAGE ──────────────────────────────────────────────────────
@app.route('/zones')
@login_required
def zones_page():
    if session.get('zone'):
        return redirect(url_for('index'))
    return render_template('zones.html',
                           username=session.get('username', ''),
                           zones=ZONES)

@app.route('/api/zone_login', methods=['POST'])
@login_required
def api_zone_login():
    ip = _get_ip()
    if _is_locked_out(ip):
        return jsonify({'success': False, 'message': 'تم تجاوز عدد المحاولات. حاول بعد 5 دقائق'}), 429

    data     = request.get_json(silent=True) or {}
    zone_id  = data.get('zone_id', '').strip()
    password = data.get('password', '').strip()

    zone = next((z for z in ZONES if z['id'] == zone_id), None)
    if not zone:
        return jsonify({'success': False, 'message': 'زون غير معروف'}), 400

    expected = ZONE_PASSWORDS.get(zone_id)
    if not expected or password != expected:
        _record_failed_attempt(ip)
        return jsonify({'success': False, 'message': 'Incorrect password'}), 401

    _clear_attempts(ip)
    session['zone']        = zone_id
    session['zone_name']   = zone['name']
    session['zone_label']  = zone['label']
    session['can_edit']    = zone_id in EDIT_ZONES
    session['is_super']    = zone_id in SUPER_ZONES
    session['login_time']  = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    _record_login(session.get('username',''), zone_id, zone['label'], ip)
    return jsonify({'success': True})

@app.route('/api/switch_zone', methods=['POST'])
@zone_required
def api_switch_zone():
    """Super zones (admin/dev) can switch to any of the 5 warehouse zones."""
    if not session.get('is_super'):
        return jsonify({'success': False, 'message': 'غير مصرح'}), 403
    data    = request.get_json(silent=True) or {}
    zone_id = data.get('zone_id', '').strip()
    if zone_id not in ('zone1','zone2','zone3','zone4','zone5'):
        return jsonify({'success': False, 'message': 'زون غير صحيح'}), 400
    zone = next((z for z in ZONES if z['id'] == zone_id), None)
    session['active_view_zone']      = zone_id
    session['active_view_zone_name'] = zone['name'] if zone else zone_id
    return jsonify({'success': True})

@app.route('/api/session_info')
@zone_required
def api_session_info():
    return jsonify({
        'username':         session.get('username', ''),
        'zone':             session.get('zone', ''),
        'zone_name':        session.get('zone_name', ''),
        'zone_label':       session.get('zone_label', ''),
        'can_edit':         session.get('can_edit', False),
        'is_super':         session.get('is_super', False),
        'active_view_zone': session.get('active_view_zone', session.get('zone', '')),
        'zones':            [z for z in ZONES if z['id'] not in SUPER_ZONES],
    })

@app.route('/api/verify_edit_password', methods=['POST'])
@zone_required
def verify_edit_password():
    if not session.get('can_edit'):
        return jsonify({'success': False, 'message': 'غير مصرح لهذا الزون'}), 403
    data = request.get_json(silent=True) or {}
    password = data.get('password', '')
    if EDIT_PASSWORD and password == EDIT_PASSWORD:
        return jsonify({'success': True})
    return jsonify({'success': False}), 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('welcome'))

@app.route('/logout_zone')
@login_required
def logout_zone():
    """Go back to zone selection without full logout."""
    session.pop('zone', None)
    session.pop('zone_name', None)
    session.pop('zone_label', None)
    session.pop('can_edit', None)
    session.pop('is_super', None)
    session.pop('active_view_zone', None)
    session.pop('active_view_zone_name', None)
    return redirect(url_for('zones_page'))

MONTH_ORDER = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
}
MONTH_AR = {
    'January': 'يناير', 'February': 'فبراير', 'March': 'مارس', 'April': 'أبريل',
    'May': 'مايو', 'June': 'يونيو', 'July': 'يوليو', 'August': 'أغسطس',
    'September': 'سبتمبر', 'October': 'أكتوبر', 'November': 'نوفمبر', 'December': 'ديسمبر'
}

# ── Column mapping (based on VBA: D=4,E=5,F=6,G=7,I=9,J=10,L=12,M=13) ──
# Sheet columns (1-based like Excel):
COL_DATE     = 1   # A - Date
COL_CATEGORY = 4   # D - Category (merged)
COL_TYPE     = 5   # E - Type (merged)
COL_COLOR    = 6   # F - Color
COL_SIZE     = 7   # G - Size
COL_BASIC    = 9   # I - Basic balance
COL_CURRENT  = 10  # J - Current balance
COL_IN       = 12  # L - IN
COL_OUT      = 13  # M - OUT
DATA_START_ROW = 7 # Data starts at row 7

# Log sheet columns
LOG_COL_TIME     = 1
LOG_COL_TYPE     = 2
LOG_COL_QTY      = 3
LOG_COL_BALANCE  = 4
LOG_COL_COLOR    = 5
LOG_COL_SIZE     = 6
LOG_COL_ITEMTYPE = 7
LOG_COL_CATEGORY = 8

def get_years_root():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(script_dir, 'zones'),
        os.path.join(os.path.dirname(script_dir), 'zones'),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    return None

def _validate_filepath(filepath, zone_id=None):
    """
    تحقق أن المسار داخل مجلد zones فقط (يمنع Path Traversal).
    لو zone_id محدد، يتحقق كذلك أن الملف داخل زون المستخدم.
    يرجع True لو المسار آمن، False لو فيه مشكلة.
    """
    root = get_years_root()
    if not root:
        return False
    try:
        real_root = os.path.realpath(root)
        real_file = os.path.realpath(filepath)
        if not real_file.startswith(real_root + os.sep):
            return False
        if zone_id:
            zone_root = os.path.realpath(os.path.join(root, zone_id))
            if not real_file.startswith(zone_root + os.sep):
                return False
        return True
    except Exception:
        return False

def get_base_path(year=None, zone_id=None):
    """Return path to a year folder inside a zone. zones/zone1/2026/"""
    root = get_years_root()
    if not root:
        return None
    if zone_id:
        zone_folder = os.path.join(root, zone_id)
    else:
        zone_folders = sorted([d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)) and d.startswith('zone')])
        if not zone_folders:
            return None
        zone_folder = os.path.join(root, zone_folders[0])
    if not os.path.isdir(zone_folder):
        return None
    years = sorted([d for d in os.listdir(zone_folder) if os.path.isdir(os.path.join(zone_folder, d)) and d.isdigit()])
    if not years:
        return None
    target = str(year) if year else years[0]
    candidate = os.path.join(zone_folder, target)
    return candidate if os.path.isdir(candidate) else None

def get_available_years():
    """Return sorted list of available year strings scanned across all zones."""
    root = get_years_root()
    if not root:
        return []
    years = set()
    for zone_folder in os.listdir(root):
        zone_path = os.path.join(root, zone_folder)
        if not os.path.isdir(zone_path):
            continue
        for d in os.listdir(zone_path):
            if os.path.isdir(os.path.join(zone_path, d)) and d.isdigit():
                years.add(d)
    return sorted(years)

def get_structure(year=None, zone_id=None):
    """Return file structure scoped to a zone: {year: {month: {fname: fpath}}}
    Disk layout: zones/zone1/2026/01-January/Other+.xlsm
    """
    root = get_years_root()
    if not root:
        return {}
    available_years = get_available_years()
    if not available_years:
        return {}
    target_years = [str(year)] if year else available_years
    if zone_id:
        zone_folders = [zone_id]
    else:
        zone_folders = sorted([d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)) and d.startswith('zone')])
    result = {}
    for yr in target_years:
        result[yr] = {}
        for zf in zone_folders:
            year_path = os.path.join(root, zf, yr)
            if not os.path.isdir(year_path):
                continue
            for month_folder in sorted(os.listdir(year_path), key=lambda m: MONTH_ORDER.get(m.split('-')[-1] if '-' in m else m, 99)):
                month_path = os.path.join(year_path, month_folder)
                if not os.path.isdir(month_path):
                    continue
                month_name = month_folder.split('-')[-1] if '-' in month_folder else month_folder
                files = {}
                for fname in ['Other+', 'Sacks']:
                    fpath = os.path.join(month_path, f'{fname}.xlsm')
                    if os.path.exists(fpath):
                        files[fname] = fpath
                if files:
                    if month_name not in result[yr]:
                        result[yr][month_name] = {}
                    result[yr][month_name].update(files)
    return result

def read_sheet_data(filepath, sheet_name):
    try:
        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
        if sheet_name not in wb.sheetnames:
            return None, []
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))

        if sheet_name == 'Log':
            if not rows:
                wb.close(); return None, []
            col_indices = [(ci, str(val).strip()) for ci, val in enumerate(rows[0])
                           if val is not None and str(val).strip()]
            if not col_indices:
                wb.close(); return None, []
            data_rows = []
            for row in rows[1:]:
                if not any(ci < len(row) and row[ci] is not None and str(row[ci]).strip() not in ('','None')
                           for ci,_ in col_indices):
                    continue
                rd = {}
                for ci, col_name in col_indices:
                    val = row[ci] if ci < len(row) else None
                    if isinstance(val, datetime): val = val.strftime('%Y-%m-%d %H:%M:%S')
                    elif val is not None:
                        val = str(val) if not isinstance(val,(int,float)) else val
                        if isinstance(val,str) and val.strip()=='None': val=None
                    rd[col_name] = val
                data_rows.append(rd)
            wb.close()
            return [h for _,h in col_indices], data_rows

        if sheet_name == 'Stocktaking':
            data_rows = []
            for row in rows:
                non_empty = [(ci,val) for ci,val in enumerate(row)
                             if val is not None and str(val).strip() not in ('','None')]
                if not non_empty: continue
                rd = {}
                for ci,val in non_empty:
                    col_label = f'Col {ci+1}'
                    if isinstance(val,datetime): val=val.strftime('%Y-%m-%d')
                    elif val is not None: val=str(val) if not isinstance(val,(int,float)) else val
                    rd[col_label]=val
                data_rows.append(rd)
            if not data_rows:
                wb.close(); return None,[]
            all_cols,seen=[],set()
            for r in data_rows:
                for k in r:
                    if k not in seen: all_cols.append(k); seen.add(k)
            wb.close()
            return all_cols, data_rows

        # Main inventory sheet
        header_idx = None
        for i, row in enumerate(rows):
            rv = [str(v).strip() if v else '' for v in row]
            if 'Date' in rv or 'التاريخ' in rv:
                header_idx = i; break
        if header_idx is None:
            wb.close(); return None,[]

        col_indices = [(ci,str(val).strip()) for ci,val in enumerate(rows[header_idx])
                       if val is not None and str(val).strip()]
        data_rows = []
        for row_idx, row in enumerate(rows[header_idx+1:], start=header_idx+2):
            if not any(ci<len(row) and row[ci] is not None and str(row[ci]).strip() not in ('','None')
                       for ci,_ in col_indices):
                continue
            rd={}
            for ci,col_name in col_indices:
                val=row[ci] if ci<len(row) else None
                if isinstance(val,datetime): val=val.strftime('%Y-%m-%d')
                elif val is not None:
                    val=str(val) if not isinstance(val,(int,float)) else val
                    if isinstance(val,str) and val.strip()=='None': val=None
                rd[col_name]=val
            # Store the actual Excel row number for editing
            rd['__row__'] = row_idx
            data_rows.append(rd)
        wb.close()
        headers = [h for _,h in col_indices]
        return headers, data_rows
    except Exception as _exc:
        _logger.error('read_sheet_data error — %s: %s', filepath, _exc)
        return None, []

# ═══════════════════════════════════════════════════════════════════
#  WRITE LOGIC  —  Replicates the VBA Worksheet_Change macro exactly
# ═══════════════════════════════════════════════════════════════════

def _get_cell_val(ws, row, col):
    """Get value from a cell, handling merged cells by reading the top-left."""
    cell = ws.cell(row=row, column=col)
    if cell.value is not None:
        return cell.value
    # If it's part of a merged range, get the master cell value
    for merge in ws.merged_cells.ranges:
        if cell.coordinate in merge:
            master = ws.cell(row=merge.min_row, column=merge.min_col)
            return master.value
    return None

def _find_last_balance(ws, target_row, color_value):
    """
    Walk backwards from target_row-1 looking for a row where Color matches.
    Falls back to Basic Balance of the target row if no prior match found.
    Returns (last_balance, found).
    """
    for i in range(target_row - 1, DATA_START_ROW - 1, -1):
        cell_color = ws.cell(row=i, column=COL_COLOR).value
        if cell_color == color_value:
            balance = ws.cell(row=i, column=COL_CURRENT).value
            try:
                return float(balance or 0), True
            except:
                return 0.0, True
    # No previous row with same color — use Basic Balance of THIS row
    basic = ws.cell(row=target_row, column=COL_BASIC).value
    try:
        return float(basic or 0), False
    except:
        return 0.0, False

def _append_log(ws_log, operation, qty, balance, color, size, item_type, category):
    """Append a row to the Log sheet."""
    lr = 1
    for row in ws_log.iter_rows(min_col=1, max_col=1):
        for cell in row:
            if cell.value is not None:
                lr = cell.row
    lr += 1
    ws_log.cell(row=lr, column=LOG_COL_TIME).value     = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    ws_log.cell(row=lr, column=LOG_COL_TYPE).value     = operation
    ws_log.cell(row=lr, column=LOG_COL_QTY).value      = qty
    ws_log.cell(row=lr, column=LOG_COL_BALANCE).value  = balance
    ws_log.cell(row=lr, column=LOG_COL_COLOR).value    = color
    ws_log.cell(row=lr, column=LOG_COL_SIZE).value     = size
    ws_log.cell(row=lr, column=LOG_COL_ITEMTYPE).value = item_type
    ws_log.cell(row=lr, column=LOG_COL_CATEGORY).value = category

# ── Flask routes ────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════════════
#  Stocktaking auto-recalculation
#  Parses LOOKUP(2,1/(Sheet!Col:Col=Val),Sheet!J:J) formulas and
#  computes the result in Python, then writes it back to the cell.
# ══════════════════════════════════════════════════════════════════
_LOOKUP_RE = re.compile(
    r'LOOKUP\s*\(\s*2\s*,\s*1\s*/\s*\(\s*(\w+)!\s*([A-Z]+)\s*:\s*\2\s*=\s*(.*?)\s*\)\s*,\s*\1!\s*([A-Z]+)\s*:\s*\4\s*\)',
    re.IGNORECASE
)

def _col_letter_to_idx(letter):
    """'A'->0, 'B'->1, ... 'J'->9  (0-based for row tuple indexing)"""
    letter = letter.upper()
    result = 0
    for ch in letter:
        result = result * 26 + (ord(ch) - ord('A') + 1)
    return result - 1  # 0-based

def _recalc_stocktaking(wb):
    """
    Find the Stocktaking sheet in a workbook, parse every LOOKUP formula,
    evaluate it by scanning the referenced sheet, and write the computed
    value back.  Modifies wb in-place (caller must save).
    """
    if 'Stocktaking' not in wb.sheetnames:
        return

    ws_st = wb['Stocktaking']

    # Cache sheet rows for performance
    _sheet_rows_cache = {}
    def _get_rows(sheet_name):
        if sheet_name not in _sheet_rows_cache:
            if sheet_name in wb.sheetnames:
                _sheet_rows_cache[sheet_name] = list(
                    wb[sheet_name].iter_rows(min_row=DATA_START_ROW, values_only=True)
                )
            else:
                _sheet_rows_cache[sheet_name] = []
        return _sheet_rows_cache[sheet_name]

    for row in ws_st.iter_rows():
        for cell in row:
            if not (cell.value and isinstance(cell.value, str) and cell.value.startswith('=')):
                continue
            m = _LOOKUP_RE.search(cell.value)
            if not m:
                continue

            ref_sheet   = m.group(1)
            filter_col  = _col_letter_to_idx(m.group(2))   # e.g. F -> 5
            raw_val     = m.group(3).strip().strip('"')     # filter value
            result_col  = _col_letter_to_idx(m.group(4))   # e.g. J -> 9

            # Auto-cast numeric filter value
            try:
                filter_val = float(raw_val) if '.' in raw_val else int(raw_val)
            except ValueError:
                filter_val = raw_val  # keep as string

            # LOOKUP(2,1/(...)) = last matching row (walk forward, keep updating)
            last_result = None
            for data_row in _get_rows(ref_sheet):
                try:
                    cell_filter = data_row[filter_col]
                    # Normalize comparison: strip strings, cast numbers
                    if isinstance(filter_val, str):
                        match = (cell_filter is not None and
                                 str(cell_filter).strip() == filter_val)
                    else:
                        try:
                            match = float(cell_filter) == filter_val
                        except (TypeError, ValueError):
                            match = False

                    if match:
                        v = data_row[result_col]
                        if v is not None:
                            try:
                                last_result = float(v)
                            except (TypeError, ValueError):
                                last_result = v
                except IndexError:
                    continue

            # Write computed value (keep formula string intact, just overwrite value)
            cell.value = last_result if last_result is not None else cell.value

@app.route('/')
def welcome():
    return render_template('welcome.html')

@app.route('/index')
@zone_required
def index():
    structure = get_structure()
    available_years = get_available_years()
    zone        = session.get('zone', '')
    is_super    = session.get('is_super', False)
    can_edit    = session.get('can_edit', False)
    zone_label  = session.get('zone_label', '')
    username    = session.get('username', '')
    return render_template('index.html',
                           structure=structure,
                           available_years=available_years,
                           base_path=get_base_path() or 'Not found',
                           month_ar=MONTH_AR,
                           zone=zone,
                           zone_label=zone_label,
                           is_super=is_super,
                           can_edit=can_edit,
                           username=username,
                           login_time=session.get('login_time',''))

@app.route('/api/structure')
@zone_required
def api_structure():
    zone     = session.get('zone', '')
    is_super = session.get('is_super', False)
    # Super zones can request a specific view zone
    if is_super:
        view_zone = request.args.get('zone') or session.get('active_view_zone', 'zone1')
    else:
        view_zone = zone
    return jsonify(get_filtered_structure(view_zone))

@app.route('/api/years')
@zone_required
def api_years():
    return jsonify({'years': get_available_years()})

def get_filtered_structure(zone_id):
    """Return structure for a specific zone directly from disk."""
    return get_structure(zone_id=zone_id)

@app.route('/api/sheets')
@zone_required
def api_sheets():
    filepath = request.args.get('path')
    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    zone_id = None if session.get('is_super') else session.get('zone', '')
    if not _validate_filepath(filepath, zone_id):
        return jsonify({'error': 'Access denied'}), 403
    try:
        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
        sheets = wb.sheetnames; wb.close()
        return jsonify({'sheets': sheets})
    except Exception:
        return jsonify({'error': 'Failed to read file'}), 500

@app.route('/api/data')
@zone_required
def api_data():
    filepath = request.args.get('path')
    sheet    = request.args.get('sheet','')
    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    zone_id = None if session.get('is_super') else session.get('zone', '')
    if not _validate_filepath(filepath, zone_id):
        return jsonify({'error': 'Access denied'}), 403
    headers, rows = read_sheet_data(filepath, sheet)
    if headers is None:
        return jsonify({'headers':[],'rows':[],'count':0})
    return jsonify({'headers': headers, 'rows': rows, 'count': len(rows)})


# ══════════════════════════════════════════════════════════════════
#  NEW: /api/transaction  —  IN or OUT on the main inventory sheet
#
#  Body (JSON):
#    filepath  : full path to the .xlsm file
#    sheet     : sheet name (e.g. "Sheet1")
#    row       : Excel row number (integer, from __row__ field)
#    operation : "IN" or "OUT"
#    qty       : positive number
# ══════════════════════════════════════════════════════════════════
@app.route('/api/transaction', methods=['POST'])
@zone_required
def api_transaction():
    if not session.get('can_edit'):
        return jsonify({'success': False, 'error': 'غير مصرح — يجب تفعيل وضع التعديل'}), 403

    data = request.get_json(silent=True) or {}
    filepath  = data.get('filepath', '')
    sheet     = data.get('sheet', '')
    row       = data.get('row')
    operation = data.get('operation', '').upper()
    qty_raw   = data.get('qty')

    if not filepath or not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'File not found'}), 404

    zone_id = None if session.get('is_super') else session.get('zone', '')
    if not _validate_filepath(filepath, zone_id):
        return jsonify({'success': False, 'error': 'Access denied'}), 403

    if operation not in ('IN', 'OUT'):
        return jsonify({'success': False, 'error': 'operation must be IN or OUT'}), 400
    try:
        row = int(row)
        qty = float(qty_raw)
        if qty < 0:
            raise ValueError()
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid row or qty'}), 400

    try:
        wb = openpyxl.load_workbook(filepath, keep_vba=True)

        if sheet not in wb.sheetnames:
            wb.close()
            return jsonify({'success': False, 'error': f'Sheet "{sheet}" not found'}), 404

        ws      = wb[sheet]
        ws_log  = wb['Log'] if 'Log' in wb.sheetnames else None

        color_value    = _get_cell_val(ws, row, COL_COLOR)
        size_value     = _get_cell_val(ws, row, COL_SIZE)
        type_value     = _get_cell_val(ws, row, COL_TYPE)
        category_value = _get_cell_val(ws, row, COL_CATEGORY)
        basic_balance  = ws.cell(row=row, column=COL_BASIC).value or 0

        if not color_value or str(color_value).strip() in ('', 'None', 'null'):
            wb.close()
            return jsonify({'success': False,
                            'error': 'يجب تحديد اللون (Color) أولاً قبل إجراء أي عملية'}), 400

        last_balance, found = _find_last_balance(ws, row, color_value)
        if not found:
            try:
                last_balance = float(basic_balance)
            except Exception:
                last_balance = 0.0

        if operation == 'IN':
            new_balance = last_balance + qty
        else:
            new_balance = last_balance - qty

        ws.cell(row=row, column=COL_CURRENT).value = new_balance

        if ws_log:
            _append_log(ws_log, operation, qty, new_balance,
                        color_value, size_value, type_value, category_value)

        _recalc_stocktaking(wb)
        wb.save(filepath)
        wb.close()

        return jsonify({
            'success':     True,
            'new_balance': new_balance,
            'operation':   operation,
            'qty':         qty,
            'color':       color_value,
            'size':        size_value,
        })

    except Exception:
        return jsonify({'success': False, 'error': 'حدث خطأ أثناء تنفيذ العملية'}), 500


# ══════════════════════════════════════════════════════════════════
#  NEW: /api/update_cell  —  Edit any plain cell directly
#
#  Body (JSON):
#    filepath : full path to the .xlsm file
#    sheet    : sheet name
#    row      : Excel row number
#    col_name : column header name (e.g. "Date", "Color")
#    value    : new value (string; numbers auto-cast)
# ══════════════════════════════════════════════════════════════════
@app.route('/api/update_cell', methods=['POST'])
@zone_required
def api_update_cell():
    if not session.get('can_edit'):
        return jsonify({'success': False, 'error': 'غير مصرح'}), 403

    data      = request.get_json(silent=True) or {}
    filepath  = data.get('filepath', '')
    sheet     = data.get('sheet', '')
    row       = data.get('row')
    col_name  = data.get('col_name', '')
    value     = data.get('value', '')

    if not filepath or not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'File not found'}), 404

    zone_id = None if session.get('is_super') else session.get('zone', '')
    if not _validate_filepath(filepath, zone_id):
        return jsonify({'success': False, 'error': 'Access denied'}), 403

    try:
        row = int(row)
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid row'}), 400

    try:
        wb = openpyxl.load_workbook(filepath, keep_vba=True)
        if sheet not in wb.sheetnames:
            wb.close()
            return jsonify({'success': False, 'error': f'Sheet "{sheet}" not found'}), 404
        ws = wb[sheet]

        header_row_idx = None
        for i, row_cells in enumerate(ws.iter_rows(values_only=True), start=1):
            rv = [str(v).strip() if v else '' for v in row_cells]
            if 'Date' in rv or 'التاريخ' in rv:
                header_row_idx = i; break

        if header_row_idx is None:
            wb.close()
            return jsonify({'success': False, 'error': 'Header row not found'}), 400

        col_idx = None
        for ci, cell in enumerate(ws[header_row_idx], start=1):
            if cell.value and str(cell.value).strip() == col_name:
                col_idx = ci; break

        if col_idx is None:
            wb.close()
            return jsonify({'success': False, 'error': f'Column "{col_name}" not found'}), 400

        cast_value = value
        try:
            if '.' in str(value):
                cast_value = float(value)
            else:
                cast_value = int(value)
        except Exception:
            cast_value = value if value != '' else None

        ws.cell(row=row, column=col_idx).value = cast_value
        _recalc_stocktaking(wb)
        wb.save(filepath)
        wb.close()

        return jsonify({'success': True, 'row': row, 'col': col_name, 'value': cast_value})

    except Exception:
        return jsonify({'success': False, 'error': 'حدث خطأ أثناء تحديث الخلية'}), 500


# ══════════════════════════════════════════════════════════════════
#  /api/color_balance  —  Get last current balance for a Color
#
#  Query params: path, sheet, color, before_row (optional)
# ══════════════════════════════════════════════════════════════════
@app.route('/api/color_balance')
@zone_required
def api_color_balance():
    filepath   = request.args.get('path', '')
    sheet      = request.args.get('sheet', '')
    color      = request.args.get('color', '')
    before_row = request.args.get('before_row', None)

    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    if not color or color.strip().lower() in ('', 'null', 'none'):
        return jsonify({'balance': None, 'found': False})

    zone_id = None if session.get('is_super') else session.get('zone', '')
    if not _validate_filepath(filepath, zone_id):
        return jsonify({'error': 'Access denied'}), 403

    try:
        before_row = int(before_row) if before_row else None
    except Exception:
        before_row = None

    try:
        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
        if sheet not in wb.sheetnames:
            wb.close()
            return jsonify({'balance': None, 'found': False})
        ws = wb[sheet]

        last_balance = None
        last_row     = None
        rows = list(ws.iter_rows(min_row=DATA_START_ROW, values_only=True))
        for idx, row_vals in enumerate(rows):
            actual_row = DATA_START_ROW + idx
            if before_row and actual_row >= before_row:
                break
            try:
                cell_color   = row_vals[COL_COLOR - 1]
                cell_current = row_vals[COL_CURRENT - 1]
            except IndexError:
                continue
            if cell_color and str(cell_color).strip() == color.strip():
                try:
                    val = float(cell_current) if cell_current is not None else None
                    if val is not None:
                        last_balance = val
                        last_row     = actual_row
                except Exception:
                    pass

        wb.close()
        return jsonify({'balance': last_balance, 'found': last_balance is not None, 'row': last_row})

    except Exception:
        return jsonify({'error': 'حدث خطأ أثناء قراءة الرصيد'}), 500


# ══════════════════════════════════════════════════════════════════
#  /api/set_opening_balance  —  Write Basic + Current in one call
#
#  Body: filepath, sheet, row, balance (number)
# ══════════════════════════════════════════════════════════════════
@app.route('/api/set_opening_balance', methods=['POST'])
@zone_required
def api_set_opening_balance():
    if not session.get('can_edit'):
        return jsonify({'success': False, 'error': 'غير مصرح'}), 403

    data     = request.get_json(silent=True) or {}
    filepath = data.get('filepath', '')
    sheet    = data.get('sheet', '')
    row      = data.get('row')
    balance  = data.get('balance')

    if not filepath or not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'File not found'}), 404

    zone_id = None if session.get('is_super') else session.get('zone', '')
    if not _validate_filepath(filepath, zone_id):
        return jsonify({'success': False, 'error': 'Access denied'}), 403

    try:
        row     = int(row)
        balance = float(balance)
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid row or balance'}), 400

    try:
        wb = openpyxl.load_workbook(filepath, keep_vba=True)
        if sheet not in wb.sheetnames:
            wb.close()
            return jsonify({'success': False, 'error': 'Sheet not found'}), 404
        ws = wb[sheet]
        ws.cell(row=row, column=COL_BASIC).value   = balance
        ws.cell(row=row, column=COL_CURRENT).value = balance
        _recalc_stocktaking(wb)
        wb.save(filepath)
        wb.close()
        return jsonify({'success': True, 'balance': balance})
    except Exception:
        return jsonify({'success': False, 'error': 'حدث خطأ أثناء تعيين الرصيد الافتتاحي'}), 500


# ══════════════════════════════════════════════════════════════════
#  NEW: /api/add_row  —  Add a new item row to the sheet
#
#  Body (JSON):
#    filepath : full path to the .xlsm file
#    sheet    : sheet name
#    fields   : dict of { col_name: value, ... }
# ══════════════════════════════════════════════════════════════════
def _parse_dv_formula(formula1):
    """Parse a Data Validation formula1 string into a clean list of values."""
    if not formula1:
        return []
    s = formula1.strip().strip('"')
    items = [v.strip() for v in s.split(',') if v.strip() and v.strip().lower() not in ('null', 'none', '')]
    return items

def _col_letter_to_index(letter):
    """Convert Excel column letter(s) to 1-based index. E.g. 'F' -> 6."""
    letter = letter.upper()
    result = 0
    for ch in letter:
        result = result * 26 + (ord(ch) - ord('A') + 1)
    return result

@app.route('/api/options')
@zone_required
def api_options():
    """Read Data Validation lists from the Excel sheet for Color, Type, Size, Category."""
    filepath = request.args.get('path', '')
    sheet    = request.args.get('sheet', '')
    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404

    zone_id = None if session.get('is_super') else session.get('zone', '')
    if not _validate_filepath(filepath, zone_id):
        return jsonify({'error': 'Access denied'}), 403

    try:
        wb = openpyxl.load_workbook(filepath, read_only=False, data_only=True, keep_vba=True)
        if sheet not in wb.sheetnames:
            wb.close()
            return jsonify({'colors': [], 'types': [], 'sizes': [], 'categories': []})
        ws = wb[sheet]

        header_col_map = {}
        for ci, cell in enumerate(ws[6], start=1):
            if cell.value and str(cell.value).strip():
                header_col_map[ci] = str(cell.value).strip()

        name_to_col = {v: k for k, v in header_col_map.items()}

        col_color    = name_to_col.get('Color',    COL_COLOR)
        col_type     = name_to_col.get('Type',     COL_TYPE)
        col_size     = name_to_col.get('Size',     COL_SIZE)
        col_category = name_to_col.get('Category', COL_CATEGORY)

        options = {'colors': [], 'types': [], 'sizes': [], 'categories': []}
        col_target = {
            col_color:    'colors',
            col_type:     'types',
            col_size:     'sizes',
            col_category: 'categories',
        }

        for dv in ws.data_validations.dataValidation:
            if dv.type != 'list' or not dv.formula1:
                continue
            try:
                first_ref = str(dv.sqref).split()[0]
                col_letters = ''.join(c for c in first_ref.split(':')[0] if c.isalpha())
                ci = _col_letter_to_index(col_letters)
            except Exception:
                continue

            key = col_target.get(ci)
            if key:
                vals = _parse_dv_formula(dv.formula1)
                options[key] = vals

        wb.close()
        return jsonify(options)
    except Exception:
        return jsonify({'error': 'حدث خطأ أثناء قراءة الخيارات'}), 500


@app.route('/api/clear_row', methods=['POST'])
@zone_required
def api_clear_row():
    """Clear all data cells in a given Excel row (does NOT delete the row itself)."""
    if not session.get('can_edit'):
        return jsonify({'success': False, 'error': 'غير مصرح'}), 403

    data     = request.get_json(silent=True) or {}
    filepath = data.get('filepath', '')
    sheet    = data.get('sheet', '')
    row      = data.get('row')

    if not filepath or not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'File not found'}), 404

    zone_id = None if session.get('is_super') else session.get('zone', '')
    if not _validate_filepath(filepath, zone_id):
        return jsonify({'success': False, 'error': 'Access denied'}), 403

    try:
        row = int(row)
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid row'}), 400

    try:
        wb = openpyxl.load_workbook(filepath, keep_vba=True)
        if sheet not in wb.sheetnames:
            wb.close()
            return jsonify({'success': False, 'error': 'Sheet not found'}), 404
        ws = wb[sheet]
        for col in range(1, 14):
            ws.cell(row=row, column=col).value = None
        _recalc_stocktaking(wb)
        wb.save(filepath)
        wb.close()
        return jsonify({'success': True})
    except Exception:
        return jsonify({'success': False, 'error': 'حدث خطأ أثناء مسح الصف'}), 500


@app.route('/api/add_row', methods=['POST'])
@zone_required
def api_add_row():
    if not session.get('can_edit'):
        return jsonify({'success': False, 'error': 'غير مصرح'}), 403

    data     = request.get_json(silent=True) or {}
    filepath = data.get('filepath', '')
    sheet    = data.get('sheet', '')
    fields   = data.get('fields', {})

    if not filepath or not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'File not found'}), 404
    if not fields:
        return jsonify({'success': False, 'error': 'No fields provided'}), 400

    zone_id = None if session.get('is_super') else session.get('zone', '')
    if not _validate_filepath(filepath, zone_id):
        return jsonify({'success': False, 'error': 'Access denied'}), 403

    try:
        wb = openpyxl.load_workbook(filepath, keep_vba=True)
        if sheet not in wb.sheetnames:
            wb.close()
            return jsonify({'success': False, 'error': f'Sheet "{sheet}" not found'}), 404
        ws = wb[sheet]

        header_row_idx = None
        for i, row_cells in enumerate(ws.iter_rows(values_only=True), start=1):
            rv = [str(v).strip() if v else '' for v in row_cells]
            if 'Date' in rv or 'التاريخ' in rv:
                header_row_idx = i; break

        if header_row_idx is None:
            wb.close()
            return jsonify({'success': False, 'error': 'Header row not found'}), 400

        col_map = {}
        for ci, cell in enumerate(ws[header_row_idx], start=1):
            if cell.value:
                col_map[str(cell.value).strip()] = ci

        new_row = DATA_START_ROW
        for r in range(DATA_START_ROW, ws.max_row + 2):
            row_empty = True
            for ci in range(1, 14):
                if ws.cell(row=r, column=ci).value not in (None, ''):
                    row_empty = False
                    break
            if row_empty:
                new_row = r
                break

        for col_name, value in fields.items():
            if col_name in col_map:
                cast_value = value
                try:
                    if '.' in str(value):
                        cast_value = float(value)
                    else:
                        cast_value = int(value)
                except Exception:
                    cast_value = value if value != '' else None
                ws.cell(row=new_row, column=col_map[col_name]).value = cast_value

        if 'Date' not in fields and 'التاريخ' not in fields:
            date_col = col_map.get('Date') or col_map.get('التاريخ')
            if date_col:
                ws.cell(row=new_row, column=date_col).value = datetime.now().strftime('%Y-%m-%d')

        wb.save(filepath)
        wb.close()
        return jsonify({'success': True, 'new_row': new_row})

    except Exception:
        return jsonify({'success': False, 'error': 'حدث خطأ أثناء إضافة الصف'}), 500



@app.route('/api/dashboard')
@zone_required
def api_dashboard():
    """Scan all Excel files for the current zone and return dashboard data."""
    zone_id = session.get('active_view_zone') or session.get('zone', '')
    is_super = session.get('is_super', False)

    root = get_years_root()
    if not root:
        return jsonify({'error': 'No data directory'}), 404

    # Collect all xlsx/xlsm files for the zone
    files_to_scan = []
    scan_zones = [z['id'] for z in ZONES if z['id'] not in SUPER_ZONES] if is_super else [zone_id]

    for zid in scan_zones:
        zone_path = os.path.join(root, zid)
        if not os.path.isdir(zone_path):
            continue
        for root_dir, dirs, files in os.walk(zone_path):
            for f in files:
                if f.lower().endswith(('.xlsx', '.xlsm', '.xls')):
                    files_to_scan.append((zid, os.path.join(root_dir, f)))

    total_items = 0
    total_in    = 0
    total_out   = 0
    zero_stock  = 0
    low_stock   = 0
    LOW_THRESHOLD = 10
    alerts      = []
    item_out    = {}   # name -> total out
    zone_in     = {}   # zone -> total in
    zone_out    = {}   # zone -> total out

    for zid, fpath in files_to_scan:
        zone_label = next((z['label'] for z in ZONES if z['id'] == zid), zid)
        try:
            wb = openpyxl.load_workbook(fpath, data_only=True, read_only=True)
        except Exception:
            continue

        for sheet_name in wb.sheetnames:
            if 'log' in sheet_name.lower():
                continue
            ws = wb[sheet_name]
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                continue

            # Detect header row
            header_idx = None
            headers    = []
            for i, row in enumerate(rows):
                rv = [str(c).strip() if c else '' for c in row]
                if any(k in rv for k in ('Color', 'IN', 'OUT', 'Current Balance', 'Basic')):
                    header_idx = i
                    headers    = rv
                    break
            if header_idx is None:
                continue

            def col(name):
                for h in (name, name.lower(), name.upper()):
                    if h in headers:
                        return headers.index(h)
                return None

            ci_color   = col('Color')
            ci_in      = col('IN')
            ci_out     = col('OUT')
            ci_balance = col('Current Balance')

            for row in rows[header_idx + 1:]:
                if all(c is None or str(c).strip() == '' for c in row):
                    continue
                total_items += 1

                in_val  = 0
                out_val = 0
                bal_val = None

                if ci_in  is not None and ci_in  < len(row):
                    try: in_val  = float(row[ci_in]  or 0)
                    except: pass
                if ci_out is not None and ci_out < len(row):
                    try: out_val = float(row[ci_out] or 0)
                    except: pass
                if ci_balance is not None and ci_balance < len(row):
                    try: bal_val = float(row[ci_balance] or 0)
                    except: pass

                total_in  += in_val
                total_out += out_val
                zone_in[zone_label]  = zone_in.get(zone_label,  0) + in_val
                zone_out[zone_label] = zone_out.get(zone_label, 0) + out_val

                # Item name
                item_name = ''
                if ci_color is not None and ci_color < len(row):
                    item_name = str(row[ci_color] or '').strip()

                if item_name and out_val > 0:
                    item_out[item_name] = item_out.get(item_name, 0) + out_val

                if bal_val is not None:
                    if bal_val == 0:
                        zero_stock += 1
                        alerts.append({'name': item_name or '—', 'sheet': sheet_name,
                                       'balance': 0, 'level': 'danger'})
                    elif bal_val < LOW_THRESHOLD:
                        low_stock += 1
                        alerts.append({'name': item_name or '—', 'sheet': sheet_name,
                                       'balance': bal_val, 'level': 'warn'})

        wb.close()

    top_items = sorted([{'name': k, 'out': v} for k, v in item_out.items()],
                       key=lambda x: x['out'], reverse=True)[:10]

    return jsonify({
        'total_items': total_items,
        'total_in':    round(total_in,  2),
        'total_out':   round(total_out, 2),
        'zero_stock':  zero_stock,
        'low_stock':   low_stock,
        'alerts':      alerts[:50],
        'top_items':   top_items,
        'zone_in':     {k: round(v, 2) for k, v in zone_in.items()},
        'zone_out':    {k: round(v, 2) for k, v in zone_out.items()},
    })

@app.route('/api/login_log')
@zone_required
def api_login_log():
    """Return login history — admin/dev only."""
    if not session.get('is_super'):
        return jsonify({'error': 'غير مصرح'}), 403
    with _log_lock:
        entries = _read_login_log()
    return jsonify({'entries': list(reversed(entries))})

@app.route('/api/alert_count')
@zone_required
def api_alert_count():
    """Quick scan: return number of zero-stock items for the badge."""
    zone_id  = session.get('active_view_zone') or session.get('zone', '')
    is_super = session.get('is_super', False)
    root = get_years_root()
    if not root:
        return jsonify({'zero': 0})
    scan_zones = [z['id'] for z in ZONES if z['id'] not in SUPER_ZONES] if is_super else [zone_id]
    zero = 0
    for zid in scan_zones:
        zone_path = os.path.join(root, zid)
        if not os.path.isdir(zone_path):
            continue
        for rdir, dirs, files in os.walk(zone_path):
            for f in files:
                if not f.lower().endswith(('.xlsx','.xlsm','.xls')):
                    continue
                try:
                    wb = openpyxl.load_workbook(os.path.join(rdir,f), data_only=True, read_only=True)
                    for sname in wb.sheetnames:
                        if 'log' in sname.lower(): continue
                        ws = wb[sname]
                        rows = list(ws.iter_rows(values_only=True))
                        hdr_idx = None
                        headers = []
                        for i,row in enumerate(rows):
                            rv=[str(c).strip() if c else '' for c in row]
                            if 'Current Balance' in rv:
                                hdr_idx=i; headers=rv; break
                        if hdr_idx is None: continue
                        ci_bal = headers.index('Current Balance')
                        for row in rows[hdr_idx+1:]:
                            if all(c is None or str(c).strip()=='' for c in row): continue
                            try:
                                if ci_bal < len(row) and float(row[ci_bal] or 1) == 0:
                                    zero += 1
                            except: pass
                    wb.close()
                except: pass
    return jsonify({'zero': zero})

# ══════════════════════════════════════════════════════════════════
#  QR SCANNER — صفحة المسح + API يرجع آخر رصيد من ملف الإكسيل
# ══════════════════════════════════════════════════════════════════

# خريطة SKU → (اسم الشيت، اسم اللون في الملف)
SKU_MAP = {
    'CHKN-BLU-001': ('Chicken', 'Blue'),
    'CHKN-BRN-001': ('Chicken', 'Brown'),
    'CHKN-DBL-001': ('Chicken', 'Dark Blue'),
    'CHKN-DGR-001': ('Chicken', 'Dark Green'),
    'CHKN-GRY-001': ('Chicken', 'Gray'),
    'CHKN-GRN-001': ('Chicken', 'Green'),
    'CHKN-LBL-001': ('Chicken', 'Light Blue'),
    'CHKN-ORG-001': ('Chicken', 'Orange'),
    'CHKN-ORG-002': ('Chicken', 'Orange (70*45)'),
    'CHKN-PRP-001': ('Chicken', 'Purple'),
    'CHKN-RED-001': ('Chicken', 'Red'),
    'CHKN-YLW-001': ('Chicken', 'Yellow'),
}

SKU_NAMES_AR = {
    'CHKN-BLU-001': 'أزرق',
    'CHKN-BRN-001': 'بني',
    'CHKN-DBL-001': 'أزرق غامق',
    'CHKN-DGR-001': 'أخضر غامق',
    'CHKN-GRY-001': 'رمادي',
    'CHKN-GRN-001': 'أخضر',
    'CHKN-LBL-001': 'أزرق فاتح',
    'CHKN-ORG-001': 'برتقالي',
    'CHKN-ORG-002': 'برتقالي 70×45',
    'CHKN-PRP-001': 'بنفسجي',
    'CHKN-RED-001': 'أحمر',
    'CHKN-YLW-001': 'أصفر',
}

SKU_HEX = {
    'CHKN-BLU-001': '#3b82f6',
    'CHKN-BRN-001': '#92400e',
    'CHKN-DBL-001': '#1e3a8a',
    'CHKN-DGR-001': '#14532d',
    'CHKN-GRY-001': '#6b7280',
    'CHKN-GRN-001': '#16a34a',
    'CHKN-LBL-001': '#7dd3fc',
    'CHKN-ORG-001': '#f97316',
    'CHKN-ORG-002': '#fb923c',
    'CHKN-PRP-001': '#7c3aed',
    'CHKN-RED-001': '#dc2626',
    'CHKN-YLW-001': '#eab308',
}

def _find_latest_sacks_file():
    """يبحث عن أحدث ملف Sacks.xlsm عبر كل الزونات والسنوات والأشهر."""
    root = get_years_root()
    if not root:
        return None
    latest_path = None
    latest_mtime = 0
    for zone_folder in os.listdir(root):
        zone_path = os.path.join(root, zone_folder)
        if not os.path.isdir(zone_path):
            continue
        for year_folder in os.listdir(zone_path):
            year_path = os.path.join(zone_path, year_folder)
            if not os.path.isdir(year_path):
                continue
            for month_folder in os.listdir(year_path):
                month_path = os.path.join(year_path, month_folder)
                sacks_path = os.path.join(month_path, 'Sacks.xlsm')
                if os.path.isfile(sacks_path):
                    mtime = os.path.getmtime(sacks_path)
                    if mtime > latest_mtime:
                        latest_mtime = mtime
                        latest_path = sacks_path
    return latest_path

def _get_last_balance(sheet_name, color_name):
    """يفتح أحدث Sacks.xlsm ويرجع آخر Current Balance للون المحدد."""
    filepath = _find_latest_sacks_file()
    if not filepath:
        return None, None, None

    try:
        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
        if sheet_name not in wb.sheetnames:
            wb.close()
            return None, None, None

        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        wb.close()

        # إيجاد صف الهيدر
        hdr_idx = None
        headers = []
        for i, row in enumerate(rows):
            rv = [str(c).strip() if c else '' for c in row]
            if 'Current Balance' in rv:
                hdr_idx = i
                headers = rv
                break
        if hdr_idx is None:
            return None, None, None

        ci_color   = headers.index('Color')           if 'Color'           in headers else None
        ci_balance = headers.index('Current Balance') if 'Current Balance' in headers else None
        ci_date    = headers.index('Date')            if 'Date'            in headers else None

        if ci_color is None or ci_balance is None:
            return None, None, None

        last_balance = None
        last_date    = None

        for row in rows[hdr_idx + 1:]:
            if all(c is None or str(c).strip() == '' for c in row):
                continue
            row_color = str(row[ci_color]).strip() if ci_color < len(row) and row[ci_color] else ''
            if row_color.lower() != color_name.lower():
                continue
            bal = row[ci_balance] if ci_balance < len(row) else None
            if bal is not None and str(bal).strip() not in ('', 'None', '/'):
                try:
                    last_balance = float(bal)
                    if ci_date and ci_date < len(row) and row[ci_date]:
                        d = row[ci_date]
                        last_date = d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d)[:10]
                except (ValueError, TypeError):
                    pass

        return last_balance, last_date, filepath

    except Exception as e:
        _logger.error(f'QR scan error: {e}')
        return None, None, None


@app.route('/scan')
@zone_required
def scan_page():
    return render_template('scan.html')


@app.route('/api/scan/<sku>')
@zone_required
def api_scan(sku):
    """يرجع آخر رصيد للصنف من ملف الإكسيل الأحدث."""
    sku = sku.strip().upper()
    if sku not in SKU_MAP:
        return jsonify({'found': False, 'error': f'"{sku}" غير مسجل في النظام'}), 404

    sheet_name, color_name = SKU_MAP[sku]
    balance, date, filepath = _get_last_balance(sheet_name, color_name)

    if balance is None:
        return jsonify({'found': False, 'error': 'تعذّر قراءة الملف أو لا توجد بيانات'}), 500

    return jsonify({
        'found':    True,
        'sku':      sku,
        'nameAr':   SKU_NAMES_AR.get(sku, sku),
        'category': 'شوالات الجاج',
        'color':    color_name,
        'hex':      SKU_HEX.get(sku, '#6b7280'),
        'balance':  int(balance),
        'date':     date or '—',
    })


# ══════════════════════════════════════════════════════════════════
#  REPORTS — list & serve Excel files from /reports folder
# ══════════════════════════════════════════════════════════════════
REPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports')

REPORTS_ALLOWED = ('.xlsx', '.xlsm', '.xls', '.csv',
                   '.docx', '.doc', '.dotx',
                   '.pptx', '.ppt', '.pps',
                   '.pdf')

@app.route('/api/reports')
@zone_required
def api_reports():
    """Return a list of all supported report files inside the reports/ folder."""
    if not os.path.isdir(REPORTS_DIR):
        return jsonify({'files': []})
    files = [
        f for f in sorted(os.listdir(REPORTS_DIR))
        if f.lower().endswith(REPORTS_ALLOWED)
    ]
    return jsonify({'files': files})

@app.route('/reports/file/<path:filename>')
@zone_required
def download_report(filename):
    """Serve a report file directly (for PDF, Word, PowerPoint)."""
    safe_name = os.path.basename(filename)
    filepath  = os.path.join(REPORTS_DIR, safe_name)
    if not os.path.isfile(filepath):
        return 'File not found', 404
    if not safe_name.lower().endswith(REPORTS_ALLOWED):
        return 'File type not allowed', 403
    from flask import send_file
    return send_file(filepath, as_attachment=False)

@app.route('/reports/print/<path:filename>')
@zone_required
def print_report(filename):
    """Serve or convert a report file for viewing/printing."""
    from flask import send_file, Response
    safe_name = os.path.basename(filename)
    filepath  = os.path.join(REPORTS_DIR, safe_name)
    if not os.path.isfile(filepath):
        return 'File not found', 404

    ext = safe_name.lower().rsplit('.', 1)[-1]

    # ── PDF: serve directly in browser ──────────────────────────────
    if ext == 'pdf':
        return send_file(filepath, mimetype='application/pdf', as_attachment=False)

    # ── Word: convert to printable HTML (with proper colspan & colors) ──
    if ext in ('docx', 'doc', 'dotx'):
        try:
            from docx import Document
            from docx.oxml.ns import qn as _qn

            def _cell_fill(cell):
                tcPr = cell._tc.find(_qn('w:tcPr'))
                if tcPr is None: return None
                shd = tcPr.find(_qn('w:shd'))
                if shd is None: return None
                f = shd.get(_qn('w:fill'))
                return f if f and f not in ('auto', '000000', 'FFFFFF', 'ffffff') else None

            def _unique_cells(row):
                seen, result = {}, []
                for cell in row.cells:
                    cid = id(cell)
                    if cid not in seen:
                        seen[cid] = len(result)
                        result.append((cell, 1))
                    else:
                        idx = seen[cid]
                        result[idx] = (result[idx][0], result[idx][1] + 1)
                return result

            def _cell_html(cell):
                parts = []
                for para in cell.paragraphs:
                    for run in para.runs:
                        t = run.text.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
                        if not t: continue
                        s = ''
                        if run.bold: s += 'font-weight:bold;'
                        try:
                            if run.font.color and run.font.color.type:
                                s += f'color:#{run.font.color.rgb};'
                        except: pass
                        parts.append(f'<span style="{s}">{t}</span>' if s else t)
                return ''.join(parts) or '&nbsp;'

            doc = Document(filepath)
            parts = []

            # Paragraphs outside tables
            for para in doc.paragraphs:
                text = para.text.strip()
                if text:
                    style = para.style.name.lower() if para.style else ''
                    tag = 'h1' if 'heading 1' in style else 'h2' if 'heading 2' in style else 'h3' if 'heading 3' in style else 'p'
                    parts.append(f'<{tag}>{text}</{tag}>')

            # Tables with proper colspan and background colors
            for table in doc.tables:
                tbl = '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">'
                for ri, row in enumerate(table.rows):
                    tbl += '<tr>'
                    for cell, span in _unique_cells(row):
                        fill = _cell_fill(cell)
                        bg = f'background:#{fill};' if fill else ''
                        # Detect header-like cells (dark background)
                        is_dark = fill and int(fill[0:2],16)+int(fill[2:4],16)+int(fill[4:6],16) < 300 if fill and len(fill)==6 else False
                        color = 'color:#fff;' if is_dark else ''
                        tag = 'th' if ri == 0 else 'td'
                        tbl += (f'<{tag} colspan="{span}" '
                                f'style="border:1px solid #b0bec5;padding:4px 6px;text-align:center;{bg}{color}">'
                                f'{_cell_html(cell)}</{tag}>')
                    tbl += '</tr>'
                tbl += '</table>'
                parts.append(tbl)

            body_html = ''.join(parts)

        except ImportError:
            import zipfile, xml.etree.ElementTree as ET
            NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
            try:
                with zipfile.ZipFile(filepath, 'r') as z:
                    xml_content = z.read('word/document.xml')
                root = ET.fromstring(xml_content)
                lines = []
                for para in root.iter(f'{{{NS}}}p'):
                    texts = [t.text or '' for t in para.iter(f'{{{NS}}}t')]
                    line = ''.join(texts).strip()
                    lines.append(f'<p>{line}</p>' if line else '<br>')
                body_html = ''.join(lines)
            except Exception as e:
                return f'Could not open Word file: {e}', 500
        except Exception as e:
            return f'Could not open Word file: {e}', 500

        html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{safe_name}</title>
  <style>
    * {{ margin:0; padding:0; box-sizing:border-box; }}
    body {{ font-family: Arial, sans-serif; font-size: 12px; padding: 32px; background:#fff; color:#000; max-width: 900px; margin: auto; }}
    h1,h2,h3,h4 {{ margin: 14px 0 6px; color:#1a3a5c; }}
    p {{ margin-bottom: 8px; line-height: 1.6; }}
    table {{ border-collapse: collapse; width:100%; margin-bottom: 16px; }}
    th, td {{ border: 1px solid #bbb; padding: 5px 8px; }}
    th {{ background: #1a3a5c; color: #fff; }}
    .header {{ text-align:center; margin-bottom:20px; border-bottom: 2px solid #1a3a5c; padding-bottom: 10px; }}
    @media print {{ body {{ padding: 8px; }} @page {{ margin: 1cm; }} }}
  </style>
</head>
<body>
  <div class="header">
    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAADa/0lEQVR4nOydd5wcR5X4v9Vh0uYclHOWrGTZsmXLOQeMbRwIxnDAYTKGA37E44477oCDI3PkbAwY44Bzthxky1bOcaXV5jyxu6t+f/SEntnZJO1KK8PTZzUz3ZWrXqxXrwT/gBMO/3b/j/nsd/+VL773M2zYs439LUc42NpE90+f4+3f+X/sajpEU087R3s6SPS0QMAgNOkMwl/9Jf/84y+LfUcbtN5YxLQ1ApF4vNCWTlnMildIXdTGrUSNrkRdPBavFLpWKTXKLNsOKVShpumFaJoPMKSUhrIdDQUIELrmCE3YQmApx4lJ2+kThhbzGb6w5qhuadvtfp+/Teo06abe4sNo8utmmyn0zqDh70URLQ2GrMpQiXP1yrPULV+6ExZPgAP7IFhJTXE5NcVlTKuo560rL+OGn/8/5tZMZmpVPXPqpvDNd3yaa7/2Ae79xHdP9vT8XYE42Q34e4B//9sveXH7a7zn4uv587pH2d6wl71tjWz8j1/x/p98lb3Nh2nsbKe9/TA8tIdLP/5OIqYQUkotZiXMRCIRitrxkoTjVFuOXW/bzmRbqUmOUBOlokYpWWkrWaw0CiTKj6NMpNQVaApQqXkWCBCglNswBSiFEiBEcimI5AuFcjMK5T5SEk04mJotNJHQJWFDab0C2oTQ2nRoNBANhqY1GIbe6DPN5qDp7zBNs8+HFjc1w9GVo5768m8Q10+iqGwyE4ormFZVz0ULT+cTf/gui+tmMLduKmcvWM7/3PMLblxzKV+55cMnfL7+nuAfBGCM4Ifr7uW+dY+yZtEqXtrxGjsbD7B184u8/4YPsmHvVg52tnC07QjctZWLv3y76InbIm4lzISVCMWlXR6X9gTbsWcnpDPXtu0ZjnQm2VAlUSVKqYAEUwmhZdfqIrZSZJAc5XmfnG6VeaYUCBQIkZ1MATL5XPPkTf4WScriFq8QIDWFIzQRF7oIG5rWrgvtiK5pe02HnYZm7PIZxoGg7mvxGUZfwO+3CvymfPxzP1fimmmU1U5mWmkNCybO4Fcf/U9mvP8SZtZP5ox5y7jv5ce5+dyr+cQlbx+VufkHZOAfBGAU4TtP3c3P7v8j77n6Zv720tNsPbyX3d/6K2/5zifYcngfe1sbib3yAre8/WMcCHdq8UTcF0vEiqOJRH3MsmbFHXuBY9vzLaVm2II6pWSpg/IrpbQUU05DmmGL5HeRZt5CuL8EoCHQhEADNE1DEwKh0qndxCmGr1y2L5VCSYmUColCaqA04b5Xrs6gUK70oDztcSvOSBNKIZRSmqMsoYleXdOafZq+39C1bT7d2Ow3zB1B03fEr5tdfp8vXuUrkPf/5/8prlrMrOp6ZtVP4cFP/ZDpd1zG3NrJrF20kl889hfedtG1fOqad4/5fP49wD8IwHHCHzc/zq8ef4CPXnMrP/jb3Wxt2MPmp+/l+jd/iE2HdrO35SjO79ZzyX++R7RHI0Y0FiuIW1ZtzLHnJJzEsoRlLUtIZ44jVY2DKlBK6QpApJAMkhjqIrUATQh0oWHoBj7TIGD6KPQFKfKHKPaHKAwWUFpQSGEgRKHffR4y/fhME59h4tMNdE1H1wRCaCilsB0HW9pYtkPCThC3LCJWjL5YlEgiRk8iSnekj95wH93RMD2xMOF4lJhtYTkOjpI4Ikk8km1WUmWkDc0lDAIQKKlBVBdaiym0vaZubPKb5qtBw7cloPuO+DWtt8Tvt5/88m8kty5lZlkd82onc9/dP2DB5W9mwYTp/Mtlt/Jv9/+Sz13zTpZNXXSSZv/Uh38QgGOAgqJCvvDnH/Kt+37OLedczbodG1i3ezPvWXs1L+7ezK6WI0T/sI7zPnKb1mXFzLiySqJWYmrUSiyNxxNnJqSzxFZqioMqVlLqSogMb1cqyUwFQggMNHyGQcjnp9RfQGVhKbVlFUwsraKurJLa0kqqSsqoLCylOFhIgT+A3/DhN01MzUDXNDRNS0sELqSkhqQF0PuZZR5QOEoipcRybOK2RdxK0BeP0B3po7W3k9buTpq62zna3U5jVxtN3e209XbRFQ0TicewHAdbyIyEoZSrWgCkCIImpK5rYUNoR3xKbPYL7eWg37c+EAjsCgizs0gPJJ79yq9l4N1nMKtmIqunL+Qnj/+VM2cu4Mw5i7n7ucf44FU3s+FPT/Hrn/z8BKyANw78gwCMAF7dv40v3vMjfvjuz/KBn/4Hmw7uYvc3/so5X3kXu4420Lz1Va6+8ibR0Nnhi8YTpdF4fFYskVgVxz4roeQSSzl10pZBlcYzl0MKoaHpGrqm4dMNiswAFYUlTCyvZnrVBGZWT2RadT0Ty6qpKCyhJFhI0B/A1PWkVJBCbpGtJgwCIpl2oHwiSRAGKi2VP6Uy2LZNJBFLE4ZD7c3sbznC3rZG9nc00tjRSltPN33RCAnHxhEqY0JIr0KFJhWaEJahay0+w9zoR382oBkvBE1zVygU6phUWZ34632/UjWzljG3dhJPfekXzPnIFSyaPIs/fuybXPXVf+bOa97F2nkrRzK1f7fwDwIwDPjTxqf5f7/6JrdfeB1/2/AsL+zZzC2nX8S63ZvYcXQ/v3/f5/j6Y/eY4US8OGrFp0etxBkx2zo/YdvLLFvWSqV8UrjW9pRJXgN0oeHXDcoChdRVVDOzeiLz6qeyYMI0plXVU1tSQXGoEJ9uurq7EGnx+ljARdpjzz+yelzpIWFbdEf6aOpqY1/LEbYd3sf2xgPsaW+kqaudrliYuJXAljJDbjSRsWMoZZmKFr9hvBrw+58I+gPrgpqxr1D4ev7lzCutN//xa8yvnsSaWafx21ce56zZi7lm5fn89Ml7uPOq23nL6RePaV9PdfgHARgEPnP39/j+Q7/lredcxQu7NvLKfb/lwlvex9Yj+zi643UuOvdq7Wi4KxS1rfqYlVgRtayL4pa12lJyiiOUXylcPTipC+tCw2eaFAdC1JdWMKd2MosmzmTJ5FnMrJlETXE5IX8AUzOSLRiAA6ck9nENXhki892WDpF4jKbudnY3NfD6oV1sPLiTXS2HaerpoDfhqg1SOkmDIwjNtXtoQsRNTT/oF9q6oGY+FvT714f8viMTC0qjDz57v5w0ZwlLJ8/mr8/cx+ql57B6xmL+suEp3rnmav7f9e87mYMxbmHcL6OTAf/12K/417t+wDvPu4ant77Cpn//A2d87q1saz5E9w+fZuXn3mr2RiOlUTsxL2rHL4hJ+6KEkgtsRxUrKdNcWgiBrusEdJPyYCHTK+pYMnk2p0+fz6LJM5lYXk2hP4Sh6wDpBZ8XvNb2PCAYa75+7CA8KkZm98H9sB2bnmiYQ+3NbGrYzcv7trHx0G4OtB6lM9pHXNnIpP1AZLYcMYTo8Rv6loBhPhrUzMeCpn9Haaig+8V/+51V+f7zWVA9iae/+AtWfvYtrF2wgj+se4R/efO7ef/at5yMIRi38A8C4IGP/ObrfPP+X3P7+dfy8t6tbP6Pu1jxhVvYcvgAv7j+g+I/n7/X3xeL1Yet+OmxhHVZ3LHOsaQzyQHdK1rrQhAQJpUFxcysnczpM+ezeuZiFk6YQXVxGUHT51r5j0OcdzfwT8Xpy7YuuDuYbj+UUkQTcRq72th0aBcv7NnE+oM72NvSSGdfL3Hbwkm7NSmEAB0cE+1gQDeeCvr9DxYGg68U+kNNr3z8+/GiOy9j8YRprPvSb1n+yes5c+5p/PH5h3nPZTfxr9ffcZL6P77gVFxBow7ffvZuvvSrb3Pz2it4avN6Nn3lbpZ99lY2Ht7HRy6+UjyyeWNBOB6bErUTayOJxDVxaa+0lSrN7Iu7Lnc+w6SsqJgZlfWsmjKfc+acxpIps6ktrcBnmADHh/TjDMZG6hBpuhazEjR2tPDq/h08tWMD6w/s4EDHUXriESzbzqgIuGZM09DaAz7/C0HD99eQMJ8t9PsPfWL15dH33PtjtbhmCi/+x+9Z8fmbOX/+Sv6y4Uk+edW7ePeaa0e9B6cS/F0TgK8/+lu+95dfcd05l/Lkxhd55Su/Y8XnbuK1A3t437nXiKf2bS4KxyIzI/H4JVHbvjounSWOdIISUu52GLpBoRlgYkklK6fN54KFK1k5fT6TymsImD63IjVc2/zYwXhWEXJBpFsr0is0HI+xr/Uwz+18nSe3b+D1Q7tp6u4gYsWRSrr5dBCahoEI+xEbQn7/X0LBwKOFZmDfJ1ddE3nf/d9XSybP5PkH72HNhdfy5jPO54/PP8Y7L3sz71pz3Unr78mEv0sCsOHwDj70q6/zxevfzZf+8COevefnnHX5W3m9YS+fuOxq8Yf1Lxb32dbsqJ24LBqPXxt37IWOUGbKxVYAPs2gsrCEBROmcc7spZw3bznzJ06jJFgIuOKsV/fNggGMeKesVH8CIOXxKJWkvbeb1w7s4pEtL/Ls7o3saz1CTyyCpaRLM1wPRHRDj/l9xushjD8HhfFIcUHh3o3/+ce+6n9ay/JJs3j80GtcMGc5D33yR9z8/Tu5987vEwmHT3ZXTyj8XS23Pzx8P/ccfJHfveffuPx/Pszz215n9dzFrN+9ldbvP86iT91Q1JuIzg7H4ldFpf2mhJTzHUcaKRdZTUDI56euuJwVU+Zy2ZKzOGfOaUwoq3YNecPl9COw4g/FuYXnbM+oQ4oijRZlGqjfI+xEytU4moizq+kgj295mUe3rmfL0QO09nWRsKzkCUdXndAdFfcL7fVQQfDukD/4tzItsH/D7+6OTrn+Eq5YsopHXt/AmXOX8MfnHuaTb343X7r272fH4O+GAPzvE7/j87/5HteceR7PbX2NK04/h/tefob9993HaTfcGOwM982I2tblEce6MW7Zix2UmTLsaUJQYAaYUl7Dmrmncfni1Zw+bT6VRaXJvXmvif5UEbTHD2SP4TDSZzIC4EiHhvYWntq5gQdee5ZXDuygua+LuLRRUroSgSYwTD3m14wXQlL7XYHf/3hdWdnh5za/llg8cz6bvvonTv/czbz17Mv5zfMP8r13f5blkxeMfmfHGbzhCcCW1v188Gf/wTvOuYIfPPInXvz8L1n0qRvYvGsTa5asNg/3dEwMx6IXRRPxW+KOs8oWBFTyMIyGoDhUwMzqCaydvZQrl57NsqlzKQqEgP7bdvlE/gHVgFMARp2cjaL/Qm7bUkSkqbudZ3a8xn2vP8eLB7fR2N5K3EqgdOFKBI7CdGRPIOB7PBQM/LrQ8D+/Ztqi1rtfe1qunDKHlxp2sWbGQv72wsP889W38/13fm50GjxO4Q1NAL74lx/xxV/8D9euvZTntm5kxZy5vLRzK28980Ltb9teqQ7HYmdGbOuWmGVdZDlOiQKUAE0TFOp+ZlbWc/GSM7l2+bksmjiDkC8A5N+vf0Px/lPUGJE+GamgtbeTp3e+xp/XP8GLe7dyNNxFzE4gHIUQCs3UMA29MaSMe0Km//elwYKNm//8p97p117Fv1xxM9998E+snb+Mp7a8wh/+5ZvMrZpysrs3JnDqzfIw4E+bn+br9/yU60+/gF89+yAb/u13zPn4tex69m8sPO+qws5oZHHEit8Sc6w3JZSql0qhHFdULAgGmVZTzwWzl3Pd8vNYPm3uoIh/vJCagDcM8ThJkC1pZbYSm7raeWLrev782tO8uHcrLd3tWCg0Q3NdsqVSfk3fHPL7f1kQCPx1WmXdgac3b7BWTZ/Huj2buGjRKh6975d8+ANf4lu3fupkdW/M4A1HAD5/z4/5zz/+kPMWn876XdtYMmMGL+/dzgVzTzM2Nx+a3BeNXhlJWO+I2/ZpjlBaKvRNQDOZVFzJ2gXLuWHVRZwxY6Er6ueewx8JjLLLrreofC0a71LIaLRv+GUkjzkJl3Af7mjhgdee455XnuS1xn10xPqQKfuAUBiGHg6a5iNB3feLEsP/3I6v/7V9ygcv4Ue3fZKP//F7XLn0LJ7e/hovfOFXx9mD8QVvKAJw6dc/wD9d+Gb+/e4fseHffsfMD1/DnnvuZe5N15V0RyOrIk7inTHbusJyZJGSCqUkhq5RU1LO6ukLuWH5BZy/cAUVhaXA2HD8kUDKbba/XWF0EH1UyjkOIpfyAhxsnI+1jd6xE2ljoWTX0YP8+dWn+OvG59jeeIC+WBSS9gFNgE+KA0Fh/KrA9P1hSnn1rvVHdidWTpvHtoY9rJi1kGc3v8Lnb/kAn7r0tmNo1fiDNwQB+LdHf8l37/klK+cuZuPencybPJUXdmzi3Jmn6a8f2TsjnIi9Keo4t8WVM9eNdCVBKop9QZZMmsENqy7k2mXnMqm8Bjh+xB+u4W+k1u/xAMNByPEiieTOQ8pGEEvEWb9vG79d9zCPbV/Poe5WEtJBUwqkxEDEA7rxZCgQ+FFpMPT0jgf+2jH78ivZ9fX7WfG5m1j/r7/jlu//C797/3+dxN6NDpzyBODtP/48v/z2l1lx9c288uwjLDzjPLasf4l5y1cUd/b2nRmxE++KWYnLbU0UKAEKid80mV5WxyULVnHzmRezdMocTN0YUtw/YRb941EdUlv3o9keD4wX5B4ODDRfKYmgvbeLv216gd+99Agv7d9GR28PqUNcmgCfYewL+n0/L/QH/rBq6sw9j29+3bl40em8cmgXp0+fx46mBr50wz9x5cLzTnDPRg9OaQJw7n+/j7NmzudPLz3FHedfw3/e+2s+d/lt4j8f+u2UvkT0uqhlvSsu5Xyp3LPmQhNUFZeyeuYi3nrGJVy44HTXc+949PxTBIZNvE7CDsBYE5WBVI2UBLa9cT+/ef4h7t3wDHtaDpPAQWgieZpTRAKa8WBI6D+sKix9cXPjvr5Vsxayq7GBpdPn8PKuLXzrHXfyrnNOTVfiU5IAfOYP3+OuFx5m+oSJbNu/jxmTJvDyzm0snDwlcKSzY3kkGr89allvtpUsUcI9kx/QDebUTebNp5/PTWdczKzqiUPqn290OC7EG0BKyVem8BCUYxnvsVSVUm3rjUZ4dMtL/PK5B3j+wBbaw73J96AphU+JjSGf7/slocK/7v3G/Udnf+Iadn3/XpZ/7CZe/Y/f88nffo3/uuHOMWnjWMIpRwC+9dzdfPi7X2Hl7EWs37eFBfUz2brpZWbOW1zeHe67NKLsO+KOc4bjSE1J9+hodVEp584+jXesuYK181ZQ4A+MGtcfKnTW3xtkQo1lDvJEE3FaejowdJ260iq0cegclSIyu5oO8asX/sY9G55hd0sDlm27pw2VwqfrLUGf75eF/sAvzp65aPvTO193PnHZDfz02Uf48IXX8eCWl/nzh795srsyIjilCMDHf/s/fP1tH2Xux65nx3//kckfvpyD33yAyR+7cnpvLHpzLBL/pwRyitJdTmMqjTm1k7lh1YXcuvoSZlRPBI6BCyXF4lPZq2+soJ+hzcPte2NhDrYfZf2+bTyzfQP1pZV85NJbqSouG5eSV6rtPdEwD216gZ89ex/rdm+mJx51oxJpAl0T8YBmPFhgBr43qbTi+S0tDdFzZy9i55FDLJs6i8Ptbbz4r78+yT0ZPpwyBODq73+Cm5aez5fu/QlvWnweP372LyysnWTuaDy8NKKs98Qc60bbcopUUt8vKSzk7BmLuf3sq7h48RkUBkJjJ0Zy6hjGRgu8MYa9W21SSTr6etjT3MCL+7fy2M71vLxnG62dHUwoKOfrb/0o1606H1M3xiURAJcQSCl57cBOfvLkvdy3+Xkae9pRWuquBYVfN14t8Pu/XV5QeN+OLRs7Vi09k+2N+5k/YTo94R7u/cz3mFUx6WR3ZUg4JQjA+V95HwUlhWzcuYO5M6by/ObXmFk7OdTY0XZ+JBb7cAJ5niPQpZIIRzKxuJJrVp7Lu9dey+KJM0/J7bZjgRNLiJIkILmCHOnQ0tPJ5sN7eWbHBp7avoHNTfvpsaJuWkehJSSXLlrFt267k+lVE066RDX0SUvB0c42fvfiw/z6hYfZ2nQQy7GSIdvBZ2gHg4bvR6Vm4Nf7/vjgoQU3XcP+zjYW1U5iV2sjn7zqVj595XtPVHeOCcY9AVj4uZuoDZWypekAU4preGnL68yeOa28PRK+NmLFP5RIWEsUIAX4TIOFddN426pLuGn1JdSWVJxcC/8p6lPvBUHypK7wPsvo9wnH5mhnKxsbdvPEjld5Yvsr7Gw8RMJKgK4jNC1TiKMoCYT43DXv5H3nv5mQLzBiwnyipS0hBJF4jEe2vMSPnr6X5/ZspC8Rc3cJUBiIrqDQf1UcCP3wT7d+eNstd39f7f7aX5lx55XsbTjEtedezF/e/7UT2OKRwbhenYs+fRPC1Njb2MjUuhq2Pn8/U0+7cFJ3pO9tUcd6r6XkZCklypEU+gKsnbeM95x3LRfOP52gzz82XP+UiMg7OpD3dGOSoMWtBIc6mnhl/3Ye276eZ3Zt5EBHE7btuPaSZPCUZKb0mAkFSyfN5Htv/yQrps0ft0PpJTRCCKRyVYIfPvkX7tu8jubeDkTyggdDEAuY5r0FPv+3Vs9e8PJLO7c6Dd9+hFkfu4o9B3bynQ/9Kx847+aT2Z0BYVyO/66uw1zwhfdSVlDMpl1bWDBzPlv/8y7qP3zZ7L5o/H0x27rNQZYpARJFVUEJVy1azfsvuJ6lU2ejJa+7OhVAeJbaqLd4GMRqMI6a36IfY19rIy/v28Zj217m2d2bONzZkvSz0JP1qtTVQplaPO3w6wbvPfcaPn/tuykvKD65czVMgp7yJTjU1sTPnnuAX7/wN/a1NCZvVgZNw/Fr+uOFvsA35lTWPbmz9Wjiw5dcx0+feYg9X/srX/zrD/ji1eMv0Mi4IwDP79nAFd/4JJWhIvbs3MDE6Qt57As/FOd98T1LeuLRD8UT1lscJUPJFcbUqnpuPfMSbl9zJdMq608ZxD8hMArSSorjR+Ix9rQcZt2eTTyy9SVe2LuVpu4ON42m9d8MTX316g9paqOYUlbN/771Y1y+5Cx0oY/b3ZV8cQc6w738/sVH+L+n7mVz4z4cIdNbhQHNeClk+v6rprT8b82dHdEbzrmEv657nMPfeYQ77/4GX7vhYyepJ/lhXBGAR7e/xDVfv5OK4jIaHr+PunMvY83Cxdqzm15f1ZuIfzzmWFc5UvlAIhQsqJvKe867lpvPvISKwpKsKLHDXU790p6qevtxHsoZyHknHI+yq+kQz+/exCPbXubF/dto7elMp+k/fgM0TGUn0BG8adkavnHLR5lQVn1sDR8OjMF8unaBOH/b+Dzfe/yPPL9/K3E7gYY7lj5d3xQyfF+bUFp5T0NrY98lp63iqe2bOfrdR7jjt1/le+PoWPG4WelP7d7AJV/9AJUFpRz51oNM/MiV1FfW6HsPHTgn5lifjEvnIgeluyf4dFZOm8cHz7+ea5afO3JjUj6mdJxwqm0FDuWxF45H2Xn0IM/uep2Ht7zEy/u30x7pSftDDNhbRTayp7YKcggAQGVBEV+94QPcuvpS9yzGEO0bTyCEwHYcntv5Ot969A88su1lIomYe4UbCp+m7woZvq9PKCm760B7a/f5p53O85tfpeWHT/KFB37Av175zye7CwAYQycZe9hydA9nfO6dlBYUc/ibD1CrLmVGTb25+eDe86NW4lMJ6ZwrUUIpSUA3WDNnGR++9CYumn86vuHuJw/AIUdrkY3nxZoPBkL+aCLOjqMHeWr7qzyy5SXWH9hOeziJ+OlTRio/6/Co/JBkvp5XIvUy+bA90sdvX3yY1bMWM7t2cqYt4x79XWcyQ9c5d94yikMFFAaC/PW1Z+mJR9A0QULJ2diJTzV2d/gnV1b/+vFX1nVesmwVFe8+l46fPMMX//I9vnjt+092N8aHBFBxxwXoaDR95xGq7riIeVOmmdsPHLgkkoh9KuE4Z0ncGH0hw8eli8/gw5fezFmzlqBrp46xbzyA16iXvpnHY9Xf3dzAMztf48HNL/LCns109Ha7F3VqWqaQEakaCqWSV5IOIIYX+QJ87qrbuOPCGwmYvrSD0Ym2CYyU5OQaSLcd2c93H7ubP7zyBG2RnowkIMWhkOn/n7qSsl8c6GjpvGzJKh54/SUiP32On750P7evunKsujTMfpxkmP6xa4jacb79rbfxvg/8jMnVdeaBpsZLownrMwnpnOEiv0ORGeDqZefw0ctuZtmUuXmde45Fnx//vGb0wWvVd6TD/tZGntq5gQdfX8e6vZtp7u1y06VDgiczqhx+LnJYfg54bTJZ8+AZdIFixZQ5/PC2T7Nk0qxR6d+YQqrrWT/dB/tbG/neE3/iV+seoqWnw939lODTtIaQz/+N+rKKn+9qPNx17qKlPL15A/EdW7juHXfw5ztOXlyBk0oAlnzmJsLxOEwoxj7URajEbzQebb0k5tiftZQ8Q6GQUlLiC3L9yvP48KW3sHDijKRfyRsLbYdLiEaDYKW4/uGOFp7ftZEHNq3jyZ0bONzZ4kr3WRw/X20Zm38/5Pbk8+6jD2x4UYRMHx+7+CY+cfnbKfQHj7N3JxZypanDHS384Ik/89On/kpTTztC1xAa+HTjUMjwfb2qoPjnhzs7emZU1HGoq4XuRC9//fR3uXLOqpPU/pMEM/7leop0g7/e/kUu/b/PUlNcpW88tPOiiJX4nKXUaiVAKUlpoICbVl3Ihy+5iTm1U95Qd+uNNeTbwgLoDPfy0r4t3Pfaszy6dT172xqRSrqInzu0ee48UJ5fXgKQpR0kXQHcVzmSgpd9Jr8srJ3MD2/7DKtmLhr104KjQjQHKCPfGB/tauMHj/2ZHz99L0fDHQhDQwiBKTkQwPjvssKSX0rd6VteN5fnD20iqhx6vv3Ecbbw2EAbOsnow+Xf+Ai6Jrh82mxWfftj3Hj6Odr2xn3nxSz707ZSZypASRf537r6Ej5+2a1J5M8yMZ8wEDmfw4JxIKF4ObAQgoRt8cr+bXzrkd/z2T//iB8/ez+7mxuQSiGEloWQHhm9f5lqoFlQmU+REQyUEmnfoOyGZX7vbj7CXzY8TTgeOdbujikMNJtZyI+rltaVVvLPF72Z915wHXWllSipUFJhOc7UqG19rCvWd2NdYXnw8UMbqayqoMAXZP4n3nwiutEPTjgBuPR7dyI0wc4v/YqHGvbztZs/JL7/xAOre634pxLINRIllHQo8Qe59cyL+fDFNzGjeuJJFflVzuew4CT4Eog8JCrF9Q+1N/PLdQ/y+Xt+xP88ehevHthBQtoIXXdzZRFXAf24cEafT3n2prhf5qrv/KRSeP6yilMZp8G44/DApnVsatiDRB7bAJxsEJkxqC2p4L3nvYn3nHMNtQVlKMtBKoEl1Iwo1sd3dzdfM33iFF+iM8q0iZMRQrD0c7ee8Caf0G3AO37zDZyA4gdv/jhz2xvZ+eW7+FhX69KeePRfEkquVUIJpRRF/iA3nXFRHuQfQBA7VZ13RhnyBcAMx6O8uGcLd7/yBH/b8hKH2pvc9149P4PJWVgqVMraNRTpG44vbU6aZJ2unVGghGJvSyN/fvUpFk6cSXHy9qXRgBPNOlLLsaaknPesvRbLtvnhE/fQFu1B6BqWUvPD8dgnDh480HferMV/29Cwz1laM5WDfe2s/Mq7Wf+ZH5+wtp4wrHl490tcMmsVXDObJUvOYOPGV5gwfcacrnDvF2JW4noJJigKfAHesvJ87rzibcxNi/3e5p580Xq8Q2qHZF/LEe597Rn+9MpTvNqwi7iVSDryQBa259pVROa5u9WV85yUh2/Gy2/E9Ncj/rsbDW79c2sn88PbPsVZMxe7ZzpOsflO20Y8A9LQ3sy3Hr6Ln6y7n+5E2FXJpFI+pT1X7At+9rUv3vXs2f/1TvWZK9/KHze9wNKpM/iPa+44Ye0dc7jn9ae47r/uREOxYtESNu3awYSq2gktvV2fiSYStzmOE1JK4TdMrlu5lk9f+Q4W1E//uznHnwvHQ+aEEEQTMZ7btZHfrnuIh7eu52hvR9KRJ1OwQoHKDeuRKiPVCrKs+VkFeAT+9H74sBuZ+k/1IwA+3eCOC97MF655N8WBApe+nOJrQAjBvtZGvvbQb/jVSw8TjkfBUWgKJ2CYD5YFQ589vG/rpmUr1rLhL7+CjfDY5he4cNGZY9+2Ma8BWPLpt9DS001hIER7bzfVpeVlTT0dH43YiQ/aSpYqNxY7ly0+k89d+y6WTZmLdhKQf7zIF8fSjvTWXmcL97zyFL978RFePbiLhGN5zuR7c2S4d7/aUgiaOsgzrFUyAg8hb7IsM4P7Y17tJP7vnZ/hjJmLT7qjymitCYFgR9NBvnLfz7h7/RPEbRtSIcZM43flBSVfPHRg78EZ02dxoOEQpWVl/PCmj3P9OZePQu0Dw5gbAa/49sfRNZ3ygmIsO8H0+onBlt7OWyOJxLtsKUsVCk0TrJl7Gh+//FaWTp6Dll6YYwQDlD3WyO8a0IZe0oO1I1/+VAirDQe2818P/JL/fug3vLBvm2vkS+n6/Qr1bskJz2uPuU4MF/nxKgrDS69wHYu82ZL17W87yn2vPUMkER1RmWMBxyyJ5RmPObWT+fBFb+HCOSswhEuUpcAfc5zrusN975s3bU5ZXyzKtPpJFAUK+N+n7z6+xg8DxpQAfPBXX6XQH6S+rAJpCs6cPFc/1Hz08kgifoctnXql3FN9y6fM4c5Lb+XMGYtc997kvzGDk8VWXA+m0SkqSQiEEEQSMf762jN88S8/4efP/42GzpZ0XPvhgHumXQyK8MPZBsv/Pmcm07RFuDaEPIQp7tg8vPVl9jQ3jAuJbLiQLdhktzz1+7Qps/noZbdwxoz5CD1JBKQsjiXi72ju6bx5cllNQChJoT+Armnc9rMvj2mbx4wA/HL9g3z7bf/CXe/5Nw60NbPt337PMw3bzwjb8Y/a0pmrcG/knV5Rx4cvegvnzVvRP1DkqTT7wwCVb72PuAwPrxaC9t4ufvHMfXz5rz/jb5tfpDcezbbwDwZJhM8Y+fL8JZ+nzgHltl943uetwm11vp4MQlQEu5sP89DmF13D5SkCw5lbXWicPWcJH730FubXTU3bQCzp1EXsxB0HO5ouvOS0MzQpBKtnL2HVnCV88NdfGbM2j9k24Ff+8BP0m1cydeIEtuzZwfQ7r53ZE4t8NKGcVTKpWFUXlvHe897EFUvOJmD63MWd8j+Hk8epxzlkXHmb+clT9/LL5x9iX8dRsk/sDVYASWzOGedcB52c70Pqw3kTiCwFw2sqENnJPA4Xikgizv2vPcc1S89lbt2UwWodEJRSw5aCThQowGeYXLzwDFp7u/jyvT/lSFcrShNYyHnhePSj97767JGGxx96LZGIsOfFx6mdf/qYtWdMJICbvv9Z/KaPqTV1RKJxFk2fW9bV2/PemJW41FHKACj0+Xnb2Zdy65mXUBIsSG4ljciW7MJQIvUxi9zja+Hkwt7mw3z9kd/xg2fuZV9nU872HgN43+T57cmSsc4P8H4wUFkfWfxdebHb63OQj+Ck8ijYcmQfT2xbj+XYw2jAyYdhq1xKUeAPcN3ytbxj9WUU+dzzDwpEQtpnd8ejH5h5xbV17W1tTFhxLoX+AJd8dWzCiY06AfjO3+6isriEysJi/KafORMn+472dtwQsRK3OI4sUFJhaBqXLz6Tf1p7LXWllUBSV1Rq5Jb/oQb9mDnA+NM/UkbEXU2H+O+Hf8MvX3iYpnC3G5Irrb/n6W8OMRhwiFVSL0//pt/3vKPpcZXMaA0i+0VW2pwGDKBb9MajPLjpeVp6OgZo8OBworn/SNauUoqKwhLeec5VXH3aGny6AULggC9mW2/q7Op8+6y6SaGgZlAcLCDkC/D1h3856m0edQLwgf/7It+59RMcbG9j63/9gd2HG1ZHEol/tpSqVwqEI1k5ZS4fuOhGZtZMcvXiMdjuG9Uyj6eonHaMPAy2yHwKwZ6mBr72t99w18tP0BnuzUzgQMiP53kS0bIce3LF/6xsw0UgNWAR/TcHs4lClsFXqazxUgI2HNrFy/u2ule6vwFhWlU977/wek6fNi8tHdmOLAsnEu861NV2wTWnnSX67Dg/eOcn+Pglbx/1+keVAFz61Q8wqXYKEz5wKXsO72P2x980rSce+VBcOovco+SKqRW1fODCG1g5bQG60DhuTjsAQo0q9T9mIaJ/20barvStOwIaOpr51qN3cfcrT9Ed7XON6F688Ir8yvswj/UxOR9Zz0VuoqGtlioHxVXOt4z+n5IIcvqvPO9ERn5wvwvaI708sHkd3dGwp+njWz0bCtyeuX3QhMbyaXO54/wbmFpSg7KlaxRUckZfIv6Bv7z6zNxdO7ey7LO3UXL72az9t3eNaltGjQDc89qTFPgDVBaVYWoGy6fNK2zv7XlnzEpcKJWjoyQloQJuX3sVly4+E79hjs5W3zgz8mRBcmttNFrY0dfN/z15D3e98gTdsTAuaiVZetZZCfLr/lntSn4qD/71SzA8Xwxv77KrzdlGSHH8LKLoehAKpTxdEBniBNhS8uyu19l6ZJ8n70i9DsYXuLOWkYB8hskli87gnWddQbHfPQMhhdDi0lnTHu17z+JFy0t13WRCRTUB089//+3no9aWUSMAb7r1fH7/z/9GZ6yX82Yu1Y50tl4SsRNvc5QqQoGuBJctPINbVl9KSbBw9Pf5T7K76GAL8nidSWJWnD+uf4JfrHuI9nB3ijkOUkl/xOtnFPTq9P3yDs8WM7x+iX4/s1R+r19AvnxScbithce2vETcdq/lymcyGDGMI/dipRQlwQJuXX0pVyw5C0PooMCBYNSxb2zu67566fT5etyOs2rmQj5x2W2jVveoEIDrvvNJJp59ERM+ciUHXn2dp/a9NqfPiv+zJZ0pKilWLp44g/eefx2Ty2tHo8r+cJIlgeNdTiLrf49IrRTrdm/ih0/+hSNdbR7uMZDGfbygMtJ4vp2EflWMtM5kVGHlKXiQqVNA3LZ4Yut6jnS2jI5tx+tLcfylHRPkyoUCweTKOt53/nWcNmkGCIESAlupur547L0b925dtPf/HuC7D99F5bvW8KZvfmRU2nHcBOD36x+npKCIuvJKQgWFLF19VlFXJHx7XNqrFW4kiJqiUt57wXWsnD4fbTQRdRxR8eOFXDNaKtRUQ0czP3zyL2w9uh+ZktlTf0MO5QDjM9D2W166MrAqIHIvDfRkz/XmTFkE8lsCxADpSTsLbm8+xEv7t+LIUTIGeqIYHRMc59rL5ymoC40V0+fznvOuo6awDJRCKiXitrW8Oxp+17I7bigtKixianU9RcEQv375keNqA4wCAXjfdz/HT2/7LI09XVy0bJXWFO6+KGpbNzpCBRXg1wyuW3EeVy87l6DpP+4GZ0HeWHSjW8WJh5SIq4hZCf748uM8vv0VEtLpnzQLkb3sOq/Fb8hH+d+pPO9Sdods0UDlJMu2D/QnFCkcUgOkSVMKIehORHlky4t0R/sGafgwYTSY0BhInApF0PRx1dI1XLvsXHzCcFUBpfwRx7quKdx12ZmzF+hHe7v43ns+wwd+9K/HXedxEYD3/+I/mVBeQ+0/X8yR7et5cv1LM/oSsfdaSk5UgNAEK2bM4/Zzr6K6qHToAkeDo5/K1iEgZeBSwMaDu/jtukfo8ljA8yNkzvOBhjEf50/vEObJn0ciUIOWr7JQPrdcb/UpFSMV47G/SJz64hpSpVS8tGcru5sODVD5GwMUUFVcxu3nXMmyKbPTtN1Ssq4nFv2n9Tu3zTyy81Vm/fPVTK2ewCd+f3w3Dx8zAXj1wC7WLlxObVkFPr+PlWdcFOoM97495lhnKdCQiprCUt699loWTpgxvO2vYYTwBo6bUIz3bSSFojca5g8vPcb25oOu6J+GAdouIB3WSwyATHkry7E7DCREJFvmLsg8Vkg1wKh6yslr5hN53oj+n0opDne28vyujViOPe5cfEcTNASLJs3kXedeTWVhSUrgEnHHXtUZ7Xvb6rOuCAVCQSaWV3POwuVsbT5wHHUdI3zpnu9z4wfezIaDe/j0VTeLo72dZ0WcxE0OqkABPl3n6qVruHTRmfgM85gb6IWM5fj4Jn8sTxqOxrJUSrH5yF4e2v4ycWSaC+atLK/enrM3P9jZCqHyG/vygqfM1F/aeccrNnjrzag0g4HK/ZFnxyJmJXh652t0hHtO+SAhg4HCDY5zxZKzuXrJ2e61aULgCEJhx7rxcHfr6k9f9y7x/N7NXPWuS/nKn354zHUdEwF4cMuLhPwBZp9xHhLJ/z7055qeWPTdCelMS0V3WTRxBretuZLKwlJPzjGg2gM5Ap0kLn/8uwGCqBXnwa0vcrCnDaUNgPy5leWo5Fk5Bv7Rr5isB/1UhYwF0hsYNLuMlE6RUgeS6QeoNy/tyaOigEIK2Ny4j51NBz2XjpxceW5YdDMXhkG8BILq4jLeec5VLKif5kZtFoKEcqb1RMPv+u5ff1WNEiw55zIKAyFePrD5WJp/bATgun9/P9esPo/mSB+nT5tvdPT1XhNzrAulUq7Djz/E28++gsWTZ+VY/cfAgWMA5BhPseT6x8NM/kue3vP+Uyj2th7hke3r3agx0mP5zwv5X46k/3lHsN8OQWqfIv+Sz7UbZun7eY2QIr9OILw/+kNLXyfP7XydhGMlqxqDmR6JTz/HQPSHGRRG0zROmzKHt62+jGJ/yPWUlsqIJhIXtvb1XLFm+kL9QFcr37jlI7z9fz8z0lYAx0AA/vz6UyyZPo+P/fC/6f7h4+xtaZwdtuLvsFFl4F77fMH8FVy97Jwsq39/TjFOwXud1XFA/13ezAgkZISY3UPU6iJqdRO1e4gkuolZfUQSfTy9fT17Gg7gWDYKkfnz7p17twMHMqAla85WIbJRMwsG2h4EECKbfCtQQqFE0oyQqkNliM+gc61U2vO4fxeSuk0Odikgblk8v+t1OsI9mf4N2OjBqh+kdVnBT0/WinX7H/T5uWbZuayZtRgdd3naSlb02ol37Gw5NKN71yYWfOotTKqo5X8e/M2IaxlxPIDrrlzLjXfeyc7WJs747FuDe1oab0o49mluDGnF5Ipa3nnuVUworcrtzpjDgLarERWSEVyPB7Kk89S5dAW9iSZ2tD1CzOpCKYlIen0pJdE0E6k0WqMvsnxaB322RkQa9EY0+voUkRgkEgJHJhdoUj1Io2Za18/st2eu88s1JOYz7w8AKfugBy+F517AXNwVSYzO8ObcLcPsakXeH55mCRDJS0alVGw/epA9zQ3UllSkx3Wkcz+s0GwnGPlz4xekxm9SRQ3vWHMFrzXs4khXOwpETDrLO6N9N6y94Pqvv9Z8KDa9egLfe/SuEdc5IgLwubu/xx9efIRHt77Ky5/4ERd++yOnha3E9Y5SQaUUft3g2uXncubMxejDjUozijCi6TrRdwkoUEjaIns50r0By4niCtRaOoEQGlIpSksPsXpRHKmBFBrxhEY4LOiLQm9Eo71Xp6NXozOs0xMRxBMKKSHF7CHFkF0DnOtMk2MgyDdYeTl/nt8qFSy8v0qXwZmU3q8Gw//+j1MNHqRJrb1dvLJ/O2fMWITP0JLZRh9ZT/ROw0D1GZrOuXOWceXis/nZc/eRkA6OIwvC8fiNDe2tD3d957FX6t53IdNrJ/KpZ//Cu9ZcO+w6R0QAzl+4kg2HdtLcs41bf/OvRb2J2M0WckZq8OfXT+GmVRe54Zw9CySPw9iQMCrcfCQwxgRBobBljJbwTmwZBWRyXCSpSzzcNFEw+igIKVdBEw4EJLLQbaJEYElB3BKEoxqdvdDWqdHSKWjp1umK6MQsgUwG3MwaR480kH6uSMYEHKjl2TYc94lIf8vV7VIhxdNqwEDbg552ea4hyNga+2koKn1Rccy2eGnvVt5+doSKguKBGj4sON7Q8ydinQoEZQXF3HLGxTyzYwPbWw656pDjzOmOR95y5uffsT2mOeEJZdXcfvY1jOS84LDZ9Lef/TPnfeFdPLN1A29ZdpZoam9bFbUTV0qBDwEFvgA3nnER8yfMSBr+PHrgMeDVsAZ1JCOfO8n9LHOjj/wpw14KIlYHndGUBTsVtDOFfS5SRexuLCfmGrekQjkqKRoqdEPhMyWFAUlFocPEygTzJydYvTDOFWfEuf6cGG86K8Z5i+PMqbcoCThoSrrlQBYlyFIIvJK6ymcDy1HG85kV8hg6Id21QcYo50fqL0VQ8uj4SsCWpgMc7mzxmC2Obf6OV8wfMrfKO6AjrEOhCcFpU2Zzw6rzCfn8biRo8EekfXVLuHPpl6++nSd3bWDKBy7j7teGf9HosAnAu89+E+fMXwE+k3X7tpb2RCO3Wo4zSSWNOcumzuHqZee6jRt9W39+GEk1J1qcy9KB3Unsjh8hZneRa21LBQt1pEU00Zm0DSRfpwJ3prikAimTRAEwdAj4FMUFivpKh/lTLNYsinH1GVHevDrCRafFmD/Joiwk0cATP0BkPnLY2PCHKtsoOFLI0v0V2eEI0v3NbCmkvQeF4GhXK5sP7XZvNRaje5vwqMJAPhwjKSI5GAX+INetOJ9F9TPSxp2EtKd1R8M3/WbdI0VhJMumz+X6084bdtnDIgD/9/wDFN+2ivUHdnDDqnNFZ6xvVUzaFyolDZSiJBjiLasuZHplPTDGkzEKQTZGHfK0KfeePqksOiMHkdICRNoFNm3MV2A7CeJOOIP4yalPStXewtOMxc0v0ofrdF0R8CnKix1m1NucOT/B1aujXH9OhIuWxZkzwaIw4Lh1e3cVBu5czu+BlHmRzcH7NXrwYlS/Lznf0+W5Rr9wNMr6fVuJW4k3tFNQ1nkKIZhVM5nrl59HgeFDAdJRZiQev6y5u3PZpy68WTy7fQOzPnQFv1z34LDKHxYBCPj8nLNwBY6hseHArpI+mXiLrVGrBGhCsGrmQi5dnPL4G2NjTB5kzw4lPor1D7esQQhQ6pRbwgnTFWtwuXs6i1dJECRkBEcl0qwwb6l5m5S9V5Zqtq650kFpgWR6rcVZC2K86ewobz47xuo5cWpLbAyh+ndTef7y1uVtmcjT0JRqowamASq75SLPuyw7QJYOo7ClZHPD3vR24BsVck9JBkwfl512Fksmz3R3XYXCUs6k7njk+vs3PFPQGY+weNpcJpTXDKv8IQnA/z79Z952x5W8tH0Tb199mejo6loVS1gXKJSBUpQGCrhx1UVMLKs+9l4mYcC1MpzgFJ4tsOGWO3SDji1nfxVI0ZdopS/R4k6m9xKONDVQJJw+VPpqbNVv8pOFZz5z7XOeIUiLy8lkmgC/oSgvlMyZYHPhsjg3nBvj0hVxZtTY+DSZZcEfHPKw6X6qerbNIO93b8qsNJ7OZTVFZD0+2NFMQ2dLMstJlgI5jnU2QpheXc/1p19AUSAECKRSZtRKXNrW077kkxe9hed2vcYnfvHf/O6VoW0BQxKAjXu3c8WN7yXs2Ly2Z1tRXyRyvW3bdUopNAUrp8zlvLnLXX/lY4W0l9mx5x9sAZxoATHfWe+u2GESjnuUNaPXZtrsKJu400c/1pidLM/vjAExN4FHk8ioDBI0oSgIKCZU2qya5xoOr1gZZ1adhd9UIMmIEVmSQC4m5xCCNOIOMOJ5pqifEiI8leaOQU717eEedjQeGFmMgDFUF07UOvMbPi5ddCZLJsxMh1OzlD2514pd9/TezaGWSA+z66fywvYNQ5Y1JAHY2bCPl3Zs5BNXv5W23q7FUTtxvkzG9i8pKOC608+jrqTy+Hp0vNR7HFD/wcCWcbpih5DKjW/v9QoElyA4MoYtY1n5Uq7CaRhkhfWjER7PvCzcTD5wjbcKU1NUljgsn5vgunNiXL4yytQqC0PkIHfKUJGWwnPkdK8xY6gG5n4fiGZk2RMyTUl9xhJxth7eS8Kxhm8HyHNScnyvnvwwpaKWa5edQ4HpBwGOEL6IY13W3Nc5/9vv/BTP7nqNps7WIcsZlADc8r3/x8y6ybR1tvLclg3BsB2/xkZNVCg0YMWM+VywcNXxcf8cyJwuO9Uhs7QSTpieeKN770GuyJz8asmYSyDSonT2suwvnQ+8dEU+ZMujbGeYu8LQFeWFDstmJLj2rBjnLIpTFJSZjN4Tf1lmgAGsdsOZwty29W9Y/+eeF7aQ7Gg+SG8snCfx8GBAU8c4B7/p4+JFZyQPCrnEPiGdaT3RyJV3PfeQ/0jTfmrKqrjzt98etJxBCUBHbxdPbXuZ/3v/l2jubpsdtRKXSJRPKEWhGeDaZWuZUFY9qgx4POhyKTg+63LGkha22olYnUm65nGi8WCALaMopEd4HwAGEKMzhrd8+oJHD8hJ4w3Cq5TC0KC6VHL2wgTnLIxR4JNZXHcQzOz/c7DhyyFSCtydjOEOebI7h1oaae7uyDwcOtspDd6DY9Oq6rlq6RqCvgAAUqpANB6/vKWzbar6w04ef/15WnrbBy1vQALwg3X3Mrt+GgcaD/LrFx729cajlyaUM1MhEArm107hvLnL3RtNhgujYFUfa8i9fPN4IOUL0BNrwrKTV133s3i5dVpOtL/BL7dtIpU3P+tMIXPeUtJZMjpB3u4J1+ko6Jcsn2Wxak4Cv9FfavHsQWbUDC87zRJQcrB9qOPNefJmpsUrwijaejo50tHcb29iIDgVuf1AEDD9XLJ4NTOq6t15V4qEY8/riYYvuPQr7ze2Hd7N0snz+epDA98oNCABuO/Fp3hm63r4wxZautonRBOJKyUqgAYBv5/LTjuLyRUjjPB7MhB7hDM+mhKIQiGVTU/8KFI5/cXmJMJI5WAl9X+Vzuktx/NdqYwqkcdQmEIElSoljRkqB0P6Gypz1YSQT3LGPItFU210zX0hBiYx6bb3Lz7XnjCAxJCqO49cnm0ozGw59Fpx9rc24kgne9ROAUw/lpWmPP8EMLtmMhfOX4kpNHctCVUQdRJXNPa1V9J9lLvX/40XtwxsDByQANz/0W/w+v5dXPftT2g90cjquG0vUEoJFEyvqefSJasJGL5j6MIJhgFG+UR5K1pOlN54E5kbdPrXK5WNo6ys1uWFrEXtKctzglF43mZnETlidq6FLcmZc87pF4UkZy2IManSSdsU+7WxX1Sggdqcp+2eJCK38am33ohGOUNj2Tb7m4/0v0B0PMj6Q0i8x0+jBCF/gMuXnEVdYTlCCZQQIoazvDvWt+KWa94jNjfs5p47vzlgCXkJwLt/8mWu+p+PwcFGDrY2FUec+KWOkiVKKgwEa+csZ3bt5DHV10ej7MFKOFGuo3EnTMTqyF7ESaU3ZQtwlJXcIRiiTUncTF8BnscQ55XK3TwZzi6yMC2ZKk/8g9ThJPe7orrU4ewFcUpCOXX2M9gOaKDIgWxikddbNksSEANOpqMkDZ3NJCzLk3WcRH0UA1h0RnHpaUKweOJMVs9ajK5roAkcqSrC8dhle482hHpbG7j5f/+FL/zlx/nz53v47OZX2XhwFx/54L/QGe6dF5POaqWhgaIyWMTFC1ZRmLzCaDA4nknIZ4AbaXknUgrMv+QUUasTywlnGqS8y9/lypaMI6XjkZ4zwnQuY1Up3M9hwP3EbI9Ir0Tqpp9s1MhV4725PaWgazB7os2yGRamnicDkDlf6FERRjQBYuD0WbaHZMOTREEJwdFwJ73xiCfJcZD3PBmPlxnlaFajKJ24JZcWFHHZaWdRUlgECKRSRiweP6e9p3P6127/PK/s28JLezblLaEfAfjhc39lzaLlNDTuZ8Pebb7eaPgCSzoTECIZomg2p02Zkw71NTiXHV0YdYQexQLzLTmlFGGrLS3e51+YClvGUUhSV6QPVF52bTk6fJoIeJAv19I+CI6RTp6mGklDofvp8ylWzIwzscyh36yntxHwVJBDBIYc62y7SF6NKbcs4d6e09bTTWe4N4dpHCOW5cmm8khJx1DM6Cy3PIUYms6ZMxcxv26aOw0SEo4zrS8eP+fhba8auxv2sXTqPH75wt/65e1HAJ7a+AKb9u2Eu7fR3tNZG43FL5KO8impCJl+Llq8iipPjP9TwNYyMIyxnCiR9Flt+Q2Aye9KKRzlEoD027R0nvwyaDvziP8q+9N96dW585OXbBODyn6moLzY4fRZFiFfDnVRudxN9Hs/IIjc7wPYEvJUlsraE+6lrbfTJVjpf6O/MkdS4pjhxQBrob60ivPnLcMvdACkEKGotC9q7ukoo6+NdTtfY9OBXf3yZRGAB7Y8z7++7YNsPbKfW77/WdETjy63pDNfKSmQiinltZwzdzmmYZIlTqpTlxAcCw0YKk9q+TsqQTjRhkqewU2f//eAQmJLC+VZsiqroPy1pcRSlRtcM0sS8CBTGrk8SbKa42W72S1MkQshFHMmJZhZ5yC0PEk9dWTZGPtbJHPam1OIN0JI3sSp9wqkImIl3ENBymsjf+ODl9z5TZO1c5dTV1LhKmGaEAnlLOuOhRfcft0dYmfTQb72tTv7lZFFAEpChXzpN98jfGQ3B5oaQhErfoEt3GCfBoIzpy9ketWEtKjojfk2LowuA8Eg1ti8b47TeptCJduJEbW6yBzwEVkp3P+lqyKI3DfJ9ANuCCiUh0tnvudcHZomzl5DQg6fzce1PSZ5r2pQEJIsmxmn0D8Q1c9p8EAGBu+j5NZmFv3J2+9UG7NHKe7YtPR2ItU4X4c5MCQjGcL2kL0lKJhXN43l0+ahGToIsKVTE4lGzttxZJ/Z1LCbf3rf57jtJ1/OKiOLAHz1nl+wcd9O7v7ED2nv6ZkYSyRWK6V0gJJgiPMXrKDQHzyGrp4YGHC4RmrEGWH6fDe9AlgySsKJpFuWhdjJVEpJpLIz4rpy33stAXn4uQcyhFilxOMsYpJbTh5CkFtoPxz2FCpgco3N1Jrsq7pV7pDlMOuByk498u489EvbzyYgsgbDkg5tfV04yhly7vpb5E+erDAkIxlB29ywYUWcv2AlBf4AoHCkNGOJ2Lldfd3VvL6PzQd2oGt6Vr40AXhgy7PctOYSdhzez11b12nhWGS5JZ3pCvcSiFl1k1g+bV7+YJ/jxH13OMM1WsEjBjd+uqszbkewZTxZL5nF5jGuSSSOsrPeZcrx5iGdR6UQT5HeJVDpVmWQVaTVA5G9Y5dHLE/HBsne7M/pl1tGMKBYPM0h5FeZIKSZBpPzNafOPOJ5rhqTLjCr5gF3HJWUdPb1YjtyyPntp+SMk7U7GmBoOmfMWMiksmqQoBTCknJunxVf8LZ/+bzY03qYn7zzM/zTRz+QzpPG5ssXnM0DrzyL1dFAY2drMOIkznFQhQCmcAuuK6vKU+2pBaM13RlcckXSDE9PvleKuNODVFZGX/eq48lClHKQ0smUl1KBBWnXWkHaJufx1RHpyL/py0WEhwSkd2mGEiM9LRKez0HwSAjB9DqbSVVuQNMsF+D0uOT5kRQVMra+QSrJeiU8//cvVynojvTh5LtBeaiijweOgZmMFblJqQFTKmpZOWUuWrImW1Aeta2z9rUeMduONvCOH3+Z0GmT0vnSBODfH/gFOw7vRT3URFe0tz5h2ysVrvhfGixkzdxlBM3x5/k34gEdZYqfpXOL7Ocxqwcpk0eAvUd7VUoSSeq+Huu1JgSGphHQdYKGQZFpUuIzKfP7qPD7qPT7qPL7qAr4qAr4qUw+L/eZFBsmhYZBUNfxaRq6SBlqM7cQpVm96o9U/ddzmtp4JAS3A6GAZN5EC1NTWcmHOWjJ9INkSBO/FFXLMQzmiB7hWGRkcQFGA45hLWVJdaPZlOTgF/lDnDtnKUW+AJD0CbCtszojvZVs2c+uxv1Mr8kQgPRJnv93xTv46p9+xNt/8FnRF48sSeBMS0aWZmbNRBZPmoUmRhbrP/eig8E70F9iHHSY0rJc/5RD5j1e6CdHJh+n9ouFAKWI2d040so8cxOhlIPCQeBgiATFPhNNCUxNYOoahtDQNYGO6+klRKZHmWpzVYXMd6lcDzlLKRLSIe5IElJhKYmUSaNbqowcUVslfYUHnTcFKMm0mgQVhSZHu1PeQdntyksQhoszyS7nPxWRlFCS46wUxB0LqeSAc3OiYDhrbyyamBonTdNYOmUukypr6T66HyURlrTn9cXC89/16S8evW/jc+rDX7o9nU8D+MvmZ/nQr79G75FdHGxt8kdt6wwJRQAGGiumzKWmuGLEjRqJB1XuoA0XgfO71owxZK3xHM6UboMk7vQilYVSNkLZ6CTQ6UOnDUMdwVAHCWot1PoNagJ+yv0+igyDkK7j1zRMTUMXGhoZCSFbgXfr1zwcXhMCQwj8uk6RYVDu81MbDDAhFKQ+GKTC7yNkGBhCZNQJj52gXwc9v9NRhZLpSosk02sd96DQEGrDMa96D2Hrx3FT9SlFIkUATrJKn28I+o3mWLrQA5PKq1mSYtjCvUosGo+esbvxoNHSuIeP3PHv/HHzOiBJAGbUTWbz/l1gttEV6auIO/ZymYz5V2j6OX36fAKmb0h98oRaVE/yRGfH/E+KyUmLvi1jJJwebNmOUJ0gDyPkQTR1AJ0GDFowRA+6iCFIIJLBM7NDhObWR97n2e3JSMvC81xDwxQaBbpBhd9HfShAbTBAic/Ap2kevBJpm0M/WqC8n67V0dQVMyfYBHI1w2wa1b/huUw99y8XvNt7Hkkq1Q6lFJZlI0+WRX+Iake9VUP0s9AfYtWMBQQNEwAJZtyyzuiK9pXiD7K1YS/XL1oNJAnA7V+/kz1NDXz4xv+iNxqZlbDtWUgFEiaUVLJw8kx0TcvLbbPgeCjbyduNOSZwdX93D99RUeJ2F73xBlr6XqOh8wkOtv+NcOw1DHEEgzaE6gIVBpUAZJrrZnh6PtFZpGvKtvL3S5gH8pXn3uFgCEGhaVDtD1IbCFJsmBgpoiGys+Q59p/mxgqoLbepLHKNb2oYOr2nWwPPeb/dijzl5gyDVAp5om0AZGwU+Wje2FXavybv+tE1jaWTZ1NdUJKikcJScl5fIj7ls2/5CPtaDnPt/3wUAO31I3t4y9qrOdx4iN1HDhixWGyZ48gKpUDXBAunzBx2iOHj69TYVzESGHI7Sdn0xA/S3PsyDZ2Psb/jfva138uhjodp7nmJrugebLsLgXvnX1KITpsM00ZD7xHcrFXk5eHpSpOSdPZyy3DrzHNXqhD9lNLMeQD3VsKgplHt91MXCFBsuqpBNrdWea8oT7WkICiZXOWgafmMIuRB5txycovOM+75CEbqtwChCTRdHJ9oPUIMzr31aTB6dmIgU7sQgmlVE5hTN8Xl8K5NqCZqx5e8dnCntq+lgZvPfxMA2i3f/BTrd22Cvg46oj0FMWmfLlF+NEHA52PljAUUBULDGpvROsI7FrRgpPv/+e1XmacJJ0xD1xMc6nyE5t719MT2YznduLf3aSjl4MhERlzzIKdK/Z8lZ3ttCTnysspmhFmSWFqHJ6Nni+RV4spTRlZN2UtXAwoMg9pgkKpAgIDuOosoRWo/OceHIEO0dF0xpcYiYKhM7wYU5VPPc9uTZ7xz8+chHpk+C0zDPL4LaUeIwePN6dg7ogJBaaiIpVPnuvE6BdhKBWJWYkVbV3tANe/lry88yg+e/BPax656O3uPHkY9epTeWLTOUs4CJYQQAsoKilg8eRaGpntE0EEaMQo62FhR0uMP79UflHTP8Au07LP2yd0S18PPE1jTm1d5EdnDzsAN9ZzOJVKqef5W5OOw6XYM1HqPBOIVHQWU+kxqAwGKDAPNg/hZw+c1SAhBdalDSdC9bSgXwbO6B4MgTPYYDNjP3DYkqZNfN5O7VCdJlBw3gWzddvgMk+VT51EULEg9123LXtwb6aukvJJ9TYeor6pHe/d3v8C+5iPc8ZP/EOFYbI4lZT1KIaRiamkNM6omeJBnvHTyBECWL3zK5TXTf00Y6FoAgZ7UhzNHeXMjXOQbNddxJxerVIbD4mV6ol/egctOUQKVk0DlpPJKEW4elTSo+ZNqQYXPxNSEdyiyi0p+FgYVNSVyQHXdmyUjzSf/z4c4ucQsiy6ofmmFgpDpT0oA+dfomJOFceVR6F4mOrt2MhNKq9IbNJayp0ai4amfe/NHaWg5wrZ929C+cfsn6WjYw97mBiNqJRY7Sha5BWgsmDCdisLSk92bAeHEDHl+MU8IDV3zZ8nf/fesvcs+X9G5aJFExDwleEvJ9rv3YotXWRbpRyInfV4pKyuNwtAEZQGTqqAfv65nIX+KUKTcm01TUV/loOsegT53z9DTLu9eh+hHXfI0TuQ+yx4VoQlKQoUYOX7uA+XIBydiLZ2IOwy9J05rSyqYXTsp7RXoSFkWTyQWvLZ/h364+QgXLj0L7bV926Glkc5IXyhhW4uVUoYCgqbJ4imzCOS57Xe80LqxHM6h+iiEhi7MdEPSy9x7CF+kNO5UiTlGo4G4WtazDLqmFYNc5t0vj4vmaVkg38Lrz5K9vQNAExrFPpOqgJ+grnuYsEreMqxACDQdaittAmau1JEsOrWNpzK9yF+xl8rkdD9XIsjQS4SmUVFShjFIhOqh5vNEyLYnOuR9oT/IwvrpmEnCKFH+uLIXdfR1+ziynV88dg/avsZD7HzTZ4gkYpUJ5IykEEppqIi59dPybv+dSEVgQKo5xtR0oNIz6Kxh6CFcW7rI+cuk9hr/sstVaW6axut8p12UIMcPN13KcHfdvO3IGzk3nxUuTbwEBYZOpd+HX9M8ak4ye9L4UVYoKfLLFMb3Kz5H6ch5m93avFrLIKYDQ2hUF5f3MwJ6R+3vRXlNRYwWgKHrLJg0gwJf0F1fQmi2lHP74tESXniZnY0H0Bo7mrlr8VRiifgkKWVdSuOcUFbFlKq6LP51MmBAqnnSdK4U8un4tGLXBuBtk0gpAwKSPnzZMFB/yHBJr+icDzn7tWcITMmHAYOVK/qnCSaJQCCpDrj0QaWrD/okpQUpO4DoVxRKZYhGFkvPJhYpJWFAyNPVgGZSW1ye7aqeadrAyD9SJjJuDH1Dg8KV4GZWT6S2uCyNR7aUkyJ2vPYnzxykoaMZ7WBHC1sP79ViTmKmo1RxOmPNJMoLStILc8RdP4UGaySQkTwFpl5IVkiF9GpLibAib958Zaqs9Ck92lNerk1BqP5loPoNe/pnkjANSTa9eJmmQe6/kGFQGfDh0zU3AIkCJRVKuleLVRZLN1ZkSjTPaUOmd97bkbKfibxom3nWb1UpKAqEqCuuyGYWw+EP48pwNzZQU1zOlOp6hKahEFhKVsRte+q6PTvE0a42NNnVSnu4y0xIZ7YjlB8hMHSdWXWTCZr+Y5KdcrmAFwYS6U+EgWS0ILV4DT2EEPoAiCWypYNjqCW9z6xyUSKjPmSee9WC/mOpslK57RsUvNgrkkRACAoMgwqfz72IwlO6rkN5iSKfHc6VFjIqReaZ90t/JSGHCnn6l93O8pJSqovLh4Xzx7XOTkGCURQIMatqEnqSUSlFQcJxZh9sO6p3tbWgGRNn0ZeIBWwlp+NeI0/I8DGzaiKGbqSjvowUBpQuBxjE8XQn4HDB1AswdH96+QqRzdE0oZN/JAZ+loum3rf9c3lUheRvL69UOUSkX97Ut1Qx/SrwcFwPESg2fZT5fOiaQGikdz2LCxz3eLA3vJfw9DfXlJHRD/KPRz9xP7eBCg3FxJIKygqK8pSRp9QRMqZxA8cUe8B1kJpVPQl/0kCqBEZCOnO6on1+pI22evocorFYiSWdSUopoVAUB0JMKk9e+nkMFQ+qd72BwNBCGFrytox+68qVAFR/JpaVJvPpDe0l+q995fmeC8qDdPl0gDyZsmMHJklGVlqVigyeaaMn8Eipz0eRaWZEfqUo9El8mtcf36MLDKT7gKeSnER5CFJutzUlmF5eR8gXOC6185RgQCPun7udP626ngJ/0DXZKKXZ0p4aj8cKl646F+2Z154jlkhUOVJWpeaqqriEmpKKwY0xYwynwHSga358eqHHkO0RsIVAYLgvRtSZ/Bibq0cPlsu7BZ8rCWSpFamgJJ5SUg5N3t2JbPOD2wIDQZlpYqKBdCsN+CQBU2Ux/YEhD7Lnyaj6BRvM7rDfMJgzYRo+wxx1EX1cSQU5zmX9YIC2akIwoaya8kBhOo10nPpYIlbZ3taCpu7aSMJK1EslS1JS24SSqrRIdbKGYBwN/YCgCQO/UU7KG9ALAoGuDXaE2vt8sN4O9G5gc1mWEqDo94fKKAv9iUD/2tMpkgWk5BW/JijW9bQ90u9TBAN4TgUOJrZk92XANyK5Kr1lpAQLAeWFxcybOL1fsMvRgFNCKkhBnramhqy8oJjawjL3mQBbqfK4bdUc+uYDGB/6+X9occeeKJUKIdwdgEkV1a4BcLh1c2ogbC6MtN256YXQCJgVaMLAUQkPk3TdcDThz5drBDV68nlFcY+60C9HWl9I2hSUV9hX3lfp8rMDf+cEH0lz5VT4shT+CRAaxX6TqJT0OTamCcGAhCzjpweB86hJA+r/echabhKBYEpVPVMr6/KOxYmA3J2O8QiFgRD1ldWIg65PjxQqZNnOxC/c/QNhNLQeNWzlTJRCGUgwDI2JFTXpyz/Gd9dGAHkW4Mg1qmwQaATMMjTNh2Mnst4IodCEKwEcywh6kc1buRJDlaZIXUSC0NGEiRBG8uyCDyFMNAw0oadDjSkkUllIaSNVAqUspHLc0GVSooST6pXLQkSSOyowdZ2ygI9YxEGg8OsyfZgpmSn709POLPQZjEAoTxZIcjuFLgSLJs6gorD0pKmMJws7RoKZftPHxKpadF1HOjZKKr9j25M37N+uG119fT7HlvXKPRVKQDOZWFaNrmmDV5IMZskIGnJSYQxWiAB8ejGmXohl9/WrRtf8CGGgSMarH4FOOZjNrL/xLPVQuoiuF2HqxQTMSoJGNQGzEr9Rhl8vxdALMbQguvAhhHt4RqoEtoxiywgJp5u43Unc6iRudxC3OkjYnViyF0fFXcJApn6hIKjpFGg6YWVh6jJrbQwO+SQc7yuV/c5r5AAK/AFOn75gXAarHWsYCc6ZusHk8hr8monlOCildFvKiZ3RXp8RjkcLHEfWotAEigKfn9rSyqQYO0g1p5J+NIrgJYoKMLUQQbOCaKIFcLKMgZoWQNf8KJkYxKAkQKiUo1ym5IHG18ta01xTYOgBgmYNhb7JlARmUxSYQZF/Mn6jHFMrSEojDEkIXcOhgyNjWE4vMbuVcPwwffGDhBMNhK2jxKx2LLsHR0aRykagKDY1unWBPygQupY5E6HANT/n2ykZqG8DD1V6fBVMKqtm6ZS5aGOg/7+RQAhBfWklAdNHnxVDCYQtVF3MsYJG1E4U20pWpiLFFgULKC8sPak7AOMZcteoJkxCZg2dYnf67H86QqvwoWt+bNmXJ2e2+JtrQszUNsA8pLZok0lKg/OZWXkzJYFZBPQKNM3wFk/a0DeYtU+kitYxtQJMrYCQr5by4CIkDpbTQ9Rqoie2l+7oTnpiu+iLNhCzOgkYDiVBjUBAIHQBDhmJZzhEQOX8yKW03mFBoAtYMW0ekytqMjYJbx//sXzTIICqknIK/AHawz0AwkFVxax4kZGQTrmDKk0xndLCYkoKCk9yk48PTpTlImUIC5rVaMJEqkTqKbhmwKQhMB+oYTR0IOTPkhUQCCoKTqOm4Ey0pGfiiLewsqryyH5JLi6E5qoRRhmlwXnYxRcQThymK7KVzsgWemJ70YwjhIxehPdE5AB9Uf2InksgUjdRqVQ3PUQg/VMTlAQKWDt/BYX+EG4EpEHUib9jSMUsLC8opsQfAqlQGihHldm2XWZYjqySikKF61RRWVjqDqq3kNwBPsGQF08G0TNPbEsFfqMUUw9iO32knGVcxNTQRDBtXc/fUE/vhmUnEEmunkmnaa4Uki4yq47h6uMDQFZ+lZYodC1IcWAWxYFZ1JdeSDjeQEvvJqp9DyLs3cnUyZ5760+r9TlGwORCTd8yJFKpMm7W3ngrcydM5YyZC11bVdKNcVCVdRjjMJJ7LDytPikwFO9Ia0vJVEX+EOWBouSwChQUWo6sMBzbqkXKYGrwKwtKCJiZGADHxE1GGfLWPlo2iDwLY7gLweVWAp9eQMCoJJpoBaWS5/zdgNymXoQbI9DGI2Nnd0OJZJ7snuaa+Lzf0gtAgaEFCJiV+dt8DOOUtbi80oZK7QQoPDHQMLVCSkPzCPlmUlvYiib3gMhEPvZCBqH7b/V5ub5Idq6fnVMpfOicP3c5k8pqBigrX6eGHoeR7vufTEFjKIzMfR8wfZQXFruHggQojZCFrNaklFVKKR+4t4pUFBQPGlnlDQd5Jn1EXECBpvkp9E9EE2Zyjao0YTH0Io8a4EWcjLKQ3u7zGvhIhvTwnK7r187kpy6C+LQijw/A8cFgJah+BgvvWQOB3wxlR/nJSZsqPMtImAXZ6k1aSvLEOJxQXMEF81bgN8zk69ENzZnd5JPL/GDA6e8PecfTBdMwKS8pRejuoSBHKF9CWtWaNES50t3bITRNo6ygGC29A3DyOz/+wdX1C/0TMPUiNJHaPnWJgCECGFownTYbydNPPeKrVzzw8vt84CKGJnzoInBsrR+1Ba6S26IG/ZyIVIYgZBG6FKFIqwWk02XbBFMEFQxD55z5S1k4cWaa0Iw2jmYVNw52u1wiN4x2ZC2dbLJh6gYVRaWIZNxEpZSplKrRLOlUK8113dI1jdKConRghX+g//AhYJQR9FUhhE7mHgBAaBhaMVl0PMna0uf307aAHHlX5R4Lygci6exjHpPr6ui5u7pkz9QNl8toOf3JCnKSOTnpBjxKEomkiE9StepnO5CKmpIy3rTyPEpPEUN1/nBsI8esYRPq9BLLZuC6plEaKkRPnu5VjtRsy6rUFJQrN64VpmFQWlCUsyhOPgUcVzDAPBhagEJfHQIdb8RfoQSmVoKGQbbRKwNertjvPL9XYsg6ECI8jFRLOvUMKgWOMbi1apoGWuqMcL50IudX/jHJJMiI/zqCNTOXsGrGohFfVHuyYLTsMscLmtAoCRZipELYS6VpjqzUpCZKUsTFpxkUBwrdI55pGD9ywLg4nDFAE4TQKfDXo2u+tNjuSsAaPqMEPa0GJMETLTfbFNa/kv4zkD0/SklQMq1XDzhKw+Eix+itmGq3V2XPm2MAW0Y67KG3Hd62aBq1ZRVcv/J8yguKGaSXowcnSf8fVaO7h7EU+UPoiJSNSkipSjTHkuWpM5embrjnqscA0UYDeU/2bsTgIAiaVQSMchTJy0CEQAgdQy/ANEq9SZOgPJ/Jv36BQQcbN1eNcFQciZWf6Wbtj4v+z/p1YwQG0DzPbGlndSe77IEKUsntvzwGT+mOialpXLxoFWvmLEUXqfj/Y0wExgPDGQCGbRjM6KIETD9GKoSdQNjSDmpYdiFKCYTAZxgEff4xGdbxiLyj0U/h+WdqIYoCk5LiuDtFQgg0zcRvuvaBNJKL1FHdfCf7UsQjTyNzCIQA121XRobfqVFf2El9HkUkEUPm9kik6hyC8Ih04ux+OIopxVXcvOpiKgpLPC/G35oaDchllvlmayjDYO4bAYR8fozUtW9CIJUMaYDpJlCYmo4/eaXw8S6R8Us7MzAay8cbZEMInSL/FHxa0kDl0ed9eim6FkrnyvrM2r7LyM95GaiHzafG2FFxLKc3f39GguzHPCBuRiklkXgUOVJLRG4b04TALcVvGFy99GxWTJ3vsRn8/UCuTJh+7mUGg9HW5GfIH8D0+TI7y0KENIQwUxZYU9MzFGIUG30qwrFJLIKgr5oC3wTXGKhEMrqORBN+fHoZKbY+sOtqZquwH/P3JhcZ64FSNgm76/h11uPELUdJelMEwLPTMXQFKv9P4aL74okzuOnMSygOhHIznhIwmiRrwBnOqaSfXUmAz/ShGwYIgXKDVpqaBDOV3NANDG3g21WGA28U+jxyrzA3vaEFKQnOcE8BkkSB5Pl8v1GFLvyZbTCPtJs9sSr9THlqSKkUuR4DUtlE7Zak7eHEzoD3oi/LtukM9yJl5kLU4XFs706A8mwHQkVRCW9fcwULJs4YH0bgY4DxwQwFpm5kLk9xRQBdk0JpaO4q1ITIf8/7mDXp1IWsK8BwEd1FBY0i/yT8RjlKSfcvabDyGaWYejmkbhNKLvT++nKOVkDqRw5HTRIPqWz6EoeRKu6RpsUJWXnK06aYFaejtzsp3eTbCshRDQZ6nYxJaGoaly0+g2uXryXwd3jmf3RBYXgk/PSubRaJVlkfx1jN2KQdvKATT2NFPpO7cDmezyihODAFL28XCHQRIGjWoQkzu/OeLcF0QZ4PvE/TlEFlPeyLH8aSfR7VYrD9wLGBSDxGV19vlp0iDR69vt/zfvuJCqEUC+qm8q41V1FXWtGf+49Do/LJgoGmOVez1DUNPcXgXQN08rqQ5GC6vhWnoJllnIiGKeTThEFJcAY+ww2smjbeoeHTKzG10iGIn5dTDr3QBYKo1Uok0TSs9KMN7ulHRU+0j85oOPNC5XD8XPC+Tu0UJKeyqqCY28+5ipXT5qMJrZ9NxhUU/s6IwAh9NFTuE5HC7uRbpYSWlrdSYts/4LggJQ4HzSpKAjMQKQ9A5b7ThI+AUYcmfGRzeo/45cV9lVt25mUGAQQJu5uu2E6UcobXzlF2CkJBa28X3YlI5jBUCrKWVZ7tQG96TRDw+bluxVquW34eQdOft639XIXHAAYt/WQQn4H6m+dxf9Or6v/QVftF+syldJxMQMl/wHGBofkpL5iL3ygBUiGyXOOY36jEp1cmUw7AJdOPBp7dDAIopIzRHtmIJcP90+eBAZEnn+PQEKBQSCVpaG8iHI+StdiGKsN7KjAZmPLcuafx3guuo7akcvC8JxtGSgRG6VxA/zKGSpCj5Wf8LZQmlEhjvHScpAX32OEfMkQKBAW+ekqC0/CGq1K4ocKCZn3yBJ8gdVquv9Cfsor356jZtxEqQNIV3Ulf4uBJEY0tx2Fv82HiCTc8usrQpjw0LqWHZsn/oBQLaqfwgQuuZ+HEmcdskB6tNTjoKI6W9DEaHrK5RZJrVnFTOFLieNaGEEJpQpEO83q8epVXuPsHIXClgLLQXAy9gCyUFQK/UU7QnJClIkBmshR5cCeLBmSmWaikHSDRQkvfehTWsTf6GBdk1Iqxt/0Itpd8qfR/5KUEaVdHVzqaWFbF+y+4nrVzlmNo+jGvxRNG/kY6VifIVpVXphRgSwdHOt622Jogs1oclIdCjNzqqgb4Ph7g5BAkQaGvntLgDEAjZWURuCHDQ/7J+PTyzNMsTM9MY7Y1N5e+u4+UUkgZp7n3JWJ22xj2qT8opWjv7WJ/W1PGnd+7CZFXCkhCsu3lgQLeteYqrl95ASFf4O/PwHcCwLJtbEd63S4cDVKnSAQJ6ZBwbCAPsRonlvZjhZO1nHTNT2XBQgJGOamtuZT+bWqFFPinJgOG5MrMA8FA9gL3eW9sP23h11EMzxg4WnCgtZEjna0M2vbcww3uVhSFwSC3nHUJt625KnnS7x9wvJDaVPGCZVtIxwGEexRFqoSmBAk0lEsAbGJW3E19ChLg4VqFT6xHmaDAX0dF4UL3ohBSd/q5A+w3qwj5JicPCpHD4bNtA0PXJLBlhCM9Tx6zFDBSzitwRcsth/fSFQkPLSh6pAGlFEHTxw0rzueOC29kckXNMbX5H5AElfM1ZSxOPotZCWzbTkvzQhN9GqbW7aZV2EkC4F2gI2vAyaUaqcU7FHqPlng5XDKiCR8VBQso8k9KOVukWoKGTtCcQMCsSb7LNe55ogJ5aUO/PXb3pVKK9vBmmntfGvaW4JAwyHApIByLsuHgLuLSpt92U7p5Im3pRymUlPh1g+uWncNHL76J2TWTT0UPlBHDmPYwV2v3flcQTsSwnDQBUIau92q6aXTjXsFKwrGJxGPHxAXcL+NjAk8UGRpJPQGjjKrCxZhaKAePFboWoNA3nYBRlXYYShv4BiowbXEVHvOBi0KW08ehrofoTRwaMVHOH8Fm8LSNna1sPbwPmarLS5tSsqiXOymFX9d509I13HnpW1kwYXoy2ykodo4QTnQPvcbiaCKG7STNtEqhS9GnaahO4V4aSsK26Yr2jZgAnMxpGxVuPuaSi0AIjZLgNMpCc0jdyadIOb8JfHoJRYFZBIwBwntDlpGwn4kmK52iK7qdQ10PYis3TsBoqz2p8OBSSTYd3sOhjhaUTHL/LFU/x2AJBE0f1684n09e8TYWT5p5XOG9xorlHMu6Otl3Z+SDzIlRRU8sjC3TUqGUSnVpGqLF9QVQ2JZNd18v8hRyBhqVhT1GkkuO+wWGVkBV4WkU+OpIXSOWwhYhNPx6OcWBWe6x4XROkUEozz5rhhaotN0gw3QVthOloetRWsOvAqm7B4+/n7kKSl8syrO7XqfXimX6I4Qb6DMt9qeaKin0B7jlzIv55JVvZ8mUOW4MweOAsUK5kxtgdQDI9Qfxvhowj0sEpJJ0RfqwpAQJaEJqPqNd8ymtTZPKQYLjOHRGejKi3CjBmCsG43TLqH+rBCGzmuqiFfiMkgxee7ilTy+nyD8Lv+E9ACO8RXgKFykRImvPTeGG2IommtnXfg+9iYOkJY7jnA2V/nS/HWhr5IU9W7BV9lHkrHqUQjkO5aFCbj/nSu687FYWTZzhhp9XJ/bimROqpI52v7KCwg43j/vhSIeOcA9OMlydkEhd0zo0TaoWIZUFIFG093UP6Q040kEc8+kdUmQeL+BGDSoLzqKmaCWmHsreLFcSFPj1ckoCcwiadQihJe19IoP0KakgCSk9T3jLSqZsj2xmT/sfidntyTcpqeP4wXJsntu1kf0dTS4SpwlRsvxkm5WUTC6r4sMXvYWPXHQTc2qnuK9PAuEeqxrzlnvCbGL968l9krBt2no6kTK5NhQJTdJiGJrRBCIuBEUKQVukh4RjEcSfLmhg8UIdcyfT5Q7gdzQqMESZg/ZtDEHXglQVLsZRMVr7XsORMbc1QiVdBQQ+vYwiv4kmAkQSR5AqkbM5KNLutl7jWWZMXWx0nChHuh4noJcxo+JGfHoRrmIxxF16DD0+R7vaeGDjOvqseLbOn7QFuIefBKdNnc0/r30TVy87h5qSCvrFQDiOdTRe4OS2vv8s5T5J2BYdPd3u3AA6Iu7TzWZDF1qLQISBSqVBW6SbqBWnJFg4QNGeZ6Oifx9/EccKJ09AUJh6EdWFKwBo63sd24lmxPnkyUxTK6LQNwNNBIlaDdhOrwdZPCcMktw3ae7pNy8Ju5t9HX9BYDCj4s1JIgBDoXjuJiMeouFIh2d2vMqr+7Yj04Yl1zColAIpCfr8XLTodN679lrWzF5KUSCUn+uPoQ3mmOb4DUCQciFmxemM9KQlNSFEn6HpLYbfMNt1TetBukak9r4eeqNhaosrxrRB4046PwngN0qoKVqJoQVp69tA3O7OGP2SoGsBQr6JmHoR0cRh4nYLUtnp9ekucuHRN7MMAqm3xBLN7Gm7GyEMpldci08vHNEkeMyVKBSNHa388YXH6Qj3gp6qMkkepKSupIJbVl/CW1dfyvz6afgM84SL/Mdc2xsI+VPz1R0N0x7pSy8NTRc9fp+v3fCZZpcutA6hJRP29dIZ7hlBBScWmU+W2D7qkMQov1FCVeFS/EYxLX2v0Rc7jFSuu2aqszomul6JGSggZpUTtY5gye6ko09GMRAZGSBTTVInEAhiVht72/+IVAmml19DwKgY2Vgmq7Jsm4c2rmPdrs04SoJM+iII93ap06cv5LazL+eyxaupL61MCjXHO2ujZ7sYUxhn0kPqdu+23k66o33p+daE1uo3zS4jaAb6dE1rRqKUUqI3Fqalp8PV3xj6ZroTjYxvJORPfTf1EKXBufiMMtr7NtMR2Y7l9LlCvkgHbEIXBQRNH6ZRTNxuJWY1J8OBy4zDh/BctpXlLSjQhCCWaGFf+z3E7Daml7+JkoB7UMk7skJkRy1OcZHUs72th/ndK4/Rabk+Bsp2QCkmV9dx7cpzuXHFhSyZPItCf9C18o/KoI0fpIJBGNEIkP9EMTOFoqmrnXAsBoCGUAY0+nWjzygMBKOaoR0hgQT0SCLGkY4WpJSIU/Wa8HFGhfuBd4fMtZahCZNCXz2+kiIK/PV0hLfSFz+MreKeTBJN6PhEKYavAL9RRdxuI2a1YstelEreyiPSikFSLVdZVcetNg51Pkhf/BAzKm+gpnAVhghkLPk5q9LrTNIXj/Cblx5hQ/M+HJ8GCZvyYCHnzVvOjWdexOo5S6grqUTX+ofxeiPBaPTsRI2OlIojna3E7QQAAhxTMw6XhYriRnVJmW00iQahsFFKT9g2De1NWI6DfqoSgDFAfqXUGDt6KNyYgSWUh+ZT4KujJ3aAzsh2euNHkDLhuXEIdOFH032YWhFBo4aE7CZhd5BwunBkNKlGJJeYgMwhIzcAlOOEaet7lbjdSXfpHiYWX0CRfzICLWt3QKTMC0rhOA5PbFnP79c9Sk8kTHEgxBlz53Hdaeeydu4yplbV4zd9w97bH/sx/fuBwXZ1Eo7FoY5mrNSaEMLSDP3Q1OoJtvGJq9/hPPO11w/ririj8EslaWhrImEnCJi+YW0XnTIwQsnAu0DFMeQfOSS3aIRJ0KzCZ5RQ5J9ET+wg3dE9RBJN2DKaFseFEAhMdL0UUy8moNdgyT4sp4uE04nldOOoGCjHxf+UOK5AoINS9Mb2s7ftbjoim5lQfD7VhasIGlWue27K0ChAKsXOpoP84LE/0dvbxyWzVnD5aatZO2cZ06snUOgPpsdsuDAU8o8He88pYnkYFEcj8RgNbU1pD18NIoamNXz3nZ+RxpJbTmfm6WsPC0QPimKJoqGrhZ5ohOJgYd6Cx8PEHBOM9LIPb/pRvNx0qIWfGnND+NF9tfiNckqDMwgnmuiJHaAvfpi43eWK/EnrmxA6uhZ0byDSSggadTgqhq3C2LIP24lgyzC2E0FKC/cqM4FSNvFEO23yVfpiBzjS/RS1haupKVpFga8WIdyLYqJWnHV7NzO7fiq3nn05y6bNZVJFDYX+kBu6Sw2+CI9pvEa1tGODUwH5syAPxeqJ9tHY2ZoeTwOt068bR0K3r8ZYcf51ROO9zbrQWoGJSgiaejtp7e1kYnn1gHUMuz3JPe1/SHoexB9KkkhOYgqhdM2PoVfhN8soCkwlYXcSsVoIxxuJWi0k7G5sGYfkroAmDDRhYlCAj3IUDlLZSGXhyGhSRUiglIUjY0hlIYTCkTadkR30xg7THNnAxJK11BaegakVYegGa+cu5/LFZ1FRWELA9Kf9EE6mrj9cNWK01Y1xa2YS2eqAUoqm7naaw13p95qhN/l9/raF0xdg7OvuYkZpqNOn6wejjnaaQorOcB9Hulo5bfLs4x60f+h4eWCIW11Vv9fK5fIY+PQifHohIV8tZcE5WE4fcbuTmN1JzGonbncnOb2L2Eo5KCXQ0FHCh88IQWp3R8mkzVAk/0xMvRBTLyToq6bIPwVdmAjApxvMrJ6YPrwzetb9EwOjfhpyNIsbZWrinRmpFPvbjrrBWlxnU2UY+oFgMNSz/pVnMToObeW02nMjhmHsFnZCKiX0vniUPc2HsZXEFCMzBOZuIY0ajCXJHUfkPLNpl6HiaY8/zztN+NB1XxpZpbKRMoEj4zgqhiWj2I5LCOwkl5cyQeoWY03ogI6u+TH1ILoWwNCCmHohhhZwy9cM11aQqncYc3uih/KUYDBDDcoY9sGRDnuaG9KRvjQlbJ8wdpcUFMdIxDG0wlIqCsssnziyQ1PEpFIFCctiZ+MB4lYcX6BgRPrdmImDww33xfjQHY8X+vn353mXIRY6htBB96P0ItxjXSrJ4d3LSVXqWdIpKOPcqyGElv4k693I9fpTAR9HC4a91k7woHjbFbFi7Go9jI1rABSaiPp0fWd9SZVdUFuHNqmogvl106Vf6HsNJXpQ4CjF7uYGuqPhpKiX3xA4HuGYrLbDmaDjJGxD3WRzfOOp0v9SI+AitIGu+ZLcPYSpFWBqhRhaAaYWwtBC6Elu78Yk9HgnkX/ejwWOqW+DnH0f1TzHASeV0QzST++bjr4eDrQcQSr3vkVD0eHXjX3Lps5Q9SUVaPWllXzxdy/hN8wGTdBIEuEPdTZxpKMZleYYA1cyEjgRhGNMJuY4qfhQe+NDtXmg2odqVcYbMPtP9Xs2djDS0lVKZB6ncfdPFAw6bkNuoboepA0dzRzpaE2fAjSEdiRkBI5+7OK3MbG8Fm163RTECz+nwB9sM9H2iKSk2N7Txa6jBzPeYaPU8jeCeH4yYKBxO2XGcxT9A4bIfOx5jxHGSu093p44ymH74f10hnuTjBxpmsbOwmCwk+WCOROmoy2fvRDm1lBeXBr1G+ZmIYQFELbibG7YQ9yyRt7BE6yIv5FdTsccxl4AcGE8cufRig6d07fxsB4ViriVYPPhPcQdy93+EyLh0/TN5UXFMSbP5NJV56B9/bc/pmzqLKbXTrT9prnJ0EQvQuBIyZbD++iO9h1bC95oluCTP6fHBwO1P2PzG93qxgESDAljFYdgnBC79r5uth89iJN0+tI00e33+bbOnTjNqa2bzLrNr6F94t3vZ3rdRL7/zk+rwlBol2mah92jwbCn9QiH2ptO+bU/KjA+5vTYYbTbP8Si+AdRPrmgFBxoO8qBtqPuMEmFKfSGgmDB3q/fcieTayayavFCtJ8+fA8zJ0xGXFhHUaigydSNbUJoSglBS18Xmw/vOe4bg0cLRrKkRnP5jbQsL1MV6X9jW+ewShhNhBF5v44Z5K3jOCseXV+eMTakjrB8W9psathNW7jHDdcO0tSNTUWhohbOLWTGhKkcaGxE++4/fYoz5p0GZZVUBIvCfs14RRPEEe4e4qv7txNNxJLFnuj9zBzdarj5khbk/mg3QPuHKDiz3z58UOnPzAbdQJA69z8YCEbGVVPps7KI3DT9yxuwhjEy7IoB2jGadQynzCHHdhQlnhHb1I+BuITjMdbv3UosHgel0BUxv2a8Ul5YHKV6KqvmLePjF92KtmbqQr71l58yoWYiM2sm2wHTt0FXogPl3ie+8dAumnvaR9yAkULqggwvvxwMbQZbNJktt/4uNAMUNiwYzjSkkDm1IJRS2I5N3E4QtxLJm1myS8psyQ1clyL/Qkj3VeWmV8l3g/VH9TMCpoldsv2OdIhZcWJWnIRtuRGAyBn/48DO1KbkiQCXKGafyZBS4kiJ7dg40nGl3bxxC/N8VZk5GRFz6Ff84GRwIB+SbNqe+aWAwx3NbDy0O30CUNf1tqDpe33+hKnOlNpJPLPxRQAMgJ9/9Gt8/pff5n9/8ykWLr9xjxnt3ZuwnXoF7G87yvbGA0yrmoguho4QdKzg3W107yl02HBgBzuPHnCDkyCYUlnHmbMX49NNXI+2HCqedJ9t7+3iqe2v0heLIDSNIn+ANXOXU1lUOmD9qbwN7U08t30DccdO+73LZMz71BxI6XrXaZpOVXEp585dTmEglOUxGbXi7Glu4LV929nXepjuWARpOxSYfiZX1jJn4nTm1E+luqgcXdPoiYZ5ZvsGOiI9aRVCOjKD9Cl/fU+bpZQoRzK7fgqnz1pMzE7w7K4NdPT24Ng2MnkVtNA1NKG5rrwolCNRyg3ftXr2EqZWTXDLTe6/29KhqauNTQd3s/XIXhrbW0lIC7/fR3VhGTNrJ7Fg0iymVNQS8gXSE2c7Duv3bWFX4yFAoes6iyfNZOHk2WhppCOdXirJ5oO72HhgF0qApmvMrJnEyhkLMXJiUXhdo6WUbGvcx8ZDu3CkO0a1JZWcM3cZQZ8/z+Jy61RA3Eqwp+UwR7vaaOnuoKOnk+5wLzHbRtMEhWaA2rJK5k6azuyayZSEivpvaiVdove1NPDCjo1Yjo1uGtSXVXLW7KV52yCS+aSU7Glu4MXdm7AsC03XqS1z2x7yBQZcn/lAZX33eI4qydbDeznS2YbSBEKgfLq+syAU2v/13/2EtaefyZ/e/x+IO/7TJQBtPZ0smjGXZx4OUVpU3N7U07EhYiXOVGB0Rft4ae8WLlywioDpG1EDRwreThzuaOHf//JTXji41SUAtuLsGYuYXT+VupIKMpEqsvMrFDubD/LFe37E0a4OhKExr3oS8yfMoKKwdGBJW7iI/dKezXzmt9+h144jfIa7cOwkV9AE6JrrVGFLhCY4Z95prJg23yUAwuWY+5qP8JsXHuL+Les41HyUSCKBYwiwHbSExG+alFaUsWbWYr50zXuYVFbDodajfOXen7Gn82gS+xXKcsCRbl/15ApORQ52JNgSQ9O445IbWTZjAYc7mvj3B3/J7qYGZMyChOOmNXWEqYGWvJIs4UBCUlFYzPfe8xmmVtcDbgSf7kgv97/+LL997iF3F8iKkrDdSz+FpmFoGgWhINPKavnoRTfxppXnYxoGKJfo/fr5B/nji0/gKEnI9PG5a9/F/Ikz0XQ9Pc4psB2Hv7z6FD946G4sITFNk39aew3Lps7rRwCA9FmE9nA333zod9y3eR2OUAhHsbhuGrPrJjOtakL/kGYpaQzFnqYGPvqrr7Oj8wgxK4EVS2DHk1vdmkAXwiV0FZWsnrGIt62+jFXTF+HTDVICk0AhpcMzOzbwhd//gHAihu4zuPy0M1k+bX5eAqCS/0USMX763P38/Nn7ScTiCARz6ifzf+/+HPMnTMt73mKk52uiiQQv7dtKrx0DN6yD7dONV8qChZ1Em1g4ZRb37ngJSEoA1y85j0Oqh589/mcmVVTHDrY2vtCTiL5DSqc04Ti8tG8rbX1dTCzLfzw4HxyPK4Dl2Dy2+SWe37mJTieaRAjJjuZDHO1so7a4PO3PnuuvrpSisbOVo+EuOmNhBAqjVqMgEMyL/N54d450ONTZQku8j5hjg0wGxbBdZEMI8OlpZNTikoDhw2+6E65wg2Z84a4f8Oj2V+jDQjkSzVEYwkQIgSUdYnGbcLuNM11SGAghNEFbbxdH2lroCPeAoWUQXimX4Fgu0UGp1Kku0AShYIDKsnIMTae5s4PDLc20h3vBki6RkApsDRzdJWAqSbwSkvLCIjf8e5JD9sTCfP+RP/CDJ/9CU7gLx3ZACAxDR1MgowkiGkQcmyI9SHlhSdbijCZiHOpupUPGkLaDUpLiYGH2uHsMKnHb4lBPG20qhozbBOI6Rf4Qmqb1W/TubUcCqRQv7t7MIxtfoj3cgzI0EIK9nU00tDdnpJmsdajSZTT3dLC98SBHo90udwR0JREJB6UgZgr6cOhsOcL+7hY2HN3N/7vkHVyx6CxM3UiW426TN3Q202aFiTkWRgQKjAA+w8xZX5luKyXZcmQf929+gdZEGOXYYEn2HmlgT9Mh5tZPQac/4Rsa+T1xIFG09HbwyqGd7i1ACgxET8D0vTipqjZRMnku377lE2miaKSK+OkDf2LWxKn835s/qFZ844MbzUjfQUs5pUrBjqMH2da4n/rSKnSRHTLqeEEk//eW2djVxh83PEW3FQXlirFogtZ4L/taD7Nk8iySFxqTsbm7vx3H4XB7M/FEMv6ZJakJlVLoD+WtP12vUli2zZHuNhxdAzQMNBZPmsGUkhqU7bgpDR3h0xGaQHMUa+etwJ+UjHqiYf7vqXv527aXicZjaEIwo6KOtfOWMat+Mrpu0NTZzvbGAzR3tXLNaWsoCRYihCDkD3Le/OX0xqIIn4EwNDqjPbx8YAeRaAwsmxIzwPKpcykIhBCGhjAMCgJ+Fk2ejaZpNHe3E+4LJ6UTmFhWzeL6GRiGgTCSBCB5aYcmNKaW11BXWpWkMQ6Pb1/PD5/5K0e620DTqCwp5dxZp7F48kwKfQE6errY09rInrZGzpm3lGXT5qElZWuFoifSR2t3J0oTYOgUFhRSW16ZXp4CkpGJ3EUdicdo6u5AagKlCUzdpK68Kq0u5AYjRUBnuIe7X32K5nA3KJf7Ywi6EhF2tx7mrNmnITz3DXpXqpSK5t5OwtiuZVwq5tRP5tL5Kyk2Q1i2zc6Wwzy/bzMtsR5ilsWmIwf4+sO/ZWblBBZMmIEmXEkpYVsc6WjFFhJ0gSF0JpRXY2oGXlCeL32xCH968TH2NTagcIkrhkavirOt+SCXOKvRjGO5KzGDPVIpNh/ey57mwyipEFJh6MaewkDhlt+87ytqxeffzlcf/lU6Z7q15y8+jW2HdlH4rhWcsezCwy26uT6m7EVSSq0t3M2zOzawZvZprp4yDPwfLonISLUuxbccm0e2vsQrDbuQhkBIUI67aCN2nB1N+3HkOejpSU5FtnELsxybhpajWPEECNANjYkV1UkkzRCK3FBnCvfyhIbOFpyktahAM3nfmmu4evlaNCGQqbwefdxv+PDrJlJKtjfu58FtLxLFjds/q6KO/7jlQ65+5w8gkg5W3dE+Wro7mFRegy40BLB06hy+8Y6PI6VyI+wAz+56jTt+8w0i4SjCkcybOJmvvePj1JdVes7wCwp8QRwpaexqJeYkCZ+uccHCFXzhmvcQ8gfSemuq/ZoQGJpOQTKUV0+0j7+8/gyN4S6UVJQYJh+9+C28Y82VlBUUIRDYtk3EitPW10VhoICSUGHGYCsVbb1dtPd0u4OpCcpLSqguKfeI4NnQG+2jra3NlVQ0QVFRARMqa7O4v2tUdTPbjsPzezbz5K7XsXWBprR03VE7webDe4lZCQr8eXRp5apnjV2txKWFEgrDVpw7fTGfufpd6XXdHe3lj+sf5ysP/Zrmvi4cy2LL/l2s2/k68+qnoyejH0XiMY62tSAtB3SBP+hnUnUduqblSL+pvku2Ht7HA6+vI25ZrlQkFErXSBiwvfkAMSuOP0eCGCnErDjP7Xrddf9VCg3sgG68VFZQdFScV81bb72DT1369nT6NAHY13yUixev4s8vPE5dSWWkoaPlmT4ndqMUFCccm+d3baSlu4MplXV5B/dYdwhFyjqThMPtzdz9wqN0R8Pohs6siok0d7TRGe3Dsiy2Hd5HOB7NErW8HCJuWRxpb8VxHDA1zKCPSTX1GLqez2yQBb3xCI2dbS5h0CAUDDClqo7ywuI0wUnH2ffKtQpsR7Kn8SCtne2gFJqmsWLmPNbOX0FxqDBreII+PzXF5Umbm/vGZ5iUFxS73RACqSThWJRoJAKOy9EnVFQzqaKa8sKS7IYrd9vncFsLlkpyJJ/O1Jp6akor0otKqhT3F1nzJaWitaeT7Qf3Im0bgImllVy2eDU1JRVJAyGYukEoEMxjTHWNw609HfTGoiAVQoPKwpKkCtBv/xGUoCvcS2dPlyuxGBqlRcVUFZVl28OTzEEqSXtfF79//iGau9oRumBaZT29sSgtvV3IhMP2g3vpjvRS4A+kjW7e9WE7Nkdam7ATNgiBqetMrqilMBDCb/gAhd80efPKC3hs88s8sPkFpFTElM3h9mYc6bj2DqA3Gqa1s8Ptq4CQ4ae+rMo1HOdZaOF4lD+/8iT7u1tQPo0JoVKU49AY7kLqsKvlEB3hnvSNXCOFFNFp7Gpj3a5N2I4bLk7X6AmYvmcnlFTFQlOmc9tF13Ht6+dw/WnnA25AeABuW3k597z8NHMnTuXqRWfIgkDwFVNoB0SSs+5oOsTGht3uscJcbM/S8Ybg/QO9Fi73fnjTC7yyexvSsinzhXjbmZcyo24SQtNQlsPewwdp6+0asPhwPEprb1IMBQJ+PxMra13VJdn23GAbqS+d4R7au7tQjqs/FwdDVBWXZUkYWdtIJLcuk/vtiYSFjFpgS5QOXVaY3ng4e2iUm0sTGpqWvU+f4uhKgeU4HGltIhaLgVCIoEl9bW1a3eg3dtKiqastbczyGSYTy6ox0pKSy/U1zYP8ItV+SFgW0XDUtTOYGhHdoTPag+M47q5Hqn1k+1ek+q6Eormnk6iVAMdBJBxqCssoCAQz864yeRCKtr4uehIxF4kcSUWgOK0SZcYsaflXiud3bOTpTa/gWBaFpo+bVlzoGs40gbId9jcf5khnS3KIM8ifkiJitsXh9hakZSOEwB8MMLHClcK8gxk0/ZT4gwgJKInAJdDedvXEwnTFknMrFaW+kEu8+hma3B2jTQ17eGDDc8QdC79pcvWKc1g1bT560qB8pKWJ/S1Hhmns80Z0yAyvIyWv7t/O7ubDacnaFNreQp//te8sPE/NrpnE/9zzizTyg4cAAHzgshtYMHkm7/z391IeKjgUQH9OSBwlBJ2xPp7auYFIIja4DWAwh4g82dKOMkrR0NHMH19+gt54FM2WnFY3ncsXn8WM2kkIXUcBRzrbONDaiPJy4eTiUkrRGwvTEesD3V2Yxf4Q9WVVab0w1y0ntbBB0NbdRW9PD9gOwpaUFxRnGboc5e4Zp/5cxFAuImka9eXVFPiCoBRSE7xwcDvffewP7G1uIGFbnjBaQ02ywrItDrc24UgHNIFpGkyqqs1IPh6EAtcC3xLrRmmAowgJH7VFFQi05F63jVQSqZT7JxVIVycXQlBSUEhNcTlCc3ccjvR18L8P/46X92x2o8kk0ynIO/9SSo52tmLZFspR6LZiYnEVAcM1kLp1u+Nm2RYJ2+JodztR3P5hSypDxa74nkNklVJ0Rnr586tP0hrpRjiS2WX1XLXkbOZUTkR33DQdfT3saWpAqaSxVGWMf+Dq4M09nUlCrAiG3C0/TaQuRnEZw4HWRrY2HUIaAoRGoRlkZu1kjOROhgKXeNmxtCGxsrCU0lBRmhV7ETSciHHPK0+yv+MowpFMKCzj2uVrWTRtNobfBKno6uxi68HdOEr2I7L51od3+lNp++JRntjxKt3xiNsbR9kB3Xy2rKi4sfY/382S6fP41HW3ZZWUZbG4Zc2VHG5t4f6XnmRqVV3kSEfrY3124kZLqEpbSp7d9ToH246yYML0fG0aWg0Y5H3CsXh4y4tsaNyDNARFwscVS85iakUdsyomYEhBwtDptmNsP3qAtfNXYuoiu1wFbb3ddMYjqf1PF4lDJUM2TSlFU1cbkVgUpEToGjUl5YR8fjr6utl8aDctfZ1J5JHUFJdz5szF6X1wTQgWTp7FmbMXc/+2F7FQdIbDfP+xP7Fp7w5uW3sN5y1YSXlBCWIAQ6pXMolbCTeSq5SgNALCYEJJVcb24emzQtEV6aU11ovSNITlUKj5qCgoIWrF2XFkP/taGrCVRDcMgj4/Z0xbSGVhKSlbamVRGZcsP5vX2g7QnYiQiFs8uGEdB5qO8PZzr+Sa5WuZUFaDoeke5MxcRpZwLFdMtm1QCp9uMrG8GqUUu44eZHdLA9FEHMexsW0bR0qe2PqKq4/rAl1p1JZU4Df8mcWf7JtUihf3b+GZ/ZtxDEHAFlw8byWzaiYxu3oSpqZh64KIsNl2dF9yX96fLY0q6Ir00h7tRRkCoRQlZpDq4jKEcNWDhG1zsOMo33/ij2xvPogUYPgMVs5axOkzF6XVVSkdGrvaCEvL3a2RUFNe2c8XJLWuthzey4PbXiSuSQwHzp2xhNMmzaYj0kOwoIB4TzexWIJNB3YRScQoDhQMQQDyrF9gX+sRXty7JU1EDCHaQv7gY9NrJ8V2TJ3Bz9/7rxhmtpEy61dnWwdv+86nWTB5Jr///H+p+e+5/tVOK7bVshPnKKnEnqYGnt3xGrNrJ+PTjewlPER704aRPPHRFHCorYm7X36cHiuG0DTmT5jOBQtX4Td8zKyaQEA3SEibhKbY3nKIhGNh6npSLBfphXK0u43eeDRda2VxOcXBgiFHz5EOhztaiDkWCIEwNGpLK+gM9/LDJ+7hTy8/7u5K6C6CXbV4NcumziXkD6Q5Sm1JOR+64mZarF7WH9xBIhan14ry6Nb1bG7ez9UrzuWdZ1/NwgkzkjpnqpUiSzIRQhBOxGiJdCOFAEcSEj6qi8o9Ybsydg8UNHd30NHT7dJhQ6O0qIiAz89dLz7C/z5+N4fbmpCOgzB0ptfW87PbP+/q8sliAqaPW1Zfwt6OI/zh5cfpjYdJKMXG5oN86b6f8djml3jHmqu4YOEqSguK0ZJjnpK8+qIRGtqbcZQCTcNfGKS2vIp1ezbxlXt/xrbmg1jSQVkOKuFKQwkcrKQEYPoNJlXUYuo66Qi+yb6193Vx14uPupFtdcGU8louX3Y2Bb4gM2smUhAMEVU2lqbY1rif3mg4TUi8W4Dtvd30xCJJHR0qfAWUBAtp7e3kia3reX3fDl44sJUNR/YQsxIYSrBw0hQ+dPnNTKmqSxuqbdvhSGcLCWm7vgOaxsTyatdPJocRhhMx7nntafZ3NIMmqC4r55qV51ESKGRaRR0VgUK6enqQKHYfPURXuI/iQMGQ++heQ6lKSoxPb3+VA61NLoppKL9ubiopKHr9t4/+Sq1eejG3//iL7tauB/rtOVyw6HSWzpgPF82lsqi8KWj6n9AgoZSiLxblkc0v0NHX3a9tQ1GsXKuotyOWbfG3jS+wYf8upJIE/X6uWnkO06omYOg6M2snUVZS4no0CMXOZtdgkiou7SGmJE1dbSRsyzV2SUVdUYVrBR+0be62TmNnK7ZwDYC6ElQVlfHU1lf53bMP0tTbSdS2iMZixB2birKKjD6u3HALhm6wetZivnr9+7lq/hmUGkE0IXBMnSPRHn768sN88K6vc8+GJ+hN6o8p4pU7Vp3hHpejG+5iLQ4WUFlUSnKDImtQFYqmzlbCEfeuPmHqVJdX0NLTyY+euIddbUeIaA5R5RCNRAkq0+UyHuu8EIKJ5dX8vytu45/OvpoJxRUYhoESGt2RCA9tepmP//abfOvR33G0qzVtUESBkpLuSC8tPV0oXQNDUBgM4ff5+MWz9/PSnq10hfsIWwki0nLbgePeRqdASIXPNKmvqMro40nC7ijJczte58mNL2NbNn6fyeUr17Bw8iwEgknltVQVlZI6wbq/o5HW3k5ydSSpFEe72uiLRpJGSkFNWQVKKX7wzD185A//y/88ehfP7d5EJB6j2Ahwweyl/Nv1/8x5c1dgaEmnMOV6qR7tbk+7RZuazsTSKtdPwIO4Sik2N+zhgdefI5GIoyvBmrlLOWPmInRNo7qonNqCMtdmZOo0RDs40tWSWQ9ZtqacNevdJQH+f3vnHR9HdfX9752Z7auVVr24SO7GvWJjTDUQeqghhZaePOmNJE96D/CmkDwhJCGE3psBm+KCu427ZMu2mtV7l7bPzH3/mN2V5AKysbEh/PyxLe3O3H7PPffUtr5u3ijZQjAStoTQiLDLZn8jy+dvx+bjzAnTOW/WwsPWvnboB/9z3g34PrOIgpxCZo6eEK1rb17Zb/TdZpiyyBSwo66M3fUVLPGlD5h3cuR74cDqGvS7GDjxEhS1tqOZZ7esipvuwvjcPC6buQin3Y4iBAX+bEb4s6jtbkXqBrVN9dS3NzEizcpgkyjLNE2aezvQTQMMiSoFBb6MYalWIrEYLd3tyVPNLhVyUtLRhMKVMxZbBkBCIA0DTdW48Ix5SQKQqF8oAhsaZ46Zwl03fY2nR6/gyS2vs7+zgaDUicR0ttaW8+Ol/yISjfGxMy/GaTuS6aqktaeT3kDAmmIBWT4//kHSfzFIeWKYJg097UQwQEgU0yTXm46QsLBoCrMKJ6HaFEzdwIwZTMovxO9OGZiPJDMhGJWRyw+uvI25hZP49/qX2VJZSn8oiKkq1Id6+Mua5whFw3zn0lvI9KbFCxB0BfrojgVBs9RgGU4vHruL0f5cPjH/IhRNRbGpSFNi6jo94QCrKnbS0deD1A1cikZuauZA2PF477r6e3lm0wpau7tAlYxMz+GaOeeR4nQjJWSnpjMqK4/9HQ1I06Spt5PK1gYm5hVad/s4w2lKk4bOFis/XlwwmOvPpK6rlZeLN9JrRjHsKkQkWkxy3rTp/PTGLzNlxFhr8w/alCE9QkNvu0UETYld08hLS8gSBtZ7fyTIM1tWUNXSgNRN0l0ePjpzMRlei4NKdXoY489lk1mM4VDojAYpa6ljftEUFJUhV5ijMgPCkr/srDnA7vrK5Pq1SVHnsTnePHvc1NjB5lp2HTzAH2/6xmGvH0YAAC6fex49gT7u+fsfmH3uuaVdvd1vRQ1jtKkIpSXQzfKSTSwcO81ireU7bP7BbbV0M0MknVEjxmt7t7C7ucpKL23AojFTyfb5CUXDOG12fC4Po9Ny2KTvQRomHV1d7G+oZv7YqZbVWLzMiB6lvrsNAxn3f1bIT8tEHUZo80A0REtfNzIuofa63RTlFHDuxDl8bNElVnfigiVFUbBrmnVayYEknAkoQmFURi5f+cjHOG/qXB7etJzndq2hubsTE8nB1mb+79UnmFEwjhmFkw7TKpiYNHe1EQwGLXkEgry0TFKcVkz/+BwniWvM0KnvbiMmDaRhIgzIcacxb8wZLBg3zTJaimsXpJRoqnqYxZpVnDUvfk8K182/kNlFk3li42s8vul1Knqb0ZF0BwM8vHYZMwrGc8OCi7GpGhJBW6CbPiOcnPRsn5/xuaOYXzQlHoxCSWrHTNNkV10ZOxrK6Qj2IUwTn8NNVkrakHE0TJONlSWsrSrBUEE1JHMLxjPCn0MwGsam2khxuBmfWcBKfRu6adLXG2BvXSUXT12AXYtbcgpBzNBp6GqLR8eVaIakwJdJmtvLrWddxr7Gal7evpb6cAuGKdldV0l5cy1TRoxNDrQ1T5K+UIDmzg5M3bK09DiccQIw4LRjmCbFteUsL9lMRBoIRTB1xFimjRxnqbFVG3bNxvi80djsNkxhEopF2dtYRdSIDbJzGVgZQ/noASOpvnCQV/dspiPcB4pAGNJwqPb1GR5f2S8f+BPXLLmaUfkjWX2EdX9EAvD4l35Nn5SkvLWWgszcnuaerleC0rhECjMtZhis3ruV8oUfYdboSRYXcDTydAjfIpOr1oIpTarbmnh666q43bJASMH+php+9dL9+L0+zh8/m9mFkxmTnoemSyICQmaM0oYqorqOOkgo1RcO0tDZZnl0CYlDs5ObmvmOrppSSrpD/bRH+wdYbl8KOakZOO1WBpwkoZOD1HUMUo8dopEQCJw2O3OLJjMuZwST80bz2+WPUN/Vhhkz2F9Xzfr9u5gyanzSxDQBwzSp724jYuiWC4KiUODPTDpBJUcwXmU4FqWpow1TNyzLLynIjbfdrtkGuLC4/OUwNfUhAkURNxIalzOCb1/+SWYWTeSnL93P7rpKZMygI9DN6j1buWL2udhdNkxp0NjZRigcsXT6QE5qOj6nJ6kGHDw+hjTpDfbTF+i3CKhNJTM1jVR3ypBrTXtvN09sWUFrpM+ywERQ19HC71/8N6m+VBaMm8biCbOYkDkCuynQDUkUndKmakKxqNX3ONsejkVpTKhJVYFT2ChIzWJSXiFTCsbSG+on25HCXS8/TECJURfo5Lkdb3LBlPlJ+4zEwdXZ30NHd7fVdiHwe1KGGjzFtVFPb1nJwdZGa3w1lS4zxJ9XPokTjekFY7l09mLGjxiNy+smEuxHj0TZW1tBTyiAy+5MTpJICluPsHaR7G+q5s1924mZ1v1eVZUuj8u1rHDEqP7iuoM8963/d9Q9cEQCAHDbX+9gxtjJvPTNP5qTvnv9ur5YuNgwootNwxRVzfWsKNnClIIx8RRRR08gesh1dQgiepSXtq1hZ8V+pDSRiiCKZFXZLlbV7kHVVF7duZE/ffxbjMkuwKXZiZoRDEVQ2lxNbyiAy+5ITkx3oI/27s5EAARSXC5y0jKGSK2PRq06+3vojYSsZwwTv8OL3+1L7htI6K8P7d+hAs1Bwrz4H7/bx01nXsz2mgM8uPlVdN0ggkldZwu6YQwQAAlSWJxMXWdrMpa7pqrkp2dbQs8jIBQJ09rZbjkPmSYuu4uRmTloqjYgYziEnUzYGwgxsLCT14G4vwGA2+Hi4qlnsr/xIGU1VQRNiQE09nYQ0a0cg7quU9/aRCwUAVOiCcFIfzZOu2NIJqHBd+OGrlYCcY0LmkKOP5MUlzs5V7phsP7ATtbu3Y6hG0gFdJvCxup9bKjai+K0MWb3Wv70sW8wNmckqU4PwVAMUxVUdTbRFewl1eVJrs3eUD+NicNBEXi8HgqyclCFioLA5/RwwbT5/GfDMoI9rZi6yYHqKtp6O8kYdPUypWU01RcNWupLRZCd6ifNlZLsm2EY7Dy4n+U7NxAzdIsICcGuxip21ZZBWCfTk4ouJDNGTyDL5aO7rxepm1Q3N9DS00GuL33ImjoM8aUcjkZ5bfcmqtuakKZEQUqnou1KdXo2P/3UH83559zEjX/+7hHXDRxBCJjAvEkzuHTO2XDTVPIyMhtcNvsyxZRhpCQYi7K8eCP1na3DMlxIPHGov391WyPPbVlFIBSEmIFDUUnzePG7U/A7vaQ6PbT2dlFSX86o7HxSvT5rk+gmVY111MfDlSUWTUegl+5I0KLMpiTd4yMrJS3Jmg3Zv4NkRBJo6+kkFLCs7hRDkuNOIyV5epE0Vx58+idO1sQVxPIlH3guOVFYhiSZzhTLdl1VUJw2vF5vcoMMHqxQNEJDRyvSNBFS4hQaI/zZhxisDPS7O9hnGUfF58Ln9pLrH2pTH7c9HfidAaYgsWgHpO9DuTpVUcn2+q3kI4ol63CqNss9PH661ne2Wm7TAhx2OyMzcgc8+g7hNgxp0NDabJlrGxIlJslPzUqaSwN0Bnp5ZvNK2rq7IKZjU1TSfD7S/H78nhRSNRd9oQC7a8spSM8mNyPLsmEwJQ0drdbaJBETQdLZ10N7b5d1OOgmPqebrNSMpGGUiMua8tMyLQMgw6Stu8PiKAcTT2nS1NtBUFrWhALI8abhsjmSY9kbDvLs1tXU9rQjVQUVgU9z4Ld78Ns8+F0pSLvK1voDeOwuct1poFvUuDXQTWVrvWVwJ4bO15BlEm9TdXsjrxZvJhyLgWmiSBlyadqyPE9aC5ljuHraIi6cu+iw9xM4Kgfw/Ys+ycf+9kNG543i9guvjP38ib+/1h/o/5RhMlUqguKmg6zev51RGbnYVdtRuQA55OeB3yJ6jNf2bGFPaw1SAdWEc4umcdXcc7GpGkIRCEVBkTClYAyZPj8js3Kp621HSpO2nm7Km2uZUTgRoaiY0qSlt4N+GbXImi5Jc3mwaTYieozExXmAGIGmqKiq9W59ZyvhiBX5SLFr5KRbnEMkFh14J3HZjw++TdVQhIpE0hXopba9idzUTNLcKdhtluWYaZpE9RhljTW8VbYn7mEHPs3JpLzRydNfQPLU7Q+HaAl0xY16wKs5yPFlHMbGJZK2tPV2WbYPqrXJfak+vE434Wj0yHZZAjRFS94z+8NByhqryUrLIDMlzUoLLwXSNDGwVKtrK3cTQgdNwWZTmTTC4v6QlotrU38XpmYZ1DjjBjZHNAHGOt0bu9rjp7HEZhKXoltyCcM02VhRzLrKYgxFopiSublj+cQ5l+KyOzBiBkiJZtOYlFdIts/PqKxcdjdUIHVLRlRaW8GZY6Ykx7c90E2fHonfkU0yHCmkub1IrIMcIUhzeynwZyEqLK+PnlCAiqYazpk0G6Fqlr2AadLQZcVHwDRRTJMcbzp2my05JyWNlbxetp2oBqAyLj2PW8+6lAyf3+J4ANWmkZuWQbrHx2h/DhtkCYZNIWhGKW08yBUzzkZVBoTMR0JEj7GidCulrbVIYXF5dkUtS3E43/j5x2/Xq/9aT2lTNY9e//kjvg9vQwAAvA43Z0+YwS2/voP502aUdfX2vx41QxMNga03EuS5bau5aMp8RmccwT/gbSClpKqtgWd2vElAxkBTyHan8YUl13PV7HMOF4AIy9Nu/IjRbKrbj2kY9Cs6e1uqudrQUYWKbhjUtTUTDkcsIyBNpScW5qXi9aS4PRZ11g3rhFYFHoeTc8bPItuXkfQCjCpYClRNoTnUw3M716DEN4IQAkUdcFNNsbs4f/Jc0r2pRPQoz21bzX0rnmHGyPGcP20e43NG4XG4COtRypvreGLDq2yuLsUENAkzC8Yxe/TkQZoUi0MxTZOOYA+d0YDl6qpAaqqPjJTUQQNIcjNJKWnpbicUDln+/qogokpWlW1ne21Z3JAIKyiIaplDq6ZgwbipjMkagUSyqbKEnz3zdwoyczh30mymFowlzZ1ieVZ2t7Jsz2Ze2LOBmArCFBRl5XPR9AWW3ltAfzhAe6DHImCmxK05yUzxJ2Unh7Y5FIvQFOrCsKtITOyag3x/dlKT09LbyRNb3ojf/RVSFDufWvQRPnPuNdjjtviJ64tAENYjTMgagSohBkSMGKUNB4nqsbiQ0nIDDpoxpKqgKAq5/syk1aaMc2wuu5PCtBxUKTBVhahpUt5US8zU41aAlsq6vr3FIuRSYpOCEek5SVPhvkiI53eupba3DZA4VRvXnXkhX73kJtx2Z5xjHeAaw9Eok0aMwb7TTkiYRA2DvfWV9EfCRxTUDt5D9Z0tvLhzLYFYGAQokojT5nglNyOnYtH3b+cL19yCCL89h/62BOD+z/yIhT+/mfSMDM6bdlaotWf50lAseo2BUWQaBlvL97Bqz1Y+dfZlhwmy3g7hWISXtq5hd9UBTCSaQ+OcaXM4e+LMIZt/8CQ7NTvjMwvQpMAQAl1I9jfVEIpGcGoOYrpOXUsTeigCKpiqYFfzQfY+9VeELa7DDeuWkMquMC4nn4mf/TnZvnRCsQgN3W0YikTqEkM3Wb7nLd7Yuw0Z0S2qrVjGQWgKwjSZllPI9JHjSXWnUN5Ux39WL2VbdRnbqg/wzK415KT4SbE5CelRmvu76ervR0oTm6YxKW80X7rkxgHHqvjdH2k55jR3tdPT32dxAEKQ4ffj9/oOu1aAdVo29rQTNvXktaS8rZEfPn8fGNJiLcEKCGJTQDfxKy7+9ukfMDojn47+Lh7atJxtbQfZXFfGsl0byUhJI83txYjptPdaxMhQQVVV8nzp3LboMuYVnYGiWCrYzv5euvv6LGJjSNJsbvweX/yWJQ9rc2+on5ZAN6YqQCq4PG7y0i0CENV1VpVs4c3ibei6jqIpzB47mYtmLBwiAxnMW2iKyvjMAhxCI6qaxFTBgY46+sJB3HYnMV2nuqWRcMjSkQtVJT8zOy7gTWhVJJpQGJ2Zi11RiWomuhBUdDURjIatzSslgXCI+rYmjJiOVAROh4ORmTkoQsGUJjurD7CseCPRaAyiOkU5eVw5fZEl1Iu3W8iBK6SmqkwrHI83xUuovwcjZlLRVEd7fxfpnpSj7qGYofNGyRZ2HDyQvKLYFbU6xel+6aYLPhquaKyhsb2Fl755z9vuxXfctRfNOBufax9/fO1ROTWnaGdPqH9F1DBvN6TUusMBntu2igunncmo9Jx3KiqJmvZmXt66hmgwhM2pkZWaxnXzLiA9vsgH3Fat56WUqEJhXGYBqcJBlxmEmElNSwPtfV343SlE9RgtPe2oRnzB2az7qmGaEIomDYaEkBAz8WpOUuLGMKFImPbODrSombTqw9TRFZG0K8fEcpQxBYqADG8qKU43pmlQ1VJHKBTC7/YSQKdPj9DTWg9xrzPFZsPutOPTXEzPL+LLl9zApdMXYdNUq75BgjhTmjS1t6IHwtjiV6BcV9qQcFEJKX7CfbqpvxPsKraYtQFBokvLKQmI29oL0AFD4kj3W1JrBVp6Omjv7sTvTKFXBogGwtR3tlHf1w4IlJhEQ+BVHYzJGsmt51zBzWd9BI/DRcJLr7Wnk1AggIaCogny0jPjrsJxDLp3SSnp6O2mt7MLW1w24be5LUGbgLa+Tp7ftILe7m5sNgVfmpcbzryI0Zl5cSvIeIFJpYI1gGNyRuB3egmHe0AIGjtaaenpIDvFb5lVtzYjIjo2IbELjfy0LOvUVoQlF5AghEJh7gh8Xi+RWMDyiehqpa23O27zYBGv9q4OVClR7RppaWnkZ+SAlPQE+3l+8yoaW1uwCYHd5uAj0xYwOb9wCMEaTBRVRaEou4C8FD/dPT1gWl6V9Z2tjM8ZddjtPyHGru9q5dmtq+kLB0EVqELE3Jr99ZyUtL1f+fsvuW7OuYwbPZaX3mEvviMByE/PZUv5k7hUhamFRX1tgY6nQ0H9EtOQo0wh2VKzj9X7tvGJBZcMiwswpaSxs5U8XwYXTpiN0FTOGD2GxeNmJD32jtRhISzz4MumL6StvwupG2S4fYTi93aJZEzOSJZMnmsJUGwKqKoVWks3rFJUBaEoCFMydUSRtUjjgpxJWSNxmMqAWk+12OlE4Aiwrg6Wj7Xg3MlzSHF5UBWVxZNn86fbvsP68mJ21ZVT29VMT28vejSKTbXhc3kozB/JogkzWDJlPuNyRqIqClImVHJxgU+c4/HaXZw7Zjq6TaAiWDRuBq5BBkMDQnurPTleP0vGz7YEebo5IN2Lt5uEB6Bp1TMyO48CfxaaojIhr5Df3/AV1pftZkvlHg421dEbDhK1gVBVPFIjz+tn9tjJXDzjLOYUTY6bvMb1HabErmosLJpCRJhodhuLJkwfYml42Co2YVbuWMZmj0RRFMZk5JETNyxr7+nCa3OyZNIcUAQj8/L5yNQFllxosMZiEBQhGJczksunLaSmqwUEpDqsAB8JR68R/iyWTJyNROKw2ZmWPxY1IaSMLzJVVZiYP5rLZiyiubcTkPjtHqKxaHKOBIJpBePISk1HOO2MzMxhREYOCEF7fzeRcJjzxkxHsdvwe718fNGlRw1GQ3yt5aSkc8n4uRQ40hBC4PZYB0tyXQyCBKKGzhulW9lRX46JpbmxabZan8f7zPnT5wUq2hrYvG8XV51z6VHrTdb/jk8AL5Rs5C/LHmL9/mImFYxKrWlr/kNfJHSLCZqiWI4Z/3frHRRm5g+nOAKREIFwyIpYIsDpcJLi8gxpzJEUdoZp0BPsRzesDS2EQorTjdPuwJQmvcGAZQacKCPJQUDiEpoYUJuqxTewMlBu3Bc+oStPCPxkQnswSAHvcjgs5494+Uqc2+gJ9tPe10VHfw8RPYbLZsfv9pGV6ifVnRI3yHn7e1l/KEgw7s+gKApOu1XXkWLDmVLSHw4QiVn9Tmon3gY2VSPV47U2QJwDMU1pBejo66Y72E/YiKIoKj6Hm4yUVDK8qRaBTxYf/1dKQtEIgXAwLlCz2GKvwz1AvAcNXUJr0Bfos+ZDVdBUjVSXB0VRCEUjluVhfG3YbTaLUCvKEFXmoTClNfax+DgIRcHn8uCw2ZFS0hPoIxqLWVc5IUhxeSxh5yFjasbnMOFPLwSWWbNmPRszdHqC/VacSiGwqRo+twdFKISiYfqC8XFQBDZNw+fyxon9wJgNhkDE7SL64oFCLKMpj8N11ACnFa11fOmRu3jzwC5M3UBVRCzV6f7HuLyRP9h5cH/f5XPO4Z9f/gmZ4h18YBgGBwBQ2VzHlspilKjB2YXTejs7u54Km+ElEUWOMqVkc8UeXivezO3nXIlDsx9VapmA1+lOek4NFmYd0s/DoCoqGd60IWQr8Z4iFPxe33C6c9i7mqqRkQhyMahNR37p8DYnTiZVUUj3+kh/m3YMR23qdbnxOl2ApXIbePdwwqgKYRnQHAcsbkcmZS2pbi+pR7l3Hi27sRACj9M11O+fhJZ1MKkYeN5ld+BOcDTK4MkEt8Np+W4Mngf5zuOmCNUKlHKU+UvzWDYdyfpkon1Dy1VVlfSUw8tJ1G9XbWT5/EPanCjJZXfitjnjB4YYuk6Ouq4kqhBDzLwHl33oXgrrUV7ZtYFtVfuTIcxtplKbojmeumrGor6y6krK6w+yunjLkQfqEAyLA0h04oKffY63msoY78tNre5uvrPPjN1ugk1IOGfCdP52y/eZlDd6uEWeJjgSrzHcb99NyacTTnBLB935T0ULhgZ8OVw9fWhAmHeq9+0M3YaNdzpYhlWE5Vr8xQd+z5aa/UgkiimjqZr9vrFZ+f9b2t7Ud8H4abz0l79A3fDKHHYEwn+tf5F9tVXYBVx/7nk9KR73o3ZFq7b015JttQd4YftqgsksQu8tjiQsGd54H4VllkP+Oy6css1/zBWf4JYOf/CP0IJ3uUsYemoe2TZl8PcDtYpBPx/t+UMx7Na++24RiIR5bvubFDdVWQJtwK7ZKlM9KY9//rJr+5wI9tcf5O7/PDHsModNAD63+KM0/Xsl50yax13PP0FeWs52t2J7UTFkBBMC4TBPbn6d4rqKYbG5x4RhFHfoI8M5hJIWVkcxlhkWjrGrFjt4fOMz7CARJ2CxnTqcSFIwUNwRx04O/VEe/vFwiz/pMKVkd20Zz25dTSgaQZgSBUJuu/25/Ky8Xd99/F6uWHghZX9+ie9ceNOwyz2mGMR3vvwgNW2N2ITCWz9/MJBidz5uV9R9ibHd31zHY5tepSvY944OOMeE5F3w2IbbmtSjtyPpxnvoM8Op5jjY3CSOc2yOlw1927k4je8o77ppcbb7qCz8+4hQdgZ6eGzTa5S31icPEYdQ9qY5XE9u+NE/Q25Ualob+fu6546p3GMiAHdceRsVTbVcvfB8/P9zEflZmXs8bufjmqr1oyhEpcHSXetYe2A7MUPn8NCFQ3HMROK4Ns7bL6NDYwRa9QynLcfRFI6jzycAb8uRvY82wTFjiK3AScSJ5ngPgW4arDmwg5eLNxCTlim5pii9Xofz0aLcvANpnzuf2y6+mvaeLr50znXHVPYxZyH46+f/l4rGOlJsdja+tSaa6kp51iHULYqltKShu50H1r5EXUdz8p7yId5bnPAr2DBxKojbsJC8BpwknOR+17Q38Z+1r9DU02nZoUhpOlVtY6Y37fkVW9dFc3yp7Kku5wc3fPqYyz5mAnDbwsvoDfZT88eXSckbzbSMomqv6nhAQ2kFMJGsK9/NCzvefEeB4KlaqKcVTsLiOVUb8WTJft51b05TujQERxm6QDTMc2+tYv2B3RjxVG82KVpSNMd/5o4YV+dN8XPg/71AbzDAJ2dfdMzVHk8eIu669dt85YHfU5iWw6b6fUaG1/eqU7MtU4USE0KhNxLioQ3L2V69Lxk37T3H+4W2fEgE3xFHHqEj2yUcezmnCcTgH61fTGmyraqURza9Go9VIVEkUZdmX5qd5n995f5d5hl5o/nNy/fzu9vvOK5qj4sALJk8j+5wPyXVZUSiUfbc9XRHit19v02oByytmqC0qZp/r3mR5p6O42rYu8ZJoPoDkX+OvfAhMQKOp+5jeVYMp64jxZ4Xg/6eCLy9/CdhWntEDNabH8Wn+XS7cpyo1iRkFk3d7fx77VL2t9STsCtyqFppmifl3zt/91RXUI+wv7aalp5OFuSNP666josAAHzryluQT+/i/EmzKfzmFYxMy9nmUe0Pq4heEOhSsqxkE0t3vGkllngHnMhld6Jx+IaSx9xYU5qWrf47nEPDVfUd7SnTNAmFQpZJ7FGqEnETV8Sg60Lcok1APADKsXXwsDGSHJ27iVtOmqY5ZDwGiORQKzozHqzkdMdwWjjc+Q3FIry4Yy3LijehJwR/Qu1KcTgfHJc7alfRt67gU+deRs/DG/nMBR897jYfNwGYM3IC33/iHuq72jBMyabykojf53vSqdlWK0IYCEFHqJ/71y1le/X+Izo2DIaEky5MOR5IKeno6KCiopLKyioCgWD8C4bdXtM0qaurY+/evZZL6tvVN8iCbejnJD+31FqDvx8gn12dXaxbu47a2rqkm+ihXEtffx9VVVVUVFTQ2dlpufHGEYvFqKuro7V1eNGeBvcxFotZ5qlDm3RYJ6QpaW5uZu/evfT39yc/0/XE+wMRoxsaGigpKSEQCAwp6lgTZ5wueOcDwNL576g+wL/XvUxX0IqbqEgMl2ZfkZWa/vTGfbujqlTYX1/Nr175B9OP8/SHd0EAAH7/8a8TjISpv2cZuZlZ3Lz4ytoUh/vvNqFWJkwsixsO8q81L9LY3WZ18O2IwMmi8u+i3Egkwtq1a3n88cd5/PHHqaysSC5ya42/80I0DIOSkhJWrlhJb2/vcbcFBqstDzFvjTejvb2dN1asoLq6+pBn4nb5UlJdXc0TTzzJww89zIb1Gyzf9fj7vX29vPTSy2zcsDHpWPN2SMxne3s727dtt7L9MkCohj5s/WeaJvv37+eN19+go6PDCtnV1cn27TtoaWlJzpdpmOzZs5dXl7+afC5R9qDihg7AkKre5opxmkICjV1t/HPNi+xpPGj5FUiwC6XM53Td98T37mn0uJ1UPLSUQDjEj6/4wruq710RAIDPXXQ933ryL4zLLOChNUtlvi9zjVu1PaRK0QMC3TR5uXgDz2xdSX84eGokMcfFWVjvdHR0sGvXbmKxGK2trRw4UIZhGCRCRCfY6CP9BWvDKYrC6NGFTJ8xA7fLHW/Skd9JvntIuYk+HPn5eJPjbLVpmIN6IQ4b8/7+fmpra2hra2P79u20tbclv4tGo9TX1dHa1pb0eDuSTOHQPtbW1rJ06VIaGhqS7R/ch0PfycnJYeq0qaR4UxBC0NzczNKlS6msrCR5BRBQUFDA9Bkz8LgHebYlRRWDxiDRVwbGSxzShqMdPqcTiQhEQjy9dSUv796QjPKrKUq31+74T1FGzoYb7vyanD92Kv9Y9gqfXHLlu65v+GF8joKvX3wDH//7T+jo7yYc6qekoy002p/+UCxgzAgasWtMgdYZ6ONfb77IxLzRXDRlQTJY5Mk00BiuA0eCUzkc1mY6ePAgvT09XPKRS9i//wB1dbUEAgFs8RhwpmnQ09MDWJ5k3d3dRCIRXC43WZmZOJwOVFWlqKiQvLxcXG4X0WiU7u5uNE3DNE36+vowTZNUXyoer5f+/j76+/ut0GMpKaSnp6PGU2b19PTQ19dHJBKxPOtcLvx+P06nE2ma8ZDoHJZgY6BbcR9+m51Jkyclrya5ublWfETTRFFVbDYbiqIQiUTo6enB4/bgcruS7rO9vb3EYjF8Ph+hUIiOjg4ikQhdnV00NjahaSqpvlSCoaDVt9RUotEogUAAj9tNfn4+fr8fj9dDMBiks7OTUDhMR0cHdfX12DSN1LRURo0aSV5eLqm+1ETzCQYDdHR0EAwGsdvtpKen4/MNREzq7esnFAzicDgJ9PcTCofQNI2MjAy8Xu9hcz7sVZhwmzxWJAM4HP7u4OjMumGwrmwX9699ia5gH0hQQHfabK9l+v2P7qoqC/vTU2nubmdPTRn33PjNY2/LIXjXBADg8S/+gqzPLaHtmRWM+tSVHPjDi3UFX738b3q4f1LEiE2TwP6WOu5d+QyFmXlMyis6EdW+LYZLXA5/amB5RCIRyssr8Hi9TJgwEV3X2bhhA83NzckFFw6HWbt2LX19/TidDpqbmunvD+B0OliwYAGz58xG0zRKS/dxsKqK8y+4ACklr776miUXAbq6uggGQ2RlZZGXn0dLSwv9/RZRSEnxcfbZixg7dizRaJTNmzdTVVVFNBJBKAp2u53x48czf958PC4XirAIkaIceaFKsDIY2WyMGzcOKSU7duxk+rTpZOdkWz7umpYMctnc3MLKFSuYPWcO06dPA6wrzbZt22hqbOKSj1xCTU0Nu3btJhqLsm37dsrLy/GlpnL+eeexc+cuenq6mTR5EvX1DfT0dHPWwrNobmlh3759LFmyhN7eXnbu3ImhG5SU7KGurh6Px8OSJRdSX1dPbV0dS5ZciN/vp7W1hU2bN1NTXU0sFsNms5GXl8ec2XMoLCxEIikpLmbvnlJS01Lp7OwkGAwiTZPxE8Zz7rnnkpp6BNfb4eB4ZVRvw3nIeEgoKSVlzTXcu+o5ytrqLA5GSuxC2Zfq8Py99LfPNIz62mXUPLgM7ZYrT8jmhxNwBUjgga/9kh/cdw8Tc/KZ8N1rKUrP2ujRbP/UpNIOAhPJqv07+PfapbT1dZ20u9lwS30HcSRgbcza2hoKC0eTnZ1FYWEhMV2nsrIKw7DYs1gsxr59+9i2bRsd7R1kZWUxatRIOjo6WLlqJW1xVrq2tpadu3bR19dHOBxiz9697C0txZSSESNH4kv1sWPnDtauXYtpmowaNYrc3FwOHDjAm2++SSAQxDRMpJRkZGQwZuxYCgsLCQaCvPbq61RUViIFKKqKph09E5LAip0gFIt7mD59Ou1tbezZswfTMNFUFZs9HipLSrq7u9ixcxctLS1JQa5hGFRVHWTPnj1EIhFsNht2ux1pSlRVxe5w4HA4kEgqqyrZuGkTq1atpqLCchRTVIWm5iaKi4vp6+tFCGHlIURis9lwu124XFY8hPr6ekpKigkGg0QiEdav38CaN9dgs9mZMGECubm5lJeXs/zV5bS2tGDEdGpr69ixcycNDQ2kpqZSWFiIoiisXbOW/fsPDAgqTzGSgl0BbX1d3L9mKSv3bceIR3LSFKXN63D9c2z+iE1n3HEj04smctezT/LPr/38hLXhhHAAAFdMW8hNf7mD1r5uopEo+3pqotm+jCdjsY6phhm91RQ4AnqMR7e8zpjsEdyy6PIhce5OFIbLziWE+EeTD0opqaurIxAIMGHCBFwuFzk5OaSmplJVVUU4HCElJR4K2pRkZKRz5ZVXkpWdjZQm69at47XXXqOpqYmsrCxM07DUXtJKTOmw2ygsLOTaa6/B4/HQ2tZGX18fdpuNa675KOnp6QQCAbq7uqmpqaW/v5/cnBwuvPBCVNXKhhSLxdiRvZPHH3ucxsZGpk+fZkXOEW8jUBXW1cgwDKQpmThxIvn5+ZSUFDN7zmxEPNOSacpke5V4RJtEUBAhBDabhsPpQNM0Jk+eTF9fH9XV1cybN485c+bErzcGTqcTh93arFOnTiErK8siGDY7DocDVdUoKiwiGAxSUVHJzBkzOHvx2ckrj6IqqIqa1MaUlBQzZswYrr/+ejIzM4nFoqxbt45lryzjQFkZZ86fB4DH7WLJkiVMnjwJRVEoKyvjgQf+Q1VlFbNmzcRutx95fE4BgpEwz219k8c2vU4wEkEIUCHsdjiezcnIfKK0tjKS4k2hubON/XWVfPeCj52wuk8YBwDwxFd/Tygapqa6HLfTw/61L7T6XJ57HYq6SUFIIQTN/d3cu/o5VpduRTeNUyqlfTtPBYv9L8flcjFixAhisRgOh4OCggKam5staXd8k0msO7U3JQWbpuFwOMjLs4JY9vb0YhiGZcaJSOYyRILNZrM2gaKSlppKWloqMT2W3OAOu4PU1FRisRixWBRFVQiFQhw4UMbmzZtZu3Yd5eVlSGlawUuJb1JTvq3iQ0qJHtMxTRN/Whpz582lrb2d8vJyDENH13V0PZYkIknZwiAoipJspxInGoZuoKoqTocTh8ORfCYjM4OzzlpIUVERXq83fkVR0DQNVVXQbBqqqmIYBoqq4HQ4cTqdaJqGplk5IgzDpLWlld6eXiZMGE9WlpVI1GF3UFhUhKIoNDU3Y2LF9rPZbPh8KUlZRnp6Og67g0AgMHwO4CTbHggEumnw5v7t3Lv6OVr6ui0xpimlU6jr/U733/a8/nKb2+GksuIAgUiI+2/94QltwwklAAC3XXQ97UsP8OnFVzPpvGs5Z/z04hSb8882RS0XAFJQ2ljNn19/kp01Vljw95QIDJ7UwwKQDqiNOjs7KS8rJxqJUFJSwqpVq1i3bj29vb10dXVSVVmJnsimw8AmGHz6SinRDT254FTV2hCKsE5p0zCTacys7Dwm4VCEWMzafBLrBEycwD09PbzxxgqWLl3K1q3b2L9/Hw0NjXEW2pYU0On64Rt26BjE+ysEavwET0tLY9u27fT29lrEwRjQACAGjIMGS/5NcyDzTkJjoCQ5EKsNiYxDScOfQ35Ojr2w0qsr8cCwUiY0LFbfTcOgP9BPNBrF6XQmJf+Ja4OmaUSj0XhotgQXYw4iiAPkfthGTsN87vh0TNa1eHdNGX9+7Sn2NtVY8QqR2BX1gNflvudji5fsnXrRFdzzpe8hny/ltkuuPY6a3h4n7AqQwA8vu5n9/6iirrUZBdhYtdcsyMp7LdrWOM6Mhu7QpZlpSsth6K8rn+InV32WcTkjk4YfpxzCYunr6uro7OzEm+KlpLjY+kpR0HUdAVRUVLBg4QJLE6hYp1jidE9Y/ZmmkdwUijKgslMUBZtmQ1GVIatncNy9xGYbyKprUlVVxcaNG5k8eTILFy7E50uhubmZF154ASUe3jqx2OHoCSWFYt25E5vV7/czffp01ry5xrIfGNSmgZNaTUqsAQzDMvwxDNNiWVUVzabFyxVJYmTGuZ9DcwMahoGu6/EUWAxwApo6QGikpWUxdCvngdPpRFHV5EYXStwoyjQx4zkXEhvfGn9zyHiqmmqN+Tts2aNrhk4M4iSUg60N/OX1p1mzfwcmVlJVTVFbPTbH30fljHjjuc1vmg6nl3+9+jzLd23h3pu+d8LbcsIJAMBDn/8pi3/+OXqC/ThtGlXNtaEcn/+h5lhsdMCIfsYUuKLSZGnxBvL8WXzzoo+Tm5pxMppyOA41V4UBs1PLkYFYLMbBgwdxuqx7ZHZWlpWmTFEIh8OsXr2a5uZmurt78Hjc1uLVVGujIq2UWoew/TabDVUdUH9KiG/uAZ2/zaZhs2lDTqgEZ2CaJu1t7eixGDNmTGfq1CmApbcXQkkueNOwMtYoylH4qvgdPsFZIEFVNaZPn07x7t3s2VNCNBJJalESd/i+vl50XUfTNEKhMOFw2JILkJAJ2FBVBV2PDSFeiqqiqgpCKEPGPkEIFSHiHJSCNE2ikegggyGJrlv9UhSF7OxsUn0+amtr6evrJzXVh67r1NbWEgqGSE9PTyYrGWL9GK/LItIiyc0MGBYNQy34NirAYyYWQtDS28k/17zICzvWEDXi+SNUJei2Ox7LSc94tLKpNuz3uukL9hPR007K5oeTRAAA7rrlGyz4/iehv4dJk+axv3xn66iRE/5PD/UVhNGvREHri4R4aONyMj2pfO6cj5LmSXlXXMAxU+6jHASdnZ2Ul1eQm5vD3LnzSEsbUBuZUtLe3s6ry1/l4MGDTJ48KcnSDq48mXDTHDCBTvTNMAzC4TCxmH54g8XA+4kyLHZeWOorASXFxUkh4MGDB+nr66O2tpae3h5MJGbcgMQqbmgiU4ib7UZjGKZhESIBWVlZTJ06lddfe51wOMTYsWMRQpCWlkZ6RjolJSX4fD7sdgetba3U1dWhqipqnIilpKSgKAolJSUWN6DZGD16tHUKm4fPihDKAKET4PV4sdsdlO7bR4rPh6Zp1vvxK4SiKGRlZTFp0iR27d7N66+/TmFhIf39fWzYsIn09AzGjhubLDNB4Ab7Ougx3co0PIjTin/1zjheFeDQQhDCSi7y+MbXeGjDcnqjIQSgSnSn0JaneXz3lhbvaJ80bR779+3ElZHNi//7R177zv+dgPoPx0kjAAuKpvDA+le4Zu5iUh0pzP7fj7Pj14/vz/vKR/4go6GsiDQWSSlFS08nf1/1HOnuFG5acAkeh+uoROCdNviJYtv6+wO4XC7OOOMM3O5D2iMl48aNY8SIEfT39aMoCvn5BWgJ9lJaizslJYUxY4pI86cihMDv91NQUIAtnjS0oKCAzMzMQSeRICMzE02z7rOJ/mZmZlFUVITb7SJt3FjmzJlDTU0NnZ1dVpZeh5MxY4roDwTo7e3F4/EwunA0Pl/KgEXe4IERAo/Hw4gRI/B4vHGDOusEnzZ9OmVlZfT29pITNwxKTU1lwYIFrFu/ng0bNmKz2XG5nWRnZ+H1eHE4HAghyM3NZfr06VRWVrFmzTr8fj/Z2VlkZGSgKgqqaiUOJc4Z+NP9FIwowOGwwoNnZWcxb95c9paWsnbdOnwpKWRlZZKZlUlh4WicTicul4uzzl5EfyDAvn37qa2txZQSb4qXeeefx6iRIxGKQro/nVGjRuF0OuJTZqknc3Jz8KenD18GcAKRqDMUjfD8tjf528pnae7tSiSqkXahbvLZXX88ePfzZXN+divbf/YgAM/v2cCMjDEnr10nreQ4vvbw3RxsbkLoOhWdzcwePUF9fd/WK/uiwV9GDH2qlNbdZ2rBGH505e1cNescHDY7yBNnKXisnEF3dzfNzS1kZWWSkRG/mgy6LkQiEWpra3E4nOTm5NDa1oqUkJ+fZyXbEBAMBmlqbibdn05aWiodHR309vbGtQOChsZG3C43OTnZKHHZQnNzM7GYzogRFqEwTZP2jg76+/spyM/HbrfT2dlJbW0tgUAQl8tJVvx60tPdzciRI7HZbDQ1NZORkU5aWtrhFpESenp7aG5uIScnm7S0tORXuq5TX19vpTnzp5MTNwwKh8PU1NTQ3t6Bpmnk5OSgaSq6rieJmoxzRrV1dUQjUVJSUigsHE1PTw/RaJSCgoKk6k1KSWdnJ13d3eTl5uF2u62TsbeX6uoa+vv78Xg8jBkzhkgkTH9/P3l5eTgcDmtM2jtobGokFArhdDjIzs5OWjIahkF7ezuBQID8/HycTkvVHI1GqauvxxnX0KiKchLu+UdfaUIIonqMl3et5xfP309xfWU8UxXYhVric7h+tGTOWa+UHNhvFObk47A7mFQ0hl9d/rkT3spDW3zScenvvk5rTxuKqtET6CMjLd1R1lx7c1809KOYaYxGsTLKzB81kR9f9RkumroALa4HPlKDT7ao8NATItmOOBt9mNvrILb9iM8MemiwUOrQ8t/5s2PjRI/KSR1WT1xecISy38mL82htPfTdeMS4QVaxic8h4f13aP2H1m2x7hzVyhEk0mSA8xmoIFFp4jHe9fEyzMlISGJ0U2dF6VZ+8cL9bKkojcspwGazVae4XL+aPKrokabmtkhaegoybJKfnsNL37z73bRwWHjPeKFZ3/84XaEAwu0i2NtDui/N19TV9oWgHvmWjpkrkagSzpkwkx9deTvnTJwTT6k0oL5JLNWTHuTx3WAQQRgOBhM0Ef/3Hft3hDoSC21YY3OMbTzVONqci0H/JvQe8pDvT/VKEUJgmAZrD+zk10v/Y6XzMk2EaaIJpcXrcv1hZFbuvS19XX3paamE+kOkOb3s/PWj70n7TrgdwNHQ8PhaOvq7aWxpYERmLpUt9b25vox/uzT7fZoUnRhWYtt1lcXc+eojbKzYjSnNpGdXYiJP680Px7yxDpU+y+HsziOd1EndwjCQkL0N+wQ7tdTiaP1KjJccNHKHfn8qkVBJbq7Yw93LHmFtWWJNg6oo3S7N9q9sb+oD5c21fSO8adQ0NtDR38O+e154z9r4nhGA1poG/ueyTxF5dj3bK0o4d+IMartaOjKc3vtcwvaATYpeAejSZFXZDu5c/jCbyosxT1VMwVOKk7d0h1xMhqFxOVLsgfcMg9R07yck1KCmlGw9WMpdyx5hZen2eFJbUBXR53I6H0z3p9/b0Nbadua46Wzbv5fAsnV857pbCPcF3qGGE9jW96ymOB7c+jq3zL0IcfM85o46g20H3mJM/oTCjlDvd4LotxnC9EjLC4qLz5jHHZffysKx0+PWcEOvAx9iKI73enQ6sMrvVxymZInLMkxpsrWqlDuXPcKy4k1E9JhlnyFE0GW3P5yZmnZn9Yb1VVOXXMSezVtYt/R1avZX86mZxx7Z9922/z3HDX/9MdNHFvLju7/PmRdcwZYVSxk976xxHaH+70b06CcN0/RY9vUaF0+Zx3cv+RSLxs8cRAROcznA+wgfEtQTiyTbX7mHu5c/yvKSLYSNWFzXL0N2VXsi1Zvyu6a9u8rOuugqNr7wKHf89I/sOlDCa1//83vf3ve8xjg+88Cv6QtHeGHTq8weM5XNb60gp2jKhEA48J2woX/KVHBJBew2lQsnzOY7F3+ScybNTnqGDRfDOt1OqFDs2LbUsW7A4UjlBx5mWP36kAM4MbAEfiYby3dz97JHeL10G2HDMh1XBGGXZnvS63Df2bx5VensK2+kvLqO8+fPJys1k/s/fnIs/d6xzaek1jiu/rPlPtzc2YKqOag4uJfsjLyJ/bHot2PC+ISB9EgpsSmCxWOn861LPsGSqWdi12yHEYHTaRGfqrYcVu+HBODYcAx61sPtqwS6YXn2/b/lj7F63w4iprX5VSHCDpvtyTR3yl0Nf3p5b9Ed11HdXMPsiTPI9KXw2lf+dBI6MzyccvnKvF98lkggQE13K9kuD+W715J1xoLxYT36jbAeu8UwdK9EoqoKZxZN5usXfYwrZi7GZXcOMRb6cBG/ewzR03Nyx/OYOJnTEEkVZLwLET3KayWb+dOrT7K+vJiYaSCQKIiQy2Z/Is3jvbv+0VdKZ375k+wq3cmiOYsIGDq7fvTAKezFaUAAAKbe8TFiQqW+uYb09DzqyvaSN2bsmGAo9NVQLHy7LsxUqYCqCGaMGMOXz7ue6+ZdSKrL++45gZOiE08YBIljt955B5xuhO50a897DSEEwWiY57e/yV9WPMX2g2Xophk/+el3qLZHfS7Pn5r+unz/GT+8idKaMs6cPAtNEWz44b9OdfNPDwIAMP77n8CjmBQ3NjApO5vSA9sYUzhrVFew94sBI/o5XTEzwTL2GJ81gs+cfQW3nH0F2b7008ON+Gh4m4CQb4d32lhvZxxzGo/G6YlhX5WGjrkQgu5gH09sfo2/rXqevY3VlnuzBE2Ibqfd/h+v0/XXpk2rK+defiO76yo4e8J0grEYW350/8nrzzHgtCEAADN/eBNOl59dFTsZXzCRkuLNjB13Rl57sOf2sBn7ckwaBUiJlCYj07L45MKP8PnzrqEwK/+E+g4cLwa7mJ6U8vlwc58uEELQ2N3Gg2tf5t/rXqayrdH6HNCE2uZ2OO7zeb3/rN21o/aM+WfT299DbnoOKR4nq7/391Pb+EE4rQgAwJm//DIjU728UbKTOYVjeLN0J6MzczO6w4GPB/Xo12OmPi5hnJLlTeXqWYv54vnXMXP0xGQ0mXeFOMsu4uz7cZd2FNb/pG/id3nl+G9VsQ53XhJyi9KGKv6x+nme2baaxp4OIB7FF6XW4XD8LTst/cHyA8XN02edSVVdHVPGjkWPmmz/2X9OYi+OHacdAQC45o/fIcefxcqSLRRmFbChfDeF/hxfU1/nVWE9+q2oNGZJYXECXpuTcyfM5IsXXMeSqQtwaPFAnafpteCkEoATLG847XAS+zeceRHCiuG3sWw3f1v5LK/t2UJ3KIBQBIoAO+oej+a4JzXF92xVU23nRbMX8lblPj4yZyFVrY289cN/n5S2vxuctqvllvt+QabDzdM71zA9exTrq/ZQmJ3vauzuuDCoR78ZMWPnmZiKaZjYFYWZo8fzuXOu5rp5F+L3pA7yMjtNVHLvY/y3cgWDIYSgPxxk6c51/HPNi2w5WEooEkFIUATSYbdv8NidfxyZnvPavvqDgXNnLaC8upxLF11Aa0crT33+16e6C0fEe+YLcKx46As/oaTpILV/WkpxUzX/+vKvaOrpDM0ZPem1FIfrRy7N9piKCCoIYtJkW20Zd776CHcvf5iKlrqBsE+Dynwvg48e6pU28MX7fyOJ5J8PPhIZi+s6W7jn9Sf59dL/sL68hJAeQ6gKmhBRt2J70Wd3/XjqqDEvN7W3Br720Zsor63izm//iO5A/2m7+eE05gASuHPZI3zvnjs4Y/oiSu98iqJvXM3OX90npvzw9gn94fCnw3rs1pgwcxKx+LI8Pi6eeiafO++jnDVuOjZ1qNHQe3aavZ1k+YPOqp9AnExO6p2sMBOuvFsPlvKvtS+xbPcmmro7LP9IRaBpapcL7dEUzf6va2edU/Lc3o1m3Z9eZsr/3kTpb57k5od/xcM3/+gktf7E4H2xCm+59xc8sXk500aOZdfBMiaOKKT0reUUTj8/ty8SvCZoRL8S1fUzzHgobbfDwexR47l54aVcO/d8MlP8J0YmMNhS5r8V77NYAofiUE3N0QiMEIKeUD8v7VzLA2tfZkvNAQLRsLX5dRO7olW53M770pzeJw7+4YXaSd++lv1vvc6Usy5lb205d3/6Dr5z0cffq24dN943U/lm1Q6+eO+v8XtTqG5rpiAtg20Hy5g2osjb1Nt9QTgc/nLY1C8wVWxSShQBo/3ZXDVrMbcuvoLpI8YnnYk+xIdIQCCQggHX4ziBKG+u5aFNy3lm22oqWhowTAOhKqiqYjqkstEt7P+XkZr22v4De7rmTZtHWXMt00eNp6Kpll999ut8Zu7lp7Zjw8T7hgAkMP8nNzMiq4CdlXtYMH4GK/dsYVL6aFtFe920gBG7PSz1j+uGnmHGA0WkuT0sHDuFWxddwaXTz8Ln8gKnr5bgQ7y3SFwJrZBogkAkxMr9W3lw7SusrSimI9gLpgRDYlOUPqfL+ZzH7vhnYVrOtpL6qsi50+awv7KSmRMmU9NQz7bfvjeRfE4UTlsh4NHw1i8eJqrrHPzTy+yqLqP13hUc7GmNNd73+o40d8rvvTbHzxxC3aNgZevpiYRYVbaTX7xyP7995QGK68ow4llsTiecXq35L8IgYXF5Sx13L3+EHz/3T5bt2UJ7fw/xeP04bbaKFJvrN36H5xc/u+2LG2tbWyKPfO1X1LU087Nb/wcT+b7b/PA+Xnef/vdv+ffyJ5k/YRrbaiuYkTOSnRUlTB07JaWtv+eskBH7fFjqH9EV6bbekPhdHuaMGM/Hz7yEK2YuJtPnPy0sCE8mjuZ0c1KEaydQPnC4Z+O7NHA6ipWmEIK+cJAVpW/x8MblrC8rpj3Qa30nJaqqRJ12xwq3av9HusO7dt/eNV1T5y1hz4aNLLzgIjY9/xTf/9/f87trvnTcbTuVeN8SAIBfPfsPHln7ClNGT2Bn5V6mj5/K2r3bWFR4hrar6eDYgBG+IWTot0WlMdZKUGFiE4KRaVlcMnU+nzz7cuYVTTmie/HRcNwb51QJEI9mkXikDXEKBXyHR9Y5fgL1du8Ojj6sGzrF9RU8ufkNXt67mcq2RiLRKALLnt8ulEaXzfGox+15ZHLe6H2b9u6KLTpjJqWtNcwcNZ6Ship+du1nuW3BFcfZ0lOP9zUBSOCqP3yHF795F7P/92Z2/uYRxn3tKipeWcqEaz7q7wmFFgf12GfD0cgSXRou68iXpLhcTBk5hmtmnce1c86nKGsEymES4pOjMvwgGQm9GxxVAn+Uz4+/nqH3fID6rlaW7lrL01tWsruugu5IKOndq0piDkVb59bs96c6PSvK//hC69hvX0PF3c8x+8ef4rpzL2F9yTZe/dY9J7CVpwYfCAIA8LOn/sEvn7+PC6cuYFvVXs4YOZbtdfs5s+AMW2V307hgKHh9UI/eHJPGeCOeH1JRBFluH/MLJ3PjmRdxydQFZKZ88K8F/w0YHCZ98MbvCvayqnQbT29bxYbKvTR3t6MbVpp6RRE4FLXaqdkf99jsT+WmZuzbeqA4MveMWeytKWfBpJms3vAqX7rpS9z7ie+cus6dQHxgCEAC8390GxdMmcUrOzfxwld/xYV3fZPqe15i0jeu8feEg2cGjcgtYRm7VBekmVIiDROHpjEiM5vzxs/k+tkXcNb4Gfjc3g8JwdvhfWIPkGD5Q9EIWw+W8uRbK1ixdyt13W2E9RggEaZEQwk4bfbXPXbnf3xO18b9dz3bPuIrl3Lj4st4Zcc6zj5jFlvK9/KvL/yQhaOmnOpunTC8D6bw2PG1h+/knqceYMnCc1m/v5h5RRPZUrGXCyfP1/a1VY8IxMIXh3T91ogem2+YpiYVEKrAZbNT5Mvmgslzuf7MC5lTOBm3wwUMZLA5rfEuQlqdDjiWNg1+NvFzMkrPoP/CsSjFdeU8v+NNXi/dSnlLA/3hYHyoBJoQpl0ou92a/WGPw/VyYUZe9drKXbF5YyazZddWzpt3Dm/+8O/c/K9f8PBnf3LC+nq64ANJABKY9YOPc9H0Rby+az0vf/9ezv/p7ZTvWMf0sy5wdwWDk4LR8LUhPXJjTJHjDSGQhoEwJV6Xi3F5I1kycTZXzTyHmaMn4UkSgtNt23xwcLxEaQgxiBPAcCxKaUMVS3et49XizRxoqaM3EsLEtBx4pMCuqLUuu+M5t83+VJrTvWfPH5/uK/ryVfzoilv446qnWDxpFmtKt/PQV3/D3BETTlAvTy98oAkAwNcf/iN/fuzvXH3h5Ww+UMy88RPZXLWXf1z2DfGDVf/xB/TwrKCp3xiMxa6KxaK5JhJUS/ebojkpSs9hydR5XD37PGaMnIDX6U5G/LLwIUE4mTjSSX/E5xLZd2MR9tRX8tKOtbyxbytlbY30BPsxdMPS6QuBTYhOp2p/3WN3PuZ1ujdfOefsjn+teM6cO+4M3irby+LJM1n2+jN88ZNf5e+3//A96OWpw0lLD3664M83fxOAwNnnsud3j3L1Pd+lffub/Co1T5Y113dePfesN/c01e91KKHXgqa8KSKNC2KKkiGlSXcoSHHDQaq6m3lj/zbOKZrGZTMWM2/sFNK9qcAH3zXgdLoqHM1mH6AvHGR3XTmv7N7Iyn3bKG+upy8SxMCKz6cANin6HJptg9vufMxtc6wZlZ7T9Gbx5tgKh52e+9fS99NCfnv7N3h09UvsfngDM/JOXlru0wUfeA5gMH6/9CH+9MrDXDX3fNbt285L3/8DV9z5DfZVlXDW5LNszb0deUFTPzskjZvC0cg5ekxPlapAKqAIcCs2CvxZnDl2CpdNP4uzxs0gLy3zmHMVfIjjhxh0xzelpL2vi63V+1hWvIH1ZSXUdLXSHwlhGAZIK+u0pigBp1A2uRT70x6na3W6N7V222tPRMacfRm3XHgVj615hQUTp/PCW2/ylcs+xm/ep0Y9x4P/KgKQwLcf+zP/74X7uPHsq9hSvptzJ8/nzdJt1K56hbnX3ezoDAUKgqHguaFI+LqIYp4dQ6aahgGmRKgCp81OlsfHtPwxXDBpDudNnsuEvNHHLic4DSTpp8sJP9yIPGDd76vbG1h7YBcr9m5lZ30Fzb2dBKMRTNNKuy0ATYo+p6ptcTmcz7k1+8o0u7tu551PhHK+dDELJ0xn9Z5tnD9jPi/8+k4+f/fv+detP8A0/7tyUf5XEoAErvrTd1n6jbu46HdfYeOB3VwweRbbag7Q9H+vMfcHn3R0B/vzA1JfHIxFro1Ew2fHpJkhFZHct5qi4HM4KfTncNb46Vw05UxmF04m25eOpqrA8QoNT5dteeqRzLVnmrT3d1NcV86K0q2sryimorWB7mCAmGlY6loJiiHRVLXbabNvdKm259yaY02K292w6zePhbI+cwGziibxxpY3OH/hEn504xf53bP/5Icf+wLnF00/1V09JfivJgAAd7/2GC9ueoO/3Px9vvnY3azetZ6Lz7yIXZWltN63grk/utXRHerNCYaC80NG7MqINC6ISrPAlFJIaSKliSosriDb52dqXhFnT5zJ4vEzmZg7mjR3Copi+VyddHPjd4FTSXKOFG4brPHqCfVT3lLHhvLdrDuwi5LGKpr7ugnFIhiGCRKEEmf1TdHkFNo6t9P5osfp2pTicDfu+PUjkfQvXMDUUeNY++ITLL70Bq4/5yM8sPwZ7vzC97l4/KxT1OvTA//1BCCBR7ev5J6XH+OGsy9h6eZVrN38GpctvILtDeW0PPAqZ379k7buSDA9aMSmBfXoZeFY5OKooY83pGmXgqRXmaaoeG0O8lIzmDZyLGePm8H8oimMyR5BqsuLpsQ5g/f5CX/8KrsBC73DPo+f9L3hAAfbGtl6sJQN5cXsqi2jvruN/mgEXRoDWgETVETUrtkqnZpthUuxLXeptl1+t7fjrd88Es38/BJmjBrHyhXPsOC8Kzl36lyW7VjHLUs+yncvuOld9f+Dgg8JwCFYVryZnz7yF2698Bqe37KClTvf5IoFF7Ozej8Ne9dz3oWfUluDPSnBSHBsMBI+LxyLXRoRxkxdygwz7mcAEkVRsNk0vHYneV4/E3NGM2/MGcwfcwYTcwtJ96biUDUSWykejoJhbavEHWS4MoS4fdB7QnIObVPyd6vBR7LLj+oxuoN9VLTWsfXgPrZWlrKn8SCNPR30RUNEYzGkaVpFCIGiKGhC6baj7nZp9mVuh3OV2+GsTHd6e9c/cb+Rd/7FzCycwPJlT7H4gqv4yNzFPLryJb5946f5zILL3otReN/gQwJwFDz41uvcv+wJrl18Ka9sWcWmA7u56cxLWFO2k/L6Mj6x6HKxt7HWGYxFc4JmdFY4Fr4oHIstjklzjCGkW4qBtS8ATVVxO5xken2MTc9nZsE45hROYmJ+ESPSs/E63NhUDcSpNzZ6p1h5x1XmIAtF3TAIREI0drdxoKmandUH2FlXTnlrPS293QSjYWKGgYmMc1YgJKhSRGxCPei029e7bI43XJp9u8vmaDoja0ToyQ1L5ZhRk5g7ZgrPbV3BuWfM4YJZC3ll0ypuvuRavrTo6hPYmw8OPiQA74C/rHyG1Ts28ex37uaGP3yPLVV7+d5Vt/Kv1c+zr7GKyINbWPCT27T+SMAbikRHhfTovJCpXxA19DNjpj7CRDpkQiydXMhgV1V8Lg+5/gzGZY1gSm4RUwrGMDZnBPlpWaS6vNhUzZIfnEY+CUMNc8SQFXRorD2EwJQmumHQFwnS2tNJVXsDe+oqKa6voKy5lqbOdnoiQSKGgSHNgV5KEKZEESJmU9UGh6Ztdyq2NU7VvtHtclZ5HO6+dV/8g+79weVMyS/iE+dcxp9eeoQ5Y8/gx9d9gf99/B4+ee4V3L7owxP/7fAhATgGfO7fv+Wfn/4Bt/7j5+yo3EvJ75/iol//D6VNVTRU7+VT531C7Ouo04JGLDUci4wNRsMLImZscVSaM3Vp5puG6TIHp99VLMs0TQhsQsHjcJHlTaMwO4/xWSMZnzmCoux8CtKzyfCm4XN5cGh2lHjmIhHn608WcTiUk4eBOAKDT3QZz6AkpUlU1+kLB+kM9NDU3U5VWyPlTbWUtdZR095MS28nveEAEUO3NryUA4RDgoJA1dSwJtQmG0qJU9HWOx3ODW6Ho8Kp2ntGpmREl655WuaNm8nE3JG8+eN/MPV7H2POhCk8+Nmf8JkHf8v9t/7gpIzHBxEfEoDjwL1vPM+flj/IjWdexsbynWyr3sdXllzPq7s2UdFWT8+ONVxyw5dFW6DbFtZjqeFYrDAYjcyJ6LEFUVOfpUtzlCFkijSlKuMyAwCEsLLMKAo2BHah4nW6yPD4yPVnMiojh9H+XEb4c8j3Z5Ht85PmTsHjcOK0ObBrNlRFjevBxRGdg44UFTf5U5L3H0RSEj/HizNMg6iuE45FCEbD9IYCtPf30NjdTkNnCzWdTdS0N9PU2U57sJfeSJBINEZMmhhmfMObptUsRaBYbTJVSZ+KUmcXaonT4djotDu3OTX7Qbdm6/a7U2Mrf3+v6bz2LMZnj+C8KXO5f+1LzC2axMKJM3h28wq+dvkn+dqSG07KfH+Q8SEBeBf429LHWVtTzONf+Q233vcz9lRXsOPATm6++AZ2HNxHeUsN0ae38JEffFm0h3q1kKF7wrFwXkSPTo7osdnRWGxWVJrjTSlzTSE9puWjYp3opkwK70ScMKhCwSYVbKqG2+Ek1ekm3Z1Chi+VDF8amd40Mtw+Ut1efC4vHocTl92Jx+HCaXNgU1U0RUVVVRQxNBykKSWGoaMbBjFTJxiNEIyECUfDBGIRekMBegJ9dAb7aO/rpr2ni86+HrrDAXqiIQLRMNFYlJipo0sT05QDHpSJK5AEISVCSlM1RVBVlTabolbYNW2XQ7O95dDs+5yavcllc/Sle1L1N370N6ncNIfxBYXMHXMGj97/e6acfzXTiybw2P/8ihv+/H3uuPFzzMsfdyqm/wOBDwnACcIvnv83b1Xt4XMX38Aja5ayt7aC0juf5sY//4DS+koqOxoJbV/PdZ/4umgK9iihaMQWjkRTw3o0P2rqk8LSmK7rsakxaYzTTTNHmtJjKtjkIF5bmnHCQIIoDBAIJS4dVyVoUqCpGqpNw6bG/9o0NEVFEyqaUFCEOnDgCzCx7uq6bhGBqKETM3R008AwTXTTtL6TJqaUmNJEJpyiBmsYEoXGLfKQQqoQE4oS0BSl1YZapQmxx4Fa7LDZ9zts9ganzd7jdNgjOZ5U88U7/yJtly9gXM5IJhUU8vw372LCt65lZtFELpt/Lv9Y9iQfO+9yvn7+9e/NxH7A8SEBOAm4f8urvLh+BWdNmcWW0l2UN9WwZ+9mvvix/2F7WQk1nU20djTAU/u56KdfEP1ElZAZs8UikZRQLJwbicYKY4Y+PibkBEPKIkPKAl2amaZupEgp7VJBlcKiDFLB2n2mJJE12eIeBKgDWY6T6ghTDr7QH954c+A6kmD7B56VkLCUjavkRFzVIUAqEgMhoooi+lUpOjWhNKiKUmFDLbPbtHK73VbtsrlaHIrW51S0qFuxmW/84p9SXDuWrOzRjMrIZ1rRRP7z558w6SPXMz5vNGdOmsbqXW/x0bMv5KvnXndyJuy/GB8SgJOMXy59gJ01B/jU+Vfx4qYVlFaXU9VWx3Nfuou7lz9CVXsDjb3tdLXWIF+sYskvP0NUlyIcjapR03Topu6JGLH0iB7L02OxUbo0C2OKHGlg5kvDzDYhzRTSaxiGUxqmHYmKRAGpSFURUhUgpZDmIHlA4ui2LuDJ3wUDgU+EEKAo1gGvSyks5b2JQEeImCpERBFKv4roEqpoUxWlyYZaqwq1WlPVWruiNjs0W4dDtfXZFS3idNoNm6LIFT/+J+LiXHy54yjIyGZ0VgGXTT+b7z/7Jybnj2XiyDFcPPss7n3lKa6efy4/vOK2UzNx/yX4kAC8x/jBE3/lt/feyR2f/w57ayqobm+koq2eJ+74fzy44jkqm2pp6e6gpbcTou0wcQyUN/K3z/2Klbu2KF3RgNoXDTnC0YjHiOmpwWgkHUVkh6KRbGHIPMMwMw3TTBeakhUTps8Q0qsIkSIlLlNKhzSlhmGqmNKSFCrCuqybEhRFCk2NCUFEgbAJfUJRgnah9Iqo2S4QbZqmthnSbHY5HB0C0ex22DsUVen2OD0Bt8MVSXf59EVnzDK//evPwYL5sL8M3FnkpGWQk5rOmNxR3LjoUj7x+29zxsixjMrKZ0J+IX++7dvc9Mcf8uS3fnuqp+i/Cv8fcTFNZfiJGBgAAAAASUVORK5CYII=" style="height:40px;width:auto;vertical-align:middle;margin-right:10px;" alt="Logo">
    <strong style="font-size:15px;vertical-align:middle;">{safe_name.rsplit('.',1)[0]}</strong>
    <span style="font-size:11px;color:#666;margin-left:10px;vertical-align:middle;">Printed: {datetime.now().strftime('%Y-%m-%d %H:%M')}</span>
  </div>
  {body_html}
  <script>window.onload = function(){{ window.print(); }};</script>
</body>
</html>"""
        return Response(html, mimetype='text/html')

    # ── PowerPoint: serve as download ────────────────────────────────
    if ext in ('pptx', 'ppt', 'pps'):
        return send_file(filepath, as_attachment=False)

    # ── Excel / CSV: convert to printable HTML table ─────────────────
    if ext in ('xlsx', 'xlsm', 'xls', 'csv'):
        try:
            wb = openpyxl.load_workbook(filepath, data_only=True)
        except Exception as e:
            return f'Could not open file: {e}', 500

        sheets_html = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            rows_data = list(ws.iter_rows(values_only=True))
            if not rows_data:
                continue

            table = f'<h2 class="sheet-title">{sheet_name}</h2><table>'
            for ri, row in enumerate(rows_data):
                if all(c is None or str(c).strip() == '' for c in row):
                    continue
                tag = 'th' if ri == 0 else 'td'
                cells = ''.join(
                    f'<{tag}>{("" if (c is None or str(c).strip() == "") else str(c))}</{tag}>'
                    for c in row
                )
                table += f'<tr>{cells}</tr>'
            table += '</table>'
            sheets_html.append(table)

        wb.close()

        html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{safe_name}</title>
  <style>
    * {{ margin:0; padding:0; box-sizing:border-box; }}
    body {{ font-family: Arial, sans-serif; font-size: 11px; padding: 16px; background:#fff; color:#000; }}
    .sheet-title {{ font-size:14px; font-weight:700; margin: 18px 0 6px; color:#1a3a5c; border-bottom:2px solid #1a3a5c; padding-bottom:4px; }}
    table {{ border-collapse: collapse; width:100%; margin-bottom: 24px; page-break-inside: avoid; }}
    th, td {{ border: 1px solid #bbb; padding: 5px 8px; text-align: center; white-space: nowrap; }}
    th {{ background: #1a3a5c; color: #fff; font-size:11px; }}
    tr:nth-child(even) td {{ background: #f5f7fa; }}
    @media print {{
      body {{ padding:8px; }}
      .sheet-title {{ margin-top:10px; }}
      @page {{ margin: 1cm; size: landscape; }}
    }}
  </style>
</head>
<body>
  <div style="text-align:center;margin-bottom:14px;">
    <strong style="font-size:15px;">{safe_name.rsplit('.',1)[0]}</strong>
    <span style="font-size:11px;color:#666;margin-left:10px;">Printed: {datetime.now().strftime('%Y-%m-%d %H:%M')}</span>
  </div>
  {''.join(sheets_html)}
  <script>window.onload = function(){{ window.print(); }};</script>
</body>
</html>"""
        return Response(html, mimetype='text/html')

    return 'Unsupported file type', 400

# ══════════════════════════════════════════════════════════════════
#  VISIT COUNTER (file-based)
# ══════════════════════════════════════════════════════════════════
_COUNTER_FILE = os.path.join(os.path.dirname(__file__), 'visit_counter.json')
_counter_lock = threading.Lock()

def _load_counter():
    try:
        with open(_COUNTER_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {'total': 0, 'today': 0, 'date': ''}

def _save_counter(data):
    with open(_COUNTER_FILE, 'w') as f:
        json.dump(data, f)

@app.route('/api/track_visit', methods=['POST'])
def api_track_visit():
    today = datetime.now().strftime('%Y-%m-%d')
    with _counter_lock:
        data = _load_counter()
        if data.get('date') != today:
            data['today'] = 0
            data['date']  = today
        data['total'] = data.get('total', 0) + 1
        data['today'] = data.get('today', 0) + 1
        _save_counter(data)
    return jsonify({'ok': True})

@app.route('/api/stats')
def api_stats():
    today = datetime.now().strftime('%Y-%m-%d')
    with _counter_lock:
        data = _load_counter()
    if data.get('date') != today:
        data['today'] = 0
    return jsonify({
        'total': data.get('total', 0),
        'today': data.get('today', 0),
    })

# ══════════════════════════════════════════════════════════════════
#  AI CHAT PROXY
# ══════════════════════════════════════════════════════════════════
@app.route('/api/ai-chat', methods=['POST'])
def ai_chat():
    data = request.get_json(silent=True) or {}
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        return jsonify({'error': 'AI not configured'}), 503

    # Convert Anthropic-style messages to OpenAI-compatible format for Groq
    messages = data.get('messages', [])
    system_prompt = data.get('system', '')

    groq_messages = []
    if system_prompt:
        groq_messages.append({'role': 'system', 'content': system_prompt})
    groq_messages.extend(messages)

    groq_payload = {
        'model': 'llama-3.1-8b-instant',  # Free Groq model
        'max_tokens': data.get('max_tokens', 1000),
        'messages': groq_messages,
    }

    try:
        res = _requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json=groq_payload,
            timeout=30
        )
        groq_data = res.json()
        # Convert Groq response to Anthropic-style format so the frontend works as-is
        if 'choices' in groq_data:
            reply_text = groq_data['choices'][0]['message']['content']
            anthropic_style = {
                'content': [{'type': 'text', 'text': reply_text}]
            }
            return jsonify(anthropic_style), 200
        return jsonify(groq_data), res.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ══════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    try:
        from flaskwebgui import FlaskUI
        ui = FlaskUI(
            app=app,
            server='flask',
            width=1280,
            height=800,
            port=3049,
            fullscreen=False,
        )
        ui.run()
    except ImportError:
        import webbrowser, threading, time
        def _open():
            time.sleep(1.2)
            webbrowser.open('http://127.0.0.1:3049')
        threading.Thread(target=_open, daemon=True).start()
        app.run(host='127.0.0.1', port=3049, debug=False)