const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/database.config");

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || "",
    lastName: parts.join(" "),
  };
}

function toSafeUser(row) {
  const { firstName, lastName } = splitName(row.name);
  return {
    id: row.id,
    firstName,
    lastName,
    name: row.name,
    email: row.email,
    phoneNumber: row.phone || null,
    companyName: row.company_name || null,
    role: row.role || "user",
    status: row.status,
    createdAt: row.created_at,
  };
}

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || "user", jti: crypto.randomUUID() },
    process.env.JWT_SECRET || "devsecret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function recordSession(token, userId, req) {
  const payload = jwt.decode(token) || {};
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const issuedAt = payload.iat ? new Date(payload.iat * 1000) : new Date();
  const expiresAt = payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 7 * 86400000);
  await pool.query(
    `INSERT INTO auth_sessions (user_id, token_hash, issued_at, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (token_hash) DO NOTHING`,
    [userId, tokenHash, issuedAt, expiresAt, req.ip || null, req.get("user-agent") || null]
  );
}

exports.register = async (req, res, next) => {
  const client = await pool.connect().catch(next);
  if (!client) return;

  try {
    const { firstName, lastName, email, password, phoneNumber, companyName } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [normalizedEmail]
    );
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Email already registered" });
    }

    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = 'user' LIMIT 1"
    );
    if (!roleResult.rowCount) {
      throw new Error("The user role is missing. Run the database seeds first.");
    }

    let companyId = null;
    if (companyName && String(companyName).trim()) {
      const companyResult = await client.query(
        `INSERT INTO companies (name, email)
         VALUES ($1, $2)
         RETURNING id`,
        [String(companyName).trim(), normalizedEmail]
      );
      companyId = companyResult.rows[0].id;
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const result = await client.query(
      `INSERT INTO users (company_id, role_id, name, email, password, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, status, created_at`,
      [
        companyId,
        roleResult.rows[0].id,
        fullName,
        normalizedEmail,
        hashedPassword,
        phoneNumber || null,
      ]
    );

    await client.query("COMMIT");

    const user = toSafeUser({
      ...result.rows[0],
      company_name: companyName ? String(companyName).trim() : null,
      role: "user",
    });
    res.status(201).json({ user, token: createToken(user) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      return res.status(409).json({ message: "Email already registered" });
    }
    next(err);
  } finally {
    client.release();
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.password, u.phone, u.status,
              u.created_at, r.name AS role, c.name AS company_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE LOWER(u.email) = $1
       LIMIT 1`,
      [String(email).toLowerCase().trim()]
    );
    const userRow = result.rows[0];

    if (!userRow || !(await bcrypt.compare(String(password), userRow.password || ""))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (userRow.status !== "active") {
      return res.status(403).json({ message: "Account is not active" });
    }

    await pool.query("UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1", [
      userRow.id,
    ]);

    const user = toSafeUser(userRow);
    const token = createToken(user);
    await recordSession(token, user.id, req);
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const payload = req.authPayload || {};
    const issuedAt = payload.iat ? new Date(payload.iat * 1000) : new Date();
    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : new Date();
    const session = await client.query(
      `INSERT INTO auth_sessions (user_id, token_hash, issued_at, expires_at, revoked_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)
       ON CONFLICT (token_hash) DO UPDATE SET revoked_at = COALESCE(auth_sessions.revoked_at, NOW())
       RETURNING id, revoked_at`,
      [req.user.id, req.authTokenHash, issuedAt, expiresAt, req.ip || null, req.get("user-agent") || null]
    );
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'auth.logout', 'auth_session', $2, $3::jsonb, $4, $5)`,
      [req.user.id, session.rows[0].id, JSON.stringify({ role: req.user.role }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '30 days'");
    await client.query("COMMIT");
    res.json({ message: "Signed out successfully" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};
