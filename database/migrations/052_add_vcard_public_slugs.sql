ALTER TABLE vcards ADD COLUMN IF NOT EXISTS slug VARCHAR(120);

CREATE OR REPLACE FUNCTION assign_vcard_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
BEGIN
  IF NEW.slug IS NULL OR BTRIM(NEW.slug) = '' THEN
    base_slug := TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(NEW.title, 'vcard')), '[^a-z0-9]+', '-', 'g'));
    IF base_slug = '' THEN base_slug := 'vcard'; END IF;
    NEW.slug := LEFT(base_slug, 100) || '-' || NEW.id::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE vcards
SET slug = LEFT(CASE
  WHEN TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(title, 'vcard')), '[^a-z0-9]+', '-', 'g')) = '' THEN 'vcard'
  ELSE TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(title), '[^a-z0-9]+', '-', 'g'))
END, 100) || '-' || id::TEXT
WHERE slug IS NULL OR BTRIM(slug) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_vcards_slug_ci ON vcards(LOWER(slug));

DROP TRIGGER IF EXISTS trg_assign_vcard_slug ON vcards;
CREATE TRIGGER trg_assign_vcard_slug
BEFORE INSERT OR UPDATE OF slug ON vcards
FOR EACH ROW EXECUTE FUNCTION assign_vcard_slug();

ALTER TABLE vcards ALTER COLUMN slug SET NOT NULL;
