const pool = require("../../config/database.config");
function number(value) { return Number(value || 0); }

exports.markNotificationsRead = async (req, res, next) => {
  try {
    const result = await pool.query(
      "UPDATE notifications SET is_read=TRUE,updated_at=NOW() WHERE user_id=$1 AND is_read=FALSE",
      [req.user.id]
    );
    res.json({ message: "Notifications marked as read", updated: result.rowCount });
  } catch (error) { next(error); }
};

exports.notifications = async (req, res, next) => {
  try {
    const [preferences, list, count] = await Promise.all([
      pool.query("SELECT browser_notifications FROM user_settings WHERE user_id=$1", [req.user.id]),
      pool.query(
        `SELECT id,title,message,type,is_read,created_at
         FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
        [req.user.id]
      ),
      pool.query(
        "SELECT COUNT(id)::int AS total FROM notifications WHERE user_id=$1 AND is_read=FALSE",
        [req.user.id]
      ),
    ]);
    const enabled = preferences.rows[0]?.browser_notifications !== false;
    res.json({
      enabled,
      unreadCount: enabled ? number(count.rows[0]?.total) : 0,
      notifications: enabled ? list.rows : [],
    });
  } catch (error) { next(error); }
};

exports.markNotificationRead = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid notification ID" });
  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read=TRUE,updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING id,is_read`,
      [id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Notification not found" });
    res.json({ notification: result.rows[0] });
  } catch (error) { next(error); }
};

