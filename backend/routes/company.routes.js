const express=require('express'),crypto=require('crypto'),bcrypt=require('bcrypt');
const pool=require('../config/database.config');
const auth=require('../middlewares/auth.middleware'),authorize=require('../middlewares/role.middleware');
const {publicVcardUrl}=require('../helpers/vcard-url');
const router=express.Router(),adminRouter=express.Router();
const validId=value=>Number.isInteger(Number(value))&&Number(value)>0&&Number(value)<=2147483647;
router.use(auth,authorize('company_admin'),async(req,res,next)=>{
  try{const result=await pool.query("SELECT c.* FROM companies c JOIN users u ON u.company_id=c.id WHERE u.id=$1 AND c.status='active'",[req.user.id]);
    if(!result.rowCount)return res.status(403).json({message:'Your company workspace is unavailable.'});req.company=result.rows[0];next();
  }catch(e){next(e);}
});
router.get('/',async(req,res,next)=>{try{
  const [employees,cards,events,orders,payments]=await Promise.all([
    pool.query('SELECT u.id,u.name,u.email,u.status,r.name AS role FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.company_id=$1 ORDER BY u.name',[req.company.id]),
    pool.query('SELECT v.id,v.user_id,v.title,v.slug,v.is_active,u.name AS employee FROM vcards v JOIN users u ON u.id=v.user_id WHERE u.company_id=$1 ORDER BY v.updated_at DESC',[req.company.id]),
    pool.query('SELECT e.event_type,COUNT(*)::int AS count FROM vcard_events e JOIN vcards v ON v.id=e.vcard_id JOIN users u ON u.id=v.user_id WHERE u.company_id=$1 GROUP BY e.event_type',[req.company.id]),
    pool.query('SELECT o.id,o.user_id,o.amount,o.currency,o.status,o.payment_status,o.tracking_number,u.name AS employee FROM nfc_orders o JOIN users u ON u.id=o.user_id WHERE u.company_id=$1 ORDER BY o.ordered_at DESC LIMIT 100',[req.company.id]),
    pool.query('SELECT p.id,p.amount,p.currency,p.status,p.created_at,u.name AS employee FROM payments p JOIN users u ON u.id=p.user_id WHERE u.company_id=$1 ORDER BY p.created_at DESC LIMIT 100',[req.company.id])]);
  res.json({company:req.company,employees:employees.rows,cards:cards.rows.map(card=>({...card,publicUrl:publicVcardUrl(req,card.slug)})),analytics:events.rows,orders:orders.rows,payments:payments.rows});
}catch(e){next(e);}});
router.post('/employees',async(req,res,next)=>{
  const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase();
  if(!name||name.length>150||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:'Enter an employee name and valid email.'});
  let client;try{
    const password=await bcrypt.hash(crypto.randomBytes(32).toString('hex'),10),token=crypto.randomBytes(32).toString('hex');
    const reset=new URL('/pages/auth/reset-password.html',process.env.PUBLIC_APP_URL);reset.hash=new URLSearchParams({token}).toString();
    client=await pool.connect();await client.query('BEGIN');
    const company=(await client.query("SELECT employee_limit FROM companies WHERE id=$1 AND status='active' FOR UPDATE",[req.company.id])).rows[0];
    const count=(await client.query("SELECT COUNT(*)::int count FROM users u JOIN roles r ON r.id=u.role_id WHERE u.company_id=$1 AND r.name='user'",[req.company.id])).rows[0].count;
    if(!company||count>=company.employee_limit){await client.query('ROLLBACK');return res.status(409).json({message:'The company employee limit has been reached.'});}
    const employee=(await client.query("INSERT INTO users(company_id,role_id,name,email,password,status) VALUES($1,(SELECT id FROM roles WHERE name='user'),$2,$3,$4,'active') RETURNING id",[req.company.id,name,email,password])).rows[0];
    await client.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '24 hours')",[employee.id,crypto.createHash('sha256').update(token).digest('hex')]);
    await client.query("INSERT INTO email_outbox(user_id,recipient_email,dedup_key,subject,body) VALUES($1,$2,$3,'Set up your Sync E-Card account',$4)",[employee.id,email,'company-invite:'+employee.id,`You have been invited to ${req.company.name}. Set your password using this single-use link (valid for 24 hours):\n${reset.href}\n\nIf you need a new link, use Forgot password on the sign-in page.`]);
    await client.query("INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,'company.employee_invited','user',$2,$3::jsonb)",[req.user.id,employee.id,JSON.stringify({companyId:req.company.id})]);
    await client.query('COMMIT');res.status(201).json({message:'Employee created. A password setup invitation is queued.',id:employee.id});
  }catch(e){if(client)await client.query('ROLLBACK');if(e.code==='23505')return res.status(409).json({message:'An account with this email already exists. Contact the super admin to review its company membership.'});next(e);}finally{if(client)client.release();}
});
router.patch('/employees/:id',async(req,res,next)=>{
  if(!validId(req.params.id)||!['active','inactive'].includes(req.body.status))return res.status(400).json({message:'Choose an employee and valid status.'});
  let client;try{client=await pool.connect();await client.query('BEGIN');
    const result=await client.query(`UPDATE users SET status=$1,auth_version=auth_version+1,updated_at=NOW() WHERE id=$2 AND company_id=$3 AND id<>$4 AND role_id=(SELECT id FROM roles WHERE name='user') RETURNING id`,[req.body.status,req.params.id,req.company.id,req.user.id]);
    if(!result.rowCount){await client.query('ROLLBACK');return res.status(404).json({message:'Employee not found.'});}
    await client.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL',[req.params.id]);
    if(req.body.status==='inactive')await client.query('UPDATE vcards SET is_active=FALSE WHERE user_id=$1',[req.params.id]);
    await client.query("INSERT INTO activity_logs(user_id,action,resource_type,resource_id) VALUES($1,'company.employee_status_updated','user',$2)",[req.user.id,req.params.id]);
    await client.query('COMMIT');res.json({message:'Employee updated. Disabled cards must be published again after reactivation.'});
  }catch(e){if(client)await client.query('ROLLBACK');next(e);}finally{if(client)client.release();}
});
router.patch('/settings',async(req,res,next)=>{
  const fields=['name','email','phone','address','website_url'];
  if(!String(req.body.name||'').trim()||fields.some(key=>String(req.body[key]||'').length>(key==='address'?2000:255)))return res.status(400).json({message:'Enter a company name and contact details within the field limits.'});
  if(req.body.website_url){try{if(!['https:','http:'].includes(new URL(req.body.website_url).protocol))throw Error();}catch{return res.status(400).json({message:'Enter a valid HTTPS or HTTP website URL.'});}}
  try{await pool.query('UPDATE companies SET name=$1,email=$2,phone=$3,address=$4,website_url=$5,updated_at=NOW() WHERE id=$6',[...fields.map(key=>String(req.body[key]||'').trim()),req.company.id]);res.json({message:'Company settings saved.'});}catch(e){next(e);}
});
adminRouter.use(auth,authorize('super_admin'));
adminRouter.get('/',async(req,res,next)=>{try{
  const companies=await pool.query(`SELECT c.*, (SELECT COUNT(*)::int FROM users WHERE company_id=c.id) member_count FROM companies c ORDER BY c.id DESC`);
  const users=await pool.query("SELECT u.id,u.name,u.email FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='user' AND u.company_id IS NULL AND u.status='active' ORDER BY u.name");res.json({companies:companies.rows,users:users.rows});
}catch(e){next(e);}});
adminRouter.post('/',async(req,res,next)=>{
  const name=String(req.body.name||'').trim(),limit=Number(req.body.employeeLimit||10),adminId=Number(req.body.adminId);
  if(!name||name.length>255||!validId(adminId)||!Number.isInteger(limit)||limit<1||limit>10000)return res.status(400).json({message:'Enter a company name, existing administrator account and employee limit.'});
  let client;try{client=await pool.connect();await client.query('BEGIN');
    const owner=await client.query("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.company_id IS NULL AND u.status='active' AND r.name='user' FOR UPDATE OF u",[adminId]);
    if(!owner.rowCount){await client.query('ROLLBACK');return res.status(409).json({message:'Choose an active individual account without an existing company.'});}
    const company=(await client.query('INSERT INTO companies(name,employee_limit) VALUES($1,$2) RETURNING id',[name,limit])).rows[0];
    await client.query("UPDATE users SET company_id=$1,role_id=(SELECT id FROM roles WHERE name='company_admin'),auth_version=auth_version+1 WHERE id=$2",[company.id,adminId]);
    await client.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL',[adminId]);
    await client.query("INSERT INTO activity_logs(user_id,action,resource_type,resource_id) VALUES($1,'company.created','company',$2)",[req.user.id,company.id]);
    await client.query('COMMIT');res.status(201).json({message:'Company created. The administrator must sign in again.',id:company.id});
  }catch(e){if(client)await client.query('ROLLBACK');next(e);}finally{if(client)client.release();}
});
adminRouter.patch('/:id',async(req,res,next)=>{
  const limit=Number(req.body.employeeLimit),status=req.body.status;
  if(!validId(req.params.id)||!Number.isInteger(limit)||limit<1||limit>10000||!['active','inactive'].includes(status))return res.status(400).json({message:'Enter a valid employee limit and company status.'});
  let client;try{client=await pool.connect();await client.query('BEGIN');
    const result=await client.query('UPDATE companies SET employee_limit=$1,status=$2,updated_at=NOW() WHERE id=$3 RETURNING id',[limit,status,req.params.id]);
    if(!result.rowCount){await client.query('ROLLBACK');return res.sendStatus(404);}
    if(status==='inactive'){
      await client.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id IN (SELECT id FROM users WHERE company_id=$1) AND revoked_at IS NULL',[req.params.id]);
      await client.query('UPDATE vcards SET is_active=FALSE WHERE user_id IN (SELECT id FROM users WHERE company_id=$1)',[req.params.id]);
    }
    await client.query("INSERT INTO activity_logs(user_id,action,resource_type,resource_id) VALUES($1,'company.updated','company',$2)",[req.user.id,req.params.id]);
    await client.query('COMMIT');res.json({message:'Company updated. Previously disabled cards must be published again after reactivation.'});
  }catch(e){if(client)await client.query('ROLLBACK');next(e);}finally{if(client)client.release();}
});
async function delegateCompanyMember(req,res,next){
  if(req.query.companyMember===undefined)return next();
  if(req.user.role!=='company_admin'||!validId(req.query.companyMember)||!(/^\/vcards(?:\/\d+(?:\/duplicate)?)?$/.test(req.path)||req.path==='/dashboard'))return res.status(403).json({message:'Company delegation is not allowed for this request.'});
  try{const result=await pool.query(`SELECT employee.id,employee.name,employee.email,employee.status FROM users employee JOIN users admin ON admin.company_id=employee.company_id JOIN companies c ON c.id=admin.company_id
    WHERE admin.id=$1 AND employee.id=$2 AND employee.status='active' AND c.status='active'`,[req.user.id,req.query.companyMember]);
    if(!result.rowCount)return res.status(404).json({message:'Employee not found in your company.'});req.actor=req.user;req.user={...req.user,...result.rows[0]};next();
  }catch(e){next(e);}
}
module.exports={router,adminRouter,delegateCompanyMember};
