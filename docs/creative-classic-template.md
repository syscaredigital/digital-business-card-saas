# Creative Classic — template 17

Adapted from the supplied charcoal and yellow designer HTML. It includes the portrait, contact grid, image-led services and products, gallery viewer, testimonials, hours, QR download and enquiries. The malformed font link and HTML have been corrected. Published cards use saved owner data; previews use sample projects and reviews.

Preview: `/pages/public-vcard/final-17-creative-classic.html`.

Deploy the frontend files and migration `074_add_creative_classic_template.sql` together. With a reviewed migration ledger, run `node database/migrate.js`, then `node database/migrate.js --verify`, and restart the app. Plans with Creative Studio (template 2) receive Creative Classic; other plan restrictions and existing cards remain intact. The database assigns the ID automatically; 17 is the design number.

Select **Creative Classic** in the editor after migration. Services, products, gallery, testimonials, hours and appointment services use the existing section fields. Gallery images open in a keyboard-accessible dialog. The booking and enquiry forms submit real requests on published cards. QR download and contact saving use the existing public flows.

The configured local database was previously found to have existing tables without a migration ledger. Reconcile the schema history before applying migrations; do not seed or guess a baseline. Adding this template does not change business records.

Checks: `node tests/creative-classic.test.js` verifies responsive rendering, the gallery viewer and mocked interactions. `node tests/creative-classic-migration.test.js` verifies repeatability and plan access in temporary local tables.
