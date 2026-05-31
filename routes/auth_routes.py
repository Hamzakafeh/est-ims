import os
import re
import secrets
from datetime import datetime
from flask import Blueprint, render_template, jsonify, request, session, redirect, url_for
from core import (
    DATA_STORE_DIR,
    _get_ip,
    _normalize_username,
    _normalize_text,
    _hash_secret,
    _verify_secret,
    _username_exists_everywhere,
    _approved_db_user,
    _user_suspension_remaining,
    _db_connect,
    _record_failed_attempt,
    _is_locked_out,
    _lockout_remaining,
    _clear_attempts,
    _record_login,
    ENV_USERS,
    login_required,
    zone_required,
    _firebase_clear_user_status,
    _verify_recaptcha,
)

_AVATAR_DIR = os.path.join(DATA_STORE_DIR, 'avatars')

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['GET'])
def login_page():
    if session.get('logged_in'):
        if session.get('zone'):
            next_url = request.args.get('next', url_for('pages.index'))
            return redirect(next_url)
        return redirect(url_for('zones.zones_page'))
    return render_template('login.html')


@auth_bp.route('/register')
def register_page():
    if session.get('logged_in'):
        return redirect(url_for('pages.index') if session.get('zone') else url_for('zones.zones_page'))
    return render_template('register.html', recaptcha_site_key=os.getenv('RECAPTCHA_SITE_KEY', ''))


@auth_bp.route('/forgot-password')
def forgot_password_page():
    if session.get('logged_in'):
        return redirect(url_for('pages.index') if session.get('zone') else url_for('zones.zones_page'))
    return render_template('forgot_password.html', recaptcha_site_key=os.getenv('RECAPTCHA_SITE_KEY', ''))


@auth_bp.route('/api/captcha')
def api_captcha():
    token = secrets.token_hex(8)
    op = secrets.randbelow(3)
    if op == 0:
        a = secrets.randbelow(30) + 15
        b = secrets.randbelow(20) + 8
        answer = a + b
        question = f'{a} + {b} = ?'
    elif op == 1:
        b = secrets.randbelow(15) + 5
        a = b + secrets.randbelow(25) + 5
        answer = a - b
        question = f'{a} − {b} = ?'
    else:
        a = secrets.randbelow(10) + 3
        b = secrets.randbelow(10) + 3
        answer = a * b
        question = f'{a} × {b} = ?'
    session['register_captcha'] = {'token': token, 'answer': str(answer)}
    return jsonify({'token': token, 'question': question})


