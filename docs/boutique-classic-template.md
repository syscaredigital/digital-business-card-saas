# Boutique Classic — template 16

Adapted from the supplied pink boutique HTML: split photographic banner, circular brand panel, portrait, contact list, paired hours and services, product and gallery grids, customer reviews, appointments, QR code, enquiries and social links. The malformed source markup and font URL have been corrected. Published cards use saved owner data; preview products, photos and reviews are sample content only.

Preview: `/pages/public-vcard/final-16-boutique-classic.html`.

Deploy the frontend files and migration `073_add_boutique_classic_template.sql` together. With a reviewed migration ledger, run `node database/migrate.js`, then `node database/migrate.js --verify`, and restart the app. Plans that include Style Boutique (template 1) receive Boutique Classic; other restrictions and existing cards are preserved. The database assigns the ID automatically; 16 is the design number.

Select **Boutique Classic** in the editor after migration. Hours, services, products, gallery, testimonials and appointment services use the existing section fields. The booking and enquiry forms send real requests on published cards. QR download uses the public endpoint and contact saving respects the owner's preference. Preview submissions explain that a published card is required.

The configured local database was previously found to have existing tables without a migration ledger. Reconcile that schema history before applying migrations; do not seed or guess a baseline. Adding this template does not change business database records.

Checks: `node tests/boutique-classic.test.js` verifies responsive rendering and mocked interactions. `node tests/boutique-classic-migration.test.js` verifies repeatability and plan access using temporary tables in a local development database.
