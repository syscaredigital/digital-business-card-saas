const { number } = require('../../helpers/metrics.helper');
const { currentSubscription } = require('../../services/subscription-policy');
const { captureRevenueRate } = require('../../services/revenue.service');
const pool = require("../../config/database.config");
const fs = require("fs/promises");
const path = require("path");
const { normalizePlanFeatures } = require("../../config/vcard-features");
const { normalizeCurrency } = require("../../config/currencies");
const { BASE_CURRENCY, getRate, convertFromLkr } = require("../../services/exchange-rate.service");
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
        WHERE s.user_id=$1 AND s.status IN ('active','pending','trial') AND (s.status='pending' OR (s.start_date<=CURRENT_DATE AND (s.end_date IS NULL OR s.end_date>=CURRENT_DATE)))
        ORDER BY (${currentSubscription()}) DESC,s.created_at DESC`, [req.user.id]),
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
  const couponCurrency = normalizeCurrency(coupon.currency, BASE_CURRENCY);
  const purchaseCurrency = normalizeCurrency(currency, BASE_CURRENCY);
  let minimumAmount = Number(coupon.minimum_amount);
  let fixedDiscountValue = Number(coupon.discount_value);
  if (couponCurrency !== purchaseCurrency && (minimumAmount > 0 || coupon.discount_type === "fixed")) {
    const [couponRate, purchaseRate] = await Promise.all([getRate(couponCurrency), getRate(purchaseCurrency)]);
    const convertCouponMoney = (value) => Number((Number(value) / couponRate.rate * purchaseRate.rate).toFixed(2));
    minimumAmount = convertCouponMoney(minimumAmount);
    fixedDiscountValue = convertCouponMoney(fixedDiscountValue);
  }
  if (Number(originalAmount) < minimumAmount) {
    return { error: `Minimum purchase amount is ${purchaseCurrency} ${minimumAmount.toFixed(2)}`, status: 409 };
  }
  const rawDiscount = coupon.discount_type === "percentage"
    ? Number(originalAmount) * Number(coupon.discount_value) / 100
    : fixedDiscountValue;
  const discountAmount = Number(Math.min(rawDiscount, Number(originalAmount)).toFixed(2));
  const finalAmount = Number((Number(originalAmount) - discountAmount).toFixed(2));
  return {
    coupon,
    discountAmount,
    finalAmount,
    originalAmount: Number(Number(originalAmount).toFixed(2)),
    currency: purchaseCurrency,
    couponCurrency,
    convertedFixedDiscount: coupon.discount_type === "fixed" ? fixedDiscountValue : null,
    convertedMinimumAmount: minimumAmount,
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
        configuredCurrency: calculation.couponCurrency,
      },
      originalAmount: calculation.originalAmount,
      discountAmount: calculation.discountAmount,
      finalAmount: calculation.finalAmount,
      currency: calculation.currency,
      message: "Coupon applied successfully",
    });
  } catch (error) { next(error); }
};

exports.availableCoupons = async (req, res, next) => {
  const planId = Number(req.query.planId);
  if (!Number.isInteger(planId) || planId < 1) return res.status(400).json({ message: "Select a valid plan" });
  try {
    const [userResult, planResult, couponResult] = await Promise.all([
      pool.query("SELECT preferred_currency FROM users WHERE id=$1", [req.user.id]),
      pool.query("SELECT id,name,price FROM plans WHERE id=$1 AND status='active'", [planId]),
      pool.query(`SELECT code FROM coupon_codes
        WHERE is_public=TRUE AND status='active'
          AND (applicable_plan_id IS NULL OR applicable_plan_id=$1)
          AND (starts_at IS NULL OR starts_at<=NOW())
          AND (expires_at IS NULL OR expires_at>NOW())
        ORDER BY expires_at ASC NULLS LAST,created_at DESC LIMIT 50`, [planId]),
    ]);
    if (!planResult.rowCount) return res.status(404).json({ message: "Plan not found" });
    const currency = normalizeCurrency(userResult.rows[0]?.preferred_currency, BASE_CURRENCY);
    const exchange = await getRate(currency);
    const originalAmount = convertFromLkr(planResult.rows[0].price, exchange.rate);
    const coupons = [];
    for (const row of couponResult.rows) {
      const calculation = await calculateUserCoupon(pool, { code:row.code,userId:req.user.id,planId,originalAmount,currency,lock:false });
      if (calculation.error) continue;
      coupons.push({
        code: calculation.coupon.code,
        name: calculation.coupon.name,
        discountType: calculation.coupon.discount_type,
        discountValue: number(calculation.coupon.discount_value),
        configuredCurrency: calculation.couponCurrency,
        discountAmount: calculation.discountAmount,
        finalAmount: calculation.finalAmount,
        originalAmount: calculation.originalAmount,
        currency: calculation.currency,
        expiresAt: calculation.coupon.expires_at || null,
      });
    }
    res.json({ planId, planName:planResult.rows[0].name, currency, coupons });
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
    const userResult = await client.query("SELECT preferred_currency FROM users WHERE id=$1 FOR UPDATE",[req.user.id]);
    const planResult = await client.query("SELECT id,name,price,billing_interval FROM plans WHERE id=$1 AND status='active' FOR SHARE",[planId]);
    const activeResult = await client.query(`SELECT s.id,s.plan_id,COALESCE(p.price,0) price FROM subscriptions s LEFT JOIN plans p ON p.id=s.plan_id
      WHERE s.user_id=$1 AND ${currentSubscription()} ORDER BY s.created_at DESC LIMIT 1 FOR UPDATE OF s`,[req.user.id]);
    const settingsResult = await client.query("SELECT key,value FROM settings WHERE key=ANY($1::text[])",[["default_currency","bank_name","bank_account_name","bank_account_number","bank_branch"]]);
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
      VALUES($1,$2,$3::varchar,CURRENT_DATE,
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
      VALUES($1,$2,$3,$4,$5,$6::varchar,$7,$8,$9,CASE WHEN $6::varchar='approved' THEN NOW() ELSE NULL END) RETURNING id,status,amount,currency`,
      [subscription.rows[0].id, req.user.id, payableAmount, purchaseCurrency,
        fullyDiscounted ? "coupon" : "bank_transfer", fullyDiscounted ? "approved" : "pending",
        paymentReference, proofUrl, couponCalculation ? `Coupon ${couponCalculation.coupon.code} applied` : "Submitted by user for manual review"]);
    await captureRevenueRate(client, 'payment', payment.rows[0].id, exchange);
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

