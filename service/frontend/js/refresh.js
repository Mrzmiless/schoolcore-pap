// O gesto atua apenas em páginas da SchoolCore; iframes externos são independentes.
(function () {
  const translate = (key) => window.schoolcoreI18n ? window.schoolcoreI18n.t(key) : key;
  // Safari can ignore the viewport zoom setting; cancel its proprietary pinch gesture.
  for (const name of ['gesturestart', 'gesturechange']) {
    document.addEventListener(name, (event) => {
      if (event.cancelable) event.preventDefault();
    }, { passive: false });
  }
  const threshold = 80;
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let pulling = false;
  let ready = false;
  let refreshing = false;
  let indicator;
  let label;

  function atTop(target) {
    if ((window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) > 0) return false;
    let node = target instanceof Element ? target : target.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      const overflow = window.getComputedStyle(node).overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight && node.scrollTop > 0) return false;
      node = node.parentElement;
    }
    return true;
  }

  function showIndicator() {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'schoolcore-refresh';
      indicator.setAttribute('role', 'status');
      indicator.setAttribute('aria-live', 'polite');
      const icon = document.createElement('span');
      icon.className = 'schoolcore-refresh__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '↻';
      label = document.createElement('span');
      indicator.append(icon, label);
      document.body.appendChild(indicator);
    }
    label.textContent = translate(ready ? 'Solta para atualizar' : 'Puxa para atualizar');
    indicator.classList.add('is-visible');
  }

  function reset() {
    tracking = pulling = ready = false;
    if (indicator) indicator.classList.remove('is-visible');
  }

  document.addEventListener('touchstart', (event) => {
    if (refreshing) return;
    if (event.touches.length !== 1 || !atTop(event.target)) { reset(); return; }
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (target && target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]')) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    tracking = true;
    pulling = ready = false;
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!tracking || event.touches.length !== 1 || !atTop(event.target)) { reset(); return; }
    const dx = event.touches[0].clientX - startX;
    const dy = event.touches[0].clientY - startY;
    if (Math.abs(dx) > Math.max(12, Math.abs(dy))) { reset(); return; }
    if (dy <= 12) { if (pulling) reset(); return; }
    pulling = true;
    ready = dy >= threshold;
    if (event.cancelable) event.preventDefault();
    showIndicator();
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (!tracking || !ready) { reset(); return; }
    tracking = false;
    refreshing = true;
    label.textContent = translate('A atualizar…');
    indicator.classList.add('is-refreshing');
    window.setTimeout(() => {
      if (window.self !== window.top) window.parent.postMessage({ type: 'schoolcore:refresh' }, location.origin);
      else window.location.reload();
    }, 120);
  }, { passive: true });
  document.addEventListener('touchcancel', reset, { passive: true });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      refreshing = false;
      if (indicator) indicator.classList.remove('is-refreshing');
      reset();
    }
  });
})();
