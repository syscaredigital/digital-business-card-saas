Deployment target: https://test.syncecard.com using cPanel Setup Node.js App on your VPS.

Before creating the Node application:

1. At the authoritative DNS provider for `syncecard.com`, create an A record named `test` pointing to the VPS public IPv4 address. An existing record should be checked rather than duplicated. Only add an AAAA record if this VPS has working IPv6.
2. In cPanel Domains, create `test.syncecard.com` if it does not already exist, with its own document root. Keep application source in the separate application root shown below, outside `public_html` and outside the subdomain's static document root.
3. In cPanel SSL/TLS Status, run AutoSSL for the subdomain after DNS resolves to this VPS. Check that HTTPS works, then enable the HTTPS redirect. Ports 80 and 443 must reach the VPS web server.
4. Confirm that Setup Node.js App offers Node.js 22.x. If this screen is missing or only offers old versions, have the VPS administrator enable a supported Node.js/Passenger integration in WHM. The instructions below assume the Setup Node.js App interface from your screenshot; cPanel Application Manager is a different interface.
5. Create a separate PostgreSQL database and user for this test installation, with ownership/permissions to create tables, sequences, and indexes. Use PostgreSQL Databases in cPanel if available; otherwise the VPS administrator must provision PostgreSQL or supply an external service. Do not point this test site at the live customer database.

For PostgreSQL on the same VPS, use the actual host (commonly `127.0.0.1`), port `5432`, and the database/user names assigned by cPanel, including any account prefix. Set `DB_SSL=false` only if that local PostgreSQL connection is configured without TLS. For a remote service, follow its TLS requirements. PostgreSQL port 5432 does not need to be publicly exposed for a local application connection.

Use these settings in the Create Application screen:

| Field | Value |
| --- | --- |
| Node.js version | 22.x (latest patch offered by the host) |
| Application mode | Production |
| Application root | test.syncecard.com |
| Application URL domain | test.syncecard.com |
| Application URL path (box beside domain) | Leave empty; use `/` if the panel requires a value |
| Application startup file | app.js |

The text `HTTPS` in the screenshot is in the URL path field. Remove it. Enable the certificate for this subdomain through cPanel SSL/TLS or AutoSSL, and enable the host's HTTPS redirect. Node.js 10 cannot run this application. If 22.x is unavailable, ask the host to enable it before deploying.

Create the application, then upload and extract the release contents directly into the application root shown by cPanel. `app.js`, `package.json`, `package-lock.json`, `backend`, `frontend`, and `database` must be siblings, without an additional archive directory. Keep the host-generated Passenger configuration. Do not upload local `node_modules` or local environment files. cPanel manages its dependency directory; use Run NPM Install from the application screen after uploading. Root dependencies are available to backend modules through normal Node module resolution. The backend-only manifest remains available for local development and Docker.

Configure environment variables using `deploy/cpanel.env.example`. Set `PUBLIC_APP_URL=https://test.syncecard.com` exactly, without a trailing path. Supply real PostgreSQL and SMTP credentials and a new random signing secret. Keep the SMTP sender authorized by your mail provider; changing the website domain does not change the mailbox. Use cPanel's environment editor, or a private `backend/.env` file with restricted permissions. Do not use the Docker environment example for the cPanel database settings.

This application uses PostgreSQL, not MySQL. Confirm that the account offers PostgreSQL or can connect to an external PostgreSQL service. For a remote database, use the provider's TLS settings and allow the hosting server's connection. PostgreSQL connectivity and privileges are required before the application can start.

Open cPanel Terminal/SSH and activate the Node environment using the exact command displayed in the application screen. Change to the application root. For a NEW EMPTY database only, run:

```sh
node database/migrate.js --seed
```

For an existing database, restore a verified backup and matching `backend/uploads` files instead. Do not replay all migrations or seed over an existing untracked database. Apply only reviewed missing migrations. Preserve uploads and make the uploads directory writable by the application user. Back up database and uploads together before changes.

To bootstrap a new installation, temporarily configure `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` (at least 12 characters), then run `node backend/seed-super-admin.js`. Remove the bootstrap variables afterwards. Terminal commands must have the same environment variables as the web application; if the host only injects them into Passenger, use the private `backend/.env` option for these commands.

Restart the application in cPanel. Configure bank details, approved NFC shipping fees, and paid products/plans through the administrator account before accepting customers. Run:

```sh
node backend/preflight.js --smtp
curl --fail https://test.syncecard.com/ready
```

Then verify login, a public card/QR link, password-reset email delivery, and a test payment/NFC workflow on the real domain. SMTP authentication alone does not prove inbox delivery. The previous feature gaps in `deployment-status.md` still apply. Passenger may stop idle application processes; in-process reminder/expiry scheduling is not a guaranteed always-running scheduler, although entitlement queries independently enforce subscription dates.

Keep application source, private files, backups, and uploads outside any independently served static document root. If cPanel maps the application root directly as a static document root, ask the host to ensure private paths are denied. Verify `/.env`, `/backend/.env`, `/package.json`, and `/uploads/payment-slips/nonexistent.pdf` are not publicly served before launch.

The local release is prepared for this layout; the actual cPanel installation, PostgreSQL access, certificate, and live domain have not been verified. Use designated test accounts and test payment references. Existing QR codes or links already shared using a previous domain will still reference that old domain; regenerate them or retain a redirect if needed.

Reference: [Namecheap's Setup Node.js App guide](https://www.namecheap.com/support/knowledgebase/article.aspx/10047/2182/how-to-work-with-nodejs-app/).
