from pathlib import Path

ROOT = Path(r"C:\Users\hamza\Desktop\EST-IMS Online\est-ims")
APP = ROOT / "app.py"
INDEX = ROOT / "templates" / "index.html"
REGISTER = ROOT / "templates" / "register.html"
FORGOT = ROOT / "templates" / "forgot_password.html"


def read(path):
    return path.read_text(encoding="utf-8")


def write(path, text):
    path.write_text(text, encoding="utf-8", newline="")


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Missing block: {label}")
    return text.replace(old, new, 1)


app = read(APP)

app = replace_once(
    app,
    "AUTH_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'auth.sqlite3')\n\n\n"
    "def _normalize_username(value):",
    "AUTH_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'auth.sqlite3')\n\n"
    "SECURITY_QUESTIONS = [\n"
    "    'What was the name of your first school?',\n"
    "    'What is your favorite childhood nickname?',\n"
    "    'What city were you born in?',\n"
    "    'What is your favorite teacher name?',\n"
    "    'What is the name of your first pet?',\n"
    "    'What is your favorite food?',\n"
    "]\n"
    "SINGLE_SESSION_EXEMPT_USERS = {'admin', 'dev', 'mlo5', 'ink'}\n\n\n"
    "def _normalize_username(value):",
    "constants",
)

app = replace_once(
    app,
    "def _db_connect():\n"
    "    conn = sqlite3.connect(AUTH_DB_FILE)\n"
    "    conn.row_factory = sqlite3.Row\n"
    "    return conn\n\n\n"
    "def _init_auth_db():",
    "def _db_connect():\n"
    "    conn = sqlite3.connect(AUTH_DB_FILE)\n"
    "    conn.row_factory = sqlite3.Row\n"
    "    return conn\n\n\n"
    "def _table_columns(conn, table_name):\n"
    "    return {row['name'] for row in conn.execute(f\"PRAGMA table_info({table_name})\").fetchall()}\n\n\n"
    "def _parse_db_datetime(value):\n"
    "    if not value:\n"
    "        return None\n"
    "    try:\n"
    "        return datetime.strptime(str(value), '%Y-%m-%d %H:%M:%S')\n"
    "    except Exception:\n"
    "        return None\n\n\n"
    "def _is_single_session_exempt(username):\n"
    "    return _normalize_username(username) in SINGLE_SESSION_EXEMPT_USERS\n\n\n"
    "def _active_session_for(username):\n"
    "    uname = _normalize_username(username)\n"
    "    if not uname:\n"
    "        return None\n"
    "    with _db_connect() as conn:\n"
    "        return conn.execute(\n"
    "            \"SELECT * FROM active_sessions WHERE username = ?\",\n"
    "            (uname,),\n"
    "        ).fetchone()\n\n\n"
    "def _start_user_session(username):\n"
    "    uname = _normalize_username(username)\n"
    "    if not uname or _is_single_session_exempt(uname):\n"
    "        session.pop('session_token', None)\n"
    "        return None\n"
    "    token = secrets.token_urlsafe(32)\n"
    "    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')\n"
    "    with _db_connect() as conn:\n"
    "        conn.execute(\n"
    "            \"\"\"\n"
    "            INSERT OR REPLACE INTO active_sessions\n"
    "            (username, session_token, created_at, last_seen, ip, user_agent)\n"
    "            VALUES (?, ?, ?, ?, ?, ?)\n"
    "            \"\"\",\n"
    "            (uname, token, now, now, _get_ip(), request.headers.get('User-Agent', '')[:240]),\n"
    "        )\n"
    "    session['session_token'] = token\n"
    "    return token\n\n\n"
    "def _clear_user_session(username=None, token=None):\n"
    "    uname = _normalize_username(username or session.get('username', ''))\n"
    "    token = token or session.get('session_token')\n"
    "    if not uname:\n"
    "        return\n"
    "    with _db_connect() as conn:\n"
    "        if token:\n"
    "            conn.execute(\n"
    "                \"DELETE FROM active_sessions WHERE username = ? AND session_token = ?\",\n"
    "                (uname, token),\n"
    "            )\n"
    "        else:\n"
    "            conn.execute(\"DELETE FROM active_sessions WHERE username = ?\", (uname,))\n\n\n"
    "def _session_is_current():\n"
    "    username = session.get('username', '')\n"
    "    if not username or _is_single_session_exempt(username):\n"
    "        return True\n"
    "    token = session.get('session_token')\n"
    "    if not token:\n"
    "        return False\n"
    "    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')\n"
    "    with _db_connect() as conn:\n"
    "        row = conn.execute(\n"
    "            \"SELECT session_token FROM active_sessions WHERE username = ?\",\n"
    "            (_normalize_username(username),),\n"
    "        ).fetchone()\n"
    "        if not row or row['session_token'] != token:\n"
    "            return False\n"
    "        conn.execute(\n"
    "            \"UPDATE active_sessions SET last_seen = ?, ip = ? WHERE username = ? AND session_token = ?\",\n"
    "            (now, _get_ip(), _normalize_username(username), token),\n"
    "        )\n"
    "    return True\n\n\n"
    "def _user_suspension_message(user):\n"
    "    until = user['suspended_until'] if 'suspended_until' in user.keys() else None\n"
    "    until_dt = _parse_db_datetime(until)\n"
    "    if until_dt and until_dt > datetime.now():\n"
    "        return f'الحساب موقوف حتى {until}'\n"
    "    return ''\n\n\n"
    "def _init_auth_db():",
    "db helpers",
)

