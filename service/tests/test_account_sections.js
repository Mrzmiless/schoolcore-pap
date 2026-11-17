const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'account-sections.js'), 'utf8');

function setup({ reduced = false, native = false } = {}) {
  const summary = { addEventListener(name, handler) { this[name] = handler; } };
  const animations = [];
  const section = {
    open: false, style: { overflow: '' },
    querySelector: () => summary,
    getBoundingClientRect() { return { height: this.open ? 200 : 50 }; },
    animate(frames, options) {
      const animation = { frames, options, cancel() { if (this.oncancel) this.oncancel(); } };
      animations.push(animation);
      return animation;
    }
  };
  const document = { documentElement: { dataset: {} }, querySelectorAll: () => [section] };
  const CSS = { supports: () => native };
  const window = { CSS, matchMedia: () => ({ matches: reduced }) };
  vm.runInNewContext(source, { document, window, CSS });
  function click() {
    let prevented = false;
    summary.click({ preventDefault() { prevented = true; } });
    return prevented;
  }
  return { section, summary, animations, document, click };
}

test('fallback animates opening and closing without delaying the details state', () => {
  const app = setup();
  assert.equal(app.click(), true);
  assert.equal(app.section.open, true);
  assert.equal(app.animations[0].frames[0].height, '50px');
  assert.equal(app.animations[0].frames[1].height, '200px');
  assert.equal(app.click(), true);
  assert.equal(app.section.open, false);
  assert.equal(app.animations[1].frames[0].height, '200px');
  assert.equal(app.animations[1].frames[1].height, '50px');
  app.animations[1].onfinish();
  assert.equal(app.section.style.overflow, '');
});

test('reduced motion and native support keep normal details behaviour', () => {
  const reduced = setup({ reduced: true });
  assert.equal(reduced.click(), false);
  assert.equal(reduced.animations.length, 0);
  const native = setup({ native: true });
  assert.equal(native.summary.click, undefined);
});
