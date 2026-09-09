The backend serves the frontend and API on one origin. Open `/` through the Node server or an HTTPS reverse proxy. Local VS Code Live Server previews on HTTP ports 5500 and 5501 automatically use the backend on port 5000; the backend must be running. Other separate preview ports need an explicit API origin as described below.

From the repository root:

```sh
npm --prefix backend ci
node database/run-single-migration.js 063_add_password_recovery.sql
npm --prefix backend start
```

Migration 063 is additive and is required before running this version against an existing database. It adds recovery token storage and a user authentication version; do not rerun every historical migration against an existing production database. The migration has already been applied to the database configured in this workspace.

Configure backend environment variables through the deployment secret store or `backend/.env`:

- `NODE_ENV=production`, `PORT`, and the existing `DB_*` variables.
- A strong, unique `JWT_SECRET`.
- `PUBLIC_APP_URL=https://your-real-domain` at the domain root. Recovery links use this configured URL, never the incoming Host header.
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, and `MAIL_FROM` for working SMTP delivery.

Missing recovery URL or mail host configuration returns HTTP 503. Correctly formed requests return the same generic response for registered and unknown emails. Delivery errors are logged; the generic response alone does not prove delivery. Verify receipt with a disposable staging account. Links expire after 30 minutes, are usable once, and resetting invalidates existing sessions. Recovery requests are limited per process and per account; use a shared edge rate limiter when running multiple replicas.

Keep `backend/uploads` on persistent private storage. Forward site pages, public assets, and `/api` to the same Node server. Avoid exposing the repository root as a static directory. Do not commit production secrets. Tracked environment files and previously exposed credentials from the original review still require remediation.

For a separately hosted frontend, configure `window.SYNC_API_ORIGIN` before the shared resolver or add a `<meta name="api-origin" content="https://your-api-domain">` before its script. Configure that host's CSP and the API's CORS accordingly.

Verification:

```sh
npm run check:deployment
npm test
```

The smoke check makes read-only application requests. The recovery integration tests create a randomly named PostgreSQL schema, use disposable users and mocked email, and remove the test schema afterwards. They require database permission to create schemas; run them against staging or a development database. Tests passed with 24 smoke checks and 14 regression tests on 9 September 2026. Browser rendering and real SMTP delivery were not tested.

The other open findings in `deployment-review.md`, including subscription expiry and secret handling, still need resolution before full production sign-off.
