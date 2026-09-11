const pool = require('./config/database.config');
const { captureRevenueRate } = require('./services/revenue.service');
(async () => {
  const rows = await pool.query('SELECT source_type,source_id FROM revenue_lkr_entries WHERE amount_lkr IS NULL');
  let failed = 0;
  for (const row of rows.rows) {
    try { await captureRevenueRate(pool, row.source_type, row.source_id, undefined, true); }
    catch (error) { failed++; console.error('Conversion unavailable:', row.source_type, row.source_id, error.code || error.name); }
  }
  console.log(`Revenue conversions: ${rows.rowCount - failed} captured; ${failed} unresolved. Legacy rates without a checkout snapshot are labelled estimated_current.`);
  await pool.end(); process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error.code || error.name); pool.end(); process.exitCode = 1; });
