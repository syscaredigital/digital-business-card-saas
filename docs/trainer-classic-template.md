# Trainer Classic — template 14

Adapted from the supplied corporate trainer HTML: sage outer frame, black rounded card, gold accents, square portrait, side-by-side services and contact details, framed gallery, training products, testimonials, hours, enquiries and QR download.

Preview: `/pages/public-vcard/final-14-trainer-classic.html`.

Deploy the frontend files and migration `071_add_trainer_classic_template.sql` together. With a reviewed migration ledger, run `node database/migrate.js`, then `node database/migrate.js --verify`, and restart the application. Existing plans with Corporate Trainer (template 8) also receive Trainer Classic; other plan restrictions and existing cards are preserved. The database assigns the template ID automatically; 14 identifies the design.

Select **Trainer Classic** in the VCard editor after migration. Published cards use saved owner data. Preview profiles, services, reviews, hours and products are sample content only. The supported appointment form replaces unverified time-slot buttons. Enquiries submit name, email/phone and message through the shared API. QR downloads use the public QR endpoint; contact saving respects the owner's contact-capture preference.

Local migration activation remains subject to the previously identified missing ledger. Reconcile an existing database's schema history before running pending migrations; do not seed or guess a baseline. Adding this template does not modify business database records.

Checks: `node tests/trainer-classic.test.js` for desktop/mobile rendering and mocked interactions; `node tests/trainer-classic-migration.test.js` for repeatability and plan access using transaction-scoped temporary tables on a local development database.
