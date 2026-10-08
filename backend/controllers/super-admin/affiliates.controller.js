const { number } = require('../../helpers/metrics.helper');
const pool = require("../../config/database.config");
const { normalizeCurrency } = require("../../config/currencies");
const { validateTransactionUser } = require('../../services/transaction-user.service');
const { createAffiliateCommissionForPayment } = require('../../services/admin-commission.service');
const { positiveIntegerParam } = require('../../validators/id.validator');
const { payoutMethods } = require('../../config/payout-methods');
const affiliateProfileStatuses = ["pending", "active", "inactive", "suspended"];
const affiliateCommissionTypes = ["percentage", "fixed"];
const affiliateReferralStatuses = ["pending", "qualified", "rejected"];
const affiliateCommissionStatuses = ["pending", "approved", "rejected"];

async function backfillAffiliateCommissionsForReferral(client, referralId) {
  const payments = await client.query(`SELECT pay.id FROM affiliate_referrals ar JOIN payments pay ON pay.user_id=ar.referred_user_id
    WHERE ar.id=$1 AND ar.status='qualified' AND pay.status='approved' ORDER BY pay.id`, [referralId]);
  for (const payment of payments.rows) await createAffiliateCommissionForPayment(client, payment.id);
}

function normalizeAffiliateBankDetails(body) {
  const source = body?.bankDetails && typeof body.bankDetails === "object" ? body.bankDetails : body || {};
  return {
    accountHolder: String(source.accountHolder || "").trim().slice(0, 150),
    bankName: String(source.bankName || "").trim().slice(0, 150),
    accountNumber: String(source.accountNumber || "").trim().slice(0, 100),
    branch: String(source.branch || "").trim().slice(0, 150),
    swiftCode: String(source.swiftCode || "").trim().toUpperCase().slice(0, 20),
  };
}

function normalizeAffiliateProfilePayload(body) {
  return {
    userId: Number(body.userId),
    referralCode: String(body.referralCode || "").trim().toUpperCase(),
    commissionType: String(body.commissionType || "percentage").trim().toLowerCase(),
    commissionValue: Number(body.commissionValue),
    paymentMethod: String(body.paymentMethod || "bank_transfer").trim().toLowerCase(),
    bankDetails: normalizeAffiliateBankDetails(body),
    status: String(body.status || "active").trim().toLowerCase(),
  };
}

function affiliateProfileValidationMessage(profile) {
  if (!Number.isInteger(profile.userId) || profile.userId < 1 || profile.userId > 2147483647) return "Select a valid user";
  if (!/^[A-Z0-9_-]{3,80}$/.test(profile.referralCode)) return "Referral code must contain 3 to 80 letters, numbers, dashes, or underscores";
  if (!affiliateCommissionTypes.includes(profile.commissionType)) return "Invalid commission type";
  if (!Number.isFinite(profile.commissionValue) || profile.commissionValue < 0 || profile.commissionValue > 9999999999.99) return "Enter a valid commission value";
  if (profile.commissionType === "percentage" && profile.commissionValue > 100) return "Percentage commission cannot exceed 100";
  if (!payoutMethods.includes(profile.paymentMethod)) return "Invalid affiliate payment method";
  if (!profile.bankDetails.accountHolder) return "Enter the bank account holder name";
  if (!profile.bankDetails.bankName) return "Enter the bank name";
  if (!profile.bankDetails.accountNumber) return "Enter the bank account number or IBAN";
  if (!affiliateProfileStatuses.includes(profile.status)) return "Invalid affiliate status";
  return null;
}

