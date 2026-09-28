# Automotive Classic

An additional VCard template adapted from the supplied automotive HTML. It preserves the compact black/red design and uses the shared card renderer and existing enquiry, appointment, QR and contact-saving flows. Sample identities and vehicle images appear only in preview mode. Published cards use their saved details and configured sections. Business hours are shown as entered; no open/closed status is guessed from the visitor's timezone.

Preview: `/pages/public-vcard/final-11-automotive-classic.html`.

Apply migration `068_add_automotive_classic_template.sql` through `node database/migrate.js`, then verify with `node database/migrate.js --verify`. The additive migration registers the template and grants it to existing plans that already include Automotive Showroom (template 9); other plan restrictions are preserved. New installations include public templates in the seeded free plan. The existing automotive design and cards are retained. Deploy the new frontend files and migration together because startup verifies the migration ledger.

After migration, select **Automotive Classic** in the VCard editor. Configure services, gallery, products, hours, testimonials and appointments using the existing section fields. WhatsApp can be configured as a social link. Contact saving follows the owner's contact-capture preference.

Verification: `node tests/automotive-classic.test.js` checks desktop/mobile previews, live-data isolation, safe text rendering, contact capture, and enquiry/appointment requests using mocked API responses. It does not submit real enquiries or bookings.

`node tests/automotive-classic-migration.test.js` checks catalogue insertion, repeatability and plan restrictions using transaction-scoped temporary tables in the local development database.

Local activation note: the configured development database currently has no `schema_migrations` ledger. Migration 068 has not been applied there. Reconcile the existing schema/ledger using the documented audit upgrade procedure before running migrations; do not baseline or seed an unknown existing database.
