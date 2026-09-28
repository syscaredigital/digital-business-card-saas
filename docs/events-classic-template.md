# Events Classic — template 13

Adapted from the supplied purple and pink event planner HTML. Includes the script-style name, overlapping portrait, services, event gallery, packages, testimonials, appointments, hours, QR panel and enquiries. The malformed font link and product markup are corrected. Preview prices, identities and reviews are explicitly sample content; published cards use saved owner details and sections.

Preview: `/pages/public-vcard/final-13-events-classic.html`.

Deploy the frontend files and migration `070_add_events_classic_template.sql` together. With a reviewed migration ledger, run `node database/migrate.js`, then `node database/migrate.js --verify`, and restart the application. Plans with Event Planner (template 6) receive Events Classic; other restrictions are preserved. The database allocates the ID automatically; 13 identifies the design, not a forced database ID. Existing templates and cards are retained.

Select **Events Classic** in the editor after migration. Use the existing section fields for services, gallery images, packages/prices, testimonials, hours and appointment services. Gallery pagination appears for more than four images; testimonial pagination appears for multiple reviews. Both use keyboard-accessible buttons rather than decorative dots.

The forms use the supported enquiry and booking fields and real public endpoints. Contact saving respects the owner's contact-capture preference. Demo submissions explain that publishing is required; they do not claim to have sent anything. No sample reviews, prices or schedules are supplied to published cards with empty sections.

The previously observed local database has existing tables without a migration ledger. Reconcile the schema history before applying pending migrations; do not seed or invent a baseline for an existing database. Adding this template does not apply migrations to business data.

Checks: `node tests/events-classic.test.js` uses mocked public API responses to test desktop/mobile layouts and interactions. `node tests/events-classic-migration.test.js` tests catalogue insertion, repeatability and plan restrictions in local transaction-scoped temporary tables.
