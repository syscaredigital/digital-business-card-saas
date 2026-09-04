ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS service_name VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_appointments_vcard_service
  ON appointments(vcard_id, service_name);