app = replace_once(
    app,
    "                approved_at TEXT,\n"
    "                created_by TEXT\n"
    "            )\n"
    "        \"\"\")\n"
    "        conn.execute(\"\"\"\n"
    "            CREATE TABLE IF NOT EXISTS registration_requests",
    "                approved_at TEXT,\n"
    "                created_by TEXT,\n"
    "                suspended_until TEXT,\n"
    "                suspended_at TEXT,\n"
    "                suspended_by TEXT\n"
    "            )\n"
    "        \"\"\")\n"
    "        user_cols = _table_columns(conn, 'users')\n"
    "        for col, ddl in {\n"
    "            'suspended_until': 'ALTER TABLE users ADD COLUMN suspended_until TEXT',\n"
    "            'suspended_at': 'ALTER TABLE users ADD COLUMN suspended_at TEXT',\n"
    "            'suspended_by': 'ALTER TABLE users ADD COLUMN suspended_by TEXT',\n"
    "        }.items():\n"
    "            if col not in user_cols:\n"
    "                conn.execute(ddl)\n"
    "        conn.execute(\"\"\"\n"
    "            CREATE TABLE IF NOT EXISTS active_sessions (\n"
    "                username TEXT PRIMARY KEY,\n"
    "                session_token TEXT NOT NULL,\n"
    "                created_at TEXT NOT NULL,\n"
    "                last_seen TEXT NOT NULL,\n"
    "                ip TEXT,\n"
    "                user_agent TEXT\n"
    "            )\n"
    "        \"\"\")\n"
    "        conn.execute(\"\"\"\n"
    "            CREATE TABLE IF NOT EXISTS registration_requests",
    "users schema",
)

app = replace_once(
    app,
    "@app.route('/api/captcha')\n"
    "def api_captcha():",
    "@app.route('/api/security_questions')\n"
    "def api_security_questions():\n"
    "    return jsonify({'questions': SECURITY_QUESTIONS})\n\n"
    "@app.route('/api/captcha')\n"
    "def api_captcha():",
    "security questions route",
)

app = replace_once(
    app,
    "    if correct:\n"
    "        _clear_attempts(ip)\n"
    "        session['logged_in'] = True\n"
    "        session['username']  = db_user['username'] if db_user is not None else username\n",
    "    if correct:\n"
    "        login_username = db_user['username'] if db_user is not None else username\n"
    "        if db_user is not None:\n"
    "            suspension = _user_suspension_message(db_user)\n"
    "            if suspension:\n"
    "                return jsonify({'success': False, 'message': suspension}), 403\n"
    "        if not _is_single_session_exempt(login_username):\n"
    "            active = _active_session_for(login_username)\n"
    "            if active:\n"
    "                return jsonify({\n"
    "                    'success': False,\n"
    "                    'active_session': True,\n"
    "                    'message': 'هذا المستخدم مسجل دخول من جهاز آخر حالياً'\n"
    "                }), 409\n"
    "        _clear_attempts(ip)\n"
    "        session['logged_in'] = True\n"
    "        session['username']  = login_username\n"
    "        _start_user_session(login_username)\n",
    "login session guard",
)

app = replace_once(
    app,
    "        if not session.get('logged_in'):\n"
    "            if request.is_json or request.path.startswith('/api/'):\n"
    "                return jsonify({'error': 'Unauthorized'}), 401\n"
    "            return redirect(url_for('login_page'))\n"
    "        return f(*args, **kwargs)\n",
    "        if not session.get('logged_in'):\n"
    "            if request.is_json or request.path.startswith('/api/'):\n"
    "                return jsonify({'error': 'Unauthorized'}), 401\n"
    "            return redirect(url_for('login_page'))\n"
    "        if not _session_is_current():\n"
    "            session.clear()\n"
    "            if request.is_json or request.path.startswith('/api/'):\n"
    "                return jsonify({'error': 'تم تسجيل الدخول من جهاز آخر، تم إنهاء هذه الجلسة'}), 409\n"
    "            return redirect(url_for('login_page'))\n"
    "        return f(*args, **kwargs)\n",
    "login_required current session",
)

app = replace_once(
    app,
    "        if not session.get('logged_in'):\n"
    "            if request.is_json or request.path.startswith('/api/'):\n"
    "                return jsonify({'error': 'Unauthorized'}), 401\n"
    "            return redirect(url_for('login_page'))\n"
    "        if not session.get('zone'):\n"
    "            return redirect(url_for('zones_page'))\n"
    "        return f(*args, **kwargs)\n",
    "        if not session.get('logged_in'):\n"
    "            if request.is_json or request.path.startswith('/api/'):\n"
    "                return jsonify({'error': 'Unauthorized'}), 401\n"
    "            return redirect(url_for('login_page'))\n"
    "        if not _session_is_current():\n"
    "            session.clear()\n"
    "            if request.is_json or request.path.startswith('/api/'):\n"
    "                return jsonify({'error': 'تم تسجيل الدخول من جهاز آخر، تم إنهاء هذه الجلسة'}), 409\n"
    "            return redirect(url_for('login_page'))\n"
    "        if not session.get('zone'):\n"
    "            return redirect(url_for('zones_page'))\n"
    "        return f(*args, **kwargs)\n",
    "zone_required current session",
)

app = replace_once(
    app,
    "@app.route('/logout')\n"
    "def logout():\n"
    "    session.clear()\n"
    "    return redirect(url_for('login_page'))\n",
    "@app.route('/logout')\n"
    "def logout():\n"
    "    _clear_user_session()\n"
    "    session.clear()\n"
    "    return redirect(url_for('login_page'))\n",
    "logout clear session",
)

