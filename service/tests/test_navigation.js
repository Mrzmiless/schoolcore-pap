const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'home.js'), 'utf8');
function setup() {
  const timers = new Map();
  let next = 0;
  class Element {
    constructor() { this.handlers = {}; this.classes = new Set(); this.style = {}; this.dataset = {}; this.hidden = false; this.attributes = {};
      this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) }; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    contains(target) { return target === this; }
  }
  const nav = new Element();
  const elements = {};
  const frame = elements['page-frame'] = new Element();
  frame.contentWindow = { location: { href: 'about:blank', pathname: 'blank' } };
  const document = { handlers: {}, getElementById: id => elements[id] ||= new Element(),
    querySelector: () => nav, querySelectorAll: () => [],
    addEventListener(name, fn) { this.handlers[name] = fn; } };
  const window = { handlers: {}, reloads: 0, addEventListener(name, fn) { this.handlers[name] = fn; } };
  window.location = { reload() { window.reloads++; } };
  const setTimeout = (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id; };
  const clearTimeout = id => timers.delete(id);
  const location = { hash: '', origin: 'https://school.test' };
  vm.runInNewContext(source, { document, window, location, setTimeout, clearTimeout });
  const expire = delay => { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); } };
  return { nav, document, expire, frame, elements, window, location };
}
test('navigation shrinks after three seconds and resets on activity', () => {
  const app = setup();
  app.nav.handlers.pointerdown();
  assert.equal(app.nav.classes.has('is-expanded'), true);
  app.nav.handlers.pointermove({ pointerType: 'mouse' });
  app.expire(3000);
  assert.equal(app.nav.classes.has('is-expanded'), false);
});
test('keyboard focus keeps navigation open until focus leaves', () => {
  const app = setup();
  app.nav.handlers.focusin({ target: { matches: () => true } });
  app.expire(3000);
  assert.equal(app.nav.classes.has('is-expanded'), true);
  app.nav.handlers.focusout({ relatedTarget: null });
  app.expire(3000);
  assert.equal(app.nav.classes.has('is-expanded'), false);
});
test('initial splash closes when the home frame loads', () => {
  const app = setup();
  app.frame.handlers.load();
  assert.equal(app.elements['home-splash'].hidden, true);
});
test('Lunch loads only the GIAE frame and keeps it when switching tabs', () => {
  const app = setup();
  const lunch = app.elements['lunch-frame'];
  const panel = app.elements['lunch-panel'];
  assert.equal(lunch.src, undefined);
  app.location.hash = '#lunch';
  app.window.handlers.hashchange();
  assert.equal(panel.hidden, false);
  assert.equal(app.frame.hidden, true);
  assert.equal(lunch.src, 'https://giae.aeb.pt/');
  assert.equal(app.elements.content.attributes['aria-busy'], 'false');
  lunch.src = 'https://giae.aeb.pt/example-internal-page';
  app.location.hash = '#user';
  app.window.handlers.hashchange();
  assert.equal(panel.hidden, true);
  assert.equal(app.frame.hidden, false);
  assert.equal(app.frame.src, './account.html?embedded=1');
  app.location.hash = '#lunch';
  app.window.handlers.hashchange();
  assert.equal(panel.hidden, false);
  assert.equal(lunch.src, 'https://giae.aeb.pt/example-internal-page');
});
test('Lunch retry returns only the GIAE frame to its initial address', () => {
  const app = setup();
  app.location.hash = '#lunch';
  app.window.handlers.hashchange();
  const originalFrameSrc = app.frame.src;
  app.elements['lunch-frame'].src = 'https://giae.aeb.pt/example-internal-page';
  app.elements['lunch-retry'].handlers.click();
  assert.equal(app.elements['lunch-frame'].src, 'https://giae.aeb.pt/');
  assert.equal(app.frame.src, originalFrameSrc);
  assert.equal(app.elements['lunch-panel'].hidden, false);
});
test('refresh messages only work from the active same-origin SchoolCore frame', () => {
  const app = setup();
  const send = (origin, source) => app.window.handlers.message({ origin, source, data: { type: 'schoolcore:refresh' } });
  send('https://evil.test', app.frame.contentWindow);
  send('https://school.test', {});
  assert.equal(app.window.reloads, 0);
  send('https://school.test', app.frame.contentWindow);
  assert.equal(app.window.reloads, 1);
});
