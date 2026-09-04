ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS transfer_receipt_url TEXT;

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS transfer_receipt_url TEXT;

UPDATE affiliate_profiles SET payment_method='bank_transfer' WHERE payment_method<>'bank_transfer';
