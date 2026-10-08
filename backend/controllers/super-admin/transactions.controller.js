const { number } = require('../../helpers/metrics.helper');
const pool = require("../../config/database.config");
const { normalizeCurrency } = require("../../config/currencies");
const { validateTransactionUser } = require('../../services/transaction-user.service');
const { positiveIntegerParam } = require('../../validators/id.validator');
const transactionStatuses = ["pending", "completed", "failed", "refunded", "cancelled", "rejected"];
const transactionTypes = ["subscription", "cash_payment", "nfc_order", "payout", "refund", "adjustment", "other"];

function normalizeTransactionPayload(body) {
  return {
    userId: Number(body.userId),
    type: String(body.type || "adjustment").trim().toLowerCase(),
    amount: Number(body.amount),
    currency: String(body.currency || "USD").trim().toUpperCase(),
    reference: String(body.reference || "").trim() || null,
    gateway: String(body.gateway || "manual").trim().toLowerCase() || "manual",
    status: String(body.status || "pending").trim().toLowerCase(),
    note: String(body.note || "").trim() || null,
  };
}

function transactionValidationMessage(transaction) {
  if (!Number.isInteger(transaction.userId) || transaction.userId < 1 || transaction.userId > 2147483647) return "Select a valid user";
  if (!transactionTypes.includes(transaction.type)) return "Invalid transaction type";
  if (!Number.isFinite(transaction.amount) || transaction.amount === 0 || transaction.amount < -9999999999.99 || transaction.amount > 9999999999.99) return "Enter a non-zero amount within the database range";
  if (!normalizeCurrency(transaction.currency)) return "Select a valid ISO 4217 currency";
  if (!transactionStatuses.includes(transaction.status)) return "Invalid transaction status";
  if (transaction.reference && transaction.reference.length > 255) return "Reference must not exceed 255 characters";
  if (transaction.gateway.length > 100) return "Gateway must not exceed 100 characters";
  if (transaction.note && transaction.note.length > 3000) return "Internal note must not exceed 3,000 characters";
  return null;
}

