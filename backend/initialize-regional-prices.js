// Preview: node backend/initialize-regional-prices.js
// Save only missing prices: node backend/initialize-regional-prices.js --apply
require('./config/environment');
const pool = require('./config/database.config');
const { completeRegionalPrices } = require('./services/package-pricing.service');
async function initializeRegionalPrices(db, apply = false) {
  const plans = await db.query('SELECT id,name,price FROM plans ORDER BY id' + (apply ? ' FOR UPDATE' : ''));
  for (const plan of plans.rows) {
    const saved = await db.query('SELECT currency,amount FROM package_regional_prices WHERE plan_id=$1', [plan.id]);
    const existing = Object.fromEntries(saved.rows.map(row => [row.currency, Number(row.amount)]));
    const prices = await completeRegionalPrices({ LKR: Number(plan.price), ...existing });
    for (const currency of ['LKR', 'AUD', 'USD']) {
      if (existing[currency] !== undefined) continue;
      console.log(`${apply ? 'SAVE' : 'PREVIEW'} ${plan.id} ${plan.name}: ${currency} ${prices[currency].toFixed(2)}`);
      if (apply) await db.query('INSERT INTO package_regional_prices(plan_id,currency,amount) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [plan.id, currency, prices[currency]]);
    }
  }
}
if (require.main === module) (async () => {
  let client;
  try {
    if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Use --apply or no arguments for a preview');
    client = await pool.connect();
    await client.query('BEGIN');
    await initializeRegionalPrices(client, process.argv.includes('--apply'));
    await client.query('COMMIT');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error(error.publicMessage || error.message); process.exitCode = 1;
  } finally { if (client) client.release(); await pool.end(); }
})();
module.exports = { initializeRegionalPrices };
