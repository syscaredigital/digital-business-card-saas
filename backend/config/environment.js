const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
function validateEnvironment(env = process.env) {
  const errors = [];
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /^(devsecret|changeme|replace|your[-_])/i.test(env.JWT_SECRET)) errors.push('JWT_SECRET must be a unique random secret of at least 32 characters');
  if (env.NODE_ENV === 'production') {
    for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'PUBLIC_APP_URL', 'MAIL_HOST', 'MAIL_FROM']) if (!env[key]) errors.push(`${key} is required in production`);
    try {
      const url = new URL(env.PUBLIC_APP_URL);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || /localhost|127\.0\.0\.1|\.example$|\.test$/.test(url.hostname)) throw new Error();
    } catch (_) { errors.push('PUBLIC_APP_URL must be the real HTTPS origin without a path'); }
  }
  for (const key of ['DB_SSL', 'NOTIFICATION_JOBS']) {
    if (env[key] !== undefined && !['true', 'false'].includes(env[key])) errors.push(`${key} must be true or false`);
  }
  for (const [key, maximum] of [['PORT', 65535], ['DB_PORT', 65535], ['MAIL_PORT', 65535], ['DB_POOL_SIZE', 1000]]) {
    if (env[key] !== undefined && (!/^\d+$/.test(env[key]) || Number(env[key]) < 1 || Number(env[key]) > maximum)) {
      errors.push(`${key} must be an integer between 1 and ${maximum}`);
    }
  }
  if (env.APP_TIMEZONE) {
    try { new Intl.DateTimeFormat('en', { timeZone: env.APP_TIMEZONE }); }
    catch (_) { errors.push('APP_TIMEZONE must be a valid time zone'); }
  }
  if (errors.length) throw new Error(errors.join('; '));
}
function signingSecret() {
  validateEnvironment({ JWT_SECRET: process.env.JWT_SECRET });
  return process.env.JWT_SECRET;
}
module.exports = { validateEnvironment, signingSecret };
