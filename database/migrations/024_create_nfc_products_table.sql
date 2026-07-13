CREATE TABLE IF NOT EXISTS nfc_products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  description TEXT,
  front_image TEXT NOT NULL,
  back_image TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_products_active ON nfc_products(is_active);
