const express = require("express");
const QRCode = require("qrcode");
const crypto = require("crypto");
const pool = require("../config/database.config");
const { normalizePlanFeatures } = require("../config/vcard-features");
const { currencyName, normalizeCurrency } = require("../config/currencies");
const { BASE_CURRENCY, getRate, supportedCurrencies, convertFromLkr } = require("../services/exchange-rate.service");
const { publicVcardUrl } = require("../helpers/vcard-url");
const { sendVcardEnquiry, sendWebsiteContact } = require("../services/email.service");

const router = express.Router();

router.post("/contact", async (req, res, next) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const company = String(req.body.company || "").trim() || null;
  const subject = String(req.body.subject || "General enquiry").trim();
  const message = String(req.body.message || "").trim();
  const sourcePage = String(req.body.sourcePage || "").trim().slice(0, 255) || null;
  const website = String(req.body.website || "").trim();
  if (website) return res.status(200).json({ message: "Thank you. Your message has been received." });
  if (name.length < 2 || name.length > 150) return res.status(400).json({ message: "Enter your name" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return res.status(400).json({ message: "Enter a valid email address" });
  if (company && company.length > 255) return res.status(400).json({ message: "Company name is too long" });
  if (subject.length < 2 || subject.length > 200) return res.status(400).json({ message: "Enter a valid subject" });
  if (message.length < 10 || message.length > 5000) return res.status(400).json({ message: "Enter a message between 10 and 5,000 characters" });
  const hash = visitorHash(req);
  try {
    const recent = await pool.query(`SELECT COUNT(*)::int AS count FROM website_contact_messages
      WHERE visitor_hash=$1 AND created_at > NOW() - INTERVAL '15 minutes'`, [hash]);
    if (Number(recent.rows[0].count) >= 5) return res.status(429).json({ message: "Too many messages were submitted. Please try again later." });
    const recipientResult = await pool.query("SELECT value FROM settings WHERE key='site_email' LIMIT 1");
    const recipient = String(recipientResult.rows[0]?.value || process.env.CONTACT_EMAIL || process.env.MAIL_USER || "").trim();
    const saved = await pool.query(`INSERT INTO website_contact_messages(name,email,company,subject,message,source_page,visitor_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [name,email,company,subject,message,sourcePage,hash]);
    try {
      await sendWebsiteContact({ to:recipient,name,email,company,subject,message,sourcePage });
      await pool.query("UPDATE website_contact_messages SET delivery_status='sent',delivered_at=NOW() WHERE id=$1", [saved.rows[0].id]);
      return res.status(201).json({ message: "Thank you. Your message was sent successfully." });
    } catch (mailError) {
      await pool.query("UPDATE website_contact_messages SET delivery_status='failed',delivery_error=$1 WHERE id=$2", [String(mailError.message || "Email delivery failed").slice(0,500),saved.rows[0].id]);
      const error = new Error("Your message was saved, but email delivery is temporarily unavailable. Please contact us directly at " + (recipient || "our support address") + ".");
      error.status = 502;
      error.publicMessage = error.message;
      return next(error);
    }
  } catch (error) { next(error); }
});

function visitorHash(req) {
  const address = String(req.ip || req.socket?.remoteAddress || "");
  const agent = String(req.get("user-agent") || "").slice(0, 500);
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash("sha256").update(`${address}|${agent}|${day}`).digest("hex");
}

function vcfEscape(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function appointmentServices(content) {
  return String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((line) => {
      const parts = line.split(/\s*\|\s*/).map((part) => part.trim());
      const name = String(parts[0] || "").slice(0, 150);
      const durationMatch = parts.slice(1).join(" ").match(/\b(\d{1,3})\b/);
      if (!name) return null;
      const requested = durationMatch ? Number(durationMatch[1]) : 30;
      return { name, durationMinutes: Math.min(Math.max(requested, 15), 480) };
    })
    .filter(Boolean);
}

router.get("/plans", async (req, res, next) => {
  try {
    const currency = normalizeCurrency(req.query.currency, BASE_CURRENCY);
    const exchange = await getRate(currency);
    const result = await pool.query(`SELECT p.id,p.name,p.price,p.billing_interval,p.vcard_limit,p.nfc_limit,p.analytics_limit,p.storage_limit_mb,p.features,p.updated_at
      FROM plans p WHERE p.status='active' ORDER BY p.price,p.name`);
    res.json({ data: result.rows.map((plan) => ({
      id: plan.id, name: plan.name, price: convertFromLkr(plan.price, exchange.rate), basePrice: Number(plan.price), baseCurrency: BASE_CURRENCY, currency, billingInterval: plan.billing_interval,
      vcardLimit: Number(plan.vcard_limit), nfcLimit: Number(plan.nfc_limit), analyticsLimit: Number(plan.analytics_limit),
      storageLimitMb: Number(plan.storage_limit_mb),
      features: normalizePlanFeatures(plan.features).benefits, updatedAt: plan.updated_at,
    })), currency, exchangeRate: exchange.rate, rateDate: exchange.rateDate, ratesStale: exchange.stale });
  } catch (error) { next(error); }
});

router.get("/currencies", async (req, res, next) => {
  try {
    const codes = await supportedCurrencies();
    res.json({ data: codes.map((code) => ({ code, name: currencyName(code) })), baseCurrency: BASE_CURRENCY });
  } catch (error) { next(error); }
});

router.get("/exchange-rate", async (req, res, next) => {
  try {
    const currency = normalizeCurrency(req.query.currency);
    if (!currency) return res.status(400).json({ message: "Select a valid ISO currency" });
    const exchange = await getRate(currency);
    res.json({ baseCurrency: BASE_CURRENCY, currency, rate: exchange.rate, rateDate: exchange.rateDate, fetchedAt: exchange.fetchedAt, stale: exchange.stale });
  } catch (error) { next(error); }
});

router.get("/nfc-products", async (req, res, next) => {
  try {
    const currency = normalizeCurrency(req.query.currency, BASE_CURRENCY);
    const exchange = await getRate(currency);
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
        price: convertFromLkr(product.price, exchange.rate),
        basePrice: Number(product.price),
        currency,
        description: product.description || "",
        frontImage: product.front_image,
        backImage: product.back_image,
        category: product.category,
        updatedAt: product.updated_at,
      })), currency, baseCurrency: BASE_CURRENCY, exchangeRate: exchange.rate, rateDate: exchange.rateDate, ratesStale: exchange.stale,
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
      ORDER BY CASE WHEN COALESCE(template_json, '{}'::jsonb) @> '{"finalized":true}'::jsonb THEN 0 ELSE 1 END, id
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

router.get("/vcards/:id/qrcode", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid VCard ID" });
  try {
    const result = await pool.query("SELECT slug FROM vcards WHERE id=$1 AND is_active=TRUE", [id]);
    if (!result.rowCount) return res.status(404).json({ message: "VCard not found" });
    const destination = `${publicVcardUrl(req, result.rows[0].slug)}?source=qr`;
    const svg = await QRCode.toString(destination, { type: "svg", errorCorrectionLevel: "M", margin: 4, width: 512, color: { dark: "#111827", light: "#ffffff" } });
    res.set({
      "Cache-Control": "public, max-age=3600",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-VCard-URL": destination,
    }).type("image/svg+xml").send(svg);
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
      ORDER BY CASE WHEN COALESCE(template_json, '{}'::jsonb) @> '{"finalized":true}'::jsonb THEN 0 ELSE 1 END, id
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
      SELECT v.id,v.slug,v.title,v.qualifications,v.description,v.website_url,v.phone,v.email,v.address,v.social_links,v.settings,
             t.id AS template_id,t.name AS template_name,t.preview_url,t.template_json,
             u.name AS owner_name,u.avatar_url,c.name AS company_name,p.features AS plan_features,
             COALESCE(
               CASE WHEN jsonb_typeof(v.settings->'contactCaptureRequired')='boolean'
                 THEN (v.settings->>'contactCaptureRequired')::boolean END,
               us.contact_capture_required,TRUE
             ) AS contact_capture_required
      FROM vcards v
      LEFT JOIN vcard_templates t ON t.id=v.template_id
      LEFT JOIN users u ON u.id=v.user_id
      LEFT JOIN user_settings us ON us.user_id=v.user_id
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
      id: card.id, slug: card.slug, publicUrl: publicVcardUrl(req, card.slug), title: card.title, qualifications: card.qualifications || "", description: card.description, websiteUrl: card.website_url,
      phone: card.phone, email: card.email, address: card.address, socialLinks: card.social_links || [],
      sections: visibleSections, ownerName: card.owner_name,
      avatarUrl: card.settings?.profileImageUrl || card.avatar_url,
      coverImageUrl: card.settings?.coverImageUrl || null,
      contactCaptureRequired: card.contact_capture_required,
      enabledFeatures: Array.from(allowedFeatures),
      companyName: card.company_name, template: { id: card.template_id, name: card.template_name, previewUrl: card.preview_url || null, config: card.template_json || {} },
    } });
  } catch (error) { next(error); }
});

router.post("/vcards/:id/events", async (req, res, next) => {
  const id = Number(req.params.id);
  const eventType = String(req.body?.eventType || "").trim();
  const source = String(req.body?.source || "direct").trim().slice(0, 80);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid VCard ID" });
  if (!["qr_scan", "vcard_view", "link_click", "share"].includes(eventType)) return res.status(400).json({ message: "Invalid event type" });
  try {
    const card = await pool.query("SELECT id,user_id,title FROM vcards WHERE id=$1 AND is_active=TRUE", [id]);
    if (!card.rowCount) return res.status(404).json({ message: "VCard not found" });
    const hash = visitorHash(req);
    const result = await pool.query(
      `INSERT INTO vcard_events (vcard_id,event_type,source,visitor_hash,user_agent,referrer)
       SELECT $1::integer,$2::varchar,$3::varchar,$4::varchar,$5::text,$6::text
       WHERE NOT EXISTS (
         SELECT 1 FROM vcard_events
         WHERE vcard_id=$1 AND event_type=$2 AND visitor_hash=$4
           AND occurred_at > NOW() - ($7::integer * INTERVAL '1 second')
       )
       RETURNING id`,
      [id, eventType, source, hash, String(req.get("user-agent") || "").slice(0, 1000), String(req.get("referer") || "").slice(0, 2000), ["link_click", "share"].includes(eventType) ? 10 : 1800]
    );
    if (eventType === "qr_scan" && result.rowCount) {
      await pool.query(
        `INSERT INTO notifications(user_id,title,message,type,metadata)
         VALUES($1,'QR code scanned',$2,'qr_scan',$3::jsonb)`,
        [card.rows[0].user_id, `${card.rows[0].title || "Your VCard"} received a new QR scan.`, JSON.stringify({ vcardId: id })]
      );
    }
    res.status(result.rowCount ? 201 : 200).json({ recorded: Boolean(result.rowCount) });
  } catch (error) { next(error); }
});

router.post("/vcards/:id/contact-saves", async (req, res, next) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name || "").trim().slice(0, 150);
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 255);
  const phone = String(req.body?.phone || "").trim().slice(0, 50);
  const company = String(req.body?.company || "").trim().slice(0, 255);
  const consent = req.body?.consent === true;
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid VCard ID" });
  if (!name || (!email && !phone)) return res.status(400).json({ message: "Enter your name and an email address or phone number" });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
  if (!consent) return res.status(400).json({ message: "Consent is required before sharing your details" });
  try {
    const card = await pool.query("SELECT id,user_id,title FROM vcards WHERE id=$1 AND is_active=TRUE", [id]);
    if (!card.rowCount) return res.status(404).json({ message: "VCard not found" });
    const result = await pool.query(
      `WITH existing AS (
         SELECT id FROM contacts
         WHERE vcard_id=$1 AND contacted_at > NOW() - INTERVAL '24 hours'
           AND (($3::varchar IS NOT NULL AND LOWER(email)=LOWER($3::varchar))
             OR ($4::varchar IS NOT NULL AND phone=$4::varchar))
         ORDER BY contacted_at DESC LIMIT 1
       ), inserted AS (
         INSERT INTO contacts
           (vcard_id,name,email,phone,company,message,source,consent_at,consent_text)
         SELECT $1,$2,$3,$4,$5,'Contact details shared before downloading the card','VCard contact save',NOW(),
                 'I agree to share my submitted details with the owner of this VCard.'
         WHERE NOT EXISTS (SELECT 1 FROM existing)
         RETURNING id
       )
       SELECT id,TRUE AS created FROM inserted
       UNION ALL SELECT id,FALSE AS created FROM existing LIMIT 1`,
      [id, name, email || null, phone || null, company || null]
    );
    if (result.rows[0]?.created) {
      await pool.query(
        `INSERT INTO notifications(user_id,title,message,type,metadata)
         VALUES($1,'New contact saved',$2,'contact',$3::jsonb)`,
        [card.rows[0].user_id, `${name} saved ${card.rows[0].title || "your VCard"}.`, JSON.stringify({ vcardId: id, contactId: result.rows[0].id })]
      );
    }
    res.status(201).json({
      message: "Your details were shared. The contact is ready to save.",
      downloadUrl: `/api/public/vcards/${id}/contact.vcf?capture=${result.rows[0].id}`,
    });
  } catch (error) { next(error); }
});

router.get("/vcards/:id/contact.vcf", async (req, res, next) => {
  const id = Number(req.params.id);
  const captureId = Number(req.query.capture);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid VCard ID" });
  try {
    const result = await pool.query(
      `SELECT v.id,v.title,v.email,v.phone,v.website_url,v.address,u.name AS owner_name,c.name AS company_name,
              COALESCE(
                CASE WHEN jsonb_typeof(v.settings->'contactCaptureRequired')='boolean'
                  THEN (v.settings->>'contactCaptureRequired')::boolean END,
                us.contact_capture_required,TRUE
              ) AS contact_capture_required
       FROM vcards v
       LEFT JOIN users u ON u.id=v.user_id
       LEFT JOIN user_settings us ON us.user_id=v.user_id
       LEFT JOIN companies c ON c.id=COALESCE(v.company_id,u.company_id)
       WHERE v.id=$1 AND v.is_active=TRUE`,
      [id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "VCard not found" });
    const card = result.rows[0];
    if (card.contact_capture_required && (!Number.isInteger(captureId) || captureId < 1)) {
      return res.status(403).json({ message: "Share your contact details before downloading this VCard" });
    }
    if (card.contact_capture_required) {
      const capture = await pool.query("SELECT id FROM contacts WHERE id=$1 AND vcard_id=$2", [captureId, id]);
      if (!capture.rowCount) return res.status(403).json({ message: "Invalid contact download" });
    }
    await pool.query(
      `INSERT INTO vcard_events (vcard_id,event_type,source,visitor_hash,user_agent,referrer)
       VALUES ($1,'contact_download','public_vcard',$2,$3,$4)`,
      [id, visitorHash(req), String(req.get("user-agent") || "").slice(0, 1000), String(req.get("referer") || "").slice(0, 2000)]
    );
    const displayName = card.owner_name || card.title || "VCard contact";
    const lines = [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${vcfEscape(displayName)}`,
      `N:${vcfEscape(displayName)};;;;`,
      card.company_name ? `ORG:${vcfEscape(card.company_name)}` : "",
      card.phone ? `TEL;TYPE=CELL:${vcfEscape(card.phone)}` : "",
      card.email ? `EMAIL;TYPE=INTERNET:${vcfEscape(card.email)}` : "",
      card.website_url ? `URL:${vcfEscape(card.website_url)}` : "",
      card.address ? `ADR;TYPE=WORK:;;${vcfEscape(card.address)};;;;` : "",
      "END:VCARD",
    ].filter(Boolean);
    const filename = displayName.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "contact";
    res.set({
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.vcf"`,
      "Cache-Control": "no-store",
    }).send(lines.join("\r\n"));
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cardResult = await client.query(
      `SELECT v.id,v.title,v.user_id,u.name AS owner_name,u.email AS owner_email
       FROM vcards v
       JOIN users u ON u.id=v.user_id
       WHERE v.id=$1 AND v.is_active=TRUE
       FOR SHARE OF v,u`,
      [id]
    );
    if (!cardResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "VCard not found" });
    }
    const card = cardResult.rows[0];
    const contact = await client.query(
      `INSERT INTO contacts (vcard_id, name, email, phone, company, message, source)
       VALUES ($1,$2,$3,$4,$5,$6,'Public VCard enquiry') RETURNING id`,
      [id, name, email || null, phone || null, company || null, message]
    );
    await client.query(
      `INSERT INTO notifications(user_id,title,message,type,metadata)
       VALUES($1,'New VCard enquiry',$2,'enquiry',$3::jsonb)`,
      [card.user_id, `${name} sent an enquiry through ${card.title || "your VCard"}.`, JSON.stringify({ vcardId: id, contactId: contact.rows[0].id })]
    );
    let notificationDelivered = true;
    try {
      await sendVcardEnquiry({
        to: card.owner_email,
        ownerName: card.owner_name,
        vcardTitle: card.title,
        enquirerName: name,
        enquirerEmail: email || null,
        enquirerPhone: phone || null,
        company: company || null,
        message,
      });
    } catch (mailError) {
      notificationDelivered = false;
      console.error("VCard enquiry email notification failed:", mailError.message);
    }
    await client.query("COMMIT");
    res.status(201).json({
      message: notificationDelivered
        ? "Your enquiry has been sent successfully"
        : "Your enquiry has been received successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.post("/vcards/:id/appointments", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid VCard ID" });

  const name = String(req.body?.name || "").trim().slice(0, 150);
  const email = String(req.body?.email || "").trim().slice(0, 255);
  const phone = String(req.body?.phone || "").trim().slice(0, 50);
  const notes = String(req.body?.notes || "").trim().slice(0, 2000);
  const serviceName = String(req.body?.serviceName || "").trim().slice(0, 150);
  const appointmentType = String(req.body?.appointmentType || "").trim().toLowerCase();
  const requestedDuration = Number.parseInt(req.body?.durationMinutes, 10);
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cardResult = await client.query(
      "SELECT id,user_id,settings FROM vcards WHERE id=$1 AND is_active=TRUE FOR SHARE",
      [id]
    );
    if (!cardResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "VCard not found" });
    }
    const card = cardResult.rows[0];
    const configuredServices = appointmentServices(card.settings?.sections?.appointments);
    const selectedService = configuredServices.find((service) => service.name.toLowerCase() === serviceName.toLowerCase());
    if (configuredServices.length && !selectedService) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Choose a valid appointment service from this VCard" });
    }
    const durationMinutes = selectedService
      ? selectedService.durationMinutes
      : Number.isInteger(requestedDuration)
        ? Math.min(Math.max(requestedDuration, 15), 480)
        : 30;
    const savedServiceName = selectedService?.name || serviceName || null;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
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
        (user_id,vcard_id,name,email,phone,starts_at,ends_at,status,appointment_type,service_name,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10)
       RETURNING id,starts_at,ends_at,status,service_name`,
      [card.user_id, id, name, email || null, phone || null, startsAt.toISOString(), endsAt.toISOString(), appointmentType, savedServiceName, notes || null]
    );
    await client.query(
      `INSERT INTO notifications(user_id,title,message,type,metadata)
       VALUES($1,'New appointment request',$2,'appointment',$3::jsonb)`,
      [card.user_id, `${name} requested${savedServiceName ? ` ${savedServiceName}` : " an appointment"}.`, JSON.stringify({ vcardId: id, appointmentId: result.rows[0].id, serviceName: savedServiceName })]
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
