const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const express=require('express'),{chromium}=require('playwright');
test('SysCare Classic carousels work at desktop/mobile widths and render only supplied live content',async()=>{
 const app=express();app.use(express.static('frontend'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const origin='http://127.0.0.1:'+server.address().port;let live={title:'Live Owner',sections:{services:'Service one | Details\nService two | More details',blogs:'Article one | First article | https://example.com/one\nArticle two | Second article | https://example.com/two'}};
 await page.route('**/*',r=>{const url=new URL(r.request().url());if(url.origin!==origin)return r.abort();if(url.pathname.includes('/api/public/qrcode'))return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});if(url.pathname.startsWith('/api/'))return r.fulfill({json:{vcard:live}});return r.continue();});
 const path='/pages/public-vcard/final-21-syscare-classic.html';
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});await page.goto(origin+path,{waitUntil:'networkidle'});assert.equal(await page.locator('.syscare-carousel').count(),5);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow at '+width);
  assert.equal(await page.locator('[data-final-vcard]').evaluate(el=>getComputedStyle(el).getPropertyValue('--vc-accent').trim()),'#8ad4ff');
  for(const name of ['services','products','gallery','testimonials','blogs']){
   const next=page.getByRole('button',{name:'Next '+name,exact:true});await next.click();
   await page.waitForFunction(name=>{const button=Array.from(document.querySelectorAll('button')).find(el=>el.getAttribute('aria-label')==='Next '+name);return button.parentElement.querySelector('span').textContent.startsWith('2 /');},name);
   await page.getByRole('button',{name:'Previous '+name,exact:true}).click();
  }
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/syscare-classic-'+width+'.png',fullPage:true});
 }
 await page.goto(origin+path+'?id=123',{waitUntil:'networkidle'});assert.equal(await page.locator('h1').textContent(),'Live Owner');assert.equal(await page.locator('.syscare-carousel').count(),2);assert.equal(await page.locator('.final-quote').count(),0);assert.equal(await page.locator('.syscare-blog-track a').first().getAttribute('href'),'https://example.com/one');
 const track=page.getByRole('region',{name:'Services',exact:true});await track.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#syscare-carousel-0').scrollLeft>0);
 live={title:'Single service',sections:{services:'Only service | Detail'}};await page.goto(origin+path+'?id=124',{waitUntil:'networkidle'});assert.equal(await page.locator('.syscare-carousel.is-single').count(),1);assert.equal(await page.locator('.syscare-carousel-controls').count(),0);
 assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
