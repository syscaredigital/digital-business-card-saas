CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payout_id INTEGER REFERENCES payouts(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  account_details JSONB DEFAULT '{}'::jsonb,
  request_note TEXT,
  admin_note TEXT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS withdrawal_id INTEGER REFERENCES withdrawals(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_withdrawal_id
  ON payouts(withdrawal_id) WHERE withdrawal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id
  ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created
  ON withdrawals(status, created_at);
