// Discover regression suites automatically. Each test file gets an isolated
// process because database suites replace the shared pool with temporary schemas.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('../backend/config/environment');
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
  throw new Error('Regression tests require a local nonproduction database. Configure DB_HOST explicitly.');
}

const files = fs.readdirSync(__dirname)
  .filter(name => name.endsWith('.test.js') && fs.statSync(path.join(__dirname, name)).size > 0)
  .sort().map(name => path.join(__dirname, name));
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', ...files], {
  cwd: path.join(__dirname, '..'), stdio: 'inherit', env: process.env
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status === 0 ? 0 : 1;
