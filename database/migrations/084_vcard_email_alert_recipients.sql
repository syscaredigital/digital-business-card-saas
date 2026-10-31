-- Keep the dashboard owner's alert and send a separate copy to the relevant
-- VCard email. Only future notifications are queued; no historical replay.
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

    IF NEW.type IN ('qr_scan','contact','contact_download','enquiry','appointment') THEN
      INSERT INTO email_outbox(user_id,dedup_key,recipient_email,subject,body,reply_to)
      SELECT NEW.user_id,'notification:'||NEW.id||':vcard',BTRIM(v.email),NEW.title,NEW.message,
             NULLIF(NEW.metadata->>'replyTo','')
      FROM vcards v JOIN users u ON u.id=v.user_id
      LEFT JOIN user_settings s ON s.user_id=u.id
      WHERE v.id::text=NEW.metadata->>'vcardId' AND v.user_id=NEW.user_id
        AND u.status='active' AND COALESCE(s.email_notifications,TRUE)
        AND LENGTH(BTRIM(v.email))<=255
        AND BTRIM(v.email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        AND LOWER(BTRIM(v.email))<>LOWER(BTRIM(u.email))
      ON CONFLICT(dedup_key) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