app = replace_once(
    app,
    "            \"SELECT full_name, username, email, phone, job_title, approved_at, created_at FROM users WHERE approved = 1 ORDER BY approved_at DESC, id DESC\"\n",
    "            \"SELECT id, full_name, username, email, phone, job_title, approved_at, created_at, suspended_until, suspended_at, suspended_by FROM users WHERE approved = 1 ORDER BY approved_at DESC, id DESC\"\n",
    "registered users select",
)

app = replace_once(
    app,
    "                'full_name': row['full_name'],\n"
    "                'username': row['username'],\n"
    "                'email': row['email'],\n"
    "                'phone': row['phone'],\n"
    "                'job_title': row['job_title'],\n"
    "                'approved_at': row['approved_at'],\n"
    "                'created_at': row['created_at'],\n"
    "            }\n",
    "                'id': row['id'],\n"
    "                'full_name': row['full_name'],\n"
    "                'username': row['username'],\n"
    "                'email': row['email'],\n"
    "                'phone': row['phone'],\n"
    "                'job_title': row['job_title'],\n"
    "                'approved_at': row['approved_at'],\n"
    "                'created_at': row['created_at'],\n"
    "                'suspended_until': row['suspended_until'],\n"
    "                'suspended_at': row['suspended_at'],\n"
    "                'suspended_by': row['suspended_by'],\n"
    "                'is_suspended': bool(_parse_db_datetime(row['suspended_until']) and _parse_db_datetime(row['suspended_until']) > datetime.now()),\n"
    "            }\n",
    "registered users payload",
)

insert_after_users = """    return jsonify({
        'count': len(rows),
        'users': [
            {
                'id': row['id'],
                'full_name': row['full_name'],
                'username': row['username'],
                'email': row['email'],
                'phone': row['phone'],
                'job_title': row['job_title'],
                'approved_at': row['approved_at'],
                'created_at': row['created_at'],
                'suspended_until': row['suspended_until'],
                'suspended_at': row['suspended_at'],
                'suspended_by': row['suspended_by'],
                'is_suspended': bool(_parse_db_datetime(row['suspended_until']) and _parse_db_datetime(row['suspended_until']) > datetime.now()),
            }
            for row in rows
        ],
    })
"""
admin_actions = insert_after_users + """

@app.route('/api/admin/registered_users/<int:user_id>/suspend', methods=['POST'])
@zone_required
def api_admin_suspend_user(user_id):
    if session.get('zone') != 'dev':
        return jsonify({'error': 'غير مصرح'}), 403
    data = request.get_json(silent=True) or {}
    hours = data.get('hours', 0)
    try:
        hours = float(hours)
    except Exception:
        hours = 0
    if hours <= 0:
        return jsonify({'success': False, 'message': 'مدة الإيقاف غير صحيحة'}), 400
    until_dt = datetime.now() + timedelta(hours=hours)
    until = until_dt.strftime('%Y-%m-%d %H:%M:%S')
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    admin_user = session.get('username', '')
    with _db_connect() as conn:
        row = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'المستخدم غير موجود'}), 404
        if _is_single_session_exempt(row['username']):
            return jsonify({'success': False, 'message': 'لا يمكن إيقاف حساب الأدمن أو الديف من هنا'}), 400
        conn.execute(
            "UPDATE users SET suspended_until = ?, suspended_at = ?, suspended_by = ? WHERE id = ?",
            (until, now, admin_user, user_id),
        )
        conn.execute("DELETE FROM active_sessions WHERE username = ?", (_normalize_username(row['username']),))
    return jsonify({'success': True, 'message': f'تم إيقاف المستخدم حتى {until}', 'suspended_until': until})


@app.route('/api/admin/registered_users/<int:user_id>/unsuspend', methods=['POST'])
@zone_required
def api_admin_unsuspend_user(user_id):
    if session.get('zone') != 'dev':
        return jsonify({'error': 'غير مصرح'}), 403
    with _db_connect() as conn:
        row = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'المستخدم غير موجود'}), 404
        conn.execute(
            "UPDATE users SET suspended_until = NULL, suspended_at = NULL, suspended_by = NULL WHERE id = ?",
            (user_id,),
        )
    return jsonify({'success': True, 'message': 'تم إلغاء إيقاف المستخدم'})


@app.route('/api/admin/registered_users/<int:user_id>', methods=['DELETE'])
@zone_required
def api_admin_delete_user(user_id):
    if session.get('zone') != 'dev':
        return jsonify({'error': 'غير مصرح'}), 403
    with _db_connect() as conn:
        row = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'المستخدم غير موجود'}), 404
        if _is_single_session_exempt(row['username']):
            return jsonify({'success': False, 'message': 'لا يمكن حذف حساب الأدمن أو الديف من هنا'}), 400
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.execute("DELETE FROM active_sessions WHERE username = ?", (_normalize_username(row['username']),))
    return jsonify({'success': True, 'message': 'تم حذف الحساب نهائياً'})
"""
app = replace_once(app, insert_after_users, admin_actions, "admin user actions")

app = replace_once(
    app,
    "from datetime import datetime\n",
    "from datetime import datetime, timedelta\n",
    "datetime import",
)

write(APP, app)


