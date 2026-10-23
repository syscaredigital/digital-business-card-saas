Production domain: https://syncecard.com. Hosting: cPanel / Passenger on the existing VPS.

Use [the cPanel deployment guide](cpanel-deployment.md) for the application setup. Configure the root DNS A record (`@`) with the existing VPS public IPv4 address, add the domain to cPanel, issue AutoSSL, and enable HTTPS redirection. Keep application source outside public_html. Configure any www alias to redirect to https://syncecard.com using the host's domain redirect settings after adding DNS and TLS for that alias.

Use Node.js 22, Production application mode, startup file `app.js`, the domain `syncecard.com`, and an empty URL path. Install dependencies using cPanel's Run NPM Install. Deploy the complete release, preserving existing database and uploads.

The private, ignored `deploy/cpanel.production.env` is prepared locally. Transfer its values securely to cPanel's environment editor or the server's private `backend/.env`; it is excluded from release archives. Confirm the actual server database host, database name, user, password, TLS and proxy settings before using it: its database settings came from the local backend. Do not overwrite a working production database configuration with local settings. `PUBLIC_APP_URL` must be `https://syncecard.com`. SMTP continues to send from the verified `info@syncecard.lk` mailbox.

Keep `NOTIFICATION_JOBS=false` for Passenger. Cron does not automatically inherit environment variables from cPanel's application editor: supply the same database, SMTP and application settings in the server's private `backend/.env` (restricted to the account owner), which the job runner loads. Add one cPanel cron job every minute (`* * * * *`), using absolute paths supplied by the Node.js App screen:

```sh
cd /home/CPANEL_USER/syncecard-app && /ABSOLUTE/PATH/TO/APP/NODE backend/jobs/run-jobs.js >> /home/CPANEL_USER/syncecard-notifications.log 2>&1
```

Replace both placeholder paths with the real account and Node environment paths. Store logs outside the public document root. Restart the application after setting environment variables.

Run from the server's application root with its Node environment activated:

```sh
node deploy/verify-production.js
```

Current local launch blockers: the migration ledger is missing, and the domestic NFC delivery fee is unset. Resolve database history using the reviewed migration procedure; do not replay old migrations or fabricate ledger entries. Configure approved domestic and international NFC fees in super admin. Confirm these checks against the actual production database, which may differ from the local database.

Before launch, verify login, registration, password-reset inbox delivery, public VCard links/QRs, and payment approval through shipment/completion using designated test accounts. Verify cron execution and outbox delivery, HTTPS, private-file protection, database/upload backups and restore recovery. Preserve redirects for previously shared staging-domain VCard links if needed. Local configuration changes do not publish the site or alter DNS.