exports.listAffiliations = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const pattern = search ? `%${search}%` : null;
    const [profilesResult, referralsResult, commissionsResult, usersResult, summaryResult, dueResult] = await Promise.all([
      pool.query(
        `SELECT ap.id, ap.user_id, ap.referral_code, ap.commission_type, ap.commission_value,
                ap.payment_method, ap.payout_details, ap.status, ap.created_at, ap.updated_at,
                u.name AS user_name, u.email AS user_email,
                (SELECT COUNT(*) FROM affiliate_referrals ar WHERE ar.affiliate_id = ap.id)::int AS referral_count,
                (SELECT COUNT(*) FROM affiliate_referrals ar WHERE ar.affiliate_id = ap.id AND ar.status = 'qualified')::int AS qualified_count
         FROM affiliate_profiles ap JOIN users u ON u.id = ap.user_id
         WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1 OR ap.referral_code ILIKE $1 OR ap.status ILIKE $1)
         ORDER BY CASE WHEN ap.status = 'active' THEN 0 ELSE 1 END, ap.created_at DESC`,
        [pattern]
      ),
      pool.query(
        `SELECT ar.id, ar.affiliate_id, ar.referred_user_id, ar.status, ar.joined_at, ar.updated_at,
                owner.name AS affiliate_name, owner.email AS affiliate_email, ap.referral_code,
                referred.name AS referred_name, referred.email AS referred_email,
                (SELECT COUNT(*) FROM affiliate_commissions ac WHERE ac.referral_id=ar.id)::int commission_count
         FROM affiliate_referrals ar JOIN affiliate_profiles ap ON ap.id = ar.affiliate_id
         JOIN users owner ON owner.id = ap.user_id JOIN users referred ON referred.id = ar.referred_user_id
         WHERE ($1::text IS NULL OR owner.name ILIKE $1 OR owner.email ILIKE $1 OR referred.name ILIKE $1 OR referred.email ILIKE $1 OR ap.referral_code ILIKE $1 OR ar.status ILIKE $1)
         ORDER BY ar.joined_at DESC`,
        [pattern]
      ),
      pool.query(
        `SELECT ac.id, ac.affiliate_id, ac.referral_id, ac.payment_id, ac.amount, ac.currency,
                ac.status, ac.description, ac.approved_at, ac.created_at, ac.updated_at,
                owner.name AS affiliate_name, owner.email AS affiliate_email,
                referred.name AS referred_name, approver.name AS approver_name
         FROM affiliate_commissions ac JOIN affiliate_profiles ap ON ap.id = ac.affiliate_id
         JOIN users owner ON owner.id = ap.user_id
         LEFT JOIN affiliate_referrals ar ON ar.id = ac.referral_id
         LEFT JOIN users referred ON referred.id = ar.referred_user_id
         LEFT JOIN users approver ON approver.id = ac.approved_by
         WHERE ($1::text IS NULL OR owner.name ILIKE $1 OR owner.email ILIKE $1 OR COALESCE(referred.name, '') ILIKE $1 OR COALESCE(ac.description, '') ILIKE $1 OR ac.status ILIKE $1)
         ORDER BY CASE WHEN ac.status = 'pending' THEN 0 ELSE 1 END, ac.created_at DESC`,
        [pattern]
      ),
      pool.query(`SELECT u.id, u.name, u.email FROM users u LEFT JOIN roles r ON r.id = u.role_id
                  WHERE COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active' ORDER BY u.name, u.email`),
      pool.query(`SELECT (SELECT COUNT(*) FROM affiliate_profiles WHERE status = 'active')::int AS active_partners,
                         (SELECT COUNT(*) FROM affiliate_referrals WHERE status = 'qualified')::int AS qualified_conversions,
                         (SELECT COUNT(*) FROM affiliate_commissions WHERE status = 'pending')::int AS pending_commissions`),
      pool.query(`WITH earned AS (SELECT currency,SUM(amount) amount FROM affiliate_commissions WHERE status IN ('approved','paid') GROUP BY currency),
        reserved AS (SELECT currency,SUM(amount) amount FROM withdrawals WHERE affiliate_id IS NOT NULL AND status NOT IN ('rejected','cancelled') GROUP BY currency)
        SELECT e.currency,GREATEST(e.amount-COALESCE(r.amount,0),0) amount FROM earned e LEFT JOIN reserved r USING(currency) ORDER BY e.currency`),
    ]);
    res.json({
      partners: profilesResult.rows.map((profile) => ({
        id: profile.id, user: { id: profile.user_id, name: profile.user_name, email: profile.user_email },
        referralCode: profile.referral_code, commissionType: profile.commission_type,
        commissionValue: number(profile.commission_value), paymentMethod: profile.payment_method,
        bankDetails: normalizeAffiliateBankDetails(profile.payout_details || {}),
        status: profile.status, referrals: profile.referral_count, qualified: profile.qualified_count,
        createdAt: profile.created_at, updatedAt: profile.updated_at,
      })),
      referrals: referralsResult.rows.map((referral) => ({
        id: referral.id, affiliateId: referral.affiliate_id,
        affiliate: { name: referral.affiliate_name, email: referral.affiliate_email, code: referral.referral_code },
        user: { id: referral.referred_user_id, name: referral.referred_name, email: referral.referred_email },
        status: referral.status, commissions: referral.commission_count, joinedAt: referral.joined_at, updatedAt: referral.updated_at,
      })),
      commissions: commissionsResult.rows.map((commission) => ({
        id: commission.id, affiliateId: commission.affiliate_id, referralId: commission.referral_id || null,
        paymentId: commission.payment_id || null,
        affiliate: { name: commission.affiliate_name, email: commission.affiliate_email },
        referredName: commission.referred_name || null, amount: number(commission.amount), currency: commission.currency,
        status: commission.status, description: commission.description || null,
        approverName: commission.approver_name || null, approvedAt: commission.approved_at || null,
        createdAt: commission.created_at, updatedAt: commission.updated_at,
      })),
      users: usersResult.rows,
      summary: { ...summaryResult.rows[0], dueByCurrency: dueResult.rows.map((row) => ({ currency: row.currency, amount: number(row.amount) })) },
    });
  } catch (error) { next(error); }
};

