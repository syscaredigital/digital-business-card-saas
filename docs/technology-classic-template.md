# Technology Classic — template 18

Adapted from the supplied dark grid web developer HTML. It includes a lime accent, prominent portrait, skills derived from configured services, contacts, alternating project cards, gallery viewer, testimonials, hours, QR download and enquiries. The malformed source markup and font URL are corrected. Published cards use saved owner data and do not claim the pasted page's unverified experience, project or satisfaction totals.

Preview: `/pages/public-vcard/final-18-technology-classic.html`.

Deploy the frontend files and migration `075_add_technology_classic_template.sql` together. With a reviewed migration ledger, run `node database/migrate.js`, then `node database/migrate.js --verify`, and restart the app. Plans with Technology Expert (template 3) receive Technology Classic; other plan restrictions and existing cards are preserved. The database assigns its ID automatically; 18 is the design number.

Select **Technology Classic** in the editor after migration. Services, products, gallery, testimonials, hours and appointment services use the existing section fields. The gallery opens in a keyboard-accessible dialog. Published-card booking and enquiry forms send real requests, QR download uses the public endpoint, and contact saving respects the owner's preference. Sample projects and reviews appear only in preview mode.

The configured local database was previously found to have existing tables without a migration ledger. Reconcile its schema history before applying migrations; do not seed or guess a baseline. Adding this template does not change business records.

Checks: `node tests/technology-classic.test.js` verifies responsive rendering, gallery viewing and mocked interactions. `node tests/technology-classic-migration.test.js` verifies repeatability and plan access using local temporary tables.
