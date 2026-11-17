const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'account.js'), 'utf8');
const preferencesSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'preferences.js'), 'utf8');
const defaults = { theme: 'normal', navbar_blur: true, motion: 'system', text_size: 'normal', language: 'en' };
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const elements = {};
  const requests = [];
  const previews = [];
  const messages = [];
  const timers = new Map();
  let nextTimer = 0;
  class Element {
    constructor() { this.handlers = {}; this.attributes = {}; this.value = ''; this.checked = false; this.open = false; }
    addEventListener(name, handler) { this.handlers[name] = handler; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
  }
  const get = id => elements[id] ||= new Element();
  const sections = [new Element(), new Element()];
  const document = { getElementById: get, querySelectorAll: () => sections, documentElement: { dataset: {} } };
  const parent = { postMessage: message => messages.push(message) };
  const window = {
    parent, top: parent, self: {}, confirm: () => true, addEventListener() {}, matchMedia: () => ({ matches: false }),
    schoolcorePreferences: {
      defaults,
      ready: Promise.resolve({ ...defaults }),
      apply: preferences => { previews.push({ ...preferences }); return preferences; }
    }
  };
  const fetch = (url, options) => {
    if (url.endsWith('/api/me')) return Promise.resolve({ ok: true, json: async () => ({ username: 'test', id: 'private-id', email: 'private@example.test', phone_number: '123456' }) });
    return new Promise((resolve, reject) => requests.push({ payload: JSON.parse(options.body), resolve, reject }));
  };
  const setTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; };
  const clearTimeout = id => timers.delete(id);
  vm.runInNewContext(source, { document, window, fetch, setTimeout, clearTimeout, location: { origin: 'https://school.test' } });
  return { get, sections, requests, previews, messages, timers, document, window };
}

test('private values remain out of the DOM until revealed and are removed after concealment', async () => {
  const app = setup();
  await flush();
  for (const key of ['id', 'email', 'phone']) {
    assert.notEqual(app.get('account-' + key).textContent, { id: 'private-id', email: 'private@example.test', phone: '123456' }[key]);
  }
  app.get('reveal-email').handlers.click();
  assert.equal(app.get('account-email').textContent, 'private@example.test');
  assert.equal(app.get('reveal-email').getAttribute('aria-pressed'), 'true');
  assert.equal(app.get('account-email').getAttribute('aria-hidden'), 'false');
  assert.equal(app.get('private-email').getAttribute('data-state'), 'revealed');
  app.get('reveal-email').handlers.click();
  assert.equal(app.get('account-email').getAttribute('aria-hidden'), 'true');
  assert.equal(app.get('private-email').getAttribute('data-state'), 'concealing');
  const timer = [...app.timers.values()][0];
  assert.equal(timer.delay, 160);
  timer.callback();
  assert.equal(app.get('account-email').textContent, '');
  assert.equal(app.get('private-email').getAttribute('data-state'), 'hidden');
});

test('rapid reveal cancels concealment and reduced motion hides immediately', async () => {
  const app = setup();
  await flush();
  const button = app.get('reveal-id');
  button.handlers.click();
  button.handlers.click();
  assert.equal(app.timers.size, 1);
  button.handlers.click();
  assert.equal(app.timers.size, 0);
  assert.equal(app.get('account-id').textContent, 'private-id');
  app.document.documentElement.dataset.motion = 'reduced';
  button.handlers.click();
  assert.equal(app.get('private-id').getAttribute('data-state'), 'hidden');
  assert.equal(app.get('account-id').textContent, '');
  assert.equal(app.timers.size, 0);
});

test('system reduced motion also hides the value immediately', async () => {
  const app = setup();
  await flush();
  app.window.matchMedia = () => ({ matches: true });
  app.get('reveal-phone').handlers.click();
  app.get('reveal-phone').handlers.click();
  assert.equal(app.get('account-phone').textContent, '');
  assert.equal(app.timers.size, 0);
});

test('account sections start closed and opening one closes the other', async () => {
  const app = setup();
  await flush();
  assert.equal(app.sections[0].open, false);
  assert.equal(app.sections[1].open, false);
  app.sections[0].open = true;
  app.sections[0].handlers.toggle();
  app.sections[1].open = true;
  app.sections[1].handlers.toggle();
  assert.equal(app.sections[0].open, false);
  assert.equal(app.sections[1].open, true);
});

