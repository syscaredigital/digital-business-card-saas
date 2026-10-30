const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('../backend/node_modules/pg');
const pool = require('../backend/config/database.config');
const { migrate, seedFresh } = require('../database/migrate');
const { quotePackage, completeRegionalPrices } = require('../backend/services/package-pricing.service');

test('regional prices stay fixed and currency switching retains the market', async () => {
  const rates = { LKR: 1, AUD: 0.005, USD: 0.003 };
  const rate = async currency => ({ rate: rates[currency], rateDate: '2026-10-23' });
  const prices = await completeRegionalPrices({ LKR: 10000 }, rate);
  assert.deepEqual(prices, { LKR: 10000, AUD: 75, USD: 45 });
  const plan = { id: 1, price: 10000, billing_interval: 'yearly' };
  const db = { query: async (sql, args) => ({ rowCount: 1, rows: [{ amount: prices[args[1]] }] }) };
  assert.equal((await quotePackage(db, plan, 'AU', 'AUD', rate)).amount, 75);
  rates.AUD = 0.01;
  assert.equal((await quotePackage(db, plan, 'AU', 'AUD', rate)).amount, 75);
  const disguised = await quotePackage(db, plan, 'AU', 'LKR', rate);
  assert.equal(disguised.market, 'AU');
  assert.equal(disguised.amount, 7500);
  assert.equal((await quotePackage(db, plan, 'US', 'USD', rate)).amount, 45);
  assert.equal((await quotePackage(db, plan, 'LK', 'USD', rate)).amount, 30);
  const missing = { query: async () => ({ rowCount: 0, rows: [] }) };
  await assert.rejects(quotePackage(missing, plan, 'AU', 'AUD', rate), /not configured/);
  await assert.rejects(quotePackage(db, plan, 'ZZ', 'AUD', rate), /billing country/);
  assert.equal((await quotePackage(missing, { ...plan, price: 0 }, 'AU', 'AUD', rate)).amount, 0);
});

