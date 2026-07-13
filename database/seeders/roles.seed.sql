INSERT INTO roles (name, description, created_at, updated_at) VALUES
  ('super_admin', 'Full access to all resources and settings', NOW(), NOW()),
  ('company_admin', 'Manages company resources, users and cards', NOW(), NOW()),
  ('user', 'Standard company user with access to own cards', NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = NOW();
