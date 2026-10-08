const { number } = require('../../helpers/metrics.helper');
const pool = require("../../config/database.config");
const path = require("path");
const { normalizeCurrency } = require("../../config/currencies");
const { captureRevenueRate } = require('../../services/revenue.service');
const { createAffiliateCommissionForPayment } = require('../../services/admin-commission.service');
const { positiveIntegerParam } = require('../../validators/id.validator');
const cashPaymentStatuses = ["pending", "approved", "rejected"];
const cashPaymentMethods = ["cash", "manual", "bank_transfer", "cash_payment"];

function normalizeCashPaymentPayload(body) {
  return {
    userId: Number(body.userId),
    subscriptionId: body.subscriptionId ? Number(body.subscriptionId) : null,
    amount: Number(body.amount),
    currency: String(body.currency || "USD").trim().toUpperCase(),
    status: String(body.status || "pending").trim().toLowerCase(),
    reference: String(body.reference || "").trim() || null,
    proofUrl: String(body.proofUrl || "").trim() || null,
    notes: String(body.notes || "").trim() || null,
  };
}

function cashPaymentValidationMessage(payment) {
  if (!Number.isInteger(payment.userId) || payment.userId < 1 || payment.userId > 2147483647) return "Select a valid user";
  if (payment.subscriptionId !== null && (!Number.isInteger(payment.subscriptionId) || payment.subscriptionId < 1 || payment.subscriptionId > 2147483647)) return "Select a valid subscription";
  if (!Number.isFinite(payment.amount) || payment.amount < 0.01 || payment.amount > 9999999999.99) return "Enter an amount from 0.01 to 9,999,999,999.99";
  if (!normalizeCurrency(payment.currency)) return "Select a valid ISO 4217 currency";
  if (!cashPaymentStatuses.includes(payment.status)) return "Invalid cash payment status";
  if (payment.reference && payment.reference.length > 255) return "Payment reference must not exceed 255 characters";
  if (payment.proofUrl && (payment.proofUrl.length > 2000 || !(/^(https?:\/\/)/i.test(payment.proofUrl) || /^\/uploads\/payment-slips\/[A-Za-z0-9._-]+$/.test(payment.proofUrl)))) return "Proof attachment must be a valid URL or uploaded payment slip";
  if (payment.notes && payment.notes.length > 3000) return "Notes must not exceed 3,000 characters";
  return null;
}

async function validateCashPaymentRelations(client, payment) {
  const userResult = await client.query(
    `SELECT u.id FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND COALESCE(r.name, 'user') <> 'super_admin'`,
    [payment.userId]
  );
  if (!userResult.rowCount) return "Selected user was not found";
  if (payment.subscriptionId) {
    const subscriptionResult = await client.query(
      "SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2",
      [payment.subscriptionId, payment.userId]
    );
    if (!subscriptionResult.rowCount) return "Selected subscription does not belong to this user";
  }
  return null;
}

