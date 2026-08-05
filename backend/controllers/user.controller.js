const pool = require("../config/database.config");
const bcrypt = require("bcrypt");
const fs = require("fs/promises");
const { VCARD_FEATURES, normalizePlanFeatures } = require("../config/vcard-features");
const { sendAppointmentApproved } = require("../services/email.service");
const { getStorageSummary, virtualNfcPayloadBytes } = require("../services/storage.service");
const { CURRENCY_CODES, normalizeCurrency } = require("../config/currencies");
const { BASE_CURRENCY, getRate, convertFromLkr } = require("../services/exchange-rate.service");
const { normalizeCustomSlug, publicVcardUrl } = require("../helpers/vcard-url");

function number(value) {
  return Number(value || 0);
}

async function loadVcardEntitlements(db, userId) {
  const [planResult, templateResult] = await Promise.all([
    db.query(`SELECT p.id,p.name,p.vcard_limit,p.features
      FROM subscriptions s JOIN plans p ON p.id=s.plan_id
      WHERE s.user_id=$1 AND s.status='active'
      ORDER BY s.created_at DESC LIMIT 1`, [userId]),
    db.query(`SELECT id,name,description,preview_url,template_json FROM vcard_templates WHERE is_public=TRUE ORDER BY id`),
  ]);
  const plan = planResult.rows[0] || { id: null, name: "Free", vcard_limit: 1, features: [] };
  const normalized = normalizePlanFeatures(plan.features);
  const allowedTemplateIds = new Set(normalized.templateIds);
  const templates = templateResult.rows
    .filter((template) => !allowedTemplateIds.size || allowedTemplateIds.has(Number(template.id)))
    .map((template) => ({ id: template.id, name: template.name, description: template.description || "", previewUrl: template.preview_url || null, templateJson: template.template_json || {} }));
  return {
    planId: plan.id,
    planName: plan.name || "Free",
    vcardLimit: number(plan.vcard_limit) || 1,
    features: VCARD_FEATURES.filter((feature) => normalized.vcardFeatures.includes(feature.key)),
    templates,
  };
}

function normalizeSections(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const sections = {};
  for (const [key, content] of Object.entries(value)) {
    if (!allowedKeys.has(key)) continue;
    const text = typeof content === "string" ? content.trim() : JSON.stringify(content);
    if (text && text.length <= 20000) sections[key] = text;
  }
  return sections;
}

function normalizeVcardImage(value) {
  const image = String(value || "").trim();
  if (!image) return null;
  if (image.length > 3_000_000) {
    const error = new Error("Each VCard image must be smaller than 2 MB");
    error.statusCode = 413;
    throw error;
  }
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(image)) return image;
  try {
    const parsed = new URL(image);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
  } catch (_) {}
  const error = new Error("VCard images must be PNG, JPEG, WebP, or a valid image URL");
  error.statusCode = 400;
  throw error;
}

exports.dashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [profile, subscription, cards, orders, nfc, enquiries, analytics, notifications, affiliate, userSettings] = await Promise.all([
      pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.created_at,
                c.name AS company_name
         FROM users u LEFT JOIN companies c ON c.id = u.company_id
         WHERE u.id = $1`, [userId]
      ),
      pool.query(
        `SELECT s.status, s.start_date, s.end_date, s.auto_renew,
                p.name AS plan_name, p.vcard_limit, p.nfc_limit, p.analytics_limit, p.features
         FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
         WHERE s.user_id = $1 AND s.status = 'active'
         ORDER BY s.created_at DESC LIMIT 1`, [userId]
      ),
      pool.query(
        `SELECT v.id,v.slug,v.title,v.description,v.email,v.phone,v.is_active,v.updated_at,v.template_id,
                t.name AS template_name,t.preview_url AS template_preview_url,t.template_json
         FROM vcards v LEFT JOIN vcard_templates t ON t.id=v.template_id WHERE v.user_id = $1 ORDER BY v.updated_at DESC`, [userId]
      ),
      pool.query(
        `SELECT id, quantity, amount, status, tracking_number, ordered_at
         FROM nfc_orders WHERE user_id = $1 ORDER BY ordered_at DESC LIMIT 5`, [userId]
      ),
      pool.query(
        `SELECT id, tag_identifier, serial_number, status, assigned_at
         FROM nfc_cards WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`, [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM contacts ct
         LEFT JOIN business_cards bc ON bc.id = ct.business_card_id
         LEFT JOIN vcards v ON v.id = ct.vcard_id
         WHERE COALESCE(bc.user_id, v.user_id) = $1`, [userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(a.page_views), 0)::int AS views,
                COALESCE(SUM(a.clicks), 0)::int AS clicks,
                COALESCE(SUM(a.contact_requests), 0)::int AS leads
         FROM analytics a JOIN business_cards bc ON bc.id = a.business_card_id
         WHERE bc.user_id = $1 AND a.event_date >= CURRENT_DATE - INTERVAL '30 days'`, [userId]
      ),
      pool.query(
        `SELECT id, title, message, type, is_read, created_at
         FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8`, [userId]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM affiliate_referrals ar WHERE ar.affiliate_id = ap.id) AS referrals,
           (SELECT COALESCE(SUM(ac.amount), 0) FROM affiliate_commissions ac
            WHERE ac.affiliate_id = ap.id AND ac.status IN ('pending','approved')) AS commission
         FROM affiliate_profiles ap WHERE ap.user_id = $1`, [userId]
      ),
      pool.query("SELECT browser_notifications FROM user_settings WHERE user_id=$1",[userId]),
    ]);

    const plan = subscription.rows[0] || { plan_name: "Free", status: "inactive", vcard_limit: 1, nfc_limit: 0 };
    const cardRows = cards.rows.map((card) => ({ ...card, publicUrl: publicVcardUrl(req, card.slug), public_url: publicVcardUrl(req, card.slug) }));
    const entitlements = await loadVcardEntitlements(pool, userId);
    const analyticsRow = analytics.rows[0] || {};
    const affiliateRow = affiliate.rows[0] || {};
    res.json({
      user: profile.rows[0],
      subscription: {
        name: plan.plan_name || "Free",
        status: plan.status,
        startDate: plan.start_date,
        endDate: plan.end_date,
        autoRenew: plan.auto_renew,
        vcardLimit: number(plan.vcard_limit) || 1,
        nfcLimit: number(plan.nfc_limit),
      },
      metrics: {
        activeCards: cardRows.filter((card) => card.is_active).length,
        totalCards: cardRows.length,
        enquiries: number(enquiries.rows[0]?.total),
        profileViews: number(analyticsRow.views),
        clicks: number(analyticsRow.clicks),
        leads: number(analyticsRow.leads),
        qrScans: number((await pool.query(
          `SELECT COUNT(*)::int AS total FROM vcard_events e
           JOIN vcards v ON v.id=e.vcard_id
           WHERE v.user_id=$1 AND e.event_type='qr_scan'`,
          [userId]
        )).rows[0]?.total),
        pendingOrders: orders.rows.filter((order) => order.status === "pending").length,
        nfcCards: nfc.rows.length,
        referrals: number(affiliateRow.referrals),
        commission: number(affiliateRow.commission),
      },
      vcards: cardRows,
      vcardEntitlements: entitlements,
      orders: orders.rows,
      nfcCards: nfc.rows,
      notifications: userSettings.rows[0]?.browser_notifications === false ? [] : notifications.rows,
    });
  } catch (error) {
    next(error);
  }
};

exports.enquiries = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ct.id, COALESCE(bc.title, v.title) AS vcard_name, ct.name, ct.email, ct.phone,
              ct.company, ct.message, ct.source, ct.contacted_at
       FROM contacts ct
       LEFT JOIN business_cards bc ON bc.id = ct.business_card_id
       LEFT JOIN vcards v ON v.id = ct.vcard_id
       WHERE COALESCE(bc.user_id, v.user_id) = $1
       ORDER BY ct.contacted_at DESC`, [req.user.id]
    );
    res.json({ enquiries: result.rows });
  } catch (error) { next(error); }
};

exports.contacts = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ct.id,ct.name,ct.email,ct.phone,ct.company,ct.message,ct.source,
              ct.contacted_at,ct.consent_at,v.id AS vcard_id,v.title AS vcard_name
       FROM contacts ct
       JOIN vcards v ON v.id=ct.vcard_id
       WHERE v.user_id=$1
       ORDER BY ct.contacted_at DESC`,
      [req.user.id]
    );
    res.json({
      contacts: result.rows,
      total: result.rowCount,
      savedContacts: result.rows.filter((contact) => contact.source === "VCard contact save").length,
    });
  } catch (error) { next(error); }
};

