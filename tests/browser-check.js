const fs = require('fs');
const path = require('path');
const { chromium } = require('../backend/node_modules/playwright');
const app = require('../backend/app');
const pool = require('../backend/config/database.config');
(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  const problems = [];
  const output = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      let route = '';
      page.on('pageerror', error => problems.push(`${width} ${route}: ${error.message}`));
      page.on('console', message => {
        if (message.type() === 'error' && /Content Security Policy|Refused to/.test(message.text())) problems.push(`${width} ${route}: ${message.text().slice(0,250)}`);
      });
      page.on('response', response => {
        if (response.url().startsWith(origin + '/') && response.status() >= 400) problems.push(`${width} ${route}: HTTP ${response.status()} ${new URL(response.url()).pathname}`);
      });
      for (route of ['website/home', 'website/pricing', 'website/templates', 'website/nfc-cards', 'auth/login', 'auth/register', 'public-vcard/final-10-corporate']) {
        await page.goto(`${origin}/pages/${route}.html`, { waitUntil: 'networkidle', timeout: 45000 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
        if (overflow) problems.push(`${width} ${route}: horizontal page overflow`);
        await page.screenshot({ path: path.join(output, `${route.replace('/', '-')}-${width}.png`) });
        console.log(`Checked ${width}px ${route}`);
      }
      await context.close();
    }
    console.log(JSON.stringify({ problems }, null, 2));
    process.exitCode = problems.length ? 1 : 0;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
