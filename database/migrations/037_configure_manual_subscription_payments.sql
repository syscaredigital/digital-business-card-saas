INSERT INTO settings (key, value, category, description, updated_at) VALUES
  ('bank_name', '', 'billing', 'Bank receiving manual subscription payments', NOW()),
  ('bank_account_name', '', 'billing', 'Account holder receiving manual subscription payments', NOW()),
  ('bank_account_number', '', 'billing', 'Account number receiving manual subscription payments', NOW()),
  ('bank_branch', '', 'billing', 'Bank branch receiving manual subscription payments', NOW()),
  ('bank_swift_code', '', 'billing', 'Optional SWIFT or routing code for manual payments', NOW())
ON CONFLICT (key) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_manual_reference_unique
  ON payments (LOWER(gateway_reference))
  WHERE gateway_reference IS NOT NULL
    AND LOWER(COALESCE(method, '')) IN ('cash', 'manual', 'bank_transfer', 'cash_payment')
    AND status <> 'rejected';
