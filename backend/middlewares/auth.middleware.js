const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/database.config");
const { signingSecret } = require('../config/environment');

module.exports = async function authenticate(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const cookieToken = require('../helpers/browser-session').readToken(req);
    if (!match && !cookieToken) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const rawToken = match ? match[1] : cookieToken;
    const payload = jwt.verify(
      rawToken,
      signingSecret(), { algorithms: ['HS256'] }
    );
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const parsedId = Number(payload.id);
    const hasPostgresIntegerId =
      Number.isSafeInteger(parsedId) && parsedId > 0 && parsedId <= 2147483647;
    let result;

    if (!hasPostgresIntegerId || !Number.isInteger(payload.version) || !payload.exp || !payload.jti) {
      return res.status(401).json({ message: "Please sign in again" });
    }
    const session = await pool.query(
      `SELECT id FROM auth_sessions WHERE token_hash = $1 AND user_id = $2
       AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`, [tokenHash, parsedId]
    );
    if (!session.rowCount) return res.status(401).json({ message: "Invalid or expired session" });

    if (hasPostgresIntegerId) {
      result = await pool.query(
        `SELECT u.id, u.email, u.name, u.status, u.auth_version, r.name AS role
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1
         LIMIT 1`,
        [parsedId]
      );
    }

    const user = result && result.rows[0];

    if (!user || user.status !== "active") {
      return res.status(401).json({ message: "Account is unavailable" });
    }
    if ((payload.version || 0) !== user.auth_version) {
      return res.status(401).json({ message: "Password has changed. Please sign in again." });
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
