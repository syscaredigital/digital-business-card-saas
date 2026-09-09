const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/public/assets/js/vcard-api-origin.js'), 'utf8');
for (const origin of ['https://cards.example.test', 'https://cards.example.test:8443', 'http://localhost:5123']) {
  test(`API uses same origin at ${origin}`, () => {
    const window = { location: new URL(origin) };
    vm.runInNewContext(source, { window, document: { querySelector: () => null } });
    assert.equal(window.SyncVCardApiOrigin, origin);
  });
}
test('separate frontend hosting can configure an explicit API origin', () => {
  const window = { location: new URL('https://cards.example.test'), SYNC_API_ORIGIN: 'https://api.example.test/' };
  vm.runInNewContext(source, { window, document: { querySelector: () => null } });
  assert.equal(window.SyncVCardApiOrigin, 'https://api.example.test');
});
for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
  for (const port of [5500, 5501]) {
    test(`Live Server on ${host}:${port} uses the backend`, () => {
      const window = { location: new URL(`http://${host}:${port}/frontend/pages/auth/login.html`) };
      vm.runInNewContext(source, { window, document: { querySelector: () => null } });
      assert.equal(window.SyncVCardApiOrigin, `http://${host}:5000`);
    });
  }
}
test('production hostname on port 5501 remains same-origin', () => {
  const window = { location: new URL('https://cards.example.test:5501') };
  vm.runInNewContext(source, { window, document: { querySelector: () => null } });
  assert.equal(window.SyncVCardApiOrigin, 'https://cards.example.test:5501');
});
test('explicit meta configuration overrides Live Server detection', () => {
  const window = { location: new URL('http://127.0.0.1:5501') };
  vm.runInNewContext(source, { window, document: { querySelector: () => ({ content: 'http://127.0.0.1:5123/' }) } });
  assert.equal(window.SyncVCardApiOrigin, 'http://127.0.0.1:5123');
});
