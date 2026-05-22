$ErrorActionPreference = "Stop"
$Root = "C:\Users\hamza\Desktop\EST-IMS Online\est-ims"
$App = Join-Path $Root "app.py"
$Index = Join-Path $Root "templates\index.html"
$Register = Join-Path $Root "templates\register.html"
$Forgot = Join-Path $Root "templates\forgot_password.html"

function Read-Utf8($Path) {
  [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}
function Write-Utf8($Path, $Text) {
  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}
function Replace-Once([string]$Text, [string]$Old, [string]$New, [string]$Label) {
  if (-not $Text.Contains($Old)) { throw "Missing block: $Label" }
  $idx = $Text.IndexOf($Old)
  return $Text.Substring(0, $idx) + $New + $Text.Substring($idx + $Old.Length)
}

$appText = Read-Utf8 $App
$appText = Replace-Once $appText "from datetime import datetime`n" "from datetime import datetime, timedelta`n" "datetime import"
$appText = Replace-Once $appText @'
AUTH_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'auth.sqlite3')


def _normalize_username(value):
'@ @'
AUTH_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'auth.sqlite3')

SECURITY_QUESTIONS = [
    'What was the name of your first school?',
    'What is your favorite childhood nickname?',
    'What city were you born in?',
    'What is your favorite teacher name?',
    'What is the name of your first pet?',
    'What is your favorite food?',
]
SINGLE_SESSION_EXEMPT_USERS = {'admin', 'dev', 'mlo5', 'ink'}


def _normalize_username(value):
'@ "constants"

$appText = Replace-Once $appText @'
def _db_connect():
    conn = sqlite3.connect(AUTH_DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def _init_auth_db():
'@ @'
def _db_connect():
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


def _init_auth_db():
'@ "db helpers"

$appText = Replace-Once $appText @'
                approved_at TEXT,
                created_by TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS registration_requests
'@ @'
                approved_at TEXT,
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
            CREATE TABLE IF NOT EXISTS registration_requests
'@ "schema"

$appText = Replace-Once $appText @'
@app.route('/api/captcha')
def api_captcha():
'@ @'
@app.route('/api/security_questions')
def api_security_questions():
    return jsonify({'questions': SECURITY_QUESTIONS})

@app.route('/api/captcha')
def api_captcha():
'@ "security questions"

$appText = Replace-Once $appText @'
        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
'@ @'
        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login_page'))
        if not _session_is_current():
            session.clear()
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'تم تسجيل الدخول من جهاز آخر، تم إنهاء هذه الجلسة'}), 409
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
'@ "login_required"

$appText = Replace-Once $appText @'
        if not session.get('logged_in'):
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login_page'))
        if not session.get('zone'):
            return redirect(url_for('zones_page'))
        return f(*args, **kwargs)
'@ @'
        if not session.get('logged_in'):
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
'@ "zone_required"

$appText = Replace-Once $appText @'
    if correct:
        _clear_attempts(ip)
        session['logged_in'] = True
        session['username']  = db_user['username'] if db_user is not None else username
'@ @'
    if correct:
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
'@ "login"

$appText = Replace-Once $appText @'
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('welcome'))
'@ @'
@app.route('/logout')
def logout():
    _clear_user_session()
    session.clear()
    return redirect(url_for('welcome'))
'@ "logout"

$appText = Replace-Once $appText @'
            "SELECT full_name, username, email, phone, job_title, approved_at, created_at FROM users WHERE approved = 1 ORDER BY approved_at DESC, id DESC"
'@ @'
            "SELECT id, full_name, username, email, phone, job_title, approved_at, created_at, suspended_until, suspended_at, suspended_by FROM users WHERE approved = 1 ORDER BY approved_at DESC, id DESC"
'@ "registered users select"

$appText = Replace-Once $appText @'
                'full_name': row['full_name'],
                'username': row['username'],
                'email': row['email'],
                'phone': row['phone'],
                'job_title': row['job_title'],
                'approved_at': row['approved_at'],
                'created_at': row['created_at'],
            }
'@ @'
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
'@ "registered users payload"

