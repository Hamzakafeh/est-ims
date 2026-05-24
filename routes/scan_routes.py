"""QR / barcode scan pages and APIs."""
from flask import Blueprint, render_template, jsonify, request, session, redirect, url_for
from core import (
    zone_required,
    SKU_MAP,
    SKU_NAMES_AR,
    SKU_HEX,
    _stocktaking_scan_result,
    _get_last_balance,
)

scan_bp = Blueprint('scan', __name__)


@scan_bp.route('/scan')
def scan_page():
    if not session.get('logged_in'):
        return redirect(url_for('auth.login_page') + '?next=/scan')
    if not session.get('zone'):
        return redirect(url_for('zones.zones_page'))
    return render_template('scan.html')


@scan_bp.route('/qrscan')
def qrscan_page():
    sku = request.args.get('sku', '').strip().upper()
    return render_template('qrscan.html', sku=sku)


@scan_bp.route('/api/qrscan/<sku>')
def api_qrscan(sku):
    sku = sku.strip().upper()
    stocktaking_result = _stocktaking_scan_result(sku)
    if stocktaking_result is not None:
        status = 200 if stocktaking_result.get('found') else 404
        return jsonify(stocktaking_result), status
    if sku not in SKU_MAP:
        return jsonify({'found': False, 'error': f'"{sku}" غير مسجل في النظام'}), 404
    sheet_name, color_name = SKU_MAP[sku]
    balance, date, filepath = _get_last_balance(sheet_name, color_name)
    if balance is None:
        return jsonify({'found': False, 'error': 'تعذر قراءة الملف أو لا توجد بيانات'}), 500
    return jsonify({
        'found': True,
        'sku': sku,
        'nameAr': SKU_NAMES_AR.get(sku, sku),
        'category': 'شوالات الجاج',
        'hex': SKU_HEX.get(sku, '#6b7280'),
        'balance': int(balance),
        'date': date or '—',
    })


@scan_bp.route('/api/scan/<sku>')
@zone_required
def api_scan(sku):
    sku = sku.strip().upper()
    stocktaking_result = _stocktaking_scan_result(sku)
    if stocktaking_result is not None:
        status = 200 if stocktaking_result.get('found') else 404
        return jsonify(stocktaking_result), status
    if sku not in SKU_MAP:
        return jsonify({'found': False, 'error': f'"{sku}" غير مسجل في النظام'}), 404

    sheet_name, color_name = SKU_MAP[sku]
    balance, date, filepath = _get_last_balance(sheet_name, color_name)

    if balance is None:
        return jsonify({'found': False, 'error': 'تعذّر قراءة الملف أو لا توجد بيانات'}), 500

    return jsonify({
        'found': True,
        'sku': sku,
        'nameAr': SKU_NAMES_AR.get(sku, sku),
        'category': 'شوالات الجاج',
        'color': color_name,
        'hex': SKU_HEX.get(sku, '#6b7280'),
        'balance': int(balance),
        'date': date or '—',
    })
