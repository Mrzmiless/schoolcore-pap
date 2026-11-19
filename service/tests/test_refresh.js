const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'refresh.js'), 'utf8');
function setup({ embedded = false, scrolled = false, interactive = false, nestedScroll = false } = {}) {
  const handlers = {};
  const timers = [];
  const messages = [];
  let reloads = 0;
  class Element {
    constructor() {
      this.parentElement = null;
      this.scrollTop = 0;
      this.scrollHeight = 0;
      this.clientHeight = 0;
      this.overflow = 'visible';
      this.children = [];
      this.classes = new Set();
      this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
    }
    setAttribute() {}
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    closest() { return interactive ? this : null; }
  }
  const body = new Element();
  const html = new Element();
  const target = new Element();
  target.parentElement = body;
  if (nestedScroll) { target.overflow = 'auto'; target.scrollHeight = 200; target.clientHeight = 100; target.scrollTop = 25; }
  const document = { body, documentElement: html,
    createElement: () => new Element(), addEventListener(name, fn) { handlers[name] = fn; } };
  const parent = { postMessage: (data, origin) => messages.push({ type: data.type, origin }) };
  const window = { scrollY: scrolled ? 20 : 0, getComputedStyle: node => ({ overflowY: node.overflow }),
    location: { reload() { reloads++; } }, setTimeout: fn => timers.push(fn),
    addEventListener() {}, parent };
  window.self = window;
  window.top = embedded ? parent : window;
  vm.runInNewContext(source, { document, window, Element, location: { origin: 'https://school.test' } });
  function start(x = 10, y = 10, touches = 1) {
    handlers.touchstart({ target, touches: Array.from({ length: touches }, () => ({ clientX: x, clientY: y })) });
  }
  function move(x, y, touches = 1) {
    let prevented = false;
    handlers.touchmove({ target, touches: Array.from({ length: touches }, () => ({ clientX: x, clientY: y })),
      cancelable: true, preventDefault() { prevented = true; } });
    return prevented;
  }
  return { handlers, timers, messages, body, target, start, move, get reloads() { return reloads; } };
}

test('downward gesture at the top shows feedback and refreshes once', () => {
  const app = setup();
  app.start();
  assert.equal(app.move(12, 100), true);
  assert.equal(app.body.children[0].classes.has('is-visible'), true);
  assert.equal(app.body.children[0].children[1].textContent, 'Solta para atualizar');
  app.handlers.touchend();
  assert.equal(app.body.children[0].children[1].textContent, 'A atualizar…');
  app.timers[0]();
  assert.equal(app.reloads, 1);
});
test('embedded pages request a refresh from their parent', () => {
  const app = setup({ embedded: true });
  app.start();
  app.move(10, 110);
  app.handlers.touchend();
  app.timers[0]();
  assert.deepEqual(app.messages, [{ type: 'schoolcore:refresh', origin: 'https://school.test' }]);
  assert.equal(app.reloads, 0);
});
test('Safari pinch gestures are not blocked', () => {
  const app = setup();
  for (const name of ['gesturestart', 'gesturechange']) {
    assert.equal(app.handlers[name], undefined);
  }
});
test('short, horizontal, scrolled, interactive and multitouch gestures do not refresh', () => {
  for (const variant of ['short', 'horizontal', 'scrolled', 'nested', 'interactive', 'multitouch']) {
    const app = setup({ scrolled: variant === 'scrolled', interactive: variant === 'interactive', nestedScroll: variant === 'nested' });
    app.start();
    if (variant === 'short') app.move(10, 30);
    else if (variant === 'horizontal') app.move(150, 30);
    else if (variant === 'multitouch') app.move(10, 120, 2);
    else app.move(10, 120);
    app.handlers.touchend();
    assert.equal(app.timers.length, 0, variant);
  }
});
