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
    constructor() { this.handlers = {}; this.classes = new Set(); this.style = {}; this.dataset = {}; this.hidden = false;
      this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) }; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    setAttribute() {}
    removeAttribute() {}
    contains(target) { return target === this; }
  }
  const nav = new Element();
  const elements = {};
  const frame = elements['page-frame'] = new Element();
  frame.contentWindow = { location: { href: 'about:blank', pathname: 'blank' } };
  const document = { handlers: {}, getElementById: id => elements[id] ||= new Element(),
    querySelector: () => nav, querySelectorAll: () => [],
    addEventListener(name, fn) { this.handlers[name] = fn; } };
  const window = { handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; } };
  const setTimeout = (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id; };
  const clearTimeout = id => timers.delete(id);
  vm.runInNewContext(source, { document, window, location: { hash: '', origin: 'https://school.test' }, setTimeout, clearTimeout });
  const expire = delay => { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); } };
  return { nav, document, expire, frame, elements };
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
