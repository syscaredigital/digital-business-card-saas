const { number } = require('../../helpers/metrics.helper');
const pool = require("../../config/database.config");
const path = require("path");
const { normalizeCurrency } = require("../../config/currencies");
const { validateTransactionUser } = require('../../services/transaction-user.service');
const { syncPayoutTransaction } = require('../../services/admin-payout.service');
const { positiveIntegerParam } = require('../../validators/id.validator');
const { payoutMethods } = require('../../config/payout-methods');
const withdrawalStatuses = ["pending", "approved", "processing", "completed", "rejected", "cancelled"];
const withdrawalTransitions = {
  pending: ["approved", "rejected", "cancelled"],
  approved: ["processing", "completed", "rejected", "cancelled"],
  processing: ["completed", "rejected", "cancelled"],
  completed: [], rejected: [], cancelled: [],
};

function normalizeWithdrawalPayload(body) {
  return {
    userId: Number(body.userId),
    amount: Number(body.amount),
    currency: String(body.currency || "USD").trim().toUpperCase(),
    method: String(body.method || "bank_transfer").trim().toLowerCase(),
    status: String(body.status || "pending").trim().toLowerCase(),
    accountName: String(body.accountName || "").trim() || null,
    requestNote: String(body.requestNote || "").trim() || null,
    adminNote: String(body.adminNote || "").trim() || null,
  };
}

function withdrawalValidationMessage(withdrawal) {
  if (!Number.isInteger(withdrawal.userId) || withdrawal.userId < 1 || withdrawal.userId > 2147483647) return "Select a valid user";
  if (!Number.isFinite(withdrawal.amount) || withdrawal.amount < 0.01 || withdrawal.amount > 9999999999.99) return "Enter an amount from 0.01 to 9,999,999,999.99";
  if (!normalizeCurrency(withdrawal.currency)) return "Select a valid ISO 4217 currency";
  if (!payoutMethods.includes(withdrawal.method)) return "Invalid withdrawal method";
  if (!withdrawalStatuses.includes(withdrawal.status)) return "Invalid withdrawal status";
  if (withdrawal.accountName && withdrawal.accountName.length > 500) return "Account details must not exceed 500 characters";
  if (withdrawal.requestNote && withdrawal.requestNote.length > 3000) return "Request note must not exceed 3,000 characters";
  if (withdrawal.adminNote && withdrawal.adminNote.length > 3000) return "Admin note must not exceed 3,000 characters";
  if (["approved", "processing", "completed"].includes(withdrawal.status) && !withdrawal.accountName) return "Bank account details are required before approving this withdrawal";
  if (["rejected", "cancelled"].includes(withdrawal.status) && !withdrawal.adminNote) return "Add an admin note explaining why this withdrawal was declined";
  return null;
}

function withdrawalNotification(status, amount, currency) {
  const value = `${currency} ${Number(amount).toFixed(2)}`;
  const messages = {
    pending: `Your withdrawal request for ${value} was recorded and is awaiting review.`,
    approved: `Your withdrawal request for ${value} was approved and is ready for processing.`,
    processing: `Your withdrawal of ${value} is now being processed.`,
    completed: `Your withdrawal of ${value} has been completed.`,
    rejected: `Your withdrawal request for ${value} was rejected. Review the administrator note for details.`,
    cancelled: `Your withdrawal request for ${value} was cancelled.`,
  };
  return messages[status] || `Your withdrawal status changed to ${status}.`;
}

function withdrawalPayoutStatus(status) {
  if (status === "approved") return "pending";
  if (status === "processing") return "processing";
  if (status === "completed") return "paid";
  return "cancelled";
}

function withdrawalBankLabel(details) {
  if (!details || typeof details !== "object") return "";
  if (details.accountName) return String(details.accountName);
  return [details.accountHolder, details.bankName, details.accountNumber, details.branch, details.swiftCode].filter(Boolean).join(" | ");
}

