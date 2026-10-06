const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { chromium } = require('../backend/node_modules/playwright');

test('all classic templates keep saved text and uploaded review photos in their layout', async () => {
  const app = express();
  app.use(express.static(path.join(__dirname, '../frontend')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    let card;
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin && !url.href.startsWith('data:')) return route.abort();
      if (url.pathname.endsWith('/qrcode')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>' });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { vcard: card } });
      return route.continue();
    });
    const themes = ['automotive','corporate','events','trainer','property','boutique','creative','technology','medical','legal'];
    for (const [index, theme] of themes.entries()) {
      for (const width of [320, 390, 1440]) {
        for (const long of [false, true]) {
          const word = long ? 'SavedInformation'.repeat(8) : 'Alex';
          card = {
            title: word, qualifications: long ? word : '', description: `${word}\nSaved biography`,
            email: `${word}@example.test`, phone: '+94112345678', address: word,
            avatarUrl: photo, coverImageUrl: photo,
            sections: { 'basic-details': word, services: `${word} | ${word}`, products: `${word} | ${word}`,
              testimonials: `Saved review | Saved customer | ${photo}` }
          };
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`${origin}/pages/public-vcard/final-${index + 11}-${theme}-classic.html?id=123`, { waitUntil: 'networkidle' });
          const label = `${theme} ${width} ${long ? 'long' : 'short'}`;
          assert.equal(await page.locator('.final-role').textContent(), word, label);
          assert.match(await page.locator('.final-quote').textContent(), /Saved customer/, label);
          assert.doesNotMatch(await page.locator('main').innerText(), /data:image|base64|Sample Client/, label);
          assert.equal(await page.locator('.final-quote img').count(), 1, label);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, label);
          const overflow = await page.locator('.final-name-block, .final-item-copy, .final-contact-copy, .final-quote').evaluateAll(nodes => nodes.some(node => node.scrollWidth > node.clientWidth + 2));
          assert.equal(overflow, false, `${label}: text overflow`);
          if (theme === 'corporate') {
            const portrait = await page.locator('.final-avatar').boundingBox();
            const description = await page.locator('.final-description').boundingBox();
            assert.ok(description.y >= portrait.y + portrait.height, `${label}: biography overlaps portrait`);
          }
          if (theme === 'technology') {
            const identity = await page.locator('.final-name-block').boundingBox();
            const contact = await page.locator('[data-classic-section="contact"]').boundingBox();
            assert.ok(contact.y >= identity.y + identity.height, `${label}: identity overlaps contact`);
          }
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
