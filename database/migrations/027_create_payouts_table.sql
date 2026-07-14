CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  payee_name VARCHAR(150) NOT NULL,
  payee_email VARCHAR(255),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reference VARCHAR(255),
  account_details JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_status_scheduled
  ON payouts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id
  ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_transaction_id
  ON payouts(transaction_id);
