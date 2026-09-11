Deployment target: Namecheap VPS/dedicated server, https://syncecard.lk.

The supplied Compose setup runs Node, PostgreSQL, and Caddy. Caddy manages certificates after the domain resolves to the VPS and ports 80/443 are reachable. Only the proxy publishes public ports; PostgreSQL and Node stay on the Docker network. Uploads, database files, and certificates use persistent volumes.

Before starting:

1. Install Docker Engine and the Compose plugin on the Linux VPS. This workstation has no Docker executable, so the container build still needs verification there.
2. Point the `syncecard.lk` DNS A record to the VPS IPv4 address. Only publish an AAAA record if IPv6 is configured. Allow inbound 80/443 and restrict SSH access appropriately.
3. Extract the release outside any publicly served directory. Copy `deploy/production.env.example` to `deploy/production.env`; keep it private (`chmod 600 deploy/production.env`). The example already uses `syncecard.lk`.
4. Generate a unique production signing secret and database password. Set identical values for `DB_PASSWORD` and `POSTGRES_PASSWORD`, and matching database/user names in their two sets of variables. Set SMTP credentials for the production mail service. Rotate credentials that previously existed in Git history; removing files from tracking does not erase historical copies.

From the extracted project directory on the VPS:

```sh
docker compose build
docker compose up -d db
```

Choose exactly one database path:

- **Keep the existing business data:** export the current database with `pg_dump -Fc`, securely transfer the dump and existing `backend/uploads` contents, and restore into the new database. Do not run `db:setup` over the restored database. Migration 063 and 064 are required; apply only those that the restored backup lacks. Migration 064 and its revenue backfill have already been applied to the database used in this workspace.
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
docker compose up -d app proxy
docker compose ps
docker compose logs --tail=100 app proxy
curl --fail https://syncecard.lk/ready
```

The preflight checks production settings, database/schema, registration plan, bank transfer details, domestic NFC delivery fee, and SMTP authentication without sending mail. It must pass. Then use a disposable account on the real domain to verify registration/login, receipt of password-reset email, a public VCard link/QR code, and payment/NFC approval. Test messages and payments should use your own designated test accounts; do not initiate payments or email real customers during verification.

The remaining business input is the local and international NFC delivery charge. Display currency support does not supply a shipping price. Do not invent that charge; configure the approved LKR base values in super admin. The application converts these values for foreign-currency customers.

Run `sh deploy/backup.sh` regularly and retain encrypted copies off the VPS. Test restoring a backup into a separate empty database before relying on it. Back up database and uploads together during a quiet period. For rollback, retain the previous release and a pre-migration backup; restore both database and uploads if a migration cannot be safely reversed.

Notes: the expiry job runs in the Node process, while entitlement queries independently enforce dates. HTTP limits are per process; add a shared edge limit before scaling to multiple replicas. The default network uses `172.30.0.0/24`; change it and the trusted proxy address together if it conflicts with the VPS network.

References: [Namecheap VPS Node hosting](https://www.namecheap.com/support/knowledgebase/article.aspx/10202/48/how-to-install-nodejs-on-a-vps-or-a-dedicated-server/), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https/).
