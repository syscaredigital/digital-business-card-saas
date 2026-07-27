ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) NOT NULL DEFAULT 'USD';

UPDATE users
SET preferred_currency = 'USD'
WHERE preferred_currency IS NULL
   OR preferred_currency NOT IN ('USD', 'AUD', 'LKR');

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_preferred_currency_check;

ALTER TABLE users
  ADD CONSTRAINT users_preferred_currency_check
  CHECK (preferred_currency IN ('USD', 'AUD', 'LKR'));

UPDATE settings
SET value = 'USD', updated_at = NOW()
WHERE key = 'default_currency'
  AND UPPER(value) NOT IN ('USD', 'AUD', 'LKR');
