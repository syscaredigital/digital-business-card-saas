const express = require('express');
const crypto = require('crypto');
const pool = require('../config/database.config');
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const publicRouter = express.Router(), adminRouter = express.Router();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const accepted = { message: 'Check your inbox to confirm your subscription. If already subscribed, no further action is needed.' };
publicRouter.post('/subscribe', require('../middlewares/rate-limit.middleware')({ limit: 10, windowMs: 3600000, scope: 'newsletter' }), async (req,res,next) => {
  const email=String(req.body.email || '').trim().toLowerCase();
  if (req.body.consent !== true || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({message:'Enter a valid email and agree to receive newsletter emails.'});
  let client;
  try {
    const token=crypto.randomBytes(32).toString('hex'), unsubscribe=crypto.randomBytes(32).toString('hex');
    const origin=new URL(process.env.PUBLIC_APP_URL).origin;
    client=await pool.connect(); await client.query('BEGIN');
    const saved=await client.query(`INSERT INTO newsletter_subscribers(email,status,confirmation_hash,confirmation_expires_at,unsubscribe_token)
      VALUES($1,'pending',$2,NOW()+INTERVAL '24 hours',$3)
      ON CONFLICT(email) DO UPDATE SET status='pending',consent_at=NOW(),confirmation_hash=$2,confirmation_expires_at=NOW()+INTERVAL '24 hours',updated_at=NOW()
      WHERE newsletter_subscribers.status='unsubscribed' OR (newsletter_subscribers.status='pending' AND newsletter_subscribers.confirmation_expires_at<NOW()) RETURNING id`,[email,hash(token),unsubscribe]);
    if(saved.rowCount) await client.query("UPDATE newsletter_deliveries SET status='cancelled',lease_token=NULL WHERE subscriber_id=$1 AND kind='confirmation' AND status IN ('pending','sending')",[saved.rows[0].id]);
    if(saved.rowCount) await client.query(`INSERT INTO newsletter_deliveries(subscriber_id,kind,subject,body) VALUES($1,'confirmation','Confirm your Sync E-Card newsletter subscription',$2)`,[saved.rows[0].id,`Confirm that you want to receive Sync E-Card newsletter emails:\n${origin}/api/public/newsletter/confirm?token=${token}\n\nThis link expires in 24 hours. If you did not request this, ignore this email.`]);
    await client.query('COMMIT'); res.status(202).json(accepted);
  } catch(e) {if(client)await client.query('ROLLBACK');next(e);} finally {if(client)client.release();}
});
publicRouter.get('/confirm',async(req,res,next)=>{
  const token=String(req.query.token || '');
  if(!/^[a-f0-9]{64}$/.test(token))return res.status(400).send('Invalid confirmation link.');
  try {const result=await pool.query(`UPDATE newsletter_subscribers SET status='subscribed',confirmed_at=NOW(),confirmation_hash=NULL,confirmation_expires_at=NULL,updated_at=NOW()
    WHERE confirmation_hash=$1 AND status='pending' AND confirmation_expires_at>NOW() RETURNING id`,[hash(token)]);
    res.set('Cache-Control','no-store').status(result.rowCount?200:400).type('text').send(result.rowCount?'Your Sync E-Card newsletter subscription is confirmed. You can unsubscribe from any newsletter email.':'This link is invalid or expired. Subscribe again to request a new link.');
  }catch(e){next(e);}
});
publicRouter.get('/unsubscribe',async(req,res,next)=>{
  const token=String(req.query.token || '');
  if(!/^[a-f0-9]{64}$/.test(token))return res.status(400).send('Invalid unsubscribe link.');
  try {await pool.query(`UPDATE newsletter_subscribers SET status='unsubscribed',unsubscribed_at=NOW(),confirmation_hash=NULL,updated_at=NOW() WHERE unsubscribe_token=$1`,[token]);
    res.set('Cache-Control','no-store').type('text').send('You are unsubscribed from the Sync E-Card newsletter.');
  }catch(e){next(e);}
});
adminRouter.use(authenticate,authorize('super_admin'));
adminRouter.get('/',async(req,res,next)=>{try{
  const [subscribers,campaigns]=await Promise.all([pool.query('SELECT id,email,status,consent_at,confirmed_at,unsubscribed_at FROM newsletter_subscribers ORDER BY id DESC LIMIT 500'),pool.query(`SELECT c.id,c.subject,c.created_at,COUNT(d.id)::int recipients,COUNT(d.id) FILTER(WHERE d.status='sent')::int sent,COUNT(d.id) FILTER(WHERE d.status='failed')::int failed FROM newsletter_campaigns c LEFT JOIN newsletter_deliveries d ON d.campaign_id=c.id GROUP BY c.id ORDER BY c.id DESC LIMIT 50`)]);
  res.json({subscribers:subscribers.rows,campaigns:campaigns.rows});
}catch(e){next(e);}});
adminRouter.post('/campaigns',async(req,res,next)=>{
  const subject=String(req.body.subject||'').trim(),body=String(req.body.body||'').trim(),key=String(req.body.requestKey||'');
  if(subject.length<1||subject.length>200||/[\r\n]/.test(subject)||body.length<1||body.length>20000||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key))return res.status(400).json({message:'Enter a subject, message and valid request key.'});
  let client;
  try {client=await pool.connect();await client.query('BEGIN');
    const result=await client.query('INSERT INTO newsletter_campaigns(request_key,created_by,subject,body) VALUES($1,$2,$3,$4) ON CONFLICT(request_key) DO NOTHING RETURNING id',[key,req.user.id,subject,body]);
    if(result.rowCount){const origin=new URL(process.env.PUBLIC_APP_URL).origin;
      await client.query(`INSERT INTO newsletter_deliveries(subscriber_id,campaign_id,kind,subject,body)
        SELECT id,$1,'campaign',$2,$3 || E'\n\nUnsubscribe: ' || $4 || unsubscribe_token FROM newsletter_subscribers WHERE status='subscribed'`,[result.rows[0].id,subject,body,origin+'/api/public/newsletter/unsubscribe?token=']);
      await client.query("INSERT INTO activity_logs(user_id,action,resource_type,resource_id) VALUES($1,'newsletter.campaign_queued','newsletter_campaign',$2)",[req.user.id,result.rows[0].id]);
    }
    await client.query('COMMIT');res.status(202).json({message:'Campaign queued for confirmed subscribers. Repeated submissions are not sent twice.'});
  }catch(e){if(client)await client.query('ROLLBACK');next(e);}finally{if(client)client.release();}
});
module.exports={publicRouter,adminRouter};
