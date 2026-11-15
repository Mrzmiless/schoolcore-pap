document.getElementById('account-link').addEventListener('click', (event) => {
  if (window.parent !== window && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    window.parent.postMessage({ type: 'schoolcore:navigate', page: 'user' }, location.origin);
  }
});
(async () => {
  try {
    const response = await fetch('../../api/me', { cache: 'no-store' });
    if (response.status === 401) { (window.parent !== window ? window.parent : window).location.replace('../login/index.html'); return; }
    if (!response.ok) throw new Error();
    const user = await response.json();
    document.getElementById('welcome').textContent = 'Welcome, ' + (user.first_name || user.username) + '!';
  } catch (error) {
    document.getElementById('welcome').textContent = 'Could not load your account. Please refresh the page.';
  }
})();
