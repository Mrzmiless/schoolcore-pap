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
  const links = ['sinfo', 'bar', 'home', 'user'].map(page => {
    const link = new Element();
    link.dataset.page = page;
    return link;
  });
  const document = { handlers: {}, getElementById: id => elements[id] ||= new Element(),
    querySelector: () => nav, querySelectorAll: () => links,
    addEventListener(name, fn) { this.handlers[name] = fn; } };
  const window = { handlers: {}, reloads: 0, addEventListener(name, fn) { this.handlers[name] = fn; } };
  window.location = { reload() { window.reloads++; } };
  const setTimeout = (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id; };
  const clearTimeout = id => timers.delete(id);
  const location = { hash: '', origin: 'https://school.test' };
  vm.runInNewContext(source, { document, window, location, setTimeout, clearTimeout });
  const expire = delay => { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); } };
  return { nav, document, expire, frame, elements, window, location, links };
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
test('internal navigation keeps the account active when returning from Lunch', () => {
  const app = setup();
  const user = app.links.find(link => link.dataset.page === 'user');
  user.handlers.click();
  assert.equal(app.frame.src, './account.html?embedded=1');
  assert.equal(user.attributes['aria-current'], 'page');
  // The external link has no data-page and therefore no navigation handler.
  assert.equal(app.links.some(link => link.dataset.page === 'lunch'), false);
  app.window.handlers.pageshow?.({ persisted: true });
  assert.equal(app.frame.src, './account.html?embedded=1');
  assert.equal(user.attributes['aria-current'], 'page');
});
test('legacy Lunch hashes do not open an external site automatically', () => {
  const app = setup();
  app.location.hash = '#lunch';
  app.window.handlers.hashchange();
  assert.equal(app.frame.src, undefined);
  assert.equal(app.elements['lunch-frame'], undefined);
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
