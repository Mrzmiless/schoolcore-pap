// Preferências autenticadas: não guardar dados da conta no dispositivo.
(function () {
  const defaults = { theme: 'normal', navbar_blur: true, motion: 'system', text_size: 'normal', language: 'en' };
  let revision = 0;
  let current;

  function normalize(value) {
    value = value && typeof value === 'object' ? value : {};
    return {
      theme: ['normal', 'light', 'amoled'].includes(value.theme) ? value.theme : defaults.theme,
      navbar_blur: typeof value.navbar_blur === 'boolean' ? value.navbar_blur : defaults.navbar_blur,
      motion: ['system', 'reduced'].includes(value.motion) ? value.motion : defaults.motion,
      text_size: ['normal', 'large'].includes(value.text_size) ? value.text_size : defaults.text_size,
      language: ['pt-PT', 'en'].includes(value.language) ? value.language : defaults.language
    };
  }

  function apply(value) {
    const preferences = normalize(value);
    current = preferences;
    revision++;
    // Os atributos são a ponte entre as escolhas da conta e as variáveis CSS.
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.dataset.blur = preferences.navbar_blur ? 'on' : 'off';
    root.dataset.motion = preferences.motion;
    root.dataset.textSize = preferences.text_size;
    if (window.schoolcoreI18n) window.schoolcoreI18n.setLanguage(preferences.language);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', { normal: '#10322d', light: '#edf5ef', amoled: '#000000' }[preferences.theme]);
    return preferences;
  }

  const initialRevision = revision;
  // Só aceitamos mensagens da janela-mãe da mesma origem.
  window.addEventListener('message', (event) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin ||
        !event.data || event.data.type !== 'schoolcore:preferences') return;
    apply(event.data.preferences);
  });
  const ready = fetch('/api/preferences', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Could not load preferences');
      return response.json();
    })
    .then(value => {
      const preferences = normalize(value);
      // Uma resposta lenta não pode apagar uma pré-visualização mais recente.
      if (revision === initialRevision) apply(preferences);
      return preferences;
    })
    .catch(() => null);

  window.schoolcorePreferences = { defaults, apply, ready, current: () => current };
})();