@auth_bp.route('/api/register', methods=['POST'])
def api_register():
    is_multipart = request.content_type and 'multipart' in request.content_type
    if is_multipart:
        src = request.form
        avatar_file = request.files.get('avatar')
        def _g(k): return str(src.get(k, '')).strip()
        privacy_accepted = src.get('privacy_accepted') in ('true', '1', 'True', 'on')
    else:
        data = request.get_json(silent=True) or {}
        src = data
        avatar_file = None
        def _g(k): return str(data.get(k, '')).strip()
        privacy_accepted = bool(data.get('privacy_accepted'))

    full_name = _g('full_name')
    username = _normalize_username(src.get('username', ''))
    email = _g('email')
    phone = _g('phone')
    job_title = _g('job_title')
    gender = _g('gender')
    birth_date = _g('birth_date')
    password = _g('password')
    confirm_password = _g('confirm_password')
    security_question = _g('security_question')
    security_answer = _g('security_answer')
    recaptcha_token = _g('recaptcha_token')

    required = [
        full_name,
        username,
        email,
        phone,
        job_title,
        gender,
        birth_date,
        password,
        confirm_password,
        security_question,
        security_answer,
        recaptcha_token,
    ]
    if not all(required):
        return jsonify({'success': False, 'message': 'يرجى تعبئة جميع الحقول وإتمام التحقق من الكابتشا'}), 400

    reserved_usernames = {
        'admin', 'administrator', 'dev', 'developer', 'root', 'superadmin',
        # Protected owner — English
        'hamza kafeh ahmad ghareb', 'hamza kafeh ghareb', 'hamza ghareb',
        'hamza k. ghareb', 'hamza k ghareb', 'hamza kafeh', 'ghareb',
        'hamzakghareb', 'hamzaghareb', 'hamza_ghareb', 'hamza-ghareb',
        # Protected owner — Arabic
        'حمزة غريب', 'حمزة كافح احمد غريب', 'حمزة كافح غريب',
        'حمزة كافح', 'حمزة ك. غريب',
    }
    # Blocked full names (prevents registering with owner identity)
    blocked_full_names = {
        # English
        'hamza kafeh ahmad ghareb', 'hamza kafeh ghareb', 'hamza ghareb',
        'hamza k. ghareb', 'hamza k ghareb', 'hamza kafeh',
        'hamza k.', 'kafeh', 'kafeh ahmad ghareb', 'kafeh ghareb',
        # Arabic
        'حمزة غريب', 'حمزة كافح احمد غريب', 'حمزة كافح غريب',
        'حمزة كافح', 'حمزة ك. غريب', 'حمزة ك.',
        'كافح', 'كافح غريب', 'كافح احمد غريب',
    }
    _full_name_lower = full_name.strip().lower()
    if _full_name_lower in {n.lower() for n in blocked_full_names}:
        return jsonify({'success': False, 'message': 'هذا الاسم محجوز ولا يمكن التسجيل به'}), 400
    # Blocked phone numbers
    _phone_digits = re.sub(r'\D', '', phone.strip())
    if _phone_digits in {'0785211197', '00962785211197', '962785211197', '785211197'}:
        return jsonify({'success': False, 'message': 'رقم الهاتف هذا محظور'}), 400

    _uname_lower = username.strip().lower()
    if _uname_lower in {r.lower() for r in reserved_usernames}:
        return jsonify({'success': False, 'message': 'اسم المستخدم محمي ولا يمكن التسجيل به'}), 400
    if len(username) < 5:
        return jsonify({'success': False, 'message': 'اسم المستخدم يجب أن يكون 5 أحرف على الأقل'}), 400
    # Username must be English (ASCII letters, digits, hyphens, underscores, dots only)
    if not re.match(r'^[A-Za-z0-9\-_.]+$', username):
        return jsonify({'success': False, 'message': 'اسم المستخدم يجب أن يكون بالأحرف الإنجليزية فقط'}), 400
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        return jsonify({'success': False, 'message': 'يرجى إدخال بريد إلكتروني صحيح'}), 400
    if not (re.search(r'[A-Za-z]', password) and re.search(r'\d', password)):
        return jsonify({'success': False, 'message': 'كلمة المرور يجب أن تحتوي أحرفاً وأرقاماً'}), 400
    if not privacy_accepted:
        return jsonify({'success': False, 'message': 'يجب الموافقة على سياسة الخصوصية وشروط الاستخدام'}), 400
    if password != confirm_password:
        return jsonify({'success': False, 'message': 'كلمة المرور وتأكيدها غير متطابقين'}), 400

    rc_ok, rc_err = _verify_recaptcha(recaptcha_token)
    if not rc_ok:
        return jsonify({'success': False, 'message': rc_err}), 400

    if _username_exists_everywhere(username):
        return jsonify({'success': False, 'message': 'اسم المستخدم مستخدم مسبقاً'}), 409

    password_hash = _hash_secret(password)
    answer_hash = _hash_secret(_normalize_text(security_answer))
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    with _db_connect() as conn:
        conn.execute(
            """
            INSERT INTO registration_requests
            (full_name, username, email, phone, job_title, gender, birth_date, privacy_accepted, password_hash, security_question, security_answer_hash, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            (
                full_name,
                username,
                email,
                phone,
                job_title,
                gender,
                birth_date,
                1 if privacy_accepted else 0,
                password_hash,
                security_question,
                answer_hash,
                now,
            ),
        )

    if avatar_file:
        try:
            ext = os.path.splitext(avatar_file.filename or '')[1].lower()
            if ext not in {'.jpg', '.jpeg', '.png', '.webp'}:
                ext = '.jpg'
            os.makedirs(_AVATAR_DIR, exist_ok=True)
            avatar_file.save(os.path.join(_AVATAR_DIR, f'{username}{ext}'))
        except Exception:
            pass

    session.pop('register_captcha', None)
    return jsonify({'success': True, 'message': 'تم إرسال طلب التسجيل بنجاح. بانتظار موافقة الأدمن.'})


@auth_bp.route('/api/password_reset/verify', methods=['POST'])
def api_password_reset_verify():
    data = request.get_json(silent=True) or {}
    username = _normalize_username(data.get('username', ''))
    security_question = str(data.get('security_question', '')).strip()
    security_answer = str(data.get('security_answer', '')).strip()
    recaptcha_token = data.get('recaptcha_token', '')

    if os.getenv('RECAPTCHA_SITE_KEY') and recaptcha_token:
        rc_ok, _ = _verify_recaptcha(recaptcha_token)
        if not rc_ok:
            return jsonify({'success': False, 'message': 'فشل التحقق من كابتشا — حاول مجدداً'}), 400

    user = _approved_db_user(username)
    if not user:
        return jsonify({'success': False, 'message': 'المستخدم غير موجود أو غير مفعل'}), 404
    if _normalize_text(user['security_question']) != _normalize_text(security_question):
        return jsonify({'success': False, 'message': 'السؤال الأمني غير صحيح'}), 401
    if not _verify_secret(_normalize_text(security_answer), user['security_answer_hash']):
        return jsonify({'success': False, 'message': 'الجواب الأمني غير صحيح'}), 401

    session['password_reset_username'] = user['username']
    return jsonify({'success': True, 'message': 'تم التحقق بنجاح'})


@auth_bp.route('/api/password_reset/complete', methods=['POST'])
def api_password_reset_complete():
    data = request.get_json(silent=True) or {}
    username = _normalize_username(session.get('password_reset_username') or data.get('username', ''))
    new_password = str(data.get('new_password', '')).strip()
    confirm_password = str(data.get('confirm_password', '')).strip()

    if not username:
        return jsonify({'success': False, 'message': 'انتهت جلسة الاسترجاع، أعد التحقق من البيانات'}), 400
    if not new_password or not confirm_password:
        return jsonify({'success': False, 'message': 'يرجى إدخال كلمة المرور الجديدة'}), 400
    if new_password != confirm_password:
        return jsonify({'success': False, 'message': 'كلمة المرور وتأكيدها غير متطابقين'}), 400

    password_hash = _hash_secret(new_password)
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with _db_connect() as conn:
        cur = conn.execute(
            "UPDATE users SET password_hash = ?, approved_at = COALESCE(approved_at, ?) WHERE lower(username) = ?",
            (password_hash, now, username),
        )
        if cur.rowcount == 0:
            return jsonify({'success': False, 'message': 'تعذر تحديث كلمة المرور'}), 404

    session.pop('password_reset_username', None)
    return jsonify({'success': True, 'message': 'تم تغيير كلمة المرور بنجاح'})


@auth_bp.route('/contact')
def contact():
    return render_template('contact.html')


@auth_bp.route('/help')
def help_page():
    return render_template('help.html')


@auth_bp.route('/login', methods=['POST'])
def do_login():
    ip = _get_ip()
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    next_url = data.get('next', '/zones')
    remember_me = bool(data.get('remember_me', False))

    username_key = _normalize_username(username)
    env_password = ENV_USERS.get(username_key)
    db_user = _approved_db_user(username)
    correct = (
        (env_password is not None and env_password == password)
        or (db_user is not None and _verify_secret(password, db_user['password_hash']))
    )

    if not correct and _is_locked_out(ip):
        remaining = _lockout_remaining(ip)
        mins = remaining // 60
        secs = remaining % 60
        return jsonify({
            'success': False,
            'locked': True,
            'remaining': remaining,
            'message': f'تم تجاوز عدد المحاولات. الرجاء الانتظار {mins}:{secs:02d}'
        }), 429

    if correct:
        if db_user is not None:
            suspended_remaining = _user_suspension_remaining(db_user)
            if suspended_remaining > 0:
                mins = suspended_remaining // 60
                secs = suspended_remaining % 60
                return jsonify({
                    'success': False,
                    'suspended': True,
                    'remaining': suspended_remaining,
                    'message': f'الحساب موقوف مؤقتاً. الوقت المتبقي {mins}:{secs:02d}'
                }), 403
        login_username = db_user['username'] if db_user is not None else username
        _clear_attempts(ip)
        _firebase_clear_user_status(login_username)
        session.permanent = remember_me
        session['logged_in'] = True
        session['username'] = login_username
        qr_next = session.pop('qr_next', None)
        if qr_next and qr_next.startswith('/'):
            return jsonify({'success': True, 'redirect': qr_next})
        if not session.get('next_after_zone'):
            session['next_after_zone'] = next_url if next_url.startswith('/') else '/zones'
        session.pop('zone', None)
        return jsonify({'success': True, 'redirect': '/zones'})

    _record_failed_attempt(ip)
    return jsonify({'success': False, 'message': 'Incorrect username or password'}), 401
