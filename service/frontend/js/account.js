const home = document.getElementById('home');
const status = document.getElementById('status');
const preferencesForm = document.getElementById('preferences-form');
const preferencesFields = document.getElementById('preferences-fields');
const preferencesStatus = document.getElementById('preferences-status');
const sections = document.querySelectorAll('.account-section');
const translate = (text, params) => window.schoolcoreI18n ? window.schoolcoreI18n.t(text, params) : text.replace(/\{(\w+)\}/g, (_, key) => params?.[key] ?? '');
let savedPreferences;
let desiredPreferences;
let savingPreferences = false;

// Só uma secção da conta fica aberta de cada vez.
sections.forEach((section) => {
  section.addEventListener('toggle', () => {
    if (section.open) sections.forEach((other) => { if (other !== section) other.open = false; });
  });
});

function showPreferences(preferences) {
  document.getElementById('setting-theme').value = preferences.theme;
  document.getElementById('setting-blur').checked = preferences.navbar_blur;
  document.getElementById('setting-motion').value = preferences.motion;
  document.getElementById('setting-text-size').value = preferences.text_size;
  document.getElementById('setting-language').value = preferences.language;
}

function previewPreferences(preferences) {
  const value = window.schoolcorePreferences.apply(preferences);
  // A página principal também precisa de acompanhar o tema enquanto a conta está no iframe.
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'schoolcore:preferences', preferences: value }, location.origin);
  }
}

function readPreferences() {
  return {
    theme: document.getElementById('setting-theme').value,
    navbar_blur: document.getElementById('setting-blur').checked,
    motion: document.getElementById('setting-motion').value,
    text_size: document.getElementById('setting-text-size').value,
    language: document.getElementById('setting-language').value
  };
}

function samePreferences(left, right) {
  return left.theme === right.theme && left.navbar_blur === right.navbar_blur &&
    left.motion === right.motion && left.text_size === right.text_size && left.language === right.language;
}

async function accountRequestError(response) {
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    if (data.detail === 'Invalid origin') {
      return 'O servidor rejeitou este endereço. Verifica se APP_ORIGIN corresponde ao endereço da app.';
    }
    return 'O servidor recusou este pedido (403).';
  }
  if (response.status === 422) return 'O servidor não aceitou os dados enviados (422).';
  if (response.status >= 500) return 'O servidor ou a base de dados não está disponível. Tenta novamente.';
  return 'Não foi possível concluir o pedido. Tenta novamente.';
}

async function savePreferences() {
  if (savingPreferences) return;
  savingPreferences = true;
  let failureMessage;
  try {
    // Serializa alterações rápidas: a última escolha não fica presa atrás da primeira.
    while (!samePreferences(savedPreferences, desiredPreferences)) {
      const sent = { ...desiredPreferences };
      preferencesStatus.textContent = translate('A guardar…');
      const response = await fetch('../../api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sent),
        // Preserve the origin for the server's CSRF check on mobile browsers.
        referrerPolicy: 'same-origin',
        keepalive: true
      });
      if (response.status === 401) {
        (window.self !== window.top ? window.top : window).location.replace('../login/index.html');
        return;
      }
      if (!response.ok) {
        failureMessage = await accountRequestError(response);
        throw new Error('Preference save failed');
      }
      savedPreferences = await response.json();
    }
    preferencesStatus.textContent = translate('Guardado.');
  } catch (error) {
    // Uma pré-visualização não é uma gravação: repor a última versão confirmada.
    desiredPreferences = { ...savedPreferences };
    showPreferences(desiredPreferences);
    previewPreferences(desiredPreferences);
    preferencesStatus.textContent = translate(failureMessage || 'Não foi possível guardar. Tenta novamente.');
  } finally {
    savingPreferences = false;
  }
}

preferencesForm.addEventListener('submit', (event) => event.preventDefault());
preferencesForm.addEventListener('change', () => {
  if (!savedPreferences) return;
  desiredPreferences = readPreferences();
  previewPreferences(desiredPreferences);
  savePreferences();
});
document.getElementById('reset-preferences').addEventListener('click', () => {
  if (!savedPreferences || !window.confirm(translate('Repor as definições da app?'))) return;
  desiredPreferences = { ...window.schoolcorePreferences.defaults };
  showPreferences(desiredPreferences);
  previewPreferences(desiredPreferences);
  savePreferences();
});

