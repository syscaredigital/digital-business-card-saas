INSERT INTO plans (name, price, billing_interval, vcard_limit, nfc_limit, analytics_limit, features, status, created_at, updated_at) VALUES
  ('Free', 0.00, 'monthly', 1, 0, 0, '{"support":"email"}', 'active', NOW(), NOW()),
  ('Starter', 19.99, 'monthly', 5, 1, 5, '{"support":"email","custom_branding":false}', 'active', NOW(), NOW()),
  ('Pro', 49.99, 'monthly', 20, 5, 20, '{"support":"priority","custom_branding":true,"analytics":true}', 'active', NOW(), NOW());
