Production domain: https://syncecard.com. Deploy in its separate cPanel account under WHM on the existing VPS. The domain in the earlier pasted plan (syncecard.lk) is superseded by syncecard.com.

The release includes individual-user features, company administration, newsletter double opt-in and campaigns, regional package prices, and editable VCard URLs. Local verification does not establish that the server is deployed, credentials are revoked, or backups can be restored.

1. Create or select the dedicated cPanel account for syncecard.com. Configure the root DNS A record to the VPS public IPv4 address, add the domain, issue AutoSSL and enable HTTPS redirection. Configure www DNS/TLS and a redirect to https://syncecard.com if offering that alias. Preserve the other accounts and their web services.
2. In Setup Node.js App choose Node.js 22, Production mode, a private application root outside public_html (for example /home/ACCOUNT/syncecard-app), application URL syncecard.com with an empty URL path, and startup file app.js. Extract the release directly into that root and use Run NPM Install. Do not use Docker cleanup, restart the Docker daemon or modify its stuck overlay mounts for this cPanel deployment.
3. Configure the database BEFORE starting the application. For a new production installation, create a separate EMPTY PostgreSQL database and user in cPanel/WHM, then set the actual host, account-prefixed database/user names, password and TLS options. Do not point a new production installation at the staging database. Keep the existing database and uploads intact until a tested migration and cutover are approved.
4. Set production environment variables using deploy/cpanel.env.example. The private ignored deploy/cpanel.production.env contains a newly generated signing secret and the verified SMTP account, but its database settings came from local development and MUST be replaced/verified for this cPanel account. It is excluded from release ZIPs. Set PUBLIC_APP_URL=https://syncecard.com, NODE_ENV=production and NOTIFICATION_JOBS=false. Revoke exposed database/SMTP credentials at their providers and update configuration; a fresh local signing secret does not revoke provider credentials. Never paste secrets in chat or put them in shell arguments.
5. Activate the Node environment using the exact command in cPanel and change to the application root. Choose ONE database path below. Install schema before the new application serves traffic.

For a NEW EMPTY database only:

```sh
node database/migrate.js --seed
```

Temporarily set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD privately, run node backend/seed-super-admin.js, then remove those bootstrap variables. The fresh seed supplies the free package. Create the real paid packages, template allowances, products and bank details through super admin.

For an EXISTING database: stop application/cron writers, back up the database and uploads together, rehearse restoration in a separate database/location, and review the migration ledger against the deployed release. Apply pending migrations with node database/migrate.js only after that review. This release adds migrations 080 (regional pricing), 081 (VCard URL history), 082 (newsletter), and 083 (company seat limits), in addition to any earlier unapplied migrations. An existing database without a ledger requires historical review; do not replay old migrations, seed over customer data or fabricate checksums. The local legacy database still has this unresolved ledger condition.

After migration:

```sh
node database/migrate.js --verify
node backend/initialize-regional-prices.js
node backend/initialize-regional-prices.js --apply
node backend/preflight.js --smtp
```

Review fixed LKR/AUD/USD package prices before accepting international payments; see regional-package-pricing.md. Set domestic NFC shipping to the approved LKR 450 per order. International express-courier shipping remains unconfigured pending the destination/packed-weight quote; overseas ordering is blocked until its fee is configured. New database settings are not copied from the workstation automatically.

Keep NOTIFICATION_JOBS=false for Passenger and add ONE cPanel cron job every minute. Cron does not automatically inherit cPanel application-editor variables: provide the same database/SMTP/application variables in the server's private backend/.env, readable only by the account owner. Use the absolute Node path from the cPanel activation command:

```sh
cd /home/ACCOUNT/syncecard-app && /ABSOLUTE/APP/NODE backend/jobs/run-jobs.js >> /home/ACCOUNT/syncecard-notifications.log 2>&1
```

This worker handles transactional notifications, employee invitations and newsletter confirmation/campaign emails. Use designated inboxes to verify delivery and retries; no live inbox delivery is certified by mocked tests. Pause cron during backup/maintenance.

Company administration: in super admin > Companies, assign an active individual account without an existing company as company administrator. They sign in again to the company workspace. Set the employee seat limit, invite employees, manage their cards/URLs and review company reports. Employee packages and billing remain individual; shared corporate subscriptions are not implemented. Disabling an employee revokes their sessions and unpublishes cards. Disabling a company revokes its members' sessions and unpublishes cards; cards require explicit publishing after reactivation.

Newsletter: signup includes explicit consent and requires email confirmation within 24 hours. Super admin > Newsletter lists consent states and queues campaigns only for confirmed subscribers. Every campaign includes an unsubscribe link, and the worker rechecks consent before sending queued mail. Confirm the intended campaign and audience before submitting it in production.

VCard URLs: users can edit the Public URL name in the card editor. Links use https://syncecard.com/vcard/NAME. Previous names redirect to the current name and are reserved against another card taking them. Deleting a card retains reserved names as nonresolving records to prevent old QR/NFC links being reassigned. Existing names are captured when migration 081 runs; names changed before that migration cannot be reconstructed. Changing domains still requires the old domain's DNS/TLS/redirect configuration; URL history preserves paths within this application.

Backups: while Passenger and cron writers are stopped, set BACKUP_DIR to a private directory outside all web document roots and run node deploy/backup-cpanel.js with pg_dump and tar installed. It makes a database dump, uploads archive and SHA-256 manifest without printing credentials. Securely copy backups off the VPS. Restore the dump using pg_restore into a DIFFERENT empty test database and extract uploads into a separate directory; verify migrations, account records, public cards and receipt references there. Do not test restoration over the live database. Backup creation alone does not establish recoverability.

Restart the cPanel app and run node deploy/verify-production.js from its activated environment. Confirm /health and /ready over HTTPS; verify registration, login/logout, password-reset inbox delivery, card creation and URL rename, old-link redirects, QR scan destination, uploads, bank-payment approval, NFC fulfilment, company isolation, employee invitation/setup, newsletter confirmation/unsubscribe and actual cron execution. Confirm /.env, /backend/.env, /package.json and private receipts are not publicly served. Keep the prior release, database backup and uploads backup for rollback; monitor readiness, HTTP errors, disk usage and failed outbox/newsletter deliveries after launch.

The release ZIP includes release-manifest.json with hashes of the packaged source files. Keep that ZIP unchanged through deployment and retain its SHA-256 hash with the acceptance results. Source edits, prepared configuration and passing local tests do not change DNS or publish the site.
