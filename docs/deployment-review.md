Deployment review — 9 September 2026

Update after fixes: the seven original failures are resolved. The full smoke check now passes 24/24, and `npm test` passes 14 tests, including isolated PostgreSQL recovery lifecycle tests. Frontend API URLs now use the shared origin resolver; the site pages are served by Express; password recovery is implemented with hashed, expiring, single-use tokens and session invalidation. Migration 063 was applied to the configured database. Relative SQL includes were corrected. Inline page scripts receive CSP hashes. SMTP delivery was mocked in tests and still needs a real staging verification. The historical findings below describe the original review; subscription expiry, tracked secrets, JWT fallback, and the other unaddressed findings remain open.

Deployment decision: not ready for production sign-off.

The original review used the checkout and configured database without modifying business records or sending emails. The follow-up applied the additive password-recovery migration and tested changes against isolated tables. No deployment or real-user password reset was performed.

Run `npm run check:deployment` from the repository root after installing backend dependencies. The check starts its own temporary HTTP server and uses the configured database. It currently exits with failure: 17 checks passed and 7 failed. It is a smoke check, not a complete functional test suite.

Confirmed working in this environment:

- 109 external and inline JavaScript scripts parsed without syntax errors.
- PostgreSQL connection and a basic query succeeded.
- Health, public plans, currencies, NFC products, and VCard template endpoints returned HTTP 200.
- The public corporate VCard HTML was served successfully. Rendering and card interaction were not browser-tested.
- Sample user and super-admin endpoints rejected anonymous access with HTTP 401.
- An invalid public VCard ID returned HTTP 400; requests for environment files and a nonexistent upload returned HTTP 404.
- No subscriptions currently have both active status and a past end date.

Confirmed blockers and gaps:

| Priority | Finding | Evidence and consequence |
| --- | --- | --- |
| Critical | Environment files are tracked in Git | `git ls-files` includes `.env` and `backend/.env`; `.gitignore` is empty. Review exposure, remove secret files from tracking, and rotate any credentials committed to shared history. Deleting a file in a later commit does not remove historical secrets. Secret values were not printed in this review. |
| High | Browser API URLs depend on the developer's machine | `frontend/public/assets/js/auth.js:79` hardcodes login to `http://127.0.0.1:5000`; registration at line 271 forces port 5000. `dashboard.js` contains many hardcoded loopback API calls. Visitors on the deployed website would contact their own machine. Other frontend API-origin implementations also need consolidation and verification. |
| High | A backend-only deployment does not serve the full site | `/`, `/pages/website/home.html`, `/pages/auth/login.html`, `/pages/user/dashboard.html`, and `/pages/super-admin/dashboard.html` all returned 404. `backend/app.js` only mounts public assets and public VCard pages. A separate frontend host/proxy could resolve this, but no working deployment configuration is supplied. |
| High | Password recovery is a mock flow | `frontend/public/assets/js/auth.js:113–180` shows success alerts without requesting a reset or changing a password. Auth routes only register login, registration, and logout. Both recovery endpoint probes returned 404. |
| High | Subscription expiry is not enforced in the reviewed entitlement query | `backend/controllers/user.controller.js:16–21` selects active subscriptions without testing `end_date`. `backend/jobs/subscription-expiry.job.js` is empty. An active subscription can continue granting entitlements after its end date unless another mechanism updates its status. No overdue rows exist now, which does not verify future expiry behavior. |
| High | Predictable JWT fallback | Both auth controller and middleware use `process.env.JWT_SECRET || "devsecret"`. Production must refuse to start with a missing or weak signing secret; the current fallback makes a misconfigured deployment unsafe. |
| High | Database setup command has relative-path issues | `database/run-db.js` invokes `psql -f` without setting its working directory, while `run-migrations.sql` uses `\i migrations/...`. The root npm command runs outside the database directory. The seeds file also mixes slash and backslash paths. Fresh setup must be corrected and tested against an isolated database before release. No migrations or seeds were executed in this review. |
| Medium | Deployment and regression infrastructure is incomplete | The six original test files, README, deployment guide, and Docker Compose file are empty. Root and backend `npm test` scripts deliberately exit with an error. The new smoke check does not replace workflow tests. |
| Medium | Other background jobs and company-admin backend are placeholders | Email notification and payment reminder job files and the company-admin route file are empty; company-admin routes are not mounted. Treat these as unavailable if included in the intended product scope. |
| Medium | Production error responses expose internal messages | `backend/app.js` returns `err.message` even for unexpected server errors. Keep detailed errors in server logs and return generic messages for unexpected production failures. |
| Medium | Authentication validation and abuse protection need completion | The auth validator file is empty and is not mounted. Registration checks required fields but does not enforce a server-side email format/password-strength policy. No application-level login rate limiter was found in the mounted authentication flow. |
| Medium | Migration and runtime environment precedence differ | App startup loads the working-directory `.env` first, then backend `.env` without override. `database/run-db.js` lets backend `.env` override process environment. The effective configuration can differ between launch locations and migration execution. |

Still unverified:

- Real registration, login/logout/session revocation, and password recovery through a browser.
- Role isolation, ownership checks, VCard creation/editing/deletion, public links, QR scans, downloads, and storage limits.
- Manual subscription payment submission/approval/rejection, coupon redemption, currency totals, and duplicate/concurrent requests.
- NFC ordering, proof uploads, approval, delivery, inventory, and cancellation.
- Affiliate commissions, withdrawal approvals, and receipt download permissions.
- Appointment conflicts, approvals, enquiry delivery, SMTP delivery, and failure recovery.
- Browser layout, console errors, CSP compatibility, HTTPS, proxy configuration, production database TLS, backups/restoration, upload persistence, dependency vulnerabilities, load, and graceful restarts.

Use an isolated staging database and disposable accounts for these write flows. A passing GET request proves reachability only, not the correctness of checkout, permissions, persistence, or email delivery. Production sign-off requires the blockers above to be resolved and the relevant complete user journeys to pass on the actual deployment configuration.
