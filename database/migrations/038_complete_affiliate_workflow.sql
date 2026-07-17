INSERT INTO settings (key, value, category, description, updated_at) VALUES
  ('affiliate_minimum_withdrawal', '10', 'billing', 'Minimum approved affiliate balance required for a withdrawal', NOW())
ON CONFLICT (key) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_profiles_referral_code_ci
  ON affiliate_profiles (LOWER(referral_code));

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_commissions_payment_unique
  ON affiliate_commissions (affiliate_id, payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_affiliate_currency_status
  ON withdrawals (affiliate_id, currency, status);
