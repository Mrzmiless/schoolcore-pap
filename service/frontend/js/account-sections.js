// Fallback para navegadores sem transições nativas de ::details-content.
(function () {
  if (window.CSS && CSS.supports('selector(details::details-content)') &&
      CSS.supports('interpolate-size: allow-keywords')) return;

  document.querySelectorAll('.account-section').forEach(section => {
    const summary = section.querySelector('summary');
    let animation;
    let originalOverflow;
    summary.addEventListener('click', event => {
      const reduced = document.documentElement.dataset.motion === 'reduced' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced || typeof section.animate !== 'function') return;
      event.preventDefault();
      // Cliques rápidos não devem deixar uma animação antiga a mandar na secção.
      if (animation) {
        animation.cancel();
        section.style.overflow = originalOverflow;
        animation = null;
      }
      const from = section.getBoundingClientRect().height;
      // O estado e o evento toggle mudam imediatamente, incluindo em Segurança.
      section.open = !section.open;
      const to = section.getBoundingClientRect().height;
      if (from === to) return;
      originalOverflow = section.style.overflow;
      section.style.overflow = 'hidden';
      const current = section.animate([{ height: from + 'px' }, { height: to + 'px' }],
        { duration: 220, easing: 'ease' });
      animation = current;
      const cleanup = () => {
        if (animation !== current) return;
        section.style.overflow = originalOverflow;
        animation = null;
      };
      current.onfinish = cleanup;
      current.oncancel = cleanup;
    });
  });
})();
