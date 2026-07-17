ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS vcard_id INTEGER REFERENCES vcards(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contacts_vcard_id ON contacts(vcard_id);
