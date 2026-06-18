INSERT INTO settings (key, value, category, description, updated_at) VALUES
  ('site_name', 'Digital Business Card SaaS', 'general', 'Application name displayed in the UI', NOW()),
  ('site_email', 'support@example.com', 'general', 'Support email address for notifications and contact', NOW()),
  ('default_currency', 'USD', 'billing', 'Default currency for payments and invoices', NOW()),
  ('default_timezone', 'UTC', 'general', 'Default timezone for new accounts', NOW());