async function syncCashPaymentTransaction(client, payment) {
  await captureRevenueRate(client, 'payment', payment.id);
  const transactionStatus = payment.status === "approved" ? "completed" : payment.status;
  const existing = await client.query(
    "SELECT id FROM transactions WHERE payment_id = $1 ORDER BY id LIMIT 1",
    [payment.id]
  );
  if (existing.rowCount) {
    await client.query(
      `UPDATE transactions SET user_id = $1, transaction_type = 'cash_payment', amount = $2,
       currency = $3, reference = $4, gateway = 'manual', status = $5,
       metadata = $6::jsonb, updated_at = NOW() WHERE id = $7`,
      [payment.userId, payment.amount, payment.currency, payment.reference, transactionStatus, JSON.stringify({ subscriptionId: payment.subscriptionId }), existing.rows[0].id]
    );
  } else {
    await client.query(
      `INSERT INTO transactions (payment_id, user_id, transaction_type, amount, currency, reference, gateway, status, metadata)
       VALUES ($1, $2, 'cash_payment', $3, $4, $5, 'manual', $6, $7::jsonb)`,
      [payment.id, payment.userId, payment.amount, payment.currency, payment.reference, transactionStatus, JSON.stringify({ subscriptionId: payment.subscriptionId })]
    );
  }
  if (payment.subscriptionId && payment.status === "approved") {
    await client.query("UPDATE coupon_redemptions SET status='applied' WHERE payment_id=$1 AND status='pending'", [payment.id]);
    const subscription = await client.query(
      `SELECT s.id,s.user_id,p.name,p.billing_interval FROM subscriptions s LEFT JOIN plans p ON p.id=s.plan_id
       WHERE s.id=$1 FOR UPDATE OF s`, [payment.subscriptionId]
    );
    if (subscription.rowCount) {
      const selected = subscription.rows[0];
      await client.query(`UPDATE subscriptions SET status='cancelled',cancel_reason='Replaced by approved subscription',updated_at=NOW()
        WHERE user_id=$1 AND status='active' AND id<>$2`, [selected.user_id, payment.subscriptionId]);
      await client.query(`UPDATE subscriptions SET status='active',start_date=CURRENT_DATE,
        end_date=CASE WHEN LOWER(COALESCE($2,'')) IN ('year','yearly','annual') THEN (CURRENT_DATE + INTERVAL '1 year')::date
                      WHEN LOWER(COALESCE($2,'')) IN ('week','weekly') THEN (CURRENT_DATE + INTERVAL '1 week')::date
                      WHEN LOWER(COALESCE($2,'')) IN ('day','daily') THEN (CURRENT_DATE + INTERVAL '1 day')::date
                      WHEN LOWER(COALESCE($2,''))='lifetime' THEN NULL
                      ELSE (CURRENT_DATE + INTERVAL '1 month')::date END,
        auto_renew=FALSE,cancel_reason=NULL,updated_at=NOW() WHERE id=$1`, [payment.subscriptionId, selected.billing_interval]);
      await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,'Subscription activated',$2,'billing')`,
        [selected.user_id, `Your ${selected.name || "paid"} plan payment was approved and the plan is now active.`]);
      await createAffiliateCommissionForPayment(client, payment.id);
    }
  } else if (payment.subscriptionId && payment.status === "rejected") {
    await client.query("UPDATE coupon_redemptions SET status='cancelled' WHERE payment_id=$1 AND status='pending'", [payment.id]);
    const rejected = await client.query(`UPDATE subscriptions SET status='cancelled',cancel_reason='Manual payment rejected',updated_at=NOW()
      WHERE id=$1 AND status='pending' RETURNING user_id`, [payment.subscriptionId]);
    if (rejected.rowCount) await client.query(`INSERT INTO notifications(user_id,title,message,type)
      VALUES($1,'Payment needs attention','Your manual subscription payment was rejected. Please submit a new payment slip.','billing')`, [rejected.rows[0].user_id]);
  }
}

exports.listCashPayments = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();
    const values = [cashPaymentMethods];
    const conditions = ["LOWER(COALESCE(pay.method, '')) = ANY($1::text[])"];
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(COALESCE(u.name, '') ILIKE $${values.length} OR COALESCE(u.email, '') ILIKE $${values.length}
        OR COALESCE(p.name, '') ILIKE $${values.length} OR COALESCE(pay.gateway_reference, '') ILIKE $${values.length}
        OR COALESCE(pay.notes, '') ILIKE $${values.length} OR pay.status ILIKE $${values.length})`);
    }
    if (status && cashPaymentStatuses.includes(status)) {
      values.push(status);
      conditions.push(`LOWER(pay.status) = $${values.length}`);
    }
    const where = conditions.join(" AND ");
    const [paymentsResult, usersResult, subscriptionsResult, summaryResult] = await Promise.all([
      pool.query(
        `SELECT pay.id, pay.subscription_id, pay.user_id, pay.amount, pay.currency, pay.method,
                pay.status, pay.gateway_reference, pay.proof_url, pay.notes, pay.paid_at,
                pay.reviewed_at, pay.created_at, pay.updated_at,
                u.name AS user_name, u.email AS user_email,
                s.start_date, s.end_date, p.name AS plan_name, p.price AS plan_price,
                reviewer.name AS reviewer_name
         FROM payments pay
         LEFT JOIN users u ON u.id = pay.user_id
         LEFT JOIN subscriptions s ON s.id = pay.subscription_id
         LEFT JOIN plans p ON p.id = s.plan_id
         LEFT JOIN users reviewer ON reviewer.id = pay.reviewed_by
         WHERE ${where}
         ORDER BY CASE WHEN pay.status = 'pending' THEN 0 ELSE 1 END, pay.created_at DESC
         LIMIT 100`,
        values
      ),
      pool.query(`SELECT u.id, u.name, u.email FROM users u LEFT JOIN roles r ON r.id = u.role_id
                  WHERE COALESCE(r.name, 'user') <> 'super_admin' ORDER BY u.name, u.email`),
      pool.query(`SELECT s.id, s.user_id, s.start_date, s.end_date, s.status, p.name AS plan_name, p.price AS plan_price
                  FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id ORDER BY s.created_at DESC`),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
                COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending_value,
                COUNT(*) FILTER (WHERE status = 'approved' AND COALESCE(paid_at, updated_at)::date = CURRENT_DATE)::int AS approved_today_count,
                COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND COALESCE(paid_at, updated_at)::date = CURRENT_DATE), 0) AS approved_today_value,
                CASE WHEN COUNT(*) FILTER (WHERE status IN ('approved', 'rejected')) = 0 THEN 0
                     ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'approved') / COUNT(*) FILTER (WHERE status IN ('approved', 'rejected')), 1) END AS approval_rate
         FROM payments WHERE LOWER(COALESCE(method, '')) = ANY($1::text[])`,
        [cashPaymentMethods]
      ),
    ]);

    res.json({
      payments: paymentsResult.rows.map((payment) => ({
        id: payment.id,
        user: { id: payment.user_id, name: payment.user_name || "Deleted user", email: payment.user_email || null },
        subscriptionId: payment.subscription_id,
        plan: payment.plan_name ? { name: payment.plan_name, price: number(payment.plan_price) } : null,
        amount: number(payment.amount), currency: payment.currency, method: payment.method,
        status: payment.status, reference: payment.gateway_reference || null,
        proofUrl: payment.proof_url || null, notes: payment.notes || null,
        startDate: payment.start_date || null, endDate: payment.end_date || null,
        paidAt: payment.paid_at || null, reviewedAt: payment.reviewed_at || null,
        reviewerName: payment.reviewer_name || null, createdAt: payment.created_at, updatedAt: payment.updated_at,
      })),
      users: usersResult.rows,
      subscriptions: subscriptionsResult.rows.map((subscription) => ({
        id: subscription.id, userId: subscription.user_id, planName: subscription.plan_name || "No plan",
        planPrice: number(subscription.plan_price), startDate: subscription.start_date,
        endDate: subscription.end_date || null, status: subscription.status,
      })),
      summary: summaryResult.rows[0],
    });
  } catch (error) { next(error); }
};

exports.downloadCashPaymentProof = async (req, res, next) => {
  const paymentId = positiveIntegerParam(req);
  if (!paymentId) return res.status(400).json({ message: "Invalid cash payment ID" });
  try {
    const result = await pool.query(
      `SELECT proof_url FROM payments WHERE id=$1 AND LOWER(COALESCE(method,''))=ANY($2::text[])`,
      [paymentId, cashPaymentMethods]
    );
    if (!result.rowCount || !result.rows[0].proof_url) return res.status(404).json({ message: "Payment proof not found" });
    const proofUrl = result.rows[0].proof_url;
    if (!/^\/uploads\/payment-slips\/[A-Za-z0-9._-]+$/.test(proofUrl)) return res.status(400).json({ message: "This payment uses an external proof link" });
    const uploadRoot = path.resolve(__dirname, "..", "..", "uploads", "payment-slips");
    const filePath = path.resolve(uploadRoot, path.basename(proofUrl));
    if (!filePath.startsWith(uploadRoot + path.sep)) return res.status(400).json({ message: "Invalid payment proof path" });
    res.set({ "Content-Disposition": "attachment; filename=\"payment-receipt" + path.extname(filePath) + "\"", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    return res.sendFile(filePath, { dotfiles: "deny" }, (error) => {
      if (error && !res.headersSent) next(Object.assign(error, { status: error.status || 404 }));
    });
  } catch (error) { next(error); }
};

exports.createCashPayment = async (req, res, next) => {
  const payment = normalizeCashPaymentPayload(req.body);
  const validation = cashPaymentValidationMessage(payment);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const relationError = await validateCashPaymentRelations(client, payment);
    if (relationError) { await client.query("ROLLBACK"); return res.status(400).json({ message: relationError }); }
    const result = await client.query(
      `INSERT INTO payments (subscription_id, user_id, amount, currency, method, status, gateway_reference,
       proof_url, notes, paid_at, reviewed_by, reviewed_at)
       VALUES ($1, $2, $3, $4, 'cash', $5::varchar, $6, $7, $8,
       CASE WHEN $5::varchar = 'approved' THEN NOW() ELSE NULL END,
       CASE WHEN $5::varchar IN ('approved', 'rejected') THEN $9::integer ELSE NULL END,
       CASE WHEN $5::varchar IN ('approved', 'rejected') THEN NOW() ELSE NULL END)
       RETURNING id, user_id, subscription_id, amount, currency, status, gateway_reference`,
      [payment.subscriptionId, payment.userId, payment.amount, payment.currency, payment.status, payment.reference, payment.proofUrl, payment.notes, req.user.id]
    );
    const saved = { ...payment, ...result.rows[0], userId: result.rows[0].user_id, subscriptionId: result.rows[0].subscription_id, reference: result.rows[0].gateway_reference };
    await syncCashPaymentTransaction(client, saved);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'cash_payment.created', 'payment', $2, $3::jsonb, $4, $5)`,
      [req.user.id, saved.id, JSON.stringify({ userId: saved.userId, amount: saved.amount, currency: saved.currency, status: saved.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.status(201).json({ payment: { id: saved.id, status: saved.status } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.updateCashPayment = async (req, res, next) => {
  const paymentId = positiveIntegerParam(req);
  if (!paymentId) return res.status(400).json({ message: "Invalid cash payment ID" });
  const payment = normalizeCashPaymentPayload(req.body);
  const validation = cashPaymentValidationMessage(payment);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id IN ($1,(SELECT user_id FROM payments WHERE id=$2)) ORDER BY id FOR UPDATE",[payment.userId,paymentId]);
    const previousResult = await client.query("SELECT * FROM payments WHERE id=$1 AND LOWER(COALESCE(method,''))=ANY($2::text[]) FOR UPDATE",[paymentId,cashPaymentMethods]);
    if (!previousResult.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({message:"Cash payment not found"}); }
    const previous = previousResult.rows[0];
    if (["approved","rejected"].includes(previous.status)) {
      const identical = previous.status===payment.status && Number(previous.user_id)===payment.userId &&
        Number(previous.subscription_id || 0)===Number(payment.subscriptionId || 0) && Number(previous.amount)===payment.amount &&
        previous.currency===payment.currency && (previous.gateway_reference || null)===(payment.reference || null) &&
        (previous.proof_url || null)===(payment.proofUrl || null) && (previous.notes || null)===(payment.notes || null);
      await client.query("ROLLBACK");
      return identical ? res.json({payment:{id:paymentId,status:previous.status}}) : res.status(409).json({message:"Reviewed payments are final. Record corrections separately."});
    }
    const relationError = await validateCashPaymentRelations(client, payment);
    if (relationError) { await client.query("ROLLBACK"); return res.status(400).json({ message: relationError }); }
    const result = await client.query(
      `UPDATE payments SET subscription_id = $1, user_id = $2, amount = $3, currency = $4,
       method = 'cash', status = $5::varchar, gateway_reference = $6, proof_url = $7, notes = $8,
       paid_at = CASE WHEN $5::varchar = 'approved' THEN COALESCE(paid_at, NOW()) ELSE NULL END,
       reviewed_by = CASE WHEN $5::varchar IN ('approved', 'rejected') THEN $9::integer ELSE NULL END,
       reviewed_at = CASE WHEN $5::varchar IN ('approved', 'rejected') THEN NOW() ELSE NULL END,
       updated_at = NOW() WHERE id = $10 AND LOWER(COALESCE(method, '')) = ANY($11::text[])
       RETURNING id, user_id, subscription_id, amount, currency, status, gateway_reference`,
      [payment.subscriptionId, payment.userId, payment.amount, payment.currency, payment.status, payment.reference, payment.proofUrl, payment.notes, req.user.id, paymentId, cashPaymentMethods]
    );
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Cash payment not found" }); }
    const saved = { ...payment, ...result.rows[0], userId: result.rows[0].user_id, subscriptionId: result.rows[0].subscription_id, reference: result.rows[0].gateway_reference };
    await syncCashPaymentTransaction(client, saved);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'cash_payment.updated', 'payment', $2, $3::jsonb, $4, $5)`,
      [req.user.id, paymentId, JSON.stringify({ amount: saved.amount, currency: saved.currency, status: saved.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ payment: { id: saved.id, status: saved.status } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.deleteCashPayment = async (req, res, next) => {
  const paymentId = positiveIntegerParam(req);
  if (!paymentId) return res.status(400).json({ message: "Invalid cash payment ID" });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id, amount, currency, status FROM payments WHERE id = $1 AND LOWER(COALESCE(method, '')) = ANY($2::text[]) FOR UPDATE",
      [paymentId, cashPaymentMethods]
    );
    if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Cash payment not found" }); }
    if (existing.rows[0].status === "approved") { await client.query("ROLLBACK"); return res.status(409).json({message:"Approved payments must be retained for the audit trail"}); }
    await client.query("UPDATE coupon_redemptions SET status='cancelled' WHERE payment_id=$1 AND status='pending'", [paymentId]);
    await client.query("DELETE FROM transactions WHERE payment_id = $1", [paymentId]);
    await client.query("DELETE FROM payments WHERE id = $1", [paymentId]);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'cash_payment.deleted', 'payment', $2, $3::jsonb, $4, $5)`,
      [req.user.id, paymentId, JSON.stringify(existing.rows[0]), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ message: "Cash payment deleted successfully" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

