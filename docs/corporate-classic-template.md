# Corporate Classic — template 12

Adapted from the supplied teal and lime corporate HTML, with the curved banner, portrait, service rows, gallery, products, testimonial navigation, business hours and QR panel. Enquiries, appointments and contact saving use the existing application flows. Published cards render saved owner data; preview identities, reviews and photos are demonstration content only.

Preview: `/pages/public-vcard/final-12-corporate-classic.html`.

Deploy the frontend files and migration `069_add_corporate_classic_template.sql` together. With a reviewed migration ledger, run `node database/migrate.js` followed by `node database/migrate.js --verify`, then restart the application. Existing plans that include Corporate Executive (template 10) also receive Corporate Classic; restricted plans retain their existing access. The catalogue assigns its database ID automatically, so 12 is the design number rather than a forced database ID.

Select **Corporate Classic** in the VCard editor after migration. Configure its sections using the existing editor fields. Testimonial arrows appear when more than one review is configured. Booking uses the supported service/date/time form, and enquiries use name, email/phone and message fields; there is no unsupported subject field or fabricated availability slot list.

The previously observed local database has existing tables without a migration ledger. Reconcile that history before applying pending migrations; do not seed or guess a baseline for an existing database. No business database migration is applied as part of adding these files.

Checks: `node tests/corporate-classic.test.js` exercises mobile/desktop rendering and mocked public interactions. `node tests/corporate-classic-migration.test.js` checks repeatability and plan access in disposable temporary tables on a local development database.
