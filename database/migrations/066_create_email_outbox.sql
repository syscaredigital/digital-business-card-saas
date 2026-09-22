CREATE TABLE email_outbox (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dedup_key TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_token UUID,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX email_outbox_pending ON email_outbox(available_at) WHERE status IN ('pending','sending');

-- Only new transactional notifications are queued; no historical email blast.
CREATE FUNCTION enqueue_notification_email() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type IN ('security','subscription','payment','billing','nfc','affiliate','withdrawal') THEN
    INSERT INTO email_outbox(user_id,dedup_key,subject,body)
    SELECT NEW.user_id,'notification:'||NEW.id,NEW.title,NEW.message
    FROM users u LEFT JOIN user_settings s ON s.user_id=u.id
    WHERE u.id=NEW.user_id AND u.status='active' AND COALESCE(s.email_notifications,TRUE)
    ON CONFLICT(dedup_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notification_email AFTER INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION enqueue_notification_email();
