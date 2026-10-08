# Sync E-Card

Node.js/PostgreSQL digital business cards, subscription payments, NFC orders, and administration.

- [Current deployment status](docs/deployment-status.md)
- [Application architecture and module boundaries](docs/architecture.md)
- [Prioritized launch readiness checklist](docs/launch-readiness.md)
- [cPanel deployment for test.syncecard.com](docs/cpanel-deployment.md)
- [Alternative VPS deployment](docs/namecheap-vps-deployment.md)
- [LKR revenue reporting](docs/revenue-reporting.md)

Local development: install dependencies with `npm ci` and `npm --prefix backend ci`, configure `backend/.env` using `.env.example`, and run `npm --prefix backend start`. Open `http://localhost:5000/`. VS Code Live Server on ports 5500/5501 is also supported while the backend is running.

Before deploying, run `npm test` against a local disposable database. On the deployment host, run `npm run check:production -- --smtp` with the intended production environment. This verifies configuration, migration state, required business settings, receipt storage permissions and SMTP connectivity; it does not send email or prove inbox delivery. Startup refuses invalid runtime configuration and unwritable receipt storage. Complete the launch checklist and verify the live HTTPS journeys before opening production traffic.

Run `npm test` for isolated database and regression checks, `npm run check:deployment` for read-only smoke checks, and `npm run check:browser` for public desktop/mobile checks using an installed Microsoft Edge browser. The database tests create and remove disposable schemas; do not use production credentials for tests.

Build a private-data-free release archive on Windows with `powershell -File deploy/build-release.ps1`. For the current hosting target, follow the cPanel guide. The release includes the root `app.js` entry point and dependency manifest for cPanel's Run NPM Install action.