test('regional checkout, coupons, price changes, shipping and admin approval', async t => {
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(pool.options.host));
  assert.notEqual(process.env.NODE_ENV, 'production');
  const schema = 'regional_test_' + crypto.randomBytes(8).toString('hex');
  const query = pool.query.bind(pool), connect = pool.connect.bind(pool);
  const db = new Pool({ ...pool.options, password: pool.options.password, options: `-c search_path=${schema}`, max: 5 });
  const originalFetch = global.fetch, oldOrigin = process.env.PUBLIC_APP_URL;
  let server, browser;
  try {
    await query(`CREATE SCHEMA "${schema}"`);
    const client = await db.connect();
    try { await migrate(client); await seedFresh(client); } finally { client.release(); }
    pool.query = db.query.bind(db); pool.connect = db.connect.bind(db);
    const app = require('../backend/app');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    process.env.PUBLIC_APP_URL = origin;
    global.fetch = (url, options) => String(url).startsWith(origin) ? originalFetch(url, options)
      : Promise.resolve({ ok: true, json: async () => ({ date: '2026-10-23', rates: { AUD: 0.005, USD: 0.003 } }) });
    const request = async (route, method = 'GET', body, token) => {
      const response = await fetch(origin + '/api' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, body: await response.json() };
    };
    const upload = async (route, fields, token) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) form.append(key, value);
      const png = await require('../backend/node_modules/sharp')({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer();
      form.append('slip', new Blob([png], { type: 'image/png' }), 'test.png');
      const response = await fetch(origin + '/api' + route, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      return { status: response.status, body: await response.json() };
    };
    const admin = (await request('/auth/register', 'POST', { firstName: 'Admin', lastName: 'Test', email: 'regional-admin@example.test', password: 'Strong password 123!' })).body;
    await db.query("UPDATE users SET role_id=(SELECT id FROM roles WHERE name='super_admin') WHERE id=$1", [admin.user.id]);
    const user = (await request('/auth/register', 'POST', { firstName: 'Regional', lastName: 'Test', email: 'regional@example.test', password: 'Strong password 123!', billingCountry: 'AU', currency: 'AUD' })).body;
    const template = (await db.query('SELECT id FROM vcard_templates WHERE is_public=TRUE LIMIT 1')).rows[0].id;
    const payload = { name: 'Regional Pro', prices: { LKR: 10000 }, billingInterval: 'yearly', vcardLimit: 5, nfcLimit: 2, analyticsLimit: 10, storageLimitMb: 100, vcardFeatures: ['basic-details'], templateIds: [template] };
    let planId;
    await t.test('admin saves initial +50% prices and they appear in both catalogs', async () => {
      const created = await request('/super-admin/plans', 'POST', payload, admin.token);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.plan.prices.AUD, 75);
      planId = created.body.plan.id;
      const billing = await request('/user/plans', 'GET', null, user.token);
      assert.equal(billing.status, 200, JSON.stringify(billing.body));
      assert.equal(billing.body.billingCountry, 'AU');
      assert.equal(billing.body.plans.find(p => p.id === planId).price, 75);
      const catalog = await request('/public/plans?billingCountry=AU&currency=LKR');
      assert.equal(catalog.body.data.find(p => p.id === planId).price, 15000);
      assert.equal((await request('/user/billing-country', 'PATCH', { billingCountry: 'ZZ' }, user.token)).status, 400);
      const invalid = await request('/super-admin/plans/' + planId, 'PATCH', { ...payload, prices: { LKR: 10000, AUD: -1, USD: 45 } }, admin.token);
      assert.equal(invalid.status, 400);
    });
    for (const key of ['bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch']) await db.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2', [key, 'Test']);
    await t.test('coupon preview uses regional price; changed prices require review', async () => {
      await db.query("INSERT INTO coupon_codes(code,name,discount_type,discount_value,currency,status,per_user_limit) VALUES('REGION10','Regional discount','percentage',10,'AUD','active',5)");
      const preview = await request('/user/coupons/preview', 'POST', { planId, code: 'REGION10' }, user.token);
      assert.equal(preview.body.originalAmount, 75);
      assert.equal(preview.body.finalAmount, 67.5);
      const stale = await upload('/user/subscriptions/manual-payment', { planId, transactionNumber: 'REGIONAL-STALE', expectedAmount: 1, expectedCurrency: 'AUD', billingCountry: 'AU' }, user.token);
      assert.equal(stale.status, 409);
    });
    let paymentId;
    await t.test('checkout ignores client amount and snapshots regional pricing and interval', async () => {
      const submitted = await upload('/user/subscriptions/manual-payment', { planId, transactionNumber: 'REGIONAL-001', amount: 1, expectedAmount: 75, expectedCurrency: 'AUD', billingCountry: 'AU', couponCode: 'REGION10' }, user.token);
      assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
      paymentId = submitted.body.payment.id;
      const saved = (await db.query('SELECT amount,currency,pricing_snapshot FROM payments WHERE id=$1', [paymentId])).rows[0];
      assert.equal(Number(saved.amount), 67.5);
      assert.equal(saved.currency, 'AUD');
      assert.equal(saved.pricing_snapshot.market, 'AU');
      assert.equal(saved.pricing_snapshot.billingInterval, 'yearly');
      const changed = await request('/super-admin/plans/' + planId, 'PATCH', { ...payload, prices: { LKR: 12000, AUD: 99, USD: 59 }, billingInterval: 'monthly' }, admin.token);
      assert.equal(changed.status, 200, JSON.stringify(changed.body));
      const billing = (await request('/user/plans', 'GET', null, user.token)).body;
      assert.equal(billing.payments[0].amount, 67.5);
      assert.equal(billing.payments[0].pricing.regionalAmount, 75);
      assert.equal((await request('/user/billing-country', 'PATCH', { billingCountry: 'US' }, user.token)).status, 200);
      const abroad = (await request('/user/plans', 'GET', null, user.token)).body;
      assert.equal(abroad.market, 'INTL');
      assert.equal(abroad.plans.find(p => p.id === planId).pricing.regionalAmount, 59);
    });
    await t.test('approval preserves the purchased duration after the admin changes the plan', async () => {
      const saved = (await db.query('SELECT * FROM payments WHERE id=$1', [paymentId])).rows[0];
      const approval = { userId: user.user.id, subscriptionId: saved.subscription_id, amount: 67.5, currency: 'AUD', status: 'approved', reference: saved.gateway_reference, proofUrl: saved.proof_url, notes: saved.notes };
      assert.equal((await request('/super-admin/cash-payments/' + paymentId, 'PATCH', { ...approval, amount: 1 }, admin.token)).status, 409);
      const approved = await request('/super-admin/cash-payments/' + paymentId, 'PATCH', approval, admin.token);
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      const duration = (await db.query('SELECT end_date-start_date AS days FROM subscriptions WHERE id=$1', [saved.subscription_id])).rows[0];
      assert.ok(duration.days >= 365);
      const current = (await request('/user/plans', 'GET', null, user.token)).body.current;
      assert.equal(current.price, 67.5);
      assert.equal(current.currency, 'AUD');
      assert.equal(current.billingInterval, 'yearly');
      const retained = await request('/super-admin/plans/' + planId, 'PATCH', { ...payload, prices: { LKR: 14000 } }, admin.token);
      assert.equal(retained.body.plan.prices.AUD, 99);
      assert.equal(retained.body.plan.prices.USD, 59);
    });
    await t.test('NFC destination fees are separate, required and saved in the order', async () => {
      const card = (await request('/user/vcards', 'POST', { title: 'Regional Card', templateId: template, slug: 'regional-shipping', sections: {} }, user.token)).body.vcard;
      const product = (await db.query("INSERT INTO nfc_products(name,price,is_active,front_image,back_image) VALUES('Regional NFC',500,TRUE,'https://example.test/front.png','https://example.test/back.png') RETURNING id")).rows[0];
      await db.query("INSERT INTO settings(key,value) VALUES('domestic_nfc_shipping_lkr','100'),('international_nfc_shipping_lkr','2000') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value");
      const stale = await upload('/user/nfc/orders', { productId: product.id, vcardId: card.id, quantity: 2, destinationCountry: 'AU', shippingAddress: '123 Test Street, recipient phone 123456789', transactionNumber: 'REGIONAL-STALE-SHIPPING', expectedAmount: 1 }, user.token);
      assert.equal(stale.status, 409);
      for (const [country, expectedShipping] of [['LK', 100], ['AU', 2000]]) {
        const order = await upload('/user/nfc/orders', { productId: product.id, vcardId: card.id, quantity: 2, destinationCountry: country, shippingAddress: '123 Test Street, recipient phone 123456789', transactionNumber: 'REGIONAL-NFC-' + country }, user.token);
        assert.equal(order.status, 201, JSON.stringify(order.body));
        const saved = (await db.query('SELECT * FROM nfc_orders WHERE id=$1', [order.body.order.id])).rows[0];
        assert.equal(Number(saved.shipping_cost_lkr), expectedShipping);
        assert.equal(Number(saved.amount), (1000 + expectedShipping) * 0.005);
      }
      await db.query("UPDATE settings SET value='0' WHERE key='international_nfc_shipping_lkr'");
      const blocked = await upload('/user/nfc/orders', { productId: product.id, vcardId: card.id, quantity: 1, destinationCountry: 'AU', shippingAddress: '123 Test Street, recipient phone 123456789', transactionNumber: 'REGIONAL-MISSING-FEE' }, user.token);
      assert.equal(blocked.status, 409);
    });
    if (process.argv.includes('--browser')) await t.test('public catalog, registration, user billing and admin regional prices work in the browser', async () => {
      browser = await require('../backend/node_modules/playwright').chromium.launch({ channel: 'msedge', headless: true });
      const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/pages/website/pricing.html');
      await page.locator('[aria-label="Package billing country"] option[value="AU"]').waitFor({ state: 'attached' });
      await page.locator('[aria-label="Package billing country"]').selectOption('AU');
      await page.locator('#publicPricingPlans').getByText('Regional Pro', { exact: true }).waitFor();
      await page.goto(origin + '/pages/auth/register.html?billingCountry=AU');
      await page.locator('#registerBillingCountry option[value="AU"]').waitFor({ state: 'attached' });
      assert.equal(await page.locator('#registerBillingCountry').inputValue(), 'AU');
      await page.goto(origin + '/pages/auth/login.html');
      await page.fill('#loginEmail', 'regional@example.test'); await page.fill('#passwordInput', 'Strong password 123!');
      await Promise.all([page.waitForURL('**/user/dashboard.html'), page.locator('#loginForm button[type=submit]').click()]);
      await page.goto(origin + '/pages/user/payments.html');
      await page.locator('#packageBillingCountry option[value="AU"]').waitFor({ state: 'attached' });
      await page.locator('#packageBillingCountry').selectOption('AU');
      await page.waitForFunction(() => document.getElementById('billingCurrency').textContent.includes('Australia'));
      await page.locator('#billingPlanCatalog').screenshot({ path: 'test-results/regional-billing-mobile.png' });
      await context.clearCookies();
      await page.goto(origin + '/pages/auth/login.html');
      await page.fill('#loginEmail', 'regional-admin@example.test'); await page.fill('#passwordInput', 'Strong password 123!');
      await Promise.all([page.waitForURL('**/super-admin/dashboard.html'), page.locator('#loginForm button[type=submit]').click()]);
      await page.goto(origin + '/pages/super-admin/subscriptions.html');
      await page.locator('[data-subscriptions-tab-target="plansPanel"]').click();
      await page.locator('[data-live-plan-action="edit"][data-plan-id="' + planId + '"]').click();
      const values = await page.locator('#planCurrencyPrices [data-plan-price-amount]').evaluateAll(nodes => nodes.map(node => node.value));
      assert.deepEqual(values, ['14000', '99', '59']);
      await page.screenshot({ path: 'test-results/regional-admin-mobile.png' });
      assert.deepEqual(errors, []);
      await context.close();
    });
  } finally {
    if (browser) await browser.close();
    global.fetch = originalFetch;
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = query; pool.connect = connect;
    if (oldOrigin === undefined) delete process.env.PUBLIC_APP_URL; else process.env.PUBLIC_APP_URL = oldOrigin;
    await db.end(); await query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end();
  }
});