exports.listTransactions = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();
    const type = String(req.query.type || "").trim().toLowerCase();
    const values = [];
    const conditions = [];
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(COALESCE(u.name, '') ILIKE $${values.length} OR COALESCE(u.email, '') ILIKE $${values.length}
        OR COALESCE(t.reference, '') ILIKE $${values.length} OR COALESCE(t.gateway, '') ILIKE $${values.length}
        OR t.transaction_type ILIKE $${values.length} OR t.status ILIKE $${values.length}
        OR COALESCE(t.metadata->>'note', '') ILIKE $${values.length})`);
    }
    if (status && transactionStatuses.includes(status)) {
      values.push(status);
      conditions.push(`LOWER(t.status) = $${values.length}`);
    }
    if (type && transactionTypes.includes(type)) {
      values.push(type);
      conditions.push(`LOWER(t.transaction_type) = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [transactionsResult, usersResult, summaryResult, volumeResult] = await Promise.all([
      pool.query(
        `SELECT t.id, t.payment_id, t.user_id, t.transaction_type, t.amount, t.currency,
                t.reference, t.gateway, t.status, t.metadata, t.created_at, t.updated_at,
                u.name AS user_name, u.email AS user_email,
                pay.method AS payment_method, pay.status AS payment_status,
                po.id AS payout_id
         FROM transactions t LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN payments pay ON pay.id = t.payment_id
         LEFT JOIN payouts po ON po.transaction_id = t.id
         ${where} ORDER BY t.created_at DESC LIMIT 150`,
        values
      ),
      pool.query(`SELECT u.id, u.name, u.email FROM users u LEFT JOIN roles r ON r.id = u.role_id
                  WHERE COALESCE(r.name, 'user') <> 'super_admin' ORDER BY u.name, u.email`),
      pool.query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = 'completed')::int AS successful,
                  COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                  CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 1) END AS success_rate
                  FROM transactions`),
      pool.query(`SELECT currency, COALESCE(SUM(amount), 0) AS amount
                  FROM transactions WHERE status = 'completed' GROUP BY currency ORDER BY currency`),
    ]);
    res.json({
      transactions: transactionsResult.rows.map((transaction) => ({
        id: transaction.id,
        paymentId: transaction.payment_id || null,
        sourceManaged: Boolean(transaction.payment_id || transaction.payout_id),
        sourceType: transaction.payout_id ? "payout" : (transaction.payment_id ? "payment" : "manual"),
        sourceId: transaction.payout_id || transaction.payment_id || null,
        user: { id: transaction.user_id, name: transaction.user_name || "Deleted user", email: transaction.user_email || null },
        type: transaction.transaction_type, amount: number(transaction.amount), currency: transaction.currency,
        reference: transaction.reference || null, gateway: transaction.gateway || null,
        status: transaction.status, note: transaction.metadata && transaction.metadata.note ? transaction.metadata.note : null,
        paymentMethod: transaction.payment_method || null, paymentStatus: transaction.payment_status || null,
        createdAt: transaction.created_at, updatedAt: transaction.updated_at,
      })),
      users: usersResult.rows,
      summary: { ...summaryResult.rows[0], volumeByCurrency: volumeResult.rows.map((row) => ({ currency: row.currency, amount: number(row.amount) })) },
    });
  } catch (error) { next(error); }
};

exports.createTransaction = async (req, res, next) => {
  const transaction = normalizeTransactionPayload(req.body);
  const validation = transactionValidationMessage(transaction);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    if (!(await validateTransactionUser(client, transaction.userId))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Selected user was not found" });
    }
    const result = await client.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, currency, reference, gateway, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING id, status`,
      [transaction.userId, transaction.type, transaction.amount, transaction.currency, transaction.reference, transaction.gateway, transaction.status, JSON.stringify({ note: transaction.note, createdBy: req.user.id })]
    );
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'transaction.created', 'transaction', $2, $3::jsonb, $4, $5)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ type: transaction.type, amount: transaction.amount, currency: transaction.currency, status: transaction.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.status(201).json({ transaction: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.updateTransaction = async (req, res, next) => {
  const transactionId = positiveIntegerParam(req);
  if (!transactionId) return res.status(400).json({ message: "Invalid transaction ID" });
  const transaction = normalizeTransactionPayload(req.body);
  const validation = transactionValidationMessage(transaction);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    if (!(await validateTransactionUser(client, transaction.userId))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Selected user was not found" });
    }
    const existing = await client.query(
      "SELECT payment_id, (SELECT id FROM payouts WHERE transaction_id = transactions.id LIMIT 1) AS payout_id FROM transactions WHERE id = $1 FOR UPDATE",
      [transactionId]
    );
    if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Transaction not found" }); }
    if (existing.rows[0].payment_id || existing.rows[0].payout_id) { await client.query("ROLLBACK"); return res.status(409).json({ message: "This transaction is managed by its source record" }); }
    const result = await client.query(
      `UPDATE transactions SET user_id = $1, transaction_type = $2, amount = $3, currency = $4,
       reference = $5, gateway = $6, status = $7, metadata = $8::jsonb, updated_at = NOW()
       WHERE id = $9 RETURNING id, status`,
      [transaction.userId, transaction.type, transaction.amount, transaction.currency, transaction.reference, transaction.gateway, transaction.status, JSON.stringify({ note: transaction.note, updatedBy: req.user.id }), transactionId]
    );
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'transaction.updated', 'transaction', $2, $3::jsonb, $4, $5)`,
      [req.user.id, transactionId, JSON.stringify({ type: transaction.type, amount: transaction.amount, currency: transaction.currency, status: transaction.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ transaction: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.deleteTransaction = async (req, res, next) => {
  const transactionId = positiveIntegerParam(req);
  if (!transactionId) return res.status(400).json({ message: "Invalid transaction ID" });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id, payment_id, transaction_type, amount, currency, status, (SELECT id FROM payouts WHERE transaction_id = transactions.id LIMIT 1) AS payout_id FROM transactions WHERE id = $1 FOR UPDATE",
      [transactionId]
    );
    if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Transaction not found" }); }
    if (existing.rows[0].payment_id || existing.rows[0].payout_id) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Delete the source record instead of this managed transaction" }); }
    await client.query("DELETE FROM transactions WHERE id = $1", [transactionId]);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'transaction.deleted', 'transaction', $2, $3::jsonb, $4, $5)`,
      [req.user.id, transactionId, JSON.stringify(existing.rows[0]), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