async function syncWithdrawalPayout(client, withdrawal, reviewerId) {
  if (!withdrawal.payoutId && ["pending", "rejected", "cancelled"].includes(withdrawal.status)) return null;
  const userResult = await client.query("SELECT name, email FROM users WHERE id = $1", [withdrawal.userId]);
  const user = userResult.rows[0];
  const payoutStatus = withdrawalPayoutStatus(withdrawal.status);
  const reference = `WDL-${String(withdrawal.id).padStart(8, "0")}`;
  const payoutNotes = [withdrawal.requestNote, withdrawal.adminNote].filter(Boolean).join(" | ") || null;
  let payoutId = withdrawal.payoutId;
  let transactionId = null;
  if (payoutId) {
    const payoutResult = await client.query(
      `UPDATE payouts SET user_id = $1, withdrawal_id = $2, payee_name = $3, payee_email = $4,
       amount = $5, currency = $6, method = $7, status = $8::varchar, reference = $9,
       account_details = $10::jsonb, notes = $11, transfer_receipt_url = $12,
       paid_at = CASE WHEN $8::varchar = 'paid' THEN COALESCE(paid_at, NOW()) ELSE NULL END,
       reviewed_by = $13, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $14 RETURNING transaction_id`,
      [withdrawal.userId, withdrawal.id, user.name, user.email, withdrawal.amount, withdrawal.currency, withdrawal.method, payoutStatus, reference, JSON.stringify({ ...(withdrawal.accountDetails || { accountName: withdrawal.accountName }), withdrawalId: withdrawal.id }), payoutNotes, withdrawal.receiptUrl || null, reviewerId, payoutId]
    );
    transactionId = payoutResult.rows[0].transaction_id;
  } else {
    const payoutResult = await client.query(
      `INSERT INTO payouts (user_id, withdrawal_id, payee_name, payee_email, amount, currency,
       method, status, reference, account_details, notes, transfer_receipt_url, paid_at, reviewed_by, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::varchar, $9, $10::jsonb, $11, $12,
       CASE WHEN $8::varchar = 'paid' THEN NOW() ELSE NULL END, $13, NOW())
       RETURNING id, transaction_id`,
      [withdrawal.userId, withdrawal.id, user.name, user.email, withdrawal.amount, withdrawal.currency, withdrawal.method, payoutStatus, reference, JSON.stringify({ ...(withdrawal.accountDetails || { accountName: withdrawal.accountName }), withdrawalId: withdrawal.id }), payoutNotes, withdrawal.receiptUrl || null, reviewerId]
    );
    payoutId = payoutResult.rows[0].id;
    transactionId = payoutResult.rows[0].transaction_id;
    await client.query("UPDATE withdrawals SET payout_id = $1 WHERE id = $2", [payoutId, withdrawal.id]);
  }
  await syncPayoutTransaction(client, {
    id: payoutId, transactionId, userId: withdrawal.userId, payeeName: user.name,
    amount: withdrawal.amount, currency: withdrawal.currency, reference,
    method: withdrawal.method, status: payoutStatus, notes: payoutNotes,
  });
  return payoutId;
}

