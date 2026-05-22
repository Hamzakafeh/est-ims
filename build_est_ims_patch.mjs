import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();
const root = 'C:/Users/hamza/Desktop/EST-IMS Online/est-ims';
const files = {
  app: `${root}/app.py`,
  index: `${root}/templates/index.html`,
  register: `${root}/templates/register.html`,
  forgot: `${root}/templates/forgot_password.html`,
};
const out = {
  app: path.join(cwd, 'app.patched.py'),
  index: path.join(cwd, 'index.patched.html'),
  register: path.join(cwd, 'register.patched.html'),
  forgot: path.join(cwd, 'forgot.patched.html'),
};

const replaceOnce = (text, oldText, newText, label) => {
  if (!text.includes(oldText)) throw new Error(`Missing block: ${label}`);
  return text.replace(oldText, newText);
};

let app = await readFile(files.app, 'utf8');
app = replaceOnce(app, "from datetime import datetime\n", "from datetime import datetime, timedelta\n", 'datetime import');
app = replaceOnce(app, "AUTH_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'auth.sqlite3')\n\n\ndef _normalize_username(value):",
`AUTH_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'auth.sqlite3')\n\nSECURITY_QUESTIONS = [\n    'What was the name of your first school?',\n    'What is your favorite childhood nickname?',\n    'What city were you born in?',\n    'What is your favorite teacher name?',\n    'What is the name of your first pet?',\n    'What is your favorite food?',\n]\nSINGLE_SESSION_EXEMPT_USERS = {'admin', 'dev', 'mlo5', 'ink'}\n\n\ndef _normalize_username(value):`, 'constants');
app = replaceOnce(app, `def _db_connect():
    conn = sqlite3.connect(AUTH_DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def _init_auth_db():`,
`def _db_connect():
    conn = sqlite3.connect(AUTH_DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def _table_columns(conn, table_name):
    return {row['name'] for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}


def _parse_db_datetime(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value), '%Y-%m-%d %H:%M:%S')
    except Exception:
        return None


def _is_single_session_exempt(username):
    return _normalize_username(username) in SINGLE_SESSION_EXEMPT_USERS


def _active_session_for(username):
    uname = _normalize_username(username)
    if not uname:
        return None
    with _db_connect() as conn:
        return conn.execute("SELECT * FROM active_sessions WHERE username = ?", (uname,)).fetchone()


def _start_user_session(username):
    uname = _normalize_username(username)
    if not uname or _is_single_session_exempt(uname):
        session.pop('session_token', None)
        return None
    token = secrets.token_urlsafe(32)
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with _db_connect() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO active_sessions
            (username, session_token, created_at, last_seen, ip, user_agent)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (uname, token, now, now, _get_ip(), request.headers.get('User-Agent', '')[:240]))
    session['session_token'] = token
    return token


def _clear_user_session(username=None, token=None):
    uname = _normalize_username(username or session.get('username', ''))
    token = token or session.get('session_token')
    if not uname:
        return
    with _db_connect() as conn:
        if token:
            conn.execute("DELETE FROM active_sessions WHERE username = ? AND session_token = ?", (uname, token))
        else:
            conn.execute("DELETE FROM active_sessions WHERE username = ?", (uname,))


def _session_is_current():
    username = session.get('username', '')
    if not username or _is_single_session_exempt(username):
        return True
    token = session.get('session_token')
    if not token:
        return False
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with _db_connect() as conn:
        row = conn.execute("SELECT session_token FROM active_sessions WHERE username = ?", (_normalize_username(username),)).fetchone()
        if not row or row['session_token'] != token:
            return False
        conn.execute("UPDATE active_sessions SET last_seen = ?, ip = ? WHERE username = ? AND session_token = ?", (now, _get_ip(), _normalize_username(username), token))
    return True


def _user_suspension_message(user):
    until = user['suspended_until'] if 'suspended_until' in user.keys() else None
    until_dt = _parse_db_datetime(until)
    if until_dt and until_dt > datetime.now():
        return f'الحساب موقوف حتى {until}'
    return ''


def _init_auth_db():`, 'helpers');
app = replaceOnce(app, `                approved_at TEXT,
                created_by TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS registration_requests`,
`                approved_at TEXT,
                created_by TEXT,
                suspended_until TEXT,
                suspended_at TEXT,
                suspended_by TEXT
            )
        """)
        user_cols = _table_columns(conn, 'users')
        for col, ddl in {
            'suspended_until': 'ALTER TABLE users ADD COLUMN suspended_until TEXT',
            'suspended_at': 'ALTER TABLE users ADD COLUMN suspended_at TEXT',
            'suspended_by': 'ALTER TABLE users ADD COLUMN suspended_by TEXT',
        }.items():
            if col not in user_cols:
                conn.execute(ddl)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS active_sessions (
                username TEXT PRIMARY KEY,
                session_token TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                ip TEXT,
                user_agent TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS registration_requests`, 'schema');
