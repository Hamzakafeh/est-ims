(function () {
  var _triggered = false;

  function _forceLogout(status, message) {
    if (_triggered) return;
    _triggered = true;
    if (typeof _showForceLogout === 'function') {
      _showForceLogout(status, message);
    } else {
      window.location.href = '/logout';
    }
  }

  function _poll() {
    if (_triggered) return;
    fetch('/api/me/status', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || _triggered) return;
        if (data.status === 'deleted' || data.status === 'suspended') {
          _forceLogout(data.status, data.message || '');
        }
      })
      .catch(function () {});
  }

  _poll();
  setInterval(_poll, 15000);
})();
