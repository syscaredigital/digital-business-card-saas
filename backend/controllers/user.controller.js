const pool = require("../config/database.config");

function number(value) {
  return Number(value || 0);
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
                p.name AS plan_name, p.vcard_limit, p.nfc_limit, p.analytics_limit
         FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
         WHERE s.user_id = $1
         ORDER BY (s.status = 'active') DESC, s.created_at DESC LIMIT 1`, [userId]
      ),
      pool.query(
        `SELECT id, title, email, phone, is_active, updated_at
         FROM vcards WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]
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
        enquiries: number(enquiries.rows[0]?.total),
        profileViews: number(analyticsRow.views),
        clicks: number(analyticsRow.clicks),
        leads: number(analyticsRow.leads),
        pendingOrders: orders.rows.filter((order) => order.status === "pending").length,
        nfcCards: nfc.rows.length,
        referrals: number(affiliateRow.referrals),
        commission: number(affiliateRow.commission),
      },
      vcards: cardRows.slice(0, 4),
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

exports.markNotificationsRead = async (req, res, next) => {
  try {
    await pool.query("UPDATE notifications SET is_read = TRUE, updated_at = NOW() WHERE user_id = $1", [req.user.id]);
    res.json({ message: "Notifications marked as read" });
  } catch (error) { next(error); }
};

exports.getVcard = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, website_url, phone, email, address, is_active
       FROM vcards WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Card not found" });
    res.json({ vcard: result.rows[0] });
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
    const result = await pool.query(
      `INSERT INTO vcards (user_id, title, description, website_url, phone, email, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, title, description, website_url, phone, email, address, is_active, created_at`,
      [req.user.id, title, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null]
    );
    res.status(201).json({ vcard: result.rows[0] });
  } catch (error) { next(error); }
};

exports.updateVcard = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "Card name is required" });
    const result = await pool.query(
      `UPDATE vcards SET title=$1, description=$2, website_url=$3, phone=$4,
              email=$5, address=$6, is_active=COALESCE($7,is_active), updated_at=NOW()
       WHERE id=$8 AND user_id=$9
       RETURNING id, title, description, website_url, phone, email, address, is_active, updated_at`,
      [title, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null, typeof req.body.isActive === "boolean" ? req.body.isActive : null, req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Card not found" });
    res.json({ vcard: result.rows[0] });
  } catch (error) { next(error); }
};
