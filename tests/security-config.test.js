const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEnvironment } = require('../backend/config/environment');
const { validateRegistration, validateLogin } = require('../backend/middlewares/auth-validation.middleware');
test('missing and weak signing secrets are rejected', () => {
  for (const JWT_SECRET of ['', 'devsecret', 'replace-with-at-least-32-random-characters']) assert.throws(() => validateEnvironment({ JWT_SECRET }));
});
test('production requires an HTTPS origin and database/mail configuration', () => {
  assert.throws(() => validateEnvironment({ NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(48) }));
  const env = { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(48), DB_HOST: 'db', DB_NAME: 'cards', DB_USER: 'cards', DB_PASSWORD: 'password', MAIL_HOST: 'smtp.provider.com', MAIL_FROM: 'info@syncecard.lk', PUBLIC_APP_URL: 'https://syncecard.lk' };
  assert.doesNotThrow(() => validateEnvironment(env));
  for (const PUBLIC_APP_URL of ['http://syncecard.lk', 'https://syncecard.lk/path', 'https://localhost']) assert.throws(() => validateEnvironment({ ...env, PUBLIC_APP_URL }));
});
test('malformed auth inputs fail before database access', () => {
  const res = { status(code) { assert.equal(code, 400); return this; }, json() {} };
  const next = () => assert.fail('Malformed input passed validation');
  validateLogin({ body: { email: {}, password: 'abc' } }, res, next);
  validateRegistration({ body: { email: 'invalid', password: 'abc' } }, res, next);
  validateRegistration({ body: { email: 'user@example.test', password: 'abc' } }, res, next);
});