exports.vcardEngagement = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT v.id,v.slug,v.title,v.is_active,
              COUNT(DISTINCT e.id) FILTER (WHERE e.event_type='qr_scan')::int AS qr_scans,
              COUNT(DISTINCT e.id) FILTER (WHERE e.event_type='vcard_view')::int AS views,
              COUNT(DISTINCT e.id) FILTER (WHERE e.event_type='contact_download')::int AS contact_downloads,
              COUNT(DISTINCT ct.id)::int AS captured_contacts
       FROM vcards v
       LEFT JOIN vcard_events e ON e.vcard_id=v.id
       LEFT JOIN contacts ct ON ct.vcard_id=v.id
       WHERE v.user_id=$1
       GROUP BY v.id
       ORDER BY v.updated_at DESC`,
      [req.user.id]
    );
    res.json({ cards: result.rows.map((card) => ({ ...card, publicUrl: publicVcardUrl(req, card.slug) })) });
  } catch (error) { next(error); }
};

exports.appointments = async (req, res, next) => {
  const status = String(req.query.status || "").trim().toLowerCase();
  const date = String(req.query.date || "").trim();
  if (status && !["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid appointment status filter" });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Invalid appointment date filter" });
  }
  try {
    const values = [req.user.id];
    const filters = ["a.user_id = $1"];
    if (status) {
      values.push(status);
      filters.push(`a.status = $${values.length}`);
    }
    if (date) {
      values.push(date);
      filters.push(`a.starts_at >= $${values.length}::date AND a.starts_at < $${values.length}::date + INTERVAL '1 day'`);
    }
    const [result, summaryResult] = await Promise.all([
      pool.query(
      `SELECT a.id, a.vcard_id, v.title AS vcard_name, a.name, a.email, a.phone,
              a.starts_at, a.ends_at, a.status, a.appointment_type, a.notes
       FROM appointments a LEFT JOIN vcards v ON v.id = a.vcard_id
       WHERE ${filters.join(" AND ")} ORDER BY a.starts_at DESC`,
      values
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status='pending')::int AS pending,
                COUNT(*) FILTER (WHERE status='approved')::int AS approved,
                COUNT(*) FILTER (WHERE status='rejected')::int AS rejected,
                COUNT(*) FILTER (WHERE appointment_type='online')::int AS online
         FROM appointments WHERE user_id=$1`,
        [req.user.id]
      ),
    ]);
    res.json({ appointments: result.rows, summary: summaryResult.rows[0] });
  } catch (error) { next(error); }
};

exports.updateAppointmentStatus = async (req, res, next) => {
  const appointmentId = Number(req.params.id);
  const status = String(req.body?.status || "").trim().toLowerCase();
  if (!Number.isInteger(appointmentId) || appointmentId < 1) {
    return res.status(400).json({ message: "Invalid appointment ID" });
  }
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Status must be approved or rejected" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT a.id,a.name,a.email,a.starts_at,a.ends_at,a.status,a.appointment_type,
              v.title AS vcard_title,u.name AS owner_name
       FROM appointments a
       JOIN users u ON u.id=a.user_id
       LEFT JOIN vcards v ON v.id=a.vcard_id
       WHERE a.id=$1 AND a.user_id=$2
       FOR UPDATE OF a`,
      [appointmentId, req.user.id]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Appointment not found" });
    }
    const appointment = result.rows[0];
    if (appointment.status === status) {
      await client.query("COMMIT");
      return res.json({ message: `Appointment is already ${status}`, appointment });
    }
    if (appointment.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: `A ${appointment.status} appointment cannot be changed` });
    }
    if (status === "rejected") {
      const rejected = await client.query(
        `UPDATE appointments SET status='rejected',updated_at=NOW()
         WHERE id=$1 RETURNING id,status,updated_at`,
        [appointmentId]
      );
      await client.query("COMMIT");
      return res.json({ message: "Appointment rejected", appointment: rejected.rows[0] });
    }
    if (!appointment.email) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This appointment has no customer email address" });
    }

    await sendAppointmentApproved({
      to: appointment.email,
      customerName: appointment.name,
      ownerName: appointment.owner_name,
      vcardTitle: appointment.vcard_title,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      meetingMode: appointment.appointment_type,
    });
    const updated = await client.query(
      `UPDATE appointments SET status='approved',updated_at=NOW()
       WHERE id=$1 RETURNING id,status,updated_at`,
      [appointmentId]
    );
    await client.query("COMMIT");
    res.json({
      message: "Appointment approved and confirmation email sent",
      appointment: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (/email|mail|smtp|auth|login|recipient|envelope|connect|timeout/i.test(error.message || "")) {
      return res.status(502).json({ message: "The appointment was not approved because the confirmation email could not be sent" });
    }
    next(error);
  } finally {
    client.release();
  }
};

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

const supportedCurrencies = CURRENCY_CODES;

exports.accountSettings = async (req, res, next) => {
  try {
    const [accountResult,preferencesResult,subscriptionResult,sessionResult,storage] = await Promise.all([
      pool.query(`SELECT id,name,email,phone,preferred_currency,status,created_at,last_login
        FROM users WHERE id=$1`,[req.user.id]),
      pool.query(`SELECT time_format,email_notifications,browser_notifications,marketing_emails,
        contact_capture_required,updated_at FROM user_settings WHERE user_id=$1`,[req.user.id]),
      pool.query(`SELECT p.id,p.name,p.billing_interval,s.start_date,s.end_date
        FROM subscriptions s JOIN plans p ON p.id=s.plan_id
        WHERE s.user_id=$1 AND s.status='active' ORDER BY s.updated_at DESC,s.id DESC LIMIT 1`,[req.user.id]),
      pool.query(`SELECT COUNT(*)::int active_sessions,MAX(issued_at) last_session
        FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>NOW()`,[req.user.id]),
      getStorageSummary(pool,req.user.id),
    ]);
    if(!accountResult.rowCount)return res.status(404).json({message:"User account not found"});
    const account=accountResult.rows[0],preferences=preferencesResult.rows[0] || {};
    res.json({
      account:{id:account.id,name:account.name,email:account.email,phone:account.phone || "",
        currency:supportedCurrencies.includes(account.preferred_currency)?account.preferred_currency:BASE_CURRENCY,
        status:account.status,createdAt:account.created_at,lastLogin:account.last_login},
      preferences:{timeFormat:preferences.time_format || "12",
        emailNotifications:preferences.email_notifications !== false,
        browserNotifications:preferences.browser_notifications !== false,
        marketingEmails:Boolean(preferences.marketing_emails),
        contactCaptureRequired:preferences.contact_capture_required !== false},
      subscription:subscriptionResult.rows[0] || {id:storage.plan.id,name:storage.plan.name,billing_interval:"monthly"},
      security:sessionResult.rows[0] || {active_sessions:0,last_session:null},
      storage:{usedBytes:storage.usedBytes,limitBytes:storage.limitBytes,percentage:storage.percentage},
    });
  } catch(error){next(error);}
};

exports.updateAccountProfile = async (req,res,next) => {
  try {
    const name=String(req.body.name || "").trim().replace(/\s+/g," ");
    const email=String(req.body.email || "").trim().toLowerCase();
    const phone=String(req.body.phone || "").trim() || null;
    if(name.length<2 || name.length>150)return res.status(400).json({message:"Enter your full name using 2 to 150 characters"});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>255)return res.status(400).json({message:"Enter a valid email address"});
    if(phone && phone.length>50)return res.status(400).json({message:"Phone number is too long"});
    const current=await pool.query("SELECT email,password FROM users WHERE id=$1",[req.user.id]);
    if(!current.rowCount)return res.status(404).json({message:"User account not found"});
    if(email!==String(current.rows[0].email).toLowerCase()){
      const password=String(req.body.currentPassword || "");
      if(!password || !(await bcrypt.compare(password,current.rows[0].password)))return res.status(403).json({message:"Enter your current password to change your email address"});
    }
    const result=await pool.query(`UPDATE users SET name=$1,email=$2,phone=$3,updated_at=NOW()
      WHERE id=$4 RETURNING id,name,email,phone,preferred_currency,status,updated_at`,[name,email,phone,req.user.id]);
    await pool.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata,ip_address,user_agent)
      VALUES($1,'account.profile_updated','user',$1,$2::jsonb,$3,$4)`,
    [req.user.id,JSON.stringify({emailChanged:email!==String(current.rows[0].email).toLowerCase()}),req.ip || null,req.get("user-agent") || null]);
    res.json({message:"Account profile updated",account:result.rows[0]});
  } catch(error){if(error.code==="23505")return res.status(409).json({message:"That email address is already in use"});next(error);}
};

exports.updateAccountPreferences = async (req,res,next) => {
  try {
    const currency=String(req.body.currency || "").trim().toUpperCase();
    const timeFormat=String(req.body.timeFormat || "");
    if(!normalizeCurrency(currency))return res.status(400).json({message:"Select a valid ISO 4217 currency"});
    await getRate(currency);
    if(!["12","24"].includes(timeFormat))return res.status(400).json({message:"Time format must be 12 or 24 hour"});
    const fields=["emailNotifications","browserNotifications","marketingEmails","contactCaptureRequired"];
    if(fields.some((key)=>typeof req.body[key]!=="boolean"))return res.status(400).json({message:"Notification preferences must be true or false"});
    await pool.query("UPDATE users SET preferred_currency=$1,updated_at=NOW() WHERE id=$2",[currency,req.user.id]);
    const result=await pool.query(`INSERT INTO user_settings(user_id,time_format,email_notifications,browser_notifications,marketing_emails,contact_capture_required)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(user_id) DO UPDATE SET time_format=EXCLUDED.time_format,email_notifications=EXCLUDED.email_notifications,
        browser_notifications=EXCLUDED.browser_notifications,marketing_emails=EXCLUDED.marketing_emails,
        contact_capture_required=EXCLUDED.contact_capture_required,updated_at=NOW()
      RETURNING time_format,email_notifications,browser_notifications,marketing_emails,contact_capture_required,updated_at`,
    [req.user.id,timeFormat,req.body.emailNotifications,req.body.browserNotifications,req.body.marketingEmails,req.body.contactCaptureRequired]);
    await pool.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata)
      VALUES($1,'account.preferences_updated','user',$1,$2::jsonb)`,[req.user.id,JSON.stringify({currency,timeFormat})]);
    res.json({message:"Preferences saved",currency,preferences:result.rows[0]});
  } catch(error){next(error);}
};

exports.changeAccountPassword = async (req,res,next) => {
  try {
    const currentPassword=String(req.body.currentPassword || ""),newPassword=String(req.body.newPassword || "");
    if(newPassword.length<8 || newPassword.length>128 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)){
      return res.status(400).json({message:"New password must be 8 to 128 characters with uppercase, lowercase, and a number"});
    }
    if(currentPassword===newPassword)return res.status(400).json({message:"Choose a password different from your current password"});
    const current=await pool.query("SELECT password FROM users WHERE id=$1",[req.user.id]);
    if(!current.rowCount || !(await bcrypt.compare(currentPassword,current.rows[0].password)))return res.status(403).json({message:"Current password is incorrect"});
    const hash=await bcrypt.hash(newPassword,10);
    await pool.query("UPDATE users SET password=$1,updated_at=NOW() WHERE id=$2",[hash,req.user.id]);
    await pool.query(`UPDATE auth_sessions SET revoked_at=NOW()
      WHERE user_id=$1 AND token_hash<>$2 AND revoked_at IS NULL`,[req.user.id,req.authTokenHash || ""]);
    await pool.query(`INSERT INTO notifications(user_id,title,message,type)
      VALUES($1,'Password changed','Your account password was changed. Other signed-in sessions were closed.','security')`,[req.user.id]);
    await pool.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,ip_address,user_agent)
      VALUES($1,'account.password_changed','user',$1,$2,$3)`,[req.user.id,req.ip || null,req.get("user-agent") || null]);
    res.json({message:"Password changed successfully. Other sessions have been signed out."});
  } catch(error){next(error);}
};

