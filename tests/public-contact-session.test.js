const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { chromium } = require('../backend/node_modules/playwright');
const { protect } = require('../backend/helpers/browser-session');

test('public card actions work with an existing account cookie without bypassing session protection', async () => {
  const app = express();
  const actions = [];
  app.use(express.json());
  app.use('/api', protect);
  app.get('/api/public/vcards/123', (req, res) => res.json({ vcard: {
    title: 'Contact Test', contactCaptureRequired: true, sections: { appointments: 'Consultation | 30' }
  } }));
  app.post('/api/public/vcards/123/:action', (req, res) => {
    actions.push({ action: req.params.action, cookie: req.get('cookie'), body: req.body });
    res.json({ message: 'Saved successfully', downloadUrl: '/api/public/vcards/123/contact.vcf?ticket=test' });
  });
  app.get('/api/public/vcards/123/contact.vcf', (req, res) => {
    res.attachment('contact.vcf').type('text/vcard').send('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Contact Test\r\nEND:VCARD\r\n');
  });
  app.get('/api/public/vcards/123/qrcode', (req, res) => res.type('svg').send('<svg xmlns="http://www.w3.org/2000/svg"/>'));
  app.use(express.static(path.join(__dirname, '../frontend')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    // This is the screenshot's failure: a public POST inherits a login cookie.
    const rejected = await fetch(origin + '/api/public/vcards/123/contact-saves', {
      method: 'POST', headers: { Cookie: 'sync_session=existing-login', Origin: origin, 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.equal(rejected.status, 403);
    assert.match((await rejected.json()).message, /Invalid browser request origin/);
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: 'sync_session', value: 'existing-login', url: origin, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    for (const signedIn of [true, false]) {
      if (!signedIn) await context.clearCookies();
      await page.goto(origin + '/pages/public-vcard/final-12-corporate-classic.html?id=123', { waitUntil: 'domcontentloaded' });
      await page.locator('.classic-save').waitFor();
      await page.locator('.classic-save').click();
      const form = page.locator('.vcard-save-form');
      await form.locator('[name=name]').fill('Test Visitor');
      await form.locator('[name=email]').fill('visitor@example.test');
      await form.locator('[name=consent]').check();
      const downloadPromise = page.waitForEvent('download');
      await form.locator('button[type=submit]').click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), 'contact.vcf');
      assert.equal(await download.failure(), null);
      await page.locator('.vcard-save-close').click();
      await page.locator('.message-panel input[type=text]').fill('Test Visitor');
      await page.locator('.message-panel input[type=email]').fill('visitor@example.test');
      await page.locator('.message-panel textarea').fill('Please contact me.');
      await page.locator('.submit-button').click();
      await page.waitForFunction(() => document.querySelector('.vcard-enquiry-status').textContent === 'Saved successfully');
      const booking = page.locator('[data-vcard-appointment-form]');
      await booking.locator('[name=serviceName]').selectOption('Consultation');
      await booking.locator('[name=name]').fill('Test Visitor');
      await booking.locator('[name=email]').fill('visitor@example.test');
      await booking.locator('[name=date]').fill('2099-01-20');
      await booking.locator('[name=time]').fill('10:00');
      await booking.locator('[name=meetingMode]').selectOption('office');
      await booking.locator('button').click();
      await page.waitForFunction(() => document.querySelector('.vfeature-booking-status').textContent === 'Saved successfully');
    }
    for (const action of ['contact-saves', 'enquiries', 'appointments']) {
      const matching = actions.filter(entry => entry.action === action);
      assert.equal(matching.length, 2, action);
      assert.ok(matching.every(entry => !entry.cookie), `${action} must not send an account cookie`);
    }
    assert.ok(actions.some(entry => entry.action === 'events'));
    assert.ok(actions.every(entry => !entry.cookie));
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
