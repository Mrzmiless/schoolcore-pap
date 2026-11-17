try {
  if (sessionStorage.getItem('schoolcore:welcome-transition') === '1') {
    sessionStorage.removeItem('schoolcore:welcome-transition');
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.body.classList.add('auth-arriving');
  }
} catch (error) { /* Navigation still works when storage is unavailable. */ }
const translate = (key) => window.schoolcoreI18n ? window.schoolcoreI18n.t(key) : key;
const languagePicker = document.getElementById('login-language');
languagePicker.value = 'en';
languagePicker.addEventListener('change', () => {
  if (window.schoolcoreI18n) window.schoolcoreI18n.setLanguage(languagePicker.value);
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    document.body.classList.remove('auth-arriving');
    document.querySelector('#login-form button[type="submit"]').disabled = false;
    document.getElementById('login-status').textContent = '';
  }
});

async function loginRequest(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('login-status');
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  status.textContent = translate('Signing in…');
  window.schoolcoreLoading.show(translate('Signing in…'));
  let navigating = false;
  let errorMessage = '';
  try {
    const response = await loginRequest('../../api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username.value, password: form.password.value })
    });
    if (response.ok) {
      form.password.value = '';
      const session = await loginRequest('../../api/me', { cache: 'no-store' });
      if (session.ok) {
        status.textContent = translate('Signed in. Opening the home page…');
        await window.schoolcoreLoading.wait();
        navigating = true;
        window.location.assign('../start/index.html');
      } else {
        errorMessage = session.status === 401
          ? 'Your session could not be saved. Check that cookies are enabled and use HTTPS.'
          : 'Could not verify your session. Please try again.';
      }
    } else {
      const data = await response.json().catch(() => ({}));
      errorMessage = response.status === 403 && data.detail === 'account_disabled'
        ? 'Your account is now disabled, please talk to your school support'
        : response.status === 403 && data.detail === 'Invalid origin'
        ? 'The server rejected this address. Ask your administrator to check APP_ORIGIN.'
        : response.status === 401 ? 'Incorrect username or password.'
        : response.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.'
        : 'Could not sign in. Please try again.';
    }
  } catch (error) {
    errorMessage = error.name === 'AbortError'
      ? 'The server took too long to respond. Please try again.'
      : 'Could not reach the server. Please try again.';
  } finally {
    if (!navigating) {
      status.textContent = '';
      await window.schoolcoreLoading.showError(translate(errorMessage));
    }
    button.disabled = false;
  }
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../../sw.js').catch(console.error);
  });
}
