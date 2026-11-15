if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

// Popup para instalar a webapp no telemóvel.
(function () {
  const overlay = document.getElementById('installOverlay');
  if (!overlay) return;

  const titleEl = document.getElementById('installTitle');
  const textEl = document.getElementById('installText');
  const stepsEl = document.getElementById('installSteps');
  const actionEl = document.getElementById('installAction');
  const cardEl = document.getElementById('installCard');
  const SHOW_DELAY_MS = 900;
  const SHARE_ICON = '<svg class="install-share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  let deferredPrompt = null;
  let shown = false;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true;
  }

  // Uma sessão válida vai diretamente para a conta; sem sessão mostramos as boas-vindas.
  {
    const splash = document.getElementById('startup-splash');
    const message = document.getElementById('startup-message');
    const retry = document.getElementById('startup-retry');
    async function resume() {
      splash.hidden = false;
      retry.hidden = true;
      message.textContent = 'Logging in…';
      try {
        const response = await fetch('./api/me', { cache: 'no-store' });
        if (response.status === 401) {
          document.documentElement.classList.add('startup-checked');
          splash.hidden = true;
          return;
        }
        if (!response.ok) throw new Error();
        const user = await response.json();
        window.location.replace(user.is_first_login_done ? './pages/start/HomePage.html' : './pages/start/index.html');
      } catch (error) {
        message.textContent = 'Could not reach the server. Please try again.';
        retry.hidden = false;
        retry.focus();
      }
    }
    retry.addEventListener('click', resume);
    resume();
  }

  const continueLink = document.querySelector('.continuar');
  continueLink.addEventListener('click', (event) => {
    const crossDocumentTransitions = 'onpageswap' in window && 'onpagereveal' in window &&
      window.CSS && window.CSS.supports('view-transition-name', 'auth-button');
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        crossDocumentTransitions || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    try { sessionStorage.setItem('schoolcore:welcome-transition', '1'); } catch (error) { /* Animation is optional. */ }
    document.querySelector('.group-1').classList.add('is-leaving');
    window.setTimeout(() => window.location.assign(continueLink.href), 180);
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) document.querySelector('.group-1').classList.remove('is-leaving');
  });

  function getPlatform() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  // No iOS só o Safari permite "Adicionar ao ecrã principal".
  function isIOSSafari() {
    const ua = navigator.userAgent || '';
    return !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  }

  function setSteps(steps) {
    if (!steps.length) {
      stepsEl.hidden = true;
      stepsEl.innerHTML = '';
      return;
    }
    stepsEl.innerHTML = '<ol>' + steps.map((step) => '<li>' + step + '</li>').join('') + '</ol>';
    stepsEl.hidden = false;
  }

  function render() {
    const platform = getPlatform();
    actionEl.hidden = true;
    actionEl.textContent = 'Install now';
    if (platform === 'ios') {
      const safari = isIOSSafari();
      titleEl.textContent = safari ? 'Install on your iPhone' : 'Open in Safari';
      textEl.textContent = safari
        ? 'Add SchoolCore to your home screen to use it as an app.'
        : 'For the best installation experience, copy the link and open it in Safari.';
      setSteps([
        'Open this site in <strong>Safari</strong>.',
        'Tap the <strong>Share</strong> button ' + SHARE_ICON + ' in the Safari toolbar.',
        'Choose <strong>Add to Home Screen</strong>.',
        'Tap <strong>Add</strong> to confirm.'
      ]);
      return;
    }
    if (platform === 'android') {
      titleEl.textContent = 'Install on your phone';
      textEl.textContent = 'Install SchoolCore to open it faster without the browser.';
      if (deferredPrompt) {
        setSteps([]);
        actionEl.hidden = false;
      } else {
        setSteps([
          'Tap the browser menu <strong>⋮</strong>.',
          'Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.',
          'Tap <strong>Install</strong> to confirm.'
        ]);
      }
      return;
    }
    // Computador (Windows, macOS ou Linux).
    titleEl.textContent = 'Available on mobile only';
    textEl.textContent = 'This service is not available on computers. Open the site on an Android phone or iPhone to install the app.';
    setSteps([]);
  }

  function open() {
    if (shown || isStandalone()) return;
    render();
    overlay.hidden = false;
    shown = true;
    requestAnimationFrame(() => {
      (actionEl.hidden ? cardEl : actionEl).focus({ preventScroll: true });
    });
  }

  function hide() {
    overlay.hidden = true;
    shown = false;
  }

  actionEl.addEventListener('click', async () => {
    const platform = getPlatform();
    if (platform === 'android' && deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      try {
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          hide();
          return;
        }
      } catch (error) {
        // Se o prompt falhar, mostramos as instruções manuais.
      }
      // O utilizador recusou: o popup mantém-se e passam a aparecer os passos manuais.
      render();
    }
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (shown) render();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hide();
  });

  // Se a app passar a correr como instalada, esconder o popup.
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  const onStandaloneChange = (event) => {
    if (event.matches) hide();
  };
  if (typeof standaloneQuery.addEventListener === 'function') {
    standaloneQuery.addEventListener('change', onStandaloneChange);
  }
  function scheduleShow() {
    if (isStandalone()) return;
    window.setTimeout(open, SHOW_DELAY_MS);
  }
  if (document.readyState === 'complete') {
    scheduleShow();
  } else {
    window.addEventListener('load', scheduleShow);
  }
})();
