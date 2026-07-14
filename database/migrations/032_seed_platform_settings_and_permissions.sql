INSERT INTO permissions (name, key, description, created_at, updated_at) VALUES
  ('Manage Users', 'manage_users', 'Create, update, and manage platform users', NOW(), NOW()),
  ('Manage Cards', 'manage_cards', 'Create, update, and manage business cards', NOW(), NOW()),
  ('Manage Payments', 'manage_payments', 'View and process platform payments', NOW(), NOW()),
  ('View Analytics', 'view_analytics', 'View analytics dashboards and reports', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description, updated_at) VALUES
  ('site_name', 'Sync E-Card', 'general', 'Application name displayed in the admin interface', NOW()),
  ('site_email', 'info@syncecard.lk', 'general', 'Support email address', NOW()),
  ('default_currency', 'USD', 'billing', 'Default display and billing currency', NOW()),
  ('default_timezone', 'Asia/Colombo', 'general', 'Default timezone for new accounts', NOW()),
  ('maintenance_mode', 'false', 'access', 'Temporarily restrict public platform access', NOW()),
  ('manual_signup_review', 'false', 'access', 'Require administrator approval for new accounts', NOW()),
  ('require_email_verification', 'true', 'access', 'Require verified email addresses before access', NOW()),
  ('session_timeout_minutes', '120', 'security', 'Administrative session timeout in minutes', NOW()),
  ('admin_email_alerts', 'true', 'notifications', 'Send administrators operational alerts', NOW()),
  ('payment_alerts', 'true', 'notifications', 'Notify administrators about payment review events', NOW()),
  ('security_alerts', 'true', 'notifications', 'Notify administrators about security events', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN ('manage_cards', 'manage_payments', 'view_analytics')
WHERE r.name = 'company_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
