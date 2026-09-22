Remediation record — 22 September 2026

This records changes against the consolidated 21 September audit. Source fixes and isolated local tests do not certify a production deployment. Historical SQL migrations 001–064 have not been edited.

| Item | Repository remediation | Remaining deployment evidence |
| --- | --- | --- |
| SEC-01 | Receipt images are decoded/re-encoded with Sharp; PDFs are parsed, rewritten, and rejected for active actions, forms, attachments or encryption. MIME/format mismatches and corrupt files fail before disk storage. Downloads require authentication and appropriate ownership/role; payment proof downloads use attachment headers. | Verify private paths in Apache/cPanel too. Existing uploaded files were not reprocessed. Parsing is not antivirus or a guarantee that an arbitrary PDF is harmless. |
| SEC-02 | Credential files, private keys and dumps are excluded from release packaging and Docker context. No live `.env` or legacy users JSON is currently tracked. History confirms prior `.env`, `backend/.env`, and `backend/data/users.json` commits. | Owner must revoke/rotate historical DB and SMTP credentials, JWT signing secrets and any reused passwords in every environment. Repository cleanup cannot revoke them. Review provider access logs and coordinate any history rewrite with collaborators. |
| AUTH-01 | Registration records the session inside its account transaction. Authentication requires a matching user/session hash, expiry, revocation state and auth version. | Existing unrecorded tokens must sign in again. |
| AUTH-02 | Signed-email fallback removed; legacy identities are rejected. | Sign in again after deployment. |
| AUTH-03 | Password change locks the account, increments auth version, revokes every session and deletes recovery tokens in one transaction. Admin password changes and status changes also invalidate old credentials/sessions. | Smoke-test change/reset/logout on the real domain. |
| AUTH-04 | Browser login uses HttpOnly, SameSite=Lax cookies; production adds Secure and the `__Host-` prefix. Browser responses do not return JWTs. The old localStorage token is removed; the remaining `sessionActive` value is only a UI hint. Cookie writes require a trusted Origin and custom request header. Currency options use text nodes. Existing CSP remains enforced. | Deploy frontend and API together, over HTTPS. Same-site subdomains require explicit CORS origins. Cross-site deployments need a separate reviewed cookie/CSRF design. An XSS bug can still perform requests even though it cannot read the cookie. |
| ABUSE-01 | PostgreSQL atomic rate-limit buckets replace both process-local Maps. Buckets survive restarts and work across workers. Recovery, login, registration, receipt uploads and public writes have separate scopes. | Confirm exact trusted proxy addresses and that proxies overwrite forwarded client headers. |
| FEAT-01 | Company management is unavailable in this release: its demo pages are blocked and company-role login opens the individual workspace. No company-wide APIs are mounted. | Tenant employee-management APIs/UI are deliberately deferred; do not advertise them. |
| FEAT-02 | Transactional notification outbox, expiry reminders at 7/3/1 days, worker leases, retries, opt-out handling and delivery status are implemented. | Configure the worker/cron, verify SMTP and inbox delivery, monitor failed messages. See below. |
| FEAT-03 | Newsletter forms and the coming-soon handler are removed; footers link to support. | None; subscriptions are not offered. |
| DB-01 | SHA-256 checksums cover every migration. Drift, missing files and unreviewed historical baselines stop migration/startup. Single-migration execution uses the same ledger and ordering checks. | Compare historical files with the deployed release before explicitly recording their checksum baseline. |
| DB-02 | User-row locking prevents concurrent card-limit bypass. Reviewed payments are immutable, approval retries do not reactivate subscriptions, and a unique index protects manual-payment transaction rows. Tests cover tenant isolation, simultaneous bookings, approval retries and withdrawal balance reservation. Schema inventory tooling is supplied. | Compare the actual deployment schema, reconcile any historical duplicate transactions, and measure real query performance. These tests are not an exhaustive audit of every API and constraint. |
| OPS-01 | Startup/preflight require a complete matching migration ledger; CI runs the regression tests using PostgreSQL. | DNS, HTTPS, real SMTP inbox delivery, monitoring, full acceptance and rollback rehearsal still require staging/VPS access. |
| OPS-02 | Caddy requires the explicit `standalone` Compose profile. The app publishes only a loopback port; default startup does not claim 80/443. | Confirm listeners and use either Passenger/Apache or the standalone profile, according to the hosting plan. |
| OPS-03 | Backup script stops application writers, bundles database and uploads, verifies archives/checksums and restarts the app on failure. Restore-check script uses a disposable, network-isolated database and validates restored receipt references. | Pause external cron/workers too. Execute the scripts on Linux/Docker, encrypt offsite copies and retain a successful restore/rollback record. They were not executed on this Windows workstation. |

Deployment order for an existing database with a migration ledger:

