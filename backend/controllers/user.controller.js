const pool = require("../config/database.config");
const { VCARD_FEATURES, normalizePlanFeatures } = require("../config/vcard-features");

function number(value) {
  return Number(value || 0);
}

async function loadVcardEntitlements(db, userId) {
  const [planResult, templateResult] = await Promise.all([
    db.query(`SELECT p.id,p.name,p.vcard_limit,p.features
      FROM subscriptions s JOIN plans p ON p.id=s.plan_id
      WHERE s.user_id=$1 AND s.status='active'
      ORDER BY s.created_at DESC LIMIT 1`, [userId]),
    db.query(`SELECT id,name,description,preview_url,template_json FROM vcard_templates WHERE is_public=TRUE ORDER BY name,id`),
  ]);
  const plan = planResult.rows[0] || { id: null, name: "Free", vcard_limit: 1, features: [] };
  const normalized = normalizePlanFeatures(plan.features);
  const allowedTemplateIds = new Set(normalized.templateIds);
  const templates = templateResult.rows
    .filter((template) => !allowedTemplateIds.size || allowedTemplateIds.has(Number(template.id)))
    .map((template) => ({ id: template.id, name: template.name, description: template.description || "", previewUrl: template.preview_url || null, templateJson: template.template_json || {} }));
  return {
    planId: plan.id,
    planName: plan.name || "Free",
    vcardLimit: number(plan.vcard_limit) || 1,
    features: VCARD_FEATURES.filter((feature) => normalized.vcardFeatures.includes(feature.key)),
    templates,
  };
}

function normalizeSections(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const sections = {};
  for (const [key, content] of Object.entries(value)) {
    if (!allowedKeys.has(key)) continue;
    const text = typeof content === "string" ? content.trim() : JSON.stringify(content);
    if (text && text.length <= 20000) sections[key] = text;
  }
  return sections;
}

exports.dashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [profile, subscription, cards, orders, nfc, enquiries, analytics, notifications, affiliate] = await Promise.all([
      pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.created_at,
                c.name AS company_name
         FROM users u LEFT JOIN companies c ON c.id = u.company_id
         WHERE u.id = $1`, [userId]
      ),
      pool.query(
        `SELECT s.status, s.start_date, s.end_date, s.auto_renew,
                p.name AS plan_name, p.vcard_limit, p.nfc_limit, p.analytics_limit, p.features
         FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
         WHERE s.user_id = $1
         ORDER BY (s.status = 'active') DESC, s.created_at DESC LIMIT 1`, [userId]
      ),
      pool.query(
        `SELECT v.id,v.title,v.email,v.phone,v.is_active,v.updated_at,v.template_id,t.name AS template_name
         FROM vcards v LEFT JOIN vcard_templates t ON t.id=v.template_id WHERE v.user_id = $1 ORDER BY v.updated_at DESC`, [userId]
      ),
      pool.query(
        `SELECT id, quantity, amount, status, tracking_number, ordered_at
         FROM nfc_orders WHERE user_id = $1 ORDER BY ordered_at DESC LIMIT 5`, [userId]
      ),
      pool.query(
        `SELECT id, tag_identifier, serial_number, status, assigned_at
         FROM nfc_cards WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`, [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM contacts ct JOIN business_cards bc ON bc.id = ct.business_card_id
         WHERE bc.user_id = $1`, [userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(a.page_views), 0)::int AS views,
                COALESCE(SUM(a.clicks), 0)::int AS clicks,
                COALESCE(SUM(a.contact_requests), 0)::int AS leads
         FROM analytics a JOIN business_cards bc ON bc.id = a.business_card_id
         WHERE bc.user_id = $1 AND a.event_date >= CURRENT_DATE - INTERVAL '30 days'`, [userId]
      ),
      pool.query(
        `SELECT id, title, message, type, is_read, created_at
         FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8`, [userId]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM affiliate_referrals ar WHERE ar.affiliate_id = ap.id) AS referrals,
           (SELECT COALESCE(SUM(ac.amount), 0) FROM affiliate_commissions ac
            WHERE ac.affiliate_id = ap.id AND ac.status IN ('pending','approved')) AS commission
         FROM affiliate_profiles ap WHERE ap.user_id = $1`, [userId]
      ),
    ]);

    const plan = subscription.rows[0] || { plan_name: "Free", status: "inactive", vcard_limit: 1, nfc_limit: 0 };
    const cardRows = cards.rows;
    const entitlements = await loadVcardEntitlements(pool, userId);
    const analyticsRow = analytics.rows[0] || {};
    const affiliateRow = affiliate.rows[0] || {};
    res.json({
      user: profile.rows[0],
      subscription: {
        name: plan.plan_name || "Free",
        status: plan.status,
        startDate: plan.start_date,
        endDate: plan.end_date,
        autoRenew: plan.auto_renew,
        vcardLimit: number(plan.vcard_limit) || 1,
        nfcLimit: number(plan.nfc_limit),
      },
      metrics: {
        activeCards: cardRows.filter((card) => card.is_active).length,
        totalCards: cardRows.length,
        enquiries: number(enquiries.rows[0]?.total),
        profileViews: number(analyticsRow.views),
        clicks: number(analyticsRow.clicks),
        leads: number(analyticsRow.leads),
        pendingOrders: orders.rows.filter((order) => order.status === "pending").length,
        nfcCards: nfc.rows.length,
        referrals: number(affiliateRow.referrals),
        commission: number(affiliateRow.commission),
      },
      vcards: cardRows,
      vcardEntitlements: entitlements,
      orders: orders.rows,
      nfcCards: nfc.rows,
      notifications: notifications.rows,
    });
  } catch (error) {
    next(error);
  }
};