index = read(INDEX)
index = replace_once(
    index,
    "  #reportsBtn { background:linear-gradient(135deg, rgba(245,158,11,.24), rgba(16,185,129,.16)); border-color:rgba(245,158,11,.6); color:var(--accent-amber); }\n"
    "  #reportsBtn:hover { background: rgba(245,158,11,.32); color: var(--accent-amber); transform: scale(1.1); box-shadow: 0 6px 20px rgba(245,158,11,0.28); }\n",
    "  #reportsBtn { background:linear-gradient(135deg, rgba(20,184,166,.22), rgba(6,182,212,.14)); border-color:rgba(20,184,166,.58); color:#5eead4; }\n"
    "  #reportsBtn:hover { background: rgba(20,184,166,.30); color: #ccfbf1; transform: scale(1.1); box-shadow: 0 6px 20px rgba(20,184,166,0.28); }\n",
    "reports color",
)
index = replace_once(
    index,
    "  #adminRequestsBtn { background: linear-gradient(135deg, rgba(139,92,246,.22), rgba(124,58,237,.14)); border-color: rgba(139,92,246,.58); color: #c4b5fd; }\n"
    "  #adminRequestsBtn:hover { background: rgba(139,92,246,.34); color: #fff; transform: scale(1.1); box-shadow: 0 6px 20px rgba(139,92,246,0.25); }\n"
    "  #adminUsersBtn { background: rgba(139,92,246,0.14); border-color: rgba(139,92,246,0.48); color: #c4b5fd; }\n"
    "  #adminUsersBtn:hover { background: var(--accent-purple); color: #fff; transform: scale(1.1); box-shadow: 0 6px 20px rgba(139,92,246,0.28); }\n",
    "  @keyframes adminPulse { 0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.34);} 50%{box-shadow:0 0 0 8px rgba(139,92,246,0);} }\n"
    "  #adminRequestsBtn { background: linear-gradient(135deg, rgba(139,92,246,.22), rgba(124,58,237,.14)); border-color: rgba(139,92,246,.58); color: #c4b5fd; animation: adminPulse 1.8s ease-in-out infinite; }\n"
    "  #adminRequestsBtn:hover { background: rgba(139,92,246,.34); color: #fff; transform: scale(1.1); box-shadow: 0 6px 20px rgba(139,92,246,0.25); }\n"
    "  #adminUsersBtn { background: rgba(6,182,212,0.14); border-color: rgba(6,182,212,0.48); color: #67e8f9; animation: adminPulse 1.8s ease-in-out infinite; }\n"
    "  #adminUsersBtn:hover { background: var(--accent-cyan); color: #06131a; transform: scale(1.1); box-shadow: 0 6px 20px rgba(6,182,212,0.28); }\n",
    "admin pulse and users color",
)
index = replace_once(
    index,
    "  .users-box {\n"
    "    background: var(--bg-panel); border: 1px solid var(--border-light);\n"
    "    border-radius: 18px; width: 700px; max-width: 95vw; max-height: 80vh;\n",
    "  .users-box {\n"
    "    background: var(--bg-panel); border: 1px solid var(--border-light);\n"
    "    border-radius: 18px; width: 700px; max-width: 95vw; max-height: 80vh;\n",
    "users box noop",
)
index = replace_once(
    index,
    "  .users-empty {\n"
    "    text-align: center; padding: 40px; color: var(--text-dim); font-size: 13px;\n"
    "  }\n",
    "  .users-empty {\n"
    "    text-align: center; padding: 40px; color: var(--text-dim); font-size: 13px;\n"
    "  }\n"
    "  #adminRequestsModal, #adminUsersModal {\n"
    "    display: none; position: fixed; inset: 0; z-index: 9500;\n"
    "    background: rgba(0,0,0,0.62); backdrop-filter: blur(7px);\n"
    "    align-items: center; justify-content: center; padding: 18px;\n"
    "  }\n"
    "  #adminRequestsModal.open, #adminUsersModal.open { display:flex; }\n"
    "  .admin-user-list { display:grid; gap:10px; padding:14px; }\n"
    "  .admin-user-row { width:100%; text-align:start; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:13px 14px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); color:var(--text-main); cursor:pointer; }\n"
    "  .admin-user-row:hover { background:var(--bg-hover); border-color:var(--border-light); }\n"
    "  .admin-user-name { font-weight:800; overflow-wrap:anywhere; }\n"
    "  .admin-user-meta { font-size:11px; color:var(--text-muted); font-family:'JetBrains Mono',monospace; }\n"
    "  .admin-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; padding:14px; }\n"
    "  .admin-detail-item { border:1px solid var(--border); background:var(--bg-card); border-radius:10px; padding:10px 12px; }\n"
    "  .admin-detail-label { font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.7px; margin-bottom:5px; }\n"
    "  .admin-detail-value { font-size:13px; color:var(--text-main); overflow-wrap:anywhere; }\n"
    "  .admin-detail-actions { display:flex; gap:8px; flex-wrap:wrap; padding:0 14px 16px; }\n"
    "  .admin-detail-actions input { width:120px; border-radius:9px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-main); padding:9px 10px; }\n"
    "  @media (max-width:720px){ .admin-detail-grid{grid-template-columns:1fr;} .admin-detail-actions .btn,.admin-detail-actions input{width:100%;} }\n",
    "admin modal css",
)
index = replace_once(
    index,
    "      <button class=\"theme-btn\" id=\"adminUsersBtn\" onclick=\"openAdminUsersModal()\" title=\"المستخدمون المسجلون\">\n"
    "        <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/></svg>\n"
    "      </button>\n",
    "      <button class=\"theme-btn\" id=\"adminUsersBtn\" onclick=\"openAdminUsersModal()\" title=\"المستخدمون المسجلون\">\n"
    "        <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/><path d=\"M19 8h3\"/><path d=\"M20.5 6.5v3\"/></svg>\n"
    "      </button>\n",
    "admin users icon",
)
index = replace_once(
    index,
    "    <div class=\"users-body\" id=\"adminUsersBody\">\n"
    "      <div class=\"users-empty\">Loading...</div>\n"
    "    </div>\n",
    "    <div class=\"users-body\" id=\"adminUsersBody\">\n"
    "      <div class=\"users-empty\">Loading...</div>\n"
    "    </div>\n"
    "    <div class=\"users-body\" id=\"adminUserDetailsBody\" style=\"display:none;\"></div>\n",
    "admin users details body",
)
index = replace_once(
    index,
    "{% if is_dev %}\n"
    "(function() {\n"
    "  fetch('/api/admin/pending_requests_count', { cache: 'no-store' })\n"
    "    .then(r => r.json())\n"
    "    .then(d => setAdminRequestBadge(d.count || 0))\n"
    "    .catch(() => setAdminRequestBadge(0));\n"
    "})();\n"
    "{% endif %}\n",
    "{% if is_dev %}\n"
    "let _lastPendingRegistrationCount = null;\n"
    "function playNewRegistrationSound() {\n"
    "  const audio = new Audio('/static/newapp.mp3');\n"
    "  audio.volume = 0.75;\n"
    "  audio.play().catch(() => {});\n"
    "}\n"
    "async function refreshPendingRegistrationCount() {\n"
    "  try {\n"
    "    const r = await fetch('/api/admin/pending_requests_count', { cache: 'no-store' });\n"
    "    const d = await r.json();\n"
    "    const count = Number(d.count || 0);\n"
    "    if (_lastPendingRegistrationCount !== null && count > _lastPendingRegistrationCount) playNewRegistrationSound();\n"
    "    _lastPendingRegistrationCount = count;\n"
    "    setAdminRequestBadge(count);\n"
    "  } catch (_) {\n"
    "    setAdminRequestBadge(0);\n"
    "  }\n"
    "}\n"
    "refreshPendingRegistrationCount();\n"
    "setInterval(refreshPendingRegistrationCount, 15000);\n"
    "{% endif %}\n",
    "pending count sound",
)