$usersReturn = @'
    return jsonify({
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
'@
$adminActions = $usersReturn + @'

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
'@
$appText = Replace-Once $appText $usersReturn $adminActions "admin user actions"
Write-Utf8 $App $appText

$indexText = Read-Utf8 $Index
$indexText = Replace-Once $indexText @'
  #reportsBtn { background:linear-gradient(135deg, rgba(245,158,11,.24), rgba(16,185,129,.16)); border-color:rgba(245,158,11,.6); color:var(--accent-amber); }
  #reportsBtn:hover { background: rgba(245,158,11,.32); color: var(--accent-amber); transform: scale(1.1); box-shadow: 0 6px 20px rgba(245,158,11,0.28); }
'@ @'
  #reportsBtn { background:linear-gradient(135deg, rgba(20,184,166,.22), rgba(6,182,212,.14)); border-color:rgba(20,184,166,.58); color:#5eead4; }
  #reportsBtn:hover { background: rgba(20,184,166,.30); color: #ccfbf1; transform: scale(1.1); box-shadow: 0 6px 20px rgba(20,184,166,0.28); }
'@ "reports button"

$indexText = Replace-Once $indexText @'
  #adminRequestsBtn { background: linear-gradient(135deg, rgba(139,92,246,.22), rgba(124,58,237,.14)); border-color: rgba(139,92,246,.58); color: #c4b5fd; }
  #adminRequestsBtn:hover { background: rgba(139,92,246,.34); color: #fff; transform: scale(1.1); box-shadow: 0 6px 20px rgba(139,92,246,0.25); }
  #adminUsersBtn { background: rgba(139,92,246,0.14); border-color: rgba(139,92,246,0.48); color: #c4b5fd; }
  #adminUsersBtn:hover { background: var(--accent-purple); color: #fff; transform: scale(1.1); box-shadow: 0 6px 20px rgba(139,92,246,0.28); }
'@ @'
  @keyframes adminPulse { 0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.34);} 50%{box-shadow:0 0 0 8px rgba(139,92,246,0);} }
  #adminRequestsBtn { background: linear-gradient(135deg, rgba(139,92,246,.22), rgba(124,58,237,.14)); border-color: rgba(139,92,246,.58); color: #c4b5fd; animation: adminPulse 1.8s ease-in-out infinite; }
  #adminRequestsBtn:hover { background: rgba(139,92,246,.34); color: #fff; transform: scale(1.1); box-shadow: 0 6px 20px rgba(139,92,246,0.25); }
  #adminUsersBtn { background: rgba(6,182,212,0.14); border-color: rgba(6,182,212,0.48); color: #67e8f9; animation: adminPulse 1.8s ease-in-out infinite; }
  #adminUsersBtn:hover { background: var(--accent-cyan); color: #06131a; transform: scale(1.1); box-shadow: 0 6px 20px rgba(6,182,212,0.28); }
'@ "admin buttons"

$indexText = Replace-Once $indexText @'
  .users-empty {
    text-align: center; padding: 40px; color: var(--text-dim); font-size: 13px;
  }
'@ @'
  .users-empty {
    text-align: center; padding: 40px; color: var(--text-dim); font-size: 13px;
  }
  #adminRequestsModal, #adminUsersModal {
    display: none; position: fixed; inset: 0; z-index: 9500;
    background: rgba(0,0,0,0.62); backdrop-filter: blur(7px);
    align-items: center; justify-content: center; padding: 18px;
  }
  #adminRequestsModal.open, #adminUsersModal.open { display:flex; }
  .admin-user-list { display:grid; gap:10px; padding:14px; }
  .admin-user-row { width:100%; text-align:start; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:13px 14px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); color:var(--text-main); cursor:pointer; }
  .admin-user-row:hover { background:var(--bg-hover); border-color:var(--border-light); }
  .admin-user-name { font-weight:800; overflow-wrap:anywhere; }
  .admin-user-meta { font-size:11px; color:var(--text-muted); font-family:'JetBrains Mono',monospace; }
  .admin-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; padding:14px; }
  .admin-detail-item { border:1px solid var(--border); background:var(--bg-card); border-radius:10px; padding:10px 12px; }
  .admin-detail-label { font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.7px; margin-bottom:5px; }
  .admin-detail-value { font-size:13px; color:var(--text-main); overflow-wrap:anywhere; }
  .admin-detail-actions { display:flex; gap:8px; flex-wrap:wrap; padding:0 14px 16px; }
  .admin-detail-actions input { width:120px; border-radius:9px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-main); padding:9px 10px; }
  @media (max-width:720px){ .admin-detail-grid{grid-template-columns:1fr;} .admin-detail-actions .btn,.admin-detail-actions input{width:100%;} }
'@ "admin modal css"

$indexText = Replace-Once $indexText @'
      <button class="theme-btn" id="adminUsersBtn" onclick="openAdminUsersModal()" title="المستخدمون المسجلون">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </button>
