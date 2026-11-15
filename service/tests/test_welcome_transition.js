const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const directory = path.join(__dirname, '..', 'frontend');
const welcomeSource = fs.readFileSync(path.join(directory, 'js', 'welcome.js'), 'utf8');
const loginSource = fs.readFileSync(path.join(directory, 'js', 'login.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup({ status = 401, onboarded = true, standalone = true, reduced = false, native = false, failure = false } = {}) {
  const elements = {};
  const windowHandlers = {};
  const timers = [];
  const storage = new Map();
  const navigations = [];
  class Element {
    constructor() {
      this.handlers = {};
      this.hidden = true;
      this.classes = new Set();
      this.classList = { add: value => this.classes.add(value), remove: value => this.classes.delete(value) };
      this.href = 'https://school.test/pages/login/index.html';
    }
    addEventListener(name, callback) { this.handlers[name] = callback; }
    focus() {}
  }
  const get = id => elements[id] ||= new Element();
  const root = new Element();
  const body = new Element();
  const document = { getElementById: get, querySelector: selector => get(selector),
    documentElement: root, body, readyState: 'loading' };
  const navigator = { standalone, userAgent: '', platform: '' };
  const window = {
    navigator,
    matchMedia: query => ({ matches: query.includes('reduced-motion') ? reduced : standalone,
      addEventListener() {} }),
    addEventListener(name, callback) { windowHandlers[name] = callback; },
    setTimeout(callback, delay) { timers.push({ callback, delay }); },
    location: { replace: value => navigations.push(value), assign: value => navigations.push(value) }
  };
  if (native) { window.onpageswap = null; window.onpagereveal = null; window.CSS = { supports: () => true }; }
  const sessionStorage = { setItem: (key, value) => storage.set(key, value),
    getItem: key => storage.get(key), removeItem: key => storage.delete(key) };
  const fetch = async () => {
    if (failure) throw new Error('unavailable');
    return { status, ok: status === 200, json: async () => ({ is_first_login_done: onboarded }) };
  };
  vm.runInNewContext(welcomeSource, { document, window, navigator, fetch, sessionStorage });
  return { get, document, root, window, navigator, windowHandlers, timers, storage, navigations, sessionStorage };
}

test('unauthenticated visitors see the welcome screen in app and browser', async () => {
  for (const standalone of [true, false]) {
    const app = setup({ standalone });
    await flush();
    assert.equal(app.get('startup-splash').hidden, true);
    assert.equal(app.root.classes.has('startup-checked'), true);
    assert.deepEqual(app.navigations, []);
  }
});
test('authenticated visitors skip welcome but still complete onboarding when needed', async () => {
  for (const onboarded of [true, false]) {
    const app = setup({ status: 200, onboarded });
    await flush();
    assert.equal(app.navigations[0], onboarded ? './pages/start/HomePage.html' : './pages/start/index.html');
  }
});
test('connection errors offer retry instead of pretending the user is logged out', async () => {
  const app = setup({ failure: true });
  await flush();
  assert.equal(app.get('startup-splash').hidden, false);
  assert.equal(app.get('startup-retry').hidden, false);
  assert.deepEqual(app.navigations, []);
});
test('fallback navigation animates and carries a one-use transition flag', async () => {
  const app = setup();
  await flush();
  let prevented = false;
  app.get('.continuar').handlers.click({ button: 0, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(app.get('.group-1').classes.has('is-leaving'), true);
  assert.equal(app.storage.get('schoolcore:welcome-transition'), '1');
  assert.equal(app.timers[0].delay, 180);
  app.timers[0].callback();
  assert.equal(app.navigations[0], 'https://school.test/pages/login/index.html');
  vm.runInNewContext(loginSource, { document: app.document, window: app.window,
    navigator: app.navigator, sessionStorage: app.sessionStorage });
  assert.equal(app.document.body.classes.has('auth-arriving'), true);
  assert.equal(app.storage.has('schoolcore:welcome-transition'), false);
});
test('native transitions, modified clicks and reduced motion keep normal navigation', async () => {
  for (const options of [{ native: true }, { reduced: true }, {}]) {
    const app = setup(options);
    await flush();
    let prevented = false;
    app.get('.continuar').handlers.click({ button: 0, ctrlKey: !options.native && !options.reduced,
      preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    assert.equal(app.timers.length, 0);
  }
});
