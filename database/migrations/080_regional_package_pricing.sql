-- Existing accounts keep their previous domestic market until they update it.
ALTER TABLE users ADD COLUMN billing_country CHAR(2) NOT NULL DEFAULT 'LK'
  CHECK (billing_country ~ '^[A-Z]{2}$');
ALTER TABLE payments ADD COLUMN pricing_snapshot JSONB;
-- Older plan_prices foreign rows were ignored by checkout and are not assumed
-- to be approved regional prices. Preserve them and initialize this table explicitly.
CREATE TABLE package_regional_prices (
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  currency CHAR(3) NOT NULL CHECK (currency IN ('LKR','AUD','USD')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (plan_id,currency)
);
-- No historical payment amounts or existing prices are changed.
