const fs = require('node:fs/promises');
const path = require('node:path');

// Exercise actual create/write/remove permissions, including a mounted volume.
async function verifyUploadStorage(root = path.resolve(__dirname, '../uploads/payment-slips')) {
  await fs.mkdir(root, { recursive: true });
  const probe = await fs.mkdtemp(path.join(root, '.readiness-'));
  try {
    await fs.writeFile(path.join(probe, 'probe'), 'storage readiness', { flag: 'wx', mode: 0o600 });
  } finally {
    await fs.rm(probe, { recursive: true, force: true });
  }
}

module.exports = { verifyUploadStorage };
