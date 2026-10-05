# Launch readiness — 28 September 2026

Update, 5 October 2026: the supplied deployment handoff reports successful Docker/VPS staging deployment, HTTPS health/readiness, migrations through 077 and templates 1–20. See [staging sign-off](staging-signoff.md) for the current evidence register and safe read-only checks. Those reported results supersede earlier deployment uncertainty; production acceptance remains pending. Dependency-index cleanup is complete in this checkout (`git ls-files backend/node_modules` returns no files). The September review and its checkboxes below are historical, not a new staging verification.

Decision: source features are present, but public launch still requires staging evidence. This review inspected repository code and documentation; it does not certify the live server or external credentials.

| Area | Verified repository state | Launch implication |
| --- | --- | --- |
| Product | Public cards, QR/NFC, user/admin pages, subscriptions, payments, appointments, analytics and affiliate code are present. | Presence is not end-to-end acceptance; verify the journeys below. |
| Security | Authentication checks recorded sessions; browser cookies are HttpOnly; receipt uploads are parsed/re-encoded; rate limits use PostgreSQL; migrations use checksums. | Confirm these controls on the deployed release. Historical credential revocation cannot be established from source. |
| Scope | Company administration is blocked in `backend/app.js`; newsletter signup was removed. | Exclude both from sales promises for this release. Transactional notification workers are implemented but need delivery verification. |
| Deployment | `test.syncecard.com` is the documented target. cPanel/Passenger and Docker have separate instructions. | Select one hosting procedure and validate its environment, storage and worker configuration. `deploy/production.env` is the private Docker configuration; cPanel uses `deploy/cpanel.env.example`. |
| Dependencies | The initial review found 3,048 tracked files under `backend/node_modules`; ignore rules and both lockfiles already exist. | Remove these files from the index, preserve installed local copies, and install from lockfiles on fresh checkouts. |

## Prioritized acceptance checklist

Record the release commit, environment, date, operator and evidence for each completed item. Open boxes mean unverified, not necessarily broken.

### P0 — before public launch

- [ ] Rotate historically committed database and SMTP credentials, signing secrets and reused passwords at their providers; update deployment secrets and confirm old credentials fail. Removing files from Git does not revoke them.
- [ ] Confirm the hosting choice and HTTPS origin, DNS, proxy trust, private upload storage and effective environment. Keep secret values out of logs and review artifacts.
- [ ] Review the deployed migration ledger and historical checksum baseline, reconcile any duplicate manual-payment transactions, apply approved pending migrations, and run `node database/migrate.js --verify`. Follow [the upgrade procedure](audit-remediation.md); do not seed an unknown existing database.
- [ ] Run production preflight in the deployment environment and confirm `/health` and `/ready` succeed over HTTPS. The HTTP 500 observation in the September 22 audit is historical and has not been rechecked here.
- [ ] Back up database and uploads together, restore into an isolated environment, validate receipt references and rehearse rollback. Use the backup procedure appropriate to the selected hosting setup; the supplied Docker scripts require Linux/Docker.
- [ ] Verify actual inbox delivery for recovery and transactional notifications with disposable staging accounts; verify worker scheduling, retries and failed-message monitoring.

### P1 — staging business acceptance before selling supported features

- [ ] Register, log in/out, reset/change passwords, invalidate old sessions and check user/admin ownership boundaries and browser cookie behavior.
- [ ] Create/edit a card; open its public URL, scan its QR code and NFC link, download contact details and verify plan/storage limits.
- [ ] Submit/approve/reject subscription payment proofs; check duplicates, retries, coupons, totals, currency conversion and expiry.
- [ ] Complete NFC ordering, approved shipping fees, receipt review, inventory, shipment and cancellation.
- [ ] Exercise appointment conflicts, approval and email delivery; check analytics against the performed actions.
- [ ] Verify affiliate commission accounting, withdrawal reservation/approval and receipt access permissions.
- [ ] Check desktop/mobile rendering, browser errors, CSP, upload persistence, restarts and monitoring on the real staging origin.
- [ ] Confirm public copy excludes company administration and newsletter subscriptions.

### P2 — release hygiene

- [ ] Commit the dependency-index cleanup with these documentation updates. Verify `git ls-files backend/node_modules` is empty; installed local files should remain available.
- [ ] Verify a fresh checkout installs using `npm ci` for cPanel or `npm --prefix backend ci` for backend-local development. Run the full regression suite only against an isolated nonproduction database.
- [ ] Build the release archive and inspect it for private data; verify the selected hosting build and dependency audit before deployment.

## Verification in this review

- Removed 3,048 dependency files from the Git index; `git ls-files backend/node_modules` now returns zero files. Local dependencies remain installed and ignored. The removals are staged, not committed.
- `node --test tests/security-config.test.js tests/frontend-deployment.test.js`: 15 passed, zero failed. These checks cover environment/auth validation and frontend API-origin selection.
- `git diff --check` passed. Full database workflows, fresh dependency installation, browser acceptance and live deployment checks were not run in this review. No production environment values were changed.

See [cPanel deployment](cpanel-deployment.md), [Docker/VPS deployment](namecheap-vps-deployment.md), and [source remediation evidence](audit-remediation.md). Earlier test counts in deployment records are historical, not results from this review.
