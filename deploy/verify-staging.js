#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

// Run on the Docker host from the deployed project's root directory.
// Explicit commands only: never migrate, seed, start jobs or recreate containers.
function verifyStaging({ run = spawnSync, log = console.log } = {}) {
  const checks = [
    ['Container status', 'docker', ['compose', 'ps']],
    ['Migration ledger and checksums', 'docker', ['compose', 'exec', '-T', 'app', 'node', 'database/migrate.js', '--verify']],
    ['Production preflight and SMTP authentication (no email sent)', 'docker', ['compose', 'exec', '-T', 'app', 'node', 'backend/preflight.js', '--smtp']],
    ['Notification scheduling configuration', 'docker', ['compose', 'exec', '-T', 'app', 'node', '-e',
      "const enabled = process.env.NOTIFICATION_JOBS === 'true'; console.log(enabled ? 'In-process notification scheduling enabled; delivery still needs verification' : 'In-process notification scheduling disabled; verify an external scheduler'); process.exitCode = enabled ? 0 : 1;"]],
    ...['health', 'ready'].map(endpoint => [
      `Public HTTPS /${endpoint}`, 'curl', ['--fail', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30', `https://test.syncecard.com/${endpoint}`]
    ])
  ];
  let failed = false;
  log(`Staging verification UTC: ${new Date().toISOString()}`);
  for (const [label, command, args] of checks) {
    log(`\nCHECK ${label}`);
    const result = run(command, args, { stdio: 'inherit', shell: false, timeout: 120000 });
    const passed = !result.error && result.status === 0;
    log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
    if (result.error) log(`Command unavailable or timed out: ${result.error.code || 'unknown'}`);
    failed ||= !passed;
  }
  log('\nThis does not certify inbox delivery, credential rotation, restore recovery or business acceptance.');
  return failed ? 1 : 0;
}

if (require.main === module) process.exitCode = verifyStaging();
module.exports = { verifyStaging };
