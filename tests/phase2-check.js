// Run each suite in its own process: database tests replace the shared pool.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const pool = require('../backend/config/database.config');

(async () => {
  const local = ['localhost', '127.0.0.1', '::1'].includes(pool.options.host);
  await pool.end();
  if (!local || process.env.NODE_ENV === 'production') throw new Error('Phase 2 automation requires a local nonproduction PostgreSQL database');
  const suites = [
    ['security-config.test.js'], ['frontend-deployment.test.js'],
    ['password-recovery.test.js'], ['audit-remediation.test.js'],
    ['production-workflows.test.js', '--browser'], ['browser-check.js']
  ];
  let failed = false;
  const results = [];
  for (const [file, ...args] of suites) {
    console.log(`\nPhase 2: ${file}`);
    const result = spawnSync(process.execPath, [path.join(__dirname, file), ...args], {
      cwd: path.resolve(__dirname, '..'), stdio: 'inherit', shell: false,
      env: { ...process.env, RUN_BROWSER_TESTS: 'true' }
    });
    if (result.error) console.error(result.error.message);
    const passed = !result.error && result.status === 0;
    results.push({ suite: file, passed, exitCode: result.status, signal: result.signal, error: result.error?.code });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${file}: exit=${result.status}, signal=${result.signal || 'none'}`);
    failed ||= !passed;
  }
  fs.mkdirSync(path.resolve(__dirname, '../test-results'), { recursive: true });
  fs.writeFileSync(path.resolve(__dirname, '../test-results/phase2-summary.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), environment: 'local nonproduction', results,
    stagingVerified: false
  }, null, 2) + '\n');
  console.log('\nLocal acceptance only. Staging inbox delivery, deployment persistence and operational checks require separate evidence.');
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
