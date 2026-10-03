(function () {
  var mode = 'system';
  try {
    var raw = localStorage.getItem('ejis-settings');
    if (raw) mode = (JSON.parse(raw).state || {}).theme || 'system';
  } catch (e) {}
  var theme = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.setAttribute('data-theme', theme);
})();
