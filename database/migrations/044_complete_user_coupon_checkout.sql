ALTER TABLE coupon_redemptions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'applied';

ALTER TABLE coupon_redemptions
  DROP CONSTRAINT IF EXISTS coupon_redemptions_status_check;

ALTER TABLE coupon_redemptions
  ADD CONSTRAINT coupon_redemptions_status_check
  CHECK (status IN ('pending', 'applied', 'cancelled'));

UPDATE coupon_codes SET code = UPPER(TRIM(code));

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_codes_code_case_insensitive
  ON coupon_codes (UPPER(code));

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_payment_unique
  ON coupon_redemptions (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_active_usage
  ON coupon_redemptions (coupon_id, user_id, status);
