const pool = require("../../config/database.config");

exports.orders = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.quantity, o.amount, o.currency, o.status, o.payment_status,
              o.payment_method, o.shipping_address, o.tracking_number, o.ordered_at,
              p.name AS product_name, p.front_image AS product_image, v.title AS vcard_title
       FROM nfc_orders o
       LEFT JOIN nfc_products p ON p.id = o.nfc_product_id
       LEFT JOIN vcards v ON v.id = o.vcard_id
       WHERE o.user_id = $1
       ORDER BY o.ordered_at DESC`, [req.user.id]
    );
    res.json({ orders: result.rows });
  } catch (error) { next(error); }
};

