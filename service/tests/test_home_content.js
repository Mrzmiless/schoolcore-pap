const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'home-content.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup({ role = 'admin', hour = 10, failPosts = false, initialPosts = [] } = {}) {
  const elements = {};
  const calls = [];
  const events = {};
  const posts = [...initialPosts];
  class Element {
    constructor() {
      this.handlers = {};
      this.children = [];
      this.attributes = {};
      this.value = '';
      this.hidden = false;
      this.classes = new Set();
      this.classList = { add: value => this.classes.add(value) };
    }
    addEventListener(name, handler) { this.handlers[name] = handler; }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    focus() { this.focused = true; }
    reset() { get('post-title').value = ''; get('post-body').value = ''; }
  }
  const get = id => elements[id] ||= new Element();
  const document = { getElementById: get, createElement: () => new Element() };
  const window = {
    addEventListener: (name, fn) => { events[name] = fn; },
    setInterval() {},
    location: { replace() {} }
  };
  window.parent = window;
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [2024, 1, 29, hour])); }
  }
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/api/me')) return { ok: true, status: 200, json: async () => ({ username: 'alex', first_name: 'Ana', role }) };
    if (options.method === 'POST') {
      if (role !== 'admin') return { ok: false, status: 403 };
      const post = { ...JSON.parse(options.body), id: String(posts.length + 1), author: 'alex', created_at: '2024-02-29T10:00:00Z' };
      posts.unshift(post);
      return { ok: true, status: 201, json: async () => post };
    }
    if (failPosts) return { ok: false, status: 503 };
    const params = new URLSearchParams(url.split('?')[1]);
    const offset = Number(params.get('offset') || 0);
    const limit = Number(params.get('limit'));
    return { ok: true, status: 200, json: async () => ({ posts: posts.slice(offset, offset + limit), has_more: posts.length > offset + limit }) };
  };
  vm.runInNewContext(source, { document, window, fetch, Date: FixedDate, Intl, URLSearchParams });
  return { get, calls, events, posts, window };
}

test('greeting changes with local time and calendar handles leap years and navigation', async () => {
  for (const [hour, text] of [[8, 'Good morning, Ana!'], [14, 'Good afternoon, Ana!'], [21, 'Good evening, Ana!']]) {
    const app = setup({ hour });
    await flush();
    assert.equal(app.get('welcome').textContent, text);
    assert.match(app.get('calendar-month').textContent, /February 2024/);
    const days = app.get('calendar-days').children.filter(day => day.className === 'calendar-day');
    assert.equal(days.length, 29);
    assert.equal(days[28].attributes['aria-current'], 'date');
    app.get('calendar-next').handlers.click();
    assert.match(app.get('calendar-month').textContent, /March 2024/);
    app.get('calendar-prev').handlers.click();
    assert.match(app.get('calendar-month').textContent, /February 2024/);
  }
});

test('admin publishes plain-text posts, opens the list and returns home', async () => {
  const app = setup();
  await flush();
  assert.equal(app.get('post-create').hidden, false);
  assert.equal(app.get('latest-title').textContent, 'No posts yet.');
  app.get('open-posts').handlers.click();
  await flush();
  app.get('post-title').value = '<img src=x onerror=alert(1)>';
  app.get('post-body').value = 'A message';
  await app.get('post-form').handlers.submit({ preventDefault() {} });
  assert.equal(app.get('post-form-status').textContent, 'Post published.');
  assert.equal(app.get('latest-title').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(app.get('posts-list').children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(app.get('posts-list').children[0].children[0].innerHTML, undefined);
  assert.equal(app.get('post-title').value, '');
  app.get('back-home').handlers.click();
  assert.equal(app.get('dashboard').hidden, false);
  assert.equal(app.get('posts-view').hidden, true);
  assert.equal(app.get('open-posts').focused, true);
});

test('non-admin users cannot see the creation form and a rejected request is reported', async () => {
  const app = setup({ role: 'aluno' });
  await flush();
  assert.equal(app.get('post-create').hidden, true);
  app.get('post-title').value = 'Notice';
  app.get('post-body').value = 'Message';
  await app.get('post-form').handlers.submit({ preventDefault() {} });
  assert.equal(app.get('post-form-status').textContent, 'Only administrators can publish posts.');
  assert.equal(app.posts.length, 0);
});

test('post loading errors remain retryable without showing an empty success state', async () => {
  const app = setup({ failPosts: true });
  await flush();
  assert.match(app.get('latest-title').textContent, /Could not load/);
  app.get('open-posts').handlers.click();
  await flush();
  assert.match(app.get('posts-status').textContent, /Could not load/);
  assert.equal(app.get('posts-retry').hidden, false);
});

test('the list can load all pages of posts', async () => {
  const entries = Array.from({ length: 23 }, (_, i) => ({ id: String(i), title: `Post ${i}`, body: 'Message', author: 'alex', created_at: '2024-02-29T10:00:00Z' }));
  const app = setup({ initialPosts: entries });
  await flush();
  assert.equal(app.get('latest-title').textContent, 'Post 0');
  app.get('open-posts').handlers.click();
  await flush();
  assert.equal(app.get('posts-list').children.length, 20);
  assert.equal(app.get('posts-more').hidden, false);
  await app.get('posts-more').handlers.click();
  assert.equal(app.get('posts-list').children.length, 23);
  assert.equal(app.get('posts-more').hidden, true);
});

test('posts without an author still display their date and content', async () => {
  const entry = { id: '1', title: 'Older notice', body: 'Message', author: null, created_at: '2024-02-29T10:00:00Z' };
  const app = setup({ initialPosts: [entry] });
  await flush();
  assert.equal(app.get('latest-title').textContent, 'Older notice');
  assert.match(app.get('latest-meta').textContent, /2024/);
  app.get('open-posts').handlers.click();
  await flush();
  const card = app.get('posts-list').children[0];
  assert.equal(card.children[0].textContent, 'Older notice');
  assert.match(card.children[1].textContent, /2024/);
  assert.equal(card.children[2].textContent, 'Message');
});

test('language changes update the greeting and calendar without modifying post content', async () => {
  const entry = { id: '1', title: 'School notice', body: 'Hello', author: 'alex', created_at: '2024-02-29T10:00:00Z' };
  const app = setup({ initialPosts: [entry] });
  await flush();
  app.window.schoolcoreI18n = {
    getLanguage: () => 'pt-PT',
    t: (key, params) => key === 'Good morning, {name}!' ? `Bom dia, ${params.name}!` : key
  };
  app.events['schoolcore:language']();
  assert.equal(app.get('welcome').textContent, 'Bom dia, Ana!');
  assert.match(app.get('calendar-month').textContent, /fevereiro/);
  assert.equal(app.get('latest-title').textContent, 'School notice');
});
