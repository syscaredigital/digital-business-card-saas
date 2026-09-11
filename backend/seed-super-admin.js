const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('./config/database.config');
(async () => {
  const email = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || Buffer.byteLength(password) > 72) {
    throw new Error('Set SUPER_ADMIN_EMAIL and a unique SUPER_ADMIN_PASSWORD of 12 characters or more (maximum 72 bytes).');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, '../database/seeders/roles.seed.sql'), 'utf8').replace(/^\uFEFF/, ''));
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email)=$1', [email]);
    if (existing.rowCount) throw new Error('An account already exists for this email. No password or role was changed.');
    await client.query("INSERT INTO users(role_id,name,email,password,status,is_email_verified) SELECT id,'Super Admin',$1,$2,'active',TRUE FROM roles WHERE name='super_admin'", [email, await bcrypt.hash(password, 12)]);
    await client.query('COMMIT');
    console.log('Administrator created. Remove the bootstrap credentials from the environment.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
