function number(value) { return Number(value || 0); }
async function createAffiliateCommissionForPayment(client, paymentId) {
  // An approved paid subscription is the qualifying conversion. Qualify the
  // captured referral before calculating its commission in the same transaction.
  await client.query(
    `UPDATE affiliate_referrals ar SET status='qualified',updated_at=NOW()
     FROM payments pay
     WHERE pay.id=$1 AND pay.status='approved' AND pay.subscription_id IS NOT NULL
       AND ar.referred_user_id=pay.user_id AND ar.status='pending'`,
    [paymentId]
  );
  const result = await client.query(
    `INSERT INTO affiliate_commissions(affiliate_id,referral_id,payment_id,amount,currency,status,description)
     SELECT ap.id,ar.id,pay.id,
       CASE WHEN ap.commission_type='percentage' THEN ROUND(pay.amount * ap.commission_value / 100.0,2)
            ELSE ap.commission_value END,
       pay.currency,'pending','Commission from approved subscription payment #' || pay.id
     FROM payments pay JOIN affiliate_referrals ar ON ar.referred_user_id=pay.user_id AND ar.status='qualified'
     JOIN affiliate_profiles ap ON ap.id=ar.affiliate_id AND ap.status='active'
     WHERE pay.id=$1 AND pay.status='approved' AND pay.amount>0
       AND CASE WHEN ap.commission_type='percentage' THEN ROUND(pay.amount * ap.commission_value / 100.0,2) ELSE ap.commission_value END > 0
     ON CONFLICT (affiliate_id,payment_id) WHERE payment_id IS NOT NULL DO NOTHING
     RETURNING id,affiliate_id,amount,currency`, [paymentId]
  );
  for (const commission of result.rows) {
    await client.query(`INSERT INTO notifications(user_id,title,message,type)
      SELECT user_id,'New affiliate commission',$1,'affiliate' FROM affiliate_profiles WHERE id=$2`,
      [`${commission.currency} ${number(commission.amount).toFixed(2)} is pending super-admin approval.`, commission.affiliate_id]);
  }
  return result.rows;
}


module.exports = { createAffiliateCommissionForPayment };
