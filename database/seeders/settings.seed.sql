INSERT INTO settings (key, value, category, description, updated_at) VALUES
  ('site_name', 'Digital Business Card SaaS', 'general', 'Application name displayed in the UI', NOW()),
  ('site_email', 'support@example.com', 'general', 'Support email address for notifications and contact', NOW()),
  ('default_currency', 'USD', 'billing', 'Default currency for payments and invoices', NOW()),
  ('default_timezone', 'UTC', 'general', 'Default timezone for new accounts', NOW()),
  ('bank_name', '', 'billing', 'Bank receiving manual subscription payments', NOW()),
  ('bank_account_name', '', 'billing', 'Account holder receiving manual subscription payments', NOW()),
  ('bank_account_number', '', 'billing', 'Account number receiving manual subscription payments', NOW()),
  ('bank_branch', '', 'billing', 'Bank branch receiving manual subscription payments', NOW()),
  ('bank_swift_code', '', 'billing', 'Optional SWIFT or routing code for manual payments', NOW()),
  ('affiliate_minimum_withdrawal', '10', 'billing', 'Minimum approved affiliate balance required for a withdrawal', NOW())
ON CONFLICT (key) DO NOTHING;
