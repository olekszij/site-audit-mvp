(function () {
  var STORAGE_KEY = 'site-audit-theme';

  function getPreferredTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      toggle.setAttribute(
        'aria-label',
        theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme',
      );
    }
  }

  function toggleTheme() {
    var current =
      document.documentElement.getAttribute('data-theme') === 'light'
        ? 'light'
        : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
  }

  window.__applyTheme = applyTheme;
  window.__toggleTheme = toggleTheme;
  window.__getPreferredTheme = getPreferredTheme;

  applyTheme(getPreferredTheme());

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', toggleTheme);
      applyTheme(getPreferredTheme());
    }
  });
})();
