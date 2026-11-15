// Preferências autenticadas: não guardar dados da conta no dispositivo.
(function () {
  const defaults = { theme: 'normal', navbar_blur: true, motion: 'system', text_size: 'normal' };
  let revision = 0;

  function normalize(value) {
    value = value && typeof value === 'object' ? value : {};
    return {
      theme: ['normal', 'light', 'amoled'].includes(value.theme) ? value.theme : defaults.theme,
      navbar_blur: typeof value.navbar_blur === 'boolean' ? value.navbar_blur : defaults.navbar_blur,
      motion: ['system', 'reduced'].includes(value.motion) ? value.motion : defaults.motion,
      text_size: ['normal', 'large'].includes(value.text_size) ? value.text_size : defaults.text_size
    };
  }

  function apply(value) {
    const preferences = normalize(value);
    revision++;
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.dataset.blur = preferences.navbar_blur ? 'on' : 'off';
    root.dataset.motion = preferences.motion;
    root.dataset.textSize = preferences.text_size;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', { normal: '#10322d', light: '#edf5ef', amoled: '#000000' }[preferences.theme]);
    return preferences;
  }

  const initialRevision = revision;
  const ready = fetch('/api/preferences', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Could not load preferences');
      return response.json();
    })
    .then(value => {
      const preferences = normalize(value);
      if (revision === initialRevision) apply(preferences);
      return preferences;
    })
    .catch(() => null);

  window.schoolcorePreferences = { defaults, apply, ready };
})();
