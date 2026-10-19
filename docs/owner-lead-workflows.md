# Card-owner inbox and email delivery

Implemented locally on 16 October 2026. This change does not deploy to the staging VPS or establish real inbox delivery.

## Owner workflow

| Visitor action | Owner dashboard | Owner email | Customer follow-up |
| --- | --- | --- | --- |
| QR scan | Scan notification and QR statistics | Anonymous scan alert | No visitor identity is inferred |
| Share details to download a contact | Lead in Enquiries, labelled Contact save | Submitted name, email/phone, company and inbox link | Owner can reply from the dashboard |
| Download without sharing details, when permitted by the owner | Download notification and statistics | Anonymous download alert | No identity is inferred |
| Send an enquiry | Lead in Enquiries with New/Replied/Closed status | Submitted message/details, inbox link and visitor Reply-To | Owner can send a reply from the dashboard |
| Request an appointment | Pending appointment and notification | Customer, time, service, notes and review link | Owner approves or declines; a customer email is queued with any host message |

The owner alone can access the lead/reply endpoints or decide on their appointments. An unrelated user or administrator cannot use these owner endpoints to read or change another owner's records. Administrator intervention is not part of the lead workflow. Manual subscription payments retain their separate payment-verification process.

The dashboard overview shows new leads and pending appointments. Notifications link to the relevant lead or booking. The Enquiries page includes type/status filters, reply history, read state and delivery status. The Appointments page supports an optional customer message for a meeting link, office details or rejection reason, and shows the queued email's status. Inbox lists refresh every 30 seconds while visible and no conversation dialog is open.

Customer email replies go to the owner's account email address through Reply-To. This does not synchronize inbound mailbox messages back into the dashboard; it is not a two-way chat service. Phone-only contacts can be reviewed and have their status updated, but cannot receive an email reply.

Owner alerts follow Settings → Email notifications (enabled by default). Turning owner alerts off does not cancel an explicitly requested reply or booking-decision email to a customer. Suspension/deactivation of the owning account prevents queue delivery.

A scan cannot identify a visitor. A VCF download also cannot prove that the operating system actually saved the contact. Named alerts use details voluntarily submitted with consent and describe a download request, not a verified device address-book save. Repeated scans/downloads from the same daily visitor hash are deduplicated for 30 minutes; repeated consented saves with matching contact details are deduplicated for 24 hours. Concurrent retries are serialized.

## Email reliability

Migration `079_owner_lead_workflows.sql` expands the notification-to-email trigger, adds explicit customer recipients/Reply-To to the outbox, and adds enquiry status, reply history and appointment notes. It does not replay historical notifications.

Lead creation and owner notification/outbox insertion commit together. Enquiry replies and appointment decisions also commit with their queued customer email. SMTP is not called inside those request transactions. Replies use a per-owner request UUID; repeating the same reply or appointment decision does not create another queued email.

The existing worker leases records, retries SMTP errors with backoff up to five attempts, and retains failed state. Pending means queued for delivery; Sent means the SMTP transport accepted the message, not that inbox placement was confirmed. An SMTP acceptance followed by a worker crash can cause a retry; SMTP does not provide a universal exactly-once guarantee. Review failures without exposing customer message bodies or SMTP credentials.

## Subscription verification

The workflow suite verifies registration/free-plan limits, paid submissions remaining pending before verification, preservation of current entitlements during review, approval activation, duplicate payment references and approval retries, server-calculated coupon totals, rejection/released coupon reservations, inclusive subscription expiry and expiry enforcement before the scheduled job. A 100% coupon is tested to activate a subscription with a zero-value approved payment and no transfer upload or administrator approval.

## Local verification and database change

- `npm test`: 94 tests passed, zero failures in the full run.
- `npm run check:deployment`: 25 checks passed, zero failures.
- `node tests/owner-workflows.test.js --browser`: seven checks passed, zero failures. Owner API and desktop/mobile browser coverage, with intercepted email delivery. Includes concurrency/deduplication, transaction rollback, unauthorized access, retryable failures, opt-out handling, reply delivery, appointment decisions and dashboard use.
- `node tests/production-workflows.test.js --browser`: eighteen checks passed, zero failures. Subscription, payment, permission and publishing workflows with disposable accounts/schemas.

Ignored evidence: `test-results/owner-full-regression.log`, `test-results/owner-workflows-browser.log`, `test-results/subscription-owner-regression.log`, `test-results/owner-deployment-check.log` and owner dashboard screenshots.

The local database was backed up to `backups/owner-workflows-1792151946712/database.dump` before applying the reviewed migration 079. Adjacent `migration.json` records the source checksum. The local historical migration ledger was not fabricated or changed. Local notification jobs remain disabled; no real emails were sent.

## Staging activation

1. Obtain authenticated server access and select the exact release. Coordinate the database/uploads backup and stop old application writers/workers during the migration/release change. Review migration 078 as well if staging is still on the previously reported twenty-template release; it remaps cards/plans and retires old templates.
2. Apply pending reviewed migrations using the verified migration ledger for the selected release, then deploy the matching application code. Existing SQL migrations must not be edited or given invented checksums. This migration does not repair a missing historical ledger.
3. Verify SMTP connection/authentication with `node backend/preflight.js --smtp` in the application container. Configure `PUBLIC_APP_URL` to the real staging HTTPS origin so email links reach the dashboard.
4. Inspect pending/failed queue counts and existing recipients before enabling delivery on staging. Use designated test owner/customer inboxes for acceptance; avoid releasing an unknown historical queue to real customers.
5. Configure exactly one scheduling method: `NOTIFICATION_JOBS=true` starts the in-process worker every minute, or keep it false and schedule `node backend/jobs/run-jobs.js` externally. Concurrent workers use leases, but a functioning scheduler is still required. Do not mark delivery working merely because rows are queued.
6. Verify actual owner alerts, customer replies and approval/rejection messages arrive, Reply-To reaches the expected person, failed deliveries remain visible, and the normal owner can complete the entire journey without administrator access. Retain those sanitized acceptance results with the deployment record.

SSH authentication and real delivery acceptance remain outstanding for staging. See [staging sign-off](staging-signoff.md).