test('rapid preference changes are previewed and saved in order', async () => {
  const app = setup();
  await flush();
  app.get('setting-theme').value = 'light';
  app.get('preferences-form').handlers.change();
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].payload.theme, 'light');
  app.get('setting-theme').value = 'amoled';
  app.get('preferences-form').handlers.change();
  assert.equal(app.requests.length, 1);
  assert.equal(app.previews.at(-1).theme, 'amoled');
  assert.equal(app.messages.at(-1).type, 'schoolcore:preferences');
  app.requests[0].resolve({ ok: true, json: async () => app.requests[0].payload });
  await flush();
  assert.equal(app.requests.length, 2);
  assert.equal(app.requests[1].payload.theme, 'amoled');
  app.requests[1].resolve({ ok: true, json: async () => app.requests[1].payload });
  await flush();
  assert.equal(app.get('preferences-status').textContent, 'Guardado.');
});

test('a failed save restores the last confirmed preferences', async () => {
  const app = setup();
  await flush();
  app.get('setting-theme').value = 'light';
  app.get('preferences-form').handlers.change();
  app.requests[0].reject(new Error('network failure'));
  await flush();
  assert.equal(app.get('setting-theme').value, 'normal');
  assert.equal(app.previews.at(-1).theme, 'normal');
  assert.match(app.get('preferences-status').textContent, /Não foi possível guardar/);
});

test('reset restores and saves the defaults after confirmation', async () => {
  const app = setup();
  await flush();
  app.get('setting-theme').value = 'light';
  app.get('preferences-form').handlers.change();
  app.requests[0].resolve({ ok: true, json: async () => app.requests[0].payload });
  await flush();
  app.get('reset-preferences').handlers.click();
  assert.equal(app.get('setting-theme').value, 'normal');
  assert.deepEqual(app.requests[1].payload, defaults);
  app.requests[1].resolve({ ok: true, json: async () => app.requests[1].payload });
  await flush();
  assert.equal(app.get('preferences-status').textContent, 'Guardado.');
});

test('a delayed initial load does not overwrite a newer theme preview', async () => {
  let finishFetch;
  const fetch = () => new Promise(resolve => { finishFetch = resolve; });
  const meta = { setAttribute(name, value) { this[name] = value; } };
  const document = { documentElement: { dataset: {} }, querySelector: () => meta };
  const window = { addEventListener() {} };
  vm.runInNewContext(preferencesSource, { document, window, fetch });
  window.schoolcorePreferences.apply({ ...defaults, theme: 'amoled', navbar_blur: false });
  finishFetch({ ok: true, json: async () => ({ ...defaults, theme: 'light' }) });
  await window.schoolcorePreferences.ready;
  assert.equal(document.documentElement.dataset.theme, 'amoled');
  assert.equal(document.documentElement.dataset.blur, 'off');
  assert.equal(meta.content, '#000000');
});

test('language changes are saved and failed changes restore the saved language', async () => {
  const app = setup();
  await flush();
  app.get('setting-language').value = 'pt-PT';
  app.get('preferences-form').handlers.change();
  assert.equal(app.requests[0].payload.language, 'pt-PT');
  assert.equal(app.previews.at(-1).language, 'pt-PT');
  app.requests[0].reject(new Error('offline'));
  await flush();
  assert.equal(app.get('setting-language').value, 'en');
  assert.equal(app.previews.at(-1).language, 'en');
});

test('embedded preferences only accept messages from their same-origin parent', () => {
  const handlers = {};
  const parent = {};
  const document = { documentElement: { dataset: {} }, querySelector: () => null };
  const window = { parent, location: { origin: 'https://school.test' },
    addEventListener: (name, handler) => { handlers[name] = handler; } };
  const fetch = () => new Promise(() => {});
  vm.runInNewContext(preferencesSource, { document, window, fetch });
  const send = (origin, source) => handlers.message({
    origin, source, data: { type: 'schoolcore:preferences', preferences: { ...defaults, language: 'pt-PT' } }
  });
  send('https://evil.test', parent);
  send('https://school.test', {});
  assert.equal(window.schoolcorePreferences.current(), undefined);
  send('https://school.test', parent);
  assert.equal(window.schoolcorePreferences.current().language, 'pt-PT');
});
