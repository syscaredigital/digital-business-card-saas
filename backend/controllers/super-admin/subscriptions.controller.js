const { number } = require('../../helpers/metrics.helper');
const { currentSubscription } = require('../../services/subscription-policy');
const pool = require("../../config/database.config");
const { VCARD_FEATURES, normalizePlanFeatures } = require("../../config/vcard-features");
const { normalizeCurrency } = require("../../config/currencies");
const { positiveIntegerParam } = require('../../validators/id.validator');
const subscriptionStatuses = ["active", "pending", "trial", "cancelled", "expired"];
const planStatuses = ["active", "inactive", "archived"];
const billingIntervals = ["monthly", "yearly", "weekly", "daily", "lifetime"];

function validIsoDate(value) {
  if (!value) return false;
  const text = String(value);
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

exports.listSubscriptionManagement = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const values = [];
    let subscriptionSearch = "";
    if (search) {
      values.push(`%${search}%`);
      subscriptionSearch = `WHERE (COALESCE(u.name, '') ILIKE $1 OR COALESCE(u.email, '') ILIKE $1 OR COALESCE(p.name, '') ILIKE $1 OR s.status ILIKE $1)`;
    }
    const [subscriptionsResult, plansResult, usersResult, summaryResult, templatesResult] = await Promise.all([
      pool.query(
        `SELECT s.id, s.user_id, s.plan_id, s.status, s.start_date, s.end_date, s.auto_renew,
                s.cancel_reason, s.created_at, s.updated_at,
                u.name AS user_name, u.email AS user_email,
                p.name AS plan_name, p.price AS plan_price, p.billing_interval
         FROM subscriptions s
         LEFT JOIN users u ON u.id = s.user_id
         LEFT JOIN plans p ON p.id = s.plan_id
         ${subscriptionSearch}
         ORDER BY s.updated_at DESC
         LIMIT 100`,
        values
      ),
      pool.query(`
        SELECT p.id, p.name, p.price, p.billing_interval, p.vcard_limit, p.nfc_limit,
               p.analytics_limit, p.storage_limit_mb, p.features, p.status, p.created_at, p.updated_at,
               (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id)::int AS subscriber_count,
               (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id AND ${currentSubscription()})::int AS active_subscriber_count
        FROM plans p ORDER BY p.price, p.name
      `),
      pool.query(`
        SELECT u.id, u.name, u.email
        FROM users u LEFT JOIN roles r ON r.id = u.role_id
        WHERE COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active'
        ORDER BY u.name, u.email
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_subscriptions,
          COUNT(*) FILTER (WHERE ${currentSubscription()})::int AS active_subscriptions,
          COUNT(*) FILTER (WHERE s.status IN ('pending', 'trial'))::int AS pending_subscriptions,
          COALESCE(SUM(CASE
            WHEN s.status <> 'active' THEN 0
            WHEN p.billing_interval = 'yearly' THEN p.price / 12
            WHEN p.billing_interval = 'weekly' THEN p.price * 4.345
            WHEN p.billing_interval = 'daily' THEN p.price * 30
            WHEN p.billing_interval = 'lifetime' THEN 0
            ELSE p.price END), 0) AS monthly_recurring_revenue,
          'LKR' AS revenue_currency
        FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
      `),
      pool.query(`SELECT id,name,description,preview_url FROM vcard_templates WHERE is_public=TRUE ORDER BY id`),
    ]);

    res.json({
      subscriptions: subscriptionsResult.rows.map((subscription) => ({
        id: subscription.id,
        user: { id: subscription.user_id, name: subscription.user_name || "Deleted user", email: subscription.user_email || null },
        plan: subscription.plan_id ? { id: subscription.plan_id, name: subscription.plan_name || "Deleted plan", price: number(subscription.plan_price), currency: "LKR", billingInterval: subscription.billing_interval } : null,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date || null,
        autoRenew: Boolean(subscription.auto_renew),
        cancelReason: subscription.cancel_reason || null,
        createdAt: subscription.created_at,
        updatedAt: subscription.updated_at,
      })),
      plans: plansResult.rows.map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: number(plan.price),
        prices: { LKR: number(plan.price) },
        billingInterval: plan.billing_interval,
        vcardLimit: number(plan.vcard_limit),
        nfcLimit: number(plan.nfc_limit),
        analyticsLimit: number(plan.analytics_limit),
        storageLimitMb: number(plan.storage_limit_mb),
        features: plan.features || {},
        status: plan.status,
        subscribers: number(plan.subscriber_count),
        activeSubscribers: number(plan.active_subscriber_count),
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      })),
      users: usersResult.rows,
      templates: templatesResult.rows.map((template) => ({
        id: template.id, name: template.name, description: template.description || "", previewUrl: template.preview_url || null,
      })),
      vcardFeatures: VCARD_FEATURES,
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

