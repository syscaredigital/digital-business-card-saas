const { validateEnvironment } = require('./config/environment');
const pool = require('./config/database.config');
(async () => {
  let failed = false;
  try { validateEnvironment({ ...process.env, NODE_ENV: 'production' }); console.log('PASS production environment'); }
  catch (error) { failed = true; console.error('FAIL production environment:', error.message); }
  try {
    await pool.query('SELECT auth_version FROM users LIMIT 0');
    await pool.query('SELECT token_hash FROM password_reset_tokens LIMIT 0');
    await pool.query('SELECT amount_lkr FROM revenue_lkr_entries LIMIT 0');
    const free = await pool.query("SELECT id FROM plans WHERE price=0 AND status='active' LIMIT 1");
    if (!free.rowCount) throw new Error('An active free plan is required for registration');
    console.log('PASS database and registration plan');
    const settings = await pool.query("SELECT key,value FROM settings WHERE key=ANY($1)", [['bank_name','bank_account_name','bank_account_number','bank_branch','domestic_nfc_shipping_lkr']]);
    const values = Object.fromEntries(settings.rows.map(row => [row.key, row.value]));
    if (!['bank_name','bank_account_name','bank_account_number','bank_branch'].every(key => values[key])) { failed = true; console.error('FAIL bank transfer configuration is incomplete'); }
    else console.log('PASS bank transfer configuration');
    if (!(Number(values.domestic_nfc_shipping_lkr) > 0)) { failed = true; console.error('FAIL domestic NFC shipping fee is not configured'); }
    else console.log('PASS domestic NFC shipping configuration');
  } catch (error) { failed = true; console.error('FAIL database:', error.code || error.message); }
  if (process.argv.includes('--smtp')) {
    try { await require('./services/email.service').verifyConnection(); console.log('PASS SMTP connection/authentication (no email sent)'); }
    catch (error) { failed = true; console.error('FAIL SMTP:', error.code || 'not configured or unavailable'); }
  } else console.log('NOT CHECKED SMTP connection; use --smtp');
  await pool.end();
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });
