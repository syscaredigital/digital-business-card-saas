-- Qualify referrals whose referred user already has an approved paid subscription.
UPDATE affiliate_referrals ar
SET status = 'qualified', updated_at = NOW()
WHERE ar.status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM payments pay
    WHERE pay.user_id = ar.referred_user_id
      AND pay.subscription_id IS NOT NULL
      AND pay.status = 'approved'
      AND pay.amount > 0
  );

-- Backfill one pending commission for each approved payment not credited before.
INSERT INTO affiliate_commissions
  (affiliate_id, referral_id, payment_id, amount, currency, status, description)
SELECT ap.id, ar.id, pay.id,
  CASE
    WHEN ap.commission_type = 'percentage' THEN ROUND(pay.amount * ap.commission_value / 100.0, 2)
    ELSE ap.commission_value
  END,
  pay.currency,
  'pending',
  'Commission from approved subscription payment #' || pay.id
FROM payments pay
JOIN affiliate_referrals ar
  ON ar.referred_user_id = pay.user_id AND ar.status = 'qualified'
JOIN affiliate_profiles ap
  ON ap.id = ar.affiliate_id AND ap.status = 'active'
WHERE pay.status = 'approved'
  AND pay.subscription_id IS NOT NULL
  AND pay.amount > 0
  AND CASE
    WHEN ap.commission_type = 'percentage' THEN ROUND(pay.amount * ap.commission_value / 100.0, 2)
    ELSE ap.commission_value
  END > 0
ON CONFLICT (affiliate_id, payment_id) WHERE payment_id IS NOT NULL DO NOTHING;
