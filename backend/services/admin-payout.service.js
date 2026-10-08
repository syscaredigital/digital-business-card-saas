function payoutTransactionStatus(status) {
  if (status === "paid") return "completed";
  if (status === "processing") return "pending";
  return status;
}

async function syncPayoutTransaction(client, payout) {
  const metadata = JSON.stringify({ payoutId: payout.id, payeeName: payout.payeeName, note: payout.notes });
  let transactionId = payout.transactionId;
  if (transactionId) {
    await client.query(
      `UPDATE transactions SET user_id = $1, transaction_type = 'payout', amount = $2,
       currency = $3, reference = $4, gateway = $5, status = $6, metadata = $7::jsonb, updated_at = NOW()
       WHERE id = $8`,
      [payout.userId, -payout.amount, payout.currency, payout.reference, payout.method, payoutTransactionStatus(payout.status), metadata, transactionId]
    );
  } else {
    const transactionResult = await client.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, currency, reference, gateway, status, metadata)
       VALUES ($1, 'payout', $2, $3, $4, $5, $6, $7::jsonb) RETURNING id`,
      [payout.userId, -payout.amount, payout.currency, payout.reference, payout.method, payoutTransactionStatus(payout.status), metadata]
    );
    transactionId = transactionResult.rows[0].id;
    await client.query("UPDATE payouts SET transaction_id = $1 WHERE id = $2", [transactionId, payout.id]);
  }
  return transactionId;
}


module.exports = { syncPayoutTransaction };
