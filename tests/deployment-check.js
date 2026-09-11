// Read-only deployment smoke checks. Run: node tests/deployment-check.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`);
}
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git'].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
async function main() {
  let scripts = 0;
  for (const file of [...files(path.join(root, 'backend')), ...files(path.join(root, 'frontend'))]) {
    const relative = path.relative(root, file);
    if (file.endsWith('.js')) {
      try { new vm.Script(fs.readFileSync(file, 'utf8'), { filename: relative }); scripts++; }
      catch (error) { record(relative, false, error.message); }
    } else if (file.endsWith('.html')) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (/\bsrc\s*=|application\/ld\+json|application\/json|type\s*=\s*["']module/.test(match[1]) || !match[2].trim()) continue;
        try { new vm.Script(match[2], { filename: relative }); scripts++; }
        catch (error) { record(relative + ' inline script', false, error.message); }
      }
    }
  }
  record('JavaScript syntax scan', !results.some(result => !result.pass), `${scripts} scripts parsed`);
  const app = require('../backend/app');
  const pool = require('../backend/config/database.config');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await pool.query({ text: 'SELECT 1', query_timeout: 5000 });
    record('Database connection', true);
    const overdue = await pool.query("SELECT COUNT(*)::int AS count FROM subscriptions WHERE status='active' AND end_date < NOW()");
    record('No expired subscriptions marked active', overdue.rows[0].count === 0, `${overdue.rows[0].count} overdue active subscriptions`);
    const checks = [
      ['/health', 200], ['/ready', 200], ['/', 200], ['/pages/website/home.html', 200],
      ['/pages/auth/login.html', 200], ['/pages/user/dashboard.html', 200],
      ['/pages/super-admin/dashboard.html', 200], ['/pages/public-vcard/final-10-corporate.html', 200],
      ['/api/public/plans', 200], ['/api/public/currencies', 200],
      ['/api/public/nfc-products', 200], ['/api/public/vcard-templates', 200],
      ['/api/user/dashboard', 401], ['/api/super-admin/dashboard', 401],
      ['/api/super-admin/users', 401], ['/api/user/orders', 401],
      ['/api/public/vcards/invalid', 400], ['/.env', 404], ['/backend/.env', 404],
      ['/uploads/payment-slips/nonexistent.pdf', 404],
    ];
    for (const [route, expected] of checks) {
      try {
        const response = await fetch(origin + route, { signal: AbortSignal.timeout(10000) });
        record(`GET ${route}`, response.status === expected, `HTTP ${response.status}, expected ${expected}`);
        await response.arrayBuffer();
      } catch (error) { record(`GET ${route}`, false, error.name); }
    }
    for (const route of ['/api/auth/forgot-password', '/api/auth/reset-password']) {
      const response = await fetch(origin + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
      record(`Recovery route ${route} rejects empty input`, response.status === 400, `HTTP ${response.status}, expected 400`);
      await response.arrayBuffer();
    }
  } catch (error) { record('Database checks', false, error.code || error.name); }
  finally {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
  const failed = results.filter(result => !result.pass).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed. These are smoke checks, not end-to-end certification.`);
  process.exitCode = failed ? 1 : 0;
}
main().catch(error => { console.error(error.name); process.exitCode = 1; });
