const { validateEnvironment } = require('./config/environment');
const pool = require('./config/database.config');
let server;
let stopJobs = () => {};
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  stopJobs();
  const timeout = setTimeout(() => process.exit(1), 15000);
  timeout.unref();
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.end();
  clearTimeout(timeout);
  process.exitCode = code;
}
async function start() {
  validateEnvironment();
  await require('./services/storage-readiness.service').verifyUploadStorage();
  await require('../database/migrate').verifyMigrations(pool);
  await pool.query('SELECT auth_version FROM users LIMIT 0');
  await pool.query('SELECT token_hash FROM password_reset_tokens LIMIT 0');
  await pool.query('SELECT amount_lkr FROM revenue_lkr_entries LIMIT 0');
  const app = require('./app');
  server = app.listen(Number(process.env.PORT || 5000), () => {
    console.log('Server listening on port ' + (process.env.PORT || 5000));
    const stopExpiry = require('./jobs/subscription-expiry.job').startSubscriptionExpiry();
    const stopNotifications = process.env.NOTIFICATION_JOBS === 'true' ? require('./jobs/run-jobs').startNotificationJobs() : () => {};
    stopJobs = () => { stopExpiry(); stopNotifications(); };
  });
  server.on('error', error => { console.error('Server error:', error.code); shutdown(1); });
}
process.on('SIGTERM', () => shutdown());
process.on('SIGINT', () => shutdown());
start().catch(error => { console.error('Startup failed:', error.message); shutdown(1); });
