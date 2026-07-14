const pool = require("../config/database.config");
const bcrypt = require("bcrypt");

function number(value) {
  return Number(value || 0);
}

function percentChange(current, previous) {
  const currentValue = number(current);
  const previousValue = number(previous);
  if (!previousValue) return currentValue ? 100 : 0;
  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
}

exports.getDashboard = async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const [summaryResult, comparisonResult, recentUsersResult, revenueSeriesResult, plansResult] =
      await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id
             WHERE COALESCE(r.name, 'user') <> 'super_admin') AS total_users,
            (SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id
             WHERE COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active') AS active_users,
            (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') AS active_subscriptions,
            (SELECT COUNT(*) FROM vcards WHERE is_active = TRUE) AS published_cards,
            (SELECT COALESCE(SUM(amount), 0) FROM payments
             WHERE status IN ('completed', 'paid', 'approved')
               AND COALESCE(paid_at, created_at) >= DATE_TRUNC('month', CURRENT_DATE)) AS monthly_revenue,
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
            (SELECT COALESCE(SUM(amount), 0) FROM payments
             WHERE status IN ('completed', 'paid', 'approved')
               AND COALESCE(paid_at, created_at) >= NOW() - INTERVAL '30 days') AS revenue_current,
            (SELECT COALESCE(SUM(amount), 0) FROM payments
             WHERE status IN ('completed', 'paid', 'approved')
               AND COALESCE(paid_at, created_at) >= NOW() - INTERVAL '60 days'
               AND COALESCE(paid_at, created_at) < NOW() - INTERVAL '30 days') AS revenue_previous,
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
            WHERE s.user_id = u.id AND s.status = 'active'
            ORDER BY s.created_at DESC
            LIMIT 1
          ) active_subscription ON TRUE
          LEFT JOIN plans p ON p.id = active_subscription.plan_id
          WHERE COALESCE(r.name, 'user') <> 'super_admin'
          ORDER BY u.created_at DESC
          LIMIT 5
        `),
        pool.query(`
          SELECT days.day::date AS date, COALESCE(SUM(p.amount), 0) AS amount
          FROM GENERATE_SERIES(
            CURRENT_DATE - INTERVAL '29 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          ) days(day)
          LEFT JOIN payments p
            ON COALESCE(p.paid_at, p.created_at)::date = days.day::date
           AND p.status IN ('completed', 'paid', 'approved')
          GROUP BY days.day
          ORDER BY days.day
        `),
        pool.query(`
          SELECT COALESCE(p.name, 'Free') AS name, COUNT(*) AS count
          FROM subscriptions s
          LEFT JOIN plans p ON p.id = s.plan_id
          WHERE s.status = 'active'
          GROUP BY COALESCE(p.name, 'Free')
          ORDER BY count DESC
        `),
      ]);

    const summary = summaryResult.rows[0];
    const comparison = comparisonResult.rows[0];
    const totalSubscriptions = plansResult.rows.reduce((sum, plan) => sum + number(plan.count), 0);

    res.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        monthlyRevenue: number(summary.monthly_revenue),
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
        amount: number(point.amount),
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

function mapAdminUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phone || null,
    status: user.status,
    role: user.role || "user",
    companyName: user.company_name || null,
    plan: user.plan_name || "Free",
    cards: number(user.card_count),
    joinedAt: user.created_at,
    lastLogin: user.last_login || null,
  };
}

function userIdFromRequest(req) {
  const rawId = String(req.params.id || "");
  if (!/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

const manageableStatuses = ["active", "pending", "inactive", "rejected"];

exports.listUsers = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const values = [];
    const conditions = ["COALESCE(r.name, 'user') <> 'super_admin'"];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length} OR COALESCE(c.name, '') ILIKE $${values.length})`);
    }
    if (status) {
      values.push(status);
      conditions.push(`LOWER(u.status) = $${values.length}`);
    }

    const where = conditions.join(" AND ");
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE ${where}`,
      values
    );

    const summaryResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(u.status) = 'active')::int AS active,
        COUNT(*) FILTER (WHERE LOWER(u.status) = 'pending')::int AS pending
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE COALESCE(r.name, 'user') <> 'super_admin'
    `);

    values.push(limit, offset);
    const usersResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, u.last_login,
              r.name AS role, c.name AS company_name,
              COALESCE(p.name, 'Free') AS plan_name,
              (SELECT COUNT(*) FROM vcards v WHERE v.user_id = u.id) AS card_count
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       LEFT JOIN LATERAL (
         SELECT s.plan_id
         FROM subscriptions s
         WHERE s.user_id = u.id AND s.status = 'active'
         ORDER BY s.created_at DESC
         LIMIT 1
       ) active_subscription ON TRUE
       LEFT JOIN plans p ON p.id = active_subscription.plan_id
       WHERE ${where}
       ORDER BY u.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const total = countResult.rows[0].total;
    res.json({
      users: usersResult.rows.map(mapAdminUser),
      summary: summaryResult.rows[0],
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const { firstName, lastName, email, password, phoneNumber, status } = req.body;
    const normalizedFirstName = String(firstName || "").trim();
    const normalizedLastName = String(lastName || "").trim();
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalizedPhone = phoneNumber ? String(phoneNumber).trim() : null;
    const normalizedStatus = String(status || "active").toLowerCase();
    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail || !password) {
      return res.status(400).json({ message: "First name, last name, email, and password are required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must contain at least 8 characters" });
    }
    if (Buffer.byteLength(String(password), "utf8") > 72) {
      return res.status(400).json({ message: "Password must not exceed 72 bytes" });
    }
    if (`${normalizedFirstName} ${normalizedLastName}`.length > 150) {
      return res.status(400).json({ message: "User name must not exceed 150 characters" });
    }
    if (normalizedEmail.length > 255 || (normalizedPhone && normalizedPhone.length > 50)) {
      return res.status(400).json({ message: "Email or phone number is too long" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (!manageableStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid user status" });
    }

    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [normalizedEmail]
    );
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Email already registered" });
    }

    const roleResult = await client.query("SELECT id FROM roles WHERE name = 'user' LIMIT 1");
    if (!roleResult.rowCount) {
      throw new Error("The user role is missing. Run the database seeds first.");
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const userResult = await client.query(
      `INSERT INTO users (role_id, name, email, password, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, status, created_at, last_login`,
      [
        roleResult.rows[0].id,
        `${normalizedFirstName} ${normalizedLastName}`,
        normalizedEmail,
        hashedPassword,
        normalizedPhone,
        normalizedStatus,
      ]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'user.created', 'user', $2, $3::jsonb, $4, $5)`,
      [
        req.user.id,
        user.id,
        JSON.stringify({ email: user.email, createdBy: req.user.email }),
        req.ip || null,
        req.get("user-agent") || null,
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({
      user: mapAdminUser({
        ...user,
        role: "user",
        plan_name: "Free",
        company_name: null,
        card_count: 0,
      }),
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email already registered" });
    }
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.updateUser = async (req, res, next) => {
  const userId = userIdFromRequest(req);
  if (!userId) return res.status(400).json({ message: "Invalid user ID" });

  let client;
  try {
    client = await pool.connect();
    const { firstName, lastName, email, password, phoneNumber, status } = req.body;
    const normalizedFirstName = String(firstName || "").trim();
    const normalizedLastName = String(lastName || "").trim();
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalizedPhone = phoneNumber ? String(phoneNumber).trim() : null;
    const normalizedStatus = String(status || "active").toLowerCase();

    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail) {
      return res.status(400).json({ message: "First name, last name, and email are required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (!manageableStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid user status" });
    }
    if (`${normalizedFirstName} ${normalizedLastName}`.length > 150 || normalizedEmail.length > 255 || (normalizedPhone && normalizedPhone.length > 50)) {
      return res.status(400).json({ message: "User name, email, or phone number is too long" });
    }
    if (password && (String(password).length < 8 || Buffer.byteLength(String(password), "utf8") > 72)) {
      return res.status(400).json({ message: "New password must contain 8 to 72 bytes" });
    }

    await client.query("BEGIN");
    const targetResult = await client.query(
      `SELECT u.id
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND COALESCE(r.name, 'user') <> 'super_admin'
       FOR UPDATE OF u`,
      [userId]
    );
    if (!targetResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    const duplicateResult = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1",
      [normalizedEmail, userId]
    );
    if (duplicateResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Email already registered" });
    }

    const values = [
      `${normalizedFirstName} ${normalizedLastName}`,
      normalizedEmail,
      normalizedPhone,
      normalizedStatus,
    ];
    let passwordUpdate = "";
    if (password) {
      values.push(await bcrypt.hash(String(password), 10));
      passwordUpdate = `, password = $${values.length}`;
    }
    values.push(userId);

    const updatedResult = await client.query(
      `UPDATE users
       SET name = $1, email = $2, phone = $3, status = $4${passwordUpdate}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, name, email, phone, status, created_at, last_login`,
      values
    );
    const user = updatedResult.rows[0];
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'user.updated', 'user', $2, $3::jsonb, $4, $5)`,
      [
        req.user.id,
        userId,
        JSON.stringify({ email: user.email, status: user.status, passwordChanged: Boolean(password) }),
        req.ip || null,
        req.get("user-agent") || null,
      ]
    );
    await client.query("COMMIT");

    res.json({
      user: mapAdminUser({ ...user, role: "user", plan_name: "Free", company_name: null, card_count: 0 }),
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "Email already registered" });
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.updateUserStatus = async (req, res, next) => {
  const userId = userIdFromRequest(req);
  const status = String(req.body.status || "").toLowerCase();
  if (!userId) return res.status(400).json({ message: "Invalid user ID" });
  if (!manageableStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid user status" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE users u
       SET status = $1, updated_at = NOW()
       FROM roles r
       WHERE u.id = $2 AND r.id = u.role_id AND r.name <> 'super_admin'
       RETURNING u.id, u.name, u.email, u.status`,
      [status, userId]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'user.status_changed', 'user', $2, $3::jsonb, $4, $5)`,
      [
        req.user.id,
        userId,
        JSON.stringify({ email: result.rows[0].email, status }),
        req.ip || null,
        req.get("user-agent") || null,
      ]
    );
    await client.query("COMMIT");
    res.json({ user: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.deleteUser = async (req, res, next) => {
  const userId = userIdFromRequest(req);
  if (!userId) return res.status(400).json({ message: "Invalid user ID" });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const deletedResult = await client.query(
      `DELETE FROM users u
       USING roles r
       WHERE u.id = $1 AND r.id = u.role_id AND r.name <> 'super_admin'
       RETURNING u.id, u.name, u.email`,
      [userId]
    );
    if (!deletedResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    const deleted = deletedResult.rows[0];
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'user.deleted', 'user', $2, $3::jsonb, $4, $5)`,
      [
        req.user.id,
        deleted.id,
        JSON.stringify({ email: deleted.email, name: deleted.name }),
        req.ip || null,
        req.get("user-agent") || null,
      ]
    );
    await client.query("COMMIT");
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

function vcardIdFromRequest(req) {
  const rawId = String(req.params.id || "");
  if (!/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function mapAdminVCard(card) {
  return {
    id: card.id,
    title: card.title || "Untitled VCard",
    description: card.description || null,
    owner: {
      id: card.user_id,
      name: card.user_name || "Unknown user",
      email: card.user_email || null,
    },
    template: card.template_id
      ? { id: card.template_id, name: card.template_name || "Template", previewUrl: card.preview_url || null }
      : null,
    email: card.email || null,
    phone: card.phone || null,
    websiteUrl: card.website_url || null,
    isActive: Boolean(card.is_active),
    createdAt: card.created_at,
    updatedAt: card.updated_at,
  };
}

exports.listVCards = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const values = [];
    let searchCondition = "";
    if (search) {
      values.push(`%${search}%`);
      searchCondition = `WHERE (
        COALESCE(v.title, '') ILIKE $1 OR COALESCE(v.email, '') ILIKE $1 OR
        COALESCE(v.website_url, '') ILIKE $1 OR COALESCE(u.name, '') ILIKE $1 OR
        COALESCE(u.email, '') ILIKE $1 OR COALESCE(t.name, '') ILIKE $1
      )`;
    }

    const [cardsResult, summaryResult, usersResult, templatesResult] = await Promise.all([
      pool.query(
        `SELECT v.id, v.user_id, v.template_id, v.title, v.description, v.email, v.phone,
                v.website_url, v.is_active, v.created_at, v.updated_at,
                u.name AS user_name, u.email AS user_email,
                t.name AS template_name, t.preview_url
         FROM vcards v
         LEFT JOIN users u ON u.id = v.user_id
         LEFT JOIN vcard_templates t ON t.id = v.template_id
         ${searchCondition}
         ORDER BY v.updated_at DESC
         LIMIT 100`,
        values
      ),
      pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
               COUNT(*) FILTER (WHERE is_active = FALSE)::int AS inactive
        FROM vcards
      `),
      pool.query(`
        SELECT u.id, u.name, u.email
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active'
        ORDER BY u.name, u.email
      `),
      pool.query(`
        SELECT id, name, description, preview_url, is_public
        FROM vcard_templates
        ORDER BY is_public DESC, name
      `),
    ]);

    res.json({
      vcards: cardsResult.rows.map(mapAdminVCard),
      summary: summaryResult.rows[0],
      users: usersResult.rows,
      templates: templatesResult.rows.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description || null,
        previewUrl: template.preview_url || null,
        isPublic: Boolean(template.is_public),
      })),
    });
  } catch (error) {
    next(error);
  }
};

