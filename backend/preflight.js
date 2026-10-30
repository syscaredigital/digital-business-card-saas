const { validateEnvironment } = require('./config/environment');
const pool = require('./config/database.config');
(async () => {
  let failed = false;
  try { validateEnvironment({ ...process.env, NODE_ENV: 'production' }); console.log('PASS production environment'); }
  catch (error) { failed = true; console.error('FAIL production environment:', error.message); }
  try {
    await require('./services/storage-readiness.service').verifyUploadStorage();
    console.log('PASS receipt storage create/write/remove permissions');
  } catch (error) { failed = true; console.error('FAIL receipt storage:', error.code || error.name); }
  try {
    await require('../database/migrate').verifyMigrations(pool);
    console.log('PASS migration ledger and checksums');
  } catch (error) { failed = true; console.error('FAIL migrations:', error.message); }
  try {
    await pool.query('SELECT bucket_key FROM rate_limit_buckets LIMIT 0');
    await pool.query('SELECT status FROM email_outbox LIMIT 0');
    await pool.query('SELECT auth_version FROM users LIMIT 0');
    await pool.query('SELECT token_hash FROM password_reset_tokens LIMIT 0');
    await pool.query('SELECT amount_lkr FROM revenue_lkr_entries LIMIT 0');
    await pool.query('SELECT slug FROM vcard_url_history LIMIT 0');
    await pool.query('SELECT status FROM newsletter_deliveries LIMIT 0');
    await pool.query('SELECT employee_limit FROM companies LIMIT 0');
    const free = await pool.query("SELECT id FROM plans WHERE price=0 AND status='active' LIMIT 1");
    if (!free.rowCount) throw new Error('An active free plan is required for registration');
    console.log('PASS database and registration plan');
    const settings = await pool.query("SELECT key,value FROM settings WHERE key=ANY($1)", [['bank_name','bank_account_name','bank_account_number','bank_branch','domestic_nfc_shipping_lkr','international_nfc_shipping_lkr']]);
    const values = Object.fromEntries(settings.rows.map(row => [row.key, row.value]));
    if (!['bank_name','bank_account_name','bank_account_number','bank_branch'].every(key => values[key])) { failed = true; console.error('FAIL bank transfer configuration is incomplete'); }
    else console.log('PASS bank transfer configuration');
    if (!(Number(values.domestic_nfc_shipping_lkr) > 0)) { failed = true; console.error('FAIL domestic NFC shipping fee is not configured'); }
    else console.log('PASS domestic NFC shipping configuration');
    if (!(Number(values.international_nfc_shipping_lkr) > 0)) { failed = true; console.error('FAIL international NFC shipping fee is not configured'); }
    else console.log('PASS international NFC shipping configuration');
    const missingPrices = await pool.query(`SELECT p.id FROM plans p WHERE p.status='active' AND p.price>0
      AND EXISTS (SELECT 1 FROM (VALUES ('AUD'),('USD')) AS currencies(code)
        WHERE NOT EXISTS (SELECT 1 FROM package_regional_prices r WHERE r.plan_id=p.id AND r.currency=currencies.code AND r.amount>0))`);
    if (missingPrices.rowCount) { failed = true; console.error('FAIL regional package prices are missing; initialize or configure AUD/USD prices'); }
    else console.log('PASS regional package pricing');
  } catch (error) { failed = true; console.error('FAIL database:', error.code || error.message); }
  if (process.argv.includes('--smtp')) {
    try { await require('./services/email.service').verifyConnection(); console.log('PASS SMTP connection/authentication (no email sent)'); }
    catch (error) { failed = true; console.error('FAIL SMTP:', error.code || 'not configured or unavailable'); }
  } else console.log('NOT CHECKED SMTP connection; use --smtp');
  await pool.end();
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });
