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
#  REPORTS — list & serve Excel files from /reports folder
# ══════════════════════════════════════════════════════════════════
REPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports')

@app.route('/api/reports')
@zone_required
def api_reports():
    """Return a list of Excel files inside the reports/ folder."""
    if not os.path.isdir(REPORTS_DIR):
        return jsonify({'files': []})
    files = [
        f for f in sorted(os.listdir(REPORTS_DIR))
        if f.lower().endswith(('.xlsx', '.xlsm', '.xls'))
    ]
    return jsonify({'files': files})

@app.route('/reports/print/<path:filename>')
@zone_required
def print_report(filename):
    """Convert an Excel report to a printable HTML page."""
    safe_name = os.path.basename(filename)
    filepath  = os.path.join(REPORTS_DIR, safe_name)
    if not os.path.isfile(filepath):
        return 'File not found', 404

    try:
        wb = openpyxl.load_workbook(filepath, data_only=True)
    except Exception as e:
        return f'Could not open file: {e}', 500

    # Build one HTML table per sheet
    sheets_html = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows_data = list(ws.iter_rows(values_only=True))
        if not rows_data:
            continue

        # Find actual used columns range
        max_col = max(
            (sum(1 for c in row if c is not None and str(c).strip() != '') for row in rows_data),
            default=1
        )

        table = f'<h2 class="sheet-title">{sheet_name}</h2><table>'
        for ri, row in enumerate(rows_data):
            # Skip completely empty rows
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

    from flask import Response
    return Response(html, mimetype='text/html')

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