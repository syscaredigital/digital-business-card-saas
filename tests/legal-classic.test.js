const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../backend/node_modules/playwright');
const app = require('../backend/app');
const pool = require('../backend/config/database.config');

test('Legal Classic preview and live forms use shared card workflows', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const cardPath = '/pages/public-vcard/final-20-legal-classic.html';
    const errors = [];
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if(response.url().startsWith(origin+'/public/') && response.status()>=400) errors.push('Asset failed: '+response.url());
    });
    page.on('console', message => {
      if (/Content Security Policy|Refused to/.test(message.text())) errors.push(message.text());
    });
    // Local preview images load normally; API calls are mocked and external requests are blocked.
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname.includes('qrcode')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="white"/></svg>'});
        return route.fulfill({json:{vcard:{title:'Avery <script>alert(1)</script> Law',phone:'+94112345678',email:'avery@example.test',address:'Colombo',contactCaptureRequired:true,sections:{'basic-details':'Dealer',services:'Legal consultation | Consultation',appointments:'Legal consultation | 60'}}}});
      }
      return route.continue();
    });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width,height:900});
      await page.goto(origin + cardPath, {waitUntil:'networkidle'});
      assert.match(await page.locator('h1').innerText(), /Mary Arden/i);
      assert.doesNotMatch(await page.locator('[data-classic-section="products"]').innerText(), /public\/assets/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
      await page.locator('.legal-gallery-button').first().click();
      assert.equal(await page.locator('.legal-viewer').evaluate(node => node.open), true);
      await page.locator('.legal-viewer button').click();
      await page.locator('.submit-button').click();
      assert.match(await page.locator('.vcard-enquiry-status').innerText(), /published/);
      await page.locator('.classic-save').click();
      assert.match(await page.locator('.classic-save-status').innerText(), /published/);
      fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
      await page.screenshot({path:path.join(__dirname,`../test-results/legal-classic-${width}.png`),fullPage:true});
    }
    await page.goto(origin + cardPath + '?id=123', {waitUntil:'networkidle'});
    assert.match(await page.locator('h1').innerText(), /<script>/i);
    assert.equal(await page.locator('h1 script').count(),0);
    assert.equal(await page.locator('[data-classic-section="products"]').count(),0);
    assert.equal(await page.locator('[data-classic-section="gallery"]').count(),0);
    assert.equal(await page.locator('[data-classic-section="business-hours"]').count(),0);
    assert.doesNotMatch(await page.locator('main').innerText(),/Mary Arden|Sample Client/);
    await page.locator('.classic-save').click();
    assert.equal(await page.locator('.vcard-save-modal').isVisible(),true);
    await page.locator('.vcard-save-close').click();
    let enquiry;
    await page.route('**/api/public/vcards/123/enquiries',route => {
      enquiry = route.request().postDataJSON();
      return route.fulfill({json:{message:'Enquiry received'}});
    });
    await page.locator('.message-panel input[type=text]').fill('Test Visitor');
    await page.locator('.message-panel input[type=email]').fill('visitor@example.test');
    await page.locator('.message-panel textarea').fill('Can I arrange a legal consultation?');
    await page.locator('.submit-button').click();
    await page.waitForFunction(() => document.querySelector('.vcard-enquiry-status').textContent === 'Enquiry received');
    assert.equal(enquiry.message,'Can I arrange a legal consultation?');
    let booking;
    await page.route('**/api/public/vcards/123/appointments',route => {
      booking = route.request().postDataJSON();
      return route.fulfill({json:{message:'Appointment requested'}});
    });
    const form = page.locator('[data-vcard-appointment-form]');
    await form.locator('[name=serviceName]').selectOption('Legal consultation');
    await form.locator('[name=name]').fill('Test Visitor');
    await form.locator('[name=email]').fill('visitor@example.test');
    await form.locator('[name=date]').fill('2099-01-20');
    await form.locator('[name=time]').fill('10:00');
    await form.locator('[name=meetingMode]').selectOption('office');
    await form.locator('button').click();
    await page.waitForFunction(() => document.querySelector('.vfeature-booking-status').textContent === 'Appointment requested');
    assert.equal(booking.durationMinutes,60);
    assert.equal(booking.serviceName,'Legal consultation');
    // Existing design still renders without the new page's configuration.
    await page.goto(origin+'/pages/public-vcard/final-05-legal.html',{waitUntil:'networkidle'});
    assert.equal(await page.locator('[data-theme=legal]').count(),1);
    assert.deepEqual(errors,[]);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});


