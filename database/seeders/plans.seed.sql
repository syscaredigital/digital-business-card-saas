INSERT INTO plans (
  name, price, billing_interval, vcard_limit, nfc_limit,
  analytics_limit, features, status, created_at, updated_at
)
SELECT seed.name, seed.price, seed.billing_interval, seed.vcard_limit,
       seed.nfc_limit, seed.analytics_limit, seed.features::jsonb,
       'active', NOW(), NOW()
FROM (VALUES
  ('Free', 0.00::numeric, 'monthly', 1, 0, 0, '["Email support"]'),
  ('Starter', 19.99::numeric, 'monthly', 5, 1, 5, '["Email support", "Basic analytics"]'),
  ('Pro', 49.99::numeric, 'monthly', 20, 5, 20, '["Priority support", "Custom branding", "Advanced analytics"]')
) AS seed(name, price, billing_interval, vcard_limit, nfc_limit, analytics_limit, features)
WHERE NOT EXISTS (
  SELECT 1 FROM plans WHERE LOWER(plans.name) = LOWER(seed.name)
);
