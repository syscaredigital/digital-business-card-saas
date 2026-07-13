INSERT INTO users (role_id, name, email, password, status, is_email_verified, created_at, updated_at)
SELECT
  id,
  'Super Admin',
  'info@syncecard.lk',
  '$2b$10$saWIHMWnXEF/afQjPGCEa.h3BEPdeqlS74fauktV4hLKPz6TrAPAm',
  'active',
  TRUE,
  NOW(),
  NOW()
FROM roles
WHERE name = 'super_admin'
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  status = EXCLUDED.status,
  is_email_verified = EXCLUDED.is_email_verified,
  updated_at = NOW();
