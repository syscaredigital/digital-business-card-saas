ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_currency_check;
ALTER TABLE users ADD CONSTRAINT users_preferred_currency_check
  CHECK (preferred_currency ~ '^[A-Z]{3}$');

CREATE TABLE IF NOT EXISTS plan_prices (
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  currency CHAR(3) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, currency),
  CONSTRAINT plan_prices_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS idx_plan_prices_currency ON plan_prices(currency, amount);

-- Preserve an LKR price row for compatibility. LKR is the authoritative plan
-- price; other currencies are calculated from the current exchange rate.
INSERT INTO plan_prices(plan_id, currency, amount)
SELECT p.id, 'LKR', p.price
FROM plans p
ON CONFLICT (plan_id, currency) DO NOTHING;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_currency_check;
ALTER TABLE payments ADD CONSTRAINT payments_currency_check CHECK (currency ~ '^[A-Z]{3}$');
