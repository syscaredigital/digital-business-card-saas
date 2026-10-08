const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
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
    const screenshots = path.join(__dirname, '../test-results/classic-layout');
    fs.mkdirSync(screenshots, { recursive: true });
    for (const [index, theme] of themes.entries()) {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(`${origin}/pages/public-vcard/final-${index + 11}-${theme}-classic.html`, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        const images = Array.from(document.images);
        images.forEach(img => { img.loading = 'eager'; });
        await Promise.all(images.map(img => img.decode().catch(() => {})));
      });
      await page.screenshot({ path: path.join(screenshots, `${theme}.png`), fullPage: true });
      const controls = await page.locator('.final-form input, .final-form select, .final-socials a').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44));
      assert.ok(controls, `${theme}: controls need comfortable touch targets`);
      const labels = await page.locator('.final-form input, .final-form select, .final-form textarea').evaluateAll(nodes => nodes.every(node => node.labels.length > 0));
      assert.ok(labels, `${theme}: fields need visible labels`);
      assert.ok(await page.locator('.final-avatar').evaluate(node => {
        const rect = node.getBoundingClientRect();
        return Boolean(document.elementFromPoint(rect.x + rect.width / 2, rect.y + 10)?.closest('.final-avatar'));
      }), `${theme}: cover must not obscure portrait`);
      for (const width of [320, 390, 1440]) {
        for (const long of [false, true]) {
          const word = long ? 'SavedInformation'.repeat(8) : 'Alex';
          card = {
            title: word, qualifications: long ? word : '', description: `${word}\nSaved biography`,
            email: `${word}@example.test`, phone: '+94112345678', address: word,
            avatarUrl: photo, coverImageUrl: photo,
            sections: { 'basic-details': word, services: `${word} | ${word}`, products: `${word} | ${word}`,
              testimonials: `Saved review | Saved customer | ${photo}`,
              blogs: 'Saved article | Article summary | https://example.test/article',
              'instagram-embed': `Saved Instagram | ${photo}`, 'custom-links': 'Portfolio | https://example.test/portfolio',
              iframes: 'Video | https://example.test/video', banners: `Saved banner | ${photo}`,
              advanced: 'Languages: English', 'privacy-policy': 'Saved privacy policy', 'term-condition': 'Saved terms',
              'manage-section': 'Saved extra details', 'custom-fonts': 'Georgia',
              seo: 'title | Saved SEO title\ndescription | Saved SEO description',
              'qrcode-customize': 'https://example.test/custom-qr' }
          };
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`${origin}/pages/public-vcard/final-${index + 11}-${theme}-classic.html?id=123`, { waitUntil: 'networkidle' });
          const label = `${theme} ${width} ${long ? 'long' : 'short'}`;
          assert.equal(await page.locator('.final-role').textContent(), word, label);
          assert.equal(await page.locator('.final-extra-section').count(), 9, label);
          assert.equal(await page.locator('[data-feature-key="custom-links"] a').getAttribute('href'), 'https://example.test/portfolio');
          assert.equal(await page.title(), 'Saved SEO title');
          assert.equal(await page.locator('meta[name=description]').getAttribute('content'), 'Saved SEO description');
          assert.match(await page.locator('.final-name-block h1').evaluate(node => getComputedStyle(node).fontFamily), /Georgia/);
          assert.match(await page.locator('.final-qr-copy a').getAttribute('href'), /custom-qr/);
          assert.match(await page.locator('.final-quote').textContent(), /Saved customer/, label);
          assert.doesNotMatch(await page.locator('main').innerText(), /data:image|base64|Sample Client/, label);
          assert.equal(await page.locator('.final-quote img').count(), 1, label);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, label);
          const overflow = await page.locator('.final-name-block, .final-item-copy, .final-contact-copy, .final-quote').evaluateAll(nodes => nodes.some(node => node.scrollWidth > node.clientWidth + 2));
          assert.equal(overflow, false, `${label}: text overflow`);
          const textSize = await page.locator('.final-contact-copy strong,.final-description,.final-item-copy strong').evaluateAll(nodes => nodes.every(node => parseFloat(getComputedStyle(node).fontSize) >= 14));
          assert.ok(textSize, `${label}: readable text size`);
          {
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
