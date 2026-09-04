-- The affiliate payout workflow now supports bank transfer only. Preserve
-- completed/rejected history, but normalize requests that are still actionable.
UPDATE withdrawals
SET method = 'bank_transfer', updated_at = NOW()
WHERE method <> 'bank_transfer'
  AND status IN ('pending', 'approved', 'processing');

UPDATE payouts
SET method = 'bank_transfer', updated_at = NOW()
WHERE method <> 'bank_transfer'
  AND status IN ('pending', 'processing');
