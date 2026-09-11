const pool = require('../config/database.config');
const { expireSubscriptions } = require('../services/subscription-policy');
function startSubscriptionExpiry() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await expireSubscriptions(pool); }
    catch (error) { console.error('Subscription expiry failed:', error.code || error.name); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
module.exports = { startSubscriptionExpiry };
