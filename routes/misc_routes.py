"""Misc APIs: contact, visits, push notifications, AI proxy."""
import os
import sys
import json
import hashlib
import requests as http_requests
from datetime import datetime
from flask import Blueprint, jsonify, request, session
from core import (
    login_required,
    zone_required,
    _get_ip,
    _data_lock,
    _read_json_list,
    _write_json_list,
    _next_json_id,
    CONTACT_MESSAGES_FILE,
    _load_counter,
    _save_counter,
    _counter_lock,
    _read_push_subs,
    _write_push_subs,
    _push_subs_lock,
    _send_push_notification,
)

misc_bp = Blueprint('misc', __name__)


@misc_bp.route('/api/contact', methods=['POST'])
def api_contact():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', '')).strip()
    phone = str(data.get('phone', '')).strip()
    message = str(data.get('message', '')).strip()
    if not name or not phone or not message:
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    with _data_lock:
        items = _read_json_list(CONTACT_MESSAGES_FILE)
        item = {
            'id': _next_json_id(items),
            'name': name,
            'phone': phone,
            'email': str(data.get('email', '')).strip(),
            'department': str(data.get('department', '')).strip(),
            'message': message,
            'status': 'new',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'ip': _get_ip(),
        }
        items.append(item)
        _write_json_list(CONTACT_MESSAGES_FILE, items)
    return jsonify({'success': True, 'id': item['id']})


@misc_bp.route('/api/track_visit', methods=['POST'])
def api_track_visit():
    today = datetime.now().strftime('%Y-%m-%d')
    with _counter_lock:
        data = _load_counter()
        if data.get('date') != today:
            data['today'] = 0
            data['date'] = today
        data['total'] = data.get('total', 0) + 1
        data['today'] = data.get('today', 0) + 1
        _save_counter(data)
    return jsonify({'ok': True})


@misc_bp.route('/api/stats')
def api_stats():
    today = datetime.now().strftime('%Y-%m-%d')
    with _counter_lock:
        data = _load_counter()
    if data.get('date') != today:
        data['today'] = 0
    return jsonify({
        'total': data.get('total', 0),
        'today': data.get('today', 0),
    })


@misc_bp.route('/api/push/vapid_public_key')
def push_vapid_public_key():
    key = os.getenv('VAPID_PUBLIC_KEY', '')
    if not key:
        return jsonify({'error': 'Push not configured'}), 503
    return jsonify({'publicKey': key})


@misc_bp.route('/api/push/subscribe', methods=['POST'])
@login_required
def push_subscribe():
    data = request.get_json(silent=True) or {}
    subscription = data.get('subscription')
    if not subscription or not subscription.get('endpoint'):
        return jsonify({'success': False, 'message': 'Invalid subscription'}), 400

    username = session.get('username', 'unknown')
    endpoint = subscription['endpoint']
    sub_key = hashlib.sha256(endpoint.encode()).hexdigest()[:16]

    with _push_subs_lock:
        subs = _read_push_subs()
        subs[sub_key] = {
            'username': username,
            'qc_role': str(data.get('qc_role', '')),
            'subscription': subscription,
            'saved_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }
        _write_push_subs(subs)

    return jsonify({'success': True})


@misc_bp.route('/api/push/unsubscribe', methods=['POST'])
@login_required
def push_unsubscribe():
    data = request.get_json(silent=True) or {}
    endpoint = (data.get('subscription') or {}).get('endpoint', '')
    if endpoint:
        sub_key = hashlib.sha256(endpoint.encode()).hexdigest()[:16]
        with _push_subs_lock:
            subs = _read_push_subs()
            subs.pop(sub_key, None)
            _write_push_subs(subs)
    return jsonify({'success': True})


@misc_bp.route('/api/push/test', methods=['POST'])
@zone_required
def push_test():
    if not session.get('is_super'):
        return jsonify({'error': 'غير مصرح'}), 403
    data = request.get_json(silent=True) or {}
    subscription = data.get('subscription')
    if not subscription:
        return jsonify({'success': False, 'message': 'No subscription provided'}), 400
    ok = _send_push_notification(
        subscription,
        title='EST-iMs QC',
        body='اختبار الإشعارات — يعمل بشكل صحيح',
        tag='qc-test',
    )
    return jsonify({'success': ok})


@misc_bp.route('/api/ai-chat', methods=['POST'])
def ai_chat():
    data = request.get_json(silent=True) or {}
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return jsonify({'error': 'AI not configured'}), 503

    messages   = data.get('messages', [])[-16:]
    system_prompt = data.get('system', '')

    # Build Gemini contents array
    contents = []
    for m in messages:
        role = 'user' if m.get('role') == 'user' else 'model'
        contents.append({'role': role, 'parts': [{'text': m.get('content', '')}]})

    gemini_payload = {
        'system_instruction': {'parts': [{'text': system_prompt}]} if system_prompt else None,
        'contents': contents,
        'generationConfig': {
            'maxOutputTokens': 800,
            'temperature': 0.7,
        },
    }
    if gemini_payload['system_instruction'] is None:
        del gemini_payload['system_instruction']

    url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        f'gemini-1.5-flash:generateContent?key={api_key}'
    )

    try:
        old_limit = sys.getrecursionlimit()
        sys.setrecursionlimit(10000)
        try:
            res = http_requests.post(
                url,
                data=json.dumps(gemini_payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                timeout=30,
            )
            result = json.loads(res.text)
        finally:
            sys.setrecursionlimit(old_limit)

        candidates = result.get('candidates', [])
        if candidates:
            parts = candidates[0].get('content', {}).get('parts', [])
            reply_text = ''.join(p.get('text', '') for p in parts).strip()
            return jsonify({'content': [{'type': 'text', 'text': reply_text}]}), 200
        error_msg = result.get('error', {}).get('message', 'No response from AI.')
        return jsonify({'error': error_msg}), 500
    except RecursionError:
        return jsonify({'error': 'Sorry, try again.'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500
