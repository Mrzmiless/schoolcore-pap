// Shared loading screen for navigation and asynchronous operations.
(function () {
  const minimumDuration = 1500;
  const imageUrl = new URL('image.png', document.currentScript.src).href;
  let overlay;
  let messageElement;
  let spinnerElement;
  let errorIcon;
  let backButton;
  let previousFocus;
  let startedAt = 0;
  let generation = 0;

  // Show connection and server errors without changing the original fetch response.
  let notice;
  let noticeText;
  function showNotice(message) {
    if (!notice) {
      const style = document.createElement('style');
      style.textContent = `
        .schoolcore-notice { position: fixed; z-index: 10000; top: max(12px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); width: min(440px, calc(100% - 24px)); display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border: 1px solid #e0a77a; border-radius: 14px; background: #543b2d; color: #fff; font: 14px/1.4 'Trebuchet MS', sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
        .schoolcore-notice[hidden] { display: none; }
        .schoolcore-notice p { margin: 0; flex: 1; }
        .schoolcore-notice button { background: transparent; border: 0; color: #fff; font: 22px/1 sans-serif; cursor: pointer; }
        .schoolcore-notice button:focus-visible { outline: 2px solid white; outline-offset: 3px; }
      `;
      document.head.appendChild(style);
      notice = document.createElement('div');
      notice.className = 'schoolcore-notice';
      notice.setAttribute('role', 'alert');
      noticeText = document.createElement('p');
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.setAttribute('aria-label', 'Dismiss notification');
      dismiss.textContent = '×';
      dismiss.addEventListener('click', () => { notice.hidden = true; });
      notice.append(noticeText, dismiss);
      document.body.appendChild(notice);
    }
    noticeText.textContent = message;
    notice.hidden = false;
  }

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, document.baseURI);
    const isApi = url.origin === window.location.origin && url.pathname.startsWith('/api/');
    try {
      const response = await originalFetch.call(this, input, init);
      if (isApi && response.status >= 500) {
        showNotice('The server is unavailable or encountered an error. Please try again later.');
      } else if (isApi && response.ok && notice) {
        notice.hidden = true;
      }
      return response;
    } catch (error) {
      if (isApi && error.name !== 'AbortError') {
        showNotice('Could not connect to the server. Check your connection and try again.');
      }
      throw error;
    }
  };
  window.addEventListener('offline', () => showNotice('You are offline. Check your internet connection.'));
  window.addEventListener('online', () => {
    if (notice) notice.hidden = true;
  });
  if (!navigator.onLine) showNotice('You are offline. Check your internet connection.');

  function createOverlay() {
    const style = document.createElement('style');
    style.textContent = `
      .schoolcore-loading { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; background: #10322D; color: #fff; font: 700 18px 'Trebuchet MS', sans-serif; text-align: center; opacity: 0; transition: opacity .2s ease; }
      .schoolcore-loading[hidden] { display: none; }
      .schoolcore-loading.is-visible { opacity: 1; }
      .schoolcore-loading img { width: min(260px, 70vw, 38vh); aspect-ratio: 1; object-fit: contain; }
      .schoolcore-loading__spinner { width: 32px; height: 32px; margin-top: 24px; border: 3px solid rgba(255,255,255,.25); border-top-color: #c9ffdb; border-radius: 50%; animation: schoolcore-spin .8s linear infinite; }
      .schoolcore-loading p { margin: 18px 0 0; }
      .schoolcore-loading [hidden] { display: none !important; }
      .schoolcore-loading__error { margin-top: 24px; width: 54px; height: 54px; border: 3px solid #ffaaaa; border-radius: 50%; color: #ffaaaa; font: 400 42px/45px sans-serif; }
      .schoolcore-loading__back { margin-top: 24px; padding: 12px 34px; border: 0; border-radius: 24px; background: #597d6e; color: white; font: inherit; cursor: pointer; }
      .schoolcore-loading__back:focus-visible { outline: 3px solid white; outline-offset: 3px; }
      @keyframes schoolcore-spin { to { transform: rotate(360deg); } }
      @keyframes schoolcore-page-in { from { opacity: 0; } to { opacity: 1; } }
      body > main { animation: schoolcore-page-in .25s ease; }
      @media (prefers-reduced-motion: reduce) { .schoolcore-loading { transition: none; } .schoolcore-loading__spinner, body > main { animation: none; } }
    `;
    document.head.appendChild(style);
    overlay = document.createElement('div');
    overlay.className = 'schoolcore-loading';
    overlay.hidden = true;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    const logo = document.createElement('img');
    logo.src = imageUrl;
    logo.alt = '';
    spinnerElement = document.createElement('div');
    spinnerElement.className = 'schoolcore-loading__spinner';
    spinnerElement.setAttribute('aria-hidden', 'true');
    errorIcon = document.createElement('div');
    errorIcon.className = 'schoolcore-loading__error';
    errorIcon.textContent = '×';
    errorIcon.setAttribute('aria-hidden', 'true');
    errorIcon.hidden = true;
    messageElement = document.createElement('p');
    backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'schoolcore-loading__back';
    backButton.textContent = 'Back';
    backButton.hidden = true;
    backButton.addEventListener('click', async () => {
      await window.schoolcoreLoading.hide();
      if (previousFocus) previousFocus.focus();
    });
    overlay.append(logo, spinnerElement, errorIcon, messageElement, backButton);
    document.body.appendChild(overlay);
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  window.schoolcoreLoading = {
    show(message = 'Loading…') {
      if (!overlay) createOverlay();
      generation++;
      startedAt = Date.now();
      previousFocus = document.activeElement;
      spinnerElement.hidden = false;
      errorIcon.hidden = true;
      backButton.hidden = true;
      messageElement.textContent = message;
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add('is-visible'));
    },
    async wait() {
      if (overlay && !overlay.hidden) {
        await wait(Math.max(0, minimumDuration - (Date.now() - startedAt)));
      }
    },
    async showError(message) {
      const current = generation;
      await this.wait();
      if (current !== generation) return;
      spinnerElement.hidden = true;
      errorIcon.hidden = false;
      messageElement.textContent = message;
      backButton.hidden = false;
      backButton.focus();
    },
    async hide() {
      if (!overlay || overlay.hidden) return;
      const current = generation;
      await this.wait();
      if (current !== generation) return;
      overlay.classList.remove('is-visible');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) await wait(200);
      if (current === generation) overlay.hidden = true;
    }
  };

  window.addEventListener('pageshow', (event) => {
    if (event.persisted && overlay) {
      generation++;
      overlay.hidden = true;
      overlay.classList.remove('is-visible');
    }
  });
})();
