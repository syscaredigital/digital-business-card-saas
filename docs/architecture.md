# Application structure

## Backend boundaries

`backend/app.js` composes middleware and routes. User routes authenticate once;
admin routes require authentication and the super-admin role. Resource handlers
must scope SQL to the authenticated owner or explicitly check administrator access.

- `controllers/user/`: account, appointments, dashboard, contacts, orders, NFC,
  affiliates, subscriptions, notifications and cards.
- `controllers/super-admin/`: users, dashboard, cards, NFC, subscriptions/plans,
  payments, transactions, payouts, withdrawals, affiliates, coupons, analytics,
  reports, settings and logs.
- The original `user.controller.js` and `superAdmin.controller.js` are small
  compatibility export modules. Do not add new business logic to them.
- `services/`: shared subscription/entitlement policy, storage, revenue, mail,
  commission generation and payout transaction synchronization. Pass the existing
  transaction client into financial helpers; do not open a second transaction.
- `validators/`: reusable input parsing. Appointment validation runs before
  database access; card content normalization is shared by the card controller.
  Remaining domain-specific validators live beside their handlers until reused.
- `middlewares/`: authentication, role checks, browser-session protection,
  receipt parsing, rate limiting, request logging and the final error handler.
- `helpers/metrics.helper.js`: common numeric reporting conversion and percentage
  calculations. Filesystem paths in nested controllers must resolve from the
  backend root, not assume the controller is immediately below that root.

Do not introduce empty model/service/controller files to suggest unimplemented
architecture. SQL remains parameterized inside domain controllers/services; a
repository layer should be introduced for genuinely shared queries, not wrappers
that only forward one call. Existing transactions and locks must stay intact.

## Public cards

`vcard-api-origin.js` resolves the backend. `vcard-public-api.js` owns public API
destination checks, credential omission and common connection/response errors.
Public actions must use this client; account APIs continue to use `SyncSession`.

`final-vcard.js` renders card content, theme files decorate it, and
`classic-layout.js` applies shared Classic layout/accessibility enhancements.
`classic-layout.css` provides responsive shared layout while theme CSS retains
visual identity. Deploy script includes and new assets together.

## Authorization and concurrency

Current subscription access means active status, a start date on/before today,
and no end date or an end date on/after today. Use `currentSubscription()` for
current access and current subscriber metrics. Status-only queries remain valid
for lifecycle transitions and historical records; do not mechanically replace them.

Appointment creation checks configured services and current plan entitlement,
then serializes overlapping booking checks using the existing owner advisory lock.
Payment approval and affiliate commissions retain their transaction locks and
deduplication. These were verified with isolated concurrency/retry tests; no new
schema constraints or migration were needed for this cleanup.

## Tests and logging

Startup validates runtime ports, pool capacity, boolean switches and the configured
time zone. Both startup and production preflight exercise receipt-storage
create/write/remove permissions using a temporary probe. A failed storage probe
blocks startup rather than accepting traffic with broken receipt uploads.
Preflight remains read-only for business records, but writes and cleans up that
temporary filesystem probe. Run it as the same OS user as the application.

`npm test` discovers every nonempty `tests/*.test.js` file and runs isolated test
processes. It refuses production or non-local database configuration. GitHub CI
installs Chromium; locally Edge is the default, or set `BROWSER_CHANNEL`.

The suite includes all Classic interactions/migrations, field/photo mapping,
cookie/contact downloads, recovery, ownership, billing, uploads and booking tests.
The admin endpoint sweep also checks that normal users are rejected.

Structured logs include a generated request ID, method, path without query string,
status, duration, authenticated user ID and error type/code. Never log request
bodies, cookies, authorization headers, password/reset tokens, or database errors
containing user data. The error middleware hides production internal details.

## Review disposition

The supplied reviews' test-discovery, public-client, subscription-policy,
logging/error-handler, empty-placeholder and controller-structure findings have
been addressed. Receipt upload endpoints already share the parser and protected
download checks. Session validation already verifies revocation, expiry and auth
version. Booking concurrency and payment retry safeguards already existed and
were preserved, with appointment entitlement enforcement added.

Company administration and newsletter remain deferred. This cleanup does not
certify production configuration, inbox delivery, device contact imports, or
deployment. Further formatting and domain-specific validation extraction can be
incremental; the project is not claimed to be free of every possible defect.
