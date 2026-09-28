const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// Normalize checkout line endings only; SQL content is otherwise immutable.
const checksum = source => crypto.createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
async function verifyMigrations(client) {
  const applied = new Map((await client.query('SELECT name,checksum FROM schema_migrations')).rows.map(row => [row.name,row.checksum]));
  const names = fs.readdirSync(path.join(__dirname,'migrations')).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  for (const name of names) {
    if (!applied.has(name)) throw new Error('Pending migration: '+name);
    if (!applied.get(name)) throw new Error('Historical checksum review required: '+name);
    if (applied.get(name)!==checksum(fs.readFileSync(path.join(__dirname,'migrations',name),'utf8'))) throw new Error('Migration checksum mismatch: '+name);
  }
  for (const name of applied.keys()) if (!names.includes(name)) throw new Error('Applied migration is missing: '+name);
}
async function migrate(client, { baseline = false, only, verifyOnly = false } = {}) {
  if (verifyOnly) return verifyMigrations(client);
  await client.query('SELECT pg_advisory_lock(724651)');
  try {
    const state = await client.query("SELECT to_regclass('schema_migrations') AS ledger,to_regclass('users') AS users");
    if (!state.rows[0].ledger && state.rows[0].users) throw new Error('Existing database has no migration ledger. Do not replay historical migrations. Import your verified backup or apply a reviewed single migration.');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');
    const applied = new Map((await client.query('SELECT name,checksum FROM schema_migrations')).rows.map(row => [row.name, row.checksum]));
    const names = fs.readdirSync(path.join(__dirname, 'migrations')).filter(name => /^\d+.*\.sql$/.test(name)).sort();
    if (only && !names.includes(only)) throw new Error('Unknown migration: ' + only);
    for (const [name, recorded] of applied) {
      if (!names.includes(name)) throw new Error('Applied migration is missing: ' + name);
      const expected = checksum(fs.readFileSync(path.join(__dirname, 'migrations', name), 'utf8'));
      if (recorded && recorded !== expected) throw new Error('Migration checksum mismatch: ' + name);
      if (!recorded && !baseline) throw new Error('Review historical migrations against the deployed release, then run --baseline-checksums: ' + name);
    }
    if (baseline) {
      await client.query('BEGIN');
      try {
        for (const [name, recorded] of applied) if (!recorded) {
          await client.query('UPDATE schema_migrations SET checksum=$2 WHERE name=$1 AND checksum IS NULL', [name, checksum(fs.readFileSync(path.join(__dirname, 'migrations', name), 'utf8'))]);
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      return; // Baseline review never also applies pending migrations.
    }
    const pending = names.filter(name => !applied.has(name));
    if (only && pending.length && pending[0] !== only && !applied.has(only)) throw new Error('Apply earlier pending migrations first: ' + pending[0]);
    for (const name of names) {
      if (applied.has(name) || (only && name !== only)) continue;
      const source = fs.readFileSync(path.join(__dirname, 'migrations', name), 'utf8');
      const sql = source.replace(/^\uFEFF/, '').replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum(source)]);
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
    SELECT 'Free',0,'monthly',1,0,0,jsonb_build_object('vcardFeatures',jsonb_build_array('basic-details'),'templateIds',(SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]'::jsonb) FROM vcard_templates WHERE is_public=TRUE)),'active',50
    WHERE NOT EXISTS(SELECT 1 FROM plans WHERE price=0 AND status='active')`);
}
async function runCli(args = process.argv.slice(2)) {
  const pool = require('../backend/config/database.config');
  let client;
  try {
    if (args.some(arg=>!['--baseline-checksums','--verify','--seed'].includes(arg))) throw new Error('Unknown migration option');
    if (args.includes('--baseline-checksums') && args.some(arg=>arg!=='--baseline-checksums')) throw new Error('Baseline review must run separately from verification/seeding');
    client = await pool.connect();
    await migrate(client, { baseline: args.includes('--baseline-checksums'), verifyOnly: args.includes('--verify') });
    if (args.includes('--seed')) await seedFresh(client);
    console.log('Migration operation completed');
  } catch(error) { console.error(error.message); process.exitCode = 1; }
  finally { if(client)client.release(); await pool.end(); }
}
if (require.main === module) runCli();
module.exports = { migrate, seedFresh, checksum, verifyMigrations, runCli };
