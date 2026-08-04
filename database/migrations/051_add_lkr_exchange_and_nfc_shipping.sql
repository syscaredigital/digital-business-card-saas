-- LKR is the authoritative catalog currency. Converted totals are snapshotted
-- on orders so later rate changes never alter an existing purchase.
ALTER TABLE users ALTER COLUMN preferred_currency SET DEFAULT 'LKR';

INSERT INTO settings(key,value,category,description,updated_at)
VALUES
  ('default_currency','LKR','billing','Base display and billing currency',NOW()),
  ('international_nfc_shipping_lkr','0','billing','Flat overseas NFC shipping charge in LKR',NOW())
ON CONFLICT(key) DO UPDATE SET
  value=CASE WHEN settings.key='default_currency' THEN 'LKR' ELSE settings.value END,
  category=EXCLUDED.category,
  description=EXCLUDED.description,
  updated_at=NOW();

ALTER TABLE nfc_orders
  ADD COLUMN IF NOT EXISTS destination_country CHAR(2) NOT NULL DEFAULT 'LK',
  ADD COLUMN IF NOT EXISTS subtotal_lkr NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal_lkr >= 0),
  ADD COLUMN IF NOT EXISTS shipping_cost_lkr NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost_lkr >= 0),
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(20,10) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
  ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;

UPDATE nfc_orders
SET subtotal_lkr=amount,
    exchange_rate=1,
    exchange_rate_date=COALESCE(ordered_at::date,CURRENT_DATE)
WHERE subtotal_lkr=0 AND amount>0 AND currency='LKR';

ALTER TABLE nfc_orders DROP CONSTRAINT IF EXISTS nfc_orders_destination_country_check;
ALTER TABLE nfc_orders ADD CONSTRAINT nfc_orders_destination_country_check
  CHECK (destination_country ~ '^[A-Z]{2}$');

CREATE INDEX IF NOT EXISTS idx_nfc_orders_destination_country
  ON nfc_orders(destination_country, ordered_at DESC);
