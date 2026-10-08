const { number } = require('../../helpers/metrics.helper');
const pool = require('../../config/database.config');
const bcrypt = require('bcrypt');
const { normalizeCurrency } = require('../../config/currencies');
const { currentSubscription } = require('../../services/subscription-policy');
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
    preferredCurrency: normalizeCurrency(user.preferred_currency, "LKR"),
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
      `SELECT u.id, u.name, u.email, u.phone, u.status, u.preferred_currency, u.created_at, u.last_login,
              r.name AS role, c.name AS company_name,
              COALESCE(p.name, 'Free') AS plan_name,
              (SELECT COUNT(*) FROM vcards v WHERE v.user_id = u.id) AS card_count
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       LEFT JOIN LATERAL (
         SELECT s.plan_id
         FROM subscriptions s
         WHERE s.user_id = u.id AND ${currentSubscription()}
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
    const { firstName, lastName, email, password, phoneNumber, status, preferredCurrency } = req.body;
    const normalizedFirstName = String(firstName || "").trim();
    const normalizedLastName = String(lastName || "").trim();
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalizedPhone = phoneNumber ? String(phoneNumber).trim() : null;
    const normalizedStatus = String(status || "active").toLowerCase();
    const normalizedCurrency = String(preferredCurrency || "LKR").toUpperCase();
    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail || !password) {
      return res.status(400).json({ message: "First name, last name, email, and password are required" });
    }
    if (String(password).length < 12) {
      return res.status(400).json({ message: "Password must contain at least 12 characters" });
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
    if (!normalizeCurrency(normalizedCurrency)) {
      return res.status(400).json({ message: "Select a valid ISO 4217 currency" });
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
      `INSERT INTO users (role_id, name, email, password, phone, status, preferred_currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, phone, status, preferred_currency, created_at, last_login`,
      [
        roleResult.rows[0].id,
        `${normalizedFirstName} ${normalizedLastName}`,
        normalizedEmail,
        hashedPassword,
        normalizedPhone,
        normalizedStatus,
        normalizedCurrency,
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
    const { firstName, lastName, email, password, phoneNumber, status, preferredCurrency } = req.body;
    const normalizedFirstName = String(firstName || "").trim();
    const normalizedLastName = String(lastName || "").trim();
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalizedPhone = phoneNumber ? String(phoneNumber).trim() : null;
    const normalizedStatus = String(status || "active").toLowerCase();
    const normalizedCurrency = String(preferredCurrency || "LKR").toUpperCase();

    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail) {
      return res.status(400).json({ message: "First name, last name, and email are required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (!manageableStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid user status" });
    }
    if (!normalizeCurrency(normalizedCurrency)) {
      return res.status(400).json({ message: "Select a valid ISO 4217 currency" });
    }
    if (`${normalizedFirstName} ${normalizedLastName}`.length > 150 || normalizedEmail.length > 255 || (normalizedPhone && normalizedPhone.length > 50)) {
      return res.status(400).json({ message: "User name, email, or phone number is too long" });
    }
    if (password && (String(password).length < 12 || Buffer.byteLength(String(password), "utf8") > 72)) {
      return res.status(400).json({ message: "New password must contain at least 12 characters and no more than 72 bytes" });
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
      normalizedCurrency,
    ];
    let passwordUpdate = "";
    if (password) {
      values.push(await bcrypt.hash(String(password), 10));
      passwordUpdate = `, password = $${values.length}, auth_version = auth_version + 1`;
    }
    values.push(userId);

    const updatedResult = await client.query(
      `UPDATE users
       SET name = $1, email = $2, phone = $3, status = $4, preferred_currency = $5${passwordUpdate}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, name, email, phone, status, preferred_currency, created_at, last_login`,
      values
    );
    const user = updatedResult.rows[0];
    if (password || normalizedStatus !== "active") {
      await client.query("UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL",[userId]);
      await client.query("DELETE FROM password_reset_tokens WHERE user_id=$1",[userId]);
    }
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
       SET status = $1, auth_version = auth_version + 1, updated_at = NOW()
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

