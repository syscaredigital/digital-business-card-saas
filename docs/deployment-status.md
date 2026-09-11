Status as of 11 September 2026: application fixes and deployment files are prepared; the public VPS launch has not been performed or verified.

Implemented and verified:

- Working local-preview and same-origin API routing; full site served by Express.
- Real password recovery with hashed single-use tokens, expiry, and old-session invalidation.
- Strong signing-secret requirement, auth input checks and request limits, production error masking, configurable CORS/proxy trust, database timeouts/TLS support, readiness checks, and graceful shutdown.
- Subscription date checks in user entitlements, card allowances, and billing, plus an expiry job. The final subscription date is inclusive.
- Safe fresh-database migration runner with a ledger. It refuses to replay old migrations over an untracked existing database. Default administrator credentials were removed.
- Manual-payment PostgreSQL type errors fixed; subscription payment submission and approval tested. NFC approval and shipment prerequisites tested.
- LKR revenue totals and CSV exports, frozen conversion rates, NFC inclusion, and explicit flags for missing/estimated historical rates.
- Local signing secret replaced; private environment files, legacy users, and payment slips removed from Git tracking. Local copies remain.
- Mobile login/register forms brought ahead of promotional content; template text no longer becomes broken image URLs.

Verification evidence:

- 25 deployment smoke checks passed; 120 JavaScript scripts parsed.
- Fresh database creation plus registration, dashboard access, role isolation, VCard editing/ownership, expiry, payments, NFC fulfilment, revenue conversion, and logout passed with disposable records.
- Recovery tests cover invalid/expired/reused tokens, concurrent submissions, and session invalidation.
- Desktop (1440px) and mobile (390px) browser checks passed for home, pricing, templates, NFC storefront, login, registration, and the corporate public template; no detected local HTTP failures, JavaScript exceptions, CSP errors, or horizontal page overflow.
- Real browser user/admin login and the LKR CSV download passed with isolated accounts.
- Live npm audit reported zero known vulnerabilities after dependency updates. The earlier sandboxed audit result was not reliable and was superseded by the online check.
- SMTP connection and authentication passed without sending a message. This does not prove inbox delivery.

Still required before public launch:

1. Configure the actual Namecheap VPS secrets, domain/DNS and HTTPS; build and run the supplied containers. Docker is unavailable on this workstation, so that build has not been executed here.
2. Supply the approved local and international NFC shipping fees in LKR. The configured database has no positive domestic delivery fee. International display currencies are supported, but a currency is not a delivery price. No amount was invented or charged.
3. Rotate credentials previously committed to Git history, especially database and SMTP credentials. The removal from tracking cannot revoke exposed credentials.
4. Import/restore existing business data and uploads together, verify backup restoration, then run production preflight and a disposable-account email-delivery check on the real domain.
5. Independently validate any business flows not covered above, including affiliate withdrawals/receipts and all supported appointment/email cases. Empty legacy company-admin-specific controllers and reminder-job placeholders are not certified as working features. Do not advertise those unimplemented features as part of launch.

No live deployment, real customer email, payment, or withdrawal was performed. Follow `namecheap-vps-deployment.md` for the launch procedure. The earlier `deployment-review.md` is a historical audit, not the current status.
