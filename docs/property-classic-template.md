# Real Estate Classic — template 15

Adapted from the supplied light real estate HTML. It includes a centered portrait, readable contact cards, a biography toggle, social links, review cards, property listings, side-by-side hours and gallery, services, QR download, booking and enquiries. The malformed source markup and demo-only alert handlers were replaced with valid app components.

Preview: `/pages/public-vcard/final-15-property-classic.html`.

Deploy the frontend files and migration `072_add_property_classic_template.sql` together. With a reviewed migration ledger, run `node database/migrate.js`, then `node database/migrate.js --verify`, and restart the app. Plans with Real Estate Professional (template 7) receive the new design; other plan restrictions and existing cards are preserved. The database assigns its ID automatically; 15 is the design number.

Select **Real Estate Classic** in the editor after migration. Configure listings through Products, reviews through Testimonials, and the remaining sections through the existing editor. Sample property prices and testimonials appear in preview only. Published cards use saved data. No unverified badge is shown by default. The booking form uses actual service/date/time fields, enquiries use the public API, and contact saving follows the owner's preference.

The configured local database was previously found to have existing tables without a migration ledger. Reconcile that history before applying migrations; do not seed or guess a baseline. Adding these files does not change business database records.

Checks: `node tests/property-classic.test.js` verifies responsive rendering and mocked interactions; `node tests/property-classic-migration.test.js` verifies catalogue insertion and plan access in local temporary tables.
