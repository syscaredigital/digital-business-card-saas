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
