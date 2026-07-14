CREATE TABLE IF NOT EXISTS coupon_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage'
    CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  per_user_limit INTEGER NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  minimum_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (minimum_amount >= 0),
  applicable_plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'expired')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupon_codes(id) ON DELETE RESTRICT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  original_amount NUMERIC(12, 2) NOT NULL CHECK (original_amount >= 0),
  discount_amount NUMERIC(12, 2) NOT NULL CHECK (discount_amount >= 0),
  final_amount NUMERIC(12, 2) NOT NULL CHECK (final_amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_coupon_codes_status_window
  ON coupon_codes(status, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon
  ON coupon_redemptions(coupon_id, redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user
  ON coupon_redemptions(user_id, coupon_id);
