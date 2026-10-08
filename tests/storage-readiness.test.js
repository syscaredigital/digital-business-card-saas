const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { verifyUploadStorage } = require('../backend/services/storage-readiness.service');

test('storage probe creates missing directories and leaves existing receipts untouched', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cards-storage-'));
  try {
    const receipts = path.join(root, 'payment-slips');
    await verifyUploadStorage(receipts);
    await fs.writeFile(path.join(receipts, 'existing.pdf'), 'existing receipt');
    await verifyUploadStorage(receipts);
    assert.deepEqual(await fs.readdir(receipts), ['existing.pdf']);
    assert.equal(await fs.readFile(path.join(receipts, 'existing.pdf'), 'utf8'), 'existing receipt');
    await assert.rejects(verifyUploadStorage(path.join(receipts, 'existing.pdf')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