exports.createVCard = async (req, res, next) => {
  let client;
  try {
    const userId = Number(req.body.userId);
    const templateId = req.body.templateId ? Number(req.body.templateId) : null;
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim() || null;
    const email = String(req.body.email || "").trim().toLowerCase() || null;
    const phone = String(req.body.phone || "").trim() || null;
    const websiteUrl = String(req.body.websiteUrl || "").trim() || null;
    const isActive = req.body.isActive !== false;

    if (!Number.isInteger(userId) || userId < 1 || userId > 2147483647 || !title) {
      return res.status(400).json({ message: "An owner and VCard title are required" });
    }
    if (title.length > 255 || (email && email.length > 255) || (phone && phone.length > 50)) {
      return res.status(400).json({ message: "VCard title, email, or phone number is too long" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid VCard email address" });
    }
    if (websiteUrl) {
      try {
        const parsedUrl = new URL(websiteUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ message: "Website URL must start with http:// or https://" });
      }
    }

    client = await pool.connect();
    await client.query("BEGIN");
    const ownerResult = await client.query(
      `SELECT u.id
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active'`,
      [userId]
    );
    if (!ownerResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Select an active user account" });
    }
    if (templateId) {
      const templateResult = await client.query("SELECT id FROM vcard_templates WHERE id = $1", [templateId]);
      if (!templateResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Selected template was not found" });
      }
    }

    const result = await client.query(
      `INSERT INTO vcards (user_id, template_id, title, description, email, phone, website_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, is_active`,
      [userId, templateId, title, description, email, phone, websiteUrl, isActive]
    );
    const card = result.rows[0];
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'vcard.created', 'vcard', $2, $3::jsonb, $4, $5)`,
      [req.user.id, card.id, JSON.stringify({ title: card.title, ownerId: userId }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.status(201).json({ vcard: card });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.updateVCardStatus = async (req, res, next) => {
  const vcardId = vcardIdFromRequest(req);
  if (!vcardId || typeof req.body.isActive !== "boolean") {
    return res.status(400).json({ message: "A valid VCard ID and active state are required" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE vcards SET is_active = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, title, is_active`,
      [req.body.isActive, vcardId]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "VCard not found" });
    }
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'vcard.status_changed', 'vcard', $2, $3::jsonb, $4, $5)`,
      [req.user.id, vcardId, JSON.stringify({ isActive: req.body.isActive }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ vcard: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.deleteVCard = async (req, res, next) => {
  const vcardId = vcardIdFromRequest(req);
  if (!vcardId) return res.status(400).json({ message: "Invalid VCard ID" });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query("DELETE FROM vcards WHERE id = $1 RETURNING id, title", [vcardId]);
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "VCard not found" });
    }
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'vcard.deleted', 'vcard', $2, $3::jsonb, $4, $5)`,
      [req.user.id, vcardId, JSON.stringify({ title: result.rows[0].title }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ message: "VCard deleted successfully" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

function positiveIntegerParam(req) {
  const rawId = String(req.params.id || "");
  if (!/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

const nfcCardStatuses = ["inactive", "active", "assigned", "disabled"];
const nfcOrderStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];

function mapAdminNfcCard(card) {
  return {
    id: card.id,
    tagIdentifier: card.tag_identifier,
    serialNumber: card.serial_number || null,
    label: card.metadata && card.metadata.label ? card.metadata.label : `NFC Card #${card.id}`,
    notes: card.metadata && card.metadata.notes ? card.metadata.notes : null,
    status: card.status,
    owner: card.user_id ? { id: card.user_id, name: card.user_name || "Unknown user", email: card.user_email || null } : null,
    businessCard: card.business_card_id ? { id: card.business_card_id, title: card.business_card_title || "Untitled card" } : null,
    assignedAt: card.assigned_at || null,
    expiresAt: card.expires_at || null,
    createdAt: card.created_at,
    updatedAt: card.updated_at,
  };
}

exports.listNfcManagement = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const values = [];
    let cardSearch = "";
    let orderSearch = "";
    if (search) {
      values.push(`%${search}%`);
      cardSearch = `WHERE (n.tag_identifier ILIKE $1 OR COALESCE(n.serial_number, '') ILIKE $1 OR COALESCE(n.metadata->>'label', '') ILIKE $1 OR COALESCE(u.name, '') ILIKE $1 OR COALESCE(b.title, '') ILIKE $1)`;
      orderSearch = `WHERE (COALESCE(ou.name, '') ILIKE $1 OR COALESCE(ou.email, '') ILIKE $1 OR COALESCE(o.tracking_number, '') ILIKE $1 OR COALESCE(o.shipping_address, '') ILIKE $1 OR o.status ILIKE $1)`;
    }

    const [productsResult, cardsResult, ordersResult, summaryResult, usersResult, businessCardsResult] = await Promise.all([
      pool.query(`
        SELECT p.id, p.name, p.price, p.description, p.front_image, p.back_image,
               p.is_active, p.created_at, p.updated_at,
               (SELECT COUNT(*) FROM nfc_orders o WHERE o.nfc_product_id = p.id)::int AS order_count
        FROM nfc_products p
        ORDER BY p.updated_at DESC
      `),
      pool.query(
        `SELECT n.*, u.name AS user_name, u.email AS user_email, b.title AS business_card_title
         FROM nfc_cards n
         LEFT JOIN users u ON u.id = n.user_id
         LEFT JOIN business_cards b ON b.id = n.business_card_id
         ${cardSearch}
         ORDER BY n.updated_at DESC
         LIMIT 100`,
        values
      ),
      pool.query(
        `SELECT o.id, o.user_id, o.quantity, o.amount, o.status, o.shipping_address,
                o.tracking_number, o.ordered_at, o.updated_at,
                ou.name AS user_name, ou.email AS user_email
         FROM nfc_orders o
         LEFT JOIN users ou ON ou.id = o.user_id
         ${orderSearch}
         ORDER BY o.ordered_at DESC
         LIMIT 100`,
        values
      ),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM nfc_products)::int AS total_products,
          (SELECT COUNT(*) FROM nfc_cards)::int AS total_cards,
          (SELECT COUNT(*) FROM nfc_cards WHERE status IN ('active', 'assigned'))::int AS active_cards,
          (SELECT COUNT(*) FROM nfc_orders WHERE status = 'pending')::int AS pending_orders,
          (SELECT COALESCE(SUM(amount), 0) FROM nfc_orders WHERE status IN ('pending', 'processing', 'shipped')) AS order_value
      `),
      pool.query(`
        SELECT u.id, u.name, u.email
        FROM users u LEFT JOIN roles r ON r.id = u.role_id
        WHERE COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active'
        ORDER BY u.name, u.email
      `),
      pool.query(`
        SELECT b.id, b.user_id, b.title, u.name AS user_name
        FROM business_cards b
        LEFT JOIN users u ON u.id = b.user_id
        WHERE b.is_active = TRUE
        ORDER BY b.title, u.name
      `),
    ]);

    res.json({
      products: productsResult.rows.map((product) => ({
        id: product.id,
        name: product.name,
        price: number(product.price),
        description: product.description || null,
        frontImage: product.front_image,
        backImage: product.back_image,
        ordersCount: number(product.order_count),
        isActive: Boolean(product.is_active),
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      })),
      cards: cardsResult.rows.map(mapAdminNfcCard),
      orders: ordersResult.rows.map((order) => ({
        id: order.id,
        userId: order.user_id,
        userName: order.user_name || "Guest / deleted user",
        userEmail: order.user_email || null,
        quantity: number(order.quantity),
        amount: number(order.amount),
        status: order.status,
        shippingAddress: order.shipping_address || null,
        trackingNumber: order.tracking_number || null,
        orderedAt: order.ordered_at,
        updatedAt: order.updated_at,
      })),
      summary: summaryResult.rows[0],
      users: usersResult.rows,
      businessCards: businessCardsResult.rows,
    });
  } catch (error) {
    next(error);
  }
};

function validateNfcProductImage(value, fieldName) {
  if (!value) return `${fieldName} is required`;
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\r\n]+$/i.test(value)) {
    return `${fieldName} must be a PNG, JPG, or WebP image`;
  }
  if (value.length > 2100000) return `${fieldName} must be smaller than 1.5 MB`;
  return null;
}

exports.createNfcProduct = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const price = Number(req.body.price);
    const description = String(req.body.description || "").trim() || null;
    const frontImage = String(req.body.frontImage || "");
    const backImage = String(req.body.backImage || "");
    const isActive = req.body.isActive !== false;
    if (!name || name.length > 150) return res.status(400).json({ message: "Enter an NFC card name up to 150 characters" });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Enter a valid non-negative price" });
    if (description && description.length > 3000) return res.status(400).json({ message: "Description must not exceed 3000 characters" });
    const imageError = validateNfcProductImage(frontImage, "Front image") || validateNfcProductImage(backImage, "Back image");
    if (imageError) return res.status(400).json({ message: imageError });

    const result = await pool.query(
      `INSERT INTO nfc_products (name, price, description, front_image, back_image, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, price, is_active`,
      [name, price, description, frontImage, backImage, isActive]
    );
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_product.created', 'nfc_product', $2, $3::jsonb, $4, $5)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ name, price }), req.ip || null, req.get("user-agent") || null]
    );
    res.status(201).json({ product: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateNfcProduct = async (req, res, next) => {
  const productId = positiveIntegerParam(req);
  if (!productId) return res.status(400).json({ message: "Invalid NFC product ID" });
  try {
    const existing = await pool.query("SELECT front_image, back_image FROM nfc_products WHERE id = $1", [productId]);
    if (!existing.rowCount) return res.status(404).json({ message: "NFC product not found" });
    const name = String(req.body.name || "").trim();
    const price = Number(req.body.price);
    const description = String(req.body.description || "").trim() || null;
    const frontImage = req.body.frontImage ? String(req.body.frontImage) : existing.rows[0].front_image;
    const backImage = req.body.backImage ? String(req.body.backImage) : existing.rows[0].back_image;
    const isActive = req.body.isActive !== false;
    if (!name || name.length > 150) return res.status(400).json({ message: "Enter an NFC card name up to 150 characters" });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Enter a valid non-negative price" });
    if (description && description.length > 3000) return res.status(400).json({ message: "Description must not exceed 3000 characters" });
    const imageError = validateNfcProductImage(frontImage, "Front image") || validateNfcProductImage(backImage, "Back image");
    if (imageError) return res.status(400).json({ message: imageError });

    const result = await pool.query(
      `UPDATE nfc_products SET name = $1, price = $2, description = $3, front_image = $4,
       back_image = $5, is_active = $6, updated_at = NOW() WHERE id = $7
       RETURNING id, name, price, is_active`,
      [name, price, description, frontImage, backImage, isActive, productId]
    );
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_product.updated', 'nfc_product', $2, $3::jsonb, $4, $5)`,
      [req.user.id, productId, JSON.stringify({ name, price, isActive }), req.ip || null, req.get("user-agent") || null]
    );
    res.json({ product: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteNfcProduct = async (req, res, next) => {
  const productId = positiveIntegerParam(req);
  if (!productId) return res.status(400).json({ message: "Invalid NFC product ID" });
  try {
    const result = await pool.query("DELETE FROM nfc_products WHERE id = $1 RETURNING id, name", [productId]);
    if (!result.rowCount) return res.status(404).json({ message: "NFC product not found" });
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_product.deleted', 'nfc_product', $2, $3::jsonb, $4, $5)`,
      [req.user.id, productId, JSON.stringify({ name: result.rows[0].name }), req.ip || null, req.get("user-agent") || null]
    );
    res.json({ message: "NFC product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

function normalizeNfcCardPayload(body) {
  const userId = body.userId ? Number(body.userId) : null;
  const businessCardId = body.businessCardId ? Number(body.businessCardId) : null;
  return {
    userId: Number.isInteger(userId) && userId > 0 ? userId : null,
    businessCardId: Number.isInteger(businessCardId) && businessCardId > 0 ? businessCardId : null,
    tagIdentifier: String(body.tagIdentifier || "").trim(),
    serialNumber: String(body.serialNumber || "").trim() || null,
    label: String(body.label || "").trim() || null,
    notes: String(body.notes || "").trim() || null,
    status: String(body.status || "inactive").toLowerCase(),
    expiresAt: body.expiresAt || null,
  };
}

function nfcPayloadValidationMessage(payload) {
  if (payload.tagIdentifier.length > 255 || (payload.serialNumber && payload.serialNumber.length > 255)) {
    return "Tag identifier or serial number is too long";
  }
  if ((payload.label && payload.label.length > 100) || (payload.notes && payload.notes.length > 2000)) {
    return "NFC card label or notes are too long";
  }
  if (payload.expiresAt) {
    const expiry = String(payload.expiresAt);
    const parsedExpiry = new Date(`${expiry}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || Number.isNaN(parsedExpiry.getTime()) || parsedExpiry.toISOString().slice(0, 10) !== expiry) {
      return "Enter a valid expiry date using YYYY-MM-DD format";
    }
  }
  return null;
}

async function validateNfcRelations(client, payload) {
  if (payload.userId) {
    const userResult = await client.query(
      `SELECT u.id FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND COALESCE(r.name, 'user') <> 'super_admin'`,
      [payload.userId]
    );
    if (!userResult.rowCount) return "Selected user was not found";
  }
  if (payload.businessCardId) {
    const cardResult = await client.query("SELECT id FROM business_cards WHERE id = $1", [payload.businessCardId]);
    if (!cardResult.rowCount) return "Selected business card was not found";
  }
  return null;
}

exports.createNfcCard = async (req, res, next) => {
  const payload = normalizeNfcCardPayload(req.body);
  if (!payload.tagIdentifier) return res.status(400).json({ message: "Tag identifier is required" });
  const validationMessage = nfcPayloadValidationMessage(payload);
  if (validationMessage) return res.status(400).json({ message: validationMessage });
  if (!nfcCardStatuses.includes(payload.status)) return res.status(400).json({ message: "Invalid NFC card status" });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const relationError = await validateNfcRelations(client, payload);
    if (relationError) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: relationError });
    }
    const result = await client.query(
      `INSERT INTO nfc_cards (business_card_id, user_id, tag_identifier, serial_number, status, assigned_at, expires_at, metadata)
       VALUES ($1, $2, $3, $4, $5::varchar, CASE WHEN $5::varchar = 'assigned' THEN NOW() ELSE NULL END, $6, $7::jsonb)
       RETURNING id, tag_identifier, status`,
      [payload.businessCardId, payload.userId, payload.tagIdentifier, payload.serialNumber, payload.status, payload.expiresAt, JSON.stringify({ label: payload.label, notes: payload.notes })]
    );
    const card = result.rows[0];
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_card.created', 'nfc_card', $2, $3::jsonb, $4, $5)`,
      [req.user.id, card.id, JSON.stringify({ tagIdentifier: card.tag_identifier, status: card.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.status(201).json({ card });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "Tag identifier already exists" });
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.updateNfcCard = async (req, res, next) => {
  const cardId = positiveIntegerParam(req);
  const payload = normalizeNfcCardPayload(req.body);
  if (!cardId) return res.status(400).json({ message: "Invalid NFC card ID" });
  if (!payload.tagIdentifier) return res.status(400).json({ message: "Tag identifier is required" });
  const validationMessage = nfcPayloadValidationMessage(payload);
  if (validationMessage) return res.status(400).json({ message: validationMessage });
  if (!nfcCardStatuses.includes(payload.status)) return res.status(400).json({ message: "Invalid NFC card status" });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const relationError = await validateNfcRelations(client, payload);
    if (relationError) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: relationError });
    }
    const result = await client.query(
      `UPDATE nfc_cards
       SET business_card_id = $1, user_id = $2, tag_identifier = $3, serial_number = $4,
           status = $5::varchar,
           assigned_at = CASE WHEN $5::varchar = 'assigned' THEN COALESCE(assigned_at, NOW()) ELSE assigned_at END,
           expires_at = $6, metadata = $7::jsonb, updated_at = NOW()
       WHERE id = $8
       RETURNING id, tag_identifier, status`,
      [payload.businessCardId, payload.userId, payload.tagIdentifier, payload.serialNumber, payload.status, payload.expiresAt, JSON.stringify({ label: payload.label, notes: payload.notes }), cardId]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "NFC card not found" });
    }
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_card.updated', 'nfc_card', $2, $3::jsonb, $4, $5)`,
      [req.user.id, cardId, JSON.stringify({ tagIdentifier: payload.tagIdentifier, status: payload.status }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ card: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "Tag identifier already exists" });
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.deleteNfcCard = async (req, res, next) => {
  const cardId = positiveIntegerParam(req);
  if (!cardId) return res.status(400).json({ message: "Invalid NFC card ID" });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query("DELETE FROM nfc_cards WHERE id = $1 RETURNING id, tag_identifier", [cardId]);
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "NFC card not found" });
    }
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_card.deleted', 'nfc_card', $2, $3::jsonb, $4, $5)`,
      [req.user.id, cardId, JSON.stringify({ tagIdentifier: result.rows[0].tag_identifier }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ message: "NFC card deleted successfully" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.updateNfcOrder = async (req, res, next) => {
  const orderId = positiveIntegerParam(req);
  const status = String(req.body.status || "").toLowerCase();
  const trackingNumber = String(req.body.trackingNumber || "").trim() || null;
  if (!orderId) return res.status(400).json({ message: "Invalid NFC order ID" });
  if (!nfcOrderStatuses.includes(status)) return res.status(400).json({ message: "Invalid NFC order status" });
  if (trackingNumber && trackingNumber.length > 255) return res.status(400).json({ message: "Tracking number is too long" });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE nfc_orders SET status = $1, tracking_number = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, status, tracking_number`,
      [status, trackingNumber, orderId]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "NFC order not found" });
    }
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_order.updated', 'nfc_order', $2, $3::jsonb, $4, $5)`,
      [req.user.id, orderId, JSON.stringify({ status, trackingNumber }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ order: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

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
    const [subscriptionsResult, plansResult, usersResult, summaryResult] = await Promise.all([
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
               p.analytics_limit, p.features, p.status, p.created_at, p.updated_at,
               (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id)::int AS subscriber_count,
               (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id AND s.status = 'active')::int AS active_subscriber_count
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
          COUNT(*) FILTER (WHERE s.status = 'active')::int AS active_subscriptions,
          COUNT(*) FILTER (WHERE s.status IN ('pending', 'trial'))::int AS pending_subscriptions,
          COALESCE(SUM(CASE
            WHEN s.status <> 'active' THEN 0
            WHEN p.billing_interval = 'yearly' THEN p.price / 12
            WHEN p.billing_interval = 'weekly' THEN p.price * 4.345
            WHEN p.billing_interval = 'daily' THEN p.price * 30
            WHEN p.billing_interval = 'lifetime' THEN 0
            ELSE p.price END), 0) AS monthly_recurring_revenue
        FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
      `),
    ]);

    res.json({
      subscriptions: subscriptionsResult.rows.map((subscription) => ({
        id: subscription.id,
        user: { id: subscription.user_id, name: subscription.user_name || "Deleted user", email: subscription.user_email || null },
        plan: subscription.plan_id ? { id: subscription.plan_id, name: subscription.plan_name || "Deleted plan", price: number(subscription.plan_price), billingInterval: subscription.billing_interval } : null,
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
        billingInterval: plan.billing_interval,
        vcardLimit: number(plan.vcard_limit),
        nfcLimit: number(plan.nfc_limit),
        analyticsLimit: number(plan.analytics_limit),
        features: plan.features || {},
        status: plan.status,
        subscribers: number(plan.subscriber_count),
        activeSubscribers: number(plan.active_subscriber_count),
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      })),
      users: usersResult.rows,
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

function normalizePlanPayload(body) {
  const featureText = Array.isArray(body.features) ? body.features : String(body.features || "").split(",");
  return {
    name: String(body.name || "").trim(),
    price: Number(body.price),
    billingInterval: String(body.billingInterval || "monthly").toLowerCase(),
    vcardLimit: Number(body.vcardLimit),
    nfcLimit: Number(body.nfcLimit),
    analyticsLimit: Number(body.analyticsLimit),
    features: featureText.map((feature) => String(feature).trim()).filter(Boolean),
    status: String(body.status || "active").toLowerCase(),
  };
}

function planValidationMessage(plan) {
  if (!plan.name || plan.name.length > 150) return "Enter a plan name up to 150 characters";
  if (!Number.isFinite(plan.price) || plan.price < 0 || plan.price > 9999999999.99) return "Enter a valid plan price up to 9,999,999,999.99";
  if (!billingIntervals.includes(plan.billingInterval)) return "Invalid billing interval";
  if (!planStatuses.includes(plan.status)) return "Invalid plan status";
  if (![plan.vcardLimit, plan.nfcLimit, plan.analyticsLimit].every((limit) => Number.isInteger(limit) && limit >= 0 && limit <= 2147483647)) return "Plan limits must be whole numbers from 0 to 2,147,483,647";
  return null;
}

exports.createPlan = async (req, res, next) => {
  try {
    const plan = normalizePlanPayload(req.body);
    const validation = planValidationMessage(plan);
    if (validation) return res.status(400).json({ message: validation });
    const result = await pool.query(
      `INSERT INTO plans (name, price, billing_interval, vcard_limit, nfc_limit, analytics_limit, features, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING id, name, price, status`,
      [plan.name, plan.price, plan.billingInterval, plan.vcardLimit, plan.nfcLimit, plan.analyticsLimit, JSON.stringify(plan.features), plan.status]
    );
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'plan.created', 'plan', $2, $3::jsonb, $4, $5)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ name: plan.name, price: plan.price }), req.ip || null, req.get("user-agent") || null]
    );
    res.status(201).json({ plan: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ message: "A plan with this name already exists" });
    next(error);
  }
};

exports.updatePlan = async (req, res, next) => {
  const planId = positiveIntegerParam(req);
  if (!planId) return res.status(400).json({ message: "Invalid plan ID" });
  try {
    const plan = normalizePlanPayload(req.body);
    const validation = planValidationMessage(plan);
    if (validation) return res.status(400).json({ message: validation });
    const result = await pool.query(
      `UPDATE plans SET name = $1, price = $2, billing_interval = $3, vcard_limit = $4,
       nfc_limit = $5, analytics_limit = $6, features = $7::jsonb, status = $8, updated_at = NOW()
       WHERE id = $9 RETURNING id, name, price, status`,
      [plan.name, plan.price, plan.billingInterval, plan.vcardLimit, plan.nfcLimit, plan.analyticsLimit, JSON.stringify(plan.features), plan.status, planId]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Plan not found" });
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'plan.updated', 'plan', $2, $3::jsonb, $4, $5)`,
      [req.user.id, planId, JSON.stringify({ name: plan.name, price: plan.price, status: plan.status }), req.ip || null, req.get("user-agent") || null]
    );
    res.json({ plan: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ message: "A plan with this name already exists" });
    next(error);
  }
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
  if (!/^[A-Z]{3,10}$/.test(payment.currency)) return "Currency must contain 3 to 10 letters";
  if (!cashPaymentStatuses.includes(payment.status)) return "Invalid cash payment status";
  if (payment.reference && payment.reference.length > 255) return "Payment reference must not exceed 255 characters";
  if (payment.proofUrl && (payment.proofUrl.length > 2000 || !/^https?:\/\//i.test(payment.proofUrl))) return "Proof attachment must be a valid HTTP or HTTPS URL";
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
  if (payment.status === "approved" && payment.subscriptionId) {
    await client.query(
      "UPDATE subscriptions SET status = 'active', updated_at = NOW() WHERE id = $1",
      [payment.subscriptionId]
    );
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
  if (!/^[A-Z]{3,10}$/.test(transaction.currency)) return "Currency must contain 3 to 10 letters";
  if (!transactionStatuses.includes(transaction.status)) return "Invalid transaction status";
  if (transaction.reference && transaction.reference.length > 255) return "Reference must not exceed 255 characters";
  if (transaction.gateway.length > 100) return "Gateway must not exceed 100 characters";
  if (transaction.note && transaction.note.length > 3000) return "Internal note must not exceed 3,000 characters";
  return null;
}

async function validateTransactionUser(client, userId) {
  const result = await client.query(
    `SELECT u.id FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND COALESCE(r.name, 'user') <> 'super_admin'`,
    [userId]
  );
  return Boolean(result.rowCount);
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

const payoutStatuses = ["pending", "processing", "paid", "failed", "cancelled"];
const payoutMethods = ["bank_transfer", "paypal", "cash", "other"];

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
  if (!/^[A-Z]{3,10}$/.test(payout.currency)) return "Currency must contain 3 to 10 letters";
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

const withdrawalStatuses = ["pending", "approved", "processing", "completed", "rejected", "cancelled"];

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
  if (!/^[A-Z]{3,10}$/.test(withdrawal.currency)) return "Currency must contain 3 to 10 letters";
  if (!payoutMethods.includes(withdrawal.method)) return "Invalid withdrawal method";
  if (!withdrawalStatuses.includes(withdrawal.status)) return "Invalid withdrawal status";
  if (withdrawal.accountName && withdrawal.accountName.length > 500) return "Account details must not exceed 500 characters";
  if (withdrawal.requestNote && withdrawal.requestNote.length > 3000) return "Request note must not exceed 3,000 characters";
  if (withdrawal.adminNote && withdrawal.adminNote.length > 3000) return "Admin note must not exceed 3,000 characters";
  return null;
}

function withdrawalPayoutStatus(status) {
  if (status === "approved") return "pending";
  if (status === "processing") return "processing";
  if (status === "completed") return "paid";
  return "cancelled";
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
       account_details = $10::jsonb, notes = $11,
       paid_at = CASE WHEN $8::varchar = 'paid' THEN COALESCE(paid_at, NOW()) ELSE NULL END,
       reviewed_by = $12, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $13 RETURNING transaction_id`,
      [withdrawal.userId, withdrawal.id, user.name, user.email, withdrawal.amount, withdrawal.currency, withdrawal.method, payoutStatus, reference, JSON.stringify({ accountName: withdrawal.accountName, withdrawalId: withdrawal.id }), payoutNotes, reviewerId, payoutId]
    );
    transactionId = payoutResult.rows[0].transaction_id;
  } else {
    const payoutResult = await client.query(
      `INSERT INTO payouts (user_id, withdrawal_id, payee_name, payee_email, amount, currency,
       method, status, reference, account_details, notes, paid_at, reviewed_by, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::varchar, $9, $10::jsonb, $11,
       CASE WHEN $8::varchar = 'paid' THEN NOW() ELSE NULL END, $12, NOW())
       RETURNING id, transaction_id`,
      [withdrawal.userId, withdrawal.id, user.name, user.email, withdrawal.amount, withdrawal.currency, withdrawal.method, payoutStatus, reference, JSON.stringify({ accountName: withdrawal.accountName, withdrawalId: withdrawal.id }), payoutNotes, reviewerId]
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
        `SELECT w.id, w.user_id, w.payout_id, w.amount, w.currency, w.method, w.status,
                w.account_details, w.request_note, w.admin_note, w.reviewed_at, w.processed_at,
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
        payoutId: withdrawal.payout_id || null, transactionId: withdrawal.transaction_id || null,
        amount: number(withdrawal.amount), currency: withdrawal.currency, method: withdrawal.method,
        status: withdrawal.status,
        accountName: withdrawal.account_details && withdrawal.account_details.accountName ? withdrawal.account_details.accountName : null,
        requestNote: withdrawal.request_note || null, adminNote: withdrawal.admin_note || null,
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

exports.createWithdrawal = async (req, res, next) => {
  const withdrawal = normalizeWithdrawalPayload(req.body);
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
    await client.query("UPDATE withdrawals SET affiliate_id = (SELECT id FROM affiliate_profiles WHERE user_id = $1) WHERE id = $2", [withdrawal.userId, withdrawal.id]);
    const payoutId = await syncWithdrawalPayout(client, withdrawal, req.user.id);
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
    if (!(await validateTransactionUser(client, withdrawal.userId))) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected user was not found" }); }
    const result = await client.query(
      `UPDATE withdrawals SET user_id = $1, amount = $2, currency = $3, method = $4,
       status = $5::varchar, account_details = $6::jsonb, request_note = $7, admin_note = $8,
       reviewed_by = CASE WHEN $5::varchar <> 'pending' THEN $9::integer ELSE NULL END,
       reviewed_at = CASE WHEN $5::varchar <> 'pending' THEN NOW() ELSE NULL END,
       processed_at = CASE WHEN $5::varchar = 'completed' THEN COALESCE(processed_at, NOW()) ELSE NULL END,
       updated_at = NOW() WHERE id = $10 RETURNING id, payout_id`,
      [withdrawal.userId, withdrawal.amount, withdrawal.currency, withdrawal.method, withdrawal.status, JSON.stringify({ accountName: withdrawal.accountName }), withdrawal.requestNote, withdrawal.adminNote, req.user.id, withdrawalId]
    );
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Withdrawal not found" }); }
    withdrawal.id = withdrawalId;
    withdrawal.payoutId = result.rows[0].payout_id;
    await client.query("UPDATE withdrawals SET affiliate_id = (SELECT id FROM affiliate_profiles WHERE user_id = $1) WHERE id = $2", [withdrawal.userId, withdrawalId]);
    const payoutId = await syncWithdrawalPayout(client, withdrawal, req.user.id);
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
    if (existing.rows[0].payout_id) {
      const payout = await client.query("SELECT transaction_id FROM payouts WHERE id = $1", [existing.rows[0].payout_id]);
      if (payout.rowCount && payout.rows[0].transaction_id) await client.query("DELETE FROM transactions WHERE id = $1", [payout.rows[0].transaction_id]);
      await client.query("DELETE FROM payouts WHERE id = $1", [existing.rows[0].payout_id]);
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

const affiliateProfileStatuses = ["active", "inactive", "suspended"];
const affiliateCommissionTypes = ["percentage", "fixed"];
const affiliateReferralStatuses = ["pending", "qualified", "rejected"];
const affiliateCommissionStatuses = ["pending", "approved", "rejected", "paid"];

function normalizeAffiliateProfilePayload(body) {
  return {
    userId: Number(body.userId),
    referralCode: String(body.referralCode || "").trim().toUpperCase(),
    commissionType: String(body.commissionType || "percentage").trim().toLowerCase(),
    commissionValue: Number(body.commissionValue),
    paymentMethod: String(body.paymentMethod || "bank_transfer").trim().toLowerCase(),
    payoutDetails: String(body.payoutDetails || "").trim() || null,
    status: String(body.status || "active").trim().toLowerCase(),
  };
}

function affiliateProfileValidationMessage(profile) {
  if (!Number.isInteger(profile.userId) || profile.userId < 1 || profile.userId > 2147483647) return "Select a valid user";
  if (!/^[A-Z0-9_-]{3,80}$/.test(profile.referralCode)) return "Referral code must contain 3 to 80 letters, numbers, dashes, or underscores";
  if (!affiliateCommissionTypes.includes(profile.commissionType)) return "Invalid commission type";
  if (!Number.isFinite(profile.commissionValue) || profile.commissionValue < 0 || profile.commissionValue > 9999999999.99) return "Enter a valid commission value";
  if (profile.commissionType === "percentage" && profile.commissionValue > 100) return "Percentage commission cannot exceed 100";
  if (!payoutMethods.includes(profile.paymentMethod)) return "Invalid affiliate payment method";
  if (profile.payoutDetails && profile.payoutDetails.length > 500) return "Payout details must not exceed 500 characters";
  if (!affiliateProfileStatuses.includes(profile.status)) return "Invalid affiliate status";
  return null;
}

exports.listAffiliations = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const pattern = search ? `%${search}%` : null;
    const [profilesResult, referralsResult, commissionsResult, usersResult, summaryResult, dueResult] = await Promise.all([
      pool.query(
        `SELECT ap.id, ap.user_id, ap.referral_code, ap.commission_type, ap.commission_value,
                ap.payment_method, ap.payout_details, ap.status, ap.created_at, ap.updated_at,
                u.name AS user_name, u.email AS user_email,
                (SELECT COUNT(*) FROM affiliate_referrals ar WHERE ar.affiliate_id = ap.id)::int AS referral_count,
                (SELECT COUNT(*) FROM affiliate_referrals ar WHERE ar.affiliate_id = ap.id AND ar.status = 'qualified')::int AS qualified_count
         FROM affiliate_profiles ap JOIN users u ON u.id = ap.user_id
         WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1 OR ap.referral_code ILIKE $1 OR ap.status ILIKE $1)
         ORDER BY CASE WHEN ap.status = 'active' THEN 0 ELSE 1 END, ap.created_at DESC`,
        [pattern]
      ),
      pool.query(
        `SELECT ar.id, ar.affiliate_id, ar.referred_user_id, ar.status, ar.joined_at, ar.updated_at,
                owner.name AS affiliate_name, owner.email AS affiliate_email, ap.referral_code,
                referred.name AS referred_name, referred.email AS referred_email
         FROM affiliate_referrals ar JOIN affiliate_profiles ap ON ap.id = ar.affiliate_id
         JOIN users owner ON owner.id = ap.user_id JOIN users referred ON referred.id = ar.referred_user_id
         WHERE ($1::text IS NULL OR owner.name ILIKE $1 OR owner.email ILIKE $1 OR referred.name ILIKE $1 OR referred.email ILIKE $1 OR ap.referral_code ILIKE $1 OR ar.status ILIKE $1)
         ORDER BY ar.joined_at DESC`,
        [pattern]
      ),
      pool.query(
        `SELECT ac.id, ac.affiliate_id, ac.referral_id, ac.payment_id, ac.amount, ac.currency,
                ac.status, ac.description, ac.approved_at, ac.created_at, ac.updated_at,
                owner.name AS affiliate_name, owner.email AS affiliate_email,
                referred.name AS referred_name, approver.name AS approver_name
         FROM affiliate_commissions ac JOIN affiliate_profiles ap ON ap.id = ac.affiliate_id
         JOIN users owner ON owner.id = ap.user_id
         LEFT JOIN affiliate_referrals ar ON ar.id = ac.referral_id
         LEFT JOIN users referred ON referred.id = ar.referred_user_id
         LEFT JOIN users approver ON approver.id = ac.approved_by
         WHERE ($1::text IS NULL OR owner.name ILIKE $1 OR owner.email ILIKE $1 OR COALESCE(referred.name, '') ILIKE $1 OR COALESCE(ac.description, '') ILIKE $1 OR ac.status ILIKE $1)
         ORDER BY CASE WHEN ac.status = 'pending' THEN 0 ELSE 1 END, ac.created_at DESC`,
        [pattern]
      ),
      pool.query(`SELECT u.id, u.name, u.email FROM users u LEFT JOIN roles r ON r.id = u.role_id
                  WHERE COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active' ORDER BY u.name, u.email`),
      pool.query(`SELECT (SELECT COUNT(*) FROM affiliate_profiles WHERE status = 'active')::int AS active_partners,
                         (SELECT COUNT(*) FROM affiliate_referrals WHERE status = 'qualified')::int AS qualified_conversions,
                         (SELECT COUNT(*) FROM affiliate_commissions WHERE status = 'pending')::int AS pending_commissions`),
      pool.query(`SELECT currency, COALESCE(SUM(amount), 0) AS amount FROM affiliate_commissions WHERE status = 'approved' GROUP BY currency ORDER BY currency`),
    ]);
    res.json({
      partners: profilesResult.rows.map((profile) => ({
        id: profile.id, user: { id: profile.user_id, name: profile.user_name, email: profile.user_email },
        referralCode: profile.referral_code, commissionType: profile.commission_type,
        commissionValue: number(profile.commission_value), paymentMethod: profile.payment_method,
        payoutDetails: profile.payout_details && profile.payout_details.label ? profile.payout_details.label : null,
        status: profile.status, referrals: profile.referral_count, qualified: profile.qualified_count,
        createdAt: profile.created_at, updatedAt: profile.updated_at,
      })),
      referrals: referralsResult.rows.map((referral) => ({
        id: referral.id, affiliateId: referral.affiliate_id,
        affiliate: { name: referral.affiliate_name, email: referral.affiliate_email, code: referral.referral_code },
        user: { id: referral.referred_user_id, name: referral.referred_name, email: referral.referred_email },
        status: referral.status, joinedAt: referral.joined_at, updatedAt: referral.updated_at,
      })),
      commissions: commissionsResult.rows.map((commission) => ({
        id: commission.id, affiliateId: commission.affiliate_id, referralId: commission.referral_id || null,
        paymentId: commission.payment_id || null,
        affiliate: { name: commission.affiliate_name, email: commission.affiliate_email },
        referredName: commission.referred_name || null, amount: number(commission.amount), currency: commission.currency,
        status: commission.status, description: commission.description || null,
        approverName: commission.approver_name || null, approvedAt: commission.approved_at || null,
        createdAt: commission.created_at, updatedAt: commission.updated_at,
      })),
      users: usersResult.rows,
      summary: { ...summaryResult.rows[0], dueByCurrency: dueResult.rows.map((row) => ({ currency: row.currency, amount: number(row.amount) })) },
    });
  } catch (error) { next(error); }
};

exports.createAffiliatePartner = async (req, res, next) => {
  const profile = normalizeAffiliateProfilePayload(req.body);
  const validation = affiliateProfileValidationMessage(profile);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    if (!(await validateTransactionUser(client, profile.userId))) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected user was not found" }); }
    const result = await client.query(
      `INSERT INTO affiliate_profiles (user_id, referral_code, commission_type, commission_value, payment_method, payout_details, status)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id, referral_code, status`,
      [profile.userId, profile.referralCode, profile.commissionType, profile.commissionValue, profile.paymentMethod, JSON.stringify({ label: profile.payoutDetails }), profile.status]
    );
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1, 'affiliate.created', 'affiliate', $2, $3::jsonb)`, [req.user.id, result.rows[0].id, JSON.stringify({ userId: profile.userId, referralCode: profile.referralCode })]);
    await client.query("COMMIT"); res.status(201).json({ partner: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "This user or referral code already has an affiliate profile" });
    next(error);
  } finally { if (client) client.release(); }
};

exports.updateAffiliatePartner = async (req, res, next) => {
  const affiliateId = positiveIntegerParam(req);
  if (!affiliateId) return res.status(400).json({ message: "Invalid affiliate ID" });
  const profile = normalizeAffiliateProfilePayload(req.body);
  const validation = affiliateProfileValidationMessage(profile);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    if (!(await validateTransactionUser(client, profile.userId))) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected user was not found" }); }
    const result = await client.query(
      `UPDATE affiliate_profiles SET user_id=$1, referral_code=$2, commission_type=$3, commission_value=$4,
       payment_method=$5, payout_details=$6::jsonb, status=$7, updated_at=NOW() WHERE id=$8 RETURNING id, referral_code, status`,
      [profile.userId, profile.referralCode, profile.commissionType, profile.commissionValue, profile.paymentMethod, JSON.stringify({ label: profile.payoutDetails }), profile.status, affiliateId]
    );
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Affiliate partner not found" }); }
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1, 'affiliate.updated', 'affiliate', $2, $3::jsonb)`, [req.user.id, affiliateId, JSON.stringify({ userId: profile.userId, referralCode: profile.referralCode, status: profile.status })]);
    await client.query("COMMIT"); res.json({ partner: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "This user or referral code already has an affiliate profile" });
    next(error);
  } finally { if (client) client.release(); }
};

exports.deleteAffiliatePartner = async (req, res, next) => {
  const affiliateId = positiveIntegerParam(req);
  if (!affiliateId) return res.status(400).json({ message: "Invalid affiliate ID" });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const dependencies = await client.query(`SELECT (SELECT COUNT(*) FROM affiliate_referrals WHERE affiliate_id=$1)::int referrals, (SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id=$1)::int commissions, (SELECT COUNT(*) FROM withdrawals WHERE affiliate_id=$1)::int withdrawals`, [affiliateId]);
    const counts = dependencies.rows[0];
    if (counts.referrals || counts.commissions || counts.withdrawals) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Remove this partner's referrals, commissions, and withdrawals before deleting it" }); }
    const result = await client.query("DELETE FROM affiliate_profiles WHERE id=$1 RETURNING id, referral_code", [affiliateId]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Affiliate partner not found" }); }
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1, 'affiliate.deleted', 'affiliate', $2, $3::jsonb)`, [req.user.id, affiliateId, JSON.stringify(result.rows[0])]);
    await client.query("COMMIT"); res.json({ message: "Affiliate partner deleted successfully" });
  } catch (error) { if (client) await client.query("ROLLBACK").catch(() => {}); next(error); }
  finally { if (client) client.release(); }
};

function normalizeAffiliateReferralPayload(body) {
  return { affiliateId: Number(body.affiliateId), userId: Number(body.userId), status: String(body.status || "pending").toLowerCase() };
}

exports.createAffiliateReferral = async (req, res, next) => {
  const referral = normalizeAffiliateReferralPayload(req.body);
  if (!Number.isInteger(referral.affiliateId) || referral.affiliateId < 1 || !Number.isInteger(referral.userId) || referral.userId < 1) return res.status(400).json({ message: "Select an affiliate and referred user" });
  if (!affiliateReferralStatuses.includes(referral.status)) return res.status(400).json({ message: "Invalid referral status" });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const relations = await client.query(`SELECT ap.user_id AS owner_id, EXISTS(SELECT 1 FROM users WHERE id=$2) AS user_exists FROM affiliate_profiles ap WHERE ap.id=$1`, [referral.affiliateId, referral.userId]);
    if (!relations.rowCount || !relations.rows[0].user_exists) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Affiliate or referred user was not found" }); }
    if (Number(relations.rows[0].owner_id) === referral.userId) { await client.query("ROLLBACK"); return res.status(400).json({ message: "An affiliate cannot refer their own account" }); }
    const result = await client.query(`INSERT INTO affiliate_referrals (affiliate_id,referred_user_id,status) VALUES($1,$2,$3) RETURNING id,status`, [referral.affiliateId, referral.userId, referral.status]);
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,'affiliate_referral.created','affiliate_referral',$2,$3::jsonb)`, [req.user.id, result.rows[0].id, JSON.stringify(referral)]);
    await client.query("COMMIT"); res.status(201).json({ referral: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "This user is already assigned to an affiliate" });
    next(error);
  } finally { if (client) client.release(); }
};

exports.updateAffiliateReferral = async (req, res, next) => {
  const referralId = positiveIntegerParam(req);
  if (!referralId) return res.status(400).json({ message: "Invalid referral ID" });
  const referral = normalizeAffiliateReferralPayload(req.body);
  if (!Number.isInteger(referral.affiliateId) || referral.affiliateId < 1 || !Number.isInteger(referral.userId) || referral.userId < 1 || !affiliateReferralStatuses.includes(referral.status)) return res.status(400).json({ message: "Enter a valid affiliate, user, and status" });
  try {
    const result = await pool.query(`UPDATE affiliate_referrals ar SET affiliate_id=$1,referred_user_id=$2,status=$3,updated_at=NOW() WHERE id=$4 AND $2<>(SELECT user_id FROM affiliate_profiles WHERE id=$1) RETURNING id,status`, [referral.affiliateId, referral.userId, referral.status, referralId]);
    if (!result.rowCount) return res.status(404).json({ message: "Referral not found or relation is invalid" });
    await pool.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,'affiliate_referral.updated','affiliate_referral',$2,$3::jsonb)`, [req.user.id, referralId, JSON.stringify(referral)]);
    res.json({ referral: result.rows[0] });
  } catch (error) { if (error.code === "23505") return res.status(409).json({ message: "This user is already assigned to an affiliate" }); next(error); }
};

exports.deleteAffiliateReferral = async (req, res, next) => {
  const referralId = positiveIntegerParam(req);
  if (!referralId) return res.status(400).json({ message: "Invalid referral ID" });
  try {
    const result = await pool.query("DELETE FROM affiliate_referrals WHERE id=$1 RETURNING id,affiliate_id,referred_user_id", [referralId]);
    if (!result.rowCount) return res.status(404).json({ message: "Referral not found" });
    await pool.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,'affiliate_referral.deleted','affiliate_referral',$2,$3::jsonb)`, [req.user.id, referralId, JSON.stringify(result.rows[0])]);
    res.json({ message: "Referral deleted successfully" });
  } catch (error) { next(error); }
};

function normalizeAffiliateCommissionPayload(body) {
  return { affiliateId: Number(body.affiliateId), referralId: body.referralId ? Number(body.referralId) : null, amount: Number(body.amount), currency: String(body.currency || "USD").toUpperCase(), status: String(body.status || "pending").toLowerCase(), description: String(body.description || "").trim() || null };
}

function affiliateCommissionValidationMessage(commission) {
  if (!Number.isInteger(commission.affiliateId) || commission.affiliateId < 1) return "Select an affiliate partner";
  if (commission.referralId !== null && (!Number.isInteger(commission.referralId) || commission.referralId < 1)) return "Select a valid referral";
  if (!Number.isFinite(commission.amount) || commission.amount < 0.01 || commission.amount > 9999999999.99) return "Enter a valid positive commission amount";
  if (!/^[A-Z]{3,10}$/.test(commission.currency)) return "Currency must contain 3 to 10 letters";
  if (!affiliateCommissionStatuses.includes(commission.status)) return "Invalid commission status";
  if (commission.description && commission.description.length > 3000) return "Description must not exceed 3,000 characters";
  return null;
}

async function saveAffiliateCommission(req, res, next, commissionId) {
  const commission = normalizeAffiliateCommissionPayload(req.body);
  const validation = affiliateCommissionValidationMessage(commission);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const relation = await client.query(`SELECT EXISTS(SELECT 1 FROM affiliate_profiles WHERE id=$1) AS affiliate_exists, CASE WHEN $2::integer IS NULL THEN TRUE ELSE EXISTS(SELECT 1 FROM affiliate_referrals WHERE id=$2 AND affiliate_id=$1) END AS referral_valid`, [commission.affiliateId, commission.referralId]);
    if (!relation.rows[0].affiliate_exists || !relation.rows[0].referral_valid) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Affiliate or referral relation is invalid" }); }
    const values = [commission.affiliateId, commission.referralId, commission.amount, commission.currency, commission.status, commission.description, req.user.id];
    const result = commissionId
      ? await client.query(`UPDATE affiliate_commissions SET affiliate_id=$1,referral_id=$2,amount=$3,currency=$4,status=$5::varchar,description=$6,approved_by=CASE WHEN $5::varchar IN ('approved','paid') THEN $7::integer ELSE NULL END,approved_at=CASE WHEN $5::varchar IN ('approved','paid') THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$8 RETURNING id,status`, [...values, commissionId])
      : await client.query(`INSERT INTO affiliate_commissions (affiliate_id,referral_id,amount,currency,status,description,approved_by,approved_at) VALUES($1,$2,$3,$4,$5::varchar,$6,CASE WHEN $5::varchar IN ('approved','paid') THEN $7::integer ELSE NULL END,CASE WHEN $5::varchar IN ('approved','paid') THEN NOW() ELSE NULL END) RETURNING id,status`, values);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Commission not found" }); }
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,$2,'affiliate_commission',$3,$4::jsonb)`, [req.user.id, commissionId ? "affiliate_commission.updated" : "affiliate_commission.created", result.rows[0].id, JSON.stringify(commission)]);
    await client.query("COMMIT"); res.status(commissionId ? 200 : 201).json({ commission: result.rows[0] });
  } catch (error) { if (client) await client.query("ROLLBACK").catch(() => {}); next(error); }
  finally { if (client) client.release(); }
}

exports.createAffiliateCommission = (req, res, next) => saveAffiliateCommission(req, res, next, null);
exports.updateAffiliateCommission = (req, res, next) => {
  const commissionId = positiveIntegerParam(req);
  if (!commissionId) return res.status(400).json({ message: "Invalid commission ID" });
  return saveAffiliateCommission(req, res, next, commissionId);
};

exports.deleteAffiliateCommission = async (req, res, next) => {
  const commissionId = positiveIntegerParam(req);
  if (!commissionId) return res.status(400).json({ message: "Invalid commission ID" });
  try {
    const result = await pool.query("DELETE FROM affiliate_commissions WHERE id=$1 RETURNING id,affiliate_id,amount,currency,status", [commissionId]);
    if (!result.rowCount) return res.status(404).json({ message: "Commission not found" });
    await pool.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,'affiliate_commission.deleted','affiliate_commission',$2,$3::jsonb)`, [req.user.id, commissionId, JSON.stringify(result.rows[0])]);
    res.json({ message: "Commission deleted successfully" });
  } catch (error) { next(error); }
};

const couponStatuses = ["active", "inactive", "expired"];
const couponDiscountTypes = ["percentage", "fixed"];

function nullableCouponDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
}

function normalizeCouponPayload(body) {
  return {
    code: String(body.code || "").trim().toUpperCase(),
    name: String(body.name || "").trim(),
    discountType: String(body.discountType || "percentage").toLowerCase(),
    discountValue: Number(body.discountValue),
    currency: String(body.currency || "USD").trim().toUpperCase(),
    usageLimit: body.usageLimit === "" || body.usageLimit === null || body.usageLimit === undefined ? null : Number(body.usageLimit),
    perUserLimit: Number(body.perUserLimit || 1),
    minimumAmount: Number(body.minimumAmount || 0),
    planId: body.planId ? Number(body.planId) : null,
    startsAt: nullableCouponDate(body.startsAt),
    expiresAt: nullableCouponDate(body.expiresAt),
    status: String(body.status || "active").toLowerCase(),
  };
}

function couponValidationMessage(coupon) {
  if (!/^[A-Z0-9_-]{3,80}$/.test(coupon.code)) return "Code must be 3 to 80 letters, numbers, hyphens, or underscores";
  if (!coupon.name || coupon.name.length > 150) return "Name is required and must not exceed 150 characters";
  if (!couponDiscountTypes.includes(coupon.discountType)) return "Invalid discount type";
  if (!Number.isFinite(coupon.discountValue) || coupon.discountValue < 0.01 || coupon.discountValue > 9999999999.99) return "Enter a valid discount value";
  if (coupon.discountType === "percentage" && coupon.discountValue > 100) return "Percentage discounts cannot exceed 100%";
  if (!/^[A-Z]{3,10}$/.test(coupon.currency)) return "Currency must contain 3 to 10 letters";
  if (coupon.usageLimit !== null && (!Number.isInteger(coupon.usageLimit) || coupon.usageLimit < 1 || coupon.usageLimit > 2147483647)) return "Usage limit must be a positive whole number";
  if (!Number.isInteger(coupon.perUserLimit) || coupon.perUserLimit < 1 || coupon.perUserLimit > 2147483647) return "Per-user limit must be a positive whole number";
  if (!Number.isFinite(coupon.minimumAmount) || coupon.minimumAmount < 0 || coupon.minimumAmount > 9999999999.99) return "Enter a valid minimum amount";
  if (coupon.planId !== null && (!Number.isInteger(coupon.planId) || coupon.planId < 1 || coupon.planId > 2147483647)) return "Select a valid plan";
  if (coupon.startsAt === "invalid" || coupon.expiresAt === "invalid") return "Enter valid promotion dates";
  if (coupon.startsAt && coupon.expiresAt && new Date(coupon.expiresAt) <= new Date(coupon.startsAt)) return "Expiry must be after the start date";
  if (!couponStatuses.includes(coupon.status)) return "Invalid coupon status";
  return null;
}

function mapCoupon(row) {
  const now = Date.now();
  const usedCount = Number(row.used_count || 0);
  let effectiveStatus = row.status;
  if (effectiveStatus === "active" && row.starts_at && new Date(row.starts_at).getTime() > now) effectiveStatus = "scheduled";
  if (effectiveStatus === "active" && row.expires_at && new Date(row.expires_at).getTime() <= now) effectiveStatus = "expired";
  if (effectiveStatus === "active" && row.usage_limit !== null && usedCount >= Number(row.usage_limit)) effectiveStatus = "exhausted";
  return {
    id: row.id, code: row.code, name: row.name, discountType: row.discount_type,
    discountValue: number(row.discount_value), currency: row.currency,
    usageLimit: row.usage_limit === null ? null : Number(row.usage_limit), perUserLimit: Number(row.per_user_limit),
    usedCount, remaining: row.usage_limit === null ? null : Math.max(Number(row.usage_limit) - usedCount, 0),
    minimumAmount: number(row.minimum_amount), planId: row.applicable_plan_id || null,
    planName: row.plan_name || null, startsAt: row.starts_at, expiresAt: row.expires_at,
    status: row.status, effectiveStatus, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

exports.listCoupons = async (req, res, next) => {
  const search = String(req.query.search || "").trim().slice(0, 100);
  const pattern = search ? `%${search}%` : null;
  try {
    const [couponsResult, redemptionsResult, plansResult, usersResult, summaryResult, discountTotalsResult] = await Promise.all([
      pool.query(`SELECT c.*, p.name plan_name, COUNT(cr.id)::int used_count
        FROM coupon_codes c LEFT JOIN plans p ON p.id=c.applicable_plan_id LEFT JOIN coupon_redemptions cr ON cr.coupon_id=c.id
        WHERE ($1::text IS NULL OR c.code ILIKE $1 OR c.name ILIKE $1 OR c.status ILIKE $1 OR COALESCE(p.name,'') ILIKE $1)
        GROUP BY c.id,p.name ORDER BY c.created_at DESC`, [pattern]),
      pool.query(`SELECT cr.*, c.code, c.name coupon_name, u.name user_name, u.email user_email, p.name plan_name
        FROM coupon_redemptions cr JOIN coupon_codes c ON c.id=cr.coupon_id LEFT JOIN users u ON u.id=cr.user_id LEFT JOIN plans p ON p.id=cr.plan_id
        WHERE ($1::text IS NULL OR c.code ILIKE $1 OR c.name ILIKE $1 OR COALESCE(u.name,'') ILIKE $1 OR COALESCE(u.email,'') ILIKE $1 OR COALESCE(p.name,'') ILIKE $1)
        ORDER BY cr.redeemed_at DESC`, [pattern]),
      pool.query("SELECT id,name,price,billing_interval FROM plans WHERE status='active' ORDER BY name"),
      pool.query(`SELECT u.id,u.name,u.email FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE COALESCE(r.name,'user')<>'super_admin' AND u.status='active' ORDER BY u.name,u.email`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE c.status='active' AND (c.starts_at IS NULL OR c.starts_at<=NOW()) AND (c.expires_at IS NULL OR c.expires_at>NOW()) AND (c.usage_limit IS NULL OR COALESCE(r.used,0)<c.usage_limit))::int active_coupons,
        COUNT(*) FILTER (WHERE c.status='active' AND c.expires_at>NOW() AND c.expires_at<=NOW()+INTERVAL '7 days')::int ending_soon,
        (SELECT COUNT(*) FROM coupon_redemptions)::int total_redemptions
        FROM coupon_codes c LEFT JOIN (SELECT coupon_id,COUNT(*)::int used FROM coupon_redemptions GROUP BY coupon_id) r ON r.coupon_id=c.id`),
      pool.query(`SELECT currency,COALESCE(SUM(discount_amount),0) amount FROM coupon_redemptions WHERE redeemed_at>=DATE_TRUNC('month',CURRENT_DATE) GROUP BY currency ORDER BY currency`),
    ]);
    res.json({ coupons: couponsResult.rows.map(mapCoupon), redemptions: redemptionsResult.rows.map((row) => ({
      id: row.id, couponId: row.coupon_id, coupon: { code: row.code, name: row.coupon_name },
      user: row.user_id ? { id: row.user_id, name: row.user_name, email: row.user_email } : null,
      planId: row.plan_id || null, planName: row.plan_name || null, originalAmount: number(row.original_amount),
      discountAmount: number(row.discount_amount), finalAmount: number(row.final_amount), currency: row.currency, redeemedAt: row.redeemed_at,
    })), plans: plansResult.rows, users: usersResult.rows, summary: { ...(summaryResult.rows[0] || { active_coupons: 0, ending_soon: 0, total_redemptions: 0 }), discountsByCurrency: discountTotalsResult.rows.map((row) => ({ currency: row.currency, amount: number(row.amount) })) } });
  } catch (error) { next(error); }
};

async function saveCoupon(req, res, next, couponId) {
  const coupon = normalizeCouponPayload(req.body);
  const validation = couponValidationMessage(coupon);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    if (coupon.planId) {
      const plan = await client.query("SELECT id FROM plans WHERE id=$1", [coupon.planId]);
      if (!plan.rowCount) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected plan was not found" }); }
    }
    const values = [coupon.code,coupon.name,coupon.discountType,coupon.discountValue,coupon.currency,coupon.usageLimit,coupon.perUserLimit,coupon.minimumAmount,coupon.planId,coupon.startsAt,coupon.expiresAt,coupon.status];
    const result = couponId
      ? await client.query(`UPDATE coupon_codes SET code=$1,name=$2,discount_type=$3,discount_value=$4,currency=$5,usage_limit=$6,per_user_limit=$7,minimum_amount=$8,applicable_plan_id=$9,starts_at=$10,expires_at=$11,status=$12,updated_at=NOW() WHERE id=$13 RETURNING id,code,status`, [...values,couponId])
      : await client.query(`INSERT INTO coupon_codes(code,name,discount_type,discount_value,currency,usage_limit,per_user_limit,minimum_amount,applicable_plan_id,starts_at,expires_at,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id,code,status`, [...values,req.user.id]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Coupon not found" }); }
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,'coupon',$3,$4::jsonb)`, [req.user.id,couponId?"coupon.updated":"coupon.created",result.rows[0].id,JSON.stringify({ code: coupon.code, status: coupon.status })]);
    await client.query("COMMIT"); res.status(couponId ? 200 : 201).json({ coupon: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "That coupon code already exists" });
    next(error);
  } finally { if (client) client.release(); }
}

exports.createCoupon = (req,res,next) => saveCoupon(req,res,next,null);
exports.updateCoupon = (req,res,next) => { const id=positiveIntegerParam(req); if(!id)return res.status(400).json({message:"Invalid coupon ID"}); return saveCoupon(req,res,next,id); };
exports.deleteCoupon = async (req,res,next) => {
  const id=positiveIntegerParam(req); if(!id)return res.status(400).json({message:"Invalid coupon ID"});
  let client; try { client=await pool.connect(); await client.query("BEGIN");
    const used=await client.query("SELECT COUNT(*)::int count FROM coupon_redemptions WHERE coupon_id=$1",[id]);
    if(used.rows[0].count){await client.query("ROLLBACK");return res.status(409).json({message:"This coupon has redemptions. Deactivate it to preserve the promotion history."});}
    const result=await client.query("DELETE FROM coupon_codes WHERE id=$1 RETURNING id,code",[id]);
    if(!result.rowCount){await client.query("ROLLBACK");return res.status(404).json({message:"Coupon not found"});}
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,'coupon.deleted','coupon',$2,$3::jsonb)`,[req.user.id,id,JSON.stringify(result.rows[0])]);
    await client.query("COMMIT");res.json({message:"Coupon deleted successfully"});
  }catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}
};

exports.createCouponRedemption = async (req,res,next) => {
  const couponId=Number(req.body.couponId), userId=Number(req.body.userId), planId=req.body.planId?Number(req.body.planId):null, originalAmount=Number(req.body.originalAmount);
  if(!Number.isInteger(couponId)||couponId<1||couponId>2147483647||!Number.isInteger(userId)||userId<1||userId>2147483647)return res.status(400).json({message:"Select a valid coupon and user"});
  if(planId!==null&&(!Number.isInteger(planId)||planId<1||planId>2147483647))return res.status(400).json({message:"Select a valid plan"});
  if(!Number.isFinite(originalAmount)||originalAmount<0.01||originalAmount>9999999999.99)return res.status(400).json({message:"Enter a valid original amount"});
  let client; try { client=await pool.connect();await client.query("BEGIN");
    const couponResult=await client.query(`SELECT c.*,(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=c.id)::int used_count,(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=c.id AND user_id=$2)::int user_count FROM coupon_codes c WHERE c.id=$1 FOR UPDATE`,[couponId,userId]);
    if(!couponResult.rowCount){await client.query("ROLLBACK");return res.status(404).json({message:"Coupon not found"});}
    const c=couponResult.rows[0], now=new Date();
    if(c.status!=="active"||(c.starts_at&&new Date(c.starts_at)>now)||(c.expires_at&&new Date(c.expires_at)<=now)){await client.query("ROLLBACK");return res.status(409).json({message:"This coupon is not currently available"});}
    if(c.usage_limit!==null&&Number(c.used_count)>=Number(c.usage_limit)){await client.query("ROLLBACK");return res.status(409).json({message:"This coupon has reached its usage limit"});}
    if(Number(c.user_count)>=Number(c.per_user_limit)){await client.query("ROLLBACK");return res.status(409).json({message:"This user has reached the coupon limit"});}
    if(c.applicable_plan_id!==null&&Number(c.applicable_plan_id)!==planId){await client.query("ROLLBACK");return res.status(409).json({message:"This coupon is restricted to another plan"});}
    if(originalAmount<Number(c.minimum_amount)){await client.query("ROLLBACK");return res.status(409).json({message:`Minimum order amount is ${c.currency} ${Number(c.minimum_amount).toFixed(2)}`});}
    const relation=await client.query(`SELECT EXISTS(SELECT 1 FROM users WHERE id=$1) user_exists,CASE WHEN $2::integer IS NULL THEN TRUE ELSE EXISTS(SELECT 1 FROM plans WHERE id=$2) END plan_exists`,[userId,planId]);
    if(!relation.rows[0].user_exists||!relation.rows[0].plan_exists){await client.query("ROLLBACK");return res.status(400).json({message:"Selected user or plan was not found"});}
    const rawDiscount=c.discount_type==="percentage"?originalAmount*Number(c.discount_value)/100:Number(c.discount_value);
    const discountAmount=Number(Math.min(rawDiscount,originalAmount).toFixed(2)), finalAmount=Number((originalAmount-discountAmount).toFixed(2));
    const result=await client.query(`INSERT INTO coupon_redemptions(coupon_id,user_id,plan_id,original_amount,discount_amount,final_amount,currency,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id`,[couponId,userId,planId,originalAmount,discountAmount,finalAmount,c.currency,JSON.stringify({recordedBy:req.user.id})]);
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,'coupon_redemption.created','coupon_redemption',$2,$3::jsonb)`,[req.user.id,result.rows[0].id,JSON.stringify({couponId,userId,discountAmount})]);
    await client.query("COMMIT");res.status(201).json({redemption:{id:result.rows[0].id,discountAmount,finalAmount}});
  }catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}
};

exports.deleteCouponRedemption = async (req,res,next) => {
  const id=positiveIntegerParam(req);if(!id)return res.status(400).json({message:"Invalid redemption ID"});
  let client;try{client=await pool.connect();await client.query("BEGIN");const result=await client.query("DELETE FROM coupon_redemptions WHERE id=$1 RETURNING id,coupon_id,user_id",[id]);if(!result.rowCount){await client.query("ROLLBACK");return res.status(404).json({message:"Redemption not found"});}await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,'coupon_redemption.deleted','coupon_redemption',$2,$3::jsonb)`,[req.user.id,id,JSON.stringify(result.rows[0])]);await client.query("COMMIT");res.json({message:"Redemption removed successfully"});}catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}
};

exports.getAnalytics = async (req, res, next) => {
  const days = Number(req.query.days || 30);
  if (![7, 30, 90, 365].includes(days)) return res.status(400).json({ message: "Analytics range must be 7, 30, 90, or 365 days" });
  try {
    const [summaryResult, previousResult, seriesResult, sourcesResult, cardsResult, platformResult] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(page_views),0)::bigint page_views,COALESCE(SUM(clicks),0)::bigint clicks,COALESCE(SUM(shares),0)::bigint shares,COALESCE(SUM(contact_requests),0)::bigint contact_requests FROM analytics WHERE event_date>=CURRENT_DATE-($1::integer-1)`,[days]),
      pool.query(`SELECT COALESCE(SUM(page_views),0)::bigint page_views,COALESCE(SUM(clicks),0)::bigint clicks,COALESCE(SUM(shares),0)::bigint shares,COALESCE(SUM(contact_requests),0)::bigint contact_requests FROM analytics WHERE event_date>=CURRENT_DATE-($1::integer*2-1) AND event_date<CURRENT_DATE-($1::integer-1)`,[days]),
      pool.query(`SELECT d.day::date date,COALESCE(SUM(a.page_views),0)::bigint page_views,COALESCE(SUM(a.clicks),0)::bigint clicks,COALESCE(SUM(a.shares),0)::bigint shares,COALESCE(SUM(a.contact_requests),0)::bigint contacts FROM GENERATE_SERIES(CURRENT_DATE-($1::integer-1),CURRENT_DATE,INTERVAL '1 day') d(day) LEFT JOIN analytics a ON a.event_date=d.day::date GROUP BY d.day ORDER BY d.day`,[days]),
      pool.query(`SELECT COALESCE(NULLIF(TRIM(source),''),'Direct') source,COUNT(*)::int count FROM contacts WHERE contacted_at>=NOW()-($1::integer*INTERVAL '1 day') GROUP BY 1 ORDER BY count DESC LIMIT 8`,[days]),
      pool.query(`SELECT bc.id,COALESCE(NULLIF(bc.title,''),'Untitled card') title,u.name owner,COALESCE(SUM(a.page_views),0)::bigint views,COALESCE(SUM(a.clicks),0)::bigint clicks,COALESCE(SUM(a.contact_requests),0)::bigint contacts FROM business_cards bc LEFT JOIN users u ON u.id=bc.user_id LEFT JOIN analytics a ON a.business_card_id=bc.id AND a.event_date>=CURRENT_DATE-($1::integer-1) GROUP BY bc.id,u.name ORDER BY views DESC,clicks DESC LIMIT 8`,[days]),
      pool.query(`SELECT (SELECT COUNT(*) FROM users WHERE created_at>=NOW()-($1::integer*INTERVAL '1 day'))::int new_users,(SELECT COUNT(*) FROM vcards WHERE created_at>=NOW()-($1::integer*INTERVAL '1 day'))::int new_vcards,(SELECT COUNT(*) FROM contacts WHERE contacted_at>=NOW()-($1::integer*INTERVAL '1 day'))::int contacts,(SELECT COUNT(*) FROM qrcodes WHERE created_at>=NOW()-($1::integer*INTERVAL '1 day'))::int qr_codes_created`,[days]),
    ]);
    const current=summaryResult.rows[0],previous=previousResult.rows[0];
    const metric=(key)=>({ value:number(current[key]), change:percentChange(current[key],previous[key]) });
    const views=number(current.page_views),clicks=number(current.clicks),contacts=number(current.contact_requests);
    res.json({ rangeDays:days,generatedAt:new Date().toISOString(),metrics:{pageViews:metric("page_views"),clicks:metric("clicks"),shares:metric("shares"),contactRequests:metric("contact_requests"),clickRate:views?Number((clicks/views*100).toFixed(1)):0,contactRate:views?Number((contacts/views*100).toFixed(1)):0},series:seriesResult.rows.map((r)=>({date:r.date,pageViews:number(r.page_views),clicks:number(r.clicks),shares:number(r.shares),contacts:number(r.contacts)})),sources:sourcesResult.rows.map((r)=>({source:r.source,count:Number(r.count)})),topCards:cardsResult.rows.map((r)=>({id:r.id,title:r.title,owner:r.owner||"Unknown user",views:number(r.views),clicks:number(r.clicks),contacts:number(r.contacts)})),platform:platformResult.rows[0]});
  } catch(error){next(error);}
};

const reportTypes=["revenue","subscriptions","platform","coupons","affiliates"];
function normalizeReportPayload(body){return{name:String(body.name||"").trim(),reportType:String(body.reportType||"").toLowerCase(),dateRangeDays:Number(body.dateRangeDays||30),status:String(body.status||"active").toLowerCase()};}
function reportValidationMessage(report){if(!report.name||report.name.length>150)return"Report name is required and must not exceed 150 characters";if(!reportTypes.includes(report.reportType))return"Select a valid report type";if(!Number.isInteger(report.dateRangeDays)||report.dateRangeDays<1||report.dateRangeDays>3650)return"Date range must be between 1 and 3,650 days";if(!["active","inactive"].includes(report.status))return"Invalid report status";return null;}
function mapSavedReport(row){return{id:row.id,name:row.name,reportType:row.report_type,dateRangeDays:Number(row.date_range_days),status:row.status,lastRunAt:row.last_run_at,runCount:Number(row.run_count||0),createdAt:row.created_at,updatedAt:row.updated_at};}

exports.listReports=async(req,res,next)=>{const search=String(req.query.search||"").trim().slice(0,100),pattern=search?`%${search}%`:null;try{const[reports,runs,summary]=await Promise.all([
  pool.query(`SELECT sr.*,COUNT(rr.id)::int run_count FROM saved_reports sr LEFT JOIN report_runs rr ON rr.report_id=sr.id WHERE ($1::text IS NULL OR sr.name ILIKE $1 OR sr.report_type ILIKE $1 OR sr.status ILIKE $1) GROUP BY sr.id ORDER BY sr.updated_at DESC`,[pattern]),
  pool.query(`SELECT rr.id,rr.report_id,rr.format,rr.status,rr.row_count,rr.generated_at,sr.name report_name,sr.report_type,u.name generated_by FROM report_runs rr JOIN saved_reports sr ON sr.id=rr.report_id LEFT JOIN users u ON u.id=rr.generated_by WHERE ($1::text IS NULL OR sr.name ILIKE $1 OR sr.report_type ILIKE $1 OR COALESCE(u.name,'') ILIKE $1) ORDER BY rr.generated_at DESC LIMIT 100`,[pattern]),
  pool.query(`SELECT (SELECT COUNT(*) FROM saved_reports)::int saved_reports,(SELECT COUNT(*) FROM saved_reports WHERE status='active')::int active_reports,(SELECT COUNT(*) FROM report_runs WHERE generated_at>=DATE_TRUNC('month',CURRENT_DATE))::int exports_this_month,(SELECT MAX(generated_at) FROM report_runs) last_export_at`)
]);res.json({reports:reports.rows.map(mapSavedReport),runs:runs.rows.map((r)=>({id:r.id,reportId:r.report_id,reportName:r.report_name,reportType:r.report_type,format:r.format,status:r.status,rowCount:Number(r.row_count),generatedBy:r.generated_by||"System",generatedAt:r.generated_at})),summary:summary.rows[0]});}catch(error){next(error);}};

async function saveReport(req,res,next,id){const report=normalizeReportPayload(req.body),validation=reportValidationMessage(report);if(validation)return res.status(400).json({message:validation});let client;try{client=await pool.connect();await client.query("BEGIN");const values=[report.name,report.reportType,report.dateRangeDays,report.status];const result=id?await client.query(`UPDATE saved_reports SET name=$1,report_type=$2,date_range_days=$3,status=$4,updated_at=NOW() WHERE id=$5 RETURNING *`,[...values,id]):await client.query(`INSERT INTO saved_reports(name,report_type,date_range_days,status,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,[...values,req.user.id]);if(!result.rowCount){await client.query("ROLLBACK");return res.status(404).json({message:"Report not found"});}await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,'saved_report',$3,$4::jsonb)`,[req.user.id,id?"report.updated":"report.created",result.rows[0].id,JSON.stringify({name:report.name,type:report.reportType})]);await client.query("COMMIT");res.status(id?200:201).json({report:mapSavedReport(result.rows[0])});}catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}}
exports.createReport=(req,res,next)=>saveReport(req,res,next,null);
exports.updateReport=(req,res,next)=>{const id=positiveIntegerParam(req);if(!id)return res.status(400).json({message:"Invalid report ID"});return saveReport(req,res,next,id);};
exports.deleteReport=async(req,res,next)=>{const id=positiveIntegerParam(req);if(!id)return res.status(400).json({message:"Invalid report ID"});try{const result=await pool.query("DELETE FROM saved_reports WHERE id=$1 RETURNING id,name",[id]);if(!result.rowCount)return res.status(404).json({message:"Report not found"});await pool.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,'report.deleted','saved_report',$2,$3::jsonb)`,[req.user.id,id,JSON.stringify(result.rows[0])]);res.json({message:"Report and its export history were deleted"});}catch(error){next(error);}};

async function generateReportRows(client,type,days){
  if(type==="revenue")return(await client.query(`SELECT created_at::date date,currency,COUNT(*)::int transactions,COALESCE(SUM(amount),0) total_amount FROM transactions WHERE created_at>=NOW()-($1::integer*INTERVAL '1 day') AND status IN ('completed','paid','approved','successful') GROUP BY created_at::date,currency ORDER BY date DESC,currency`,[days])).rows;
  if(type==="subscriptions")return(await client.query(`SELECT p.name plan,p.billing_interval,COUNT(s.id)::int subscriptions,COUNT(s.id) FILTER(WHERE s.status='active')::int active,COUNT(s.id) FILTER(WHERE s.status='cancelled')::int cancelled FROM plans p LEFT JOIN subscriptions s ON s.plan_id=p.id AND s.created_at>=NOW()-($1::integer*INTERVAL '1 day') GROUP BY p.id ORDER BY active DESC`,[days])).rows;
  if(type==="platform")return(await client.query(`SELECT d.day::date date,(SELECT COUNT(*) FROM users u WHERE u.created_at::date=d.day::date)::int new_users,(SELECT COUNT(*) FROM vcards v WHERE v.created_at::date=d.day::date)::int new_vcards,COALESCE(SUM(a.page_views),0)::bigint page_views,COALESCE(SUM(a.clicks),0)::bigint clicks,COALESCE(SUM(a.contact_requests),0)::bigint contact_requests FROM GENERATE_SERIES(CURRENT_DATE-($1::integer-1),CURRENT_DATE,INTERVAL '1 day')d(day) LEFT JOIN analytics a ON a.event_date=d.day::date GROUP BY d.day ORDER BY d.day DESC`,[days])).rows;
  if(type==="coupons")return(await client.query(`SELECT c.code,c.name,c.discount_type,c.discount_value,c.currency,c.status,COUNT(cr.id)::int redemptions,COALESCE(SUM(cr.discount_amount),0) discount_granted FROM coupon_codes c LEFT JOIN coupon_redemptions cr ON cr.coupon_id=c.id AND cr.redeemed_at>=NOW()-($1::integer*INTERVAL '1 day') GROUP BY c.id ORDER BY redemptions DESC,c.code`,[days])).rows;
  return(await client.query(`SELECT u.name affiliate,u.email,ap.referral_code,ap.status,COALESCE(refs.referrals,0)::int referrals,COALESCE(refs.qualified,0)::int qualified,COALESCE(earnings.commissions,0) commissions,COALESCE(earnings.currency,'USD') currency FROM affiliate_profiles ap JOIN users u ON u.id=ap.user_id LEFT JOIN LATERAL(SELECT COUNT(*)::int referrals,COUNT(*) FILTER(WHERE status='qualified')::int qualified FROM affiliate_referrals WHERE affiliate_id=ap.id AND joined_at>=NOW()-($1::integer*INTERVAL '1 day'))refs ON TRUE LEFT JOIN LATERAL(SELECT SUM(amount) commissions,MAX(currency) currency FROM affiliate_commissions WHERE affiliate_id=ap.id AND status IN ('approved','paid') AND created_at>=NOW()-($1::integer*INTERVAL '1 day'))earnings ON TRUE ORDER BY qualified DESC`,[days])).rows;
}

exports.runReport=async(req,res,next)=>{const id=positiveIntegerParam(req);if(!id)return res.status(400).json({message:"Invalid report ID"});let client;try{client=await pool.connect();await client.query("BEGIN");const reportResult=await client.query("SELECT * FROM saved_reports WHERE id=$1 FOR UPDATE",[id]);if(!reportResult.rowCount){await client.query("ROLLBACK");return res.status(404).json({message:"Report not found"});}const report=reportResult.rows[0];if(report.status!=="active"){await client.query("ROLLBACK");return res.status(409).json({message:"Activate this report before exporting it"});}const rows=await generateReportRows(client,report.report_type,Number(report.date_range_days));const run=await client.query(`INSERT INTO report_runs(report_id,generated_by,row_count,report_data) VALUES($1,$2,$3,$4::jsonb) RETURNING id,row_count,generated_at`,[id,req.user.id,rows.length,JSON.stringify(rows)]);await client.query("UPDATE saved_reports SET last_run_at=NOW(),updated_at=NOW() WHERE id=$1",[id]);await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,'report.generated','report_run',$2,$3::jsonb)`,[req.user.id,run.rows[0].id,JSON.stringify({reportId:id,rowCount:rows.length})]);await client.query("COMMIT");res.status(201).json({run:{id:run.rows[0].id,rowCount:rows.length,generatedAt:run.rows[0].generated_at}});}catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}};