exports.getPreferences = async (req, res, next) => {
  try {
    const result = await pool.query("SELECT preferred_currency FROM users WHERE id = $1", [req.user.id]);
    if (!result.rowCount) return res.status(404).json({ message: "User not found" });
    res.json({
      currency: supportedCurrencies.includes(result.rows[0].preferred_currency)
        ? result.rows[0].preferred_currency
        : BASE_CURRENCY,
      supportedCurrencies,
    });
  } catch (error) { next(error); }
};

exports.updatePreferences = async (req, res, next) => {
  try {
    const currency = String(req.body.currency || "").trim().toUpperCase();
    if (!normalizeCurrency(currency)) {
      return res.status(400).json({ message: "Select a valid ISO 4217 currency" });
    }
    await getRate(currency);
    const result = await pool.query(
      `UPDATE users SET preferred_currency = $1, updated_at = NOW()
       WHERE id = $2 RETURNING preferred_currency`,
      [currency, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "User not found" });
    res.json({ currency: result.rows[0].preferred_currency, message: "Currency preference saved" });
  } catch (error) { next(error); }
};

function validateVirtualNfcImage(value, label, required) {
  if (!value) return required ? `${label} is required` : null;
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\r\n]+$/i.test(value)) return `${label} must be a PNG, JPG, or WebP image`;
  if (value.length > 2100000) return `${label} must be smaller than 1.5 MB`;
  return null;
}

function virtualNfcDesignJson(row) {
  return {
    id:row.id,vcardId:row.vcard_id,name:row.name,frontImage:row.front_image,backImage:row.back_image,
    logoImage:row.logo_image || "",details:row.details || {},createdAt:row.created_at,updatedAt:row.updated_at,
  };
}

function readVirtualNfcDesignBody(body) {
  const details = body.details && typeof body.details === "object" && !Array.isArray(body.details) ? body.details : {};
  return {
    name:String(body.name || "").trim(),vcardId:body.vcardId ? Number(body.vcardId) : null,
    frontImage:String(body.frontImage || ""),backImage:String(body.backImage || ""),logoImage:String(body.logoImage || ""),
    details:{
      name:String(details.name || "").trim().slice(0,80),role:String(details.role || "").trim().slice(0,100),
      phone:String(details.phone || "").trim().slice(0,50),email:String(details.email || "").trim().slice(0,120),
      website:String(details.website || "").trim().slice(0,160),address:String(details.address || "").trim().slice(0,160),
      textColor:/^#[0-9a-f]{6}$/i.test(String(details.textColor || "")) ? String(details.textColor) : "#ffffff",
      position:["top-left","top-center","top-right","middle-left","middle-center","middle-right",
        "bottom-left","bottom-center","bottom-right"].includes(String(details.position))
        ? String(details.position) : "bottom-left",
    },
  };
}

exports.listVirtualNfcDesigns = async (req, res, next) => {
  try {
    const [designs,vcards] = await Promise.all([
      pool.query(`SELECT id,vcard_id,name,front_image,back_image,logo_image,details,created_at,updated_at
        FROM virtual_nfc_designs WHERE user_id=$1 ORDER BY updated_at DESC,id DESC`,[req.user.id]),
      pool.query(`SELECT id,title,description,website_url,phone,email,address
        FROM vcards WHERE user_id=$1 AND is_active=TRUE ORDER BY title,id`,[req.user.id]),
    ]);
    res.json({
      designs:designs.rows.map(virtualNfcDesignJson),
      vcards:vcards.rows.map((item)=>({id:item.id,title:item.title || `VCard #${item.id}`,role:item.description || "",
        phone:item.phone || "",email:item.email || "",websiteUrl:item.website_url || "",address:item.address || ""})),
    });
  } catch (error) { next(error); }
};

exports.storage = async (req, res, next) => {
  try {
    res.json(await getStorageSummary(pool,req.user.id));
  } catch (error) { next(error); }
};

exports.createVirtualNfcDesign = async (req, res, next) => {
  try {
    const input=readVirtualNfcDesignBody(req.body || {});
    if(!input.name || input.name.length>120)return res.status(400).json({message:"Enter a design name up to 120 characters"});
    const imageError=validateVirtualNfcImage(input.frontImage,"Front background",true)
      ||validateVirtualNfcImage(input.backImage,"Back background",true)||validateVirtualNfcImage(input.logoImage,"Logo",false);
    if(imageError)return res.status(400).json({message:imageError});
    if(input.vcardId){
      const owned=await pool.query("SELECT id FROM vcards WHERE id=$1 AND user_id=$2",[input.vcardId,req.user.id]);
      if(!owned.rowCount)return res.status(400).json({message:"Select one of your own VCards"});
    }
    const storage=await getStorageSummary(pool,req.user.id);
    if(storage.usedBytes+virtualNfcPayloadBytes(input)>storage.limitBytes){
      return res.status(413).json({message:`Your ${storage.plan.name} plan storage limit has been reached. Delete saved previews or upgrade your plan.`});
    }
    const result=await pool.query(`INSERT INTO virtual_nfc_designs(user_id,vcard_id,name,front_image,back_image,logo_image,details)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)
      RETURNING id,vcard_id,name,front_image,back_image,logo_image,details,created_at,updated_at`,
    [req.user.id,input.vcardId,input.name,input.frontImage,input.backImage,input.logoImage || null,JSON.stringify(input.details)]);
    res.status(201).json({message:"Virtual NFC preview saved",design:virtualNfcDesignJson(result.rows[0])});
  } catch (error) { next(error); }
};

exports.updateVirtualNfcDesign = async (req, res, next) => {
  try {
    const designId=Number(req.params.id),input=readVirtualNfcDesignBody(req.body || {});
    if(!Number.isInteger(designId)||designId<1)return res.status(400).json({message:"Invalid preview design"});
    if(!input.name || input.name.length>120)return res.status(400).json({message:"Enter a design name up to 120 characters"});
    const imageError=validateVirtualNfcImage(input.frontImage,"Front background",true)
      ||validateVirtualNfcImage(input.backImage,"Back background",true)||validateVirtualNfcImage(input.logoImage,"Logo",false);
    if(imageError)return res.status(400).json({message:imageError});
    if(input.vcardId){
      const owned=await pool.query("SELECT id FROM vcards WHERE id=$1 AND user_id=$2",[input.vcardId,req.user.id]);
      if(!owned.rowCount)return res.status(400).json({message:"Select one of your own VCards"});
    }
    const existing=await pool.query(`SELECT name,front_image,back_image,logo_image,details
      FROM virtual_nfc_designs WHERE id=$1 AND user_id=$2`,[designId,req.user.id]);
    if(!existing.rowCount)return res.status(404).json({message:"Virtual NFC preview not found"});
    const current=existing.rows[0];
    const currentBytes=virtualNfcPayloadBytes({name:current.name,frontImage:current.front_image,
      backImage:current.back_image,logoImage:current.logo_image,details:current.details});
    const storage=await getStorageSummary(pool,req.user.id);
    if(storage.usedBytes-currentBytes+virtualNfcPayloadBytes(input)>storage.limitBytes){
      return res.status(413).json({message:`Your ${storage.plan.name} plan storage limit has been reached. Reduce image sizes, delete saved previews, or upgrade your plan.`});
    }
    const result=await pool.query(`UPDATE virtual_nfc_designs SET vcard_id=$1,name=$2,front_image=$3,back_image=$4,
      logo_image=$5,details=$6::jsonb,updated_at=NOW() WHERE id=$7 AND user_id=$8
      RETURNING id,vcard_id,name,front_image,back_image,logo_image,details,created_at,updated_at`,
    [input.vcardId,input.name,input.frontImage,input.backImage,input.logoImage || null,JSON.stringify(input.details),designId,req.user.id]);
    if(!result.rowCount)return res.status(404).json({message:"Virtual NFC preview not found"});
    res.json({message:"Virtual NFC preview updated",design:virtualNfcDesignJson(result.rows[0])});
  } catch (error) { next(error); }
};

