# Staging repair — 16 October 2026

Work is local to this checkout. Server authentication is still required to finish deployment and operational sign-off.

## Repairs

- Workflow tests now select the current Corporate Classic template by its design key. Migration 078 removes the old template records, so requesting template ID 1 correctly failed with 403 and caused dependent workflow failures.
- Classic browser tests now verify that retired page URLs redirect to the corresponding supported Classic design. The retired designs are not restored.
- The public contact-download test waits for the modal's automatic close instead of racing a manual close-button click against its success timer.
- The custom-data publishing acceptance test expects the ten templates retained by migration 078. A new database test verifies that this migration preserves existing cards and plan restrictions with arbitrary template IDs.
- CI now includes browser workflows, fresh-database setup, deployment smoke checks, the public desktop/mobile sweep and a Docker image build. These new CI steps have not been run on GitHub from this checkout.
- Preflight reports migration verification separately from runtime schema and business configuration. A missing ledger now produces an actionable diagnostic instead of only PostgreSQL error 42P01.

## Local database

Before changes, a custom-format PostgreSQL backup was created at `backups/local-readiness-1792142783134/database.dump`. A subsequent restore into a disposable local database succeeded: seven users, one card, two payments and one withdrawal matched the source counts. The disposable database was then removed. This checks the local database backup only; staging database/uploads recovery remains unverified. Adjacent `repair.json` and `restore-verification.json` files record the changes and restore evidence.

The three confirmed missing objects were added using the reviewed SQL from migrations 065, 066 and 067: shared rate limits, transactional email outbox/trigger, and the unique manual-payment transaction index. They were applied in one transaction. User count remained seven. No historical email was queued by the outbox migration, and no jobs or email delivery were run.

The existing local database still has no historical migration ledger. No ledger or checksums were invented. Normal startup and production preflight continue to reject that database until its migration history is reviewed or restored from a verified source. Do not run the full migration sequence over this populated database. Fresh database setup is exercised independently in disposable test schemas.

The local origin remains `http://localhost:5000`, which is appropriate for development and intentionally fails production-origin validation. Production configuration must be checked on the server. The local domestic NFC fee is zero; an approved business rate is required before it can be changed.

## Verification

- Local deployment smoke checks: 25 passed, zero failed; readiness and malformed recovery requests now return the expected statuses.
- Browser workflow acceptance: 17 passed, zero failed, including login, user/admin dashboards, payments, appointments, affiliates and all ten current templates with custom data at desktop/mobile widths.
- Root and backend production dependency audits: zero known vulnerabilities reported.
- Public desktop/mobile sweep: all 52 page/viewport checks passed, including ten supported Classic designs and ten legacy redirect pages at both widths; no reported browser/CSP errors or horizontal overflow. Third-party requests are blocked in local browser checks.
- Full regression (`npm test`): 87 passed, zero failed, including the new migration-preservation test. Final evidence: `test-results/readiness-regression-complete.log`.
- Live staging: all ten read-only HTTPS checks passed at 09:33 UTC, including health/readiness, home/login, public plans/templates, anonymous rejection from user/admin dashboards and environment-file protection. These checks do not establish the deployed commit or complete business acceptance.

Ignored local evidence is saved under `test-results/readiness-*`.

## Remaining server work

The staging host supplied by the owner is `test.syncecard.com` / `203.161.38.177`. An SSH connection reached it, but noninteractive login as root was rejected with `Permission denied (publickey,password)`. This workstation has no configured private key or active SSH agent. Supply the correct SSH username, port, accessible key-file path and deployed project directory, plus a designated staging inbox.

Once authenticated, inspect the deployed commit/image and run `node deploy/verify-staging.js` from the deployed project directory before changing the release. Verify the deployed migration ledger against that exact source. Review pending migration 078 and its catalogue/card/plan remapping against the actual database before applying it. Do not recreate healthy containers merely to inspect them.

Full sign-off still requires the server's production preflight/SMTP and notification scheduling checks, approved delivery rates, real inbox delivery, credential-rotation/revocation evidence, coordinated database/uploads backup and isolated restoration, controlled-restart persistence, physical QR/NFC acceptance and staged customer/admin journeys. See [staging sign-off](staging-signoff.md). No deployment or live business-data changes were performed in this repair.
