const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('../backend/node_modules/pg');
const pool = require('../backend/config/database.config');
const { migrate, seedFresh } = require('../database/migrate');
const { currentSubscription, expireSubscriptions } = require('../backend/services/subscription-policy');

test('fresh database, registration, role isolation, VCards and expiry', async t => {
  const schema = 'deployment_test_' + crypto.randomBytes(8).toString('hex');
  assert.match(schema, /^deployment_test_[a-f0-9]{16}$/);
  const query = pool.query.bind(pool), connect = pool.connect.bind(pool);
  const db = new Pool({ ...pool.options, password: pool.options.password, options: `-c search_path=${schema}`, max: 5 });
  let server;
  const oldSecret = process.env.JWT_SECRET;
  try {
    await query(`CREATE SCHEMA "${schema}"`);
    const client = await db.connect();
    try { await migrate(client); await seedFresh(client); await migrate(client); }
    finally { client.release(); }
    pool.query = db.query.bind(db); pool.connect = db.connect.bind(db);
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    const app = require('../backend/app');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function request(route, method = 'GET', body, token) {
      const response = await fetch(origin + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, body: await response.json() };
    }
    async function upload(route, fields, token) {
      const body = new FormData();
      for (const [key, value] of Object.entries(fields)) body.append(key, String(value));
      body.append('slip', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'test.png');
      const response = await fetch(origin + route, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      return { status: response.status, body: await response.json() };
    }
    let first, second, card;
    await t.test('registration rejects weak passwords and accepts valid users', async () => {
      assert.equal((await request('/api/auth/register', 'POST', { firstName: 'Test', lastName: 'One', email: 'one@example.test', password: 'short' })).status, 400);
      first = await request('/api/auth/register', 'POST', { firstName: 'Test', lastName: 'One', email: 'one@example.test', password: 'Strong password 123!' });
      assert.equal(first.status, 201, JSON.stringify(first.body));
      second = await request('/api/auth/register', 'POST', { firstName: 'Test', lastName: 'Two', email: 'two@example.test', password: 'Strong password 123!' });
      assert.equal(second.status, 201);
    });
    await t.test('user dashboard works; super-admin access is forbidden', async () => {
      assert.equal((await request('/api/user/dashboard', 'GET', null, first.body.token)).status, 200);
      assert.equal((await request('/api/super-admin/users', 'GET', null, first.body.token)).status, 403);
    });
    await t.test('create and edit card; other users cannot read or modify it', async () => {
      const created = await request('/api/user/vcards', 'POST', { title: 'Test Card', templateId: 1, slug: 'test-one-card', sections: {} }, first.body.token);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      card = created.body.vcard;
      assert.equal((await request(`/api/user/vcards/${card.id}`, 'GET', null, second.body.token)).status, 404);
      assert.equal((await request(`/api/user/vcards/${card.id}`, 'PATCH', { title: 'Forbidden', templateId: 1, sections: {} }, second.body.token)).status, 404);
      assert.equal((await request(`/api/user/vcards/${card.id}`, 'PATCH', { title: 'Updated Card', templateId: 1, sections: {} }, first.body.token)).status, 200);
      assert.equal((await request(`/api/public/vcards/${card.id}`)).status, 200);
    });
    await t.test('expired plans stop granting extra card slots before the job runs', async () => {
      await db.query("UPDATE subscriptions SET end_date=CURRENT_DATE-1 WHERE user_id=$1", [first.body.user.id]);
      const available = await db.query(`SELECT id FROM subscriptions s WHERE s.user_id=$1 AND ${currentSubscription()}`, [first.body.user.id]);
      assert.equal(available.rowCount, 0);
      assert.equal((await request('/api/user/vcards', 'POST', { title: 'Extra Card', templateId: 1 }, first.body.token)).status, 403);
      assert.equal(await expireSubscriptions(db), 1);
      assert.equal(await expireSubscriptions(db), 0);
      const billing = await request('/api/user/plans', 'GET', null, first.body.token);
      assert.equal(billing.status, 200);
      assert.equal(billing.body.current.price, 0);
    });
    let adminToken;
    await t.test('administrator login and dashboard work', async () => {
      const password = await require('../backend/node_modules/bcrypt').hash('Admin test password 123!', 4);
      await db.query("INSERT INTO users(role_id,name,email,password,status) SELECT id,'Test Admin','admin@example.test',$1,'active' FROM roles WHERE name='super_admin'", [password]);
      const login = await request('/api/auth/login', 'POST', { email: 'admin@example.test', password: 'Admin test password 123!' });
      assert.equal(login.status, 200);
      adminToken = login.body.token;
      assert.equal((await request('/api/super-admin/dashboard', 'GET', null, adminToken)).status, 200);
    });
    await t.test('manual payment stays pending until approval; duplicate references are rejected', async () => {
      for (const key of ['bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch']) await db.query("INSERT INTO settings(key,value) VALUES($1,'Test bank detail') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [key]);
      const plan = (await db.query("INSERT INTO plans(name,price,billing_interval,vcard_limit,status) VALUES('Test Paid',1000,'monthly',5,'active') RETURNING id")).rows[0];
      const submitted = await upload('/api/user/subscriptions/manual-payment', { planId: plan.id, transactionNumber: 'TEST-PAYMENT-001' }, first.body.token);
      assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
      assert.equal(submitted.body.subscription.status, 'pending');
      assert.equal((await upload('/api/user/subscriptions/manual-payment', { planId: plan.id, transactionNumber: 'TEST-PAYMENT-001' }, second.body.token)).status, 409);
      const approved = await request(`/api/super-admin/cash-payments/${submitted.body.payment.id}`, 'PATCH', {
        userId: first.body.user.id, subscriptionId: submitted.body.subscription.id, amount: 1000, currency: 'LKR', status: 'approved', reference: 'TEST-PAYMENT-001',
        proofUrl: (await db.query('SELECT proof_url FROM payments WHERE id=$1', [submitted.body.payment.id])).rows[0].proof_url,
      }, adminToken);
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal((await request('/api/user/plans', 'GET', null, first.body.token)).body.current.planId, plan.id);
      assert.equal((await db.query('SELECT status FROM transactions WHERE payment_id=$1', [submitted.body.payment.id])).rows[0].status, 'completed');
    });
    await t.test('NFC order payment approval and tracking gate fulfilment', async () => {
      const product = (await db.query("INSERT INTO nfc_products(name,price,is_active,front_image,back_image) VALUES('Test NFC',500,TRUE,'https://example.test/front.png','https://example.test/back.png') RETURNING id")).rows[0];
      await db.query("INSERT INTO settings(key,value) VALUES('domestic_nfc_shipping_lkr','100') ON CONFLICT(key) DO UPDATE SET value='100'");
      const order = await upload('/api/user/nfc/orders', { productId: product.id, vcardId: card.id, quantity: 2, transactionNumber: 'TEST-NFC-001', shippingAddress: '123 Test Street, Colombo', destinationCountry: 'LK' }, first.body.token);
      assert.equal(order.status, 201, JSON.stringify(order.body));
      assert.equal(Number(order.body.order.amount), 1100);
      const route = `/api/super-admin/nfc/orders/${order.body.order.id}`;
      assert.equal((await request(route, 'PATCH', { status: 'shipped', trackingNumber: 'TEST123' }, adminToken)).status, 409);
      assert.equal((await request(route, 'PATCH', { paymentStatus: 'approved' }, adminToken)).status, 200);
      assert.equal((await request(route, 'PATCH', { status: 'shipped', trackingNumber: 'TEST123' }, adminToken)).status, 200);
      assert.equal((await request(route, 'PATCH', { status: 'completed' }, adminToken)).status, 200);
    });
    await t.test('mixed-currency revenue uses fixed LKR conversions and includes NFC without double counting', async () => {
      const { captureRevenueRate } = require('../backend/services/revenue.service');
      const usd = (await db.query("INSERT INTO payments(user_id,amount,currency,method,status,paid_at) VALUES($1,10,'USD','cash','approved',NOW()) RETURNING id", [first.body.user.id])).rows[0];
      await captureRevenueRate(db, 'payment', usd.id, { rate: 1 / 300, rateDate: '2026-09-10' });
      // A duplicate transaction ledger entry must not duplicate a receipt.
      await db.query("INSERT INTO transactions(payment_id,user_id,transaction_type,amount,currency,status) VALUES($1,$2,'cash_payment',10,'USD','completed')", [usd.id, first.body.user.id]);
      const eur = (await db.query("INSERT INTO payments(user_id,amount,currency,method,status,paid_at) VALUES($1,20,'EUR','cash','approved',NOW()) RETURNING id", [first.body.user.id])).rows[0];
      await captureRevenueRate(db, 'payment', eur.id, { rate: 0.003, rateDate: '2026-09-10' });
      // Re-reading a sale with a different live quote must not change history.
      await captureRevenueRate(db, 'payment', usd.id, { rate: 1 / 400, rateDate: '2026-09-11' });
      const dashboard = await request('/api/super-admin/dashboard', 'GET', null, adminToken);
      assert.equal(dashboard.status, 200, JSON.stringify(dashboard.body));
      assert.equal(dashboard.body.revenueCurrency, 'LKR');
      assert.equal(dashboard.body.metrics.monthlyRevenue, 11766.67); // 1000 + NFC 1100 + USD 3000 + EUR 6666.67
      const csvResponse = await fetch(origin + '/api/super-admin/revenue/export', { headers: { Authorization: `Bearer ${adminToken}` } });
      const csv = await csvResponse.text();
      assert.equal(csvResponse.status, 200);
      assert.ok(csv.includes('amount_lkr'));
      assert.ok(csv.includes('3000.00'));
      assert.ok(csv.includes('6666.67'));
      assert.equal((await request('/api/super-admin/revenue/export', 'GET', null, first.body.token)).status, 403);
      await db.query("INSERT INTO payments(user_id,amount,currency,method,status,paid_at) VALUES($1,15,'GBP','cash','approved',NOW())", [first.body.user.id]);
      const incomplete = await request('/api/super-admin/dashboard', 'GET', null, adminToken);
      assert.equal(incomplete.body.metrics.monthlyRevenue, null);
      assert.equal(incomplete.body.revenueConversion.missing, 1);
      await db.query("DELETE FROM payments WHERE currency='GBP'");
    });
    if (process.argv.includes('--browser')) await t.test('real browser login and user/admin dashboard navigation', async () => {
      const browser = await require('../backend/node_modules/playwright').chromium.launch({ channel: 'msedge', headless: true });
      const folder = path.resolve(__dirname, '../test-results');
      await fs.mkdir(folder, { recursive: true });
      try {
        for (const account of [{ email: 'one@example.test', password: 'Strong password 123!', role: 'user' }, { email: 'admin@example.test', password: 'Admin test password 123!', role: 'super-admin' }]) {
          const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('dialog', dialog => { errors.push(dialog.message()); dialog.dismiss(); });
          await page.goto(origin + '/pages/auth/login.html');
          await page.fill('#loginEmail', account.email);
          await page.fill('#passwordInput', account.password);
          await page.click('#loginForm button[type="submit"]');
          await page.waitForURL(`**/pages/${account.role}/dashboard.html`, { timeout: 15000 });
          await page.waitForLoadState('networkidle');
          assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('user')).email), account.email);
          if (account.role === 'super-admin') {
            assert.match(await page.locator('[data-dashboard-metric="revenue"] > strong').innerText(), /LKR.*11,766\.67/);
            const downloadPromise = page.waitForEvent('download');
            await page.click('#downloadRevenueLkr');
            const download = await downloadPromise;
            await download.saveAs(path.join(folder, 'browser-revenue-lkr.csv'));
          }
          await page.screenshot({ path: path.join(folder, account.role + '-dashboard-390.png') });
          assert.deepEqual(errors, []);
          await context.close();
        }
      } finally { await browser.close(); }
    });
    await t.test('logout invalidates the registration token', async () => {
      assert.equal((await request('/api/auth/logout', 'POST', {}, first.body.token)).status, 200);
      assert.equal((await request('/api/user/dashboard', 'GET', null, first.body.token)).status, 401);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = query; pool.connect = connect;
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
    try {
      const proofs = await db.query('SELECT proof_url FROM payments UNION SELECT proof_url FROM nfc_orders');
      for (const row of proofs.rows) {
        if (!row.proof_url) continue;
        assert.match(row.proof_url, /^\/uploads\/payment-slips\/[a-zA-Z0-9.-]+$/);
        await fs.unlink(path.join(__dirname, '../backend', row.proof_url)).catch(() => {});
      }
    } catch (error) { if (error.code !== '42P01') throw error; }
    await db.end();
    await query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  }
});