window.schoolcorePreferences.ready.then((preferences) => {
  if (!preferences) {
    preferencesStatus.textContent = translate('Não foi possível carregar as definições. Atualiza a página para tentar novamente.');
    return;
  }
  savedPreferences = { ...preferences };
  desiredPreferences = { ...preferences };
  showPreferences(preferences);
  preferencesFields.disabled = false;
});

function displayValue(id, value) {
  document.getElementById(id).textContent = value || translate('Not available');
}

const privateValues = {};
// O blur evita olhares curiosos, não substitui permissões ou autenticação.
for (const [key, label] of [['id', 'account ID'], ['email', 'email'], ['phone', 'phone number']]) {
  const button = document.getElementById('reveal-' + key);
  const field = document.getElementById('private-' + key);
  const value = document.getElementById('account-' + key);
  let concealTimer;
  button.addEventListener('click', () => {
    const visible = button.getAttribute('aria-pressed') !== 'true';
    clearTimeout(concealTimer);
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', translate((visible ? 'Hide ' : 'Show ') + label));
    value.setAttribute('aria-hidden', String(!visible));
    if (visible) {
      value.textContent = privateValues[key] || translate('Not available');
      field.setAttribute('data-state', 'revealed');
    } else {
      const conceal = () => { field.setAttribute('data-state', 'hidden'); value.textContent = ''; };
      const reduced = document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) conceal();
      else {
        field.setAttribute('data-state', 'concealing');
        concealTimer = setTimeout(conceal, 160);
      }
    }
  });
}

function displayDate(value) {
  if (!value) return translate('Not available');
  // Older accounts may store the date as DD/MM/YYYY instead of BSON date.
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? translate('Not available') : date.toLocaleDateString(window.schoolcoreI18n?.getLanguage() === 'pt-PT' ? 'pt-PT' : 'en-GB', { timeZone: 'UTC' });
}

let loadedUser;
function renderUser(user) {
  document.getElementById('home-title').textContent = translate('Hello, {name}!', { name: user.first_name || user.username });
  displayValue('account-username', user.username);
  displayValue('account-first-name', user.first_name);
  displayValue('account-last-name', user.last_name);
  displayValue('account-grade', user.grade);
  displayValue('account-class', user.class);
  for (const [key, label] of [['id', 'account ID'], ['email', 'email'], ['phone', 'phone number']]) {
    const button = document.getElementById('reveal-' + key);
    button.setAttribute('aria-label', translate((button.getAttribute('aria-pressed') === 'true' ? 'Hide ' : 'Show ') + label));
  }
  displayValue('account-role', translate(({ aluno: 'Student', professor: 'Teacher', admin: 'Administrator' })[user.role] || user.role || 'Not available'));
  displayValue('account-birth', displayDate(user.date_of_birth));
  displayValue('account-created', displayDate(user.created_at));
  displayValue('account-status', translate(user.is_active ? 'Active' : 'Disabled'));
  displayValue('account-intro', translate(user.is_first_login_done ? 'Yes' : 'No'));
}
window.addEventListener('schoolcore:language', () => { if (loadedUser) renderUser(loadedUser); });

async function loadUser() {
  try {
    const response = await fetch('../../api/me', { cache: 'no-store' });
    if (response.status === 401) { window.location.replace('../login/index.html'); return; }
    if (!response.ok) throw new Error();
    const user = await response.json();
    loadedUser = user;
    renderUser(user);
    // Só inserir os valores privados no DOM quando a pessoa escolher revelá-los.
    privateValues.id = user.id;
    privateValues.email = user.email;
    privateValues.phone = user.phone_number;
    home.hidden = false;
    status.textContent = '';
  } catch (error) {
    status.textContent = translate('Could not load your account. Refresh the page to try again.');
  }
}

document.getElementById('logout').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  window.schoolcoreLoading.show(translate('Signing out...'));
  let failureMessage;
  try {
    const response = await fetch('../../api/logout', { method: 'POST' });
    if (!response.ok) {
      failureMessage = await accountRequestError(response);
      throw new Error('Sign out failed');
    }
    await window.schoolcoreLoading.wait();
    (window.self !== window.top ? window.top : window).location.replace('../login/index.html');
  } catch (error) {
    status.textContent = translate(failureMessage || 'Could not sign out. Please try again.');
    await window.schoolcoreLoading.hide();
    button.disabled = false;
  }
});
loadUser();

window.addEventListener('schoolcore:email-changed', (event) => {
  privateValues.email = event.detail;
  if (document.getElementById('reveal-email').getAttribute('aria-pressed') === 'true') {
    displayValue('account-email', event.detail);
  }
});
