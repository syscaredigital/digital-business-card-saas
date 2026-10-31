const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCustomSlug, publicVcardUrl, isValidVcardSlug } = require('../backend/helpers/vcard-url');

test('custom VCard names retain case and symbols, including pasted URLs', () => {
  const slug = 'SysCare-!IDuyIs_&W9T';
  for (const value of [slug, `https://syncecard.com/${slug}`, `https://syncecard.com/vcard/${encodeURIComponent(slug)}`]) {
    assert.equal(normalizeCustomSlug(value), slug);
  }
  assert.ok(isValidVcardSlug(slug));
  const url = new URL(publicVcardUrl({ protocol: 'https', get: () => 'syncecard.com' }, slug));
  assert.equal(decodeURIComponent(url.pathname.split('/').pop()), slug);
  assert.equal(url.pathname, '/' + encodeURIComponent(slug));
  assert.equal(url.search, '');
});

test('invalid custom names are rejected rather than silently changed', () => {
  for (const value of ['ab', 'a'.repeat(101), 'a b', 'a/b', 'a\\b', 'a?b', 'a#b', 'https://example.com/name?x=1', 'https://example.com/name#part']) {
    assert.throws(() => normalizeCustomSlug(value), { statusCode: 400 });
  }
  assert.equal(normalizeCustomSlug(''), null);
});
