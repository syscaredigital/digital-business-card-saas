CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  due_date DATE,
  paid_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoices_payment_id ON invoices(payment_id);
