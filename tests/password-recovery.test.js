const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('../backend/node_modules/express');
const { Pool } = require('../backend/node_modules/pg');
const bcrypt = require('../backend/node_modules/bcrypt');
const jwt = require('../backend/node_modules/jsonwebtoken');
const pool = require('../backend/config/database.config');
const mail = require('../backend/services/email.service');

test('password recovery lifecycle against isolated PostgreSQL tables', async t => {
  const schema = `recovery_test_${crypto.randomBytes(8).toString('hex')}`;
  assert.match(schema, /^recovery_test_[a-f0-9]{16}$/);
  const originalQuery = pool.query.bind(pool);
  const originalConnect = pool.connect.bind(pool);
  const originalMail = mail.sendPasswordReset;
  const originalEnv = { PUBLIC_APP_URL: process.env.PUBLIC_APP_URL, MAIL_HOST: process.env.MAIL_HOST, JWT_SECRET: process.env.JWT_SECRET };
  const isolated = new Pool({ ...pool.options, password: pool.options.password, options: `-c search_path=${schema}`, max: 4, connectionTimeoutMillis: 5000 });
  let server;
  const emails = [];
  try {
    await originalQuery(`CREATE SCHEMA "${schema}"`);
    await isolated.query(`
      CREATE TABLE roles(id INTEGER PRIMARY KEY,name TEXT);
      CREATE TABLE companies(id INTEGER PRIMARY KEY,name TEXT);
      CREATE TABLE users(id INTEGER PRIMARY KEY,role_id INTEGER,company_id INTEGER,
        name TEXT,email TEXT,password TEXT,phone TEXT,status TEXT,preferred_currency TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW(),last_login TIMESTAMPTZ);
      INSERT INTO roles VALUES(1,'user');
    `);
    await isolated.query(fs.readFileSync(path.join(__dirname, '../database/migrations/033_create_auth_sessions_table.sql'), 'utf8'));
    await isolated.query(fs.readFileSync(path.join(__dirname, '../database/migrations/063_add_password_recovery.sql'), 'utf8'));
    await isolated.query("INSERT INTO users(id,role_id,name,email,password,status) VALUES(1,1,'Test User','recovery@example.test',$1,'active')", [await bcrypt.hash('Original password 123!', 4)]);
    pool.query = isolated.query.bind(isolated);
    pool.connect = isolated.connect.bind(isolated);
    process.env.PUBLIC_APP_URL = 'https://cards.example.test';
    process.env.MAIL_HOST = 'mock.example.test';
    process.env.JWT_SECRET = 'isolated-test-secret-not-used-for-production';
    mail.sendPasswordReset = async data => { emails.push(data); };
    const app = express();
    app.use(express.json());
    app.use('/api/auth', require('../backend/routes/auth.routes'));
    app.get('/protected', require('../backend/middlewares/auth.middleware'), (req, res) => res.json({ id: req.user.id }));
    app.use((error, req, res, next) => res.status(500).json({ message: error.message }));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const post = async (route, body) => {
      const response = await fetch(origin + '/api/auth/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const protectedStatus = async token => {
      const response = await fetch(origin + '/protected', { headers: { Authorization: `Bearer ${token}` } });
      await response.text();
      return response.status;
    };
    const emailToken = () => new URLSearchParams(new URL(emails.at(-1).resetUrl).hash.slice(1)).get('token');
    let oldToken, token;
    await t.test('login works before resetting', async () => {
      const login = await post('login', { email: 'recovery@example.test', password: 'Original password 123!' });
      assert.equal(login.status, 200);
      oldToken = login.body.token;
      assert.equal(await protectedStatus(oldToken), 200);
    });
    await t.test('known and unknown accounts get identical responses; links use configured origin and hashed storage', async () => {
      const known = await post('forgot-password', { email: 'recovery@example.test' });
      const unknown = await post('forgot-password', { email: 'unknown@example.test' });
      assert.equal(known.status, 200);
      assert.deepEqual(known, unknown);
      assert.equal(emails.length, 1);
      assert.equal(new URL(emails[0].resetUrl).origin, 'https://cards.example.test');
      token = emailToken();
      assert.match(token, /^[a-f0-9]{64}$/);
      const stored = (await isolated.query('SELECT * FROM password_reset_tokens')).rows[0];
      assert.equal(stored.token_hash, crypto.createHash('sha256').update(token).digest('hex'));
      assert.ok(stored.expires_at > new Date());
      assert.ok(stored.expires_at <= new Date(Date.now() + 30 * 60 * 1000));
    });
    await t.test('repeat recovery requests are throttled per account', async () => {
      assert.equal((await post('forgot-password', { email: 'recovery@example.test' })).status, 200);
      assert.equal(emails.length, 1);
    });
    await t.test('weak passwords do not consume the token', async () => {
      assert.equal((await post('reset-password', { token, password: 'short' })).status, 400);
      assert.equal((await isolated.query('SELECT COUNT(*)::int AS n FROM password_reset_tokens')).rows[0].n, 1);
    });
    await t.test('concurrent resets allow exactly one success', async () => {
      const responses = await Promise.all([
        post('reset-password', { token, password: 'Replacement password 123!' }),
        post('reset-password', { token, password: 'Replacement password 123!' }),
      ]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
      assert.equal((await isolated.query('SELECT COUNT(*)::int AS n FROM password_reset_tokens')).rows[0].n, 0);
    });
    await t.test('old password and old sessions fail; new login succeeds', async () => {
      assert.equal(await protectedStatus(oldToken), 401);
      // Also reject legacy signed tokens that never had an auth_sessions row.
      const legacy = jwt.sign({ id: 1, email: 'recovery@example.test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      assert.equal(await protectedStatus(legacy), 401);
      assert.equal((await post('login', { email: 'recovery@example.test', password: 'Original password 123!' })).status, 401);
      const login = await post('login', { email: 'recovery@example.test', password: 'Replacement password 123!' });
      assert.equal(login.status, 200);
      assert.equal(await protectedStatus(login.body.token), 200);
    });
    await t.test('used reset links are rejected', async () => {
      assert.equal((await post('reset-password', { token, password: 'Another password 123!' })).status, 400);
    });
    await t.test('expired reset links are rejected', async () => {
      assert.equal((await post('forgot-password', { email: 'recovery@example.test' })).status, 200);
      token = emailToken();
      await isolated.query("UPDATE password_reset_tokens SET expires_at=NOW()-INTERVAL '1 second'");
      assert.equal((await post('reset-password', { token, password: 'Another password 123!' })).status, 400);
    });
    await t.test('recovery rate limit blocks excessive requests', async () => {
      await post('forgot-password', { email: 'unknown@example.test' });
      assert.equal((await post('forgot-password', { email: 'unknown@example.test' })).status, 429);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
    pool.connect = originalConnect;
    mail.sendPasswordReset = originalMail;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await isolated.end();
    // The generated identifier is checked above and contains only test tables.
    await originalQuery(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  }
});