exports.createAffiliatePartner = async (req, res, next) => {
  const profile = normalizeAffiliateProfilePayload(req.body);
  const validation = affiliateProfileValidationMessage(profile);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    if (!(await validateTransactionUser(client, profile.userId))) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected user was not found" }); }
    const result = await client.query(
      `INSERT INTO affiliate_profiles (user_id, referral_code, commission_type, commission_value, payment_method, payout_details, status)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id, referral_code, status`,
      [profile.userId, profile.referralCode, profile.commissionType, profile.commissionValue, profile.paymentMethod, JSON.stringify(profile.bankDetails), profile.status]
    );
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1, 'affiliate.created', 'affiliate', $2, $3::jsonb)`, [req.user.id, result.rows[0].id, JSON.stringify({ userId: profile.userId, referralCode: profile.referralCode })]);
    await client.query(`INSERT INTO notifications(user_id,title,message,type) VALUES($1,$2,$3,'affiliate')`,
      [profile.userId, profile.status === "active" ? "Affiliate account activated" : "Affiliate application updated", profile.status === "active" ? "Your affiliate account is active. You can now share your referral link." : `Your affiliate account status is ${profile.status}.`]);
    await client.query("COMMIT"); res.status(201).json({ partner: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "This user or referral code already has an affiliate profile" });
    next(error);
  } finally { if (client) client.release(); }
};

exports.updateAffiliatePartner = async (req, res, next) => {
  const affiliateId = positiveIntegerParam(req);
  if (!affiliateId) return res.status(400).json({ message: "Invalid affiliate ID" });
  const profile = normalizeAffiliateProfilePayload(req.body);
  const validation = affiliateProfileValidationMessage(profile);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    if (!(await validateTransactionUser(client, profile.userId))) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected user was not found" }); }
    const previous = await client.query("SELECT status FROM affiliate_profiles WHERE id=$1 FOR UPDATE", [affiliateId]);
    if (!previous.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Affiliate partner not found" }); }
    const result = await client.query(
      `UPDATE affiliate_profiles SET user_id=$1, referral_code=$2, commission_type=$3, commission_value=$4,
       payment_method=$5, payout_details=$6::jsonb, status=$7, updated_at=NOW() WHERE id=$8 RETURNING id, referral_code, status`,
      [profile.userId, profile.referralCode, profile.commissionType, profile.commissionValue, profile.paymentMethod, JSON.stringify(profile.bankDetails), profile.status, affiliateId]
    );
    if (profile.status !== previous.rows[0].status) await client.query(`INSERT INTO notifications(user_id,title,message,type)
      VALUES($1,$2,$3,'affiliate')`, [profile.userId, profile.status === "active" ? "Affiliate application approved" : "Affiliate account updated",
      profile.status === "active" ? "Your affiliate account is active. Start sharing your referral link." : `Your affiliate account status changed to ${profile.status}.`]);
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1, 'affiliate.updated', 'affiliate', $2, $3::jsonb)`, [req.user.id, affiliateId, JSON.stringify({ userId: profile.userId, referralCode: profile.referralCode, status: profile.status })]);
    await client.query("COMMIT"); res.json({ partner: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "This user or referral code already has an affiliate profile" });
    next(error);
  } finally { if (client) client.release(); }
};

