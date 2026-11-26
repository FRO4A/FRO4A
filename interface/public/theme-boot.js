/**
 * Pre-paint theme bootstrap (session-only, zero PII).
 *
 * Kept as an external file so `index.html` can ship a strict
 * `script-src 'self'` Content-Security-Policy without `'unsafe-inline'`.
 * Runs synchronously in `<head>` before the first paint.
 */
(function () {
  try {
    var stored = window.sessionStorage.getItem('fro4a_theme');
    if (stored !== 'light' && stored !== 'dark') {
      stored =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    }
    document.documentElement.setAttribute('data-theme', stored);
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
