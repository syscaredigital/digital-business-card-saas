# Saved template fields and photo mapping

The shared final-template renderer now displays blogs, Instagram images,
custom links, featured-content links, all banner rows, additional information,
privacy policy, and terms. It uses the filtered `card.sections` returned by the
public API. No demo data is added for absent extra fields.

- Featured-content URLs open as links; arbitrary iframe HTML is not embedded.
- QR customization accepts an HTTP(S) destination or a QR image URL ending in
  a supported image extension. Otherwise the card keeps its default QR code.
- Fonts accept Arial, Georgia, Verdana, Times New Roman, DM Sans, Oswald, or
  Playfair Display. Unknown values leave the theme font unchanged.
- SEO accepts lines such as `title | My card`, `description | My services`,
  and `keywords | consulting`. These update browser metadata. Server-generated
  social-sharing previews remain a separate task.
- Manage Section continues to mean additional text, as documented by the
  existing editor; it is not a section-order configuration language.

Uploads fill existing nonempty rows without photos before adding a new row.
Matching text rows retain their photos on reordering and insertion/deletion;
editing a row in place retains its photo. Because storage still uses line-based
text, bulk replacement that simultaneously renames and moves rows is ambiguous.
For that operation, check the labelled photo previews and reattach as needed.
A structured per-item editor with stable IDs would remove that limitation.

Checks: `node tests/section-photo-mapping.test.js` exercises the editor with
mocked API persistence; `node tests/classic-content-sync.test.js` exercises saved
fields in all ten classic templates at three viewport sizes. Deploy the updated
shared JavaScript and CSS together. No database migration is required.
