(function () {
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
    generation++;
    clearTimeout(timer);
    unlocked = false;
    controls.hidden = true;
    unlock.hidden = false;
    current.value = email.value = password.value = confirm.value = '';
    status.textContent = message;
  }
  function lock() {
    const wasUnlocked = unlocked;
    reset();
    if (wasUnlocked) fetch('../../api/security/lock', { method: 'POST', keepalive: true }).catch(() => {});
  }
  section.addEventListener('toggle', () => { if (!section.open) lock(); });
  window.addEventListener('pagehide', lock);

  async function post(path, data) {
    return fetch('../../api/security/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  }
  unlock.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = unlock.querySelector('button');
    button.disabled = true;
    const attempt = generation;
    status.textContent = 'A verificar…';
    try {
      const response = await post('unlock', { password: current.value });
      current.value = '';
      if (attempt !== generation || !section.open) {
        if (response.ok) fetch('../../api/security/lock', { method: 'POST', keepalive: true }).catch(() => {});
        return;
      }
      if (!response.ok) {
        status.textContent = response.status === 429 ? 'Demasiadas tentativas. Aguarda e tenta novamente.' : response.status === 401 ? 'Password incorreta ou sessão expirada.' : 'Não foi possível verificar. Tenta novamente.';
        return;
      }
      unlocked = true;
      unlock.hidden = true;
      controls.hidden = false;
      status.textContent = '';
      timer = setTimeout(() => { lock(); status.textContent = 'Acesso expirado. Confirma novamente a password.'; }, 300000);
      email.focus();
    } catch (error) { if (attempt === generation) status.textContent = 'Não foi possível contactar o servidor.'; }
    finally { button.disabled = false; }
  });
  document.getElementById('security-email-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      const response = await post('email', { email: email.value });
      if (response.status === 403) { reset('Acesso expirado. Confirma novamente a password.'); return; }
      if (!response.ok) throw new Error();
      const data = await response.json();
      window.dispatchEvent(new CustomEvent('schoolcore:email-changed', { detail: data.email }));
      email.value = '';
      status.textContent = 'Email atualizado.';
    } catch (error) { status.textContent = 'Não foi possível alterar o email.'; }
    finally { button.disabled = false; }
  });
  document.getElementById('security-password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (password.value !== confirm.value) { status.textContent = 'As passwords não coincidem.'; return; }
    if (!window.confirm('Alterar a password e terminar todas as sessões?')) return;
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      const response = await post('password', { password: password.value });
      if (response.status === 403) { reset('Acesso expirado. Confirma novamente a password.'); return; }
      if (!response.ok) throw new Error();
      reset();
      (window.self !== window.top ? window.top : window).location.replace('/pages/login/index.html');
    } catch (error) { status.textContent = 'Não foi possível confirmar a alteração. Tenta iniciar sessão com a nova password.'; }
    finally { button.disabled = false; }
  });
})();
