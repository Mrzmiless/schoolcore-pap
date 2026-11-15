try {
  if (sessionStorage.getItem('schoolcore:welcome-transition') === '1') {
    sessionStorage.removeItem('schoolcore:welcome-transition');
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.body.classList.add('auth-arriving');
  }
} catch (error) { /* Navigation still works when storage is unavailable. */ }
window.addEventListener('pageshow', (event) => {
  if (event.persisted) document.body.classList.remove('auth-arriving');
});

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('login-status');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = 'Signing in…';
  window.schoolcoreLoading.show('Signing in…');
  let navigating = false;
  let errorMessage = '';
  try {
    const response = await fetch('../../api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username.value, password: form.password.value })
    });
    if (response.ok) {
      form.password.value = '';
      status.textContent = 'Signed in. Opening the home page…';
      await window.schoolcoreLoading.wait();
      navigating = true;
      window.location.assign('../start/index.html');
    } else {
      const data = await response.json().catch(() => ({}));
      errorMessage = response.status === 403 && data.detail === 'account_disabled'
        ? 'Your account is now disabled, please talk to your school support'
        : response.status === 401 ? 'Incorrect username or password.'
        : response.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.'
        : 'Could not sign in. Please try again.';
    }
  } catch (error) {
    errorMessage = 'Could not reach the server. Please try again.';
  } finally {
    if (!navigating) {
      status.textContent = '';
      await window.schoolcoreLoading.showError(errorMessage);
    }
    button.disabled = false;
  }
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../../sw.js').catch(console.error);
  });
}
