CREATE TABLE IF NOT EXISTS revenue_fx_snapshots (
  source_type TEXT NOT NULL CHECK (source_type IN ('payment','nfc')),
  source_id INTEGER NOT NULL,
  original_amount NUMERIC(16,2) NOT NULL,
  original_currency VARCHAR(10) NOT NULL,
  lkr_per_unit NUMERIC(24,12) NOT NULL CHECK (lkr_per_unit > 0),
  amount_lkr NUMERIC(20,2) NOT NULL,
  rate_date DATE NOT NULL,
  basis TEXT NOT NULL CHECK (basis IN ('checkout','recorded','estimated_current')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(source_type,source_id)
);

CREATE OR REPLACE VIEW revenue_lkr_entries AS
WITH receipts AS (
  SELECT 'payment'::text AS source_type,id AS source_id,amount,currency,status,
    COALESCE(paid_at,reviewed_at,created_at) AS received_at
  FROM payments WHERE status IN ('approved','completed','paid')
  UNION ALL
  SELECT 'nfc',id,amount,currency,payment_status,
    COALESCE(payment_reviewed_at,ordered_at)
  FROM nfc_orders WHERE payment_status='approved'
)
SELECT r.*,CASE WHEN UPPER(r.currency)='LKR' THEN r.amount ELSE fx.amount_lkr END AS amount_lkr,
  CASE WHEN UPPER(r.currency)='LKR' THEN 1::numeric ELSE fx.lkr_per_unit END AS lkr_per_unit,
  CASE WHEN UPPER(r.currency)='LKR' THEN r.received_at::date ELSE fx.rate_date END AS rate_date,
  CASE WHEN UPPER(r.currency)='LKR' THEN 'recorded' ELSE fx.basis END AS conversion_basis
FROM receipts r LEFT JOIN revenue_fx_snapshots fx
  ON fx.source_type=r.source_type AND fx.source_id=r.source_id
  AND fx.original_amount=r.amount AND fx.original_currency=UPPER(r.currency);