exports.deleteVirtualNfcDesign = async (req, res, next) => {
  try {
    const designId=Number(req.params.id);
    if(!Number.isInteger(designId)||designId<1)return res.status(400).json({message:"Invalid preview design"});
    const result=await pool.query("DELETE FROM virtual_nfc_designs WHERE id=$1 AND user_id=$2 RETURNING id",[designId,req.user.id]);
    if(!result.rowCount)return res.status(404).json({message:"Virtual NFC preview not found"});
    res.json({message:"Virtual NFC preview deleted"});
  } catch (error) { next(error); }
};

exports.nfcStore = async (req, res, next) => {
  try {
    const [products, orders, vcards, settingsResult, userResult] = await Promise.all([
      pool.query(`SELECT id,name,price,description,front_image,back_image,category
        FROM nfc_products WHERE is_active=TRUE ORDER BY category,price,name`),
      pool.query(`SELECT o.id,o.nfc_product_id,o.vcard_id,o.quantity,o.amount,o.currency,o.status,
          o.subtotal_lkr,o.shipping_cost_lkr,o.shipping_cost,o.destination_country,o.exchange_rate,o.exchange_rate_date,
          o.payment_status,o.payment_method,o.transaction_number,o.shipping_address,o.tracking_number,
          o.admin_note,o.ordered_at,o.updated_at,p.name product_name,p.front_image,v.title vcard_title
        FROM nfc_orders o LEFT JOIN nfc_products p ON p.id=o.nfc_product_id
        LEFT JOIN vcards v ON v.id=o.vcard_id WHERE o.user_id=$1 ORDER BY o.ordered_at DESC`, [req.user.id]),
      pool.query(`SELECT id,title,description,website_url,phone,email,address
        FROM vcards WHERE user_id=$1 AND is_active=TRUE ORDER BY title,id`, [req.user.id]),
      pool.query(`SELECT key,value FROM settings WHERE key=ANY($1::text[])`, [["default_currency","bank_name","bank_account_name","bank_account_number","bank_branch","bank_swift_code","international_nfc_shipping_lkr"]]),
      pool.query("SELECT name,email,phone,preferred_currency FROM users WHERE id=$1", [req.user.id]),
    ]);
    const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value || ""]));
    const currency = normalizeCurrency(userResult.rows[0]?.preferred_currency, BASE_CURRENCY);
    const exchange = await getRate(currency);
    const internationalShippingLkr = number(settings.international_nfc_shipping_lkr);
    res.json({
      currency, baseCurrency: BASE_CURRENCY, exchangeRate: exchange.rate, rateDate: exchange.rateDate, ratesStale: exchange.stale,
      internationalShippingLkr,
      internationalShipping: convertFromLkr(internationalShippingLkr, exchange.rate),
      bankDetails: { bankName: settings.bank_name || "", accountName: settings.bank_account_name || "",
        accountNumber: settings.bank_account_number || "", branch: settings.bank_branch || "", swiftCode: settings.bank_swift_code || "" },
      products: products.rows.map((item) => ({ id:item.id,name:item.name,basePrice:number(item.price),price:convertFromLkr(item.price, exchange.rate),description:item.description || "",
        frontImage:item.front_image,backImage:item.back_image,category:item.category || "essential" })),
      vcards: vcards.rows.map((item) => ({ id:item.id,title:item.title || userResult.rows[0]?.name || `VCard #${item.id}`,
        role:item.description || "",email:item.email || userResult.rows[0]?.email || "",
        phone:item.phone || userResult.rows[0]?.phone || "",websiteUrl:item.website_url || "",address:item.address || "" })),
      orders: orders.rows.map((item) => ({ id:item.id,productId:item.nfc_product_id,vcardId:item.vcard_id,
        productName:item.product_name || "NFC card",productImage:item.front_image || null,vcardTitle:item.vcard_title || null,
        quantity:number(item.quantity),amount:number(item.amount),currency:item.currency || "LKR",status:item.status,
        subtotalLkr:number(item.subtotal_lkr),shippingCostLkr:number(item.shipping_cost_lkr),shippingCost:number(item.shipping_cost),
        destinationCountry:item.destination_country || "LK",exchangeRate:number(item.exchange_rate),exchangeRateDate:item.exchange_rate_date,
        paymentStatus:item.payment_status || "pending",paymentMethod:item.payment_method,transactionNumber:item.transaction_number,
        shippingAddress:item.shipping_address,trackingNumber:item.tracking_number,adminNote:item.admin_note,
        orderedAt:item.ordered_at,updatedAt:item.updated_at })),
    });
  } catch (error) { next(error); }
};

exports.placeNfcOrder = async (req, res, next) => {
  const productId = Number(req.body.productId);
  const vcardId = Number(req.body.vcardId);
  const quantity = Number(req.body.quantity);
  const transactionNumber = String(req.body.transactionNumber || "").trim();
  const shippingAddress = String(req.body.shippingAddress || "").trim();
  const destinationCountry = String(req.body.destinationCountry || "").trim().toUpperCase();
  const uploadedPath = req.file?.path;
  const discardUpload = () => uploadedPath ? fs.unlink(uploadedPath).catch(() => {}) : Promise.resolve();
  if (!req.file) return res.status(400).json({ message: "Upload your bank payment slip" });
  if (!Number.isInteger(productId) || productId < 1) { await discardUpload(); return res.status(400).json({ message: "Select a valid NFC card" }); }
  if (!Number.isInteger(vcardId) || vcardId < 1) { await discardUpload(); return res.status(400).json({ message: "Select the VCard to link" }); }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) { await discardUpload(); return res.status(400).json({ message: "Order between 1 and 100 NFC cards" }); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/# -]{2,254}$/.test(transactionNumber)) { await discardUpload(); return res.status(400).json({ message: "Enter a valid transaction number" }); }
  if (shippingAddress.length < 10 || shippingAddress.length > 2000) { await discardUpload(); return res.status(400).json({ message: "Enter a complete shipping address" }); }
  if (!/^[A-Z]{2}$/.test(destinationCountry)) { await discardUpload(); return res.status(400).json({ message: "Select a valid destination country" }); }
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const productResult = await client.query("SELECT id,name,price FROM nfc_products WHERE id=$1 AND is_active=TRUE FOR SHARE", [productId]);
    const vcardResult = await client.query("SELECT id,title FROM vcards WHERE id=$1 AND user_id=$2 AND is_active=TRUE FOR SHARE", [vcardId,req.user.id]);
    const [currencyResult, shippingResult] = await Promise.all([
      client.query("SELECT preferred_currency FROM users WHERE id=$1", [req.user.id]),
      client.query("SELECT value FROM settings WHERE key='international_nfc_shipping_lkr'"),
    ]);
    if (!productResult.rowCount || !vcardResult.rowCount) { await client.query("ROLLBACK"); await discardUpload(); return res.status(400).json({ message: "The selected NFC card or VCard is unavailable" }); }
    const duplicate = await client.query("SELECT id FROM nfc_orders WHERE LOWER(transaction_number)=LOWER($1)", [transactionNumber]);
    if (duplicate.rowCount) { await client.query("ROLLBACK"); await discardUpload(); return res.status(409).json({ message: "This transaction number has already been submitted" }); }
    const product = productResult.rows[0];
    const subtotalLkr = number(product.price) * quantity;
    const shippingCostLkr = destinationCountry === "LK" ? 0 : number(shippingResult.rows[0]?.value);
    const currency = normalizeCurrency(currencyResult.rows[0]?.preferred_currency, BASE_CURRENCY);
    const exchange = await getRate(currency);
    const subtotal = convertFromLkr(subtotalLkr, exchange.rate);
    const shippingCost = convertFromLkr(shippingCostLkr, exchange.rate);
    const amount = Math.round((subtotal + shippingCost + Number.EPSILON) * 100) / 100;
    const proofUrl = `/uploads/payment-slips/${req.file.filename}`;
    const result = await client.query(`INSERT INTO nfc_orders(user_id,nfc_product_id,vcard_id,quantity,amount,currency,status,
      shipping_address,destination_country,subtotal_lkr,shipping_cost_lkr,shipping_cost,exchange_rate,exchange_rate_date,
      payment_method,payment_status,transaction_number,proof_url)
      VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11,$12,$13,'bank_transfer','pending',$14,$15)
      RETURNING id,amount,currency,status,payment_status,ordered_at`,
      [req.user.id,productId,vcardId,quantity,amount,currency,shippingAddress,destinationCountry,subtotalLkr,shippingCostLkr,shippingCost,exchange.rate,exchange.rateDate,transactionNumber,proofUrl]);
    await client.query(`INSERT INTO notifications(user_id,title,message,type)
      SELECT u.id,'NFC payment awaiting review',$1,'billing' FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='super_admin'`,
      [`${req.user.name} ordered ${quantity} × ${product.name} and submitted transaction ${transactionNumber}.`]);
    await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,'NFC order submitted',$2,'billing')`,
      [req.user.id,`Order #${result.rows[0].id} is waiting for payment approval.`]);
    await client.query("COMMIT");
    res.status(201).json({ order:result.rows[0],message:"NFC order and payment slip submitted for approval" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    await discardUpload();
    if (error.code === "23505") return res.status(409).json({ message:"This transaction number has already been submitted" });
    next(error);
  } finally { if (client) client.release(); }
};

function affiliateMoneyRows(rows) {
  return rows.map((row) => ({ currency: row.currency, earned: number(row.earned), pending: number(row.pending),
    reserved: number(row.reserved), available: Math.max(0, number(row.earned) - number(row.reserved)) }));
}

