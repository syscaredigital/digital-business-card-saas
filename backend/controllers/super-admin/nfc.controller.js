const { number } = require('../../helpers/metrics.helper');
const pool = require("../../config/database.config");
const path = require("path");
const { captureRevenueRate } = require('../../services/revenue.service');
const { positiveIntegerParam } = require('../../validators/id.validator');
const nfcCardStatuses = ["inactive", "active", "assigned", "disabled"];
const nfcOrderStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];
const nfcOrderTransitions = {
  pending: ['processing','shipped','cancelled'],
  processing: ['shipped','cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};
const nfcPaymentStatuses = ["pending", "approved", "rejected"];

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
        SELECT p.id, p.name, p.price, p.description, p.front_image, p.back_image, p.category,
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
        `SELECT o.id,o.user_id,o.nfc_product_id,o.vcard_id,o.quantity,o.amount,o.currency,o.status,o.shipping_address,
                o.tracking_number,o.payment_method,o.payment_status,o.transaction_number,o.proof_url,o.admin_note,
                o.destination_country,o.subtotal_lkr,o.shipping_cost_lkr,o.shipping_cost,o.exchange_rate,o.exchange_rate_date,
                o.payment_reviewed_at,o.ordered_at,o.updated_at,ou.name AS user_name,ou.email AS user_email,
                p.name AS product_name,v.title AS vcard_title
         FROM nfc_orders o
         LEFT JOIN users ou ON ou.id = o.user_id
         LEFT JOIN nfc_products p ON p.id=o.nfc_product_id
         LEFT JOIN vcards v ON v.id=o.vcard_id
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
          (SELECT COALESCE(SUM(subtotal_lkr + shipping_cost_lkr), 0) FROM nfc_orders WHERE status IN ('pending', 'processing', 'shipped')) AS order_value
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
        category: product.category,
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
        currency: order.currency || "LKR",
        status: order.status,
        productName: order.product_name || "NFC card",
        vcardTitle: order.vcard_title || null,
        paymentMethod: order.payment_method || "bank_transfer",
        paymentStatus: order.payment_status || "pending",
        transactionNumber: order.transaction_number || null,
        hasProof: Boolean(order.proof_url),
        adminNote: order.admin_note || null,
        paymentReviewedAt: order.payment_reviewed_at || null,
        shippingAddress: order.shipping_address || null,
        destinationCountry: order.destination_country || "LK",
        subtotalLkr: number(order.subtotal_lkr),
        shippingCostLkr: number(order.shipping_cost_lkr),
        shippingCost: number(order.shipping_cost),
        exchangeRate: number(order.exchange_rate),
        exchangeRateDate: order.exchange_rate_date || null,
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
    const category = String(req.body.category || "").trim().toLowerCase();
    const frontImage = String(req.body.frontImage || "");
    const backImage = String(req.body.backImage || "");
    const isActive = req.body.isActive !== false;
    if (!name || name.length > 150) return res.status(400).json({ message: "Enter an NFC card name up to 150 characters" });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Enter a valid non-negative price" });
    if (description && description.length > 3000) return res.status(400).json({ message: "Description must not exceed 3000 characters" });
    if (!["essential", "signature", "prestige", "exclusive"].includes(category)) return res.status(400).json({ message: "Choose a valid NFC card category" });
    const imageError = validateNfcProductImage(frontImage, "Front image") || validateNfcProductImage(backImage, "Back image");
    if (imageError) return res.status(400).json({ message: imageError });

    const result = await pool.query(
      `INSERT INTO nfc_products (name, price, description, front_image, back_image, category, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, price, category, is_active`,
      [name, price, description, frontImage, backImage, category, isActive]
    );
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_product.created', 'nfc_product', $2, $3::jsonb, $4, $5)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ name, price, category }), req.ip || null, req.get("user-agent") || null]
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
    const category = String(req.body.category || "").trim().toLowerCase();
    const frontImage = req.body.frontImage ? String(req.body.frontImage) : existing.rows[0].front_image;
    const backImage = req.body.backImage ? String(req.body.backImage) : existing.rows[0].back_image;
    const isActive = req.body.isActive !== false;
    if (!name || name.length > 150) return res.status(400).json({ message: "Enter an NFC card name up to 150 characters" });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Enter a valid non-negative price" });
    if (description && description.length > 3000) return res.status(400).json({ message: "Description must not exceed 3000 characters" });
    if (!["essential", "signature", "prestige", "exclusive"].includes(category)) return res.status(400).json({ message: "Choose a valid NFC card category" });
    const imageError = validateNfcProductImage(frontImage, "Front image") || validateNfcProductImage(backImage, "Back image");
    if (imageError) return res.status(400).json({ message: imageError });

    const result = await pool.query(
      `UPDATE nfc_products SET name = $1, price = $2, description = $3, front_image = $4,
       back_image = $5, category = $6, is_active = $7, updated_at = NOW() WHERE id = $8
       RETURNING id, name, price, category, is_active`,
      [name, price, description, frontImage, backImage, category, isActive, productId]
    );
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_product.updated', 'nfc_product', $2, $3::jsonb, $4, $5)`,
      [req.user.id, productId, JSON.stringify({ name, price, category, isActive }), req.ip || null, req.get("user-agent") || null]
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
  const hasStatus = Object.prototype.hasOwnProperty.call(req.body, "status");
  const hasPaymentStatus = Object.prototype.hasOwnProperty.call(req.body, "paymentStatus");
  const hasTrackingNumber = Object.prototype.hasOwnProperty.call(req.body, "trackingNumber");
  const hasAdminNote = Object.prototype.hasOwnProperty.call(req.body, "adminNote");
  const requestedStatus = hasStatus ? String(req.body.status || "").trim().toLowerCase() : null;
  const requestedPaymentStatus = hasPaymentStatus ? String(req.body.paymentStatus || "").trim().toLowerCase() : null;
  const requestedTrackingNumber = hasTrackingNumber ? (String(req.body.trackingNumber || "").trim() || null) : undefined;
  const requestedAdminNote = hasAdminNote ? (String(req.body.adminNote || "").trim() || null) : undefined;
  if (!orderId) return res.status(400).json({ message: "Invalid NFC order ID" });
  if (!hasStatus && !hasPaymentStatus && !hasTrackingNumber && !hasAdminNote) return res.status(400).json({ message: "No NFC order changes were provided" });
  if (hasStatus && !nfcOrderStatuses.includes(requestedStatus)) return res.status(400).json({ message: "Invalid NFC order status" });
  if (hasPaymentStatus && !nfcPaymentStatuses.includes(requestedPaymentStatus)) return res.status(400).json({ message: "Invalid NFC payment status" });
  if (requestedTrackingNumber && requestedTrackingNumber.length > 255) return res.status(400).json({ message: "Tracking number is too long" });
  if (requestedAdminNote && requestedAdminNote.length > 3000) return res.status(400).json({ message: "Admin note is too long" });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const existingResult = await client.query(`SELECT id,user_id,amount,currency,status,payment_status,transaction_number,
      tracking_number,admin_note
      FROM nfc_orders WHERE id=$1 FOR UPDATE`, [orderId]);
    if (!existingResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "NFC order not found" });
    }
    const existing = existingResult.rows[0];
    const paymentStatus = requestedPaymentStatus || existing.payment_status || "pending";
    if (paymentStatus !== existing.payment_status && existing.payment_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({message:'Reviewed NFC payments are final. Record corrections separately.'});
    }
    if (requestedStatus && requestedStatus !== existing.status && !(nfcOrderTransitions[existing.status] || []).includes(requestedStatus)) {
      await client.query('ROLLBACK');
      return res.status(409).json({message:`A ${existing.status} NFC order cannot move to ${requestedStatus}`});
    }
    if (existing.status === 'cancelled' && paymentStatus !== existing.payment_status) {
      await client.query('ROLLBACK');
      return res.status(409).json({message:'Cancelled NFC orders cannot accept payment approval'});
    }
    await captureRevenueRate(client, 'nfc', orderId);
    let status = requestedStatus || existing.status;
    let trackingNumber = hasTrackingNumber ? requestedTrackingNumber : existing.tracking_number;
    const adminNote = hasAdminNote ? requestedAdminNote : existing.admin_note;
    if (requestedPaymentStatus === "approved" && ["pending","cancelled"].includes(existing.status)) status = "processing";
    if (requestedPaymentStatus === "rejected") {
      status = "cancelled";
      trackingNumber = null;
    }
    if (paymentStatus !== "approved" && ["processing","shipped","completed"].includes(status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Approve the NFC payment before fulfilment" });
    }
    if (paymentStatus !== "approved" && trackingNumber) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Approve the NFC payment before adding tracking" });
    }
    if (["shipped","completed"].includes(status) && !trackingNumber) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Add a tracking number before marking this order as shipped or completed" });
    }
    const result = await client.query(`UPDATE nfc_orders SET status=$1,tracking_number=$2,payment_status=$3,
      payment_reviewed_by=CASE WHEN $4::boolean THEN $5 ELSE payment_reviewed_by END,
      payment_reviewed_at=CASE WHEN $4::boolean THEN NOW() ELSE payment_reviewed_at END,
      admin_note=$6,updated_at=NOW() WHERE id=$7
      RETURNING id,status,tracking_number,payment_status,payment_reviewed_at`,
      [status,trackingNumber,paymentStatus,Boolean(requestedPaymentStatus && requestedPaymentStatus !== existing.payment_status),req.user.id,adminNote,orderId]);
    if (requestedPaymentStatus === "approved" && existing.payment_status !== 'approved') {
      await client.query(`INSERT INTO transactions(user_id,transaction_type,amount,currency,reference,gateway,status,metadata)
        SELECT $1,'nfc_order',$2,$3,$4,'manual','completed',$5::jsonb
        WHERE NOT EXISTS(SELECT 1 FROM transactions WHERE transaction_type='nfc_order' AND metadata @> $5::jsonb)
        ON CONFLICT ((metadata->>'orderId')) WHERE transaction_type='nfc_order' AND metadata ? 'orderId'
        DO UPDATE SET user_id=EXCLUDED.user_id,amount=EXCLUDED.amount,currency=EXCLUDED.currency,
          reference=EXCLUDED.reference,gateway=EXCLUDED.gateway,status='completed',updated_at=NOW()`,
        [existing.user_id,existing.amount,existing.currency || "LKR",existing.transaction_number,JSON.stringify({ orderId })]);
    }
    if (requestedPaymentStatus === "rejected") {
      await client.query(`UPDATE transactions SET status='failed',updated_at=NOW()
        WHERE transaction_type='nfc_order' AND metadata @> $1::jsonb`, [JSON.stringify({ orderId })]);
    }
    const paymentStatusChanged = Boolean(requestedPaymentStatus && requestedPaymentStatus !== existing.payment_status);
    if (paymentStatusChanged && existing.user_id) {
      await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,$2,$3,'billing')`,
        [existing.user_id,requestedPaymentStatus === "approved" ? "NFC payment approved" : "NFC payment rejected",
          requestedPaymentStatus === "approved" ? `Payment for NFC order #${orderId} was approved. Production can now begin.` : `Payment for NFC order #${orderId} was rejected.${adminNote ? " " + adminNote : ""}`]);
    }
    const fulfilmentChanged = status !== existing.status || trackingNumber !== existing.tracking_number;
    if (!paymentStatusChanged && fulfilmentChanged && existing.user_id) {
      const trackingMessage = trackingNumber ? ` Tracking number: ${trackingNumber}.` : "";
      await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,$2,$3,'order')`,
        [existing.user_id, "NFC order updated", `NFC order #${orderId} is now ${status}.${trackingMessage}`]);
    }
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'nfc_order.updated', 'nfc_order', $2, $3::jsonb, $4, $5)`,
      [req.user.id, orderId, JSON.stringify({ status, paymentStatus, trackingNumber, adminNote }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({
      order: result.rows[0],
      message: requestedPaymentStatus
        ? `NFC payment ${requestedPaymentStatus}`
        : hasTrackingNumber
          ? (trackingNumber ? "Tracking number saved" : "Tracking number removed")
          : "NFC order status updated",
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.downloadNfcOrderProof = async (req, res, next) => {
  const orderId = positiveIntegerParam(req);
  if (!orderId) return res.status(400).json({ message: "Invalid NFC order ID" });
  try {
    const result = await pool.query("SELECT proof_url FROM nfc_orders WHERE id=$1", [orderId]);
    if (!result.rowCount || !result.rows[0].proof_url) return res.status(404).json({ message: "NFC payment proof not found" });
    const proofUrl = result.rows[0].proof_url;
    if (!/^\/uploads\/payment-slips\/[A-Za-z0-9._-]+$/.test(proofUrl)) return res.status(400).json({ message: "Invalid NFC proof path" });
    const uploadRoot = path.resolve(__dirname, "..", "..", "uploads", "payment-slips");
    const filePath = path.resolve(uploadRoot, path.basename(proofUrl));
    if (!filePath.startsWith(uploadRoot + path.sep)) return res.status(400).json({ message: "Invalid NFC proof path" });
    res.download(filePath);
  } catch (error) { next(error); }
};

