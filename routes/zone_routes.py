import os
import re
import secrets
import threading
import time as _time
from datetime import datetime
from flask import Blueprint, render_template, jsonify, request, session, redirect, url_for, send_from_directory
from core import DATA_STORE_DIR
from core import (
    _get_ip,
    _normalize_username,
    _record_failed_attempt,
    _is_locked_out,
    _lockout_remaining,
    _clear_attempts,
    _record_login,
    _is_single_login_exempt,
    _clear_active_session,
    _approved_db_user,
    _verify_secret,
    _hash_secret,
    _db_connect,
    _read_login_log,
    _log_lock,
    ENV_USERS,
    ZONES,
    ZONE_PASSWORDS,
    SUPER_ZONES,
    EDIT_ZONES,
    ZONE_USER_RESTRICTIONS,
    ZONE_ALLOWED_USERS,
    VERIFIED_USERS,
    EDIT_PASSWORD,
    login_required,
    zone_required,
)

zone_bp = Blueprint('zones', __name__)

_zones_presence = {}
_zones_presence_lock = threading.Lock()
_ZONES_PRESENCE_TTL = 30


@zone_bp.route('/zones')
@login_required
def zones_page():
    if session.get('zone'):
        return redirect(url_for('pages.index'))
    return render_template('zones.html', username=session.get('username', ''), zones=ZONES)


@zone_bp.route('/zone3-qr')
@zone_required
def zone3_qr():
    return send_from_directory('static', 'zone3_qr.html')


