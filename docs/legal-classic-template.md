# Legal Classic VCard template

Legal Classic is design 20, adapted from the supplied lawyer VCard. It has a black and gold profile, contact links, services, gallery, appointment request form, testimonials, QR download, products, business hours, and enquiries. The preview uses sample data. Published cards use saved card details and show only configured sections.

Preview: `/pages/public-vcard/final-20-legal-classic.html`.

Deploy the frontend files and migration `077_add_legal_classic_template.sql` together. With a reviewed migration ledger, run `node database/migrate.js`, then `node database/migrate.js --verify`, and restart the app. Plans with Legal Counsel (template 5) receive Legal Classic; other plan restrictions and existing cards are preserved. The database assigns its ID automatically; 20 is the design number.

The images under `frontend/public/assets/images/legal-classic/` are local preview assets. The broken source markup and alert-only buttons were replaced with the app's existing appointment, enquiry, contact saving and QR workflows.

Checks: `node tests/legal-classic.test.js` verifies responsive rendering and mocked live interactions. `node tests/legal-classic-migration.test.js` verifies repeatability and plan access using local temporary tables.
