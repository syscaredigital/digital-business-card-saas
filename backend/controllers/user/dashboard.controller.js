const { currentSubscription } = require('../../services/subscription-policy');
const pool = require("../../config/database.config");
const { publicVcardUrl } = require("../../helpers/vcard-url");
const { loadVcardEntitlements } = require('../../services/vcard-entitlements.service');
function number(value) { return Number(value || 0); }

exports.dashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [profile, subscription, cards, orders, nfc, enquiries, analytics, notifications, affiliate, userSettings] = await Promise.all([
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
         WHERE s.user_id = $1 AND ${currentSubscription()}
         ORDER BY s.created_at DESC LIMIT 1`, [userId]
      ),
      pool.query(
        `SELECT v.id,v.slug,v.title,v.description,v.email,v.phone,v.is_active,v.updated_at,v.template_id,
                t.name AS template_name,t.preview_url AS template_preview_url,t.template_json
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
         FROM contacts ct
         LEFT JOIN business_cards bc ON bc.id = ct.business_card_id
         LEFT JOIN vcards v ON v.id = ct.vcard_id
         WHERE COALESCE(bc.user_id, v.user_id) = $1`, [userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(a.page_views), 0)::int AS views,
                COALESCE(SUM(a.clicks), 0)::int AS clicks,
                COALESCE(SUM(a.contact_requests), 0)::int AS leads
         FROM analytics a JOIN business_cards bc ON bc.id = a.business_card_id
         WHERE bc.user_id = $1 AND a.event_date >= CURRENT_DATE - INTERVAL '30 days'`, [userId]
      ),
      pool.query(
        `SELECT id, title, message, type, is_read, created_at,
                COUNT(id) FILTER (WHERE is_read=FALSE) OVER ()::int AS unread_total
         FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8`, [userId]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM affiliate_referrals ar WHERE ar.affiliate_id = ap.id) AS referrals,
           (SELECT COALESCE(SUM(ac.amount), 0) FROM affiliate_commissions ac
            WHERE ac.affiliate_id = ap.id AND ac.status IN ('pending','approved')) AS commission
         FROM affiliate_profiles ap WHERE ap.user_id = $1`, [userId]
      ),
      pool.query("SELECT browser_notifications FROM user_settings WHERE user_id=$1",[userId]),
    ]);

    const plan = subscription.rows[0] || { plan_name: "Free", status: "inactive", vcard_limit: 1, nfc_limit: 0 };
    const cardRows = cards.rows.map((card) => ({ ...card, publicUrl: publicVcardUrl(req, card.slug), public_url: publicVcardUrl(req, card.slug) }));
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
        qrScans: number((await pool.query(
          `SELECT COUNT(*)::int AS total FROM vcard_events e
           JOIN vcards v ON v.id=e.vcard_id
           WHERE v.user_id=$1 AND e.event_type='qr_scan'`,
          [userId]
        )).rows[0]?.total),
        pendingOrders: orders.rows.filter((order) => order.status === "pending").length,
        nfcCards: nfc.rows.length,
        referrals: number(affiliateRow.referrals),
        commission: number(affiliateRow.commission),
      },
      vcards: cardRows,
      vcardEntitlements: entitlements,
      orders: orders.rows,
      nfcCards: nfc.rows,
      notifications: userSettings.rows[0]?.browser_notifications === false ? [] : notifications.rows,
      notificationUnreadCount: userSettings.rows[0]?.browser_notifications === false
        ? 0
        : number(notifications.rows[0]?.unread_total),
      notificationsEnabled: userSettings.rows[0]?.browser_notifications !== false,
    });
  } catch (error) {
    next(error);
  }
};

