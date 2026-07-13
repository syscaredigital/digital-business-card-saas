const jwt = require("jsonwebtoken");
const pool = require("../config/database.config");

module.exports = async function authenticate(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = jwt.verify(
      match[1],
      process.env.JWT_SECRET || "devsecret"
    );
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
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired session" });
    }
    next(error);
  }
};