app = replaceOnce(app, `@app.route('/api/captcha')
def api_captcha():`, `@app.route('/api/security_questions')
def api_security_questions():
    return jsonify({'questions': SECURITY_QUESTIONS})

@app.route('/api/captcha')
def api_captcha():`, 'security questions route');
app = replaceOnce(app, `        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
`, `        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login_page'))
        if not _session_is_current():
            session.clear()
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'تم تسجيل الدخول من جهاز آخر، تم إنهاء هذه الجلسة'}), 409
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
`, 'login_required');
app = replaceOnce(app, `        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login_page'))
        if not session.get('zone'):
            return redirect(url_for('zones_page'))
        return f(*args, **kwargs)
`, `        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login_page'))
        if not _session_is_current():
            session.clear()
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'تم تسجيل الدخول من جهاز آخر، تم إنهاء هذه الجلسة'}), 409
            return redirect(url_for('login_page'))
        if not session.get('zone'):
            return redirect(url_for('zones_page'))
        return f(*args, **kwargs)
`, 'zone_required');
app = replaceOnce(app, `    if correct:
        _clear_attempts(ip)
        session['logged_in'] = True
        session['username']  = db_user['username'] if db_user is not None else username
`, `    if correct:
        login_username = db_user['username'] if db_user is not None else username
        if db_user is not None:
            suspension = _user_suspension_message(db_user)
            if suspension:
                return jsonify({'success': False, 'message': suspension}), 403
        if not _is_single_session_exempt(login_username):
            active = _active_session_for(login_username)
            if active:
                return jsonify({'success': False, 'active_session': True, 'message': 'هذا المستخدم مسجل دخول من جهاز آخر حالياً'}), 409
        _clear_attempts(ip)
        session['logged_in'] = True
        session['username']  = login_username
        _start_user_session(login_username)
`, 'do_login');
app = replaceOnce(app, `@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('welcome'))
`, `@app.route('/logout')
def logout():
    _clear_user_session()
    session.clear()
    return redirect(url_for('welcome'))
`, 'logout');
app = replaceOnce(app, `            "SELECT full_name, username, email, phone, job_title, approved_at, created_at FROM users WHERE approved = 1 ORDER BY approved_at DESC, id DESC"
`, `            "SELECT id, full_name, username, email, phone, job_title, approved_at, created_at, suspended_until, suspended_at, suspended_by FROM users WHERE approved = 1 ORDER BY approved_at DESC, id DESC"
`, 'users select');
app = replaceOnce(app, `                'full_name': row['full_name'],
                'username': row['username'],
                'email': row['email'],
                'phone': row['phone'],
                'job_title': row['job_title'],
                'approved_at': row['approved_at'],
                'created_at': row['created_at'],
            }
`, `                'id': row['id'],
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
`, 'users payload');
const usersBlock = `    return jsonify({
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
`;
const adminActions = usersBlock + `

@app.route('/api/admin/registered_users/<int:user_id>/suspend', methods=['POST'])
@zone_required
def api_admin_suspend_user(user_id):
    if session.get('zone') != 'dev':
        return jsonify({'error': 'غير مصرح'}), 403
    data = request.get_json(silent=True) or {}
    try:
        hours = float(data.get('hours', 0))
    except Exception:
        hours = 0
    if hours <= 0:
        return jsonify({'success': False, 'message': 'مدة الإيقاف غير صحيحة'}), 400
    until = (datetime.now() + timedelta(hours=hours)).strftime('%Y-%m-%d %H:%M:%S')
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    admin_user = session.get('username', '')
    with _db_connect() as conn:
        row = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'المستخدم غير موجود'}), 404
        if _is_single_session_exempt(row['username']):
            return jsonify({'success': False, 'message': 'لا يمكن إيقاف حساب الأدمن أو الديف من هنا'}), 400
        conn.execute("UPDATE users SET suspended_until = ?, suspended_at = ?, suspended_by = ? WHERE id = ?", (until, now, admin_user, user_id))
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
        conn.execute("UPDATE users SET suspended_until = NULL, suspended_at = NULL, suspended_by = NULL WHERE id = ?", (user_id,))
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
`;
app = replaceOnce(app, usersBlock, adminActions, 'admin actions');
await writeFile(out.app, app, 'utf8');