old_load_users = """async function loadAdminUsers() {
  const body = document.getElementById('adminUsersBody');
  if (!body) return;
  body.innerHTML = '<div class="users-empty">Loading...</div>';
  try {
    const res = await fetch('/api/admin/registered_users', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed');
    const users = data.users || [];
    if (!users.length) {
      body.innerHTML = '<div class="users-empty">لا يوجد مستخدمون مسجلون بعد</div>';
      return;
    }
    body.innerHTML = `
      <table class="users-table">
        <thead>
          <tr>
            <th>#</th>
            <th>الاسم</th>
            <th>اسم المستخدم</th>
            <th>الوظيفة</th>
            <th>الايميل</th>
            <th>الهاتف</th>
            <th>تاريخ التفعيل</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u, i) => `
            <tr>
              <td style="color:var(--text-dim);font-family:'JetBrains Mono',monospace;font-size:11px;">${i + 1}</td>
              <td><strong>${escHtml(u.full_name || '—')}</strong></td>
              <td>${escHtml(u.username || '—')}</td>
              <td>${escHtml(u.job_title || '—')}</td>
              <td>${escHtml(u.email || '—')}</td>
              <td>${escHtml(u.phone || '—')}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);">${escHtml(u.approved_at || u.created_at || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    body.innerHTML = `<div class="users-empty">فشل تحميل المستخدمين<br><span style="font-size:11px;color:var(--text-dim);">${escHtml(String(e.message || e))}</span></div>`;
  }
}
"""
new_load_users = """let _adminRegisteredUsers = [];

async function loadAdminUsers() {
  const body = document.getElementById('adminUsersBody');
  const details = document.getElementById('adminUserDetailsBody');
  if (!body) return;
  if (details) { details.style.display = 'none'; details.innerHTML = ''; }
  body.style.display = 'block';
  body.innerHTML = '<div class="users-empty">Loading...</div>';
  try {
    const res = await fetch('/api/admin/registered_users', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed');
    _adminRegisteredUsers = data.users || [];
    if (!_adminRegisteredUsers.length) {
      body.innerHTML = '<div class="users-empty">لا يوجد مستخدمون مسجلون بعد</div>';
      return;
    }
    body.innerHTML = `<div class="admin-user-list">
      ${_adminRegisteredUsers.map((u, i) => `
        <button class="admin-user-row" type="button" onclick="showAdminUserDetails(${i})">
          <span>
            <span class="admin-user-name">${escHtml(u.username || '—')}</span>
            <span class="admin-user-meta">${u.is_suspended ? ' | Suspended' : ''}</span>
          </span>
          <span class="admin-user-meta">${escHtml(u.approved_at || u.created_at || '—')}</span>
        </button>
      `).join('')}
    </div>`;
  } catch (e) {
    body.innerHTML = `<div class="users-empty">فشل تحميل المستخدمين<br><span style="font-size:11px;color:var(--text-dim);">${escHtml(String(e.message || e))}</span></div>`;
  }
}

function showAdminUserDetails(index) {
  const u = _adminRegisteredUsers[index];
  const list = document.getElementById('adminUsersBody');
  const details = document.getElementById('adminUserDetailsBody');
  if (!u || !list || !details) return;
  list.style.display = 'none';
  details.style.display = 'block';
  const fields = [
    ['Full name', u.full_name],
    ['Username', u.username],
    ['Job title', u.job_title],
    ['Email', u.email],
    ['Phone', u.phone],
    ['Created at', u.created_at],
    ['Approved at', u.approved_at],
    ['Suspended until', u.suspended_until || 'Not suspended'],
  ];
  details.innerHTML = `
    <div style="padding:14px 14px 0;">
      <button class="dash-refresh-btn" onclick="backToAdminUsersList()" style="padding:6px 10px;font-size:11px;">Back</button>
    </div>
    <div class="admin-detail-grid">
      ${fields.map(([label, value]) => `
        <div class="admin-detail-item">
          <div class="admin-detail-label">${escHtml(label)}</div>
          <div class="admin-detail-value">${escHtml(value || '—')}</div>
        </div>
      `).join('')}
    </div>
    <div class="admin-detail-actions">
      <input id="suspendHoursInput" type="number" min="1" step="1" value="24" aria-label="Suspend hours">
      <button class="btn btn-purple" onclick="suspendRegisteredUser(${Number(u.id)})">إيقاف مؤقت</button>
      <button class="btn btn-ghost" onclick="unsuspendRegisteredUser(${Number(u.id)})">إلغاء الإيقاف</button>
      <button class="btn btn-danger" onclick="deleteRegisteredUser(${Number(u.id)})">حذف نهائي</button>
    </div>`;
}

function backToAdminUsersList() {
  document.getElementById('adminUserDetailsBody').style.display = 'none';
  document.getElementById('adminUsersBody').style.display = 'block';
}

async function suspendRegisteredUser(id) {
  const hours = Number(document.getElementById('suspendHoursInput')?.value || 0);
  if (!hours || hours <= 0) return alert('أدخل مدة الإيقاف بالساعات');
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    alert(data.message || 'تم الإيقاف');
    await loadAdminUsers();
  } catch (e) {
    alert(e.message || 'تعذر إيقاف المستخدم');
  }
}

async function unsuspendRegisteredUser(id) {
  try {
    const res = await fetch(`/api/admin/registered_users/${id}/unsuspend`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    alert(data.message || 'تم إلغاء الإيقاف');
    await loadAdminUsers();
  } catch (e) {
    alert(e.message || 'تعذر إلغاء الإيقاف');
  }
}

async function deleteRegisteredUser(id) {
  if (!confirm('حذف الحساب نهائياً؟ لا يمكن التراجع عن هذه العملية.')) return;
  try {
    const res = await fetch(`/api/admin/registered_users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');
    alert(data.message || 'تم الحذف');
    await loadAdminUsers();
  } catch (e) {
    alert(e.message || 'تعذر حذف المستخدم');
  }
}
"""
index = replace_once(index, old_load_users, new_load_users, "load admin users")

