# VCard section editor

Create and Edit VCard use the same section editor. Profile and contact fields remain above the section tabs.

- Tabs are limited to the owner's current package. Basic-only packages show an explanation instead of empty tabs.
- Turn a section on, then use its form. Services, products, photos, reviews, articles and links have individual rows with Add, Remove and reorder controls. Photos belong to their row and move with it.
- Business hours use day switches and opening/closing times. Appointment services require a duration from 15 to 480 minutes. Fonts, SEO and policy sections have dedicated controls.
- Customize QR Code offers image sizes from 256 to 1024 pixels, QR/background colors, square/rounded/dot modules and an appearance preview. The public image and download use the saved design while always encoding the VCard URL. Legacy QR URL values fall back to the default design. Disabling customization or losing the package feature restores the default QR appearance.
- Turning a section off keeps its content for later. Save the card to apply the visibility change. Hidden appointments also reject new public booking requests.
- A package downgrade hides unavailable features from the editor and public card. Previously saved content is retained and cannot be overwritten through requests outside the current package. It becomes available again when the package includes that feature.

The editor writes the existing `settings.sections` format and adds a `settings.hiddenSections` array. No database migration is needed. Existing cards without this array infer initial switches from their saved content.

Regression coverage: `tests/vcard-section-editor.test.js`, `tests/section-photo-mapping.test.js`, and the section visibility/package downgrade case in `tests/production-workflows.test.js`.
