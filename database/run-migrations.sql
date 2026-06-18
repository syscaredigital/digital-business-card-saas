\echo Running migrations
\set ON_ERROR_STOP on
\i migrations/001_create_roles_table.sql
\i migrations/002_create_permissions_table.sql
\i migrations/003_create_users_table.sql
\i migrations/004_create_companies_table.sql
\i migrations/005_create_plans_table.sql
\i migrations/006_create_subscriptions_table.sql
\i migrations/007_create_vcard_templates_table.sql
\i migrations/008_create_vcards_table.sql
\i migrations/009_create_qrcodes_table.sql
\i migrations/010_create_nfc_orders_table.sql
\i migrations/011_create_payments_table.sql
\i migrations/012_create_invoices_table.sql
\i migrations/013_create_notifications_table.sql
\i migrations/014_create_activity_logs_table.sql
\i migrations/015_create_settings_table.sql
\i migrations/016_create_business_cards_table.sql
\i migrations/017_create_card_social_links_table.sql
\i migrations/018_create_card_gallery_table.sql
\i migrations/019_create_nfc_cards_table.sql
\i migrations/020_create_contacts_table.sql
\i migrations/021_create_analytics_table.sql
\i migrations/022_create_transactions_table.sql
\i migrations/023_create_role_permissions_table.sql