function csvCell(value){const text=value===null||value===undefined?"":typeof value==="object"?JSON.stringify(value):String(value);return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}
exports.downloadReportRun=async(req,res,next)=>{const id=positiveIntegerParam(req);if(!id)return res.status(400).json({message:"Invalid report run ID"});try{const result=await pool.query(`SELECT rr.report_data,sr.name FROM report_runs rr JOIN saved_reports sr ON sr.id=rr.report_id WHERE rr.id=$1`,[id]);if(!result.rowCount)return res.status(404).json({message:"Report export not found"});const rows=Array.isArray(result.rows[0].report_data)?result.rows[0].report_data:[],headers=rows.length?Array.from(new Set(rows.flatMap(Object.keys))):["message"],dataRows=rows.length?rows:[{message:"No data for the selected period"}],csv=[headers.map(csvCell).join(","),...dataRows.map((row)=>headers.map((key)=>csvCell(row[key])).join(","))].join("\r\n");const filename=String(result.rows[0].name||"report").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"report";res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition",`attachment; filename="${filename}-${id}.csv"`);res.send("\uFEFF"+csv);}catch(error){next(error);}};

const platformSettingDefinitions = {
  site_name: { category:"general",description:"Application name displayed in the admin interface",defaultValue:"Sync E-Card",type:"text",maxLength:100 },
  site_email: { category:"general",description:"Support email address",defaultValue:"info@syncecard.lk",type:"email",maxLength:255 },
  default_currency: { category:"billing",description:"Default display and billing currency",defaultValue:"USD",type:"currency",maxLength:10 },
  default_timezone: { category:"general",description:"Default timezone for new accounts",defaultValue:"Asia/Colombo",type:"timezone",maxLength:80 },
  maintenance_mode: { category:"access",description:"Temporarily restrict public platform access",defaultValue:"false",type:"boolean" },
  manual_signup_review: { category:"access",description:"Require administrator approval for new accounts",defaultValue:"false",type:"boolean" },
  require_email_verification: { category:"access",description:"Require verified email addresses before access",defaultValue:"true",type:"boolean" },
  session_timeout_minutes: { category:"security",description:"Administrative session timeout in minutes",defaultValue:"120",type:"integer",min:5,max:1440 },
  admin_email_alerts: { category:"notifications",description:"Send administrators operational alerts",defaultValue:"true",type:"boolean" },
  payment_alerts: { category:"notifications",description:"Notify administrators about payment review events",defaultValue:"true",type:"boolean" },
  security_alerts: { category:"notifications",description:"Notify administrators about security events",defaultValue:"true",type:"boolean" },
};

function validatePlatformSetting(key,value){const definition=platformSettingDefinitions[key];if(!definition)return"Unknown platform setting";const text=String(value===null||value===undefined?"":value).trim();if(definition.type==="boolean"&&!['true','false'].includes(text))return`${key} must be true or false`;if(definition.type==="integer"&&(!/^\d+$/.test(text)||Number(text)<definition.min||Number(text)>definition.max))return`${key} must be between ${definition.min} and ${definition.max}`;if(definition.type==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))return"Enter a valid support email";if(definition.type==="currency"&&!/^[A-Z]{3,10}$/.test(text.toUpperCase()))return"Currency must contain 3 to 10 letters";if(!text&&!["boolean"].includes(definition.type))return`${key} cannot be empty`;if(definition.maxLength&&text.length>definition.maxLength)return`${key} is too long`;return null;}

exports.getSettings=async(req,res,next)=>{try{const keys=Object.keys(platformSettingDefinitions);const[settingsResult,rolesResult,permissionsResult,summaryResult]=await Promise.all([
  pool.query("SELECT key,value,category,description,updated_at FROM settings WHERE key=ANY($1::text[]) ORDER BY category,key",[keys]),
  pool.query(`SELECT id,name,description FROM roles ORDER BY CASE name WHEN 'super_admin' THEN 0 WHEN 'company_admin' THEN 1 ELSE 2 END,name`),
  pool.query(`SELECT r.id role_id,r.name role_name,r.description role_description,p.id permission_id,p.name permission_name,p.key permission_key,p.description permission_description,EXISTS(SELECT 1 FROM role_permissions rp WHERE rp.role_id=r.id AND rp.permission_id=p.id) granted FROM roles r CROSS JOIN permissions p ORDER BY CASE r.name WHEN 'super_admin' THEN 0 WHEN 'company_admin' THEN 1 ELSE 2 END,p.name`),
  pool.query(`SELECT (SELECT COUNT(*) FROM settings WHERE key=ANY($1::text[]))::int stored_settings,(SELECT COUNT(*) FROM roles)::int roles,(SELECT COUNT(*) FROM role_permissions)::int permission_grants,(SELECT MAX(updated_at) FROM settings WHERE key=ANY($1::text[])) last_updated`,[keys])
]);const stored=new Map(settingsResult.rows.map((row)=>[row.key,row]));const settings=keys.map((key)=>{const definition=platformSettingDefinitions[key],row=stored.get(key);return{key,value:row?row.value:definition.defaultValue,category:definition.category,description:definition.description,type:definition.type,stored:Boolean(row),updatedAt:row?row.updated_at:null};});const roleMap=new Map(rolesResult.rows.map((row)=>[row.id,{id:row.id,name:row.name,description:row.description,locked:row.name==="super_admin",permissions:[]} ]));permissionsResult.rows.forEach((row)=>{roleMap.get(row.role_id).permissions.push({id:row.permission_id,name:row.permission_name,key:row.permission_key,description:row.permission_description,granted:row.role_name==="super_admin"?true:row.granted});});res.json({settings,roles:Array.from(roleMap.values()),summary:summaryResult.rows[0]});}catch(error){next(error);}};

exports.updateSettings=async(req,res,next)=>{const input=req.body&&req.body.settings;if(!input||typeof input!=="object"||Array.isArray(input))return res.status(400).json({message:"Settings must be provided as an object"});const entries=Object.entries(input);if(!entries.length)return res.status(400).json({message:"Provide at least one setting"});if(entries.length>Object.keys(platformSettingDefinitions).length)return res.status(400).json({message:"Too many settings supplied"});for(const[key,value]of entries){const validation=validatePlatformSetting(key,value);if(validation)return res.status(400).json({message:validation});}let client;try{client=await pool.connect();await client.query("BEGIN");for(const[key,value]of entries){const definition=platformSettingDefinitions[key],normalized=definition.type==="currency"?String(value).trim().toUpperCase():String(value).trim();await client.query(`INSERT INTO settings(key,value,category,description,updated_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,category=EXCLUDED.category,description=EXCLUDED.description,updated_at=NOW()`,[key,normalized,definition.category,definition.description]);}await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,metadata,ip_address,user_agent) VALUES($1,'settings.updated','settings',$2::jsonb,$3,$4)`,[req.user.id,JSON.stringify({changedKeys:entries.map(([key])=>key)}),req.ip||null,req.get("user-agent")||null]);await client.query("COMMIT");res.json({message:"Platform settings saved successfully",updatedKeys:entries.map(([key])=>key)});}catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}};

exports.updateRolePermissions=async(req,res,next)=>{const roleId=positiveIntegerParam(req),permissionIds=req.body&&req.body.permissionIds;if(!roleId)return res.status(400).json({message:"Invalid role ID"});if(!Array.isArray(permissionIds)||permissionIds.some((id)=>!Number.isInteger(Number(id))||Number(id)<1||Number(id)>2147483647))return res.status(400).json({message:"Permission IDs must be a valid array"});const uniqueIds=Array.from(new Set(permissionIds.map(Number)));let client;try{client=await pool.connect();await client.query("BEGIN");const role=await client.query("SELECT id,name FROM roles WHERE id=$1 FOR UPDATE",[roleId]);if(!role.rowCount){await client.query("ROLLBACK");return res.status(404).json({message:"Role not found"});}if(role.rows[0].name==="super_admin"){await client.query("ROLLBACK");return res.status(409).json({message:"Super admin permissions are always enabled and cannot be changed"});}if(uniqueIds.length){const valid=await client.query("SELECT id FROM permissions WHERE id=ANY($1::integer[])",[uniqueIds]);if(valid.rowCount!==uniqueIds.length){await client.query("ROLLBACK");return res.status(400).json({message:"One or more permissions were not found"});}}await client.query("DELETE FROM role_permissions WHERE role_id=$1",[roleId]);for(const permissionId of uniqueIds)await client.query("INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2)",[roleId,permissionId]);await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata,ip_address,user_agent) VALUES($1,'role_permissions.updated','role',$2,$3::jsonb,$4,$5)`,[req.user.id,roleId,JSON.stringify({role:role.rows[0].name,permissionIds:uniqueIds}),req.ip||null,req.get("user-agent")||null]);await client.query("COMMIT");res.json({message:"Role permissions updated successfully",roleId,permissionIds:uniqueIds});}catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}};

