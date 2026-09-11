const exchange = require('./exchange-rate.service');
async function captureRevenueRate(db, source, id, quote, legacy = false) {
  if (!['payment', 'nfc'].includes(source)) throw new Error('Invalid revenue source');
  const result = source === 'payment'
    ? await db.query(`SELECT p.amount,p.currency,t.metadata,t.currency AS transaction_currency FROM payments p
        LEFT JOIN LATERAL (SELECT metadata,currency FROM transactions WHERE payment_id=p.id ORDER BY id LIMIT 1) t ON TRUE WHERE p.id=$1`, [id])
    : await db.query('SELECT amount,currency,exchange_rate,exchange_rate_date FROM nfc_orders WHERE id=$1', [id]);
  const row = result.rows[0];
  if (!row) return;
  const currency = String(row.currency).toUpperCase();
  if (currency === 'LKR') return;
  const existing = await db.query('SELECT 1 FROM revenue_fx_snapshots WHERE source_type=$1 AND source_id=$2 AND original_amount=$3 AND original_currency=$4', [source, id, row.amount, currency]);
  if (existing.rowCount) return;
  let basis = quote ? 'checkout' : 'recorded';
  if (!quote && source === 'nfc' && row.exchange_rate_date && Number(row.exchange_rate) > 0) quote = { rate: Number(row.exchange_rate), rateDate: row.exchange_rate_date };
  if (!quote && row.transaction_currency === currency && row.metadata?.baseCurrency === 'LKR' && Number(row.metadata.exchangeRate) > 0 && row.metadata.exchangeRateDate) quote = { rate: Number(row.metadata.exchangeRate), rateDate: row.metadata.exchangeRateDate };
  if (!quote) { quote = await exchange.getRate(currency); basis = legacy ? 'estimated_current' : 'recorded'; }
  if (!(Number(quote.rate) > 0)) throw new Error('No valid exchange rate for revenue');
  // Checkout rates are foreign units per LKR, so invert for the reporting rate.
  const lkrPerUnit = 1 / Number(quote.rate);
  await db.query(`INSERT INTO revenue_fx_snapshots(source_type,source_id,original_amount,original_currency,lkr_per_unit,amount_lkr,rate_date,basis)
    VALUES($1,$2,$3,$4,$5,ROUND($3::numeric*$5::numeric,2),$6,$7)
    ON CONFLICT(source_type,source_id) DO UPDATE SET original_amount=EXCLUDED.original_amount,
      original_currency=EXCLUDED.original_currency,lkr_per_unit=EXCLUDED.lkr_per_unit,amount_lkr=EXCLUDED.amount_lkr,
      rate_date=EXCLUDED.rate_date,basis=EXCLUDED.basis,captured_at=NOW()`,
    [source,id,row.amount,currency,lkrPerUnit,quote.rateDate,basis]);
}
async function reportingSummary(db) {
  const result = await db.query(`SELECT
    COALESCE(SUM(amount_lkr) FILTER(WHERE received_at>=DATE_TRUNC('month',CURRENT_DATE)),0) AS monthly,
    COALESCE(SUM(amount_lkr) FILTER(WHERE received_at>=NOW()-INTERVAL '30 days'),0) AS current,
    COALESCE(SUM(amount_lkr) FILTER(WHERE received_at>=NOW()-INTERVAL '60 days' AND received_at<NOW()-INTERVAL '30 days'),0) AS previous,
    COUNT(*) FILTER(WHERE amount_lkr IS NULL)::int AS missing,
    COUNT(*) FILTER(WHERE conversion_basis='estimated_current')::int AS estimated
    FROM revenue_lkr_entries`);
  return result.rows[0];
}
module.exports = { captureRevenueRate, reportingSummary };
