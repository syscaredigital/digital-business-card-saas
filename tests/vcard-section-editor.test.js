const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('../backend/node_modules/playwright');
const { VCARD_FEATURES } = require('../backend/config/vcard-features');

test('create and edit cards through section forms, retaining hidden drafts and showing only plan features', async () => {
  const app=express();app.use(express.static(path.join(__dirname,'../frontend')));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  let browser;
  try {
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],alerts=[];
    page.setDefaultTimeout(15000);
    await page.addInitScript(()=>localStorage.setItem('sessionActive','true'));
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>{alerts.push(dialog.message());return dialog.accept();});
    let features=VCARD_FEATURES, payload, stored={title:'Avery',sections:{},hiddenSections:[]};
    const entitlements=()=>({planName:'Business',vcardLimit:3,features,templates:[{id:12,name:'Corporate Classic'}]});
    await page.route('**/*',route=>{
      const url=new URL(route.request().url()),method=route.request().method();
      if(url.origin!==origin)return route.abort();
      if(url.pathname==='/api/public/qrcode')return route.fulfill({contentType:'image/svg+xml',body:require('../backend/services/vcard-qr.service').renderQr(url.searchParams.get('data'),Object.fromEntries(url.searchParams))});
      if(url.pathname==='/api/user/dashboard')return route.fulfill({json:{user:{name:'Avery'},subscription:{name:'Business',vcardLimit:3},metrics:{totalCards:0},vcards:[],vcardEntitlements:entitlements()}});
      if(url.pathname==='/api/user/vcards'&&method==='POST'){payload=route.request().postDataJSON();stored=payload;return route.fulfill({json:{vcard:{id:123}}});}
      if(url.pathname==='/api/user/vcards/123'){
        if(method==='PATCH'){payload=route.request().postDataJSON();stored=payload;return route.fulfill({json:{message:'Saved'}});}
        return route.fulfill({json:{vcard:{title:stored.title,template_id:12,is_active:true,settings:{sections:stored.sections,hiddenSections:stored.hiddenSections}},entitlements:entitlements()}});
      }
      if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});
      return route.continue();
    });
    await page.goto(origin+'/pages/user/vcards.html',{waitUntil:'domcontentloaded'});
    await page.locator('[data-vcard-tab-target=newVcardPanel]').first().click();
    const builder=page.locator('#createVcardFeatureEditor');
    await builder.getByRole('tab').first().waitFor();
    assert.equal(await builder.getByRole('tab').count(),VCARD_FEATURES.length-1);
    assert.equal(await builder.locator('textarea[data-create-vcard-section]').count(),0);
    await page.fill('#vcardName','Avery Consulting');
    await page.fill('#occupation','Consultant');
    async function open(key){await builder.locator('[role=tab][aria-controls$="-panel-'+key+'"]').click();return builder.locator('[role=tabpanel]:visible');}
    async function enable(key){const panel=await open(key);await panel.getByRole('switch').first().check();return panel;}
    const rows={services:{'Service name':'Strategy','Description':'Business planning'},products:{'Product name':'Support package','Price':'LKR 12000','Description':'Annual support'},
      galleries:{Caption:'Our studio'},'instagram-embed':{Caption:'Behind the scenes'},blogs:{'Article title':'Getting started',Summary:'Useful advice','Article link':'https://example.test/article'},
      testimonials:{Review:'Helpful and professional','Customer name':'Jamie','Customer role':'Founder'},appointments:{'Service name':'Consultation','Duration in minutes':'5'},
      'social-links':{Network:'LinkedIn','Profile link':'https://linkedin.com/in/avery'},'custom-links':{'Link label':'Portfolio','Website address':'https://example.test'},
      iframes:{Title:'Introduction','Content link':'https://example.test/video'},banners:{'Banner title':'Summer offer'},advanced:{Detail:'Languages: English'},'manage-section':{'Additional information':'Visits by appointment'}};
    for(const[key,values]of Object.entries(rows)){const panel=await enable(key);for(const[label,value]of Object.entries(values))await panel.getByLabel(label,{exact:true}).fill(value);}
    let panel=await enable('business-hours');
    await panel.getByLabel('Opens',{exact:true}).first().fill('10:00');
    await panel.getByLabel('Closes',{exact:true}).first().fill('18:00');
    panel=await enable('seo');await panel.getByLabel('Page title',{exact:true}).fill('Avery Consulting');await panel.getByLabel('Search description',{exact:true}).fill('Practical business support');
    panel=await enable('custom-fonts');await panel.getByLabel('Card font').selectOption('Georgia');
    panel=await enable('qrcode-customize');
    assert.equal(await panel.getByLabel('Website or QR image address').count(),0);
    await panel.getByLabel('Image size').selectOption('768');
    await panel.getByLabel('Module style').selectOption('rounded');
    await panel.getByLabel('QR color',{exact:true}).fill('#243b80');
    await panel.getByLabel('Background color',{exact:true}).fill('#f4f7ff');
    await page.waitForFunction(()=>{const image=document.querySelector('.section-editor-qr-preview');return image&&image.complete&&image.naturalWidth===768&&image.src.includes('background=%23f4f7ff');});
    for(const key of ['privacy-policy','term-condition']){panel=await enable(key);await panel.locator('textarea').fill('Clear terms for our visitors.\nContact us with questions.');}
    // An invalid field on another tab must take the user to that section.
    await builder.getByRole('tab').first().focus();await page.keyboard.press('End');
    assert.equal(await builder.getByRole('tab',{selected:true}).getAttribute('aria-controls'),'createVcardFeatureEditor-panel-manage-section');
    // Validate before creating; no malformed booking duration reaches the API.
    await page.locator('#newVcardPanel button[type=submit]').click();
    assert.ok(alerts.some(text=>/15 and 480/.test(text)));assert.equal(payload,undefined);
    panel=await open('appointments');await panel.getByLabel('Duration in minutes').fill('45');
    panel=await open('products');await panel.getByRole('switch').first().uncheck();
    fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
    await page.setViewportSize({width:390,height:900});panel=await open('services');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await builder.screenshot({path:path.join(__dirname,'../test-results/section-builder-mobile.png')});
    await Promise.all([page.waitForURL('**/edit-vcard.html?id=123'),page.locator('#newVcardPanel button[type=submit]').click()]);
    assert.equal(payload.sections.services,'Strategy | Business planning');
    assert.equal(payload.sections.appointments,'Consultation | 45');
    assert.match(payload.sections['business-hours'],/^Monday \| 10:00 - 18:00/);
    assert.equal(payload.sections['custom-fonts'],'Georgia');
    assert.deepEqual(JSON.parse(payload.sections['qrcode-customize']),{size:768,foreground:'#243b80',background:'#f4f7ff',style:'rounded'});
    assert.ok(payload.hiddenSections.includes('products'));assert.match(payload.sections.products,/Support package/);
    const edit=page.locator('#vcardFeatureEditor');await edit.getByRole('tab').first().waitFor();
    await edit.locator('[role=tab][aria-controls$="-panel-qrcode-customize"]').click();
    assert.equal(await edit.getByLabel('Image size').inputValue(),'768');
    assert.equal(await edit.getByLabel('Module style').inputValue(),'rounded');
    assert.equal(await edit.getByLabel('QR color',{exact:true}).inputValue(),'#243b80');
    await edit.locator('[role=tab][aria-controls$="-panel-products"]').click();
    let editPanel=edit.locator('[role=tabpanel]:visible');
    assert.equal(await editPanel.getByRole('switch').first().isChecked(),false);
    await editPanel.getByRole('switch').first().check();assert.equal(await editPanel.getByLabel('Product name').inputValue(),'Support package');
    await page.locator('#userVcardEditor button[type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#vcardEditorStatus').textContent==='Saved successfully');
    assert.ok(!payload.hiddenSections.includes('products'));
    await page.setViewportSize({width:1440,height:1000});await edit.screenshot({path:path.join(__dirname,'../test-results/section-builder-desktop.png')});
    // Removing advanced features from the package removes their tabs and controls.
    features=VCARD_FEATURES.filter(f=>['basic-details','services'].includes(f.key));
    await page.reload({waitUntil:'domcontentloaded'});await edit.getByRole('tab').first().waitFor();
    assert.equal(await edit.getByRole('tab').count(),1);
    assert.equal(await edit.locator('[aria-controls$="-panel-advanced"]').count(),0);
    assert.equal(await edit.locator('[aria-controls$="-panel-seo"]').count(),0);
    assert.equal(await edit.getByLabel('Product name').count(),0);
    features=VCARD_FEATURES.filter(f=>f.key==='basic-details');
    await page.reload({waitUntil:'domcontentloaded'});await edit.getByText('Your plan includes profile and contact details.',{exact:false}).waitFor();
    assert.equal(await edit.getByRole('tab').count(),0);
    assert.deepEqual(errors,[]);
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