write(INDEX, index)


def patch_auth_page(path, is_register):
    text = read(path)
    text = text.replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">', 1)
    text = text.replace(
        "  .topbar-left { display: flex; align-items: center; gap: 12px; }\n",
        "  .topbar-left { display: flex; align-items: center; gap: 12px; min-width:0; }\n"
        "  .topbar-actions { display:flex; align-items:center; gap:8px; }\n"
        "  .lang-btn { min-width:58px; height:36px; border-radius:9px; border:1px solid rgba(6,182,212,0.4); background:rgba(6,182,212,0.12); color:var(--accent-cyan); font-weight:800; cursor:pointer; }\n",
        1,
    )
    text = text.replace(
        "  .hero-main, .hero-side, .section, .mini-card {\n"
        "    background: rgba(255,255,255,0.04);\n"
        "    backdrop-filter: blur(20px);\n"
        "    border: 1px solid rgba(255,255,255,0.08);\n"
        "    border-radius: 16px;\n"
        "  }\n",
        "  .hero-main, .hero-side, .section, .mini-card {\n"
        "    background: rgba(255,255,255,0.04);\n"
        "    backdrop-filter: blur(20px);\n"
        "    border: 1px solid rgba(255,255,255,0.08);\n"
        "    border-radius: 8px;\n"
        "  }\n",
        1,
    )
    text = text.replace(
        "  .hero-title {\n"
        "    font-size: clamp(30px, 5vw, 48px);\n",
        "  .hero-title {\n"
        "    font-size: clamp(30px, 42px, 48px);\n",
        1,
    )
    text = text.replace(
        "  @media (max-width: 720px) {\n"
        "    .page { padding: 22px 14px 48px; }\n",
        "  @media (max-width: 720px) {\n"
        "    .topbar { height:auto; min-height:58px; padding:10px 12px; gap:10px; }\n"
        "    .back-btn span, .topbar-title { max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n"
        "    .page { padding: 22px 14px 48px; }\n"
        "    .hero-title { font-size: 30px; }\n"
        "    .actions .btn { width:100%; }\n",
        1,
    )
    text = text.replace(
        "  <button class=\"icon-btn\" type=\"button\" onclick=\"toggleTheme()\"",
        "  <div class=\"topbar-actions\">\n"
        "  <button class=\"lang-btn\" type=\"button\" id=\"langBtn\" onclick=\"toggleLanguage()\">EN</button>\n"
        "  <button class=\"icon-btn\" type=\"button\" onclick=\"toggleTheme()\"",
        1,
    )
    text = text.replace(
        "    <svg class=\"icon-moon\" width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z\"/></svg>\n"
        "  </button>\n"
        "</div>\n",
        "    <svg class=\"icon-moon\" width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z\"/></svg>\n"
        "  </button>\n"
        "  </div>\n"
        "</div>\n",
        1,
    )
    if is_register:
        text = text.replace(
            '<input id="securityQuestion" dir="auto" placeholder="اكتب السؤال الأمني الذي ستستخدمه لاحقاً">',
            '<select id="securityQuestion" dir="auto"></select>',
            1,
        )
        text = text.replace(
            '<input id="securityQuestion" dir="auto" placeholder="Ø§ÙƒØªØ¨ Ø§Ù„Ø³Ø¤Ø§Ù„ Ø§Ù„Ø£Ù…Ù†ÙŠ Ø§Ù„Ø°ÙŠ Ø³ØªØ³ØªØ®Ø¯Ù…Ù‡ Ù„Ø§Ø­Ù‚Ø§Ù‹">',
            '<select id="securityQuestion" dir="auto"></select>',
            1,
        )
        extra = """
const i18n = {
  en: {
    htmlDir: 'ltr', back: 'Back', title: 'Registration', kicker: 'EST-iMs / Registration',
    hero: 'New Employee Registration', sub: 'Fill in the required information. The request will appear for the admin to approve before the account can sign in.',
    section: 'Registration Details', fullName: 'Full Name', username: 'Username', email: 'Email', phone: 'Phone', job: 'Job Title',
    password: 'Password', confirm: 'Confirm Password', securityQuestion: 'Security Question', securityAnswer: 'Security Answer',
    captcha: 'Captcha', captchaHelp: 'Solve the captcha to confirm this request is real.', reload: 'Reload',
    submit: 'Send Request', sending: 'Sending...', loginBack: 'Back to Login',
    footer: 'EST-iMs | Registration requests are saved in SQLite and wait for admin approval.',
  },
  ar: {
    htmlDir: 'rtl', back: 'العودة', title: 'التسجيل', kicker: 'EST-iMs / التسجيل',
    hero: 'طلب تسجيل موظف جديد', sub: 'أدخل البيانات المطلوبة كاملة. بعد الإرسال سيظهر الطلب عند الأدمن للموافقة قبل تفعيل الحساب.',
    section: 'بيانات التسجيل', fullName: 'الاسم الكامل', username: 'اسم المستخدم', email: 'الإيميل', phone: 'رقم الهاتف', job: 'وظيفته في الشركة',
    password: 'كلمة المرور', confirm: 'تأكيد كلمة المرور', securityQuestion: 'السؤال الأمني', securityAnswer: 'إجابة السؤال الأمني',
    captcha: 'كابتشا', captchaHelp: 'حل الكابتشا للتأكد من أن الطلب يتم من شخص حقيقي.', reload: 'تحديث',
    submit: 'إرسال الطلب', sending: 'جاري الإرسال...', loginBack: 'العودة للدخول',
    footer: 'EST-iMs | طلبات التسجيل تحفظ في SQLite وتنتظر موافقة الأدمن.',
  }
};
"""
        text = text.replace("<script>\n", "<script>\n" + extra, 1)
        text = text.replace(
            "function toggleTheme() {\n"
            "  const isLight = document.documentElement.classList.toggle('light');\n"
            "  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');\n"
            "}\n",
            "function toggleTheme() {\n"
            "  const isLight = document.documentElement.classList.toggle('light');\n"
            "  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');\n"
            "}\n"
            "let currentLang = localStorage.getItem('est-auth-lang') || 'en';\n"
            "function applyLanguage() {\n"
            "  const t = i18n[currentLang] || i18n.en;\n"
            "  document.documentElement.lang = currentLang;\n"
            "  document.documentElement.dir = t.htmlDir;\n"
            "  document.getElementById('langBtn').textContent = currentLang.toUpperCase();\n"
            "  const labels = document.querySelectorAll('.field label');\n"
            "  const map = [t.fullName,t.username,t.email,t.phone,t.job,t.password,t.confirm,t.securityQuestion,t.securityAnswer,t.captcha];\n"
            "  map.forEach((v,i)=>{ if(labels[i]) labels[i].textContent = v; });\n"
            "  document.querySelector('.back-btn span').textContent = t.back;\n"
            "  document.querySelector('.topbar-title').textContent = t.title;\n"
            "  document.querySelector('.hero-kicker span:last-child').textContent = t.kicker;\n"
            "  document.querySelector('.hero-title').textContent = t.hero;\n"
            "  document.querySelector('.hero-sub').textContent = t.sub;\n"
            "  document.querySelector('.section-title').textContent = t.section;\n"
            "  document.getElementById('reloadCaptchaBtn').textContent = t.reload;\n"
            "  document.getElementById('submitBtn').textContent = t.submit;\n"
            "  document.querySelector('.actions .btn-ghost').textContent = t.loginBack;\n"
            "  document.querySelector('.helper').textContent = t.captchaHelp;\n"
            "  document.querySelector('.footer-note').textContent = t.footer;\n"
            "}\n"
            "function toggleLanguage() { currentLang = currentLang === 'en' ? 'ar' : 'en'; localStorage.setItem('est-auth-lang', currentLang); applyLanguage(); }\n",
            1,
        )
        text = text.replace(
            "let captchaToken = '';\n",
            "async function loadSecurityQuestions() {\n"
            "  const select = document.getElementById('securityQuestion');\n"
            "  if (!select) return;\n"
            "  const res = await fetch('/api/security_questions', { cache: 'no-store' });\n"
            "  const data = await res.json();\n"
            "  select.innerHTML = (data.questions || []).map(q => `<option value=\"${q.replace(/\"/g, '&quot;')}\">${q}</option>`).join('');\n"
            "}\n"
            "let captchaToken = '';\n",
            1,
        )
        text = text.replace("loadCaptcha().catch(() => setStatus", "applyLanguage();\nloadSecurityQuestions().catch(() => {});\nloadCaptcha().catch(() => setStatus", 1)
        text = text.replace("btn.textContent = 'Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„...';", "btn.textContent = i18n[currentLang].sending;", 1)
        text = text.replace("btn.textContent = 'إرسال الطلب';", "btn.textContent = i18n[currentLang].submit;", 1)
        text = text.replace("btn.textContent = 'Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨';", "btn.textContent = i18n[currentLang].submit;", 1)
    else:
        text = text.replace(
            "  .field input, .field textarea {\n",
            "  .field input, .field textarea, .field select {\n",
            1,
        )
        text = text.replace(
            "  .field input:focus, .field textarea:focus {\n",
            "  .field input:focus, .field textarea:focus, .field select:focus {\n",
            1,
        )
        text = text.replace(
            '<input id="securityQuestion" dir="auto" placeholder="اكتب السؤال كما تم حفظه">',
            '<select id="securityQuestion" dir="auto"></select>',
            1,
        )
        text = text.replace(
            '<input id="securityQuestion" dir="auto" placeholder="Ø§ÙƒØªØ¨ Ø§Ù„Ø³Ø¤Ø§Ù„ ÙƒÙ…Ø§ ØªÙ… Ø­ÙØ¸Ù‡">',
            '<select id="securityQuestion" dir="auto"></select>',
            1,
        )
        extra = """
const i18n = {
  en: {
    htmlDir: 'ltr', back: 'Back', title: 'Password Recovery', kicker: 'EST-iMs / Recovery',
    hero: 'Password Recovery', sub: 'Verify your username and security answer, then set a new password.',
    step1Title: 'Initial Verification', step1: 'Step One', username: 'Username', oldPassword: 'Old Password', securityQuestion: 'Security Question', answer: 'Answer',
    verify: 'Verify', loginBack: 'Back to Login', step2Title: 'Change Password', step2: 'Step Two', newPassword: 'New Password', confirmPassword: 'Confirm New Password', save: 'Save Password',
  },
  ar: {
    htmlDir: 'rtl', back: 'العودة', title: 'استرجاع كلمة المرور', kicker: 'EST-iMs / الاسترجاع',
    hero: 'استرجاع كلمة المرور', sub: 'تحقق من اسم المستخدم وجواب السؤال الأمني، ثم عين كلمة مرور جديدة.',
    step1Title: 'التحقق الأولي', step1: 'المرحلة الأولى', username: 'اسم المستخدم', oldPassword: 'كلمة السر القديمة', securityQuestion: 'السؤال الأمني', answer: 'الجواب',
    verify: 'تحقق', loginBack: 'العودة للدخول', step2Title: 'تغيير كلمة المرور', step2: 'المرحلة الثانية', newPassword: 'كلمة المرور الجديدة', confirmPassword: 'تأكيد كلمة المرور الجديدة', save: 'حفظ كلمة المرور',
  }
};
"""
        text = text.replace("<script>\n", "<script>\n" + extra, 1)
        text = text.replace(
            "function toggleTheme() {\n"
            "  const isLight = document.documentElement.classList.toggle('light');\n"
            "  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');\n"
            "}\n",
            "function toggleTheme() {\n"
            "  const isLight = document.documentElement.classList.toggle('light');\n"
            "  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');\n"
            "}\n"
            "let currentLang = localStorage.getItem('est-auth-lang') || 'en';\n"
            "function applyLanguage() {\n"
            "  const t = i18n[currentLang] || i18n.en;\n"
            "  document.documentElement.lang = currentLang;\n"
            "  document.documentElement.dir = t.htmlDir;\n"
            "  document.getElementById('langBtn').textContent = currentLang.toUpperCase();\n"
            "  document.querySelector('.back-btn span').textContent = t.back;\n"
            "  document.querySelector('.topbar-title').textContent = t.title;\n"
            "  document.querySelector('.hero-kicker span:last-child').textContent = t.kicker;\n"
            "  document.querySelector('.hero-title').textContent = t.hero;\n"
            "  document.querySelector('.hero-sub').textContent = t.sub;\n"
            "  document.querySelector('#step1Box .section-title').textContent = t.step1Title;\n"
            "  document.querySelector('#step1Box .step-chip').textContent = t.step1;\n"
            "  document.querySelector('#step2Box .section-title').textContent = t.step2Title;\n"
            "  document.querySelector('#step2Box .step-chip').textContent = t.step2;\n"
            "  const labels = document.querySelectorAll('.field label');\n"
            "  [t.username,t.oldPassword,t.securityQuestion,t.answer,t.newPassword,t.confirmPassword].forEach((v,i)=>{ if(labels[i]) labels[i].textContent = v; });\n"
            "  document.getElementById('verifyBtn').textContent = t.verify;\n"
            "  document.querySelector('#step1Box .btn-ghost').textContent = t.loginBack;\n"
            "  document.getElementById('saveBtn').textContent = t.save;\n"
            "}\n"
            "function toggleLanguage() { currentLang = currentLang === 'en' ? 'ar' : 'en'; localStorage.setItem('est-auth-lang', currentLang); applyLanguage(); }\n",
            1,
        )
        text = text.replace(
            "function setStatus(id, msg, ok) {\n",
            "async function loadSecurityQuestions() {\n"
            "  const select = document.getElementById('securityQuestion');\n"
            "  if (!select) return;\n"
            "  const res = await fetch('/api/security_questions', { cache: 'no-store' });\n"
            "  const data = await res.json();\n"
            "  select.innerHTML = (data.questions || []).map(q => `<option value=\"${q.replace(/\"/g, '&quot;')}\">${q}</option>`).join('');\n"
            "}\n\n"
            "function setStatus(id, msg, ok) {\n",
            1,
        )
        text = text.replace("</script>\n</body>", "applyLanguage();\nloadSecurityQuestions().catch(() => {});\n</script>\n</body>", 1)
    write(path, text)


patch_auth_page(REGISTER, True)
patch_auth_page(FORGOT, False)

print("Patched EST-IMS files.")
