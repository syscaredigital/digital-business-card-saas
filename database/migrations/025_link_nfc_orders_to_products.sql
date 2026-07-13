ALTER TABLE nfc_orders
  ADD COLUMN IF NOT EXISTS nfc_product_id INTEGER REFERENCES nfc_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nfc_orders_product_id ON nfc_orders(nfc_product_id);
