const pool = require('../config/database.config');
async function runOnce() {
  await require('./payment-reminder.job').queueReminders(pool);
  await require('./email-notification.job').deliverEmails(pool);
}
function startNotificationJobs() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runOnce(); }
    catch(error) { console.error('Notification jobs failed:', error.code || error.name); }
    finally { running = false; }
  };
  const timer = setInterval(tick,60000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
if (require.main === module) runOnce().catch(error => { console.error(error.code || error.name); process.exitCode=1; }).finally(() => pool.end());
module.exports = { runOnce, startNotificationJobs };
