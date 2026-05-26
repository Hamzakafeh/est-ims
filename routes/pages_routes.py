"""Public and main application pages."""
from flask import Blueprint, render_template, redirect, url_for, session, send_from_directory, make_response
import os
from core import (
    zone_required,
    get_structure,
    get_available_years,
    get_base_path,
    MONTH_AR,
    get_firebase_config,
)

pages_bp = Blueprint('pages', __name__)


@pages_bp.route('/favicon.ico')
def favicon():
    return send_from_directory('static/icons', 'est.ico')


@pages_bp.route('/qc-sw.js')
def qc_service_worker():
    """Serve SW from root so it controls /qc-workflow scope."""
    resp = make_response(send_from_directory('static', 'qc-sw.js'))
    resp.headers['Content-Type'] = 'application/javascript'
    resp.headers['Service-Worker-Allowed'] = '/'
    resp.headers['Cache-Control'] = 'no-cache'
    return resp


@pages_bp.route('/ping')
def ping():
    return {'status': 'ok'}, 200


@pages_bp.route('/')
def welcome():
    return render_template('welcome.html', logged_username=session.get('username', ''))


@pages_bp.route('/index')
@zone_required
def index():
    structure = get_structure()
    available_years = get_available_years()
    zone = session.get('zone', '')
    is_super = session.get('is_super', False)
    can_edit = session.get('can_edit', False)
    zone_label = session.get('zone_label', '')
    username = session.get('username', '')
    return render_template(
        'index.html',
        structure=structure,
        available_years=available_years,
        base_path=get_base_path() or 'Not found',
        month_ar=MONTH_AR,
        zone=zone,
        zone_label=zone_label,
        is_super=is_super,
        is_dev=(zone == 'dev'),
        can_edit=can_edit,
        username=username,
        login_time=session.get('login_time', ''),
        firebase_config=get_firebase_config(),
    )


@pages_bp.route('/about')
def about_page():
    return render_template('about.html')


@pages_bp.route('/privacy')
def privacy_page():
    return render_template('privacy.html')


@pages_bp.route('/terms')
def terms_page():
    return render_template('terms.html')


@pages_bp.route('/for-more')
def for_more_page():
    return render_template('formore.html')
