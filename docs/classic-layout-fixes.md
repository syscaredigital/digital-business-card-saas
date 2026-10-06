# Classic layout and public contact fixes

All ten Classic pages load `classic-layout.css` after their theme stylesheet. It
keeps theme colors and cover artwork while providing a content-driven profile,
readable contact rows, service rows, responsive product/gallery grids, visible
form labels, and comfortable touch targets. Contact details follow the profile.
Optional content can grow without absolute-positioned text overlapping sections.

Public contact saves, analytics events, enquiries, and appointments explicitly
omit account cookies. Previously a signed-in visitor's cookie activated the
session middleware's CSRF checks on these anonymous public requests, producing
`403 Invalid browser request origin`. Session middleware and its protections are
unchanged; public route validation, consent, and download-ticket checks remain.

Deploy the ten Classic HTML pages together with the updated frontend assets,
including the new shared stylesheet. No database migration is needed. These
changes do not update an already deployed site until the frontend is deployed.

Validation:

- `node tests/classic-content-sync.test.js`: all ten designs at 320, 390, and
  1440px with short and long saved content; portrait visibility, readable text,
  touch targets, form labels, overflow checks, and preview screenshots.
- `node tests/public-contact-session.test.js`: reproduces the rejected cookie
  request with real middleware, then verifies public downloads, enquiries, and
  bookings both with and without an existing login cookie. Endpoint persistence
  and download content are test fixtures; production data is not modified.
- Existing `tests/*-classic.test.js` tests exercise each template's interactions.

Screenshots are generated under `test-results/classic-layout/`.
