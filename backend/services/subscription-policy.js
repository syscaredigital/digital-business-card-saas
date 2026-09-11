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
module.exports = { currentSubscription, expireSubscriptions };