@zone_bp.route('/api/zone_login', methods=['POST'])
@login_required
def api_zone_login():
    ip = _get_ip()
    data = request.get_json(silent=True) or {}
    zone_id = data.get('zone_id', '').strip()
    password = data.get('password', '').strip()

    zone = next((z for z in ZONES if z['id'] == zone_id), None)
    if not zone:
        return jsonify({'success': False, 'message': 'زون غير معروف'}), 400

    expected = ZONE_PASSWORDS.get(zone_id)
    correct = (expected and password == expected)

    if not correct and _is_locked_out(ip):
        remaining = _lockout_remaining(ip)
        mins = remaining // 60
        secs = remaining % 60
        return jsonify({'success': False, 'locked': True, 'remaining': remaining,
                        'message': f'تم تجاوز عدد المحاولات. انتظر {mins}:{secs:02d}'}), 429

    if not correct:
        _record_failed_attempt(ip)
        return jsonify({'success': False, 'message': 'Incorrect password'}), 401

    restricted_username = ZONE_USER_RESTRICTIONS.get(zone_id)
    current_username = str(session.get('username', '')).strip().lower()
    allowed_usernames = []
    if restricted_username:
        allowed_usernames.append(restricted_username.lower())
        if zone_id == 'admin':
            dev_user = ZONE_USER_RESTRICTIONS.get('dev')
            if dev_user:
                allowed_usernames.append(dev_user.lower())
    if restricted_username and current_username not in allowed_usernames:
        _record_failed_attempt(ip)
        return jsonify({'success': False, 'not_allowed': True, 'message': 'Access Denied'}), 403

    allowed_list = ZONE_ALLOWED_USERS.get(zone_id)
    if allowed_list and current_username not in [u.lower() for u in allowed_list]:
        _record_failed_attempt(ip)
        return jsonify({'success': False, 'not_allowed': True, 'message': 'Access Denied'}), 403

    # Dynamic per-user zone restrictions (set by dev via admin panel)
    try:
        import json as _json
        _uzf = os.path.join(DATA_STORE_DIR, 'user_zones.json')
        if os.path.exists(_uzf):
            with open(_uzf, 'r', encoding='utf-8') as _f:
                _user_zones = _json.load(_f)
            _allowed = _user_zones.get(current_username)
            if _allowed is not None and zone_id not in _allowed:
                _record_failed_attempt(ip)
                return jsonify({'success': False, 'not_allowed': True, 'message': 'Access Denied'}), 403
    except Exception:
        pass

    _clear_attempts(ip)
    session['zone'] = zone_id
    session['zone_name'] = zone['name']
    session['zone_label'] = zone['label']
    session['can_edit'] = zone_id in EDIT_ZONES
    session['is_super'] = zone_id in SUPER_ZONES
    session['login_time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    if zone_id == 'qc':
        role = str(data.get('qc_role', '')).strip()
        session['qc_role'] = role if role in {'qc', 'labeling'} else 'qc'
    threading.Thread(target=_record_login, args=(session.get('username', ''), zone_id, zone['label'], ip), daemon=True).start()
    next_url = session.pop('next_after_zone', '/index')
    if zone_id == 'qc':
        next_url = '/qc-workflow'
    return jsonify({'success': True, 'redirect': next_url})


@zone_bp.route('/api/zone_access_check', methods=['POST'])
@login_required
def api_zone_access_check():
    data = request.get_json(silent=True) or {}
    zone_id = data.get('zone_id', '').strip()
    current_username = str(session.get('username', '')).strip().lower()

    restricted_username = ZONE_USER_RESTRICTIONS.get(zone_id)
    allowed_usernames = []
    if restricted_username:
        allowed_usernames.append(restricted_username.lower())
        if zone_id == 'admin':
            dev_user = ZONE_USER_RESTRICTIONS.get('dev')
            if dev_user:
                allowed_usernames.append(dev_user.lower())
    if restricted_username and current_username not in allowed_usernames:
        return jsonify({'allowed': False}), 200

    allowed_list = ZONE_ALLOWED_USERS.get(zone_id)
    if allowed_list and current_username not in [u.lower() for u in allowed_list]:
        return jsonify({'allowed': False}), 200

    return jsonify({'allowed': True}), 200


@zone_bp.route('/api/switch_zone', methods=['POST'])
@zone_required
def api_switch_zone():
    if not session.get('is_super'):
        return jsonify({'success': False, 'message': 'غير مصرح'}), 403
    data = request.get_json(silent=True) or {}
    zone_id = data.get('zone_id', '').strip()
    if zone_id not in ('zone1', 'zone2', 'zone3', 'zone4', 'zone5', 'qc'):
        return jsonify({'success': False, 'message': 'زون غير صحيح'}), 400
    zone = next((z for z in ZONES if z['id'] == zone_id), None)
    session['active_view_zone'] = zone_id
    session['active_view_zone_name'] = zone['name'] if zone else zone_id
    return jsonify({'success': True})


@zone_bp.route('/api/force_logout_other', methods=['POST'])
def force_logout_other():
    ip = _get_ip()
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    username_key = _normalize_username(username)
    env_password = ENV_USERS.get(username_key)
    db_user = _approved_db_user(username)
    correct = (
        (env_password is not None and env_password == password)
        or (db_user is not None and _verify_secret(password, db_user['password_hash']))
    )
    if not correct:
        return jsonify({'success': False, 'message': 'بيانات الدخول غير صحيحة'}), 401

    login_username = db_user['username'] if db_user is not None else username
    _clear_active_session(login_username)
    return jsonify({'success': True, 'message': 'تم تسجيل الخروج من الجهاز الآخر'})


_AVATAR_DIR = os.path.join(DATA_STORE_DIR, 'avatars')


def _avatar_url(username):
    for ext in ('jpg', 'jpeg', 'png', 'webp'):
        if os.path.isfile(os.path.join(_AVATAR_DIR, f'{username}.{ext}')):
            return f'/api/avatar/{username}'
    return None


@zone_bp.route('/api/avatar/<username>')
def api_serve_avatar(username):
    for ext in ('jpg', 'jpeg', 'png', 'webp'):
        path = os.path.join(_AVATAR_DIR, f'{username}.{ext}')
        if os.path.isfile(path):
            return send_from_directory(_AVATAR_DIR, f'{username}.{ext}')
    from flask import abort
    abort(404)


@zone_bp.route('/api/profile/avatar', methods=['POST'])
@zone_required
def api_profile_avatar():
    username = session.get('username', '')
    if not username:
        return jsonify({'success': False, 'message': 'غير مصرح'}), 403
    photo = request.files.get('avatar')
    if not photo:
        return jsonify({'success': False, 'message': 'لم يتم إرسال صورة'}), 400
    ext = os.path.splitext(photo.filename or '')[1].lower()
    if ext not in {'.jpg', '.jpeg', '.png', '.webp'}:
        ext = '.jpg'
    os.makedirs(_AVATAR_DIR, exist_ok=True)
    for old_ext in ('jpg', 'jpeg', 'png', 'webp'):
        old_path = os.path.join(_AVATAR_DIR, f'{username}.{old_ext}')
        try:
            if os.path.isfile(old_path):
                os.remove(old_path)
        except Exception:
            pass
    filename = f'{username}{ext}'
    photo.save(os.path.join(_AVATAR_DIR, filename))
    return jsonify({'success': True, 'avatar_url': f'/api/avatar/{username}?v={secrets.token_hex(4)}'})


@zone_bp.route('/api/profile')
@zone_required
def api_profile():
    username = session.get('username', '')
    zone_id = session.get('zone', '')
    active_view_zone = session.get('active_view_zone', zone_id)
    login_time = session.get('login_time', '')
    login_duration_seconds = None

    if login_time:
        try:
            login_dt = datetime.strptime(login_time, '%Y-%m-%d %H:%M:%S')
            login_duration_seconds = max(0, int((datetime.now() - login_dt).total_seconds()))
        except Exception:
            login_duration_seconds = None

    active_zone = next((z for z in ZONES if z['id'] == active_view_zone), None)
    allowed_zones = [z for z in ZONES if z['id'] not in SUPER_ZONES] if session.get('is_super') else [
        z for z in ZONES if z['id'] == zone_id
    ]

    with _log_lock:
        entries = _read_login_log()

    recent_logins = [
        e for e in reversed(entries)
        if str(e.get('username', '')).lower() == str(username).lower()
    ][:8]

    return jsonify({
        'username': username,
        'avatar_url': _avatar_url(username),
        'is_verified': str(username).lower() in VERIFIED_USERS,
        'zone': zone_id,
        'zone_name': session.get('zone_name', ''),
        'zone_label': session.get('zone_label', ''),
        'active_view_zone': active_view_zone,
        'active_view_zone_label': active_zone['label'] if active_zone else session.get('zone_label', ''),
        'is_super': bool(session.get('is_super', False)),
        'can_edit': bool(session.get('can_edit', False)),
        'login_time': login_time,
        'login_duration_seconds': login_duration_seconds,
        'permissions': {
            'can_edit': bool(session.get('can_edit', False)),
            'can_export': True,
            'can_print': True,
            'can_reports': True,
            'can_view_all_zones': bool(session.get('is_super', False)),
            'can_switch_zones': bool(session.get('is_super', False)),
        },
        'allowed_zones': allowed_zones,
        'recent_logins': recent_logins,
    })


@zone_bp.route('/api/verify_edit_password', methods=['POST'])
@zone_required
def verify_edit_password():
    if not session.get('can_edit'):
        return jsonify({'success': False, 'message': 'غير مصرح لهذا الزون'}), 403
    data = request.get_json(silent=True) or {}
    password = data.get('password', '')
    if EDIT_PASSWORD and password == EDIT_PASSWORD:
        return jsonify({'success': True})
    return jsonify({'success': False}), 401


@zone_bp.route('/api/profile/change-password', methods=['POST'])
@zone_required
def api_profile_change_password():
    data = request.get_json(silent=True) or {}
    current_password = str(data.get('current_password', '')).strip()
    new_password = str(data.get('new_password', '')).strip()
    confirm_password = str(data.get('confirm_password', '')).strip()

    if not current_password or not new_password or not confirm_password:
        return jsonify({'success': False, 'message': 'يرجى تعبئة جميع الحقول'}), 400
    if new_password != confirm_password:
        return jsonify({'success': False, 'message': 'كلمة المرور الجديدة وتأكيدها غير متطابقين'}), 400
    if not (re.search(r'[A-Za-z]', new_password) and re.search(r'\d', new_password)):
        return jsonify({'success': False, 'message': 'كلمة المرور يجب أن تحتوي على أحرف وأرقام'}), 400

    username = session.get('username', '')
    user = _approved_db_user(username)
    if user is None:
        return jsonify({'success': False, 'message': 'لا يمكن تغيير كلمة المرور لهذا الحساب'}), 403
    if not _verify_secret(current_password, user['password_hash']):
        return jsonify({'success': False, 'message': 'كلمة المرور الحالية غير صحيحة'}), 401

    new_hash = _hash_secret(new_password)
    with _db_connect() as conn:
        conn.execute('UPDATE users SET password_hash = ? WHERE lower(username) = lower(?)', (new_hash, username))

    return jsonify({'success': True, 'message': 'تم تغيير كلمة المرور بنجاح'})


@zone_bp.route('/api/zones/ping', methods=['POST'])
@login_required
def api_zones_ping():
    username = session.get('username', '')
    if username:
        with _zones_presence_lock:
            _zones_presence[username] = {'ts': _time.time()}
    return jsonify({'success': True})


@zone_bp.route('/api/zones/presence')
@login_required
def api_zones_presence():
    now = _time.time()
    with _zones_presence_lock:
        active = [u for u, d in _zones_presence.items() if now - d['ts'] < _ZONES_PRESENCE_TTL]
    return jsonify({'users': active})


@zone_bp.route('/api/zones/me')
@login_required
def api_zones_me():
    username = session.get('username', '')
    user = _approved_db_user(username)
    if user:
        return jsonify({
            'username': user.get('username', username),
            'full_name': user.get('full_name', ''),
            'job_title': user.get('job_title', ''),
            'email': user.get('email', ''),
            'phone': user.get('phone', ''),
            'gender': user.get('gender', ''),
        })
    return jsonify({'username': username, 'full_name': '', 'job_title': '', 'email': '', 'phone': '', 'gender': ''})


@zone_bp.route('/logout')
def logout():
    username = session.get('username', '')
    if username:
        _clear_active_session(username)
    session.clear()
    return redirect(url_for('pages.welcome'))


@zone_bp.route('/logout_zone')
@login_required
def logout_zone():
    session.pop('zone', None)
    session.pop('zone_name', None)
    session.pop('zone_label', None)
    session.pop('can_edit', None)
    session.pop('is_super', None)
    session.pop('active_view_zone', None)
    session.pop('active_view_zone_name', None)
    return redirect(url_for('zones.zones_page'))
