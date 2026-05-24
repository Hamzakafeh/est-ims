from .auth_routes import auth_bp
from .zone_routes import zone_bp
from .excel_routes import excel_bp
from .qc_routes import qc_bp
from .admin_routes import admin_bp
from .reports_routes import reports_bp
from .misc_routes import misc_bp
from .dashboard_routes import dashboard_bp
from .pages_routes import pages_bp
from .scan_routes import scan_bp

__all__ = [
    'auth_bp', 'zone_bp', 'excel_bp', 'qc_bp',
    'admin_bp', 'reports_bp', 'misc_bp', 'dashboard_bp',
    'pages_bp', 'scan_bp',
]
