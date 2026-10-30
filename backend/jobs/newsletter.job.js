const crypto=require('crypto');
async function deliverNewsletter(db,send=require('../services/email.service').sendQueuedNotification){
  let sent=0;
  for(let i=0;i<20;i++){
    const lease=crypto.randomUUID();
    const result=await db.query(`WITH candidate AS (SELECT id FROM newsletter_deliveries WHERE status IN ('pending','sending') AND available_at<=NOW() AND attempts<5 ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE newsletter_deliveries d SET status='sending',attempts=attempts+1,lease_token=$1,available_at=NOW()+INTERVAL '5 minutes' FROM candidate WHERE d.id=candidate.id RETURNING d.*`,[lease]);
    const row=result.rows[0];if(!row)break;
    const subscriber=(await db.query('SELECT email,status,confirmation_expires_at FROM newsletter_subscribers WHERE id=$1',[row.subscriber_id])).rows[0];
    const eligible=subscriber && (row.kind==='campaign'?subscriber.status==='subscribed':subscriber.status==='pending'&&new Date(subscriber.confirmation_expires_at)>new Date());
    if(!eligible){await db.query("UPDATE newsletter_deliveries SET status='cancelled',lease_token=NULL WHERE id=$1 AND lease_token=$2",[row.id,lease]);continue;}
    try{await send({to:subscriber.email,subject:row.subject,text:row.body,messageId:`<newsletter-${row.id}@syncecard.com>`});
      await db.query("UPDATE newsletter_deliveries SET status='sent',sent_at=NOW(),lease_token=NULL,last_error=NULL WHERE id=$1 AND lease_token=$2",[row.id,lease]);sent++;
    }catch(e){await db.query(`UPDATE newsletter_deliveries SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,available_at=NOW()+POWER(2,attempts)*INTERVAL '1 minute',lease_token=NULL,last_error=$3 WHERE id=$1 AND lease_token=$2`,[row.id,lease,String(e.code||'delivery_failed').replace(/[^a-z0-9_-]/gi,'').slice(0,80)]);}
  }
  await db.query("UPDATE newsletter_deliveries SET status='failed',lease_token=NULL,last_error='lease_exhausted' WHERE status='sending' AND attempts>=5 AND available_at<=NOW()");
  return sent;
}
module.exports={deliverNewsletter};
