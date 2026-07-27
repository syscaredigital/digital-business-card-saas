ALTER TABLE vcard_events
  DROP CONSTRAINT IF EXISTS vcard_events_event_type_check;

ALTER TABLE vcard_events
  ADD CONSTRAINT vcard_events_event_type_check
  CHECK (event_type IN ('qr_scan', 'vcard_view', 'contact_download', 'link_click', 'share'));

CREATE INDEX IF NOT EXISTS idx_vcard_events_type_date
  ON vcard_events(event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_contacted_at
  ON contacts(contacted_at DESC);

