CREATE TABLE IF NOT EXISTS affiliate_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(80) NOT NULL UNIQUE,
  commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
  commission_value NUMERIC(12, 2) NOT NULL DEFAULT 10 CHECK (commission_value >= 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  payout_details JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id SERIAL PRIMARY KEY,
  affiliate_id INTEGER NOT NULL REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
  referred_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id SERIAL PRIMARY KEY,
  affiliate_id INTEGER NOT NULL REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
  referral_id INTEGER REFERENCES affiliate_referrals(id) ON DELETE SET NULL,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  description TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS affiliate_id INTEGER REFERENCES affiliate_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_profiles_status
  ON affiliate_profiles(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate
  ON affiliate_referrals(affiliate_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate
  ON affiliate_commissions(affiliate_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_affiliate_id
  ON withdrawals(affiliate_id);