exports.deleteAffiliatePartner = async (req, res, next) => {
  const affiliateId = positiveIntegerParam(req);
  if (!affiliateId) return res.status(400).json({ message: "Invalid affiliate ID" });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const dependencies = await client.query(`SELECT (SELECT COUNT(*) FROM affiliate_referrals WHERE affiliate_id=$1)::int referrals, (SELECT COUNT(*) FROM affiliate_commissions WHERE affiliate_id=$1)::int commissions, (SELECT COUNT(*) FROM withdrawals WHERE affiliate_id=$1)::int withdrawals`, [affiliateId]);
    const counts = dependencies.rows[0];
    if (counts.referrals || counts.commissions || counts.withdrawals) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Remove this partner's referrals, commissions, and withdrawals before deleting it" }); }
    const result = await client.query("DELETE FROM affiliate_profiles WHERE id=$1 RETURNING id, referral_code", [affiliateId]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Affiliate partner not found" }); }
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1, 'affiliate.deleted', 'affiliate', $2, $3::jsonb)`, [req.user.id, affiliateId, JSON.stringify(result.rows[0])]);
    await client.query("COMMIT"); res.json({ message: "Affiliate partner deleted successfully" });
  } catch (error) { if (client) await client.query("ROLLBACK").catch(() => {}); next(error); }
  finally { if (client) client.release(); }
};

function normalizeAffiliateReferralPayload(body) {
  return { affiliateId: Number(body.affiliateId), userId: Number(body.userId), status: String(body.status || "pending").toLowerCase() };
}

exports.createAffiliateReferral = async (req, res, next) => {
  const referral = normalizeAffiliateReferralPayload(req.body);
  if (!Number.isInteger(referral.affiliateId) || referral.affiliateId < 1 || !Number.isInteger(referral.userId) || referral.userId < 1) return res.status(400).json({ message: "Select an affiliate and referred user" });
  if (!affiliateReferralStatuses.includes(referral.status)) return res.status(400).json({ message: "Invalid referral status" });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const relations = await client.query(`SELECT ap.user_id AS owner_id, EXISTS(SELECT 1 FROM users WHERE id=$2) AS user_exists FROM affiliate_profiles ap WHERE ap.id=$1`, [referral.affiliateId, referral.userId]);
    if (!relations.rowCount || !relations.rows[0].user_exists) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Affiliate or referred user was not found" }); }
    if (Number(relations.rows[0].owner_id) === referral.userId) { await client.query("ROLLBACK"); return res.status(400).json({ message: "An affiliate cannot refer their own account" }); }
    const result = await client.query(`INSERT INTO affiliate_referrals (affiliate_id,referred_user_id,status) VALUES($1,$2,$3) RETURNING id,status`, [referral.affiliateId, referral.userId, referral.status]);
    if (referral.status === "qualified") await backfillAffiliateCommissionsForReferral(client, result.rows[0].id);
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,'affiliate_referral.created','affiliate_referral',$2,$3::jsonb)`, [req.user.id, result.rows[0].id, JSON.stringify(referral)]);
    await client.query("COMMIT"); res.status(201).json({ referral: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "This user is already assigned to an affiliate" });
    next(error);
  } finally { if (client) client.release(); }
};

