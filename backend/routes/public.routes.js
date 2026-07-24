const express = require("express");
const QRCode = require("qrcode");
const pool = require("../config/database.config");
const { normalizePlanFeatures } = require("../config/vcard-features");

const router = express.Router();

router.get("/plans", async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT id,name,price,billing_interval,vcard_limit,nfc_limit,analytics_limit,features,updated_at FROM plans WHERE status='active' ORDER BY price,name`);
    res.json({ data: result.rows.map((plan) => ({
      id: plan.id, name: plan.name, price: Number(plan.price), billingInterval: plan.billing_interval,
      vcardLimit: Number(plan.vcard_limit), nfcLimit: Number(plan.nfc_limit), analyticsLimit: Number(plan.analytics_limit),
      features: normalizePlanFeatures(plan.features).benefits, updatedAt: plan.updated_at,
    })) });
  } catch (error) { next(error); }
});

router.get("/nfc-products", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, name, price, description, front_image, back_image, category, updated_at
      FROM nfc_products
      WHERE is_active = TRUE
      ORDER BY
        CASE category
          WHEN 'essential' THEN 1
          WHEN 'signature' THEN 2
          WHEN 'prestige' THEN 3
          WHEN 'exclusive' THEN 4
          ELSE 5
        END,
        updated_at DESC,
        id DESC
    `);

    res.json({
      data: result.rows.map((product) => ({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        description: product.description || "",
        frontImage: product.front_image,
        backImage: product.back_image,
        category: product.category,
        updatedAt: product.updated_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/vcard-templates", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, preview_url, template_json, updated_at
      FROM vcard_templates
      WHERE is_public = TRUE
      ORDER BY CASE WHEN COALESCE(template_json, '{}'::jsonb) @> '{"industry":true}'::jsonb THEN 0 ELSE 1 END, name, id
    `);
    res.json({ data: result.rows.map((template) => ({
      id: template.id, name: template.name, description: template.description || "",
      previewUrl: template.preview_url || null, config: template.template_json || {}, updatedAt: template.updated_at,
    })) });
  } catch (error) { next(error); }
});

router.get("/qrcode", async (req, res, next) => {
  const data = String(req.query.data || "").trim();
  if (!data || data.length > 2048) return res.status(400).json({ message: "A valid QR destination is required" });
  try {
    const svg = await QRCode.toString(data, { type: "svg", margin: 1, width: 320, color: { dark: "#111827", light: "#ffffff" } });
    res.type("image/svg+xml").send(svg);
  } catch (error) { next(error); }
});

router.get("/vcards/featured", async (req, res, next) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 12) : 6;

  try {
    const result = await pool.query(`
      SELECT id, name, description, preview_url, template_json
      FROM vcard_templates
      WHERE is_public = TRUE
      ORDER BY CASE WHEN COALESCE(template_json, '{}'::jsonb) @> '{"industry":true}'::jsonb THEN 0 ELSE 1 END, name, id
      LIMIT $1
    `, [limit]);
    res.json({ data: result.rows.map((template) => ({
      id: template.id, name: template.name, title: template.name, description: template.description || "",
      preview_url: template.preview_url || null, website_url: template.preview_url || null,
      config: template.template_json || {}, source: "template",
    })) });
  } catch (error) {
    next(error);
  }
});

router.get("/vcards/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid VCard ID" });
  try {
    const result = await pool.query(`
      SELECT v.id,v.title,v.description,v.website_url,v.phone,v.email,v.address,v.social_links,v.settings,
             t.id AS template_id,t.name AS template_name,t.preview_url,t.template_json,
             u.name AS owner_name,u.avatar_url,c.name AS company_name,p.features AS plan_features
      FROM vcards v
      LEFT JOIN vcard_templates t ON t.id=v.template_id
      LEFT JOIN users u ON u.id=v.user_id
      LEFT JOIN companies c ON c.id=COALESCE(v.company_id,u.company_id)
      LEFT JOIN LATERAL (
        SELECT plans.features FROM subscriptions s JOIN plans ON plans.id=s.plan_id
        WHERE s.user_id=v.user_id AND s.status='active' ORDER BY s.created_at DESC LIMIT 1
      ) p ON TRUE
      WHERE v.id=$1 AND v.is_active=TRUE`, [id]);
    if (!result.rowCount) return res.status(404).json({ message: "VCard not found" });
    const card = result.rows[0];
    const allowedFeatures = new Set(normalizePlanFeatures(card.plan_features).vcardFeatures);
    const visibleSections = Object.fromEntries(Object.entries(card.settings?.sections || {}).filter(([key]) => allowedFeatures.has(key)));
    res.json({ vcard: {
      id: card.id, title: card.title, description: card.description, websiteUrl: card.website_url,
      phone: card.phone, email: card.email, address: card.address, socialLinks: card.social_links || [],
      sections: visibleSections, ownerName: card.owner_name, avatarUrl: card.avatar_url,
      enabledFeatures: Array.from(allowedFeatures),
      companyName: card.company_name, template: { id: card.template_id, name: card.template_name, previewUrl: card.preview_url || null, config: card.template_json || {} },
    } });
  } catch (error) { next(error); }
});

router.post("/vcards/:id/enquiries", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid VCard ID" });
  const name = String(req.body?.name || "").trim().slice(0, 150);
  const email = String(req.body?.email || "").trim().slice(0, 255);
  const phone = String(req.body?.phone || "").trim().slice(0, 50);
  const company = String(req.body?.company || "").trim().slice(0, 255);
  const message = String(req.body?.message || "").trim().slice(0, 5000);
  if (!name || (!email && !phone) || !message) return res.status(400).json({ message: "Name, message, and an email or phone number are required" });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
  try {
    const card = await pool.query("SELECT id FROM vcards WHERE id=$1 AND is_active=TRUE", [id]);
    if (!card.rowCount) return res.status(404).json({ message: "VCard not found" });
    await pool.query(
      `INSERT INTO contacts (vcard_id, name, email, phone, company, message, source)
       VALUES ($1,$2,$3,$4,$5,$6,'Public VCard enquiry')`,
      [id, name, email || null, phone || null, company || null, message]
    );
    res.status(201).json({ message: "Your enquiry has been sent successfully" });
  } catch (error) { next(error); }
});

router.post("/vcards/:id/appointments", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid VCard ID" });

  const name = String(req.body?.name || "").trim().slice(0, 150);
  const email = String(req.body?.email || "").trim().slice(0, 255);
  const phone = String(req.body?.phone || "").trim().slice(0, 50);
  const notes = String(req.body?.notes || "").trim().slice(0, 2000);
  const appointmentType = String(req.body?.appointmentType || "").trim().toLowerCase();
  const requestedDuration = Number.parseInt(req.body?.durationMinutes, 10);
  const durationMinutes = Number.isInteger(requestedDuration)
    ? Math.min(Math.max(requestedDuration, 15), 480)
    : 30;
  const startsAt = new Date(req.body?.startsAt);

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required for appointment confirmation" });
  }
  if (!["office", "online"].includes(appointmentType)) {
    return res.status(400).json({ message: "Choose either an office visit or an online meeting" });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }
  if (Number.isNaN(startsAt.getTime())) {
    return res.status(400).json({ message: "Select a valid appointment date and time" });
  }
  if (startsAt.getTime() < Date.now() + 5 * 60 * 1000) {
    return res.status(400).json({ message: "Appointments must be booked at least 5 minutes in advance" });
  }
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cardResult = await client.query(
      "SELECT id,user_id FROM vcards WHERE id=$1 AND is_active=TRUE FOR SHARE",
      [id]
    );
    if (!cardResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "VCard not found" });
    }
    const card = cardResult.rows[0];
    await client.query("SELECT pg_advisory_xact_lock($1)", [card.user_id]);
    const conflict = await client.query(
      `SELECT id FROM appointments
       WHERE user_id=$1 AND status NOT IN ('cancelled','rejected')
         AND starts_at < $3 AND COALESCE(ends_at, starts_at + INTERVAL '30 minutes') > $2
       LIMIT 1`,
      [card.user_id, startsAt.toISOString(), endsAt.toISOString()]
    );
    if (conflict.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "That time is no longer available. Please choose another time." });
    }
    const result = await client.query(
      `INSERT INTO appointments
        (user_id,vcard_id,name,email,phone,starts_at,ends_at,status,appointment_type,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9)
       RETURNING id,starts_at,ends_at,status`,
      [card.user_id, id, name, email || null, phone || null, startsAt.toISOString(), endsAt.toISOString(), appointmentType, notes || null]
    );
    await client.query("COMMIT");
    res.status(201).json({
      message: "Your appointment request has been submitted",
      appointment: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