exports.listWithdrawals = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();
    const values = [];
    const conditions = [];
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(COALESCE(u.name, '') ILIKE $${values.length} OR COALESCE(u.email, '') ILIKE $${values.length}
        OR COALESCE(w.request_note, '') ILIKE $${values.length} OR COALESCE(w.admin_note, '') ILIKE $${values.length}
        OR w.status ILIKE $${values.length} OR w.method ILIKE $${values.length})`);
    }
    if (status && withdrawalStatuses.includes(status)) {
      values.push(status);
      conditions.push(`LOWER(w.status) = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [withdrawalsResult, usersResult, summaryResult, pendingResult, processedResult] = await Promise.all([
      pool.query(
        `SELECT w.id, w.user_id, w.affiliate_id, w.payout_id, w.amount, w.currency, w.method, w.status,
                 w.account_details, w.request_note, w.admin_note, w.transfer_receipt_url, w.reviewed_at, w.processed_at,
                w.created_at, w.updated_at, u.name AS user_name, u.email AS user_email,
                reviewer.name AS reviewer_name, po.transaction_id
         FROM withdrawals w JOIN users u ON u.id = w.user_id
         LEFT JOIN users reviewer ON reviewer.id = w.reviewed_by
         LEFT JOIN payouts po ON po.id = w.payout_id
         ${where} ORDER BY CASE w.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'processing' THEN 2 ELSE 3 END, w.created_at DESC LIMIT 150`,
        values
      ),
      pool.query(`SELECT u.id, u.name, u.email FROM users u LEFT JOIN roles r ON r.id = u.role_id
                  WHERE COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active' ORDER BY u.name, u.email`),
      pool.query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
                  COUNT(*) FILTER (WHERE status = 'completed' AND processed_at >= DATE_TRUNC('month', CURRENT_DATE))::int AS processed_month_count,
                  COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 86400.0) FILTER (WHERE reviewed_at IS NOT NULL), 1), 0) AS average_review_days
                  FROM withdrawals`),
      pool.query(`SELECT currency, COALESCE(SUM(amount), 0) AS amount FROM withdrawals WHERE status = 'pending' GROUP BY currency ORDER BY currency`),
      pool.query(`SELECT currency, COALESCE(SUM(amount), 0) AS amount FROM withdrawals WHERE status = 'completed' AND processed_at >= DATE_TRUNC('month', CURRENT_DATE) GROUP BY currency ORDER BY currency`),
    ]);
    res.json({
      withdrawals: withdrawalsResult.rows.map((withdrawal) => ({
        id: withdrawal.id,
        user: { id: withdrawal.user_id, name: withdrawal.user_name, email: withdrawal.user_email },
        affiliateId: withdrawal.affiliate_id || null, affiliateManaged: Boolean(withdrawal.affiliate_id),
        payoutId: withdrawal.payout_id || null, transactionId: withdrawal.transaction_id || null,
        amount: number(withdrawal.amount), currency: withdrawal.currency, method: withdrawal.method,
        status: withdrawal.status,
        accountName: withdrawalBankLabel(withdrawal.account_details) || null, bankDetails: withdrawal.account_details || {},
        requestNote: withdrawal.request_note || null, adminNote: withdrawal.admin_note || null,
        receiptAvailable: Boolean(withdrawal.transfer_receipt_url), receiptUrl: withdrawal.transfer_receipt_url || null,
        reviewerName: withdrawal.reviewer_name || null, reviewedAt: withdrawal.reviewed_at || null,
        processedAt: withdrawal.processed_at || null, createdAt: withdrawal.created_at, updatedAt: withdrawal.updated_at,
      })),
      users: usersResult.rows,
      summary: {
        ...summaryResult.rows[0],
        pendingByCurrency: pendingResult.rows.map((row) => ({ currency: row.currency, amount: number(row.amount) })),
        processedByCurrency: processedResult.rows.map((row) => ({ currency: row.currency, amount: number(row.amount) })),
      },
    });
  } catch (error) { next(error); }
};

exports.uploadWithdrawalReceipt = async (req, res, next) => {
  const withdrawalId = positiveIntegerParam(req);
  if (!withdrawalId) return res.status(400).json({ message: "Invalid withdrawal ID" });
  if (!req.file) return res.status(400).json({ message: "Upload a JPG, PNG, WebP, or PDF transfer receipt" });
  const receiptUrl = `/uploads/payment-slips/${req.file.filename}`;
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const existing = await client.query("SELECT id,payout_id,status FROM withdrawals WHERE id=$1 FOR UPDATE", [withdrawalId]);
    if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Withdrawal not found" }); }
    if (!["approved", "processing", "completed"].includes(existing.rows[0].status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Approve the withdrawal before uploading its transfer receipt" });
    }
    await client.query("UPDATE withdrawals SET transfer_receipt_url=$1,updated_at=NOW() WHERE id=$2", [receiptUrl, withdrawalId]);
    if (existing.rows[0].payout_id) await client.query("UPDATE payouts SET transfer_receipt_url=$1,updated_at=NOW() WHERE id=$2", [receiptUrl, existing.rows[0].payout_id]);
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata)
      VALUES($1,'withdrawal.receipt_uploaded','withdrawal',$2,$3::jsonb)`, [req.user.id, withdrawalId, JSON.stringify({ receiptUrl })]);
    await client.query("COMMIT");
    res.json({ message: "Bank transfer receipt uploaded", receiptAvailable: true });
  } catch (error) { if (client) await client.query("ROLLBACK").catch(() => {}); next(error); }
  finally { if (client) client.release(); }
};

