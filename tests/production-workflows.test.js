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
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(pool.options.host), 'Use a local test database');
  assert.notEqual(process.env.NODE_ENV, 'production');
  const schema = 'deployment_test_' + crypto.randomBytes(8).toString('hex');
  assert.match(schema, /^deployment_test_[a-f0-9]{16}$/);
  const query = pool.query.bind(pool), connect = pool.connect.bind(pool);
  const db = new Pool({ ...pool.options, password: pool.options.password, options: `-c search_path=${schema}`, max: 5 });
  let server;
  const oldSecret = process.env.JWT_SECRET;
  const oldOrigin = process.env.PUBLIC_APP_URL;
  const mail = require('../backend/services/email.service');
  const originalAppointmentMail = mail.sendAppointmentApproved;
  const appointmentEmails = [];
  mail.sendAppointmentApproved = async message => { appointmentEmails.push(message); };
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
    process.env.PUBLIC_APP_URL = origin;
    async function request(route, method = 'GET', body, token) {
      const response = await fetch(origin + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, body: await response.json() };
    }
    async function upload(route, fields, token, fieldName = 'slip') {
      const body = new FormData();
      for (const [key, value] of Object.entries(fields)) body.append(key, String(value));
      body.append(fieldName, new Blob([await require('../backend/node_modules/sharp')({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer()], { type: 'image/png' }), 'test.png');
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
    await t.test('QR, consent-gated contact downloads and analytics use the published card', async () => {
      const qr = await fetch(`${origin}/api/public/vcards/${card.id}/qrcode`);
      assert.equal(qr.status, 200);
      assert.match(qr.headers.get('content-type'), /image/);
      await qr.arrayBuffer();
      assert.equal((await fetch(`${origin}/api/public/vcards/${card.id}/contact.vcf`)).status, 403);
      const details = { name: 'Contact visitor', email: 'visitor@example.test', consent: true };
      assert.equal((await request(`/api/public/vcards/${card.id}/contact-saves`, 'POST', { ...details, consent: false })).status, 400);
      const captured = await request(`/api/public/vcards/${card.id}/contact-saves`, 'POST', details);
      assert.equal(captured.status, 201);
      const contact = await fetch(origin + captured.body.downloadUrl);
      assert.equal(contact.status, 200);
      const contactText = await contact.text();
      assert.match(contactText, /BEGIN:VCARD[\s\S]*FN:Updated Card[\s\S]*N:Updated Card;;;;[\s\S]*END:VCARD/);
      assert.doesNotMatch(contactText, /Test One/);
      assert.match(contact.headers.get('content-disposition'), /Updated-Card\.vcf/);
      const event = `/api/public/vcards/${card.id}/events`;
      assert.equal((await request(event, 'POST', { eventType: 'qr_scan' })).body.recorded, true);
      assert.equal((await request(event, 'POST', { eventType: 'qr_scan' })).body.recorded, false);
      assert.equal((await db.query("SELECT id FROM vcard_events WHERE vcard_id=$1 AND event_type='qr_scan'", [card.id])).rowCount, 1);
    });
    await t.test('appointment decisions enforce ownership, retry safely and release rejected slots', async () => {
      await db.query(`UPDATE subscriptions SET status='active',start_date=CURRENT_DATE,end_date=CURRENT_DATE+30 WHERE user_id=$1`, [first.body.user.id]);
      await db.query(`UPDATE plans SET features=jsonb_set(features,'{vcardFeatures}',COALESCE(features->'vcardFeatures','[]'::jsonb)||'"appointments"'::jsonb) WHERE id IN (SELECT plan_id FROM subscriptions WHERE user_id=$1)`, [first.body.user.id]);
      await db.query(`UPDATE vcards SET settings=jsonb_set(settings,'{sections}','{"appointments":"Consultation | 30"}'::jsonb) WHERE id=$1`, [card.id]);
      const body = { name: 'Visitor', email: 'booking@example.test', serviceName: 'Consultation', startsAt: new Date(Date.now() + 86400000).toISOString(), appointmentType: 'online', durationMinutes: 30 };
      const route = `/api/public/vcards/${card.id}/appointments`;
      const booked = await request(route, 'POST', body);
      assert.equal(booked.status, 201);
      const review = `/api/user/appointments/${booked.body.appointment.id}/status`;
      assert.equal((await request(review, 'PATCH', { status: 'approved' }, second.body.token)).status, 404);
      for (let i = 0; i < 2; i++) assert.equal((await request(review, 'PATCH', { status: 'approved' }, first.body.token)).status, 200);
      assert.equal(appointmentEmails.length, 1);
      assert.equal(appointmentEmails[0].to, body.email);
      assert.equal((await request(review, 'PATCH', { status: 'rejected' }, first.body.token)).status, 409);
      assert.equal((await request(route, 'POST', body)).status, 409);
      const later = { ...body, startsAt: new Date(Date.now() + 172800000).toISOString() };
      const rejected = await request(route, 'POST', later);
      assert.equal(rejected.status, 201);
      assert.equal((await request(`/api/user/appointments/${rejected.body.appointment.id}/status`, 'PATCH', { status: 'rejected' }, first.body.token)).status, 200);
      assert.equal((await request(route, 'POST', later)).status, 201);
    });
    let adminToken;
    await t.test('administrator login and dashboard work', async () => {
      const password = await require('../backend/node_modules/bcrypt').hash('Admin test password 123!', 4);
      await db.query("INSERT INTO users(role_id,name,email,password,status) SELECT id,'Test Admin','admin@example.test',$1,'active' FROM roles WHERE name='super_admin'", [password]);
      const login = await request('/api/auth/login', 'POST', { email: 'admin@example.test', password: 'Admin test password 123!' });
      assert.equal(login.status, 200);
      adminToken = login.body.token;
      assert.equal((await request('/api/super-admin/dashboard', 'GET', null, adminToken)).status, 200);
      const routes = require('../backend/routes/super-admin.routes').stack
        .filter(layer => layer.route?.methods.get && !layer.route.path.includes(':'))
        .map(layer => '/api/super-admin' + layer.route.path);
      for (const route of routes) {
        const response = await fetch(origin + route, { headers: { Authorization: 'Bearer ' + adminToken } });
        assert.equal(response.status, 200, route + ': ' + await response.text());
        assert.equal((await request(route, 'GET', null, first.body.token)).status, 403, route + ' must require admin');
      }
    });
    await t.test('manual payment stays pending until approval; duplicate references are rejected', async () => {
      const affiliate = (await db.query("INSERT INTO affiliate_profiles(user_id,referral_code,status,commission_type,commission_value,payout_details) VALUES($1,'PHASE2','active','percentage',10,$2::jsonb) RETURNING id", [second.body.user.id, JSON.stringify({ accountHolder: 'Test', bankName: 'Test', accountNumber: '123' })])).rows[0];
      await db.query("INSERT INTO affiliate_referrals(affiliate_id,referred_user_id,status) VALUES($1,$2,'pending')", [affiliate.id, first.body.user.id]);
      for (const key of ['bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch']) await db.query("INSERT INTO settings(key,value) VALUES($1,'Test bank detail') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [key]);
      const plan = (await db.query("INSERT INTO plans(name,price,billing_interval,vcard_limit,status) VALUES('Test Paid',1000,'monthly',5,'active') RETURNING id")).rows[0];
      const submitted = await upload('/api/user/subscriptions/manual-payment', { planId: plan.id, transactionNumber: 'TEST-PAYMENT-001' }, first.body.token);
      assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
      assert.equal(submitted.body.subscription.status, 'pending');
      assert.equal((await upload('/api/user/subscriptions/manual-payment', { planId: plan.id, transactionNumber: 'TEST-PAYMENT-001' }, second.body.token)).status, 409);
      const approval = {
        userId: first.body.user.id, subscriptionId: submitted.body.subscription.id, amount: 1000, currency: 'LKR', status: 'approved', reference: 'TEST-PAYMENT-001',
        proofUrl: (await db.query('SELECT proof_url FROM payments WHERE id=$1', [submitted.body.payment.id])).rows[0].proof_url,
      };
      const approvals = await Promise.all([1,2].map(() => request(`/api/super-admin/cash-payments/${submitted.body.payment.id}`, 'PATCH', approval, adminToken)));
      for (const approved of approvals) assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal((await db.query('SELECT id FROM transactions WHERE payment_id=$1', [submitted.body.payment.id])).rowCount, 1);
      assert.equal((await db.query("SELECT id FROM notifications WHERE user_id=$1 AND title='Subscription activated'", [first.body.user.id])).rowCount, 1);
      assert.equal((await request(`/api/super-admin/cash-payments/${submitted.body.payment.id}`, 'PATCH', {...approval,amount:1001},adminToken)).status,409);
      assert.equal((await request(`/api/super-admin/cash-payments/${submitted.body.payment.id}`, 'DELETE',null,adminToken)).status,409);
      assert.equal((await request('/api/user/plans', 'GET', null, first.body.token)).body.current.planId, plan.id);
      assert.equal((await db.query('SELECT status FROM transactions WHERE payment_id=$1', [submitted.body.payment.id])).rows[0].status, 'completed');
      const commissions = await db.query('SELECT amount,status FROM affiliate_commissions WHERE payment_id=$1', [submitted.body.payment.id]);
      assert.equal(commissions.rowCount, 1);
      assert.equal(Number(commissions.rows[0].amount), 100);
      assert.equal(commissions.rows[0].status, 'pending');
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
      const reviewedAt = (await db.query('SELECT payment_reviewed_at FROM nfc_orders WHERE id=$1',[order.body.order.id])).rows[0].payment_reviewed_at;
      assert.equal((await request(route, 'PATCH', { paymentStatus: 'approved' }, adminToken)).status, 200);
      assert.deepEqual((await db.query('SELECT payment_reviewed_at FROM nfc_orders WHERE id=$1',[order.body.order.id])).rows[0].payment_reviewed_at,reviewedAt);
      assert.equal((await request(route, 'PATCH', { paymentStatus: 'pending' }, adminToken)).status, 409);
      assert.equal((await request(route, 'PATCH', { status: 'shipped', trackingNumber: 'TEST123' }, adminToken)).status, 200);
      assert.equal((await request(route, 'PATCH', { status: 'pending' }, adminToken)).status, 409);
      assert.equal((await request(route, 'PATCH', { status: 'completed' }, adminToken)).status, 200);
      assert.equal((await request(route, 'PATCH', { status: 'processing' }, adminToken)).status, 409);
      const rejectedOrder = await upload('/api/user/nfc/orders', { productId: product.id, vcardId: card.id, quantity: 1, transactionNumber: 'TEST-NFC-REJECT', shippingAddress: '123 Test Street, Colombo', destinationCountry: 'LK' }, first.body.token);
      assert.equal(rejectedOrder.status, 201);
      const rejectedRoute = `/api/super-admin/nfc/orders/${rejectedOrder.body.order.id}`;
      assert.equal((await request(rejectedRoute, 'PATCH', { paymentStatus: 'rejected' }, adminToken)).status, 200);
      const cancelled = (await db.query('SELECT status,payment_status FROM nfc_orders WHERE id=$1', [rejectedOrder.body.order.id])).rows[0];
      assert.deepEqual(cancelled, { status: 'cancelled', payment_status: 'rejected' });
      assert.equal((await request(rejectedRoute, 'PATCH', { paymentStatus: 'approved' }, adminToken)).status, 409);
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
          await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
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
    if (process.argv.includes('--browser')) await t.test('all 20 selected templates publish real custom card data on desktop and mobile', async () => {
      const { chromium } = require('../backend/node_modules/playwright');
      const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
      try {
        const templates = (await db.query('SELECT id,preview_url FROM vcard_templates WHERE is_public=TRUE ORDER BY id')).rows;
        assert.equal(templates.length, 20);
        const problems = [];
        const context = await browser.newContext();
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        const page = await context.newPage();
        page.on('pageerror', error => problems.push(error.message));
        page.on('response', response => { if (response.url().startsWith(origin + '/') && response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
        page.on('console', message => { if (/Content Security Policy|Refused to/.test(message.text())) problems.push(message.text()); });
        for (const template of templates) {
          const title = `Acceptance Person ${template.id}`;
          const update = await request(`/api/user/vcards/${card.id}`, 'PATCH', { title, templateId: template.id, email: 'card@example.test', phone: '+94112345678', sections: { 'basic-details': 'Acceptance consultant' } }, first.body.token);
          assert.equal(update.status, 200, JSON.stringify(update.body));
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`${origin}/vcard/test-one-card`, { waitUntil: 'domcontentloaded' });
            assert.equal(new URL(page.url()).pathname, '/vcard/test-one-card');
            assert.equal(new URL(await page.locator('base').getAttribute('href'), origin).pathname, '/pages/' + template.preview_url.replace(/^\.\.\//, ''));
            await page.getByText(title, { exact: true }).first().waitFor({ timeout: 15000 });
            await page.waitForFunction(() => Array.from(document.images).every(image => image.complete), { }, { timeout: 15000 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `Template ${template.id}, ${width}px overflow`);
          }
        }
        assert.deepEqual(problems, []);
        await context.close();
      } finally { await browser.close(); }
    });
    await t.test('coupon totals are server-calculated and rejected payments release redemption reservations', async () => {
      const plan = (await db.query("INSERT INTO plans(name,price,billing_interval,vcard_limit,status) VALUES('Coupon test',2000,'monthly',5,'active') RETURNING id")).rows[0];
      await db.query("INSERT INTO coupon_codes(code,name,discount_type,discount_value,currency,usage_limit) VALUES('PHASE2','Test coupon','percentage',25,'LKR',1)");
      const preview = await request('/api/user/coupons/preview', 'POST', { planId: plan.id, code: 'PHASE2' }, first.body.token);
      assert.equal(preview.status, 200);
      assert.equal(preview.body.finalAmount, 1500);
      const submitted = await upload('/api/user/subscriptions/manual-payment', { planId: plan.id, couponCode: 'PHASE2', transactionNumber: 'COUPON-TEST-001', amount: 1 }, first.body.token);
      assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
      const payment = (await db.query('SELECT amount,proof_url FROM payments WHERE id=$1', [submitted.body.payment.id])).rows[0];
      assert.equal(Number(payment.amount), 1500);
      const route = `/api/super-admin/cash-payments/${submitted.body.payment.id}`;
      const review = { userId: first.body.user.id, subscriptionId: submitted.body.subscription.id, amount: 1500, currency: 'LKR', status: 'rejected', reference: 'COUPON-TEST-001', proofUrl: payment.proof_url };
      assert.equal((await request(route, 'PATCH', review, adminToken)).status, 200);
      assert.equal((await request(route, 'PATCH', review, adminToken)).status, 200);
      assert.equal((await request(route, 'PATCH', { ...review, status: 'approved' }, adminToken)).status, 409);
      assert.equal((await db.query('SELECT status FROM coupon_redemptions WHERE payment_id=$1', [submitted.body.payment.id])).rows[0].status, 'cancelled');
      assert.equal((await db.query('SELECT status FROM subscriptions WHERE id=$1', [submitted.body.subscription.id])).rows[0].status, 'cancelled');
      assert.equal((await request('/api/user/coupons/preview', 'POST', { planId: plan.id, code: 'PHASE2' }, first.body.token)).status, 200);
    });
    await t.test('affiliate withdrawal review reserves funds and rejection restores availability', async () => {
      const commission = (await db.query('SELECT id,affiliate_id,referral_id,amount,currency FROM affiliate_commissions ORDER BY id LIMIT 1')).rows[0];
      const commissionReview = { affiliateId: commission.affiliate_id, referralId: commission.referral_id, amount: Number(commission.amount), currency: commission.currency, status: 'approved' };
      assert.equal((await request(`/api/super-admin/affiliations/commissions/${commission.id}`, 'PATCH', commissionReview, adminToken)).status, 200);
      const submitted = await request('/api/user/affiliations/withdrawals', 'POST', { amount: 80, currency: 'LKR' }, second.body.token);
      assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
      const route = `/api/super-admin/withdrawals/${submitted.body.withdrawal.id}`;
      const review = { userId: second.body.user.id, amount: 80, currency: 'LKR', method: 'bank_transfer', accountName: 'Test account', status: 'approved' };
      assert.equal((await request(route, 'PATCH', review, first.body.token)).status, 403);
      assert.equal((await request(route, 'PATCH', review, adminToken)).status, 200);
      assert.equal((await request(route, 'PATCH', { ...review, amount: 81 }, adminToken)).status, 409);
      assert.equal((await request(route, 'PATCH', { ...review, status: 'completed' }, adminToken)).status, 400);
      assert.equal((await request('/api/user/affiliations/withdrawals', 'POST', { amount: 80, currency: 'LKR' }, second.body.token)).status, 409);
      assert.equal((await request(route, 'PATCH', { ...review, status: 'rejected', adminNote: 'Test rejection' }, adminToken)).status, 200);
      const replacement = await request('/api/user/affiliations/withdrawals', 'POST', { amount: 80, currency: 'LKR' }, second.body.token);
      assert.equal(replacement.status, 201);
      const replacementRoute = `/api/super-admin/withdrawals/${replacement.body.withdrawal.id}`;
      assert.equal((await request(replacementRoute, 'PATCH', review, adminToken)).status, 200);
      assert.equal((await upload(`${replacementRoute}/receipt`, {}, adminToken, 'receipt')).status, 200);
      const receiptRoute = `/api/user/affiliations/withdrawals/${replacement.body.withdrawal.id}/receipt`;
      const receipt = await fetch(origin + receiptRoute, { headers: { Authorization: `Bearer ${second.body.token}` } });
      assert.equal(receipt.status, 200);
      assert.match(receipt.headers.get('content-type'), /image\/png/);
      await receipt.arrayBuffer();
      assert.equal((await request(receiptRoute, 'GET', null, first.body.token)).status, 404);
      assert.equal((await request(replacementRoute, 'PATCH', { ...review, status: 'completed' }, adminToken)).status, 200);
      assert.equal((await request(replacementRoute, 'PATCH', { ...review, status: 'completed' }, adminToken)).status, 409);
      const payout = (await db.query('SELECT status FROM payouts WHERE withdrawal_id=$1', [replacement.body.withdrawal.id])).rows;
      assert.equal(payout.length, 1);
      assert.equal(payout[0].status, 'paid');
    });
    await t.test('administrator password and status changes invalidate existing sessions',async()=>{
      const id=second.body.user.id;
      const changed=await request(`/api/super-admin/users/${id}`,'PATCH',{
        firstName:'Test',lastName:'Two',email:'two@example.test',password:'Admin replacement password 123!',status:'active',preferredCurrency:'LKR'
      },adminToken);
      assert.equal(changed.status,200,JSON.stringify(changed.body));
      assert.equal((await request('/api/user/dashboard','GET',null,second.body.token)).status,401);
      const login=await request('/api/auth/login','POST',{email:'two@example.test',password:'Admin replacement password 123!'});
      assert.equal(login.status,200);
      assert.equal((await request(`/api/super-admin/users/${id}/status`,'PATCH',{status:'rejected'},adminToken)).status,200);
      assert.equal((await request(`/api/super-admin/users/${id}/status`,'PATCH',{status:'active'},adminToken)).status,200);
      assert.equal((await request('/api/user/dashboard','GET',null,login.body.token)).status,401);
    });
    await t.test('logout invalidates the registration token', async () => {
      assert.equal((await request('/api/auth/logout', 'POST', {}, first.body.token)).status, 200);
      assert.equal((await request('/api/user/dashboard', 'GET', null, first.body.token)).status, 401);
    });
  } finally {
    mail.sendAppointmentApproved = originalAppointmentMail;
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = query; pool.connect = connect;
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
    if (oldOrigin === undefined) delete process.env.PUBLIC_APP_URL; else process.env.PUBLIC_APP_URL = oldOrigin;
    try {
      const proofs = await db.query('SELECT proof_url FROM payments UNION SELECT proof_url FROM nfc_orders UNION SELECT transfer_receipt_url AS proof_url FROM withdrawals');
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