exports.updateAffiliateReferral = async (req, res, next) => {
  const referralId = positiveIntegerParam(req);
  if (!referralId) return res.status(400).json({ message: "Invalid referral ID" });
  const referral = normalizeAffiliateReferralPayload(req.body);
  if (!Number.isInteger(referral.affiliateId) || referral.affiliateId < 1 || !Number.isInteger(referral.userId) || referral.userId < 1 || !affiliateReferralStatuses.includes(referral.status)) return res.status(400).json({ message: "Enter a valid affiliate, user, and status" });
  let client;
  try {
    client=await pool.connect();await client.query("BEGIN");
    const result = await client.query(`UPDATE affiliate_referrals ar SET affiliate_id=$1,referred_user_id=$2,status=$3,updated_at=NOW() WHERE id=$4 AND $2<>(SELECT user_id FROM affiliate_profiles WHERE id=$1) RETURNING id,status`, [referral.affiliateId, referral.userId, referral.status, referralId]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Referral not found or relation is invalid" }); }
    if (referral.status === "qualified") await backfillAffiliateCommissionsForReferral(client, referralId);
    await client.query(`INSERT INTO notifications(user_id,title,message,type)
      SELECT ap.user_id,$1,$2,'affiliate' FROM affiliate_profiles ap WHERE ap.id=$3`,
      [referral.status === "qualified" ? "Referral qualified" : "Referral status updated", `A referral is now ${referral.status}.`, referral.affiliateId]);
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,'affiliate_referral.updated','affiliate_referral',$2,$3::jsonb)`, [req.user.id, referralId, JSON.stringify(referral)]);
    await client.query("COMMIT");res.json({ referral: result.rows[0] });
  } catch (error) { if(client)await client.query("ROLLBACK").catch(()=>{});if (error.code === "23505") return res.status(409).json({ message: "This user is already assigned to an affiliate" }); next(error); }
  finally{if(client)client.release();}
};

exports.deleteAffiliateReferral = async (req, res, next) => {
  const referralId = positiveIntegerParam(req);
  if (!referralId) return res.status(400).json({ message: "Invalid referral ID" });
  try {
    const commissions = await pool.query("SELECT COUNT(*)::int count FROM affiliate_commissions WHERE referral_id=$1", [referralId]);
    if (commissions.rows[0].count) return res.status(409).json({ message: "This referral has commission history and must be retained" });
    const result = await pool.query("DELETE FROM affiliate_referrals WHERE id=$1 RETURNING id,affiliate_id,referred_user_id", [referralId]);
    if (!result.rowCount) return res.status(404).json({ message: "Referral not found" });
    await pool.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,'affiliate_referral.deleted','affiliate_referral',$2,$3::jsonb)`, [req.user.id, referralId, JSON.stringify(result.rows[0])]);
    res.json({ message: "Referral deleted successfully" });
  } catch (error) { next(error); }
};

function normalizeAffiliateCommissionPayload(body) {
  return { affiliateId: Number(body.affiliateId), referralId: body.referralId ? Number(body.referralId) : null, amount: Number(body.amount), currency: String(body.currency || "USD").toUpperCase(), status: String(body.status || "pending").toLowerCase(), description: String(body.description || "").trim() || null };
}

function affiliateCommissionValidationMessage(commission) {
  if (!Number.isInteger(commission.affiliateId) || commission.affiliateId < 1) return "Select an affiliate partner";
  if (commission.referralId !== null && (!Number.isInteger(commission.referralId) || commission.referralId < 1)) return "Select a valid referral";
  if (!Number.isFinite(commission.amount) || commission.amount < 0.01 || commission.amount > 9999999999.99) return "Enter a valid positive commission amount";
  if (!normalizeCurrency(commission.currency)) return "Select a valid ISO 4217 currency";
  if (!affiliateCommissionStatuses.includes(commission.status)) return "Invalid commission status";
  if (commission.description && commission.description.length > 3000) return "Description must not exceed 3,000 characters";
  return null;
}

