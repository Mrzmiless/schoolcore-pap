// Shared loading screen for navigation and asynchronous operations.
(function () {
  const translate = (key) => window.schoolcoreI18n ? window.schoolcoreI18n.t(key) : key;
  const minimumDuration = 0;
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
      notice = document.createElement('div');
      notice.className = 'schoolcore-notice';
      notice.setAttribute('role', 'alert');
      noticeText = document.createElement('p');
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.setAttribute('aria-label', translate('Dismiss notification'));
      dismiss.textContent = '×';
      dismiss.addEventListener('click', () => { notice.hidden = true; });
      notice.append(noticeText, dismiss);
      document.body.appendChild(notice);
    }
    noticeText.textContent = translate(message);
    notice.hidden = false;
  }

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, document.baseURI);
    const isApi = url.origin === window.location.origin && url.pathname.startsWith('/api/');
    try {
      const response = await originalFetch.call(this, input, init);
      // A notificação é informativa; quem chamou fetch continua a receber a resposta original.
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
  window.addEventListener('online', () => {
    if (notice) notice.hidden = true;
  });

  function createOverlay() {
    document.body.classList.add('schoolcore-animate-main');
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
    backButton.textContent = translate('Back');
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
      // Identifica esta operação para uma anterior não esconder o ecrã por engano.
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
      if (document.documentElement.dataset.motion !== 'reduced' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) await wait(120);
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
