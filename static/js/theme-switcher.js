// ── EST-iMs Theme Switcher ──
// Loaded after page JS — overrides toggleTheme() on every page.

(function () {

  const OPTIONS = [
    {
      key: 'dark',
      label: 'ديفولت ليلي',
      sub:   'Default · Night',
      swatch: '#0d1117',
      swBorder: '#3d4f6a',
    },
    {
      key: 'light',
      label: 'ديفولت نهاري',
      sub:   'Default · Day',
      swatch: '#F0F4F8',
      swBorder: '#CBD5E1',
    },
    {
      key: 'classic',
      label: 'كلاسيك',
      sub:   'Classic · Navy',
      swatch: '#1A4A7A',
      swBorder: '#0E7C86',
    },
  ];

  function _curTheme() {
    const h = document.documentElement;
    if (h.classList.contains('classic')) return 'classic';
    if (h.classList.contains('light'))   return 'light';
    return 'dark';
  }

  function _applyTheme(t) {
    const h = document.documentElement;
    h.classList.remove('light', 'classic');
    if (t === 'light')   h.classList.add('light');
    if (t === 'classic') h.classList.add('classic');
    localStorage.setItem('est-theme', t);
    if (typeof updateDockTheme === 'function') updateDockTheme();
  }

  function _closeDropdown() {
    const dd = document.getElementById('_themeDd');
    if (dd) dd.remove();
  }

  function _buildDropdown() {
    const cur = _curTheme();
    const dd  = document.createElement('div');
    dd.id = '_themeDd';
    dd.className = '_theme-dd';

    const title = document.createElement('div');
    title.className = '_theme-dd-title';
    title.textContent = 'الثيم';
    dd.appendChild(title);

    OPTIONS.forEach(opt => {
      const item = document.createElement('div');
      const active = opt.key === cur;
      item.className = '_theme-dd-item' + (active ? ' _tactive' : '');

      const sw = document.createElement('span');
      sw.className = '_theme-dd-sw';
      sw.style.background   = opt.swatch;
      sw.style.borderColor  = opt.swBorder;

      const lbl = document.createElement('span');
      lbl.className = '_theme-dd-lbl';
      lbl.innerHTML = `${opt.label}<span class="_theme-dd-sub">${opt.sub}</span>`;

      item.appendChild(sw);
      item.appendChild(lbl);

      if (active) {
        const chk = document.createElement('span');
        chk.className = '_theme-dd-check';
        chk.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        item.appendChild(chk);
      }

      item.onclick = function (e) {
        e.stopPropagation();
        _applyTheme(opt.key);
        _closeDropdown();
      };

      dd.appendChild(item);
    });

    return dd;
  }

  // Override toggleTheme globally
  window.toggleTheme = function () {
    if (document.getElementById('_themeDd')) {
      _closeDropdown();
      return;
    }
    const dd = _buildDropdown();
    document.body.appendChild(dd);

    // Close on outside click
    setTimeout(function () {
      document.addEventListener('click', function _oc(e) {
        if (!dd.contains(e.target)) {
          _closeDropdown();
          document.removeEventListener('click', _oc);
        }
      });
    }, 30);
  };

  // Update dock label to show current theme name
  const _orig_updateDockTheme = window.updateDockTheme;
  window.updateDockTheme = function () {
    const label = document.getElementById('dockThemeLabel');
    if (label) {
      const names = { dark: 'ليلي', light: 'نهاري', classic: 'كلاسيك' };
      label.textContent = names[_curTheme()] || 'Theme';
    }
    // Also call original if it existed (for any extra logic)
    if (typeof _orig_updateDockTheme === 'function' && _orig_updateDockTheme !== window.updateDockTheme) {
      // avoid infinite loop — skip
    }
  };

  // Re-run to update label now that we've overridden
  window.updateDockTheme();

})();
