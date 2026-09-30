# Medical Classic VCard template

Medical Classic is design 19, adapted from the supplied doctor VCard. It uses a navy and teal layout with a medical profile, contact links, appointment request form, services, gallery, products, testimonials, QR download, business hours, and enquiry form. The preview includes sample data; published cards use their saved data and only show sections that are configured. The emergency notice points visitors to local emergency services instead of the enquiry form for urgent care.

Preview: `/pages/public-vcard/final-19-medical-classic.html`.

Deploy the frontend files and migration `076_add_medical_classic_template.sql` together. With a reviewed migration ledger, run `node database/migrate.js`, then `node database/migrate.js --verify`, and restart the app. Plans with Medical Professional (template 4) receive Medical Classic; other plan restrictions and existing cards are preserved. The database assigns its ID automatically; 19 is the design number.

The images under `frontend/public/assets/images/medical-classic/` are local preview assets. The source's alert-only buttons have been replaced by the app's existing appointment, enquiry, contact saving and QR workflows.

Checks: `node tests/medical-classic.test.js` verifies responsive preview and mocked live interactions. `node tests/medical-classic-migration.test.js` verifies repeatability and plan access using local temporary tables.