exports.enquiries = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ct.id, bc.title AS vcard_name, ct.name, ct.email, ct.phone,
              ct.company, ct.message, ct.source, ct.contacted_at
       FROM contacts ct JOIN business_cards bc ON bc.id = ct.business_card_id
       WHERE bc.user_id = $1 ORDER BY ct.contacted_at DESC`, [req.user.id]
    );
    res.json({ enquiries: result.rows });
  } catch (error) { next(error); }
};

exports.appointments = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.vcard_id, v.title AS vcard_name, a.name, a.email, a.phone,
              a.starts_at, a.ends_at, a.status, a.appointment_type, a.notes
       FROM appointments a LEFT JOIN vcards v ON v.id = a.vcard_id
       WHERE a.user_id = $1 ORDER BY a.starts_at DESC`, [req.user.id]
    );
    res.json({ appointments: result.rows });
  } catch (error) { next(error); }
};

exports.orders = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, quantity, amount, status, shipping_address, tracking_number, ordered_at
       FROM nfc_orders WHERE user_id = $1 ORDER BY ordered_at DESC`, [req.user.id]
    );
    res.json({ orders: result.rows });
  } catch (error) { next(error); }
};

function mapUserPlan(plan) {
  const normalized = normalizePlanFeatures(plan.features);
  return { id: plan.id, name: plan.name, price: number(plan.price), billingInterval: plan.billing_interval,
    vcardLimit: number(plan.vcard_limit), nfcLimit: number(plan.nfc_limit), analyticsLimit: number(plan.analytics_limit),
    features: normalized.benefits, vcardFeatures: normalized.vcardFeatures, templateIds: normalized.templateIds };
}

exports.plans = async (req, res, next) => {
  try {
    const [plansResult, subscriptionsResult] = await Promise.all([
      pool.query(`SELECT id,name,price,billing_interval,vcard_limit,nfc_limit,analytics_limit,features FROM plans WHERE status='active' ORDER BY price,name`),
      pool.query(`SELECT s.id,s.plan_id,s.status,s.created_at,p.name AS plan_name FROM subscriptions s LEFT JOIN plans p ON p.id=s.plan_id WHERE s.user_id=$1 AND s.status IN ('active','pending','trial') ORDER BY (s.status='active') DESC,s.created_at DESC`, [req.user.id]),
    ]);
    const active = subscriptionsResult.rows.find((item) => item.status === "active") || null;
    const pending = subscriptionsResult.rows.find((item) => item.status === "pending") || null;
    res.json({ plans: plansResult.rows.map(mapUserPlan), currentPlanId: active ? active.plan_id : null,
      pending: pending ? { id: pending.id, planId: pending.plan_id, planName: pending.plan_name } : null });
  } catch (error) { next(error); }
};

exports.requestPlanUpgrade = async (req, res, next) => {
  const planId = Number(req.body.planId);
  if (!Number.isInteger(planId) || planId < 1) return res.status(400).json({ message: "Select a valid plan" });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const planResult = await client.query("SELECT id,name,price FROM plans WHERE id=$1 AND status='active'", [planId]);
    if (!planResult.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "This plan is no longer available" }); }
    const activeResult = await client.query(`SELECT s.id,s.plan_id,p.price FROM subscriptions s LEFT JOIN plans p ON p.id=s.plan_id WHERE s.user_id=$1 AND s.status='active' ORDER BY s.created_at DESC LIMIT 1`, [req.user.id]);
    if (activeResult.rows[0] && activeResult.rows[0].plan_id === planId) { await client.query("ROLLBACK"); return res.status(409).json({ message: "This is already your current plan" }); }
    if (activeResult.rows[0] && Number(planResult.rows[0].price) <= Number(activeResult.rows[0].price || 0)) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Choose a plan priced above your current plan" }); }
    await client.query(`UPDATE subscriptions SET status='cancelled',cancel_reason='Superseded by a newer upgrade request',updated_at=NOW() WHERE user_id=$1 AND status='pending'`, [req.user.id]);
    const result = await client.query(`INSERT INTO subscriptions (user_id,plan_id,status,start_date,auto_renew,cancel_reason) VALUES($1,$2,'pending',CURRENT_DATE,TRUE,'Awaiting payment verification / admin approval') RETURNING id,plan_id,status`, [req.user.id, planId]);
    await client.query(`INSERT INTO notifications (user_id,title,message,type) VALUES($1,'Upgrade request received',$2,'billing')`, [req.user.id, `Your request for the ${planResult.rows[0].name} plan is awaiting approval.`]);
    await client.query(`INSERT INTO activity_logs (user_id,action,resource_type,resource_id,metadata) VALUES($1,'subscription.upgrade_requested','subscription',$2,$3::jsonb)`, [req.user.id, result.rows[0].id, JSON.stringify({ planId, planName: planResult.rows[0].name })]);
    await client.query("COMMIT");
    res.status(201).json({ subscription: result.rows[0], message: "Upgrade request submitted for approval" });
  } catch (error) { if (client) await client.query("ROLLBACK").catch(() => {}); next(error); }
  finally { if (client) client.release(); }
};

exports.markNotificationsRead = async (req, res, next) => {
  try {
    await pool.query("UPDATE notifications SET is_read = TRUE, updated_at = NOW() WHERE user_id = $1", [req.user.id]);
    res.json({ message: "Notifications marked as read" });
  } catch (error) { next(error); }
};

exports.getVcard = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,template_id,title,description,website_url,phone,email,address,social_links,settings,is_active
       FROM vcards WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Card not found" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    res.json({ vcard: result.rows[0], entitlements });
  } catch (error) { next(error); }
};

exports.createVcard = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "Card name is required" });
    const allowance = await pool.query(
      `SELECT COALESCE(p.vcard_limit, 1)::int AS card_limit,
              (SELECT COUNT(*)::int FROM vcards v WHERE v.user_id = $1) AS card_count
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE u.id = $1 ORDER BY s.created_at DESC NULLS LAST LIMIT 1`, [req.user.id]
    );
    const limit = allowance.rows[0]?.card_limit || 1;
    if ((allowance.rows[0]?.card_count || 0) >= limit) return res.status(403).json({ message: "Your plan's card limit has been reached" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    const templateId = Number(req.body.templateId || entitlements.templates[0]?.id);
    if (!entitlements.templates.some((template) => Number(template.id) === templateId)) return res.status(403).json({ message: "This VCard template is not included in your plan" });
    const allowedKeys = new Set(entitlements.features.map((feature) => feature.key));
    const sections = normalizeSections(req.body.sections, allowedKeys);
    const result = await pool.query(
      `INSERT INTO vcards (user_id,template_id,title,description,website_url,phone,email,address,settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING id,template_id,title,description,website_url,phone,email,address,settings,is_active,created_at`,
      [req.user.id, templateId, title, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null, JSON.stringify({ sections })]
    );
    res.status(201).json({ vcard: result.rows[0] });
  } catch (error) { next(error); }
};

exports.updateVcard = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "Card name is required" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    const templateId = Number(req.body.templateId);
    if (!entitlements.templates.some((template) => Number(template.id) === templateId)) return res.status(403).json({ message: "This VCard template is not included in your plan" });
    const allowedKeys = new Set(entitlements.features.map((feature) => feature.key));
    const sections = normalizeSections(req.body.sections, allowedKeys);
    const result = await pool.query(
      `UPDATE vcards SET template_id=$1,title=$2,description=$3,website_url=$4,phone=$5,
              email=$6,address=$7,settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{sections}',$8::jsonb,TRUE),
              is_active=COALESCE($9,is_active),updated_at=NOW()
       WHERE id=$10 AND user_id=$11
       RETURNING id,template_id,title,description,website_url,phone,email,address,settings,is_active,updated_at`,
      [templateId, title, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null, JSON.stringify(sections), typeof req.body.isActive === "boolean" ? req.body.isActive : null, req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Card not found" });
    res.json({ vcard: result.rows[0] });
  } catch (error) { next(error); }
};

exports.deleteVcard = async (req, res, next) => {
  const vcardId = Number(req.params.id);
  if (!Number.isInteger(vcardId) || vcardId < 1) return res.status(400).json({ message: "Invalid VCard ID" });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `DELETE FROM vcards WHERE id=$1 AND user_id=$2 RETURNING id,title,template_id`,
      [vcardId, req.user.id]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "VCard not found or you do not have permission to delete it" });
    }
    await client.query(
      `INSERT INTO activity_logs (user_id,action,resource_type,resource_id,metadata)
       VALUES ($1,'vcard.deleted','vcard',$2,$3::jsonb)`,
      [req.user.id, vcardId, JSON.stringify({ title: result.rows[0].title, templateId: result.rows[0].template_id })]
    );
    await client.query("COMMIT");
    res.json({ message: "VCard deleted successfully", vcard: { id: result.rows[0].id, title: result.rows[0].title } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};
