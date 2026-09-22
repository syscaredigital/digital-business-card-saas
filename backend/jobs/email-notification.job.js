const crypto = require('crypto');
const mail = require('../services/email.service');
async function deliverEmails(db, send = mail.sendQueuedNotification) {
  let delivered = 0;
  for (let i=0;i<20;i++) {
    const lease = crypto.randomUUID();
    const claimed = await db.query(`WITH candidate AS (
      SELECT id FROM email_outbox WHERE status IN ('pending','sending') AND available_at<=NOW() AND attempts<5
      ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE email_outbox e SET status='sending',attempts=attempts+1,lease_token=$1,
      available_at=NOW()+INTERVAL '5 minutes' FROM candidate WHERE e.id=candidate.id RETURNING e.*`, [lease]);
    const row = claimed.rows[0];
    if (!row) break;
    const owner = (await db.query(`SELECT u.email,u.status,COALESCE(s.email_notifications,TRUE) enabled
      FROM users u LEFT JOIN user_settings s ON s.user_id=u.id WHERE u.id=$1`,[row.user_id])).rows[0];
    if (!owner || owner.status!=='active' || !owner.enabled) {
      await db.query("UPDATE email_outbox SET status='cancelled',lease_token=NULL WHERE id=$1 AND lease_token=$2",[row.id,lease]);
      continue;
    }
    try {
      await send({ to:owner.email,subject:row.subject,text:row.body,messageId:'<outbox-'+row.id+'@syncecard.local>' });
      await db.query("UPDATE email_outbox SET status='sent',sent_at=NOW(),last_error=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2",[row.id,lease]);
      delivered++;
    } catch(error) {
      const code = String(error.code || error.name || 'delivery_failed').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
      await db.query(`UPDATE email_outbox SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
        available_at=NOW()+LEAST(3600,POWER(2,attempts)*60)*INTERVAL '1 second',last_error=$3,lease_token=NULL
        WHERE id=$1 AND lease_token=$2`,[row.id,lease,code]);
    }
  }
  await db.query("UPDATE email_outbox SET status='failed',lease_token=NULL,last_error='lease_exhausted' WHERE status='sending' AND attempts>=5 AND available_at<=NOW()");
  return delivered;
}
module.exports = { deliverEmails };
