"""Zone 1 — under development. Serves a simple 'Soon' placeholder page."""
from flask import Blueprint, render_template, session, redirect, url_for

zone1_bp = Blueprint('zone1', __name__)


@zone1_bp.route('/zone1')
def zone1_page():
    if not session.get('logged_in'):
        return redirect(url_for('auth.login_page'))
    return render_template('zone1.html', username=session.get('username', ''))
