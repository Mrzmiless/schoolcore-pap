(function () {
  const translate = (key) => window.schoolcoreI18n ? window.schoolcoreI18n.t(key) : key;
  const section = document.getElementById('security-section');
  const unlock = document.getElementById('security-unlock-form');
  const controls = document.getElementById('security-controls');
  const status = document.getElementById('security-status');
  const current = document.getElementById('security-current-password');
  const email = document.getElementById('security-email');
  const password = document.getElementById('security-new-password');
  const confirm = document.getElementById('security-confirm-password');
  let timer;
  let unlocked = false;
  let generation = 0;

  function reset(message = '') {
    // Invalida respostas atrasadas e limpa passwords dos campos.
    generation++;
    clearTimeout(timer);
    unlocked = false;
    controls.hidden = true;
    unlock.hidden = false;
    current.value = email.value = password.value = confirm.value = '';
    status.textContent = translate(message);
  }
  function lock() {
    const wasUnlocked = unlocked;
    reset();
    // Mesmo se este pedido falhar, o servidor limita a duração do desbloqueio.
    if (wasUnlocked) fetch('../../api/security/lock', { method: 'POST', keepalive: true }).catch(() => {});
  }
  section.addEventListener('toggle', () => { if (!section.open) lock(); });
  window.addEventListener('pagehide', lock);

  async function post(path, data) {
    return fetch('../../api/security/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  }
  async function forbiddenMessage(response) {
    const data = await response.json().catch(() => ({}));
    if (data.detail === 'Invalid origin') return 'The server rejected this address. Ask your administrator to check APP_ORIGIN.';
    if (data.detail === 'Reauthentication required') return 'Acesso expirado. Confirma novamente a password.';
    return 'Não foi possível verificar. Tenta novamente.';
  }
  unlock.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = unlock.querySelector('button');
    button.disabled = true;
    const attempt = generation;
    status.textContent = translate('A verificar…');
    try {
      const response = await post('unlock', { password: current.value });
      current.value = '';
      // A secção pode ter sido fechada enquanto o servidor verificava a password.
      if (attempt !== generation || !section.open) {
        if (response.ok) fetch('../../api/security/lock', { method: 'POST', keepalive: true }).catch(() => {});
        return;
      }
      if (!response.ok) {
        const message = response.status === 403 ? await forbiddenMessage(response)
          : response.status === 429 ? 'Demasiadas tentativas. Aguarda e tenta novamente.'
          : response.status === 401 ? 'Password incorreta ou sessão expirada.' : 'Não foi possível verificar. Tenta novamente.';
        if (attempt === generation) status.textContent = translate(message);
        return;
      }
      unlocked = true;
      unlock.hidden = true;
      controls.hidden = false;
      status.textContent = '';
      timer = setTimeout(() => { lock(); status.textContent = translate('Acesso expirado. Confirma novamente a password.'); }, 300000);
      email.focus();
    } catch (error) { if (attempt === generation) status.textContent = translate('Não foi possível contactar o servidor.'); }
    finally { button.disabled = false; }
  });
  document.getElementById('security-email-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      const response = await post('email', { email: email.value });
      if (response.status === 403) { reset(await forbiddenMessage(response)); return; }
      if (!response.ok) throw new Error();
      const data = await response.json();
      window.dispatchEvent(new CustomEvent('schoolcore:email-changed', { detail: data.email }));
      email.value = '';
      status.textContent = translate('Email atualizado.');
    } catch (error) { status.textContent = translate('Não foi possível alterar o email.'); }
    finally { button.disabled = false; }
  });
  document.getElementById('security-password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (password.value !== confirm.value) { status.textContent = translate('As passwords não coincidem.'); return; }
    if (!window.confirm(translate('Alterar a password e terminar todas as sessões?'))) return;
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      const response = await post('password', { password: password.value });
      if (response.status === 403) { reset(await forbiddenMessage(response)); return; }
      if (!response.ok) throw new Error();
      reset();
      (window.self !== window.top ? window.top : window).location.replace('/pages/login/index.html');
    } catch (error) { status.textContent = translate('Não foi possível confirmar a alteração. Tenta iniciar sessão com a nova password.'); }
    finally { button.disabled = false; }
  });
})();
