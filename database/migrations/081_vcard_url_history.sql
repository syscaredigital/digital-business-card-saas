-- Reserve old URLs so printed QR codes and NFC links survive card renames.
CREATE TABLE vcard_url_history (
  slug VARCHAR(150) PRIMARY KEY,
  vcard_id INTEGER REFERENCES vcards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX vcard_url_history_card ON vcard_url_history(vcard_id);
INSERT INTO vcard_url_history(slug,vcard_id)
  SELECT LOWER(slug),id FROM vcards WHERE slug IS NOT NULL;

CREATE FUNCTION reserve_vcard_url() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NOT NULL THEN
    INSERT INTO vcard_url_history(slug,vcard_id) VALUES(LOWER(NEW.slug),NEW.id)
      ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug
      WHERE vcard_url_history.vcard_id=EXCLUDED.vcard_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'VCard URL is reserved' USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reserve_vcard_url_after_save AFTER INSERT OR UPDATE OF slug ON vcards
  FOR EACH ROW EXECUTE FUNCTION reserve_vcard_url();
