const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'pwa', 'sw.js'), 'utf8');
test('migration worker removes only SchoolCore caches and does not intercept requests', async () => {
  const handlers = {};
  const deleted = [];
  let claimed = false;
  let skipped = false;
  const self = { addEventListener: (name, fn) => { handlers[name] = fn; },
    skipWaiting: async () => { skipped = true; },
    clients: { claim: async () => { claimed = true; } } };
  const caches = { keys: async () => ['minha-pwa-v14', 'minha-pwa-v16', 'another-app'],
    delete: async key => { deleted.push(key); } };
  vm.runInNewContext(source, { self, caches, Promise });
  let promise;
  handlers.install({ waitUntil(value) { promise = value; } });
  await promise;
  handlers.activate({ waitUntil(value) { promise = value; } });
  await promise;
  assert.equal(skipped, true);
  assert.equal(claimed, true);
  assert.deepEqual(deleted, ['minha-pwa-v14', 'minha-pwa-v16']);
  assert.equal(handlers.fetch, undefined);
});