let index = await readFile(files.index, 'utf8');
index = replaceOnce(index, `  #reportsBtn { background:linear-gradient(135deg, rgba(245,158,11,.24), rgba(16,185,129,.16)); border-color:rgba(245,158,11,.6); color:var(--accent-amber); }\n  #reportsBtn:hover { background: rgba(245,158,11,.32); color: var(--accent-amber); transform: scale(1.1); box-shadow: 0 6px 20px rgba(245,158,11,0.28); }\n`, `  #reportsBtn { background:linear-gradient(135deg, rgba(20,184,166,.22), rgba(6,182,212,.14)); border-color:rgba(20,184,166,.58); color:#5eead4; }\n  #reportsBtn:hover { background: rgba(20,184,166,.30); color: #ccfbf1; transform: scale(1.1); box-shadow: 0 6px 20px rgba(20,184,166,0.28); }\n`, 'reports button');
index = replaceOnce(index, `  #adminRequestsBtn { background: linear-gradient(135deg, rgba(139,92,246,.22), rgba(124,58,237,.14)); border-color: rgba(139,92,246,.58); color: #c4b5fd; }\n  #adminRequestsBtn:hover { background: rgba(139,92,246,.34); color: #fff; transform: scale(1.1); box-shadow: 0 6px 20px rgba(139,92,246,0.25); }\n  #adminUsersBtn { background: rgba(139,92,246,0.14); border-color: rgba(139,92,246,0.48); color: #c4b5fd; }\n  #adminUsersBtn:hover { background: var(--accent-purple); color: #fff; transform: scale(1.1); box-shadow: 0 6px 20px rgba(139,92,246,0.28); }\n`, `  @keyframes adminPulse { 0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.34);} 50%{box-shadow:0 0 0 8px rgba(139,92,246,0);} }\n  #adminRequestsBtn { background: linear-gradient(135deg, rgba(139,92,246,.22), rgba(124,58,237,.14)); border-color: rgba(139,92,246,.58); color: #c4b5fd; animation: adminPulse 1.8s ease-in-out infinite; }\n  #adminRequestsBtn:hover { background: rgba(139,92,246,.34); color: #fff; transform: scale(1.1); box-shadow: 0 6px 20px rgba(139,92,246,0.25); }\n  #adminUsersBtn { background: rgba(6,182,212,0.14); border-color: rgba(6,182,212,0.48); color: #67e8f9; animation: adminPulse 1.8s ease-in-out infinite; }\n  #adminUsersBtn:hover { background: var(--accent-cyan); color: #06131a; transform: scale(1.1); box-shadow: 0 6px 20px rgba(6,182,212,0.28); }\n`, 'admin buttons');
index = replaceOnce(index, `  .users-empty {\n    text-align: center; padding: 40px; color: var(--text-dim); font-size: 13px;\n  }\n`, `  .users-empty {\n    text-align: center; padding: 40px; color: var(--text-dim); font-size: 13px;\n  }\n  #adminRequestsModal, #adminUsersModal {\n    display: none; position: fixed; inset: 0; z-index: 9500;\n    background: rgba(0,0,0,0.62); backdrop-filter: blur(7px);\n    align-items: center; justify-content: center; padding: 18px;\n  }\n  #adminRequestsModal.open, #adminUsersModal.open { display:flex; }\n  .admin-user-list { display:grid; gap:10px; padding:14px; }\n  .admin-user-row { width:100%; text-align:start; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:13px 14px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); color:var(--text-main); cursor:pointer; }\n  .admin-user-row:hover { background:var(--bg-hover); border-color:var(--border-light); }\n  .admin-user-name { font-weight:800; overflow-wrap:anywhere; }\n  .admin-user-meta { font-size:11px; color:var(--text-muted); font-family:'JetBrains Mono',monospace; }\n  .admin-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; padding:14px; }\n  .admin-detail-item { border:1px solid var(--border); background:var(--bg-card); border-radius:10px; padding:10px 12px; }\n  .admin-detail-label { font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.7px; margin-bottom:5px; }\n  .admin-detail-value { font-size:13px; color:var(--text-main); overflow-wrap:anywhere; }\n  .admin-detail-actions { display:flex; gap:8px; flex-wrap:wrap; padding:0 14px 16px; }\n  .admin-detail-actions input { width:120px; border-radius:9px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-main); padding:9px 10px; }\n  @media (max-width:720px){ .admin-detail-grid{grid-template-columns:1fr;} .admin-detail-actions .btn,.admin-detail-actions input{width:100%;} }\n`, 'admin modal css');
index = replaceOnce(index, `<button class="theme-btn" id="adminUsersBtn" onclick="openAdminUsersModal()" title="المستخدمون المسجلون">\n        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>\n      </button>`, `<button class="theme-btn" id="adminUsersBtn" onclick="openAdminUsersModal()" title="المستخدمون المسجلون">\n        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M19 8h3"/><path d="M20.5 6.5v3"/></svg>\n      </button>`, 'users icon');
index = replaceOnce(index, `<div class="users-body" id="adminUsersBody">\n      <div class="users-empty">Loading...</div>\n    </div>`, `<div class="users-body" id="adminUsersBody">\n      <div class="users-empty">Loading...</div>\n    </div>\n    <div class="users-body" id="adminUserDetailsBody" style="display:none;"></div>`, 'users details');
index = replaceOnce(index, `{% if is_dev %}\n(function() {\n  fetch('/api/admin/pending_requests_count', { cache: 'no-store' })\n    .then(r => r.json())\n    .then(d => setAdminRequestBadge(d.count || 0))\n    .catch(() => setAdminRequestBadge(0));\n})();\n{% endif %}`, `{% if is_dev %}\nlet _lastPendingRegistrationCount = null;\nfunction playNewRegistrationSound() {\n  const audio = new Audio('/static/newapp.mp3');\n  audio.volume = 0.75;\n  audio.play().catch(() => {});\n}\nasync function refreshPendingRegistrationCount() {\n  try {\n    const r = await fetch('/api/admin/pending_requests_count', { cache: 'no-store' });\n    const d = await r.json();\n    const count = Number(d.count || 0);\n    if (_lastPendingRegistrationCount !== null && count > _lastPendingRegistrationCount) playNewRegistrationSound();\n    _lastPendingRegistrationCount = count;\n    setAdminRequestBadge(count);\n  } catch (_) {\n    setAdminRequestBadge(0);\n  }\n}\nrefreshPendingRegistrationCount();\nsetInterval(refreshPendingRegistrationCount, 15000);\n{% endif %}`, 'pending sound');
index = replaceOnce(index, `async function loadAdminUsers() {\n  const body = document.getElementById('adminUsersBody');\n  if (!body) return;\n  body.innerHTML = '<div class="users-empty">Loading...</div>';\n  try {\n    const res = await fetch('/api/admin/registered_users', { cache: 'no-store' });\n    const data = await res.json();\n    if (!res.ok || data.error) throw new Error(data.error || 'Failed');\n    const users = data.users || [];\n    if (!users.length) {\n      body.innerHTML = '<div class="users-empty">لا يوجد مستخدمون مسجلون بعد</div>';\n      return;\n    }\n    body.innerHTML = `\n      <table class="users-table">\n        <thead>\n          <tr>\n            <th>#</th>\n            <th>الاسم</th>\n            <th>اسم المستخدم</th>\n            <th>الوظيفة</th>\n            <th>الايميل</th>\n            <th>الهاتف</th>\n            <th>تاريخ التفعيل</th>\n          </tr>\n        </thead>\n        <tbody>\n          ${users.map((u, i) => `\n            <tr>\n              <td style=\"color:var(--text-dim);font-family:'JetBrains Mono',monospace;font-size:11px;\">${i + 1}</td>\n              <td><strong>${escHtml(u.full_name || '—')}</strong></td>\n              <td>${escHtml(u.username || '—')}</td>\n              <td>${escHtml(u.job_title || '—')}</td>\n              <td>${escHtml(u.email || '—')}</td>\n              <td>${escHtml(u.phone || '—')}</td>\n              <td style=\"font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);\">${escHtml(u.approved_at || u.created_at || '—')}</td>\n            </tr>\n          `).join('')}\n        </tbody>\n      </table>`;\n  } catch (e) {\n    body.innerHTML = `<div class=\"users-empty\">فشل تحميل المستخدمين<br><span style=\"font-size:11px;color:var(--text-dim);\">${escHtml(String(e.message || e))}</span></div>`;\n  }\n}`, `let _adminRegisteredUsers = [];\n\nasync function loadAdminUsers() {\n  const body = document.getElementById('adminUsersBody');\n  const details = document.getElementById('adminUserDetailsBody');\n  if (!body) return;\n  if (details) { details.style.display = 'none'; details.innerHTML = ''; }\n  body.style.display = 'block';\n  body.innerHTML = '<div class=\"users-empty\">Loading...</div>';\n  try {\n    const res = await fetch('/api/admin/registered_users', { cache: 'no-store' });\n    const data = await res.json();\n    if (!res.ok || data.error) throw new Error(data.error || 'Failed');\n    _adminRegisteredUsers = data.users || [];\n    if (!_adminRegisteredUsers.length) {\n      body.innerHTML = '<div class=\"users-empty\">لا يوجد مستخدمون مسجلون بعد</div>';\n      return;\n    }\n    body.innerHTML = `<div class=\"admin-user-list\">\n      ${_adminRegisteredUsers.map((u, i) => `\n        <button class=\"admin-user-row\" type=\"button\" onclick=\"showAdminUserDetails(${i})\">\n          <span>\n            <span class=\"admin-user-name\">${escHtml(u.username || '—')}</span>\n            <span class=\"admin-user-meta\">${u.is_suspended ? ' | Suspended' : ''}</span>\n          </span>\n          <span class=\"admin-user-meta\">${escHtml(u.approved_at || u.created_at || '—')}</span>\n        </button>\n      `).join('')}\n    </div>`;\n  } catch (e) {\n    body.innerHTML = `<div class=\"users-empty\">فشل تحميل المستخدمين<br><span style=\"font-size:11px;color:var(--text-dim);\">${escHtml(String(e.message || e))}</span></div>`;\n  }\n}\n\nfunction showAdminUserDetails(index) {\n  const u = _adminRegisteredUsers[index];\n  const list = document.getElementById('adminUsersBody');\n  const details = document.getElementById('adminUserDetailsBody');\n  if (!u || !list || !details) return;\n  list.style.display = 'none';\n  details.style.display = 'block';\n  const fields = [\n    ['Full name', u.full_name],\n    ['Username', u.username],\n    ['Job title', u.job_title],\n    ['Email', u.email],\n    ['Phone', u.phone],\n    ['Created at', u.created_at],\n    ['Approved at', u.approved_at],\n    ['Suspended until', u.suspended_until || 'Not suspended'],\n  ];\n  details.innerHTML = `\n    <div style=\"padding:14px 14px 0;\">\n      <button class=\"dash-refresh-btn\" onclick=\"backToAdminUsersList()\" style=\"padding:6px 10px;font-size:11px;\">Back</button>\n    </div>\n    <div class=\"admin-detail-grid\">\n      ${fields.map(([label, value]) => `\n        <div class=\"admin-detail-item\">\n          <div class=\"admin-detail-label\">${escHtml(label)}</div>\n          <div class=\"admin-detail-value\">${escHtml(value || '—')}</div>\n        </div>\n      `).join('')}\n    </div>\n    <div class=\"admin-detail-actions\">\n      <input id=\"suspendHoursInput\" type=\"number\" min=\"1\" step=\"1\" value=\"24\" aria-label=\"Suspend hours\">\n      <button class=\"btn btn-purple\" onclick=\"suspendRegisteredUser(${Number(u.id)})\">إيقاف مؤقت</button>\n      <button class=\"btn btn-ghost\" onclick=\"unsuspendRegisteredUser(${Number(u.id)})\">إلغاء الإيقاف</button>\n      <button class=\"btn btn-danger\" onclick=\"deleteRegisteredUser(${Number(u.id)})\">حذف نهائي</button>\n    </div>`;\n}\n\nfunction backToAdminUsersList() {\n  document.getElementById('adminUserDetailsBody').style.display = 'none';\n  document.getElementById('adminUsersBody').style.display = 'block';\n}\n\nasync function suspendRegisteredUser(id) {\n  const hours = Number(document.getElementById('suspendHoursInput')?.value || 0);\n  if (!hours || hours <= 0) return alert('أدخل مدة الإيقاف بالساعات');\n  try {\n    const res = await fetch(`/api/admin/registered_users/${id}/suspend`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ hours }),\n    });\n    const data = await res.json();\n    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');\n    alert(data.message || 'تم الإيقاف');\n    await loadAdminUsers();\n  } catch (e) {\n    alert(e.message || 'تعذر إيقاف المستخدم');\n  }\n}\n\nasync function unsuspendRegisteredUser(id) {\n  try {\n    const res = await fetch(`/api/admin/registered_users/${id}/unsuspend`, { method: 'POST' });\n    const data = await res.json();\n    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');\n    alert(data.message || 'تم إلغاء الإيقاف');\n    await loadAdminUsers();\n  } catch (e) {\n    alert(e.message || 'تعذر إلغاء الإيقاف');\n  }\n}\n\nasync function deleteRegisteredUser(id) {\n  if (!confirm('حذف الحساب نهائياً؟ لا يمكن التراجع عن هذه العملية.')) return;\n  try {\n    const res = await fetch(`/api/admin/registered_users/${id}`, { method: 'DELETE' });\n    const data = await res.json();\n    if (!res.ok || !data.success) throw new Error(data.message || 'Failed');\n    alert(data.message || 'تم الحذف');\n    await loadAdminUsers();\n  } catch (e) {\n    alert(e.message || 'تعذر حذف المستخدم');\n  }\n}`, 'load users');
await writeFile(out.index, index, 'utf8');

let reg = await readFile(files.register, 'utf8');
reg = reg.replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">');
reg = reg.replace('border-radius: 16px;', 'border-radius: 8px;');
reg = reg.replace('  .topbar-left { display: flex; align-items: center; gap: 12px; }', `  .topbar-left { display: flex; align-items: center; gap: 12px; min-width:0; }\n  .topbar-actions { display:flex; align-items:center; gap:8px; }\n  .lang-btn { min-width:58px; height:36px; border-radius:9px; border:1px solid rgba(6,182,212,0.4); background:rgba(6,182,212,0.12); color:var(--accent-cyan); font-weight:800; cursor:pointer; }`);
reg = reg.replace('    font-size: clamp(30px, 5vw, 48px);', '    font-size: clamp(30px, 42px, 48px);');
reg = reg.replace('  @media (max-width: 720px) {\n    .page { padding: 22px 14px 48px; }', `  @media (max-width: 720px) {\n    .topbar { height:auto; min-height:58px; padding:10px 12px; gap:10px; }\n    .back-btn span, .topbar-title { max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n    .page { padding: 22px 14px 48px; }\n    .hero-title { font-size: 30px; }\n    .actions .btn { width:100%; }`);
reg = reg.replace('<button class="icon-btn" type="button" onclick="toggleTheme()"', '<div class="topbar-actions">\n  <button class="lang-btn" type="button" id="langBtn" onclick="toggleLanguage()">EN</button>\n  <button class="icon-btn" type="button" onclick="toggleTheme()"');
reg = reg.replace('  </button>\n</div>\n\n<div class="page">', '  </button>\n  </div>\n</div>\n\n<div class="page">');
reg = reg.replace('<input id="securityQuestion" dir="auto" placeholder="اكتب السؤال الأمني الذي ستستخدمه لاحقاً">', '<select id="securityQuestion" dir="auto"></select>');
reg = reg.replace('<script>', `<script>\nconst i18n = {\n  en: { htmlDir:'ltr', back:'Back', title:'Registration', kicker:'EST-iMs / Registration', hero:'New Employee Registration', sub:'Fill in the required information. The request will appear for the admin to approve before the account can sign in.', section:'Registration Details', fullName:'Full Name', username:'Username', email:'Email', phone:'Phone', job:'Job Title', password:'Password', confirm:'Confirm Password', securityQuestion:'Security Question', securityAnswer:'Security Answer', captcha:'Captcha', captchaHelp:'Solve the captcha to confirm this request is real.', reload:'Reload', submit:'Send Request', sending:'Sending...', loginBack:'Back to Login', footer:'EST-iMs | Registration requests are saved in SQLite and wait for admin approval.' },\n  ar: { htmlDir:'rtl', back:'العودة', title:'التسجيل', kicker:'EST-iMs / التسجيل', hero:'طلب تسجيل موظف جديد', sub:'أدخل البيانات المطلوبة كاملة. بعد الإرسال سيظهر الطلب عند الأدمن للموافقة قبل تفعيل الحساب.', section:'بيانات التسجيل', fullName:'الاسم الكامل', username:'اسم المستخدم', email:'الإيميل', phone:'رقم الهاتف', job:'وظيفته في الشركة', password:'كلمة المرور', confirm:'تأكيد كلمة المرور', securityQuestion:'السؤال الأمني', securityAnswer:'إجابة السؤال الأمني', captcha:'كابتشا', captchaHelp:'حل الكابتشا للتأكد من أن الطلب يتم من شخص حقيقي.', reload:'تحديث', submit:'إرسال الطلب', sending:'جاري الإرسال...', loginBack:'العودة للدخول', footer:'EST-iMs | طلبات التسجيل تحفظ في SQLite وتنتظر موافقة الأدمن.' }\n};\n`);
reg = reg.replace(`function toggleTheme() {\n  const isLight = document.documentElement.classList.toggle('light');\n  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');\n}`, `function toggleTheme() {\n  const isLight = document.documentElement.classList.toggle('light');\n  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');\n}\nlet currentLang = localStorage.getItem('est-auth-lang') || 'en';\nfunction applyLanguage() {\n  const t = i18n[currentLang] || i18n.en;\n  document.documentElement.lang = currentLang;\n  document.documentElement.dir = t.htmlDir;\n  document.getElementById('langBtn').textContent = currentLang.toUpperCase();\n  const labels = document.querySelectorAll('.field label');\n  [t.fullName,t.username,t.email,t.phone,t.job,t.password,t.confirm,t.securityQuestion,t.securityAnswer,t.captcha].forEach((v,i)=>{ if(labels[i]) labels[i].textContent = v; });\n  document.querySelector('.back-btn span').textContent = t.back;\n  document.querySelector('.topbar-title').textContent = t.title;\n  document.querySelector('.hero-kicker span:last-child').textContent = t.kicker;\n  document.querySelector('.hero-title').textContent = t.hero;\n  document.querySelector('.hero-sub').textContent = t.sub;\n  document.querySelector('.section-title').textContent = t.section;\n  document.getElementById('reloadCaptchaBtn').textContent = t.reload;\n  document.getElementById('submitBtn').textContent = t.submit;\n  document.querySelector('.actions .btn-ghost').textContent = t.loginBack;\n  document.querySelector('.helper').textContent = t.captchaHelp;\n  document.querySelector('.footer-note').textContent = t.footer;\n}\nfunction toggleLanguage() { currentLang = currentLang === 'en' ? 'ar' : 'en'; localStorage.setItem('est-auth-lang', currentLang); applyLanguage(); }`);
reg = reg.replace("let captchaToken = '';", `async function loadSecurityQuestions() {\n  const select = document.getElementById('securityQuestion');\n  if (!select) return;\n  const res = await fetch('/api/security_questions', { cache: 'no-store' });\n  const data = await res.json();\n  select.innerHTML = (data.questions || []).map(q => '<option value=\"' + q.replace(/\"/g, '&quot;') + '\">' + q + '</option>').join('');\n}\nlet captchaToken = '';`);
reg = reg.replace('loadCaptcha().catch(() => setStatus', 'applyLanguage();\nloadSecurityQuestions().catch(() => {});\nloadCaptcha().catch(() => setStatus');
reg = reg.replace("btn.textContent = 'جاري الإرسال...';", "btn.textContent = i18n[currentLang].sending;");
reg = reg.replace("btn.textContent = 'إرسال الطلب';", "btn.textContent = i18n[currentLang].submit;");
await writeFile(out.register, reg, 'utf8');

let forgot = await readFile(files.forgot, 'utf8');
forgot = forgot.replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">');
forgot = forgot.replace('border-radius: 16px;', 'border-radius: 8px;');
forgot = forgot.replace('  .topbar-left { display: flex; align-items: center; gap: 12px; }', `  .topbar-left { display: flex; align-items: center; gap: 12px; min-width:0; }\n  .topbar-actions { display:flex; align-items:center; gap:8px; }\n  .lang-btn { min-width:58px; height:36px; border-radius:9px; border:1px solid rgba(6,182,212,0.4); background:rgba(6,182,212,0.12); color:var(--accent-cyan); font-weight:800; cursor:pointer; }`);
forgot = forgot.replace('    font-size: clamp(30px, 5vw, 48px);', '    font-size: clamp(30px, 42px, 48px);');
forgot = forgot.replace('  @media (max-width: 720px) {\n    .page { padding: 22px 14px 48px; }', `  @media (max-width: 720px) {\n    .topbar { height:auto; min-height:58px; padding:10px 12px; gap:10px; }\n    .back-btn span, .topbar-title { max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n    .page { padding: 22px 14px 48px; }\n    .hero-title { font-size: 30px; }\n    .actions .btn { width:100%; }`);
forgot = forgot.replace('<button class="icon-btn" type="button" onclick="toggleTheme()"', '<div class="topbar-actions">\n  <button class="lang-btn" type="button" id="langBtn" onclick="toggleLanguage()">EN</button>\n  <button class="icon-btn" type="button" onclick="toggleTheme()"');
forgot = forgot.replace('  </button>\n</div>\n\n<div class="page">', '  </button>\n  </div>\n</div>\n\n<div class="page">');
forgot = forgot.replace('<input id="securityQuestion" dir="auto" placeholder="اكتب السؤال كما تم حفظه">', '<select id="securityQuestion" dir="auto"></select>');
forgot = forgot.replace('<script>', `<script>\nconst i18n = {\n  en: { htmlDir:'ltr', back:'Back', title:'Password Recovery', kicker:'EST-iMs / Recovery', hero:'Password Recovery', sub:'Verify your username and security answer, then set a new password.', step1Title:'Initial Verification', step1:'Step One', username:'Username', oldPassword:'Old Password', securityQuestion:'Security Question', answer:'Answer', verify:'Verify', loginBack:'Back to Login', step2Title:'Change Password', step2:'Step Two', newPassword:'New Password', confirmPassword:'Confirm New Password', save:'Save Password' },\n  ar: { htmlDir:'rtl', back:'العودة', title:'استرجاع كلمة المرور', kicker:'EST-iMs / الاسترجاع', hero:'استرجاع كلمة المرور', sub:'تحقق من اسم المستخدم وجواب السؤال الأمني، ثم عين كلمة مرور جديدة.', step1Title:'التحقق الأولي', step1:'المرحلة الأولى', username:'اسم المستخدم', oldPassword:'كلمة السر القديمة', securityQuestion:'السؤال الأمني', answer:'الجواب', verify:'تحقق', loginBack:'العودة للدخول', step2Title:'تغيير كلمة المرور', step2:'المرحلة الثانية', newPassword:'كلمة المرور الجديدة', confirmPassword:'تأكيد كلمة المرور الجديدة', save:'حفظ كلمة المرور' }\n};\n`);
forgot = forgot.replace(`function toggleTheme() {\n  const isLight = document.documentElement.classList.toggle('light');\n  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');\n}`, `function toggleTheme() {\n  const isLight = document.documentElement.classList.toggle('light');\n  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');\n}\nlet currentLang = localStorage.getItem('est-auth-lang') || 'en';\nfunction applyLanguage() {\n  const t = i18n[currentLang] || i18n.en;\n  document.documentElement.lang = currentLang;\n  document.documentElement.dir = t.htmlDir;\n  document.getElementById('langBtn').textContent = currentLang.toUpperCase();\n  document.querySelector('.back-btn span').textContent = t.back;\n  document.querySelector('.topbar-title').textContent = t.title;\n  document.querySelector('.hero-kicker span:last-child').textContent = t.kicker;\n  document.querySelector('.hero-title').textContent = t.hero;\n  document.querySelector('.hero-sub').textContent = t.sub;\n  document.querySelector('#step1Box .section-title').textContent = t.step1Title;\n  document.querySelector('#step1Box .step-chip').textContent = t.step1;\n  document.querySelector('#step2Box .section-title').textContent = t.step2Title;\n  document.querySelector('#step2Box .step-chip').textContent = t.step2;\n  const labels = document.querySelectorAll('.field label');\n  [t.username,t.oldPassword,t.securityQuestion,t.answer,t.newPassword,t.confirmPassword].forEach((v,i)=>{ if(labels[i]) labels[i].textContent = v; });\n  document.getElementById('verifyBtn').textContent = t.verify;\n  document.querySelector('#step1Box .btn-ghost').textContent = t.loginBack;\n  document.getElementById('saveBtn').textContent = t.save;\n}\nfunction toggleLanguage() { currentLang = currentLang === 'en' ? 'ar' : 'en'; localStorage.setItem('est-auth-lang', currentLang); applyLanguage(); }`);
forgot = forgot.replace("function setStatus(id, msg, ok) {", "async function loadSecurityQuestions() {\n  const select = document.getElementById('securityQuestion');\n  if (!select) return;\n  const res = await fetch('/api/security_questions', { cache: 'no-store' });\n  const data = await res.json();\n  select.innerHTML = (data.questions || []).map(q => '<option value=\"' + q.replace(/\"/g, '&quot;') + '\">' + q + '</option>').join('');\n}\n\nfunction setStatus(id, msg, ok) {");
forgot = forgot.replace('</script>\n</body>', 'applyLanguage();\nloadSecurityQuestions().catch(() => {});\n</script>\n</body>');
await writeFile(out.forgot, forgot, 'utf8');

console.log(JSON.stringify(out, null, 2));