function systemLogSeverity(action){const text=String(action||"").toLowerCase();if(/failed|error|deleted|rejected|suspended/.test(text))return"danger";if(/pending|updated|cancelled|warning/.test(text))return"warning";return"success";}
exports.listSystemLogs=async(req,res,next)=>{const search=String(req.query.search||"").trim().slice(0,100),resourceType=String(req.query.resourceType||"").trim().slice(0,100),actorId=req.query.actorId?Number(req.query.actorId):null,page=Math.max(1,Math.min(100000,Number(req.query.page)||1)),limit=Math.max(10,Math.min(100,Number(req.query.limit)||25)),from=req.query.from?new Date(req.query.from):null,to=req.query.to?new Date(req.query.to):null;if(actorId!==null&&(!Number.isInteger(actorId)||actorId<1||actorId>2147483647))return res.status(400).json({message:"Invalid actor filter"});if((from&&Number.isNaN(from.getTime()))||(to&&Number.isNaN(to.getTime())))return res.status(400).json({message:"Invalid log date filter"});const pattern=search?`%${search}%`:null,offset=(page-1)*limit,params=[pattern,resourceType||null,actorId,from?from.toISOString():null,to?to.toISOString():null];try{const[logsResult,countResult,actorsResult,typesResult,summaryResult]=await Promise.all([
  pool.query(`SELECT al.id,al.action,al.resource_type,al.resource_id,al.metadata,al.ip_address,al.user_agent,al.created_at,u.id actor_id,u.name actor_name,u.email actor_email FROM activity_logs al LEFT JOIN users u ON u.id=al.user_id WHERE($1::text IS NULL OR al.action ILIKE $1 OR COALESCE(al.resource_type,'') ILIKE $1 OR COALESCE(u.name,'') ILIKE $1 OR COALESCE(u.email,'') ILIKE $1 OR COALESCE(al.ip_address,'') ILIKE $1)AND($2::text IS NULL OR al.resource_type=$2)AND($3::integer IS NULL OR al.user_id=$3)AND($4::timestamptz IS NULL OR al.created_at>=$4)AND($5::timestamptz IS NULL OR al.created_at<$5+INTERVAL '1 day')ORDER BY al.created_at DESC LIMIT $6 OFFSET $7`,[...params,limit,offset]),
  pool.query(`SELECT COUNT(*)::int total FROM activity_logs al LEFT JOIN users u ON u.id=al.user_id WHERE($1::text IS NULL OR al.action ILIKE $1 OR COALESCE(al.resource_type,'') ILIKE $1 OR COALESCE(u.name,'') ILIKE $1 OR COALESCE(u.email,'') ILIKE $1 OR COALESCE(al.ip_address,'') ILIKE $1)AND($2::text IS NULL OR al.resource_type=$2)AND($3::integer IS NULL OR al.user_id=$3)AND($4::timestamptz IS NULL OR al.created_at>=$4)AND($5::timestamptz IS NULL OR al.created_at<$5+INTERVAL '1 day')`,params),
  pool.query(`SELECT DISTINCT u.id,u.name,u.email FROM activity_logs al JOIN users u ON u.id=al.user_id ORDER BY u.name,u.email`),
  pool.query(`SELECT DISTINCT resource_type FROM activity_logs WHERE resource_type IS NOT NULL AND resource_type<>'' ORDER BY resource_type`),
  pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE created_at>=CURRENT_DATE)::int today,COUNT(DISTINCT user_id)::int actors,COUNT(*) FILTER(WHERE action~*'failed|error|rejected|deleted')::int attention FROM activity_logs`)
]);res.json({logs:logsResult.rows.map((row)=>({id:row.id,action:row.action,resourceType:row.resource_type||null,resourceId:row.resource_id||null,metadata:row.metadata||{},ipAddress:row.ip_address||null,userAgent:row.user_agent||null,createdAt:row.created_at,severity:systemLogSeverity(row.action),actor:row.actor_id?{id:row.actor_id,name:row.actor_name,email:row.actor_email}:null})),actors:actorsResult.rows,resourceTypes:typesResult.rows.map((row)=>row.resource_type),pagination:{page,limit,total:Number(countResult.rows[0].total),pages:Math.max(1,Math.ceil(Number(countResult.rows[0].total)/limit))},summary:summaryResult.rows[0]});}catch(error){next(error);}};
