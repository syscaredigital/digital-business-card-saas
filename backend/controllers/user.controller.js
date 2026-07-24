const pool = require("../config/database.config");
const fs = require("fs/promises");
const { VCARD_FEATURES, normalizePlanFeatures } = require("../config/vcard-features");
const { sendAppointmentApproved } = require("../services/email.service");

function number(value) {
  return Number(value || 0);
}

async function loadVcardEntitlements(db, userId) {
  const [planResult, templateResult] = await Promise.all([
    db.query(`SELECT p.id,p.name,p.vcard_limit,p.features
      FROM subscriptions s JOIN plans p ON p.id=s.plan_id
      WHERE s.user_id=$1 AND s.status='active'
      ORDER BY s.created_at DESC LIMIT 1`, [userId]),
    db.query(`SELECT id,name,description,preview_url,template_json FROM vcard_templates WHERE is_public=TRUE ORDER BY name,id`),
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

exports.dashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [profile, subscription, cards, orders, nfc, enquiries, analytics, notifications, affiliate] = await Promise.all([
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
        `SELECT v.id,v.title,v.email,v.phone,v.is_active,v.updated_at,v.template_id,t.name AS template_name
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
    ]);

    const plan = subscription.rows[0] || { plan_name: "Free", status: "inactive", vcard_limit: 1, nfc_limit: 0 };
    const cardRows = cards.rows;
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
        pendingOrders: orders.rows.filter((order) => order.status === "pending").length,
        nfcCards: nfc.rows.length,
        referrals: number(affiliateRow.referrals),
        commission: number(affiliateRow.commission),
      },
      vcards: cardRows,
      vcardEntitlements: entitlements,
      orders: orders.rows,
      nfcCards: nfc.rows,
      notifications: notifications.rows,
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
      `SELECT id, quantity, amount, status, shipping_address, tracking_number, ordered_at
       FROM nfc_orders WHERE user_id = $1 ORDER BY ordered_at DESC`, [req.user.id]
    );
    res.json({ orders: result.rows });
  } catch (error) { next(error); }
};

exports.nfcStore = async (req, res, next) => {
  try {
    const [products, orders, vcards, settingsResult] = await Promise.all([
      pool.query(`SELECT id,name,price,description,front_image,back_image,category
        FROM nfc_products WHERE is_active=TRUE ORDER BY category,price,name`),
      pool.query(`SELECT o.id,o.nfc_product_id,o.vcard_id,o.quantity,o.amount,o.currency,o.status,
          o.payment_status,o.payment_method,o.transaction_number,o.shipping_address,o.tracking_number,
          o.admin_note,o.ordered_at,o.updated_at,p.name product_name,p.front_image,v.title vcard_title
        FROM nfc_orders o LEFT JOIN nfc_products p ON p.id=o.nfc_product_id
        LEFT JOIN vcards v ON v.id=o.vcard_id WHERE o.user_id=$1 ORDER BY o.ordered_at DESC`, [req.user.id]),
      pool.query(`SELECT id,title FROM vcards WHERE user_id=$1 AND is_active=TRUE ORDER BY title,id`, [req.user.id]),
      pool.query(`SELECT key,value FROM settings WHERE key=ANY($1::text[])`, [["default_currency","bank_name","bank_account_name","bank_account_number","bank_branch","bank_swift_code"]]),
    ]);
    const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value || ""]));
    res.json({
      currency: settings.default_currency || "LKR",
      bankDetails: { bankName: settings.bank_name || "", accountName: settings.bank_account_name || "",
        accountNumber: settings.bank_account_number || "", branch: settings.bank_branch || "", swiftCode: settings.bank_swift_code || "" },
      products: products.rows.map((item) => ({ id:item.id,name:item.name,price:number(item.price),description:item.description || "",
        frontImage:item.front_image,backImage:item.back_image,category:item.category || "essential" })),
      vcards: vcards.rows.map((item) => ({ id:item.id,title:item.title || `VCard #${item.id}` })),
      orders: orders.rows.map((item) => ({ id:item.id,productId:item.nfc_product_id,vcardId:item.vcard_id,
        productName:item.product_name || "NFC card",productImage:item.front_image || null,vcardTitle:item.vcard_title || null,
        quantity:number(item.quantity),amount:number(item.amount),currency:item.currency || "LKR",status:item.status,
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
  const uploadedPath = req.file?.path;
  const discardUpload = () => uploadedPath ? fs.unlink(uploadedPath).catch(() => {}) : Promise.resolve();
  if (!req.file) return res.status(400).json({ message: "Upload your bank payment slip" });
  if (!Number.isInteger(productId) || productId < 1) { await discardUpload(); return res.status(400).json({ message: "Select a valid NFC card" }); }
  if (!Number.isInteger(vcardId) || vcardId < 1) { await discardUpload(); return res.status(400).json({ message: "Select the VCard to link" }); }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) { await discardUpload(); return res.status(400).json({ message: "Order between 1 and 100 NFC cards" }); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/# -]{2,254}$/.test(transactionNumber)) { await discardUpload(); return res.status(400).json({ message: "Enter a valid transaction number" }); }
  if (shippingAddress.length < 10 || shippingAddress.length > 2000) { await discardUpload(); return res.status(400).json({ message: "Enter a complete shipping address" }); }
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const productResult = await client.query("SELECT id,name,price FROM nfc_products WHERE id=$1 AND is_active=TRUE FOR SHARE", [productId]);
    const vcardResult = await client.query("SELECT id,title FROM vcards WHERE id=$1 AND user_id=$2 AND is_active=TRUE FOR SHARE", [vcardId,req.user.id]);
    const currencyResult = await client.query("SELECT value FROM settings WHERE key='default_currency'");
    if (!productResult.rowCount || !vcardResult.rowCount) { await client.query("ROLLBACK"); await discardUpload(); return res.status(400).json({ message: "The selected NFC card or VCard is unavailable" }); }
    const duplicate = await client.query("SELECT id FROM nfc_orders WHERE LOWER(transaction_number)=LOWER($1)", [transactionNumber]);
    if (duplicate.rowCount) { await client.query("ROLLBACK"); await discardUpload(); return res.status(409).json({ message: "This transaction number has already been submitted" }); }
    const product = productResult.rows[0], amount = number(product.price) * quantity;
    const currency = currencyResult.rows[0]?.value || "LKR";
    const proofUrl = `/uploads/payment-slips/${req.file.filename}`;
    const result = await client.query(`INSERT INTO nfc_orders(user_id,nfc_product_id,vcard_id,quantity,amount,currency,status,
      shipping_address,payment_method,payment_status,transaction_number,proof_url)
      VALUES($1,$2,$3,$4,$5,$6,'pending',$7,'bank_transfer','pending',$8,$9)
      RETURNING id,amount,currency,status,payment_status,ordered_at`,
      [req.user.id,productId,vcardId,quantity,amount,currency,shippingAddress,transactionNumber,proofUrl]);
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
    features: normalized.benefits, vcardFeatures: normalized.vcardFeatures, templateIds: normalized.templateIds };
}

exports.plans = async (req, res, next) => {
  try {
    const [plansResult, subscriptionsResult, settingsResult, paymentsResult] = await Promise.all([
      pool.query(`SELECT id,name,price,billing_interval,vcard_limit,nfc_limit,analytics_limit,features FROM plans WHERE status='active' ORDER BY price,name`),
      pool.query(`SELECT s.id,s.plan_id,s.status,s.created_at,p.name AS plan_name,
        pay.status AS payment_status,pay.gateway_reference
        FROM subscriptions s LEFT JOIN plans p ON p.id=s.plan_id
        LEFT JOIN LATERAL (SELECT status,gateway_reference FROM payments WHERE subscription_id=s.id ORDER BY created_at DESC LIMIT 1) pay ON TRUE
        WHERE s.user_id=$1 AND s.status IN ('active','pending','trial')
        ORDER BY (s.status='active') DESC,s.created_at DESC`, [req.user.id]),
      pool.query(`SELECT key,value FROM settings WHERE key = ANY($1::text[])`, [["default_currency", "bank_name", "bank_account_name", "bank_account_number", "bank_branch", "bank_swift_code"]]),
      pool.query(`SELECT pay.id,pay.amount,pay.currency,pay.status,pay.gateway_reference,pay.proof_url,
        pay.created_at,pay.reviewed_at,p.name AS plan_name
        FROM payments pay LEFT JOIN subscriptions s ON s.id=pay.subscription_id LEFT JOIN plans p ON p.id=s.plan_id
        WHERE pay.user_id=$1 AND LOWER(COALESCE(pay.method,''))=ANY($2::text[])
        ORDER BY pay.created_at DESC LIMIT 20`, [req.user.id, ["cash", "manual", "bank_transfer", "cash_payment"]]),
    ]);
    const active = subscriptionsResult.rows.find((item) => item.status === "active") || null;
    const pending = subscriptionsResult.rows.find((item) => item.status === "pending") || null;
    const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value || ""]));
    const bankDetails = { bankName: settings.bank_name || "", accountName: settings.bank_account_name || "",
      accountNumber: settings.bank_account_number || "", branch: settings.bank_branch || "", swiftCode: settings.bank_swift_code || "" };
    res.json({ plans: plansResult.rows.map(mapUserPlan), currentPlanId: active ? active.plan_id : null,
      currency: settings.default_currency || "USD", bankDetails,
      bankConfigured: Boolean(bankDetails.bankName && bankDetails.accountName && bankDetails.accountNumber && bankDetails.branch),
      pending: pending ? { id: pending.id, planId: pending.plan_id, planName: pending.plan_name,
        paymentStatus: pending.payment_status || "pending", transactionNumber: pending.gateway_reference || null } : null,
      payments: paymentsResult.rows.map((payment) => ({ id: payment.id, planName: payment.plan_name || "Subscription",
        amount: number(payment.amount), currency: payment.currency, status: payment.status,
        transactionNumber: payment.gateway_reference, proofUrl: payment.proof_url,
        createdAt: payment.created_at, reviewedAt: payment.reviewed_at })) });
  } catch (error) { next(error); }
};

exports.requestPlanUpgrade = async (req, res, next) => {
  return res.status(400).json({ message: "A transaction number and payment slip are required. Use the manual payment form." });
};

exports.submitManualPayment = async (req, res, next) => {
  const planId = Number(req.body.planId);
  const reference = String(req.body.transactionNumber || "").trim();
  const uploadedPath = req.file?.path;
  const discardUpload = () => uploadedPath ? fs.unlink(uploadedPath).catch(() => {}) : Promise.resolve();
  if (!req.file) return res.status(400).json({ message: "Upload your payment slip as JPG, PNG, WebP, or PDF" });
  if (!Number.isInteger(planId) || planId < 1) { await discardUpload(); return res.status(400).json({ message: "Select a valid plan" }); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/# -]{2,254}$/.test(reference)) { await discardUpload(); return res.status(400).json({ message: "Enter a valid transaction number (3 to 255 characters)" }); }

  let client;
  let committed = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const [planResult, activeResult, settingsResult] = await Promise.all([
      client.query("SELECT id,name,price,billing_interval FROM plans WHERE id=$1 AND status='active' FOR SHARE", [planId]),
      client.query(`SELECT s.id,s.plan_id,COALESCE(p.price,0) price FROM subscriptions s LEFT JOIN plans p ON p.id=s.plan_id
        WHERE s.user_id=$1 AND s.status='active' ORDER BY s.created_at DESC LIMIT 1 FOR UPDATE OF s`, [req.user.id]),
      client.query(`SELECT key,value FROM settings WHERE key=ANY($1::text[])`, [["default_currency", "bank_name", "bank_account_name", "bank_account_number", "bank_branch"]]),
    ]);
    const plan = planResult.rows[0];
    if (!plan) { await client.query("ROLLBACK"); await discardUpload(); return res.status(404).json({ message: "This plan is no longer available" }); }
    if (number(plan.price) < 0.01) { await client.query("ROLLBACK"); await discardUpload(); return res.status(400).json({ message: "The free plan does not require payment" }); }
    const active = activeResult.rows[0];
    if (active && Number(active.plan_id) === planId) { await client.query("ROLLBACK"); await discardUpload(); return res.status(409).json({ message: "This is already your current plan" }); }
    if (active && number(plan.price) <= number(active.price)) { await client.query("ROLLBACK"); await discardUpload(); return res.status(400).json({ message: "Choose a plan priced above your current plan" }); }
    const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value || ""]));
    if (![settings.bank_name, settings.bank_account_name, settings.bank_account_number, settings.bank_branch].every(Boolean)) {
      await client.query("ROLLBACK"); await discardUpload();
      return res.status(503).json({ message: "Bank transfer details are not configured yet. Please contact support." });
    }
    const duplicate = await client.query(`SELECT id FROM payments WHERE LOWER(gateway_reference)=LOWER($1)
      AND LOWER(COALESCE(method,''))=ANY($2::text[]) AND status<>'rejected' LIMIT 1`, [reference, ["cash", "manual", "bank_transfer", "cash_payment"]]);
    if (duplicate.rowCount) { await client.query("ROLLBACK"); await discardUpload(); return res.status(409).json({ message: "This transaction number has already been submitted" }); }

    await client.query(`UPDATE payments SET status='rejected',notes=CONCAT_WS(E'\n',notes,'Superseded by a newer payment submission'),updated_at=NOW()
      WHERE subscription_id IN (SELECT id FROM subscriptions WHERE user_id=$1 AND status='pending') AND status='pending'`, [req.user.id]);
    await client.query(`UPDATE subscriptions SET status='cancelled',cancel_reason='Superseded by a newer payment submission',updated_at=NOW()
      WHERE user_id=$1 AND status='pending'`, [req.user.id]);
    const subscription = await client.query(`INSERT INTO subscriptions(user_id,plan_id,status,start_date,auto_renew,cancel_reason)
      VALUES($1,$2,'pending',CURRENT_DATE,FALSE,'Awaiting bank transfer verification') RETURNING id,plan_id,status`, [req.user.id, planId]);
    const proofUrl = `/uploads/payment-slips/${req.file.filename}`;
    const payment = await client.query(`INSERT INTO payments(subscription_id,user_id,amount,currency,method,status,gateway_reference,proof_url,notes)
      VALUES($1,$2,$3,$4,'bank_transfer','pending',$5,$6,'Submitted by user for manual review') RETURNING id,status`,
      [subscription.rows[0].id, req.user.id, plan.price, settings.default_currency || "USD", reference, proofUrl]);
    await client.query(`INSERT INTO transactions(payment_id,user_id,transaction_type,amount,currency,reference,gateway,status,metadata)
      VALUES($1,$2,'cash_payment',$3,$4,$5,'manual','pending',$6::jsonb)`,
      [payment.rows[0].id, req.user.id, plan.price, settings.default_currency || "USD", reference, JSON.stringify({ subscriptionId: subscription.rows[0].id, source: "user_upload" })]);
    await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,'Payment submitted',$2,'billing')`,
      [req.user.id, `Your ${plan.name} payment is waiting for administrator approval. Your current plan remains available until approval.`]);
    await client.query(`INSERT INTO notifications(user_id,title,message,type)
      SELECT u.id,'Manual payment awaiting review',$1,'billing' FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='super_admin'`,
      [`A bank transfer for ${plan.name} was submitted with transaction ${reference}.`]);
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata)
      VALUES($1,'subscription.payment_submitted','payment',$2,$3::jsonb)`, [req.user.id, payment.rows[0].id, JSON.stringify({ planId, subscriptionId: subscription.rows[0].id, transactionNumber: reference })]);
    await client.query("COMMIT");
    committed = true;
    res.status(201).json({ payment: payment.rows[0], subscription: subscription.rows[0], message: "Payment submitted. Your paid plan will activate after administrator approval." });
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
      `SELECT id,template_id,title,description,website_url,phone,email,address,social_links,settings,is_active
       FROM vcards WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Card not found" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    res.json({ vcard: result.rows[0], entitlements });
  } catch (error) { next(error); }
};

exports.createVcard = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
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
    const result = await pool.query(
      `INSERT INTO vcards (user_id,template_id,title,description,website_url,phone,email,address,settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING id,template_id,title,description,website_url,phone,email,address,settings,is_active,created_at`,
      [req.user.id, templateId, title, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null, JSON.stringify({ sections })]
    );
    res.status(201).json({ vcard: result.rows[0] });
  } catch (error) { next(error); }
};

exports.updateVcard = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "Card name is required" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    const templateId = Number(req.body.templateId);
    if (!entitlements.templates.some((template) => Number(template.id) === templateId)) return res.status(403).json({ message: "This VCard template is not included in your plan" });
    const allowedKeys = new Set(entitlements.features.map((feature) => feature.key));
    const sections = normalizeSections(req.body.sections, allowedKeys);
    const result = await pool.query(
      `UPDATE vcards SET template_id=$1,title=$2,description=$3,website_url=$4,phone=$5,
              email=$6,address=$7,settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{sections}',$8::jsonb,TRUE),
              is_active=COALESCE($9,is_active),updated_at=NOW()
       WHERE id=$10 AND user_id=$11
       RETURNING id,template_id,title,description,website_url,phone,email,address,settings,is_active,updated_at`,
      [templateId, title, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null, JSON.stringify(sections), typeof req.body.isActive === "boolean" ? req.body.isActive : null, req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Card not found" });
    res.json({ vcard: result.rows[0] });
  } catch (error) { next(error); }
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
