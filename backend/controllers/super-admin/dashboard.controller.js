const { number, percentChange } = require('../../helpers/metrics.helper');
const pool = require('../../config/database.config');
const { currentSubscription } = require('../../services/subscription-policy');
const { reportingSummary } = require('../../services/revenue.service');
exports.getDashboard = async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const [summaryResult, comparisonResult, recentUsersResult, revenueSeriesResult, plansResult, revenueState] =
      await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id
             WHERE COALESCE(r.name, 'user') <> 'super_admin') AS total_users,
            (SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id
             WHERE COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active') AS active_users,
            (SELECT COUNT(*) FROM subscriptions s WHERE ${currentSubscription()}) AS active_subscriptions,
            (SELECT COUNT(*) FROM vcards WHERE is_active = TRUE) AS published_cards,
            (SELECT COALESCE(SUM(amount_lkr), 0) FROM revenue_lkr_entries
             WHERE status IN ('completed', 'paid', 'approved')
               AND received_at >= DATE_TRUNC('month', CURRENT_DATE)) AS monthly_revenue,
            (SELECT COUNT(*) FROM nfc_orders WHERE status = 'pending') AS pending_nfc_orders,
            (SELECT COUNT(*) FROM payments WHERE status = 'pending') AS pending_payments
        `),
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id
             WHERE COALESCE(r.name, 'user') <> 'super_admin'
               AND u.created_at >= NOW() - INTERVAL '30 days') AS users_current,
            (SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id
             WHERE COALESCE(r.name, 'user') <> 'super_admin'
               AND u.created_at >= NOW() - INTERVAL '60 days'
               AND u.created_at < NOW() - INTERVAL '30 days') AS users_previous,
            (SELECT COALESCE(SUM(amount_lkr), 0) FROM revenue_lkr_entries
             WHERE status IN ('completed', 'paid', 'approved')
               AND received_at >= NOW() - INTERVAL '30 days') AS revenue_current,
            (SELECT COALESCE(SUM(amount_lkr), 0) FROM revenue_lkr_entries
             WHERE status IN ('completed', 'paid', 'approved')
               AND received_at >= NOW() - INTERVAL '60 days'
               AND received_at < NOW() - INTERVAL '30 days') AS revenue_previous,
            (SELECT COUNT(*) FROM subscriptions WHERE created_at >= NOW() - INTERVAL '30 days') AS subscriptions_current,
            (SELECT COUNT(*) FROM subscriptions
             WHERE created_at >= NOW() - INTERVAL '60 days'
               AND created_at < NOW() - INTERVAL '30 days') AS subscriptions_previous,
            (SELECT COUNT(*) FROM vcards WHERE created_at >= NOW() - INTERVAL '30 days') AS cards_current,
            (SELECT COUNT(*) FROM vcards
             WHERE created_at >= NOW() - INTERVAL '60 days'
               AND created_at < NOW() - INTERVAL '30 days') AS cards_previous
        `),
        pool.query(`
          SELECT u.id, u.name, u.email, u.status, u.created_at,
                 COALESCE(p.name, 'Free') AS plan_name,
                 (SELECT COUNT(*) FROM vcards v WHERE v.user_id = u.id) AS card_count
          FROM users u
          LEFT JOIN roles r ON r.id = u.role_id
          LEFT JOIN LATERAL (
            SELECT s.plan_id
            FROM subscriptions s
            WHERE s.user_id = u.id AND ${currentSubscription()}
            ORDER BY s.created_at DESC
            LIMIT 1
          ) active_subscription ON TRUE
          LEFT JOIN plans p ON p.id = active_subscription.plan_id
          WHERE COALESCE(r.name, 'user') <> 'super_admin'
          ORDER BY u.created_at DESC
          LIMIT 5
        `),
        pool.query(`
          SELECT days.day::date AS date, COALESCE(SUM(p.amount_lkr), 0) AS amount
          FROM GENERATE_SERIES(
            CURRENT_DATE - INTERVAL '29 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          ) days(day)
          LEFT JOIN revenue_lkr_entries p
            ON p.received_at::date = days.day::date
           AND p.status IN ('completed', 'paid', 'approved')
          GROUP BY days.day
          ORDER BY days.day
        `),
        pool.query(`
          SELECT COALESCE(p.name, 'Free') AS name, COUNT(*) AS count
          FROM subscriptions s
          LEFT JOIN plans p ON p.id = s.plan_id
          WHERE ${currentSubscription()}
          GROUP BY COALESCE(p.name, 'Free')
          ORDER BY count DESC
        `),
        reportingSummary(pool),
      ]);

    const summary = summaryResult.rows[0];
    const comparison = comparisonResult.rows[0];
    const totalSubscriptions = plansResult.rows.reduce((sum, plan) => sum + number(plan.count), 0);

    res.json({
      generatedAt: new Date().toISOString(),
      revenueCurrency: 'LKR',
      revenueConversion: { missing: revenueState.missing, estimated: revenueState.estimated },
      metrics: {
        monthlyRevenue: revenueState.missing ? null : number(summary.monthly_revenue),
        totalUsers: number(summary.total_users),
        activeUsers: number(summary.active_users),
        activeSubscriptions: number(summary.active_subscriptions),
        publishedCards: number(summary.published_cards),
        pendingNfcOrders: number(summary.pending_nfc_orders),
        pendingPayments: number(summary.pending_payments),
        growth: {
          revenue: percentChange(comparison.revenue_current, comparison.revenue_previous),
          users: percentChange(comparison.users_current, comparison.users_previous),
          subscriptions: percentChange(comparison.subscriptions_current, comparison.subscriptions_previous),
          cards: percentChange(comparison.cards_current, comparison.cards_previous),
        },
      },
      recentUsers: recentUsersResult.rows.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        plan: user.plan_name,
        cards: number(user.card_count),
        joinedAt: user.created_at,
      })),
      revenueSeries: revenueSeriesResult.rows.map((point) => ({
        date: point.date,
        amount: revenueState.missing ? null : number(point.amount),
      })),
      planDistribution: plansResult.rows.map((plan) => ({
        name: plan.name,
        count: number(plan.count),
        percentage: totalSubscriptions
          ? Number(((number(plan.count) / totalSubscriptions) * 100).toFixed(1))
          : 0,
      })),
      system: {
        status: "operational",
        apiUptimeSeconds: Math.floor(process.uptime()),
        databaseLatencyMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