function normalizePlanPayload(body) {
  const legacyBenefits = Array.isArray(body.features) ? body.features : String(body.features || "").split(",");
  const structured = normalizePlanFeatures({
    benefits: Array.isArray(body.benefits) ? body.benefits : legacyBenefits,
    vcardFeatures: body.vcardFeatures,
    templateIds: body.templateIds,
  });
  const suppliedPrices = body.prices && typeof body.prices === "object" && !Array.isArray(body.prices) ? body.prices : {};
  const rawPrices = { LKR: suppliedPrices.LKR === undefined ? body.price : suppliedPrices.LKR };
  const prices = {};
  let invalidCurrency = false;
  for (const [rawCurrency, rawAmount] of Object.entries(rawPrices)) {
    const currency = normalizeCurrency(rawCurrency);
    const amount = Number(rawAmount);
    if (currency) prices[currency] = amount;
    else invalidCurrency = true;
  }
  const firstPrice = Object.values(prices)[0];
  return {
    name: String(body.name || "").trim(),
    price: prices.LKR === undefined ? firstPrice : prices.LKR,
    prices,
    invalidCurrency,
    billingInterval: String(body.billingInterval || "monthly").toLowerCase(),
    vcardLimit: Number(body.vcardLimit),
    nfcLimit: Number(body.nfcLimit),
    analyticsLimit: Number(body.analyticsLimit),
    storageLimitMb: Number(body.storageLimitMb),
    features: {
      benefits: structured.benefits.map((feature) => String(feature).trim()).filter(Boolean).slice(0, 100),
      vcardFeatures: structured.vcardFeatures,
      templateIds: structured.templateIds,
    },
    status: String(body.status || "active").toLowerCase(),
  };
}

function planValidationMessage(plan) {
  if (!plan.name || plan.name.length > 150) return "Enter a plan name up to 150 characters";
  if (!Object.keys(plan.prices).length || plan.prices.LKR === undefined) return "Enter the plan price in LKR";
  if (plan.invalidCurrency) return "One or more plan currencies are not valid ISO 4217 codes";
  if (Object.entries(plan.prices).some(([currency, amount]) => !normalizeCurrency(currency) || !Number.isFinite(amount) || amount < 0 || amount > 9999999999.99)) return "Every currency needs a valid non-negative price";
  if (!Number.isFinite(plan.price) || plan.price < 0 || plan.price > 9999999999.99) return "Enter a valid plan price up to 9,999,999,999.99";
  if (!billingIntervals.includes(plan.billingInterval)) return "Invalid billing interval";
  if (!planStatuses.includes(plan.status)) return "Invalid plan status";
  if (![plan.vcardLimit, plan.nfcLimit, plan.analyticsLimit, plan.storageLimitMb].every((limit) => Number.isInteger(limit) && limit >= 0 && limit <= 2147483647)) return "Plan limits must be whole numbers from 0 to 2,147,483,647";
  if (!plan.features.vcardFeatures.length) return "Select at least one VCard feature";
  if (!plan.features.templateIds.length) return "Select at least one VCard template";
  return null;
}

