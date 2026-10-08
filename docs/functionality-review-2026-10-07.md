# Functionality review — 7 October 2026

Scope: current source, route wiring, editor/renderer behavior, automated-test
entry points, and existing deployment records. This is not a live-server audit.
No production data, email, payments, or deployment configuration was changed.

## Confirmed gaps to address first

| Priority | Finding | Required work / acceptance |
| --- | --- | --- |
| P1 | Editor/plan features exceed final-template support. `backend/config/vcard-features.js` advertises 20 keys, but `frontend/public/assets/js/final-vcard.js` does not consume blogs, Instagram content, custom links, iframes, advanced information, custom fonts, SEO, privacy policy, terms, or manage-section content. QR customization is ignored; banners only provide the first fallback cover image. Classic pages do not load the alternative feature renderer. | Render supported saved fields across templates, or explicitly limit editor/plan offerings. Test each feature with saved content, empty content, and expired entitlements. A successful save must not silently discard information from the public view. |
| P1 | Section photos can attach to a new row instead of the intended existing row. `initializeVcardImageEditors` searches the images array for an empty slot; when it is empty, existing text rows are never searched and the upload creates another row. Images are also tied to line indexes, making text-row edits fragile. | Search content rows for empty image slots; preferably use structured items with stable identifiers. Verify first upload, multiple uploads, deletion, reordering, and reload. The first-upload index failure was reproduced with the current algorithm. |
| P1 | Appointment creation validates card activation, service and conflicts, but reads raw saved appointment settings without the active-plan filtering used by public GET. | Enforce current appointment entitlement at the POST endpoint, including expired subscriptions and cards without an enabled appointment section. Add direct-request tests; hiding the form is insufficient. This is a source finding, not a live exploit test. |
| P1 | New classic layout/contact regressions are outside both `npm test` and `check:phase2`. CI runs `npm test` only. | Add a browser CI stage with a supported installed browser; include classic content, cookie/contact download, and all classic interaction tests. |
| P2 | Editor can replace profile/cover images but has no explicit removal flow; save falls back to the existing image. | Add remove/reset controls and explicit server-side clear semantics. Verify after reload. |
| P2 | Appointments accept a date/time in the visitor's browser timezone, without an explicit business timezone or availability endpoint. Conflict checks exist, but opening-hour enforcement and selectable available slots are absent from this flow. | Add business timezone, availability/closed days and clear timezone labels. Decide whether visitor cancellation/rescheduling is in scope. |
| P2 | Card SEO values are not used by the final renderer, and the public slug handler serves template HTML with a base URL and card ID rather than card-specific share metadata. | Generate card-specific title, description, canonical URL and Open Graph image in the HTML response; verify social link previews. |
| P2 | Requirements, API documentation and user guide files are empty. README still points to cPanel as current while the latest staging handoff reports Docker/VPS. | Record supported functionality and limitations, document APIs and user/admin journeys, and make deployment instructions consistent. |

## Implemented, but still needs live acceptance

Source already contains registration/login/recovery, user/admin controls, card
CRUD, QR/VCF, analytics, enquiries, appointment requests, subscriptions, manual
payment review/coupons, NFC orders/fulfilment, affiliate commissions/withdrawals,
storage checks, email outbox and reminder workers. Do not classify these as
missing solely because staging sign-off is pending.

The latest recorded handoff reports healthy staging, migrations through 077 and
20 registered templates. Verify the deployed commit includes the recent layout
and cookie fixes; deployment cannot be established from this checkout.

Before launch, close the evidence gates in `staging-signoff.md`:

- Real-device iPhone/Android contact import, physical QR/NFC scanning, and public
  actions with and without a login session.
- Actual recovery/booking/billing inbox delivery, worker scheduling and retries.
- Payment approval/rejection/retry, coupon totals, subscription expiry and access.
- Approved NFC shipping rates, inventory, tracking and fulfilment.
- Affiliate withdrawal/receipt/balance acceptance.
- Backup plus isolated restore of database and uploads; persistence after restart.
- Historical credential revocation, deployed preflight and migration checks.

## Optional expansion — not existing v1 commitments

- Online payment gateway and automatic recurring charges: current billing is a
  manual proof/review workflow, not an integrated gateway checkout.
- Email verification and administrator MFA: not found in the current auth routes.
- Customer account export/deletion UI and corresponding authenticated workflows.
- Company/team administration and newsletter subscription: explicitly excluded
  from v1 in the current launch records, despite legacy files remaining.

## Evidence and suggested order

This review ran the security configuration and frontend-origin suites: 15 tests
passed. Full database workflows and live deployment checks were not rerun.
Earlier classic browser results remain historical evidence, not new results here.

Recommended sequence: fix editor-to-template feature parity and photo mapping;
enforce booking entitlement at the API; include regressions in CI; verify the
deployed release on real devices; complete email, billing and recovery sign-off.
Then improve scheduling and share previews before adding optional new products.
