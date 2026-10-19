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
    let payload, hiddenSections;
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/user/vcards/123') {
        if (route.request().method() === 'PATCH') { payload = route.request().postDataJSON(); sections = payload.sections; hiddenSections = payload.hiddenSections; return route.fulfill({ json: { message: 'Saved' } }); }
        return route.fulfill({ json: { vcard: { title: 'Photo test', template_id: 12, is_active: true, settings: { sections, hiddenSections } }, entitlements: { templates: [{ id: 12, name: 'Corporate' }], features: [{ key: 'services', label: 'Services' }] } } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
      return route.continue();
    });
    await page.goto(origin + '/pages/user/edit-vcard.html?id=123', { waitUntil: 'domcontentloaded' });
    const rows = page.locator('[data-section-row=services]');
    await rows.nth(1).waitFor();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    const second = Buffer.concat([png, Buffer.from('second')]);
    await rows.nth(0).locator('input[type=file]').setInputFiles({name:'first.png',mimeType:'image/png',buffer:png});
    await rows.nth(0).locator('img').waitFor();
    await rows.nth(1).locator('input[type=file]').setInputFiles({name:'second.png',mimeType:'image/png',buffer:second});
    await rows.nth(1).locator('img').waitFor();
    await rows.nth(1).getByRole('button',{name:'Move service up',exact:true}).click();
    assert.equal(await rows.nth(1).locator('img').getAttribute('src'),'data:image/png;base64,'+png.toString('base64'));
    assert.equal(await rows.first().getByLabel('Service name').inputValue(),'Second');
    await rows.first().getByLabel('Description').fill('Revised description');
    await page.getByRole('button',{name:'+ Add service',exact:true}).click();
    await rows.nth(2).getByLabel('Service name').fill('New row');
    await rows.nth(2).getByRole('button',{name:'Move service up',exact:true}).click();
    await rows.nth(1).getByRole('button',{name:'Move service up',exact:true}).click();
    await rows.nth(1).getByRole('button',{name:'Remove',exact:true}).click();
    assert.equal(await rows.nth(1).getByLabel('Service name').inputValue(),'First');
    await page.locator('#userVcardEditor button[type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#vcardEditorStatus').textContent==='Saved successfully');
    assert.match(payload.sections.services,/^New row\nFirst \| First description \| data:image\/png;base64,/);
    await page.reload({waitUntil:'domcontentloaded'});
    await rows.nth(1).locator('img').waitFor();
    assert.equal(await rows.nth(1).getByLabel('Service name').inputValue(),'First');
    await rows.nth(1).getByRole('button',{name:'Remove photo',exact:true}).click();
    await page.locator('#userVcardEditor button[type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#vcardEditorStatus').textContent==='Saved successfully');
    assert.equal(payload.sections.services,'New row\nFirst | First description');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