async function planTemplateValidationMessage(plan) {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM vcard_templates WHERE is_public=TRUE AND id=ANY($1::int[])`, [plan.features.templateIds]);
  return result.rows[0].count === plan.features.templateIds.length ? null : "One or more selected VCard templates are unavailable";
}

async function replacePlanPrices(client, planId, prices) {
  await client.query("DELETE FROM plan_prices WHERE plan_id=$1", [planId]);
  for (const [currency, amount] of Object.entries(prices)) {
    await client.query("INSERT INTO plan_prices(plan_id,currency,amount) VALUES($1,$2,$3)", [planId, currency, amount]);
  }
}

exports.createPlan = async (req, res, next) => {
  let client;
  try {
    const plan = normalizePlanPayload(req.body);
    const validation = planValidationMessage(plan);
    if (validation) return res.status(400).json({ message: validation });
    const templateValidation = await planTemplateValidationMessage(plan);
    if (templateValidation) return res.status(400).json({ message: templateValidation });
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO plans (name, price, billing_interval, vcard_limit, nfc_limit, analytics_limit, storage_limit_mb, features, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING id, name, price, status`,
      [plan.name, plan.price, plan.billingInterval, plan.vcardLimit, plan.nfcLimit, plan.analyticsLimit, plan.storageLimitMb, JSON.stringify(plan.features), plan.status]
    );
    await replacePlanPrices(client, result.rows[0].id, plan.prices);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'plan.created', 'plan', $2, $3::jsonb, $4, $5)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ name: plan.name, prices: plan.prices, storageLimitMb: plan.storageLimitMb }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.status(201).json({ plan: { ...result.rows[0], prices: plan.prices } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "A plan with this name already exists" });
    next(error);
  } finally { if (client) client.release(); }
};

exports.updatePlan = async (req, res, next) => {
  const planId = positiveIntegerParam(req);
  if (!planId) return res.status(400).json({ message: "Invalid plan ID" });
  let client;
  try {
    const plan = normalizePlanPayload(req.body);
    const validation = planValidationMessage(plan);
    if (validation) return res.status(400).json({ message: validation });
    const templateValidation = await planTemplateValidationMessage(plan);
    if (templateValidation) return res.status(400).json({ message: templateValidation });
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE plans SET name = $1, price = $2, billing_interval = $3, vcard_limit = $4,
       nfc_limit = $5, analytics_limit = $6, storage_limit_mb = $7, features = $8::jsonb, status = $9, updated_at = NOW()
       WHERE id = $10 RETURNING id, name, price, status`,
      [plan.name, plan.price, plan.billingInterval, plan.vcardLimit, plan.nfcLimit, plan.analyticsLimit, plan.storageLimitMb, JSON.stringify(plan.features), plan.status, planId]
    );
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Plan not found" }); }
    await replacePlanPrices(client, planId, plan.prices);
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'plan.updated', 'plan', $2, $3::jsonb, $4, $5)`,
      [req.user.id, planId, JSON.stringify({ name: plan.name, prices: plan.prices, status: plan.status, storageLimitMb: plan.storageLimitMb }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ plan: { ...result.rows[0], prices: plan.prices } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "A plan with this name already exists" });
    next(error);
  } finally { if (client) client.release(); }
};