exports.affiliations = async (req, res, next) => {
  try {
    const profileResult = await pool.query(
      `SELECT ap.id,ap.referral_code,ap.commission_type,ap.commission_value,ap.payment_method,
              ap.payout_details,ap.status,ap.created_at,
              COALESCE((SELECT value FROM settings WHERE key='affiliate_minimum_withdrawal'),'10') minimum_withdrawal
       FROM affiliate_profiles ap WHERE ap.user_id=$1`, [req.user.id]
    );
    if (!profileResult.rowCount) return res.json({ profile: null, referrals: [], commissions: [], withdrawals: [], balances: [], minimumWithdrawal: 10 });
    const profile = profileResult.rows[0];
    const frontendOrigin = String(process.env.FRONTEND_URL || req.get("origin") || `${req.protocol}://${req.get("host") || "localhost"}`).replace(/\/+$/, "");
    const [referrals, commissions, withdrawals, balances] = await Promise.all([
      pool.query(`SELECT ar.id,ar.status,ar.joined_at,ar.updated_at,u.name,u.email,
        COALESCE((SELECT SUM(ac.amount) FROM affiliate_commissions ac WHERE ac.referral_id=ar.id AND ac.status IN ('pending','approved','paid')),0) commission,
        COALESCE((SELECT MAX(ac.currency) FROM affiliate_commissions ac WHERE ac.referral_id=ar.id),'USD') currency
        FROM affiliate_referrals ar JOIN users u ON u.id=ar.referred_user_id
        WHERE ar.affiliate_id=$1 ORDER BY ar.joined_at DESC`, [profile.id]),
      pool.query(`SELECT ac.id,ac.amount,ac.currency,ac.status,ac.description,ac.approved_at,ac.created_at,
        u.name AS referred_name FROM affiliate_commissions ac
        LEFT JOIN affiliate_referrals ar ON ar.id=ac.referral_id LEFT JOIN users u ON u.id=ar.referred_user_id
        WHERE ac.affiliate_id=$1 ORDER BY ac.created_at DESC`, [profile.id]),
      pool.query(`SELECT id,amount,currency,method,status,account_details,request_note,admin_note,reviewed_at,processed_at,created_at
        FROM withdrawals WHERE affiliate_id=$1 ORDER BY created_at DESC`, [profile.id]),
      pool.query(`WITH currencies AS (
          SELECT currency FROM affiliate_commissions WHERE affiliate_id=$1 AND status IN ('pending','approved','paid')
          UNION SELECT currency FROM withdrawals WHERE affiliate_id=$1 AND status NOT IN ('rejected','cancelled')
        ) SELECT c.currency,
          COALESCE((SELECT SUM(amount) FROM affiliate_commissions WHERE affiliate_id=$1 AND currency=c.currency AND status IN ('approved','paid')),0) earned,
          COALESCE((SELECT SUM(amount) FROM affiliate_commissions WHERE affiliate_id=$1 AND currency=c.currency AND status='pending'),0) pending,
          COALESCE((SELECT SUM(amount) FROM withdrawals WHERE affiliate_id=$1 AND currency=c.currency AND status NOT IN ('rejected','cancelled')),0) reserved
        FROM currencies c ORDER BY c.currency`, [profile.id]),
    ]);
    res.json({
      profile: { id: profile.id, referralCode: profile.referral_code, commissionType: profile.commission_type,
        commissionValue: number(profile.commission_value), paymentMethod: profile.payment_method,
        payoutDetails: profile.payout_details?.label || "", status: profile.status, createdAt: profile.created_at },
      minimumWithdrawal: number(profile.minimum_withdrawal) || 10,
      referralLink: `${frontendOrigin}/frontend/pages/auth/register.html?ref=${encodeURIComponent(profile.referral_code)}`,
      referrals: referrals.rows.map((row) => ({ id: row.id, user: { name: row.name, email: row.email }, status: row.status,
        commission: number(row.commission), currency: row.currency, joinedAt: row.joined_at, updatedAt: row.updated_at })),
      commissions: commissions.rows.map((row) => ({ id: row.id, referredName: row.referred_name || "General earning",
        amount: number(row.amount), currency: row.currency, status: row.status, description: row.description || "",
        approvedAt: row.approved_at, createdAt: row.created_at })),
      withdrawals: withdrawals.rows.map((row) => ({ id: row.id, amount: number(row.amount), currency: row.currency,
        method: row.method, status: row.status, accountDetails: row.account_details?.accountName || "",
        requestNote: row.request_note || "", adminNote: row.admin_note || "", reviewedAt: row.reviewed_at,
        processedAt: row.processed_at, createdAt: row.created_at })),
      balances: affiliateMoneyRows(balances.rows),
    });
  } catch (error) { next(error); }
};

exports.applyForAffiliate = async (req, res, next) => {
  const referralCode = String(req.body.referralCode || "").trim().toUpperCase();
  const paymentMethod = String(req.body.paymentMethod || "bank_transfer").trim().toLowerCase();
  const payoutDetails = String(req.body.payoutDetails || "").trim();
  if (!/^[A-Z0-9_-]{3,80}$/.test(referralCode)) return res.status(400).json({ message: "Choose a referral code using 3 to 80 letters, numbers, dashes, or underscores" });
  if (!["bank_transfer", "paypal", "cash", "other"].includes(paymentMethod)) return res.status(400).json({ message: "Select a valid payment method" });
  if (payoutDetails.length > 500) return res.status(400).json({ message: "Payout details must not exceed 500 characters" });
  try {
    const result = await pool.query(`INSERT INTO affiliate_profiles(user_id,referral_code,commission_type,commission_value,payment_method,payout_details,status)
      VALUES($1,$2,'percentage',10,$3,$4::jsonb,'pending') RETURNING id,referral_code,status`,
      [req.user.id, referralCode, paymentMethod, JSON.stringify({ label: payoutDetails })]);
    await pool.query(`INSERT INTO notifications(user_id,title,message,type)
      SELECT u.id,'Affiliate application received',$1,'affiliate' FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='super_admin'`,
      [`${req.user.name} applied with referral code ${referralCode}.`]);
    res.status(201).json({ profile: result.rows[0], message: "Application submitted for super-admin approval" });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ message: "This account or referral code already has an affiliate application" });
    next(error);
  }
};

exports.updateAffiliatePayout = async (req, res, next) => {
  const paymentMethod = String(req.body.paymentMethod || "").trim().toLowerCase();
  const payoutDetails = String(req.body.payoutDetails || "").trim();
  if (!["bank_transfer", "paypal", "cash", "other"].includes(paymentMethod)) return res.status(400).json({ message: "Select a valid payment method" });
  if (!payoutDetails || payoutDetails.length > 500) return res.status(400).json({ message: "Enter payout details up to 500 characters" });
  try {
    const result = await pool.query(`UPDATE affiliate_profiles SET payment_method=$1,payout_details=$2::jsonb,updated_at=NOW()
      WHERE user_id=$3 AND status IN ('pending','active') RETURNING id,payment_method,status`, [paymentMethod, JSON.stringify({ label: payoutDetails }), req.user.id]);
    if (!result.rowCount) return res.status(404).json({ message: "Active affiliate profile not found" });
    res.json({ profile: result.rows[0], message: "Payout details updated" });
  } catch (error) { next(error); }
};

exports.requestAffiliateWithdrawal = async (req, res, next) => {
  const amount = Number(req.body.amount);
  const currency = String(req.body.currency || "USD").trim().toUpperCase();
  const note = String(req.body.note || "").trim() || null;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) return res.status(400).json({ message: "Enter a valid withdrawal amount" });
  if (!/^[A-Z]{3,10}$/.test(currency)) return res.status(400).json({ message: "Select a valid currency" });
  if (note && note.length > 3000) return res.status(400).json({ message: "Withdrawal note is too long" });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const profileResult = await client.query(`SELECT ap.id,ap.payment_method,ap.payout_details,
      COALESCE((SELECT value::numeric FROM settings WHERE key='affiliate_minimum_withdrawal'),10) minimum
      FROM affiliate_profiles ap WHERE ap.user_id=$1 AND ap.status='active' FOR UPDATE`, [req.user.id]);
    if (!profileResult.rowCount) { await client.query("ROLLBACK"); return res.status(403).json({ message: "Your affiliate account is not active" }); }
    const profile = profileResult.rows[0];
    const accountName = String(profile.payout_details?.label || "").trim();
    if (profile.payment_method !== "cash" && !accountName) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Add your payout account details before requesting a withdrawal" }); }
    if (amount < number(profile.minimum)) { await client.query("ROLLBACK"); return res.status(400).json({ message: `Minimum withdrawal is ${currency} ${number(profile.minimum).toFixed(2)}` }); }
    const balanceResult = await client.query(`SELECT
      COALESCE((SELECT SUM(amount) FROM affiliate_commissions WHERE affiliate_id=$1 AND currency=$2 AND status IN ('approved','paid')),0) earned,
      COALESCE((SELECT SUM(amount) FROM withdrawals WHERE affiliate_id=$1 AND currency=$2 AND status NOT IN ('rejected','cancelled')),0) reserved`, [profile.id, currency]);
    const available = number(balanceResult.rows[0].earned) - number(balanceResult.rows[0].reserved);
    if (amount > available) { await client.query("ROLLBACK"); return res.status(409).json({ message: `Only ${currency} ${Math.max(0, available).toFixed(2)} is available` }); }
    const result = await client.query(`INSERT INTO withdrawals(user_id,affiliate_id,amount,currency,method,status,account_details,request_note)
      VALUES($1,$2,$3,$4,$5,'pending',$6::jsonb,$7) RETURNING id,amount,currency,status`,
      [req.user.id, profile.id, amount, currency, profile.payment_method, JSON.stringify({ accountName }), note]);
    await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,'Withdrawal requested',$2,'affiliate')`,
      [req.user.id, `Your ${currency} ${amount.toFixed(2)} withdrawal is awaiting review.`]);
    await client.query(`INSERT INTO notifications(user_id,title,message,type)
      SELECT u.id,'Affiliate withdrawal awaiting review',$1,'affiliate' FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='super_admin'`,
      [`${req.user.name} requested ${currency} ${amount.toFixed(2)}.`]);
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata)
      VALUES($1,'affiliate.withdrawal_requested','withdrawal',$2,$3::jsonb)`, [req.user.id, result.rows[0].id, JSON.stringify({ amount, currency, affiliateId: profile.id })]);
    await client.query("COMMIT");
    res.status(201).json({ withdrawal: result.rows[0], message: "Withdrawal request submitted for super-admin review" });
  } catch (error) { if (client) await client.query("ROLLBACK").catch(() => {}); next(error); }
  finally { if (client) client.release(); }
};

