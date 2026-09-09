const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/database.config");
const mail = require("../services/email.service");

const accepted = { message: "If an active account exists for this email, you will receive a password reset link." };
const invalid = { message: "This reset link is invalid or expired. Please request a new one." };
const hash = value => crypto.createHash("sha256").update(value).digest("hex");

exports.forgotPassword = async (req, res, next) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  // Never build a recovery link from the untrusted request Host header.
  let url;
  try {
    url = new URL("/pages/auth/reset-password.html", process.env.PUBLIC_APP_URL);
    if (!process.env.MAIL_HOST || !["http:", "https:"].includes(url.protocol) ||
        (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error();
  } catch (_) {
    return res.status(503).json({ message: "Password recovery is temporarily unavailable." });
  }
  let client;
  let delivery;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const user = await client.query("SELECT id,email FROM users WHERE LOWER(email)=$1 AND status='active' FOR UPDATE", [email]);
    if (user.rowCount) {
      const token = crypto.randomBytes(32).toString("hex");
      const saved = await client.query(`INSERT INTO password_reset_tokens(user_id,token_hash,expires_at)
        VALUES($1,$2,NOW()+INTERVAL '30 minutes')
        ON CONFLICT(user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,
          expires_at=EXCLUDED.expires_at,created_at=NOW()
        WHERE password_reset_tokens.created_at < NOW()-INTERVAL '1 minute'
        RETURNING user_id`, [user.rows[0].id, hash(token)]);
      if (saved.rowCount) {
        url.hash = new URLSearchParams({ token }).toString();
        delivery = { to: user.rows[0].email, resetUrl: url.href, tokenHash: hash(token) };
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return next(error);
  } finally { if (client) client.release(); }
  if (delivery) {
    try { await mail.sendPasswordReset(delivery); }
    catch (_) {
      // Keep the public response identical for known and unknown accounts.
      console.error("Password recovery email delivery failed");
      await pool.query("DELETE FROM password_reset_tokens WHERE token_hash=$1", [delivery.tokenHash]).catch(() => {});
    }
  }
  return res.json(accepted);
};

exports.resetPassword = async (req, res, next) => {
  const { token, password } = req.body || {};
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json(invalid);
  if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ message: "Use at least 12 characters and no more than 72 bytes for your password." });
  }
  let client;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    client = await pool.connect();
    await client.query("BEGIN");
    const user = await client.query(`SELECT u.id FROM users u JOIN password_reset_tokens t ON t.user_id=u.id
      WHERE t.token_hash=$1 AND t.expires_at>NOW() AND u.status='active' FOR UPDATE OF u`, [hash(token)]);
    // Consume atomically after taking the user lock, including concurrent resets.
    const consumed = user.rowCount && await client.query(
      "DELETE FROM password_reset_tokens WHERE user_id=$1 AND token_hash=$2 AND expires_at>NOW() RETURNING user_id",
      [user.rows[0].id, hash(token)]);
    if (!consumed || !consumed.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json(invalid);
    }
    await client.query("UPDATE users SET password=$1,auth_version=auth_version+1,updated_at=NOW() WHERE id=$2", [passwordHash, user.rows[0].id]);
    await client.query("UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL", [user.rows[0].id]);
    await client.query("COMMIT");
    return res.json({ message: "Password reset successfully. Sign in with your new password." });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
};
