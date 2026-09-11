# Sync E-Card

Node.js/PostgreSQL digital business cards, subscription payments, NFC orders, and administration.

- [Current deployment status](docs/deployment-status.md)
- [Namecheap VPS deployment for syncecard.lk](docs/namecheap-vps-deployment.md)
- [LKR revenue reporting](docs/revenue-reporting.md)

Local development: install dependencies with `npm --prefix backend ci`, configure `backend/.env`, and run `npm --prefix backend start`. Open `http://localhost:5000/`. VS Code Live Server on ports 5500/5501 is also supported while the backend is running.

Run `npm test` for isolated database and regression checks, `npm run check:deployment` for read-only smoke checks, and `npm run check:browser` for public desktop/mobile checks using an installed Microsoft Edge browser. The database tests create and remove disposable schemas; do not use production credentials for tests.

Build a private-data-free release archive on Windows with `powershell -File deploy/build-release.ps1`. Production setup and the remaining launch checks are documented in the VPS guide.
