ALTER TABLE nfc_orders
  ADD COLUMN IF NOT EXISTS vcard_id INTEGER REFERENCES vcards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'LKR',
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transaction_number VARCHAR(255),
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nfc_orders_transaction_number_ci
  ON nfc_orders (LOWER(transaction_number))
  WHERE transaction_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nfc_orders_payment_review
  ON nfc_orders (payment_status, ordered_at DESC);
