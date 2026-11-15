const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'security.js'), 'utf8');
function setup() {
  const elements = {};
  const requests = [];
  const timers = new Map();
  let next = 0;
  class Element {
    constructor() { this.handlers = {}; this.value = ''; this.hidden = false; this.open = false; this.button = { disabled: false }; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    querySelector() { return this.button; }
    focus() {}
  }
  const get = id => elements[id] ||= new Element();
  const document = { getElementById: get };
  const window = { handlers: {}, self: {}, top: { location: { replace() {} } },
    addEventListener(name, fn) { this.handlers[name] = fn; }, dispatchEvent() {}, confirm: () => true };
  const fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ email: 'new@example.test' }) };
  };
  const setTimeout = (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id; };
  const clearTimeout = id => timers.delete(id);
  vm.runInNewContext(source, { document, window, fetch, setTimeout, clearTimeout, CustomEvent: class {} });
  const submit = id => get(id).handlers.submit({ preventDefault() {}, currentTarget: get(id) });
  return { get, requests, timers, submit };
}
test('security opens after password and locks when section closes', async () => {
  const app = setup();
  app.get('security-section').open = true;
  app.get('security-current-password').value = 'secret';
  await app.submit('security-unlock-form');
  assert.equal(app.get('security-controls').hidden, false);
  assert.equal(app.get('security-current-password').value, '');
  assert.equal(JSON.parse(app.requests[0].options.body).password, 'secret');
  app.get('security-section').open = false;
  app.get('security-section').handlers.toggle();
  assert.equal(app.get('security-controls').hidden, true);
  assert.match(app.requests.at(-1).url, /security\/lock$/);
});
test('unlock expires and password confirmation prevents a mismatched change', async () => {
  const app = setup();
  app.get('security-section').open = true;
  await app.submit('security-unlock-form');
  app.get('security-new-password').value = 'password-12345';
  app.get('security-confirm-password').value = 'different-password';
  await app.submit('security-password-form');
  assert.equal(app.requests.length, 1);
  assert.match(app.get('security-status').textContent, /não coincidem/);
  [...app.timers.values()].find(timer => timer.delay === 300000).fn();
  assert.equal(app.get('security-controls').hidden, true);
  assert.match(app.get('security-status').textContent, /expirado/);
  assert.match(app.requests.at(-1).url, /security\/lock$/);
});
