BEGIN;

ALTER TABLE email_outbox ADD COLUMN recipient_email VARCHAR(255);
ALTER TABLE email_outbox ADD COLUMN reply_to VARCHAR(255);
ALTER TABLE contacts ADD COLUMN enquiry_status VARCHAR(20) NOT NULL DEFAULT 'new'
  CHECK (enquiry_status IN ('new','replied','closed'));
ALTER TABLE contacts ADD COLUMN read_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN decision_note TEXT;

CREATE TABLE contact_replies (
  id BIGSERIAL PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 5000),
  email_outbox_id BIGINT NOT NULL REFERENCES email_outbox(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,request_key)
);
CREATE INDEX contact_replies_contact ON contact_replies(contact_id,created_at);

-- Queue only new notifications. No historical scan/enquiry email is replayed.
CREATE OR REPLACE FUNCTION enqueue_notification_email() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type IN ('security','subscription','payment','billing','nfc','affiliate','withdrawal',
                  'qr_scan','contact','contact_download','enquiry','appointment') THEN
    INSERT INTO email_outbox(user_id,dedup_key,subject,body,reply_to)
    SELECT NEW.user_id,'notification:'||NEW.id,NEW.title,NEW.message,
           NULLIF(NEW.metadata->>'replyTo','')
    FROM users u LEFT JOIN user_settings s ON s.user_id=u.id
    WHERE u.id=NEW.user_id AND u.status='active' AND COALESCE(s.email_notifications,TRUE)
    ON CONFLICT(dedup_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
