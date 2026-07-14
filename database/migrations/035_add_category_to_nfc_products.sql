ALTER TABLE nfc_products
  ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'essential';

ALTER TABLE nfc_products
  DROP CONSTRAINT IF EXISTS nfc_products_category_check;

ALTER TABLE nfc_products
  ADD CONSTRAINT nfc_products_category_check
  CHECK (category IN ('essential', 'signature', 'prestige', 'exclusive'));

CREATE INDEX IF NOT EXISTS idx_nfc_products_public_catalog
  ON nfc_products(category, updated_at DESC)
  WHERE is_active = TRUE;
