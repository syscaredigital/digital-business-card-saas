const { number } = require('../../helpers/metrics.helper');
const pool = require("../../config/database.config");
const { normalizeCurrency } = require("../../config/currencies");
const { syncPayoutTransaction } = require('../../services/admin-payout.service');
const { positiveIntegerParam } = require('../../validators/id.validator');
const { payoutMethods } = require('../../config/payout-methods');
const payoutStatuses = ["pending", "processing", "paid", "failed", "cancelled"];


function normalizePayoutPayload(body) {
  return {
    userId: body.userId ? Number(body.userId) : null,
    payeeName: String(body.payeeName || "").trim(),
    payeeEmail: String(body.payeeEmail || "").trim().toLowerCase() || null,
    amount: Number(body.amount),
    currency: String(body.currency || "USD").trim().toUpperCase(),
    method: String(body.method || "bank_transfer").trim().toLowerCase(),
    status: String(body.status || "pending").trim().toLowerCase(),
    reference: String(body.reference || "").trim() || null,
    accountName: String(body.accountName || "").trim() || null,
    notes: String(body.notes || "").trim() || null,
    scheduledAt: body.scheduledAt ? String(body.scheduledAt) : null,
  };
}

function payoutValidationMessage(payout) {
  if (payout.userId !== null && (!Number.isInteger(payout.userId) || payout.userId < 1 || payout.userId > 2147483647)) return "Select a valid linked user";
  if (!payout.payeeName || payout.payeeName.length > 150) return "Enter a payee name up to 150 characters";
  if (payout.payeeEmail && (payout.payeeEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payout.payeeEmail))) return "Enter a valid payee email";
  if (!Number.isFinite(payout.amount) || payout.amount < 0.01 || payout.amount > 9999999999.99) return "Enter an amount from 0.01 to 9,999,999,999.99";
  if (!normalizeCurrency(payout.currency)) return "Select a valid ISO 4217 currency";
  if (!payoutMethods.includes(payout.method)) return "Invalid payout method";
  if (!payoutStatuses.includes(payout.status)) return "Invalid payout status";
  if (payout.reference && payout.reference.length > 255) return "Reference must not exceed 255 characters";
  if (payout.accountName && payout.accountName.length > 500) return "Account details must not exceed 500 characters";
  if (payout.notes && payout.notes.length > 3000) return "Notes must not exceed 3,000 characters";
  if (payout.scheduledAt && Number.isNaN(new Date(payout.scheduledAt).getTime())) return "Enter a valid scheduled date";
  return null;
}

async function validateOptionalPayoutUser(client, userId) {
  if (!userId) return true;
  const result = await client.query(
    `SELECT u.id FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND COALESCE(r.name, 'user') <> 'super_admin'`,
    [userId]
  );
  return Boolean(result.rowCount);
}

