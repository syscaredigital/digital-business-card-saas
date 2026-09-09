\echo Running seeds
\set ON_ERROR_STOP on
\ir seeders/roles.seed.sql
\ir seeders/super_admin.seed.sql
\ir seeders/permissions.seed.sql
\ir seeders/plans.seed.sql
\ir seeders/settings.seed.sql
\ir seeders/templates.seed.sql
\ir seeders/role_permissions.seed.sql
