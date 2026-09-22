const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('../backend/node_modules/sharp');
const { PDFDocument, PDFName } = require('../backend/node_modules/pdf-lib');
const { validateReceipt } = require('../backend/middlewares/payment-slip-upload.middleware');
const pool = require('../backend/config/database.config');
const { Pool } = require('../backend/node_modules/pg');
const { migrate, seedFresh } = require('../database/migrate');

test('receipt parsers reject spoofed, corrupt, mismatched and active content', async () => {
  for (const format of ['png','jpeg','webp']) {
    const input = await sharp({create:{width:3,height:3,channels:3,background:'white'}}).toFormat(format).toBuffer();
    const clean = await validateReceipt(input,'image/'+format);
    assert.equal((await sharp(clean).metadata()).format,format);
    await assert.rejects(validateReceipt(input,'application/pdf'));
    await assert.rejects(validateReceipt(input.subarray(0,16),'image/'+format));
  }
  for (const mime of ['image/png','image/jpeg','image/webp','application/pdf']) {
    await assert.rejects(validateReceipt(Buffer.from('<script>alert(1)</script>'),mime));
    await assert.rejects(validateReceipt(Buffer.alloc(5*1024*1024+1),mime));
  }
  const pdf = await PDFDocument.create(); pdf.addPage();
  assert.ok((await validateReceipt(Buffer.from(await pdf.save()),'application/pdf')).length);
  pdf.catalog.set(PDFName.of('OpenAction'),pdf.context.obj({S:'JavaScript',JS:'app.alert(1)'}));
  await assert.rejects(validateReceipt(Buffer.from(await pdf.save()),'application/pdf'));
  await assert.rejects(validateReceipt(Buffer.from('%PDF-1.7\nnot a document\n%%EOF'),'application/pdf'));
});

