#!/usr/bin/env node
'use strict';

// Run from the cPanel application root with its Node environment activated.
// Read-only: does not deploy, migrate, start the email worker or send email.
const { spawnSync } = require('node:child_process');
function verifyProduction() {
  const checks = [
    [process.execPath, ['backend/preflight.js', '--smtp']],
    ...['health', 'ready'].map(endpoint => ['curl', ['--fail', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30', `https://syncecard.com/${endpoint}`]])
  ];
  let failed = false;
  for (const [command, args] of checks) {
    const result = spawnSync(command, args, { stdio: 'inherit', shell: false, timeout: 120000, env: { ...process.env, NODE_ENV: 'production' } });
    if (result.error) console.error(result.error.code || result.error.name);
    failed ||= Boolean(result.error) || result.status !== 0;
  }
  console.log('Also verify the cPanel cron worker, inbox delivery and dashboard flows.');
  return failed ? 1 : 0;
}
if (require.main === module) {
  process.exitCode = verifyProduction();
}
module.exports = { verifyProduction };
