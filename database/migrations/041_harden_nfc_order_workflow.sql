DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nfc_orders_status_check'
      AND conrelid = 'nfc_orders'::regclass
  ) THEN
    ALTER TABLE nfc_orders
      ADD CONSTRAINT nfc_orders_status_check
      CHECK (status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nfc_orders_payment_status_check'
      AND conrelid = 'nfc_orders'::regclass
  ) THEN
    ALTER TABLE nfc_orders
      ADD CONSTRAINT nfc_orders_payment_status_check
      CHECK (payment_status IN ('pending', 'approved', 'rejected')) NOT VALID;
  END IF;
END
$$;

ALTER TABLE nfc_orders VALIDATE CONSTRAINT nfc_orders_status_check;
ALTER TABLE nfc_orders VALIDATE CONSTRAINT nfc_orders_payment_status_check;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_nfc_order_unique
  ON transactions ((metadata->>'orderId'))
  WHERE transaction_type = 'nfc_order' AND metadata ? 'orderId';