'@ @'
      <button class="theme-btn" id="adminUsersBtn" onclick="openAdminUsersModal()" title="المستخدمون المسجلون">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M19 8h3"/><path d="M20.5 6.5v3"/></svg>
      </button>
'@ "admin users icon"

$indexText = Replace-Once $indexText @'
    <div class="users-body" id="adminUsersBody">
      <div class="users-empty">Loading...</div>
    </div>
'@ @'
    <div class="users-body" id="adminUsersBody">
      <div class="users-empty">Loading...</div>
    </div>
    <div class="users-body" id="adminUserDetailsBody" style="display:none;"></div>
'@ "admin users details body"

$indexText = Replace-Once $indexText @'
{% if is_dev %}
(function() {
  fetch('/api/admin/pending_requests_count', { cache: 'no-store' })
    .then(r => r.json())
    .then(d => setAdminRequestBadge(d.count || 0))
    .catch(() => setAdminRequestBadge(0));
})();
{% endif %}
'@ @'
{% if is_dev %}
let _lastPendingRegistrationCount = null;
function playNewRegistrationSound() {
  const audio = new Audio('/static/newapp.mp3');
  audio.volume = 0.75;
  audio.play().catch(() => {});
}
async function refreshPendingRegistrationCount() {
  try {
    const r = await fetch('/api/admin/pending_requests_count', { cache: 'no-store' });
    const d = await r.json();
    const count = Number(d.count || 0);
    if (_lastPendingRegistrationCount !== null && count > _lastPendingRegistrationCount) playNewRegistrationSound();
    _lastPendingRegistrationCount = count;
    setAdminRequestBadge(count);
  } catch (_) {
    setAdminRequestBadge(0);
  }
}
refreshPendingRegistrationCount();
setInterval(refreshPendingRegistrationCount, 15000);
{% endif %}
'@ "pending sound"

