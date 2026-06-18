INSERT INTO permissions (name, key, description, created_at, updated_at) VALUES
  ('Manage Users', 'manage_users', 'Create, update, and delete users', NOW(), NOW()),
  ('Manage Cards', 'manage_cards', 'Create, update, and delete business cards', NOW(), NOW()),
  ('Manage Payments', 'manage_payments', 'View and process payments', NOW(), NOW()),
  ('View Analytics', 'view_analytics', 'View analytics dashboards and reports', NOW(), NOW());