exports.listPayouts = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();
    const values = [];
    const conditions = [];
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(po.payee_name ILIKE $${values.length} OR COALESCE(po.payee_email, '') ILIKE $${values.length}
        OR COALESCE(po.reference, '') ILIKE $${values.length} OR COALESCE(po.notes, '') ILIKE $${values.length}
        OR COALESCE(u.name, '') ILIKE $${values.length} OR po.status ILIKE $${values.length})`);
    }
    if (status && payoutStatuses.includes(status)) {
      values.push(status);
      conditions.push(`LOWER(po.status) = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [payoutsResult, usersResult, summaryResult, readyResult, paidResult] = await Promise.all([
      pool.query(
        `SELECT po.id, po.user_id, po.transaction_id, po.withdrawal_id, po.payee_name, po.payee_email,
                po.amount, po.currency, po.method, po.status, po.reference, po.account_details,
                po.notes, po.scheduled_at, po.paid_at, po.reviewed_at, po.created_at, po.updated_at,
                u.name AS user_name, u.email AS user_email, reviewer.name AS reviewer_name
         FROM payouts po LEFT JOIN users u ON u.id = po.user_id
         LEFT JOIN users reviewer ON reviewer.id = po.reviewed_by
         ${where} ORDER BY CASE po.status WHEN 'pending' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
         COALESCE(po.scheduled_at, po.created_at), po.created_at DESC LIMIT 150`,
        values
      ),
      pool.query(`SELECT u.id, u.name, u.email FROM users u LEFT JOIN roles r ON r.id = u.role_id
                  WHERE COALESCE(r.name, 'user') <> 'super_admin' ORDER BY u.name, u.email`),
      pool.query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::int AS ready_count,
                  COUNT(*) FILTER (WHERE status = 'paid' AND paid_at >= DATE_TRUNC('month', CURRENT_DATE))::int AS paid_month_count,
                  MIN(scheduled_at) FILTER (WHERE status IN ('pending', 'processing') AND scheduled_at >= NOW()) AS next_payout
                  FROM payouts`),
      pool.query(`SELECT currency, COALESCE(SUM(amount), 0) AS amount FROM payouts
                  WHERE status IN ('pending', 'processing') GROUP BY currency ORDER BY currency`),
      pool.query(`SELECT currency, COALESCE(SUM(amount), 0) AS amount FROM payouts
                  WHERE status = 'paid' AND paid_at >= DATE_TRUNC('month', CURRENT_DATE)
                  GROUP BY currency ORDER BY currency`),
    ]);
    res.json({
      payouts: payoutsResult.rows.map((payout) => ({
        id: payout.id, transactionId: payout.transaction_id || null,
        withdrawalId: payout.withdrawal_id || null, sourceManaged: Boolean(payout.withdrawal_id),
        user: payout.user_id ? { id: payout.user_id, name: payout.user_name || "Deleted user", email: payout.user_email || null } : null,
        payeeName: payout.payee_name, payeeEmail: payout.payee_email || null,
        amount: number(payout.amount), currency: payout.currency, method: payout.method,
        status: payout.status, reference: payout.reference || null,
        accountName: payout.account_details && payout.account_details.accountName ? payout.account_details.accountName : null,
        notes: payout.notes || null, scheduledAt: payout.scheduled_at || null, paidAt: payout.paid_at || null,
        reviewedAt: payout.reviewed_at || null, reviewerName: payout.reviewer_name || null,
        createdAt: payout.created_at, updatedAt: payout.updated_at,
      })),
      users: usersResult.rows,
      summary: {
        ...summaryResult.rows[0],
        readyByCurrency: readyResult.rows.map((row) => ({ currency: row.currency, amount: number(row.amount) })),
        paidByCurrency: paidResult.rows.map((row) => ({ currency: row.currency, amount: number(row.amount) })),
      },
    });
  } catch (error) { next(error); }
};

exports.createPayout = async (req, res, next) => {
  const payout = normalizePayoutPayload(req.body);
  const validation = payoutValidationMessage(payout);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    if (!(await validateOptionalPayoutUser(client, payout.userId))) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected user was not found" }); }
    const result = await client.query(
      `INSERT INTO payouts (user_id, payee_name, payee_email, amount, currency, method, status,
       reference, account_details, notes, scheduled_at, paid_at, reviewed_by, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::varchar, $8, $9::jsonb, $10, $11,
       CASE WHEN $7::varchar = 'paid' THEN NOW() ELSE NULL END,
       CASE WHEN $7::varchar <> 'pending' THEN $12::integer ELSE NULL END,
       CASE WHEN $7::varchar <> 'pending' THEN NOW() ELSE NULL END)
       RETURNING id, transaction_id`,
      [payout.userId, payout.payeeName, payout.payeeEmail, payout.amount, payout.currency, payout.method, payout.status, payout.reference, JSON.stringify({ accountName: payout.accountName }), payout.notes, payout.scheduledAt, req.user.id]
    );
    payout.id = result.rows[0].id;
    payout.transactionId = null;
    const transactionId = await syncPayoutTransaction(client, payout);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'payout.created', 'payout', $2, $3::jsonb, $4, $5)`,
      [req.user.id, payout.id, JSON.stringify({ payeeName: payout.payeeName, amount: payout.amount, currency: payout.currency, status: payout.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.status(201).json({ payout: { id: payout.id, transactionId, status: payout.status } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.updatePayout = async (req, res, next) => {
  const payoutId = positiveIntegerParam(req);
  if (!payoutId) return res.status(400).json({ message: "Invalid payout ID" });
  const payout = normalizePayoutPayload(req.body);
  const validation = payoutValidationMessage(payout);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    if (!(await validateOptionalPayoutUser(client, payout.userId))) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected user was not found" }); }
    const sourceResult = await client.query("SELECT withdrawal_id FROM payouts WHERE id = $1 FOR UPDATE", [payoutId]);
    if (!sourceResult.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Payout not found" }); }
    if (sourceResult.rows[0].withdrawal_id) { await client.query("ROLLBACK"); return res.status(409).json({ message: "This payout is managed by its source withdrawal" }); }
    const result = await client.query(
      `UPDATE payouts SET user_id = $1, payee_name = $2, payee_email = $3, amount = $4,
       currency = $5, method = $6, status = $7::varchar, reference = $8,
       account_details = $9::jsonb, notes = $10, scheduled_at = $11,
       paid_at = CASE WHEN $7::varchar = 'paid' THEN COALESCE(paid_at, NOW()) ELSE NULL END,
       reviewed_by = CASE WHEN $7::varchar <> 'pending' THEN $12::integer ELSE NULL END,
       reviewed_at = CASE WHEN $7::varchar <> 'pending' THEN NOW() ELSE NULL END,
       updated_at = NOW() WHERE id = $13 RETURNING id, transaction_id`,
      [payout.userId, payout.payeeName, payout.payeeEmail, payout.amount, payout.currency, payout.method, payout.status, payout.reference, JSON.stringify({ accountName: payout.accountName }), payout.notes, payout.scheduledAt, req.user.id, payoutId]
    );
    payout.id = payoutId;
    payout.transactionId = result.rows[0].transaction_id;
    const transactionId = await syncPayoutTransaction(client, payout);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'payout.updated', 'payout', $2, $3::jsonb, $4, $5)`,
      [req.user.id, payoutId, JSON.stringify({ payeeName: payout.payeeName, amount: payout.amount, currency: payout.currency, status: payout.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ payout: { id: payoutId, transactionId, status: payout.status } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.deletePayout = async (req, res, next) => {
  const payoutId = positiveIntegerParam(req);
  if (!payoutId) return res.status(400).json({ message: "Invalid payout ID" });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const existing = await client.query("SELECT id, transaction_id, withdrawal_id, payee_name, amount, currency, status FROM payouts WHERE id = $1 FOR UPDATE", [payoutId]);
    if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Payout not found" }); }
    if (existing.rows[0].withdrawal_id) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Delete the source withdrawal instead of this managed payout" }); }
    if (existing.rows[0].transaction_id) await client.query("DELETE FROM transactions WHERE id = $1", [existing.rows[0].transaction_id]);
    await client.query("DELETE FROM payouts WHERE id = $1", [payoutId]);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'payout.deleted', 'payout', $2, $3::jsonb, $4, $5)`,
      [req.user.id, payoutId, JSON.stringify(existing.rows[0]), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ message: "Payout deleted successfully" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