1. Rotate exposed credentials through the DB/mail providers and environment settings. Keep new values out of logs, Git and tickets.
2. Stop app instances and external writers. Back up database and uploads as one maintenance operation.
3. Compare migrations 001–064 against the actual deployed release and ledger. After review only, run `node database/migrate.js --baseline-checksums`. This records missing checksums without applying pending migrations. A database without a ledger needs a separately reviewed schema-to-ledger reconciliation; neither migration command guesses its history.
4. Check for duplicate manual transactions before migration 067: `SELECT payment_id,COUNT(*) FROM transactions WHERE payment_id IS NOT NULL AND transaction_type='cash_payment' GROUP BY payment_id HAVING COUNT(*)>1;`. Reconcile duplicates with the financial records; do not delete them blindly.
5. Install dependencies with `npm ci` for cPanel, or rebuild the Docker image. Apply migrations with `node database/migrate.js`, then `node database/migrate.js --verify`. New migrations are 065 (rate limits), 066 (notification outbox), and 067 (manual transaction uniqueness).
6. Run `node database/schema-inventory.js > schema-inventory.json` into a private evidence directory and compare staging/production inventories. Run `node backend/preflight.js --smtp`, restart and check `/ready`.
7. Verify browser login, settings, password change/reset, receipt rejection/access, cards/QR, payment approval, NFC order and affiliate withdrawal on staging using designated accounts. Then repeat production smoke checks.

For a fresh empty database, `node database/migrate.js --seed` creates the ledger and checksums directly. Do not baseline or seed an unknown existing database.

Notification worker operation:

- Always-running Node/Docker: set `NOTIFICATION_JOBS=true` after SMTP is validated, then restart.
- Passenger/cPanel: leave that setting false and schedule `node backend/jobs/run-jobs.js` every minute with the exact Node environment and application directory. Use the host's cron lock to avoid overlapping runs. Pause this cron during maintenance/backup.
- `email_outbox` is the delivery ledger: inspect `status`, `attempts`, `available_at`, `sent_at`, and sanitized `last_error`. Transient errors use exponential delays; five attempts end in `failed`. Requeue an identified failed row only after fixing the cause, resetting its attempts and `available_at` through an audited operator action.
- New security, subscription, billing/payment, NFC, affiliate and withdrawal notifications are queued. Existing enquiry/appointment/reset email handlers remain their own flows. Historical notifications are not backfilled.
- Delivery is at least once: a crash after SMTP acceptance but before the database update may repeat a message. Stable Message-ID values help correlation but cannot force provider deduplication. `sent` means SMTP acceptance, not inbox arrival.
- Queued messages respect current account status and email preferences. Marketing/newsletter delivery is not implemented.

Backup/restore and rollback evidence:

- On Docker/Linux, run `sh deploy/backup.sh`, then `sh deploy/restore-check.sh backups/TIMESTAMP`. The latter restores into a generated disposable container and removes its volumes afterwards; it never mounts production volumes.
- Encrypt the completed bundle using your approved backup system before offsite transfer. Keep the recovery key separate and test restoring from the decrypted offsite copy. Local plaintext bundles must remain private and follow the retention policy.
- On Passenger, stop the application and cron, run `pg_dump -Fc` and archive `backend/uploads` during the same stopped interval, then restart. The Docker script is not a Passenger backup tool.
- Keep the prior application release with its matching pre-upgrade database/uploads bundle. Roll back the matching set while writes are stopped; do not blindly drop new constraints or rewrite applied migrations. Invalidate sessions when changing signing secrets.

Local evidence:

- All 48 tests in the default suite passed when run as separate Node test files (the Windows sandbox restricts the normal runner's child processes). The optional headless Edge login/settings test also passed. A syntax scan parsed 139 JavaScript/inline scripts, and `git diff --check` passed. Dependency installation reported zero known vulnerabilities at that time.
- `tests/audit-remediation.test.js`: parser rejection, session identity/expiry, cookie/CSRF behavior, concurrent card and booking limits, withdrawal reservations, shared limits, checksums, outbox retries/claims/preferences and password invalidation. Set `RUN_BROWSER_TESTS=true` to include headless Edge login/settings checks.
- `tests/production-workflows.test.js`: fresh migration/seed, account/role isolation, card CRUD, expiry, concurrent payment approval, financial edit rejection, NFC fulfilment and revenue accounting.
- `tests/password-recovery.test.js`: recovery lifecycle, concurrent single-use reset and session invalidation.
- Tests create and drop random isolated schemas, never apply these migrations to the configured business schema, and do not send email. Provider calls in the notification tests are mocked.
- Git history filenames were reviewed without printing secret values. Earlier sensitive paths appear in commits including `496624a`, `dcba159`, `de8a95c`, and `fdbe0ad`; revocation cannot be established from those commits.
- Public read-only checks on 22 September resolved `test.syncecard.com` to `203.161.38.177`. HTTPS requests to both `/health` and `/ready` returned HTTP 500. These changes have not been deployed; server/Passenger logs are required to diagnose that existing failure. A follow-up inspection was blocked by automatic approval review's usage limit, so no server diagnosis is claimed.

Security design references: [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), and [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
