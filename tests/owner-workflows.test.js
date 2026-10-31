const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('../backend/node_modules/pg');
const pool = require('../backend/config/database.config');
const { migrate, seedFresh } = require('../database/migrate');
const { deliverEmails } = require('../backend/jobs/email-notification.job');

test('card owners receive and manage leads without administrator intervention', async t => {
  assert.ok(['localhost','127.0.0.1','::1'].includes(pool.options.host));
  assert.notEqual(process.env.NODE_ENV, 'production');
  const schema = 'owner_test_' + crypto.randomBytes(8).toString('hex');
  const originalQuery = pool.query.bind(pool), originalConnect = pool.connect.bind(pool);
  const oldOrigin = process.env.PUBLIC_APP_URL;
  const db = new Pool({ ...pool.options, password: pool.options.password, options: `-c search_path=${schema}`, max: 8 });
  let server, browser;
  try {
    await originalQuery(`CREATE SCHEMA "${schema}"`);
    const client = await db.connect();
    try { await migrate(client); await seedFresh(client); } finally { client.release(); }
    pool.query = db.query.bind(db); pool.connect = db.connect.bind(db);
    const app = require('../backend/app');
    server = app.listen(0,'127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    process.env.PUBLIC_APP_URL = origin;
    async function request(path, method = 'GET', body, token) {
      const response = await fetch(origin + '/api' + path, { method,
        headers: { 'Content-Type':'application/json', ...(token ? { Authorization:'Bearer ' + token } : {}) },
        body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, body: await response.json() };
    }
    const password = 'Owner workflow password 123!';
    const register = async email => (await request('/auth/register','POST',{ firstName:'Card',lastName:'Owner',email,password })).body;
    const owner = await register('owner@example.test'), other = await register('other@example.test');
    await db.query(`UPDATE plans SET features=jsonb_set(features,'{vcardFeatures}', '["basic-details","appointments"]'::jsonb)`);
    const templateId = (await db.query("SELECT id FROM vcard_templates WHERE template_json->>'designKey'='corporate-classic'")).rows[0].id;
    const created = await request('/user/vcards','POST',{ title:'Owner Card',slug:'owner-test-card',templateId,
      email:'public-card-address@example.test',sections:{ appointments:'Consultation | 30' } },owner.token);
    assert.equal(created.status,201,JSON.stringify(created.body));
    const card = created.body.vcard, base = '/public/vcards/' + card.id;
    let captureId, enquiryId, appointmentId;

    await t.test('QR scans and consented saves queue only one owner email under concurrent retries', async () => {
      const scans = await Promise.all([1,2,3].map(() => request(base+'/events','POST',{ eventType:'qr_scan' })));
      assert.equal(scans.filter(r=>r.body.recorded).length,1);
      const details = { name:'Contact Visitor',email:'saved@example.test',phone:'+94112345678',company:'Visitor Co',consent:true };
      assert.equal((await request(base+'/contact-saves','POST',{...details,consent:false})).status,400);
      const saves = await Promise.all([1,2,3].map(() => request(base+'/contact-saves','POST',details)));
      for (const saved of saves) assert.equal(saved.status,201,JSON.stringify(saved.body));
      captureId = Number(new URL(saves[0].body.downloadUrl,origin).searchParams.get('capture'));
      const alerts = (await db.query('SELECT n.type,e.body FROM notifications n JOIN email_outbox e ON e.dedup_key=\'notification:\'||n.id::text WHERE n.user_id=$1',[owner.user.id])).rows;
      assert.equal(alerts.filter(r=>r.type==='contact').length,1);
      assert.match(alerts.find(r=>r.type==='contact').body,/saved@example.test[\s\S]*Visitor Co/);
      assert.match(alerts.find(r=>r.type==='qr_scan').body,/has not shared their identity/);
      const sent = [];
      await deliverEmails(db,async mail=>sent.push(mail));
      assert.equal(sent.length,4);
      assert.equal(sent.filter(mail=>mail.to==='owner@example.test').length,2);
      assert.equal(sent.filter(mail=>mail.to==='public-card-address@example.test').length,2);
      assert.ok(sent.some(mail=>mail.replyTo==='saved@example.test'));
    });

    await t.test('optional anonymous contact downloads notify the owner without inventing a visitor identity', async () => {
      await db.query("UPDATE vcards SET settings=jsonb_set(settings,'{contactCaptureRequired}','false'::jsonb) WHERE id=$1",[card.id]);
      const downloads=await Promise.all([1,2].map(()=>fetch(origin+'/api'+base+'/contact.vcf')));
      for(const response of downloads) {assert.equal(response.status,200);assert.match(await response.text(),/BEGIN:VCARD/);}
      const alerts=(await db.query("SELECT e.body FROM notifications n JOIN email_outbox e ON e.dedup_key='notification:'||n.id::text WHERE n.type='contact_download'")).rows;
      assert.equal(alerts.length,1);assert.match(alerts[0].body,/did not share their identity/);
      await deliverEmails(db,async mail=>assert.ok([owner.user.email,'public-card-address@example.test'].includes(mail.to)));
      await db.query("UPDATE vcards SET settings=jsonb_set(settings,'{contactCaptureRequired}','true'::jsonb) WHERE id=$1",[card.id]);
    });
    await t.test('lead creation rolls back if its dashboard notification cannot be saved', async () => {
      const connect=pool.connect;
      pool.connect=async()=>{
        const client=await db.connect();
        return {release:()=>client.release(),query:(sql,params)=>/INSERT INTO notifications/i.test(sql)
          ? Promise.reject(Object.assign(new Error('Injected notification failure'),{code:'TESTFAIL'})) : client.query(sql,params)};
      };
      try {
        const result=await request(base+'/enquiries','POST',{name:'Rollback visitor',email:'rollback@example.test',message:'This request must roll back.'});
        assert.equal(result.status,500);
        assert.equal((await db.query("SELECT id FROM contacts WHERE email='rollback@example.test'")).rowCount,0);
      } finally {pool.connect=connect;}
    });
    await t.test('enquiries stay with their owner, retry email failures and support idempotent dashboard replies', async () => {
      const submitted = await request(base+'/enquiries','POST',{name:'Enquiry Visitor',email:'question@example.test',message:'Can we discuss your services?'});
      assert.equal(submitted.status,201);
      enquiryId = (await db.query("SELECT id FROM contacts WHERE source='Public VCard enquiry' ORDER BY id DESC LIMIT 1")).rows[0].id;
      const listed = await request('/user/enquiries','GET',null,owner.token);
      assert.ok(listed.body.enquiries.some(row=>row.id===enquiryId));
      assert.equal((await request('/user/enquiries','GET',null,other.token)).body.enquiries.length,0);
      for (const [method,suffix,body] of [['GET','',null],['PATCH','',{status:'closed'}],['POST','/replies',{message:'Unauthorized',requestKey:crypto.randomUUID()}]]) {
        assert.equal((await request('/user/enquiries/'+enquiryId+suffix,method,body,other.token)).status,404);
      }
      await deliverEmails(db,async()=>{throw Object.assign(new Error('private SMTP details'),{code:'ETIMEDOUT'});});
      const failed = (await db.query("SELECT * FROM email_outbox WHERE subject='New VCard enquiry'")).rows[0];
      assert.equal(failed.status,'pending'); assert.equal(failed.last_error,'ETIMEDOUT');
      await db.query("UPDATE email_outbox SET available_at=NOW() WHERE subject='New VCard enquiry'");
      const sent=[]; await deliverEmails(db,async mail=>sent.push(mail));
      assert.deepEqual(sent.map(mail=>mail.to).sort(),[owner.user.email,'public-card-address@example.test'].sort()); assert.equal(sent[0].to,owner.user.email); assert.equal(sent[0].replyTo,'question@example.test');
      assert.match(sent[0].text,/Can we discuss[\s\S]*enquiries.html\?contact=/);
      const key=crypto.randomUUID(), reply={message:'Thank you. Yes, let us arrange a call.',requestKey:key};
      const replies=await Promise.all([1,2].map(()=>request('/user/enquiries/'+enquiryId+'/replies','POST',reply,owner.token)));
      assert.deepEqual(replies.map(r=>r.status).sort(),[200,201]);
      assert.equal((await db.query('SELECT id FROM contact_replies')).rowCount,1);
      assert.equal((await request('/user/enquiries/'+enquiryId+'/replies','POST',{...reply,message:'Changed reply'},owner.token)).status,409);
      assert.equal((await request('/user/enquiries/'+captureId+'/replies','POST',reply,owner.token)).status,409);
      const thread=await request('/user/enquiries/'+enquiryId,'GET',null,owner.token);
      assert.equal(thread.body.replies.length,1); assert.equal(thread.body.replies[0].email_status,'pending');
      assert.equal(thread.body.enquiry.enquiry_status,'replied');
      await db.query('UPDATE user_settings SET email_notifications=FALSE WHERE user_id=$1',[owner.user.id]);
      const customer=[]; await deliverEmails(db,async mail=>customer.push(mail));
      assert.equal(customer.length,1); assert.equal(customer[0].to,'question@example.test');
      assert.equal(customer[0].replyTo,owner.user.email);
      assert.equal((await request('/user/enquiries/'+enquiryId,'PATCH',{status:'closed',read:true},owner.token)).status,200);
      await db.query('UPDATE user_settings SET email_notifications=TRUE WHERE user_id=$1',[owner.user.id]);
    });

    await t.test('owners approve or reject bookings while email retries cannot undo or duplicate decisions', async () => {
      const body={ name:'Booking Visitor',email:'booking@example.test',serviceName:'Consultation',appointmentType:'online',startsAt:new Date(Date.now()+86400000).toISOString() };
      const booked=await request(base+'/appointments','POST',body);
      assert.equal(booked.status,201,JSON.stringify(booked.body)); appointmentId=booked.body.appointment.id;
      const route='/user/appointments/'+appointmentId+'/status';
      assert.equal((await request(route,'PATCH',{status:'approved'},other.token)).status,404);
      const updates=await Promise.all([1,2].map(()=>request(route,'PATCH',{status:'approved',note:'Meeting link: https://example.test/meeting'},owner.token)));
      assert.ok(updates.every(r=>r.status===200));
      assert.equal((await db.query('SELECT id FROM email_outbox WHERE dedup_key=$1',['appointment-decision:'+appointmentId])).rowCount,1);
      await deliverEmails(db,async()=>{throw Object.assign(new Error('SMTP unavailable'),{code:'ECONNECTION'});});
      assert.equal((await db.query('SELECT status FROM appointments WHERE id=$1',[appointmentId])).rows[0].status,'approved');
      await db.query("UPDATE email_outbox SET available_at=NOW() WHERE status='pending'");
      const sent=[];await deliverEmails(db,async mail=>sent.push(mail));
      const confirmation=sent.find(mail=>mail.to==='booking@example.test');
      assert.match(confirmation.text,/https:\/\/example.test\/meeting/);assert.equal(confirmation.replyTo,owner.user.email);
      assert.ok(sent.some(mail=>mail.to===owner.user.email && /New appointment request/.test(mail.subject)));
      const later={...body,startsAt:new Date(Date.now()+172800000).toISOString()};
      const second=await request(base+'/appointments','POST',later);
      assert.equal((await request('/user/appointments/'+second.body.appointment.id+'/status','PATCH',{status:'rejected',note:'Please choose another day.'},owner.token)).status,200);
      assert.equal((await request(base+'/appointments','POST',later)).status,201);
      const rejection=(await db.query('SELECT * FROM email_outbox WHERE dedup_key=$1',['appointment-decision:'+second.body.appointment.id])).rows[0];
      assert.equal(rejection.recipient_email,body.email);assert.match(rejection.body,/Please choose another day/);
      const dashboard=(await request('/user/dashboard','GET',null,owner.token)).body;
      assert.equal(dashboard.metrics.pendingAppointments,1);
      assert.ok(dashboard.notifications.some(n=>n.metadata?.appointmentId));
    });

    if(process.argv.includes('--browser')) await t.test('owner browser can reply, filter leads and approve appointments in its own dashboard', async () => {
      const {chromium}=require('../backend/node_modules/playwright');
      browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
      const context=await browser.newContext({viewport:{width:390,height:900}});
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      const page=await context.newPage(), errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(/Content Security Policy|Refused to/.test(message.text()))errors.push(message.text());});
      page.on('response',response=>{if(response.url().startsWith(origin) && response.status()>=400)errors.push(response.status()+' '+response.url());});
      await page.goto(origin+'/pages/auth/login.html');
      await page.fill('#loginEmail',owner.user.email);await page.fill('#passwordInput',password);
      await Promise.all([page.waitForURL('**/user/dashboard.html'),page.locator('#loginForm button[type=submit]').click()]);
      await page.goto(origin+'/pages/user/enquiries.html?contact='+enquiryId);
      await page.locator('#enquiryDialogTitle').filter({hasText:'Enquiry Visitor'}).waitFor();
      await page.screenshot({path:'test-results/owner-enquiry-mobile.png'});
      await page.locator('#enquiryReplyMessage').fill('A follow-up from the dashboard.');
      await page.locator('#enquiryReplyForm button[type=submit]').click();
      await page.locator('#enquiryReplyHistory').getByText('A follow-up from the dashboard.').waitFor();
      await page.locator('#enquiryDialog [data-close-owner-dialog]').click();
      await page.selectOption('#leadKindFilter','contact');
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('.enquiry-row')).filter(r=>!r.hidden).every(r=>r.dataset.leadKind==='contact'));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
      await page.setViewportSize({width:1440,height:900});
      await page.screenshot({path:'test-results/owner-inbox-desktop.png'});
      const pending=(await db.query("SELECT id FROM appointments WHERE user_id=$1 AND status='pending' LIMIT 1",[owner.user.id])).rows[0];
      await page.goto(origin+'/pages/user/appointments.html?appointment='+pending.id);
      await page.setViewportSize({width:390,height:900});
      await page.locator('#appointmentDecisionForm:visible').waitFor();
      await page.locator('#appointmentDecisionNote').fill('Please join using the link in my reply.');
      await page.locator('#appointmentDecisionSubmit').click();
      await page.locator('#appointmentDecisionDialog').waitFor({state:'hidden'});
      assert.equal((await db.query('SELECT status FROM appointments WHERE id=$1',[pending.id])).rows[0].status,'approved');
      await page.locator('[data-appointment-id="'+pending.id+'"]').filter({hasText:'View details'}).click();
      await page.locator('#appointmentDecisionTitle').filter({hasText:'Appointment approved'}).waitFor();
      assert.equal(await page.locator('#appointmentDecisionForm').isVisible(),false);
      await page.screenshot({path:'test-results/owner-appointment-mobile.png'});
      assert.deepEqual(errors,[]);
      await context.close();
    });
  } finally {
    if(browser) await browser.close();
    if(server) await new Promise(resolve=>server.close(resolve));
    pool.query=originalQuery;pool.connect=originalConnect;
    if(oldOrigin===undefined)delete process.env.PUBLIC_APP_URL;else process.env.PUBLIC_APP_URL=oldOrigin;
    await db.end();await originalQuery(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();
  }
});