function mapUserPlan(plan) {
  const normalized = normalizePlanFeatures(plan.features);
  return { id: plan.id, name: plan.name, price: number(plan.price), billingInterval: plan.billing_interval,
    vcardLimit: number(plan.vcard_limit), nfcLimit: number(plan.nfc_limit), analyticsLimit: number(plan.analytics_limit),
    storageLimitMb: number(plan.storage_limit_mb),
    features: normalized.benefits, vcardFeatures: normalized.vcardFeatures, templateIds: normalized.templateIds };
}

exports.plans = async (req, res, next) => {
  try {
    const [settingsResult, userResult] = await Promise.all([
      pool.query(`SELECT key,value FROM settings WHERE key = ANY($1::text[])`, [["default_currency", "bank_name", "bank_account_name", "bank_account_number", "bank_branch", "bank_swift_code"]]),
      pool.query("SELECT preferred_currency FROM users WHERE id=$1", [req.user.id]),
    ]);
    const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value || ""]));
    const currency = normalizeCurrency(userResult.rows[0]?.preferred_currency, normalizeCurrency(settings.default_currency, BASE_CURRENCY));
    const exchange = await getRate(currency);
    const [plansResult, subscriptionsResult, paymentsResult] = await Promise.all([
      pool.query(`SELECT p.id,p.name,p.price,p.billing_interval,p.vcard_limit,p.nfc_limit,p.analytics_limit,p.storage_limit_mb,p.features
        FROM plans p WHERE p.status='active' ORDER BY p.price,p.name`),
      pool.query(`SELECT s.id,s.plan_id,s.status,s.start_date,s.end_date,s.auto_renew,s.created_at,
        p.name AS plan_name,p.price,p.billing_interval,p.vcard_limit,p.nfc_limit,p.analytics_limit,p.storage_limit_mb,
        pay.status AS payment_status,pay.gateway_reference
        FROM subscriptions s LEFT JOIN plans p ON p.id=s.plan_id
        LEFT JOIN LATERAL (SELECT status,gateway_reference FROM payments WHERE subscription_id=s.id ORDER BY created_at DESC LIMIT 1) pay ON TRUE
        WHERE s.user_id=$1 AND s.status IN ('active','pending','trial')
        ORDER BY (s.status='active') DESC,s.created_at DESC`, [req.user.id]),
      pool.query(`SELECT pay.id,pay.amount,pay.currency,pay.status,pay.gateway_reference,pay.proof_url,
        pay.created_at,pay.reviewed_at,p.name AS plan_name,c.code AS coupon_code,
        cr.original_amount,cr.discount_amount
        FROM payments pay LEFT JOIN subscriptions s ON s.id=pay.subscription_id LEFT JOIN plans p ON p.id=s.plan_id
        LEFT JOIN coupon_redemptions cr ON cr.payment_id=pay.id
        LEFT JOIN coupon_codes c ON c.id=cr.coupon_id
        WHERE pay.user_id=$1
        ORDER BY pay.created_at DESC LIMIT 20`, [req.user.id]),
    ]);
    plansResult.rows.forEach((item) => { item.price = convertFromLkr(item.price, exchange.rate); });
    subscriptionsResult.rows.forEach((item) => { item.price = convertFromLkr(item.price, exchange.rate); });
    const active = subscriptionsResult.rows.find((item) => item.status === "active")
      || subscriptionsResult.rows.find((item) => item.status === "trial")
      || null;
    const pending = subscriptionsResult.rows.find((item) => item.status === "pending") || null;
    const freePlan = plansResult.rows.find((item) => number(item.price) === 0) || null;
    const effectivePlan = active || (freePlan ? {
      id: null, plan_id: freePlan.id, status: "active", start_date: null, end_date: null, auto_renew: false,
      plan_name: freePlan.name, price: freePlan.price, billing_interval: freePlan.billing_interval,
      vcard_limit: freePlan.vcard_limit, nfc_limit: freePlan.nfc_limit, analytics_limit: freePlan.analytics_limit,
      storage_limit_mb: freePlan.storage_limit_mb,
    } : null);
    const bankDetails = { bankName: settings.bank_name || "", accountName: settings.bank_account_name || "",
      accountNumber: settings.bank_account_number || "", branch: settings.bank_branch || "", swiftCode: settings.bank_swift_code || "" };
    res.json({ plans: plansResult.rows.map(mapUserPlan), currentPlanId: effectivePlan ? effectivePlan.plan_id : null,
      currency, baseCurrency:BASE_CURRENCY, exchangeRate:exchange.rate, rateDate:exchange.rateDate, ratesStale:exchange.stale, bankDetails,
      bankConfigured: Boolean(bankDetails.bankName && bankDetails.accountName && bankDetails.accountNumber && bankDetails.branch),
      current: effectivePlan ? {
        subscriptionId: effectivePlan.id, planId: effectivePlan.plan_id, planName: effectivePlan.plan_name,
        status: effectivePlan.status, price: number(effectivePlan.price), billingInterval: effectivePlan.billing_interval,
        startDate: effectivePlan.start_date, endDate: effectivePlan.end_date, autoRenew: Boolean(effectivePlan.auto_renew),
        vcardLimit: number(effectivePlan.vcard_limit), nfcLimit: number(effectivePlan.nfc_limit),
        analyticsLimit: number(effectivePlan.analytics_limit), storageLimitMb: number(effectivePlan.storage_limit_mb),
      } : null,
      pending: pending ? { id: pending.id, planId: pending.plan_id, planName: pending.plan_name,
        paymentStatus: pending.payment_status || "pending", transactionNumber: pending.gateway_reference || null,
        submittedAt: pending.created_at } : null,
      payments: paymentsResult.rows.map((payment) => ({ id: payment.id, planName: payment.plan_name || "Subscription",
        amount: number(payment.amount), currency: payment.currency, status: payment.status,
        couponCode: payment.coupon_code || null, originalAmount: payment.original_amount === null ? null : number(payment.original_amount),
        discountAmount: payment.discount_amount === null ? null : number(payment.discount_amount),
        transactionNumber: payment.gateway_reference, proofUrl: payment.proof_url,
        createdAt: payment.created_at, reviewedAt: payment.reviewed_at })) });
  } catch (error) { next(error); }
};

