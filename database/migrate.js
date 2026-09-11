const fs = require('fs');
const path = require('path');
async function migrate(client) {
  await client.query('SELECT pg_advisory_lock(724651)');
  try {
    const state = await client.query("SELECT to_regclass('schema_migrations') AS ledger,to_regclass('users') AS users");
    if (!state.rows[0].ledger && state.rows[0].users) throw new Error('Existing database has no migration ledger. Do not replay historical migrations. Import your verified backup or apply a reviewed single migration.');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(row => row.name));
    for (const name of fs.readdirSync(path.join(__dirname, 'migrations')).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      if (applied.has(name)) continue;
      const sql = fs.readFileSync(path.join(__dirname, 'migrations', name), 'utf8').replace(/^\uFEFF/, '').replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw new Error(`${name}: ${error.message}`); }
    }
  } finally { await client.query('SELECT pg_advisory_unlock(724651)'); }
}
async function seedFresh(client) {
  for (const name of ['roles', 'permissions']) {
    await client.query(fs.readFileSync(path.join(__dirname, 'seeders', `${name}.seed.sql`), 'utf8').replace(/^\uFEFF/, ''));
  }
  await client.query(`INSERT INTO role_permissions(role_id,permission_id)
    SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.name='super_admin'
    ON CONFLICT DO NOTHING`);
  await client.query(`INSERT INTO plans(name,price,billing_interval,vcard_limit,nfc_limit,analytics_limit,features,status,storage_limit_mb)
    SELECT 'Free',0,'monthly',1,0,0,'{"vcardFeatures":["basic-details"],"templateIds":[1,2,3,4,5,6,7,8,9,10]}'::jsonb,'active',50
    WHERE NOT EXISTS(SELECT 1 FROM plans WHERE price=0 AND status='active')`);
}
if (require.main === module) {
  const pool = require('../backend/config/database.config');
  (async () => {
    const client = await pool.connect();
    try { await migrate(client); if (process.argv.includes('--seed')) await seedFresh(client); console.log('Database schema ready'); }
    finally { client.release(); await pool.end(); }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { migrate, seedFresh };
