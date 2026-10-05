Docker/VPS procedure for the staging deployment reported in the 5 October 2026 handoff. For the existing healthy deployment, start with [read-only staging sign-off](staging-signoff.md), not the provisioning commands below. The [cPanel/Passenger guide](cpanel-deployment.md) describes an alternative application hosting method.

Deployment target: Namecheap VPS/dedicated server, https://test.syncecard.com.

The supplied Compose setup runs Node, PostgreSQL, and Caddy. Caddy manages certificates after the domain resolves to the VPS and ports 80/443 are reachable. Only the optional proxy publishes public ports; Node also binds a loopback-only port for a host reverse proxy. PostgreSQL stays on the Docker network. Caddy is disabled unless the `standalone` Compose profile is selected. Do not enable that profile on a WHM/cPanel host already serving ports 80/443. Uploads, database files, and certificates use persistent volumes.

Before starting:

1. Install Docker Engine and the Compose plugin on the Linux VPS. This workstation has no Docker executable, so the container build still needs verification there.
2. Point the `test.syncecard.com` DNS A record to the VPS IPv4 address. Only publish an AAAA record if IPv6 is configured. Allow inbound 80/443 and restrict SSH access appropriately.
3. Extract the release outside any publicly served directory. Copy `deploy/production.env.example` to `deploy/production.env`; keep it private (`chmod 600 deploy/production.env`). The example already uses `test.syncecard.com`.
4. Generate a unique production signing secret and database password. Set identical values for `DB_PASSWORD` and `POSTGRES_PASSWORD`, and matching database/user names in their two sets of variables. Set SMTP credentials for the production mail service. Rotate credentials that previously existed in Git history; removing files from tracking does not erase historical copies.

From the extracted project directory on the VPS:

```sh
docker compose build
docker compose up -d db
```

Choose exactly one database path:

- **Keep the existing business data:** export the current database with `pg_dump -Fc`, securely transfer the dump and existing `backend/uploads` contents, and restore into the new database. Do not run `db:setup` over the restored database. Review the migration ledger/checksum baseline against the selected release; follow [the audit upgrade procedure](audit-remediation.md) for reviewed pending migrations. Staging is reported migrated through 077: verify it, rather than replaying those migrations. Do not guess which migrations the restored database has applied.
- **Start a new empty database:** run `docker compose run --rm app node database/migrate.js --seed`. This installs all migrations and a free registration plan, without sample paid products or default administrator credentials. Set `SUPER_ADMIN_EMAIL` and a strong `SUPER_ADMIN_PASSWORD` temporarily in the private environment file, then run `docker compose run --rm app node backend/seed-super-admin.js`. Remove those two bootstrap variables afterwards. Configure paid plans, NFC products, bank details, and shipping rates in super admin before accepting orders.

Example restore commands for a new empty database (substitute your actual database/user names):

```sh
docker compose cp /secure/path/database.dump db:/tmp/database.dump
docker compose exec db pg_restore --no-owner --no-acl -U cards -d cards /tmp/database.dump
docker compose run --rm app node backend/backfill-revenue.js
```

Restore upload files to the `uploads` volume as part of the same migration. Keep their filenames unchanged because the database references them. The application user must own the volume contents (UID 1000 in the supplied image).

Validate before exposing the site:

```sh
docker compose run --rm app node backend/preflight.js --smtp
docker compose --profile standalone up -d app proxy
docker compose ps
docker compose logs --tail=100 app proxy
curl --fail https://test.syncecard.com/ready
```

The preflight checks production settings, database/schema, registration plan, bank transfer details, domestic NFC delivery fee, and SMTP authentication without sending mail. It must pass. Then use a disposable account on the real domain to verify registration/login, receipt of password-reset email, a public VCard link/QR code, and payment/NFC approval. Test messages and payments should use your own designated test accounts; do not initiate payments or email real customers during verification.

The remaining business input is the local and international NFC delivery charge. Display currency support does not supply a shipping price. Do not invent that charge; configure the approved LKR base values in super admin. The application converts these values for foreign-currency customers.

Run `sh deploy/backup.sh` regularly and retain encrypted copies off the VPS. Test restoring a backup into a separate empty database before relying on it. The script stops the app for a consistent database/upload bundle; stop external workers and cron as well. Run `sh deploy/restore-check.sh backups/TIMESTAMP` against each selected recovery-test bundle. For rollback, retain the previous release and a pre-migration backup; restore both database and uploads if a migration cannot be safely reversed.

Notes: the expiry job runs in the Node process, while entitlement queries independently enforce dates. HTTP limits use shared PostgreSQL buckets. Enable `NOTIFICATION_JOBS=true` for scheduled reminders and outbox delivery after SMTP verification. The default network uses `172.30.0.0/24`; change it and the trusted proxy address together if it conflicts with the VPS network.

References: [Namecheap VPS Node hosting](https://www.namecheap.com/support/knowledgebase/article.aspx/10202/48/how-to-install-nodejs-on-a-vps-or-a-dedicated-server/), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https/).
