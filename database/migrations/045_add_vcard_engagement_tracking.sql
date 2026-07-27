ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS consent_text TEXT;

CREATE TABLE IF NOT EXISTS vcard_events (
  id BIGSERIAL PRIMARY KEY,
  vcard_id INTEGER NOT NULL REFERENCES vcards(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL CHECK (event_type IN ('qr_scan', 'vcard_view', 'contact_download')),
  source VARCHAR(80),
  visitor_hash VARCHAR(64),
  user_agent TEXT,
  referrer TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vcard_events_card_type_date
  ON vcard_events(vcard_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_vcard_events_visitor
  ON vcard_events(vcard_id, event_type, visitor_hash, occurred_at DESC);