test('audit regressions against an isolated PostgreSQL schema', async t => {
  const schema = 'audit_test_'+crypto.randomBytes(8).toString('hex');
  const query = pool.query.bind(pool), connect = pool.connect.bind(pool);
  const db = new Pool({...pool.options,password:pool.options.password,options:`-c search_path=${schema}`,max:8});
  const oldSecret = process.env.JWT_SECRET;
  let server;
  try {
    await query(`CREATE SCHEMA "${schema}"`);
    const client = await db.connect();
    try { await migrate(client); await seedFresh(client); }
    finally { client.release(); }
    pool.query = db.query.bind(db); pool.connect = db.connect.bind(db);
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    const app = require('../backend/app');
    server = app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function request(route,{method='GET',body,token,headers={}}={}) {
      const res = await fetch(origin+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});
      return {status:res.status,body:await res.json(),headers:res.headers};
    }
    const registration = await request('/api/auth/register',{method:'POST',body:{firstName:'Audit',lastName:'User',email:'audit@example.test',password:'Original password 123!'}});
    assert.equal(registration.status,201);
    const {user,token} = registration.body;
    const second = await request('/api/auth/register',{method:'POST',body:{firstName:'Other',lastName:'User',email:'other@example.test',password:'Original password 123!'}});
    assert.equal(second.status,201);

    await t.test('unknown, expired and legacy session identities fail closed',async()=>{
      const jwt = require('../backend/node_modules/jsonwebtoken');
      const forge = payload=>jwt.sign(payload,process.env.JWT_SECRET,{expiresIn:'1h'});
      for(const payload of [{id:user.id,version:0,jti:crypto.randomUUID()},{id:999999999999,email:user.email,version:0,jti:crypto.randomUUID()}]) {
        assert.equal((await request('/api/user/dashboard',{token:forge(payload)})).status,401);
      }
      await db.query("UPDATE auth_sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",[second.body.user.id]);
      assert.equal((await request('/api/user/dashboard',{token:second.body.token})).status,401);
      await db.query("UPDATE auth_sessions SET expires_at=NOW()+INTERVAL '1 day' WHERE user_id=$1",[second.body.user.id]);
    });
    await t.test('concurrent card creation cannot exceed the free plan',async()=>{
      const results = await Promise.all([1,2,3].map(i=>request('/api/user/vcards',{method:'POST',token,body:{title:'Concurrent '+i,templateId:1,slug:'audit-card-'+i,sections:{}}})));
      assert.deepEqual(results.map(r=>r.status).sort(),[201,403,403]);
      const id = results.find(r=>r.status===201).body.vcard.id;
      assert.equal((await request('/api/user/vcards/'+id,{token:second.body.token})).status,404);
    });
    await t.test('browser sessions are HttpOnly and writes require a trusted origin',async()=>{
      const headers = {'X-Session-Mode':'cookie','X-Requested-With':'SyncECard',Origin:origin};
      const login = await request('/api/auth/login',{method:'POST',body:{email:user.email,password:'Original password 123!'},headers});
      assert.equal(login.status,200);
      assert.equal(login.body.token,undefined);
      assert.equal(login.body.authenticated,true);
      assert.match(login.headers.get('set-cookie'),/HttpOnly/i);
      assert.match(login.headers.get('set-cookie'),/SameSite=Lax/i);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      assert.equal((await request('/api/user/dashboard',{headers:{Cookie:cookie}})).status,200);
      assert.equal((await request('/api/auth/logout',{method:'POST',headers:{Cookie:cookie}})).status,403);
      assert.equal((await request('/api/auth/logout',{method:'POST',headers:{...headers,Origin:'https://attacker.test',Cookie:cookie}})).status,403);
      assert.equal((await request('/api/auth/logout',{method:'POST',headers:{...headers,Cookie:cookie}})).status,200);
      assert.equal((await request('/api/user/dashboard',{headers:{Cookie:cookie}})).status,401);
    });
    if (process.env.RUN_BROWSER_TESTS === 'true') await t.test('real browser login uses cookies without storing a bearer token',async()=>{
      const {chromium}=require('../backend/node_modules/playwright');
      const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
      try {
        const context=await browser.newContext();
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        page.on('dialog',dialog=>dialog.dismiss());
        await page.goto(origin+'/pages/auth/login.html');
        await page.locator('#loginEmail').fill(user.email);
        await page.locator('#loginForm input[type="password"]').fill('Original password 123!');
        await Promise.all([page.waitForURL('**/user/dashboard.html'),page.locator('#loginForm button[type="submit"]').click()]);
        await page.waitForLoadState('networkidle');
        assert.equal(await page.evaluate(()=>localStorage.getItem('token')),null);
        assert.equal(await page.evaluate(()=>localStorage.getItem('sessionActive')),'true');
        assert.equal(await page.evaluate(()=>document.cookie.includes('sync_session')),false);
        assert.ok((await context.cookies()).some(cookie=>cookie.name==='sync_session' && cookie.httpOnly));
        const status=await page.evaluate(async()=> (await window.SyncSession.fetch(window.SyncVCardApiOrigin+'/api/user/dashboard')).status);
        assert.equal(status,200);
        await page.goto(origin+'/pages/user/settings.html');
        await page.waitForLoadState('networkidle');
        assert.deepEqual(errors,[]);
      } finally {await browser.close();}
    });
    await t.test('simultaneous appointment requests cannot reserve an overlapping time',async()=>{
      const card=(await db.query('SELECT id FROM vcards WHERE user_id=$1',[user.id])).rows[0];
      const body={name:'Appointment test',email:'booking@example.test',startsAt:new Date(Date.now()+86400000).toISOString(),appointmentType:'online',durationMinutes:30};
      const results=await Promise.all([1,2].map(()=>request('/api/public/vcards/'+card.id+'/appointments',{method:'POST',body})));
      assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
      const other=await request('/api/user/appointments',{token:second.body.token});
      assert.equal(other.status,200);
      assert.equal(JSON.stringify(other.body).includes('booking@example.test'),false);
    });
    await t.test('malicious upload is rejected and payment documents have no public route',async()=>{
      const form = new FormData();form.append('slip',new Blob(['<html>fake</html>'],{type:'image/png'}),'fake.png');
      const res = await fetch(origin+'/api/user/subscriptions/manual-payment',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});
      assert.equal(res.status,400);
      assert.equal((await fetch(origin+'/uploads/payment-slips/fake.png')).status,404);
      assert.equal((await fetch(origin+'/pages/company-admin/dashboard.html')).status,404);
    });
    await t.test('shared rate limits serialize concurrent attempts across instances',async()=>{
      const limiter = require('../backend/middlewares/rate-limit.middleware');
      const run = middleware=>new Promise((resolve,reject)=>middleware({ip:'192.0.2.1'},{set(){},status(code){this.code=code;return this;},json(){resolve(this.code);}},error=>error?reject(error):resolve(200)));
      const a=limiter({scope:'audit-shared',limit:3}),b=limiter({scope:'audit-shared',limit:3});
      const statuses=await Promise.all(Array.from({length:8},(_,i)=>run(i%2?a:b)));
      assert.equal(statuses.filter(s=>s===200).length,3);
      assert.equal(await run(limiter({scope:'audit-shared',limit:3})),429);
    });
    await t.test('concurrent withdrawals reserve balance only once; other users cannot download receipts',async()=>{
      const profile=(await db.query("INSERT INTO affiliate_profiles(user_id,referral_code,status,payout_details) VALUES($1,'AUDIT','active',$2::jsonb) RETURNING id",[user.id,JSON.stringify({accountHolder:'Test',bankName:'Test',accountNumber:'123'})])).rows[0];
      await db.query("INSERT INTO affiliate_commissions(affiliate_id,amount,currency,status) VALUES($1,100,'LKR','approved')",[profile.id]);
      const responses=await Promise.all([1,2].map(()=>request('/api/user/affiliations/withdrawals',{method:'POST',token,body:{amount:80,currency:'LKR'}})));
      assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
      const id=responses.find(r=>r.status===201).body.withdrawal.id;
      assert.equal((await request('/api/user/affiliations/withdrawals/'+id+'/receipt',{token:second.body.token})).status,404);
      await db.query("UPDATE withdrawals SET status='rejected' WHERE id=$1",[id]);
      assert.equal((await request('/api/user/affiliations/withdrawals',{method:'POST',token,body:{amount:80,currency:'LKR'}})).status,201);
    });
    await t.test('migration tampering is rejected and historical baselines require explicit review',async()=>{
      const client=await db.connect();
      try {
        const row=(await client.query('SELECT name,checksum FROM schema_migrations ORDER BY name LIMIT 1')).rows[0];
        await client.query("UPDATE schema_migrations SET checksum='invalid' WHERE name=$1",[row.name]);
        await assert.rejects(migrate(client),/checksum mismatch/);
        await client.query('UPDATE schema_migrations SET checksum=NULL WHERE name=$1',[row.name]);
        await assert.rejects(migrate(client),/baseline-checksums/);
        await migrate(client,{baseline:true});
        assert.equal((await client.query('SELECT checksum FROM schema_migrations WHERE name=$1',[row.name])).rows[0].checksum,row.checksum);
        await migrate(client,{verifyOnly:true});
      } finally {client.release();}
    });
    await t.test('email jobs deduplicate reminders, retry failure, respect opt-out and avoid double claims',async()=>{
      await db.query('DELETE FROM email_outbox');
      const plan=(await db.query("INSERT INTO plans(name,price,billing_interval,vcard_limit,status) VALUES('Reminder plan',100,'monthly',2,'active') RETURNING id")).rows[0];
      await db.query("INSERT INTO subscriptions(user_id,plan_id,status,start_date,end_date) VALUES($1,$2,'active',CURRENT_DATE,CURRENT_DATE+3)",[user.id,plan.id]);
      const {queueReminders}=require('../backend/jobs/payment-reminder.job');
      const {deliverEmails}=require('../backend/jobs/email-notification.job');
      const queued=await Promise.all([queueReminders(db),queueReminders(db)]);
      assert.equal(queued.reduce((a,b)=>a+b,0),1);
      await deliverEmails(db,async()=>{throw Object.assign(new Error('private provider details'),{code:'ETIMEDOUT'});});
      const row=(await db.query('SELECT * FROM email_outbox')).rows[0];
      assert.equal(row.status,'pending');assert.equal(row.attempts,1);assert.equal(row.last_error,'ETIMEDOUT');
      await db.query('UPDATE email_outbox SET available_at=NOW()');
      let sends=0;
      await Promise.all([deliverEmails(db,async()=>{sends++;}),deliverEmails(db,async()=>{sends++;})]);
      assert.equal(sends,1);
      await db.query("INSERT INTO email_outbox(user_id,dedup_key,subject,body) VALUES($1,'optout','Test','Test')",[user.id]);
      await db.query('INSERT INTO user_settings(user_id,email_notifications) VALUES($1,FALSE) ON CONFLICT(user_id) DO UPDATE SET email_notifications=FALSE',[user.id]);
      await deliverEmails(db,async()=>assert.fail('Opted-out user received email'));
      assert.equal((await db.query("SELECT status FROM email_outbox WHERE dedup_key='optout'")).rows[0].status,'cancelled');
    });
    await t.test('password change invalidates every session and reset link atomically',async()=>{
      const login=await request('/api/auth/login',{method:'POST',body:{email:user.email,password:'Original password 123!'}});
      await db.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[user.id,'a'.repeat(64)]);
      const changed=await request('/api/user/account-settings/password',{method:'PATCH',token,body:{currentPassword:'Original password 123!',newPassword:'Replacement password 456!'}});
      assert.equal(changed.status,200,JSON.stringify(changed.body));
      for(const old of [token,login.body.token]) assert.equal((await request('/api/user/dashboard',{token:old})).status,401);
      assert.equal((await db.query('SELECT auth_version FROM users WHERE id=$1',[user.id])).rows[0].auth_version,1);
      assert.equal((await db.query('SELECT token_hash FROM password_reset_tokens WHERE user_id=$1',[user.id])).rowCount,0);
      assert.equal((await request('/api/auth/login',{method:'POST',body:{email:user.email,password:'Replacement password 456!'}})).status,200);
    });
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    pool.query=query;pool.connect=connect;
    if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;
    await db.end();
    await query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  }
});
