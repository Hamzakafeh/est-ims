"""
EST Inventory Management System
Alestesharia Animal Nutrition
"""
from dotenv import load_dotenv
load_dotenv()

import os
import json
import threading
import warnings
import queue as _queue

from flask import Flask, Response, send_from_directory, session, stream_with_context

from routes import (
    auth_bp, zone_bp, excel_bp, qc_bp, admin_bp, reports_bp,
    misc_bp, dashboard_bp, pages_bp, scan_bp,
)
from core import (
    zone_required, APP_DIR, QC_UPLOAD_DIR,
    _push_subs_lock, _read_push_subs, _write_push_subs, _send_push_notification,
)

warnings.filterwarnings('ignore')

# ── App setup ──────────────────────────────────────────────────────
app = Flask(__name__, static_folder='static')
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-change-me')
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 28800

app.register_blueprint(auth_bp)
app.register_blueprint(zone_bp)
app.register_blueprint(excel_bp)
app.register_blueprint(qc_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(misc_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(pages_bp)
app.register_blueprint(scan_bp)

# ── QC real-time SSE ───────────────────────────────────────────────
_qc_subscribers = []
_qc_subs_lock   = threading.Lock()


def broadcast_qc_push(title, body, url='/qc-workflow', tag='qc-update'):
    """Send Web Push notification to all subscribed devices."""
    with _push_subs_lock:
        subs = _read_push_subs()
    dead_keys = []
    for key, record in subs.items():
        if not _send_push_notification(record['subscription'], title, body, url, tag):
            dead_keys.append(key)
    if dead_keys:
        with _push_subs_lock:
            subs = _read_push_subs()
            for k in dead_keys:
                subs.pop(k, None)
            _write_push_subs(subs)


def _broadcast_qc_event(event_data: str):
    """Push SSE event to all connected QC clients, and Web Push to background devices."""
    dead = []
    with _qc_subs_lock:
        for q in _qc_subscribers:
            try:
                q.put_nowait(event_data)
            except Exception:
                dead.append(q)
        for q in dead:
            try:
                _qc_subscribers.remove(q)
            except ValueError:
                pass
    try:
        for line in event_data.split('\n'):
            if line.startswith('data:'):
                payload = json.loads(line[5:].strip())
                event_type = payload.get('type', '')
                if event_type == 'new_submission':
                    threading.Thread(
                        target=broadcast_qc_push,
                        args=('EST-iMs QC 🔬', f"طلب جودة جديد — {payload.get('product', '')}"),
                        daemon=True,
                    ).start()
                elif event_type == 'status_update':
                    threading.Thread(
                        target=broadcast_qc_push,
                        args=('EST-iMs QC 🔬', f"تحديث حالة — {payload.get('label', 'تم التحديث')}"),
                        daemon=True,
                    ).start()
                break
    except Exception:
        pass


@app.route('/api/qc/stream')
@zone_required
def api_qc_stream():
    """SSE endpoint — streams real-time QC updates to all connected clients."""
    if session.get('zone') != 'qc':
        from flask import jsonify
        return jsonify({'error': 'غير مصرح'}), 403
    q = _queue.Queue(maxsize=50)
    with _qc_subs_lock:
        _qc_subscribers.append(q)

    def generate():
        try:
            yield 'event: ping\ndata: ok\n\n'
            while True:
                try:
                    yield q.get(timeout=25)
                except _queue.Empty:
                    yield 'event: ping\ndata: ok\n\n'
        except GeneratorExit:
            pass
        finally:
            with _qc_subs_lock:
                try:
                    _qc_subscribers.remove(q)
                except ValueError:
                    pass

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        },
    )


@app.route('/static/qc-sw.js')
def serve_qc_sw():
    """Serve the QC Service Worker with correct MIME type and scope header."""
    sw_path = os.path.join(APP_DIR, 'static', 'qc-sw.js')
    if not os.path.isfile(sw_path):
        return 'Not found', 404
    with open(sw_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return Response(
        content,
        mimetype='application/javascript',
        headers={'Service-Worker-Allowed': '/'},
    )


@app.route('/static/qc_uploads/<path:filename>')
def serve_qc_upload(filename):
    """Serve QC uploads from the configured persistent upload directory."""
    return send_from_directory(QC_UPLOAD_DIR, filename)


# ── Entry point ────────────────────────────────────────────────────
if __name__ == '__main__':
    try:
        from flaskwebgui import FlaskUI  # type: ignore[import-untyped]
        FlaskUI(app=app, server='flask', width=1280, height=800, port=3049, fullscreen=False).run()
    except ImportError:
        import webbrowser
        import time
        threading.Thread(
            target=lambda: (time.sleep(1.2), webbrowser.open('http://127.0.0.1:3049')),
            daemon=True,
        ).start()
        app.run(host='127.0.0.1', port=3049, debug=False)
