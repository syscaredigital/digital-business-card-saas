# Phase 2 acceptance: local verification

Date: 5 October 2026. These checks exercise this checkout against disposable schemas in a local PostgreSQL database. They do not certify the deployed staging image.

Final local evidence (06:28 UTC): all six suites reported exit code 0; 56 automated tests passed with zero failures. The public/auth/template sweep completed 52 page/viewport checks with no reported problems. The workflow suite additionally opened all 20 selected templates with custom card data at desktop and mobile widths. The structured result is `test-results/phase2-summary.json`; console evidence is `test-results/phase2-final.log` (both local ignored artifacts).

## Fix

Public card sections previously used the latest subscription marked `active` without checking its start or end date. A regression test reproduced paid sections remaining visible after expiry. The public card query now uses the same subscription-date policy as the editor and billing: future subscriptions grant no features, expired subscriptions grant no features, and the final subscription date is inclusive. No database migration is required.

## Repeatable checks

```sh
npm run check:phase2
```

Requires the installed dependencies, local nonproduction PostgreSQL configuration and Microsoft Edge (or `BROWSER_CHANNEL` where supported). The runner rejects a non-local or production database configuration. Each database suite uses disposable schemas; migrations and fixtures are applied only there. Test receipt files are removed on cleanup. Appointment and password-reset delivery are intercepted in tests; no real inbox delivery is asserted.

The runner executes each suite in its own process and writes exit-status evidence to `test-results/phase2-summary.json`. Browser screenshots are in `test-results/`. Browser rendering checks block third-party requests so a font/image provider outage cannot stall local acceptance; deployed external assets still need verification.

| Area | Automated coverage |
| --- | --- |
| Authentication | Registration validation, login/logout, password recovery expiry/reuse/concurrency, password changes, session invalidation, browser cookie login, user/admin isolation |
| Cards and limits | Create/edit/ownership, concurrent free-plan limits, subscription expiry, public section entitlement dates, template selection and public slug redirects |
| Contact and analytics | QR endpoint, consent-gated VCF download, contact contents, QR event recording and duplicate suppression |
| Payments | Pending approval, duplicate references, concurrent approval retries, currency conversion/revenue export, server-calculated coupon totals, rejection and redemption release |
| NFC | Shipping total, approval before shipment, tracking requirement, final state transitions, rejected payment cancellation and blocked later approval |
| Appointments | Concurrent conflict rejection, ownership, approval/retry with one intercepted email, rejection releasing the slot |
| Affiliates | Commission generation/deduplication and admin approval; concurrent withdrawal reservation; approval/rejection balance handling; receipt required for completion; receipt upload/download ownership; one paid payout record |
| Templates | All 20 previews at 1440px and 390px; all 20 selected through the API and opened via the public slug with custom titles; browser errors, CSP and horizontal overflow checks |
| Uploads | Valid PNG/JPEG/WebP/PDF parsing, corrupt/spoofed/oversized/active-content rejection, private receipt routes and ownership |

The local test database is not the staging database. SQL fixture setup for plans, referral relationships and test accounts does not establish that their admin creation screens have passed browser acceptance.

## Remaining staging sign-off

- Deploy the reviewed fix to the selected staging release and repeat the customer/admin journeys using disposable accounts.
- Verify real inbox delivery, sender configuration and notification scheduling for the relevant flows.
- Verify approved domestic/international delivery rates, inventory operations and a physical QR/NFC scan on intended devices.
- Verify deployed upload persistence through a controlled container restart, plus receipt permissions on that deployment.
- Complete browser interaction/visual acceptance for card editing, social links, custom images, booking forms, payment/affiliate administration and storage limits. The automated template sweep is not a full browser interaction test for every control.
- Check external assets on the staging origin and intended mobile browsers; local checks use desktop Edge with mobile viewport sizes.

The previous SSH attempt reached staging but failed authentication. Live mutation/acceptance has not been performed. See [staging sign-off](staging-signoff.md) for the broader evidence register.