$oldLoadUsers = @'
async function loadAdminUsers() {
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
'@
$newLoadUsers = @'
let _adminRegisteredUsers = [];

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
'@
$indexText = Replace-Once $indexText $oldLoadUsers $newLoadUsers "load admin users"
Write-Utf8 $Index $indexText

function Patch-AuthPage($Path, [bool]$IsRegister) {
  $text = Read-Utf8 $Path
  $text = $text.Replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">')
  $text = $text.Replace('  .topbar-left { display: flex; align-items: center; gap: 12px; }', '  .topbar-left { display: flex; align-items: center; gap: 12px; min-width:0; }
  .topbar-actions { display:flex; align-items:center; gap:8px; }
  .lang-btn { min-width:58px; height:36px; border-radius:9px; border:1px solid rgba(6,182,212,0.4); background:rgba(6,182,212,0.12); color:var(--accent-cyan); font-weight:800; cursor:pointer; }')
  $text = $text.Replace('    border-radius: 16px;', '    border-radius: 8px;')
  $text = $text.Replace('    font-size: clamp(30px, 5vw, 48px);', '    font-size: clamp(30px, 42px, 48px);')
  $text = $text.Replace('  @media (max-width: 720px) {
    .page { padding: 22px 14px 48px; }', '  @media (max-width: 720px) {
    .topbar { height:auto; min-height:58px; padding:10px 12px; gap:10px; }
    .back-btn span, .topbar-title { max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .page { padding: 22px 14px 48px; }
    .hero-title { font-size: 30px; }
    .actions .btn { width:100%; }')
  $text = $text.Replace('  <button class="icon-btn" type="button" onclick="toggleTheme()"', '  <div class="topbar-actions">
  <button class="lang-btn" type="button" id="langBtn" onclick="toggleLanguage()">EN</button>
  <button class="icon-btn" type="button" onclick="toggleTheme()"')
  $text = $text.Replace('  </button>
</div>

<div class="page">', '  </button>
  </div>
</div>

<div class="page">')
  if ($IsRegister) {
    $text = $text.Replace('<input id="securityQuestion" dir="auto" placeholder="اكتب السؤال الأمني الذي ستستخدمه لاحقاً">', '<select id="securityQuestion" dir="auto"></select>')
    $text = $text.Replace('<input id="securityQuestion" dir="auto" placeholder="Ø§ÙƒØªØ¨ Ø§Ù„Ø³Ø¤Ø§Ù„ Ø§Ù„Ø£Ù…Ù†ÙŠ Ø§Ù„Ø°ÙŠ Ø³ØªØ³ØªØ®Ø¯Ù…Ù‡ Ù„Ø§Ø­Ù‚Ø§Ù‹">', '<select id="securityQuestion" dir="auto"></select>')
    $text = $text.Replace('<script>', @'
<script>
const i18n = {
  en: { htmlDir:'ltr', back:'Back', title:'Registration', kicker:'EST-iMs / Registration', hero:'New Employee Registration', sub:'Fill in the required information. The request will appear for the admin to approve before the account can sign in.', section:'Registration Details', fullName:'Full Name', username:'Username', email:'Email', phone:'Phone', job:'Job Title', password:'Password', confirm:'Confirm Password', securityQuestion:'Security Question', securityAnswer:'Security Answer', captcha:'Captcha', captchaHelp:'Solve the captcha to confirm this request is real.', reload:'Reload', submit:'Send Request', sending:'Sending...', loginBack:'Back to Login', footer:'EST-iMs | Registration requests are saved in SQLite and wait for admin approval.' },
  ar: { htmlDir:'rtl', back:'العودة', title:'التسجيل', kicker:'EST-iMs / التسجيل', hero:'طلب تسجيل موظف جديد', sub:'أدخل البيانات المطلوبة كاملة. بعد الإرسال سيظهر الطلب عند الأدمن للموافقة قبل تفعيل الحساب.', section:'بيانات التسجيل', fullName:'الاسم الكامل', username:'اسم المستخدم', email:'الإيميل', phone:'رقم الهاتف', job:'وظيفته في الشركة', password:'كلمة المرور', confirm:'تأكيد كلمة المرور', securityQuestion:'السؤال الأمني', securityAnswer:'إجابة السؤال الأمني', captcha:'كابتشا', captchaHelp:'حل الكابتشا للتأكد من أن الطلب يتم من شخص حقيقي.', reload:'تحديث', submit:'إرسال الطلب', sending:'جاري الإرسال...', loginBack:'العودة للدخول', footer:'EST-iMs | طلبات التسجيل تحفظ في SQLite وتنتظر موافقة الأدمن.' }
};
'@)
    $text = $text.Replace("function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}", "function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}
let currentLang = localStorage.getItem('est-auth-lang') || 'en';
function applyLanguage() {
  const t = i18n[currentLang] || i18n.en;
  document.documentElement.lang = currentLang;
  document.documentElement.dir = t.htmlDir;
  document.getElementById('langBtn').textContent = currentLang.toUpperCase();
  const labels = document.querySelectorAll('.field label');
  [t.fullName,t.username,t.email,t.phone,t.job,t.password,t.confirm,t.securityQuestion,t.securityAnswer,t.captcha].forEach((v,i)=>{ if(labels[i]) labels[i].textContent = v; });
  document.querySelector('.back-btn span').textContent = t.back;
  document.querySelector('.topbar-title').textContent = t.title;
  document.querySelector('.hero-kicker span:last-child').textContent = t.kicker;
  document.querySelector('.hero-title').textContent = t.hero;
  document.querySelector('.hero-sub').textContent = t.sub;
  document.querySelector('.section-title').textContent = t.section;
  document.getElementById('reloadCaptchaBtn').textContent = t.reload;
  document.getElementById('submitBtn').textContent = t.submit;
  document.querySelector('.actions .btn-ghost').textContent = t.loginBack;
  document.querySelector('.helper').textContent = t.captchaHelp;
  document.querySelector('.footer-note').textContent = t.footer;
}
function toggleLanguage() { currentLang = currentLang === 'en' ? 'ar' : 'en'; localStorage.setItem('est-auth-lang', currentLang); applyLanguage(); }")
    $text = $text.Replace("let captchaToken = '';", "async function loadSecurityQuestions() {
  const select = document.getElementById('securityQuestion');
  if (!select) return;
  const res = await fetch('/api/security_questions', { cache: 'no-store' });
  const data = await res.json();
  select.innerHTML = (data.questions || []).map(q => `<option value=`"${q.replace(/`"/g, '&quot;')}`">${q}</option>`).join('');
}
let captchaToken = '';")
    $text = $text.Replace("loadCaptcha().catch(() => setStatus", "applyLanguage();
loadSecurityQuestions().catch(() => {});
loadCaptcha().catch(() => setStatus")
    $text = $text.Replace("btn.textContent = 'Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„...';", "btn.textContent = i18n[currentLang].sending;")
    $text = $text.Replace("btn.textContent = 'Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨';", "btn.textContent = i18n[currentLang].submit;")
  } else {
    $text = $text.Replace('  .field input, .field textarea {', '  .field input, .field textarea, .field select {')
    $text = $text.Replace('  .field input:focus, .field textarea:focus {', '  .field input:focus, .field textarea:focus, .field select:focus {')
    $text = $text.Replace('<input id="securityQuestion" dir="auto" placeholder="اكتب السؤال كما تم حفظه">', '<select id="securityQuestion" dir="auto"></select>')
    $text = $text.Replace('<input id="securityQuestion" dir="auto" placeholder="Ø§ÙƒØªØ¨ Ø§Ù„Ø³Ø¤Ø§Ù„ ÙƒÙ…Ø§ ØªÙ… Ø­ÙØ¸Ù‡">', '<select id="securityQuestion" dir="auto"></select>')
    $text = $text.Replace('<script>', @'
<script>
const i18n = {
  en: { htmlDir:'ltr', back:'Back', title:'Password Recovery', kicker:'EST-iMs / Recovery', hero:'Password Recovery', sub:'Verify your username and security answer, then set a new password.', step1Title:'Initial Verification', step1:'Step One', username:'Username', oldPassword:'Old Password', securityQuestion:'Security Question', answer:'Answer', verify:'Verify', loginBack:'Back to Login', step2Title:'Change Password', step2:'Step Two', newPassword:'New Password', confirmPassword:'Confirm New Password', save:'Save Password' },
  ar: { htmlDir:'rtl', back:'العودة', title:'استرجاع كلمة المرور', kicker:'EST-iMs / الاسترجاع', hero:'استرجاع كلمة المرور', sub:'تحقق من اسم المستخدم وجواب السؤال الأمني، ثم عين كلمة مرور جديدة.', step1Title:'التحقق الأولي', step1:'المرحلة الأولى', username:'اسم المستخدم', oldPassword:'كلمة السر القديمة', securityQuestion:'السؤال الأمني', answer:'الجواب', verify:'تحقق', loginBack:'العودة للدخول', step2Title:'تغيير كلمة المرور', step2:'المرحلة الثانية', newPassword:'كلمة المرور الجديدة', confirmPassword:'تأكيد كلمة المرور الجديدة', save:'حفظ كلمة المرور' }
};
'@)
    $text = $text.Replace("function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}", "function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
}
let currentLang = localStorage.getItem('est-auth-lang') || 'en';
function applyLanguage() {
  const t = i18n[currentLang] || i18n.en;
  document.documentElement.lang = currentLang;
  document.documentElement.dir = t.htmlDir;
  document.getElementById('langBtn').textContent = currentLang.toUpperCase();
  document.querySelector('.back-btn span').textContent = t.back;
  document.querySelector('.topbar-title').textContent = t.title;
  document.querySelector('.hero-kicker span:last-child').textContent = t.kicker;
  document.querySelector('.hero-title').textContent = t.hero;
  document.querySelector('.hero-sub').textContent = t.sub;
  document.querySelector('#step1Box .section-title').textContent = t.step1Title;
  document.querySelector('#step1Box .step-chip').textContent = t.step1;
  document.querySelector('#step2Box .section-title').textContent = t.step2Title;
  document.querySelector('#step2Box .step-chip').textContent = t.step2;
  const labels = document.querySelectorAll('.field label');
  [t.username,t.oldPassword,t.securityQuestion,t.answer,t.newPassword,t.confirmPassword].forEach((v,i)=>{ if(labels[i]) labels[i].textContent = v; });
  document.getElementById('verifyBtn').textContent = t.verify;
  document.querySelector('#step1Box .btn-ghost').textContent = t.loginBack;
  document.getElementById('saveBtn').textContent = t.save;
}
function toggleLanguage() { currentLang = currentLang === 'en' ? 'ar' : 'en'; localStorage.setItem('est-auth-lang', currentLang); applyLanguage(); }")
    $text = $text.Replace("function setStatus(id, msg, ok) {", "async function loadSecurityQuestions() {
  const select = document.getElementById('securityQuestion');
  if (!select) return;
  const res = await fetch('/api/security_questions', { cache: 'no-store' });
  const data = await res.json();
  select.innerHTML = (data.questions || []).map(q => `<option value=`"${q.replace(/`"/g, '&quot;')}`">${q}</option>`).join('');
}

function setStatus(id, msg, ok) {")
    $text = $text.Replace("</script>`n</body>", "applyLanguage();`nloadSecurityQuestions().catch(() => {});`n</script>`n</body>")
  }
  Write-Utf8 $Path $text
}
Patch-AuthPage $Register $true
Patch-AuthPage $Forgot $false

Write-Output "Patched EST-IMS files."
