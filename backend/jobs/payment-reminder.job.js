const { currentSubscription } = require('../services/subscription-policy');
async function queueReminders(db) {
  const result = await db.query(`INSERT INTO email_outbox(user_id,dedup_key,subject,body)
    SELECT s.user_id,'expiry:'||s.id||':'||s.end_date||':'||(s.end_date-CURRENT_DATE),
      'Your subscription expires soon',
      'Your '||p.name||' subscription expires on '||s.end_date||'. Sign in to review renewal options. Ignore this reminder if you have already submitted a renewal payment.'
    FROM subscriptions s JOIN plans p ON p.id=s.plan_id JOIN users u ON u.id=s.user_id
    LEFT JOIN user_settings prefs ON prefs.user_id=u.id
    WHERE ${currentSubscription()} AND p.price>0
      AND s.end_date-CURRENT_DATE IN (1,3,7) AND u.status='active' AND COALESCE(prefs.email_notifications,TRUE)
    ON CONFLICT(dedup_key) DO NOTHING`);
  return result.rowCount;
}
module.exports = { queueReminders };