exports.downloadWithdrawalReceipt = async (req, res, next) => {
  const withdrawalId = positiveIntegerParam(req);
  if (!withdrawalId) return res.status(400).json({ message: "Invalid withdrawal ID" });
  try {
    const result = await pool.query("SELECT transfer_receipt_url FROM withdrawals WHERE id=$1", [withdrawalId]);
    if (!result.rowCount || !result.rows[0].transfer_receipt_url) return res.status(404).json({ message: "Transfer receipt is not available" });
    const receiptUrl = result.rows[0].transfer_receipt_url;
    if (!/^\/uploads\/payment-slips\/[A-Za-z0-9._-]+$/.test(receiptUrl)) return res.status(400).json({ message: "Invalid receipt path" });
    const uploadRoot = path.resolve(__dirname, "..", "..", "uploads", "payment-slips");
    const filePath = path.resolve(uploadRoot, path.basename(receiptUrl));
    if (!filePath.startsWith(uploadRoot + path.sep)) return res.status(400).json({ message: "Invalid receipt path" });
    res.download(filePath, `withdrawal-${withdrawalId}-receipt${path.extname(filePath)}`);
  } catch (error) { next(error); }
};

exports.createWithdrawal = async (req, res, next) => {
  const withdrawal = normalizeWithdrawalPayload(req.body);
  if (withdrawal.status !== "pending") return res.status(400).json({ message: "New withdrawal requests must start as pending" });
  const validation = withdrawalValidationMessage(withdrawal);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    if (!(await validateTransactionUser(client, withdrawal.userId))) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected user was not found" }); }
    const result = await client.query(
      `INSERT INTO withdrawals (user_id, amount, currency, method, status, account_details,
       request_note, admin_note, reviewed_by, reviewed_at, processed_at)
       VALUES ($1, $2, $3, $4, $5::varchar, $6::jsonb, $7, $8,
       CASE WHEN $5::varchar <> 'pending' THEN $9::integer ELSE NULL END,
       CASE WHEN $5::varchar <> 'pending' THEN NOW() ELSE NULL END,
       CASE WHEN $5::varchar = 'completed' THEN NOW() ELSE NULL END)
       RETURNING id, payout_id`,
      [withdrawal.userId, withdrawal.amount, withdrawal.currency, withdrawal.method, withdrawal.status, JSON.stringify({ accountName: withdrawal.accountName }), withdrawal.requestNote, withdrawal.adminNote, req.user.id]
    );
    withdrawal.id = result.rows[0].id;
    withdrawal.payoutId = null;
    withdrawal.accountDetails = { accountName: withdrawal.accountName };
    await client.query("UPDATE withdrawals SET affiliate_id = (SELECT id FROM affiliate_profiles WHERE user_id = $1) WHERE id = $2", [withdrawal.userId, withdrawal.id]);
    const payoutId = await syncWithdrawalPayout(client, withdrawal, req.user.id);
    await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,'Withdrawal request received',$2,'withdrawal')`,
      [withdrawal.userId, withdrawalNotification("pending", withdrawal.amount, withdrawal.currency)]);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'withdrawal.created', 'withdrawal', $2, $3::jsonb, $4, $5)`,
      [req.user.id, withdrawal.id, JSON.stringify({ userId: withdrawal.userId, amount: withdrawal.amount, currency: withdrawal.currency, status: withdrawal.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.status(201).json({ withdrawal: { id: withdrawal.id, payoutId, status: withdrawal.status } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.updateWithdrawal = async (req, res, next) => {
  const withdrawalId = positiveIntegerParam(req);
  if (!withdrawalId) return res.status(400).json({ message: "Invalid withdrawal ID" });
  const withdrawal = normalizeWithdrawalPayload(req.body);
  const validation = withdrawalValidationMessage(withdrawal);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const existing = await client.query(`SELECT id,user_id,affiliate_id,payout_id,amount,currency,method,status,account_details,transfer_receipt_url
      FROM withdrawals WHERE id=$1 FOR UPDATE`, [withdrawalId]);
    if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Withdrawal not found" }); }
    const previous = existing.rows[0];
    withdrawal.accountDetails = previous.affiliate_id ? previous.account_details : { accountName: withdrawal.accountName };
    if (withdrawal.status === "completed" && !previous.transfer_receipt_url) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Upload the bank transfer receipt before completing this withdrawal" });
    }
    if (withdrawal.status !== previous.status && !(withdrawalTransitions[previous.status] || []).includes(withdrawal.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: `A ${previous.status} withdrawal cannot move to ${withdrawal.status}` });
    }
    if (["completed", "rejected", "cancelled"].includes(previous.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: `This ${previous.status} withdrawal is final and cannot be edited` });
    }
    const financialDetailsChanged = Number(previous.user_id) !== withdrawal.userId || number(previous.amount) !== withdrawal.amount ||
      previous.currency !== withdrawal.currency || previous.method !== withdrawal.method;
    if (previous.affiliate_id && financialDetailsChanged) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Affiliate withdrawal user, amount, currency, and method are fixed by the original request" });
    }
    if (previous.status !== "pending" && financialDetailsChanged) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "User, amount, currency, and method cannot change after approval" });
    }
    if (!(await validateTransactionUser(client, withdrawal.userId))) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected user was not found" }); }
    const result = await client.query(
      `UPDATE withdrawals SET user_id = $1, amount = $2, currency = $3, method = $4,
       status = $5::varchar, account_details = $6::jsonb, request_note = $7, admin_note = $8,
       reviewed_by = CASE WHEN $5::varchar <> 'pending' THEN $9::integer ELSE NULL END,
       reviewed_at = CASE WHEN $5::varchar <> 'pending' THEN NOW() ELSE NULL END,
       processed_at = CASE WHEN $5::varchar = 'completed' THEN COALESCE(processed_at, NOW()) ELSE NULL END,
       updated_at = NOW() WHERE id = $10 RETURNING id, payout_id`,
       [withdrawal.userId, withdrawal.amount, withdrawal.currency, withdrawal.method, withdrawal.status, JSON.stringify(withdrawal.accountDetails), withdrawal.requestNote, withdrawal.adminNote, req.user.id, withdrawalId]
    );
    withdrawal.id = withdrawalId;
    withdrawal.payoutId = result.rows[0].payout_id;
    withdrawal.receiptUrl = previous.transfer_receipt_url || null;
    await client.query("UPDATE withdrawals SET affiliate_id = (SELECT id FROM affiliate_profiles WHERE user_id = $1) WHERE id = $2", [withdrawal.userId, withdrawalId]);
    const payoutId = await syncWithdrawalPayout(client, withdrawal, req.user.id);
    if (withdrawal.status !== previous.status) await client.query(
      `INSERT INTO notifications(user_id,title,message,type) VALUES($1,$2,$3,'withdrawal')`,
      [withdrawal.userId, `Withdrawal ${withdrawal.status}`, withdrawalNotification(withdrawal.status, withdrawal.amount, withdrawal.currency)]
    );
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'withdrawal.updated', 'withdrawal', $2, $3::jsonb, $4, $5)`,
      [req.user.id, withdrawalId, JSON.stringify({ userId: withdrawal.userId, amount: withdrawal.amount, currency: withdrawal.currency, status: withdrawal.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ withdrawal: { id: withdrawalId, payoutId, status: withdrawal.status } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.deleteWithdrawal = async (req, res, next) => {
  const withdrawalId = positiveIntegerParam(req);
  if (!withdrawalId) return res.status(400).json({ message: "Invalid withdrawal ID" });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const existing = await client.query("SELECT id, payout_id, user_id, amount, currency, status FROM withdrawals WHERE id = $1 FOR UPDATE", [withdrawalId]);
    if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Withdrawal not found" }); }
    if (!["pending", "rejected", "cancelled"].includes(existing.rows[0].status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Approved, processing, or completed withdrawals cannot be deleted" });
    }
    if (existing.rows[0].payout_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "This withdrawal has a payout ledger record and must be retained for audit history" });
    }
    await client.query("DELETE FROM withdrawals WHERE id = $1", [withdrawalId]);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'withdrawal.deleted', 'withdrawal', $2, $3::jsonb, $4, $5)`,
      [req.user.id, withdrawalId, JSON.stringify(existing.rows[0]), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ message: "Withdrawal deleted successfully" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

