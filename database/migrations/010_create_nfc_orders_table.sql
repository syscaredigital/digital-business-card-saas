CREATE TABLE nfc_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  shipping_address TEXT,
  tracking_number VARCHAR(255),
  ordered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_nfc_orders_user_id ON nfc_orders(user_id);