exports.deletePlan = async (req, res, next) => {
  const planId = positiveIntegerParam(req);
  if (!planId) return res.status(400).json({ message: "Invalid plan ID" });
  try {
    const subscribers = await pool.query("SELECT COUNT(*)::int AS count FROM subscriptions WHERE plan_id = $1", [planId]);
    if (subscribers.rows[0].count) return res.status(409).json({ message: "Move or remove this plan's subscriptions before deleting it" });
    const result = await pool.query("DELETE FROM plans WHERE id = $1 RETURNING id, name", [planId]);
    if (!result.rowCount) return res.status(404).json({ message: "Plan not found" });
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'plan.deleted', 'plan', $2, $3::jsonb)`,
      [req.user.id, planId, JSON.stringify({ name: result.rows[0].name })]
    );
    res.json({ message: "Plan deleted successfully" });
  } catch (error) {
    next(error);
  }
};

function normalizeSubscriptionPayload(body) {
  return {
    userId: Number(body.userId),
    planId: Number(body.planId),
    status: String(body.status || "active").toLowerCase(),
    startDate: String(body.startDate || ""),
    endDate: body.endDate ? String(body.endDate) : null,
    autoRenew: body.autoRenew !== false,
    cancelReason: String(body.cancelReason || "").trim() || null,
  };
}

function subscriptionValidationMessage(subscription) {
  if (!Number.isInteger(subscription.userId) || subscription.userId < 1 || !Number.isInteger(subscription.planId) || subscription.planId < 1) return "Select a user and plan";
  if (!subscriptionStatuses.includes(subscription.status)) return "Invalid subscription status";
  if (!validIsoDate(subscription.startDate) || (subscription.endDate && !validIsoDate(subscription.endDate))) return "Enter valid subscription dates";
  if (subscription.endDate && subscription.endDate < subscription.startDate) return "End date cannot be before start date";
  if (subscription.cancelReason && subscription.cancelReason.length > 2000) return "Cancellation note must not exceed 2,000 characters";
  return null;
}

async function validateSubscriptionRelations(client, subscription) {
  const result = await client.query(
    `SELECT EXISTS(SELECT 1 FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND COALESCE(r.name, 'user') <> 'super_admin') AS user_exists,
            EXISTS(SELECT 1 FROM plans WHERE id = $2) AS plan_exists`,
    [subscription.userId, subscription.planId]
  );
  if (!result.rows[0].user_exists) return "Selected user was not found";
  if (!result.rows[0].plan_exists) return "Selected plan was not found";
  return null;
}

exports.createSubscription = async (req, res, next) => {
  const subscription = normalizeSubscriptionPayload(req.body);
  const validation = subscriptionValidationMessage(subscription);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const relationError = await validateSubscriptionRelations(client, subscription);
    if (relationError) { await client.query("ROLLBACK"); return res.status(400).json({ message: relationError }); }
    const result = await client.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date, auto_renew, cancel_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, status`,
      [subscription.userId, subscription.planId, subscription.status, subscription.startDate, subscription.endDate, subscription.autoRenew, subscription.cancelReason]
    );
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'subscription.created', 'subscription', $2, $3::jsonb)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ userId: subscription.userId, planId: subscription.planId, status: subscription.status })]
    );
    await client.query("COMMIT");
    res.status(201).json({ subscription: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.updateSubscription = async (req, res, next) => {
  const subscriptionId = positiveIntegerParam(req);
  if (!subscriptionId) return res.status(400).json({ message: "Invalid subscription ID" });
  const subscription = normalizeSubscriptionPayload(req.body);
  const validation = subscriptionValidationMessage(subscription);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const relationError = await validateSubscriptionRelations(client, subscription);
    if (relationError) { await client.query("ROLLBACK"); return res.status(400).json({ message: relationError }); }
    const result = await client.query(
      `UPDATE subscriptions SET user_id = $1, plan_id = $2, status = $3, start_date = $4,
       end_date = $5, auto_renew = $6, cancel_reason = $7, updated_at = NOW()
       WHERE id = $8 RETURNING id, status`,
      [subscription.userId, subscription.planId, subscription.status, subscription.startDate, subscription.endDate, subscription.autoRenew, subscription.cancelReason, subscriptionId]
    );
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Subscription not found" }); }
    if (subscription.status === "active") {
      await client.query(`UPDATE subscriptions SET status='cancelled',cancel_reason='Replaced by approved subscription',updated_at=NOW() WHERE user_id=$1 AND status='active' AND id<>$2`, [subscription.userId, subscriptionId]);
    }
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'subscription.updated', 'subscription', $2, $3::jsonb)`,
      [req.user.id, subscriptionId, JSON.stringify({ planId: subscription.planId, status: subscription.status })]
    );
    await client.query("COMMIT");
    res.json({ subscription: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};

exports.deleteSubscription = async (req, res, next) => {
  const subscriptionId = positiveIntegerParam(req);
  if (!subscriptionId) return res.status(400).json({ message: "Invalid subscription ID" });
  try {
    const result = await pool.query("DELETE FROM subscriptions WHERE id = $1 RETURNING id, user_id, plan_id", [subscriptionId]);
    if (!result.rowCount) return res.status(404).json({ message: "Subscription not found" });
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'subscription.deleted', 'subscription', $2, $3::jsonb)`,
      [req.user.id, subscriptionId, JSON.stringify({ userId: result.rows[0].user_id, planId: result.rows[0].plan_id })]
    );
    res.json({ message: "Subscription deleted successfully" });
  } catch (error) { next(error); }
};

