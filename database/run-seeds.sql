\echo Running seeds
\set ON_ERROR_STOP on
\i seeders/roles.seed.sql
\i seeders/super_admin.seed.sql
\i seeders/permissions.seed.sql
\i seeders\plans.seed.sql
\i seeders\settings.seed.sql
\i seeders\templates.seed.sql
\i seeders\role_permissions.seed.sql