async function saveAffiliateCommission(req, res, next, commissionId) {
  const commission = normalizeAffiliateCommissionPayload(req.body);
  if (!commissionId && commission.status !== "pending") return res.status(400).json({ message: "New commissions must start as pending" });
  const validation = affiliateCommissionValidationMessage(commission);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    let previous = null;
    if (commissionId) {
      const previousResult = await client.query(`SELECT id,affiliate_id,amount,currency,status FROM affiliate_commissions WHERE id=$1 FOR UPDATE`, [commissionId]);
      if (!previousResult.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Commission not found" }); }
      previous = previousResult.rows[0];
      if (previous.status === "rejected") { await client.query("ROLLBACK"); return res.status(409).json({ message: "Rejected commissions are final" }); }
      if (previous.status === "approved" && (commission.status !== "approved" || Number(previous.affiliate_id) !== commission.affiliateId || number(previous.amount) !== commission.amount || previous.currency !== commission.currency)) {
        await client.query("ROLLBACK"); return res.status(409).json({ message: "Approved commission financial details are locked" });
      }
      if (previous.status === "pending" && !["pending","approved","rejected"].includes(commission.status)) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Invalid commission status transition" }); }
    }
    const relation = await client.query(`SELECT EXISTS(SELECT 1 FROM affiliate_profiles WHERE id=$1) AS affiliate_exists, CASE WHEN $2::integer IS NULL THEN TRUE ELSE EXISTS(SELECT 1 FROM affiliate_referrals WHERE id=$2 AND affiliate_id=$1) END AS referral_valid`, [commission.affiliateId, commission.referralId]);
    if (!relation.rows[0].affiliate_exists || !relation.rows[0].referral_valid) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Affiliate or referral relation is invalid" }); }
    const values = [commission.affiliateId, commission.referralId, commission.amount, commission.currency, commission.status, commission.description, req.user.id];
    const result = commissionId
      ? await client.query(`UPDATE affiliate_commissions SET affiliate_id=$1,referral_id=$2,amount=$3,currency=$4,status=$5::varchar,description=$6,approved_by=CASE WHEN $5::varchar='approved' THEN $7::integer ELSE NULL END,approved_at=CASE WHEN $5::varchar='approved' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$8 RETURNING id,status`, [...values, commissionId])
      : await client.query(`INSERT INTO affiliate_commissions (affiliate_id,referral_id,amount,currency,status,description,approved_by,approved_at) VALUES($1,$2,$3,$4,$5::varchar,$6,CASE WHEN $5::varchar='approved' THEN $7::integer ELSE NULL END,CASE WHEN $5::varchar='approved' THEN NOW() ELSE NULL END) RETURNING id,status`, values);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Commission not found" }); }
    if (["approved","rejected"].includes(commission.status)) await client.query(`INSERT INTO notifications(user_id,title,message,type)
      SELECT user_id,$1,$2,'affiliate' FROM affiliate_profiles WHERE id=$3`,
      [commission.status === "approved" ? "Commission approved" : "Commission rejected", commission.status === "approved" ? `${commission.currency} ${commission.amount.toFixed(2)} is now available for withdrawal.` : "A pending affiliate commission was rejected.", commission.affiliateId]);
    await client.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,$2,'affiliate_commission',$3,$4::jsonb)`, [req.user.id, commissionId ? "affiliate_commission.updated" : "affiliate_commission.created", result.rows[0].id, JSON.stringify(commission)]);
    await client.query("COMMIT"); res.status(commissionId ? 200 : 201).json({ commission: result.rows[0] });
  } catch (error) { if (client) await client.query("ROLLBACK").catch(() => {}); next(error); }
  finally { if (client) client.release(); }
}

exports.createAffiliateCommission = (req, res, next) => saveAffiliateCommission(req, res, next, null);
exports.updateAffiliateCommission = (req, res, next) => {
  const commissionId = positiveIntegerParam(req);
  if (!commissionId) return res.status(400).json({ message: "Invalid commission ID" });
  return saveAffiliateCommission(req, res, next, commissionId);
};

exports.deleteAffiliateCommission = async (req, res, next) => {
  const commissionId = positiveIntegerParam(req);
  if (!commissionId) return res.status(400).json({ message: "Invalid commission ID" });
  try {
    const existing = await pool.query("SELECT status FROM affiliate_commissions WHERE id=$1", [commissionId]);
    if (!existing.rowCount) return res.status(404).json({ message: "Commission not found" });
    if (existing.rows[0].status === "approved") return res.status(409).json({ message: "Approved commissions are retained for financial audit" });
    const result = await pool.query("DELETE FROM affiliate_commissions WHERE id=$1 AND status IN ('pending','rejected') RETURNING id,affiliate_id,amount,currency,status", [commissionId]);
    if (!result.rowCount) return res.status(404).json({ message: "Commission not found" });
    await pool.query(`INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata) VALUES ($1,'affiliate_commission.deleted','affiliate_commission',$2,$3::jsonb)`, [req.user.id, commissionId, JSON.stringify(result.rows[0])]);
    res.json({ message: "Commission deleted successfully" });
  } catch (error) { next(error); }
};

