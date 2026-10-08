const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const { chromium } = require('../backend/node_modules/playwright');

test('editor associates uploads with existing rows through edits, reorder, save and reload', async () => {
  const app = express();
  app.use(express.static(path.join(__dirname, '../frontend')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('sessionActive', 'true'));
    let sections = { services: 'First | First description\nSecond | Second description' };
    let payload;
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/user/vcards/123') {
        if (route.request().method() === 'PATCH') { payload = route.request().postDataJSON(); sections = payload.sections; return route.fulfill({ json: { message: 'Saved' } }); }
        return route.fulfill({ json: { vcard: { title: 'Photo test', template_id: 12, is_active: true, settings: { sections } }, entitlements: { templates: [{ id: 12, name: 'Corporate' }], features: [{ key: 'services', label: 'Services' }] } } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
      return route.continue();
    });
    await page.goto(origin + '/pages/user/edit-vcard.html?id=123', { waitUntil: 'domcontentloaded' });
    const field = page.locator('[data-vcard-section=services]');
    await field.waitFor();
    const imageEditor = page.locator('[data-section-image-editor=services]');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    await imageEditor.locator('input[type=file]').setInputFiles([{ name: 'first.png', mimeType: 'image/png', buffer: png }, { name: 'second.png', mimeType: 'image/png', buffer: Buffer.concat([png, Buffer.from('second')]) }]);
    await imageEditor.locator('article').nth(1).waitFor();
    assert.equal(await field.inputValue(), 'First | First description\nSecond | Second description');
    await field.fill('Second | Second description\nFirst | First description');
    assert.equal(await imageEditor.locator('article img').nth(1).getAttribute('src'), 'data:image/png;base64,' + png.toString('base64'));
    assert.equal(await imageEditor.locator('article span').first().innerText(), 'Second');
    await field.fill('Second | Revised description\nFirst | First description');
    assert.equal(await imageEditor.locator('article').count(), 2);
    await field.fill('New row\nSecond | Revised description\nFirst | First description');
    assert.deepEqual(await imageEditor.locator('article span').allTextContents(), ['Second', 'First']);
    await field.fill('New row\nFirst | First description');
    assert.deepEqual(await imageEditor.locator('article span').allTextContents(), ['First']);
    await page.locator('#userVcardEditor button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#vcardEditorStatus').textContent === 'Saved successfully');
    assert.match(payload.sections.services, /^New row\nFirst \| First description \| data:image\/png;base64,/);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await imageEditor.locator('article').waitFor();
    assert.equal(await field.inputValue(), 'New row\nFirst | First description');
    await imageEditor.locator('[data-remove-section-image]').click();
    await page.locator('#userVcardEditor button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#vcardEditorStatus').textContent === 'Saved successfully');
    assert.equal(payload.sections.services, 'New row\nFirst | First description');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
