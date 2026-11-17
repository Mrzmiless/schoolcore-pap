const intro = document.getElementById('intro');
const status = document.getElementById('status');
const complete = document.getElementById('complete');
const translate = (key, params) => window.schoolcoreI18n ? window.schoolcoreI18n.t(key, params) : key.replace(/\{(\w+)\}/g, (_, name) => params?.[name] ?? '');
let userName;
window.addEventListener('schoolcore:language', () => {
  if (userName) document.getElementById('welcome').textContent = translate('Welcome to SchoolCore, {name}!', { name: userName });
});

async function loadUser() {
  try {
    const response = await fetch('../../api/me', { cache: 'no-store' });
    if (response.status === 401) { window.location.replace('../login/index.html'); return; }
    if (!response.ok) throw new Error();
    const user = await response.json();
    if (user.is_first_login_done) {
      window.location.replace('./HomePage.html');
      return;
    }
    userName = user.first_name || user.username;
    document.getElementById('welcome').textContent = translate('Welcome to SchoolCore, {name}!', { name: userName });
    intro.hidden = false;
    status.textContent = '';
  } catch (error) {
    status.textContent = translate('Could not load your account. Refresh the page to try again.');
  }
}

complete.addEventListener('click', async () => {
  complete.disabled = true;
  window.schoolcoreLoading.show(translate('Saving…'));
  try {
    const response = await fetch('../../api/onboarding/complete', { method: 'POST' });
    if (response.status === 401) { await window.schoolcoreLoading.wait(); window.location.replace('../login/index.html'); return; }
    if (!response.ok) throw new Error();
    await window.schoolcoreLoading.wait();
    window.location.replace('./HomePage.html');
  } catch (error) {
    status.textContent = translate('Could not save. Please try again.');
  } finally { await window.schoolcoreLoading.hide(); complete.disabled = false; }
});

loadUser();
