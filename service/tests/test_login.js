const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'login.js'), 'utf8');

function setup(responses) {
  const handlers = {};
  const windowHandlers = {};
  const timers = new Map();
  const calls = [];
  const messages = [];
  const navigations = [];
  const button = { disabled: false };
  const status = { textContent: '' };
  const picker = { value: '', handlers: {}, addEventListener(name, handler) { this.handlers[name] = handler; } };
  const form = {
    username: { value: 'example' }, password: { value: 'password' },
    querySelector: () => button,
    addEventListener: (name, handler) => { handlers[name] = handler; }
  };
  const document = {
    body: { classList: { add() {}, remove() {} } },
    getElementById: id => id === 'login-form' ? form : id === 'login-language' ? picker : status,
    querySelector: () => button
  };
  const window = {
    addEventListener: (name, handler) => { windowHandlers[name] = handler; },
    setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    location: { assign: url => navigations.push(url) },
    schoolcoreLoading: {
      show() {}, wait: async () => {}, showError: async message => messages.push(message)
    }
  };
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const response = responses.shift();
    if (response === 'hang') return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    if (response instanceof Error) throw response;
    const status = typeof response === 'object' ? response.status : response;
    return { status, ok: status === 200, json: async () => ({ detail: response.detail }) };
  };
  vm.runInNewContext(source, { document, window, navigator: {}, fetch, AbortController,
    sessionStorage: { getItem: () => null } });
  const submit = () => handlers.submit({ preventDefault() {}, currentTarget: form });
  return { submit, form, button, status, picker, timers, calls, messages, navigations, windowHandlers, window };
}

test('login language starts in English and can change without saving account preferences', () => {
  const app = setup([]);
  const changes = [];
  app.window.schoolcoreI18n = { setLanguage: language => changes.push(language) };
  assert.equal(app.picker.value, 'en');
  app.picker.value = 'pt-PT';
  app.picker.handlers.change();
  assert.deepEqual(changes, ['pt-PT']);
  assert.equal(app.calls.length, 0);
});

test('successful login verifies the session before navigating', async () => {
  const app = setup([200, 200]);
  await app.submit();
  assert.deepEqual(app.calls.map(call => call.url), ['../../api/login', '../../api/me']);
  assert.deepEqual(app.navigations, ['../start/index.html']);
  assert.equal(app.form.password.value, '');
  assert.equal(app.timers.size, 0);
});

test('missing session explains cookies instead of redirecting to login', async () => {
  const app = setup([200, 401]);
  await app.submit();
  assert.match(app.messages[0], /cookies.*HTTPS/);
  assert.deepEqual(app.navigations, []);
  assert.equal(app.button.disabled, false);
});

test('invalid credentials and server errors allow another attempt', async () => {
  for (const code of [401, 429, 503]) {
    const app = setup([code]);
    await app.submit();
    assert.equal(app.calls.length, 1);
    assert.ok(app.messages[0]);
    assert.equal(app.button.disabled, false);
  }
});

test('origin rejection is distinguished from a disabled account', async () => {
  for (const [detail, expected] of [['Invalid origin', /APP_ORIGIN/], ['account_disabled', /disabled/]]) {
    const app = setup([{ status: 403, detail }]);
    await app.submit();
    assert.match(app.messages[0], expected);
    assert.deepEqual(app.navigations, []);
  }
});

test('a stalled login times out and prevents duplicate submissions', async () => {
  const app = setup(['hang']);
  const pending = app.submit();
  await app.submit();
  assert.equal(app.calls.length, 1);
  [...app.timers.values()][0]();
  await pending;
  assert.match(app.messages[0], /too long/);
  assert.equal(app.button.disabled, false);
});

test('a stalled session check also times out', async () => {
  const app = setup([200, 'hang']);
  const pending = app.submit();
  await new Promise(resolve => setImmediate(resolve));
  [...app.timers.values()][0]();
  await pending;
  assert.match(app.messages[0], /too long/);
  assert.deepEqual(app.navigations, []);
});

test('back-forward cache restores the login button', () => {
  const app = setup([]);
  app.button.disabled = true;
  app.status.textContent = 'Signing in…';
  app.windowHandlers.pageshow({ persisted: true });
  assert.equal(app.button.disabled, false);
  assert.equal(app.status.textContent, '');
});
