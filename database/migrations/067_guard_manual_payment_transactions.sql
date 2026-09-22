-- Fail on pre-existing duplicates so an operator can reconcile the audit trail;
-- never delete historical financial rows automatically.
CREATE UNIQUE INDEX idx_transactions_cash_payment_unique
  ON transactions(payment_id)
  WHERE payment_id IS NOT NULL AND transaction_type='cash_payment';
