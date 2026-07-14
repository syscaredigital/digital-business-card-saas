const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/database.config");

module.exports = async function authenticate(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const rawToken = match[1];
    const payload = jwt.verify(
      rawToken,
      process.env.JWT_SECRET || "devsecret"
    );
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const revoked = await pool.query(
      "SELECT id FROM auth_sessions WHERE token_hash = $1 AND revoked_at IS NOT NULL LIMIT 1",
      [tokenHash]
    );
    if (revoked.rowCount) {
      return res.status(401).json({ message: "Session has been signed out" });
    }
    const parsedId = Number(payload.id);
    const hasPostgresIntegerId =
      Number.isSafeInteger(parsedId) && parsedId > 0 && parsedId <= 2147483647;
    let result;

    if (hasPostgresIntegerId) {
      result = await pool.query(
        `SELECT u.id, u.email, u.name, u.status, r.name AS role
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1
         LIMIT 1`,
        [parsedId]
      );
    }

    // Tokens created before the JSON-to-PostgreSQL migration contain large
    // timestamp IDs. Their signed email safely resolves the migrated account.
    if ((!result || !result.rowCount) && payload.email) {
      result = await pool.query(
        `SELECT u.id, u.email, u.name, u.status, r.name AS role
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE LOWER(u.email) = LOWER($1)
         LIMIT 1`,
        [String(payload.email).trim()]
      );
    }

    const user = result && result.rows[0];

    if (!user || user.status !== "active") {
      return res.status(401).json({ message: "Account is unavailable" });
    }

    req.user = user;
    req.authToken = rawToken;
    req.authTokenHash = tokenHash;
    req.authPayload = payload;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired session" });
    }
    next(error);
  }
};
