# Staging sign-off

The deployment handoff supplied on 5 October 2026 reports healthy PostgreSQL and Docker application containers at `https://test.syncecard.com`, successful HTTPS `/health` and `/ready` checks, migrations through 077, and template registration/free-plan assignment for templates 1–20. These are operator-reported results, not a new verification from this checkout. The exact deployed commit and image remain to be recorded.

Company administration and newsletter subscriptions remain excluded from v1. Production cutover to `syncecard.lk` is pending acceptance.

## First step: technical checks

On the staging VPS, change to the directory containing the deployed `docker-compose.yml`. Use the running application container; do not recreate it to perform these checks.

```sh
node deploy/verify-staging.js
```

This requires Node on the host, Docker Compose and curl. It checks the migration ledger/checksums, production preflight, SMTP authentication, notification scheduling configuration and public HTTPS endpoints. It continues after failures and exits nonzero if any check fails. It neither sends email nor runs migrations or jobs. Preflight creates a temporary storage probe and removes it; it also creates the receipt directory if missing. Existing receipts are untouched. A disabled in-process notification scheduler requires evidence of a working external scheduler before that gate can pass.

If the host lacks Node, run the checks directly:

```sh
docker compose ps
docker compose exec -T app node database/migrate.js --verify
docker compose exec -T app node backend/preflight.js --smtp
docker compose exec -T app node -e 'console.log("NOTIFICATION_JOBS enabled:", process.env.NOTIFICATION_JOBS === "true")'
curl --fail --connect-timeout 10 --max-time 30 https://test.syncecard.com/health
curl --fail --connect-timeout 10 --max-time 30 https://test.syncecard.com/ready
```

Record UTC time, operator, deployed commit/image, each exit status and sanitized output. Do not attach environment files or secrets. A migration failure requires review against the deployed release; do not seed, replay migrations 073–077, or change ledger checksums to silence it. A shipping-fee failure requires an approved business rate.

## Remaining evidence

The [Phase 2 local acceptance record](phase2-acceptance.md) describes the subscription-date fix and repeatable local workflow/browser checks. Those results do not close the staging gates below.

| Gate | Evidence required | Status |
| --- | --- | --- |
| Historical secrets | Provider rotation records and confirmation old credentials are revoked, without recording secret values | Pending |
| Migration/preflight | Successful checks above, deployed commit and image | Pending |
| Database and uploads recovery | Coordinated backup, isolated restore, card/user counts and upload/receipt reference checks | Pending |
| Email | Designated test inbox receives recovery, appointment and relevant billing notifications; retries and failed outbox monitoring checked | Pending |
| Customer/admin journeys | Auth/session/role boundaries, card editing/publishing, QR/contact/NFC, limits, payment retries/rejections/coupons/expiry, fulfilment | Pending |
| Affiliate/appointments | Commission and withdrawal balances/reservations/permissions; conflicting bookings and approval/rejection | Pending |
| Templates 1–20 | Desktop/mobile public rendering with custom data, links, images, contact actions and no browser errors | Pending |
| Uploads/resilience | Valid/invalid uploads and ownership, persistence after controlled restart, disk/memory/monitoring | Pending |

Use [the Docker operations guide](namecheap-vps-deployment.md) for coordinated backup and isolated restore. Backup stops the application and requires external writers to be stopped; schedule that maintenance separately. The existing restore script checks user/migration counts and payment/withdrawal receipt files; card counts and other upload references still require acceptance evidence. SMTP authentication alone does not establish inbox delivery. Running outbox jobs may send queued customer messages, so inspect the queue and use designated staging recipients before delivery tests.

After these gates pass, record the frozen release, production secrets/configuration, DNS/TLS, backup and rollback plan before production cutover. Do not mark a gate complete merely because supporting source code exists.
