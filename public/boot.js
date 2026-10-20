// Runs before the page is shown: a browser that has signed in before skips the static home page in index.html,
// which is there for crawlers and first visits, so that it does not flash before the app starts.
try {
  if (localStorage.getItem('ww-returning') === '1') document.documentElement.classList.add('ww-returning');
} catch {
  // Storage can be unavailable (private mode); the static page then shows until the app starts.
}
