const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto');
const {Pool}=require('../backend/node_modules/pg');
const pool=require('../backend/config/database.config');
const {migrate,seedFresh}=require('../database/migrate');
test('production release: editable URLs, companies and consented newsletter',async t=>{
  assert.ok(['localhost','127.0.0.1','::1'].includes(pool.options.host));assert.notEqual(process.env.NODE_ENV,'production');
  const schema='release_test_'+crypto.randomBytes(8).toString('hex'),query=pool.query.bind(pool),connect=pool.connect.bind(pool);
  const db=new Pool({...pool.options,password:pool.options.password,options:`-c search_path=${schema}`,max:5});
  const oldOrigin=process.env.PUBLIC_APP_URL;let server,browser;
  try{
    await query(`CREATE SCHEMA "${schema}"`);const client=await db.connect();try{await migrate(client);await seedFresh(client);}finally{client.release();}
    pool.query=db.query.bind(db);pool.connect=db.connect.bind(db);
    server=require('../backend/app').listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;process.env.PUBLIC_APP_URL=origin;
    async function request(route,method='GET',body,token){const response=await fetch(origin+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return{status:response.status,body:await response.json().catch(()=>({}))};}
    const password='Strong release password 123!';
    async function register(email){const r=await request('/auth/register','POST',{firstName:'Release',lastName:'User',email,password});assert.equal(r.status,201,JSON.stringify(r.body));return r.body;}
    async function login(email){const r=await request('/auth/login','POST',{email,password});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
    const admin=await register('release-root@example.test'),owner=await register('owner-one@example.test'),other=await register('owner-two@example.test');
    await db.query("UPDATE users SET role_id=(SELECT id FROM roles WHERE name='super_admin') WHERE id=$1",[admin.user.id]);
    const templateId=(await db.query('SELECT id FROM vcard_templates WHERE is_public=TRUE ORDER BY id LIMIT 1')).rows[0].id;
    let card,ownerToken,otherToken,employeeId,companyId;
    await t.test('URL rename redirects old QR links, rejects collisions and cannot be hijacked',async()=>{
      const made=await request('/user/vcards','POST',{title:'Editable URL',slug:'original-name',templateId,sections:{}},owner.token);assert.equal(made.status,201,JSON.stringify(made.body));card=made.body.vcard;
      const change=await request('/user/vcards/'+card.id,'PATCH',{title:'Editable URL',slug:'updated-name',templateId,sections:{}},owner.token);assert.equal(change.status,200,JSON.stringify(change.body));
      const old=await fetch(origin+'/vcard/original-name?source=qr',{redirect:'manual'});assert.equal(old.status,302);assert.equal(old.headers.get('location'),'/vcard/updated-name?source=qr');
      assert.equal((await fetch(origin+'/vcard/updated-name')).status,200);
      assert.equal((await request('/user/vcards','POST',{title:'Hijack',slug:'original-name',templateId,sections:{}},other.token)).status,409);
      assert.equal((await request('/user/vcards/'+card.id,'PATCH',{title:'Forbidden',slug:'stolen-name',templateId,sections:{}},other.token)).status,404);
      assert.equal((await request('/user/vcards/'+card.id,'PATCH',{title:'Blank URL',slug:'',templateId,sections:{}},owner.token)).status,400);
      const reverted=await request('/user/vcards/'+card.id,'PATCH',{title:'Editable URL',slug:'original-name',templateId,sections:{}},owner.token);assert.equal(reverted.status,200);
      assert.equal((await fetch(origin+'/vcard/updated-name',{redirect:'manual'})).status,302);
      const qr=await fetch(origin+'/api/public/vcards/'+card.id+'/qrcode');assert.match(qr.headers.get('x-vcard-url'),/\/vcard\/original-name\?source=qr$/);
    });
    await t.test('super admin provisions company administrators and ordinary users cannot access company reports',async()=>{
      const first=await request('/super-admin/companies','POST',{name:'First Company',adminId:owner.user.id,employeeLimit:1},admin.token);assert.equal(first.status,201,JSON.stringify(first.body));companyId=first.body.id;
      const second=await request('/super-admin/companies','POST',{name:'Second Company',adminId:other.user.id,employeeLimit:2},admin.token);assert.equal(second.status,201);
      assert.equal((await request('/company-admin','GET',null,owner.token)).status,401);
      ownerToken=(await login('owner-one@example.test')).token;otherToken=(await login('owner-two@example.test')).token;
      const workspace=await request('/company-admin','GET',null,ownerToken);assert.equal(workspace.status,200);assert.equal(workspace.body.company.name,'First Company');assert.equal(workspace.body.cards.length,1);
      assert.equal((await request('/company-admin','GET',null,admin.token)).status,403);
    });
    await t.test('employee invitation, seat limit, cross-company isolation and delegated card editing',async()=>{
      const invitation=await request('/company-admin/employees','POST',{name:'Employee One',email:'employee@example.test'},ownerToken);assert.equal(invitation.status,201,JSON.stringify(invitation.body));employeeId=invitation.body.id;
      assert.equal((await request('/company-admin/employees','POST',{name:'Over Limit',email:'limit@example.test'},ownerToken)).status,409);
      const invite=(await db.query("SELECT body FROM email_outbox WHERE dedup_key=$1",['company-invite:'+employeeId])).rows[0];
      const token=invite.body.match(/#token=([a-f0-9]{64})/)[1];
      assert.equal((await request('/auth/reset-password','POST',{token,password})).status,200);
      const employee=await login('employee@example.test');assert.equal((await request('/company-admin','GET',null,employee.token)).status,403);
      assert.equal((await request('/user/vcards?companyMember='+employeeId,'POST',{title:'Company Employee',slug:'employee-card',templateId,sections:{}},otherToken)).status,404);
      const created=await request('/user/vcards?companyMember='+employeeId,'POST',{title:'Company Employee',slug:'employee-card',templateId,sections:{}},ownerToken);assert.equal(created.status,201,JSON.stringify(created.body));
      assert.equal((await request('/user/vcards/'+created.body.vcard.id+'?companyMember='+employeeId,'GET',null,otherToken)).status,404);
      assert.equal((await request('/user/plans?companyMember='+employeeId,'GET',null,ownerToken)).status,403);
      const disabled=await request('/company-admin/employees/'+employeeId,'PATCH',{status:'inactive'},ownerToken);assert.equal(disabled.status,200);
      assert.equal((await request('/user/dashboard','GET',null,employee.token)).status,401);
      assert.equal((await fetch(origin+'/vcard/employee-card')).status,404);
    });
    let unsubscribeToken;
    await t.test('newsletter requires consent and double opt-in, suppresses duplicates and hides subscriber data',async()=>{
      assert.equal((await request('/public/newsletter/subscribe','POST',{email:'reader@example.test',consent:false})).status,400);
      const payload={email:'reader@example.test',consent:true};assert.equal((await request('/public/newsletter/subscribe','POST',payload)).status,202);
      assert.equal((await request('/public/newsletter/subscribe','POST',payload)).status,202);
      const pending=(await db.query("SELECT * FROM newsletter_subscribers WHERE email='reader@example.test'")).rows[0];unsubscribeToken=pending.unsubscribe_token;
      assert.equal(pending.status,'pending');assert.equal((await db.query('SELECT COUNT(*)::int count FROM newsletter_deliveries')).rows[0].count,1);
      const messages=[];await require('../backend/jobs/newsletter.job').deliverNewsletter(db,async mail=>messages.push(mail));assert.equal(messages.length,1);
      const token=new URL(messages[0].text.match(/http[^\s]+/)[0]).searchParams.get('token');assert.notEqual(pending.confirmation_hash,token);
      assert.equal((await fetch(origin+'/api/public/newsletter/confirm?token='+token)).status,200);
      assert.equal((await request('/super-admin/newsletter','GET',null,ownerToken)).status,403);
      const list=await request('/super-admin/newsletter','GET',null,admin.token);assert.equal(list.body.subscribers[0].status,'subscribed');assert.equal(list.body.subscribers[0].unsubscribe_token,undefined);
    });
    await t.test('campaign retries are idempotent; unsubscribe cancels queued marketing and delivery failures retry',async()=>{
      const payload={subject:'Release news',body:'Hello confirmed readers',requestKey:crypto.randomUUID()};
      assert.equal((await request('/super-admin/newsletter/campaigns','POST',payload,admin.token)).status,202);
      await request('/super-admin/newsletter/campaigns','POST',payload,admin.token);
      assert.equal((await db.query("SELECT COUNT(*)::int count FROM newsletter_deliveries WHERE kind='campaign'")).rows[0].count,1);
      await require('../backend/jobs/newsletter.job').deliverNewsletter(db,async()=>{throw Object.assign(Error('provider secret'),{code:'ETIMEDOUT'});});
      assert.equal((await db.query("SELECT status,last_error FROM newsletter_deliveries WHERE kind='campaign'")).rows[0].last_error,'ETIMEDOUT');
      assert.equal((await fetch(origin+'/api/public/newsletter/unsubscribe?token='+unsubscribeToken)).status,200);
      await db.query("UPDATE newsletter_deliveries SET available_at=NOW() WHERE kind='campaign'");
      await require('../backend/jobs/newsletter.job').deliverNewsletter(db,async()=>assert.fail('Unsubscribed recipient received marketing'));
      assert.equal((await db.query("SELECT status FROM newsletter_deliveries WHERE kind='campaign'")).rows[0].status,'cancelled');
    });
    if(process.argv.includes('--browser'))await t.test('editable URL, company workspace and newsletter administration work in browser',async()=>{
      browser=await require('../backend/node_modules/playwright').chromium.launch({channel:'msedge',headless:true});
      const context=await browser.newContext({viewport:{width:390,height:900}});await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+'/pages/auth/login.html');await page.fill('#loginEmail','owner-one@example.test');await page.fill('#passwordInput',password);
      await Promise.all([page.waitForURL('**/company-admin/dashboard.html'),page.locator('#loginForm button[type=submit]').click()]);
      await page.getByRole('heading',{name:'First Company workspace'}).waitFor();
      await page.goto(origin+'/pages/user/edit-vcard.html?id='+card.id);await page.locator('#editCardSlug').filter({visible:true}).waitFor();
      await page.waitForFunction(()=>document.getElementById('editCardSlug').value==='original-name');
      await page.fill('#editCardSlug','browser-renamed');await page.locator('#userVcardEditor button[type=submit]').click();
      await page.waitForFunction(()=>document.getElementById('vcardEditorStatus').textContent.startsWith('Saved successfully'));
      await page.reload();await page.waitForFunction(()=>document.getElementById('editCardSlug').value==='browser-renamed');
      assert.equal((await fetch(origin+'/vcard/original-name',{redirect:'manual'})).headers.get('location'),'/vcard/browser-renamed');
      await page.locator('#editCardSlug').screenshot({path:'test-results/editable-vcard-url.png'});
      await context.clearCookies();await page.goto(origin+'/pages/auth/login.html');await page.fill('#loginEmail','release-root@example.test');await page.fill('#passwordInput',password);
      await Promise.all([page.waitForURL('**/super-admin/dashboard.html'),page.locator('#loginForm button[type=submit]').click()]);
      await page.goto(origin+'/pages/super-admin/newsletter.html');await page.getByRole('heading',{name:'Subscribers',exact:true}).waitFor();
      assert.equal(await page.getByText('reader@example.test',{exact:true}).count(),1);
      await page.screenshot({path:'test-results/newsletter-admin-mobile.png',fullPage:true});
      assert.deepEqual(errors,[]);await context.close();
    });
    await t.test('disabling a company revokes sessions and public cards without affecting another company',async()=>{
      assert.equal((await request('/super-admin/companies/'+companyId,'PATCH',{status:'inactive',employeeLimit:1},admin.token)).status,200);
      assert.equal((await request('/company-admin','GET',null,ownerToken)).status,401);
      assert.equal((await fetch(origin+'/vcard/original-name')).status,404);
      assert.equal((await request('/company-admin','GET',null,otherToken)).status,200);
    });
  }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));pool.query=query;pool.connect=connect;if(oldOrigin===undefined)delete process.env.PUBLIC_APP_URL;else process.env.PUBLIC_APP_URL=oldOrigin;await db.end();await query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();}
});