async function calculateUserCoupon(client, { code, userId, planId, originalAmount, currency, lock }) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,80}$/.test(normalizedCode)) {
    return { error: "Enter a valid coupon code", status: 400 };
  }
  const result = await client.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM coupon_redemptions cr
        WHERE cr.coupon_id=c.id AND cr.status IN ('pending','applied'))::int used_count,
       (SELECT COUNT(*) FROM coupon_redemptions cr
        WHERE cr.coupon_id=c.id AND cr.user_id=$2 AND cr.status IN ('pending','applied'))::int user_count
     FROM coupon_codes c
     WHERE UPPER(c.code)=UPPER($1)
     ${lock ? "FOR UPDATE OF c" : ""}`,
    [normalizedCode, userId]
  );
  if (!result.rowCount) return { error: "Coupon code was not found", status: 404 };
  const coupon = result.rows[0];
  const now = new Date();
  if (coupon.status !== "active") return { error: "This coupon is not active", status: 409 };
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { error: "This coupon is not available yet", status: 409 };
  if (coupon.expires_at && new Date(coupon.expires_at) <= now) return { error: "This coupon has expired", status: 409 };
  if (coupon.usage_limit !== null && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
    return { error: "This coupon has reached its usage limit", status: 409 };
  }
  if (Number(coupon.user_count) >= Number(coupon.per_user_limit)) {
    return { error: "You have already used this coupon the maximum number of times", status: 409 };
  }
  if (coupon.applicable_plan_id !== null && Number(coupon.applicable_plan_id) !== Number(planId)) {
    return { error: "This coupon is not valid for the selected plan", status: 409 };
  }
  if (String(coupon.currency).toUpperCase() !== String(currency).toUpperCase()) {
    return { error: `This coupon is only valid for ${coupon.currency} purchases`, status: 409 };
  }
  if (Number(originalAmount) < Number(coupon.minimum_amount)) {
    return { error: `Minimum purchase amount is ${coupon.currency} ${Number(coupon.minimum_amount).toFixed(2)}`, status: 409 };
  }
  const rawDiscount = coupon.discount_type === "percentage"
    ? Number(originalAmount) * Number(coupon.discount_value) / 100
    : Number(coupon.discount_value);
  const discountAmount = Number(Math.min(rawDiscount, Number(originalAmount)).toFixed(2));
  const finalAmount = Number((Number(originalAmount) - discountAmount).toFixed(2));
  return {
    coupon,
    discountAmount,
    finalAmount,
    originalAmount: Number(Number(originalAmount).toFixed(2)),
    currency: String(currency).toUpperCase(),
  };
}

exports.previewCoupon = async (req, res, next) => {
  const planId = Number(req.body.planId);
  const code = String(req.body.code || "");
  if (!Number.isInteger(planId) || planId < 1) return res.status(400).json({ message: "Select a valid plan" });
  try {
    const userResult = await pool.query("SELECT preferred_currency FROM users WHERE id=$1", [req.user.id]);
    const currency = normalizeCurrency(userResult.rows[0]?.preferred_currency, BASE_CURRENCY);
    const exchange = await getRate(currency);
    const planResult = await pool.query(`SELECT p.id,p.name,p.price FROM plans p WHERE p.id=$1 AND p.status='active'`, [planId]);
    if (!planResult.rowCount) return res.status(404).json({ message: "Plan not found" });
    const plan = planResult.rows[0];
    const calculation = await calculateUserCoupon(pool, {
      code, userId: req.user.id, planId, originalAmount: convertFromLkr(plan.price, exchange.rate), currency, lock: false,
    });
    if (calculation.error) return res.status(calculation.status).json({ message: calculation.error });
    res.json({
      coupon: {
        code: calculation.coupon.code,
        name: calculation.coupon.name,
        discountType: calculation.coupon.discount_type,
        discountValue: number(calculation.coupon.discount_value),
      },
      originalAmount: calculation.originalAmount,
      discountAmount: calculation.discountAmount,
      finalAmount: calculation.finalAmount,
      currency: calculation.currency,
      message: "Coupon applied successfully",
    });
  } catch (error) { next(error); }
};

exports.requestPlanUpgrade = async (req, res, next) => {
  return res.status(400).json({ message: "A transaction number and payment slip are required. Use the manual payment form." });
};

exports.submitManualPayment = async (req, res, next) => {
  const planId = Number(req.body.planId);
  const reference = String(req.body.transactionNumber || "").trim();
  const couponCode = String(req.body.couponCode || "").trim().toUpperCase();
  const uploadedPath = req.file?.path;
  const discardUpload = () => uploadedPath ? fs.unlink(uploadedPath).catch(() => {}) : Promise.resolve();
  if (!Number.isInteger(planId) || planId < 1) { await discardUpload(); return res.status(400).json({ message: "Select a valid plan" }); }

  let client;
  let committed = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const [planResult, activeResult, settingsResult, userResult] = await Promise.all([
      client.query(`SELECT p.id,p.name,p.price,p.billing_interval FROM plans p
        WHERE p.id=$1 AND p.status='active' FOR SHARE OF p`, [planId]),
      client.query(`SELECT s.id,s.plan_id,COALESCE(p.price,0) price FROM subscriptions s LEFT JOIN plans p ON p.id=s.plan_id
        WHERE s.user_id=$1 AND s.status='active' ORDER BY s.created_at DESC LIMIT 1 FOR UPDATE OF s`, [req.user.id]),
      client.query(`SELECT key,value FROM settings WHERE key=ANY($1::text[])`, [["default_currency", "bank_name", "bank_account_name", "bank_account_number", "bank_branch"]]),
      client.query("SELECT preferred_currency FROM users WHERE id=$1", [req.user.id]),
    ]);
    const plan = planResult.rows[0];
    if (!plan) { await client.query("ROLLBACK"); await discardUpload(); return res.status(404).json({ message: "Plan not found" }); }
    if (number(plan.price) < 0.01) { await client.query("ROLLBACK"); await discardUpload(); return res.status(400).json({ message: "The free plan does not require payment" }); }
    const active = activeResult.rows[0];
    if (active && Number(active.plan_id) === planId) { await client.query("ROLLBACK"); await discardUpload(); return res.status(409).json({ message: "This is already your current plan" }); }
    if (active && number(plan.price) <= number(active.price)) { await client.query("ROLLBACK"); await discardUpload(); return res.status(400).json({ message: "Choose a plan priced above your current plan" }); }
    const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value || ""]));
    const purchaseCurrency = normalizeCurrency(userResult.rows[0]?.preferred_currency, normalizeCurrency(settings.default_currency, BASE_CURRENCY));
    const exchange = await getRate(purchaseCurrency);
    const convertedPlanPrice = convertFromLkr(plan.price, exchange.rate);
    let couponCalculation = null;
    if (couponCode) {
      couponCalculation = await calculateUserCoupon(client, {
        code: couponCode,
        userId: req.user.id,
        planId,
        originalAmount: convertedPlanPrice,
        currency: purchaseCurrency,
        lock: true,
      });
      if (couponCalculation.error) {
        await client.query("ROLLBACK"); await discardUpload();
        return res.status(couponCalculation.status).json({ message: couponCalculation.error });
      }
    }
    const payableAmount = couponCalculation ? couponCalculation.finalAmount : convertedPlanPrice;
    const fullyDiscounted = payableAmount === 0;
    if (!fullyDiscounted && !req.file) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Upload your payment slip as JPG, PNG, WebP, or PDF" });
    }
    if (!fullyDiscounted && !/^[A-Za-z0-9][A-Za-z0-9._/# -]{2,254}$/.test(reference)) {
      await client.query("ROLLBACK"); await discardUpload();
      return res.status(400).json({ message: "Enter a valid transaction number (3 to 255 characters)" });
    }
    if (!fullyDiscounted && ![settings.bank_name, settings.bank_account_name, settings.bank_account_number, settings.bank_branch].every(Boolean)) {
      await client.query("ROLLBACK"); await discardUpload();
      return res.status(503).json({ message: "Bank transfer details are not configured yet. Please contact support." });
    }
    if (!fullyDiscounted) {
      const duplicate = await client.query(`SELECT id FROM payments WHERE LOWER(gateway_reference)=LOWER($1)
        AND LOWER(COALESCE(method,''))=ANY($2::text[]) AND status<>'rejected' LIMIT 1`, [reference, ["cash", "manual", "bank_transfer", "cash_payment"]]);
      if (duplicate.rowCount) { await client.query("ROLLBACK"); await discardUpload(); return res.status(409).json({ message: "This transaction number has already been submitted" }); }
    }

    await client.query(`UPDATE payments SET status='rejected',notes=CONCAT_WS(E'\n',notes,'Superseded by a newer payment submission'),updated_at=NOW()
      WHERE subscription_id IN (SELECT id FROM subscriptions WHERE user_id=$1 AND status='pending') AND status='pending'`, [req.user.id]);
    await client.query(`UPDATE coupon_redemptions cr SET status='cancelled'
      FROM payments pay WHERE cr.payment_id=pay.id AND pay.user_id=$1
      AND pay.status='rejected' AND cr.status='pending'`, [req.user.id]);
    await client.query(`UPDATE subscriptions SET status='cancelled',cancel_reason='Superseded by a newer payment submission',updated_at=NOW()
      WHERE user_id=$1 AND status='pending'`, [req.user.id]);
    if (fullyDiscounted) {
      await client.query(`UPDATE subscriptions SET status='cancelled',cancel_reason='Replaced by coupon subscription',updated_at=NOW()
        WHERE user_id=$1 AND status='active'`, [req.user.id]);
    }
    const subscription = await client.query(`INSERT INTO subscriptions(user_id,plan_id,status,start_date,end_date,auto_renew,cancel_reason)
      VALUES($1,$2,$3,CURRENT_DATE,
        CASE WHEN $3='active' AND LOWER(COALESCE($4,'')) IN ('year','yearly','annual') THEN (CURRENT_DATE + INTERVAL '1 year')::date
             WHEN $3='active' AND LOWER(COALESCE($4,'')) IN ('week','weekly') THEN (CURRENT_DATE + INTERVAL '1 week')::date
             WHEN $3='active' AND LOWER(COALESCE($4,'')) IN ('day','daily') THEN (CURRENT_DATE + INTERVAL '1 day')::date
             WHEN $3='active' AND LOWER(COALESCE($4,''))='lifetime' THEN NULL
             WHEN $3='active' THEN (CURRENT_DATE + INTERVAL '1 month')::date ELSE NULL END,
        FALSE,$5) RETURNING id,plan_id,status`,
      [req.user.id, planId, fullyDiscounted ? "active" : "pending", plan.billing_interval,
        fullyDiscounted ? null : "Awaiting bank transfer verification"]);
    const proofUrl = req.file ? `/uploads/payment-slips/${req.file.filename}` : null;
    const paymentReference = fullyDiscounted
      ? `COUPON-${couponCalculation.coupon.id}-${req.user.id}-${Date.now()}`
      : reference;
    const payment = await client.query(`INSERT INTO payments(subscription_id,user_id,amount,currency,method,status,gateway_reference,proof_url,notes,paid_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $6='approved' THEN NOW() ELSE NULL END) RETURNING id,status,amount,currency`,
      [subscription.rows[0].id, req.user.id, payableAmount, purchaseCurrency,
        fullyDiscounted ? "coupon" : "bank_transfer", fullyDiscounted ? "approved" : "pending",
        paymentReference, proofUrl, couponCalculation ? `Coupon ${couponCalculation.coupon.code} applied` : "Submitted by user for manual review"]);
    await client.query(`INSERT INTO transactions(payment_id,user_id,transaction_type,amount,currency,reference,gateway,status,metadata)
      VALUES($1,$2,'cash_payment',$3,$4,$5,'manual','pending',$6::jsonb)`,
      [payment.rows[0].id, req.user.id, payableAmount, purchaseCurrency, paymentReference,
        JSON.stringify({ subscriptionId: subscription.rows[0].id, source: fullyDiscounted ? "coupon" : "user_upload", couponCode: couponCode || null,
          baseCurrency: BASE_CURRENCY, baseAmountLkr: number(plan.price), exchangeRate: exchange.rate, exchangeRateDate: exchange.rateDate })]);
    if (fullyDiscounted) {
      await client.query("UPDATE transactions SET status='completed',updated_at=NOW() WHERE payment_id=$1", [payment.rows[0].id]);
    }
    if (couponCalculation) {
      await client.query(`INSERT INTO coupon_redemptions
        (coupon_id,user_id,plan_id,payment_id,original_amount,discount_amount,final_amount,currency,status,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [couponCalculation.coupon.id, req.user.id, planId, payment.rows[0].id,
          couponCalculation.originalAmount, couponCalculation.discountAmount, couponCalculation.finalAmount,
          purchaseCurrency, fullyDiscounted ? "applied" : "pending",
          JSON.stringify({ source: "user_checkout", transactionNumber: paymentReference })]);
    }
    await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,$2,$3,'billing')`,
      [req.user.id, fullyDiscounted ? "Subscription activated" : "Payment submitted",
        fullyDiscounted
          ? `Coupon ${couponCalculation.coupon.code} covered your ${plan.name} plan and it is now active.`
          : `Your ${plan.name} payment is waiting for administrator approval. Your current plan remains available until approval.`]);
    if (!fullyDiscounted) {
      await client.query(`INSERT INTO notifications(user_id,title,message,type)
        SELECT u.id,'Manual payment awaiting review',$1,'billing' FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='super_admin'`,
        [`A ${purchaseCurrency} ${payableAmount.toFixed(2)} bank transfer for ${plan.name}${couponCalculation ? ` using coupon ${couponCalculation.coupon.code}` : ""} was submitted with transaction ${reference}.`]);
    }
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata)
      VALUES($1,$2,'payment',$3,$4::jsonb)`, [req.user.id, fullyDiscounted ? "subscription.coupon_activated" : "subscription.payment_submitted",
        payment.rows[0].id, JSON.stringify({ planId, subscriptionId: subscription.rows[0].id, transactionNumber: paymentReference,
          couponCode: couponCode || null, originalAmount: convertedPlanPrice, baseAmountLkr: number(plan.price), exchangeRate: exchange.rate,
          exchangeRateDate: exchange.rateDate, discountAmount: couponCalculation?.discountAmount || 0, finalAmount: payableAmount })]);
    await client.query("COMMIT");
    committed = true;
    res.status(201).json({ payment: payment.rows[0], subscription: subscription.rows[0],
      message: fullyDiscounted ? "Coupon applied. Your plan is now active." : "Payment submitted. Your paid plan will activate after administrator approval." });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (!committed) await discardUpload();
    if (error.code === "23505") return res.status(409).json({ message: "This transaction number has already been submitted" });
    next(error);
  } finally { if (client) client.release(); }
};

