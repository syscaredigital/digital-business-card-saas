// Subscriptions use DATE columns. The final day is inclusive, matching storage
// limits and billing displays. Queries enforce expiry even between job runs.
function currentSubscription(alias = 's') {
  if (!/^[a-z_]+$/i.test(alias)) throw new Error('Invalid SQL alias');
  return `${alias}.status='active' AND ${alias}.start_date<=CURRENT_DATE AND (${alias}.end_date IS NULL OR ${alias}.end_date>=CURRENT_DATE)`;
}
async function expireSubscriptions(db) {
  const result = await db.query("UPDATE subscriptions SET status='expired',updated_at=NOW() WHERE status IN ('active','trial') AND end_date<CURRENT_DATE RETURNING id");
  return result.rowCount;
}
async function hasVcardFeature(db, userId, feature) {
  const result = await db.query(`SELECT p.features FROM subscriptions s
    JOIN plans p ON p.id=s.plan_id WHERE s.user_id=$1 AND ${currentSubscription()}
    ORDER BY s.created_at DESC LIMIT 1`, [userId]);
  const { normalizePlanFeatures } = require('../config/vcard-features');
  return normalizePlanFeatures(result.rows[0]?.features).vcardFeatures.includes(feature);
}
module.exports = { currentSubscription, expireSubscriptions, hasVcardFeature };
