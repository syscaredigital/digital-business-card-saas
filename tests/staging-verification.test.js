const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyStaging } = require('../deploy/verify-staging');

test('staging checks use the running app and verify migrations without applying them', () => {
  const calls = [];
  const status = verifyStaging({ log() {}, run(command, args, options) {
    calls.push([command, args]);
    assert.equal(options.shell, false);
    assert.ok(options.timeout > 0);
    return { status: 0 };
  } });
  assert.equal(status, 0);
  assert.deepEqual(calls[1], ['docker', ['compose', 'exec', '-T', 'app', 'node', 'database/migrate.js', '--verify']]);
  assert.equal(calls.length, 6);
  for (const [, args] of calls) {
    for (const forbidden of ['--seed', '--baseline-checksums', 'up', 'restart', 'run', 'down']) {
      assert.ok(!args.includes(forbidden));
    }
  }
});

test('failure or missing executable fails the overall check while collecting remaining evidence', () => {
  for (const failure of [{ status: 1 }, { status: null, error: { code: 'ENOENT' } }, { status: null, error: { code: 'ETIMEDOUT' } }]) {
    let count = 0;
    assert.equal(verifyStaging({ log() {}, run() { return ++count === 2 ? failure : { status: 0 }; } }), 1);
    assert.equal(count, 6);
  }
});