exports.markNotificationsRead = async (req, res, next) => {
  try {
    await pool.query("UPDATE notifications SET is_read = TRUE, updated_at = NOW() WHERE user_id = $1", [req.user.id]);
    res.json({ message: "Notifications marked as read" });
  } catch (error) { next(error); }
};

exports.getVcard = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,slug,template_id,title,description,website_url,phone,email,address,social_links,settings,is_active
       FROM vcards WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Card not found" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    res.json({ vcard: { ...result.rows[0], publicUrl: publicVcardUrl(req, result.rows[0].slug) }, entitlements });
  } catch (error) { next(error); }
};

function vcardPayloadBytes(payload) {
  return Buffer.byteLength(JSON.stringify({
    title:payload.title || "",description:payload.description || "",websiteUrl:payload.websiteUrl || "",
    phone:payload.phone || "",email:payload.email || "",address:payload.address || "",sections:payload.sections || {},
    profileImageUrl:payload.profileImageUrl || "",coverImageUrl:payload.coverImageUrl || "",
  }));
}

exports.createVcard = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const slug = normalizeCustomSlug(req.body.slug);
    if (!title) return res.status(400).json({ message: "Card name is required" });
    const allowance = await pool.query(
      `SELECT COALESCE(p.vcard_limit, 1)::int AS card_limit,
              (SELECT COUNT(*)::int FROM vcards v WHERE v.user_id = $1) AS card_count
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE u.id = $1 ORDER BY s.created_at DESC NULLS LAST LIMIT 1`, [req.user.id]
    );
    const limit = allowance.rows[0]?.card_limit || 1;
    if ((allowance.rows[0]?.card_count || 0) >= limit) return res.status(403).json({ message: "Your plan's card limit has been reached" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    const templateId = Number(req.body.templateId || entitlements.templates[0]?.id);
    if (!entitlements.templates.some((template) => Number(template.id) === templateId)) return res.status(403).json({ message: "This VCard template is not included in your plan" });
    const allowedKeys = new Set(entitlements.features.map((feature) => feature.key));
    const sections = normalizeSections(req.body.sections, allowedKeys);
    const profileImageUrl=normalizeVcardImage(req.body.profileImageUrl);
    const coverImageUrl=normalizeVcardImage(req.body.coverImageUrl);
    const storage=await getStorageSummary(pool,req.user.id);
    if(storage.usedBytes+vcardPayloadBytes({...req.body,title,sections,profileImageUrl,coverImageUrl})>storage.limitBytes){
      return res.status(413).json({message:`Your ${storage.plan.name} plan storage limit has been reached. Delete unused content or upgrade your plan.`});
    }
    const result = await pool.query(
      `INSERT INTO vcards (user_id,template_id,title,slug,description,website_url,phone,email,address,settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       RETURNING id,slug,template_id,title,description,website_url,phone,email,address,settings,is_active,created_at`,
       [req.user.id, templateId, title, slug, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null, JSON.stringify({ sections, profileImageUrl, coverImageUrl })]
    );
    res.status(201).json({ vcard: { ...result.rows[0], publicUrl: publicVcardUrl(req, result.rows[0].slug) } });
  } catch (error) { if(error.code==="23505")return res.status(409).json({message:"That VCard URL name is already in use. Choose another one."}); next(error); }
};

exports.updateVcard = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const hasSlug = Object.prototype.hasOwnProperty.call(req.body, "slug");
    const slug = hasSlug ? normalizeCustomSlug(req.body.slug) : null;
    if (!title) return res.status(400).json({ message: "Card name is required" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    const templateId = Number(req.body.templateId);
    if (!entitlements.templates.some((template) => Number(template.id) === templateId)) return res.status(403).json({ message: "This VCard template is not included in your plan" });
    const allowedKeys = new Set(entitlements.features.map((feature) => feature.key));
    const sections = normalizeSections(req.body.sections, allowedKeys);
    const existing=await pool.query(`SELECT title,description,website_url,phone,email,address,settings
      FROM vcards WHERE id=$1 AND user_id=$2`,[req.params.id,req.user.id]);
    if(!existing.rowCount)return res.status(404).json({message:"Card not found"});
    const current=existing.rows[0],storage=await getStorageSummary(pool,req.user.id);
    const profileImageUrl=Object.prototype.hasOwnProperty.call(req.body,"profileImageUrl")?normalizeVcardImage(req.body.profileImageUrl):current.settings?.profileImageUrl||null;
    const coverImageUrl=Object.prototype.hasOwnProperty.call(req.body,"coverImageUrl")?normalizeVcardImage(req.body.coverImageUrl):current.settings?.coverImageUrl||null;
    const nextSettings={...(current.settings||{}),sections,profileImageUrl,coverImageUrl};
    const currentBytes=Buffer.byteLength(JSON.stringify(current));
    const proposedBytes=vcardPayloadBytes({...req.body,title,sections,profileImageUrl,coverImageUrl});
    if(storage.usedBytes-currentBytes+proposedBytes>storage.limitBytes){
      return res.status(413).json({message:`Your ${storage.plan.name} plan storage limit has been reached. Reduce uploaded content or upgrade your plan.`});
    }
    const result = await pool.query(
      `UPDATE vcards SET template_id=$1,title=$2,description=$3,website_url=$4,phone=$5,
               email=$6,address=$7,settings=$8::jsonb,
              is_active=COALESCE($9,is_active),slug=CASE WHEN $10::boolean THEN $11 ELSE slug END,updated_at=NOW()
       WHERE id=$12 AND user_id=$13
       RETURNING id,slug,template_id,title,description,website_url,phone,email,address,settings,is_active,updated_at`,
       [templateId, title, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null, JSON.stringify(nextSettings), typeof req.body.isActive === "boolean" ? req.body.isActive : null, hasSlug, slug, req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Card not found" });
    res.json({ vcard: { ...result.rows[0], publicUrl: publicVcardUrl(req, result.rows[0].slug) } });
  } catch (error) { if(error.code==="23505")return res.status(409).json({message:"That VCard URL name is already in use. Choose another one."}); next(error); }
};

exports.deleteVcard = async (req, res, next) => {
  const vcardId = Number(req.params.id);
  if (!Number.isInteger(vcardId) || vcardId < 1) return res.status(400).json({ message: "Invalid VCard ID" });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `DELETE FROM vcards WHERE id=$1 AND user_id=$2 RETURNING id,title,template_id`,
      [vcardId, req.user.id]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "VCard not found or you do not have permission to delete it" });
    }
    await client.query(
      `INSERT INTO activity_logs (user_id,action,resource_type,resource_id,metadata)
       VALUES ($1,'vcard.deleted','vcard',$2,$3::jsonb)`,
      [req.user.id, vcardId, JSON.stringify({ title: result.rows[0].title, templateId: result.rows[0].template_id })]
    );
    await client.query("COMMIT");
    res.json({ message: "VCard deleted successfully", vcard: { id: result.rows[0].id, title: result.rows[0].title } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};
