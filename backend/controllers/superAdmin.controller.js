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
