ALTER TABLE coupon_codes
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN coupon_codes.is_public IS
  'When true, eligible authenticated users can discover this code in Billing. Private codes remain usable by manual entry.';
