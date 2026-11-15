const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('shared loading script no longer installs the offline screen', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'loading.js'), 'utf8');
  assert.doesNotMatch(source, /showOffline|offline-screen|addEventListener\('offline'/);
  assert.match(source, /Could not connect to the server/);
});
