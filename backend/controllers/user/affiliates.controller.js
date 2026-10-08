const { number } = require('../../helpers/metrics.helper');
const pool = require("../../config/database.config");
const path = require("path");
const { normalizeCurrency } = require("../../config/currencies");
const { BASE_CURRENCY } = require("../../services/exchange-rate.service");
function affiliateMoneyRows(rows) {
  return rows.map((row) => ({ currency: row.currency, earned: number(row.earned), pending: number(row.pending),
    reserved: number(row.reserved), available: Math.max(0, number(row.earned) - number(row.reserved)) }));
}

function affiliateBankDetails(body) {
  const source = body?.bankDetails && typeof body.bankDetails === "object" ? body.bankDetails : body || {};
  return {
    accountHolder: String(source.accountHolder || "").trim().slice(0, 150),
    bankName: String(source.bankName || "").trim().slice(0, 150),
    accountNumber: String(source.accountNumber || "").trim().slice(0, 100),
    branch: String(source.branch || "").trim().slice(0, 150),
    swiftCode: String(source.swiftCode || "").trim().toUpperCase().slice(0, 20),
  };
}

function affiliateBankValidation(details) {
  if (!details.accountHolder) return "Enter the bank account holder name";
  if (!details.bankName) return "Enter the bank name";
  if (!details.accountNumber) return "Enter the bank account number";
  return null;
}

exports.affiliations = async (req, res, next) => {
  try {
    const profileResult = await pool.query(
      `SELECT ap.id,ap.referral_code,ap.commission_type,ap.commission_value,ap.payment_method,
              ap.payout_details,ap.status,ap.created_at,u.preferred_currency,
              COALESCE((SELECT value FROM settings WHERE key='affiliate_minimum_withdrawal'),'10') minimum_withdrawal
       FROM affiliate_profiles ap JOIN users u ON u.id=ap.user_id WHERE ap.user_id=$1`, [req.user.id]
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
      pool.query(`SELECT id,amount,currency,method,status,account_details,request_note,admin_note,transfer_receipt_url,reviewed_at,processed_at,created_at
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
        commissionValue: number(profile.commission_value),
        payoutDetails: profile.payout_details?.label || "", bankDetails: affiliateBankDetails(profile.payout_details || {}),
        preferredCurrency: normalizeCurrency(profile.preferred_currency, BASE_CURRENCY), paymentMethod: "bank_transfer", status: profile.status, createdAt: profile.created_at },
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
        receiptAvailable: Boolean(row.transfer_receipt_url), processedAt: row.processed_at, createdAt: row.created_at })),
      balances: affiliateMoneyRows(balances.rows),
    });
  } catch (error) { next(error); }
};

exports.applyForAffiliate = async (req, res, next) => {
  const referralCode = String(req.body.referralCode || "").trim().toUpperCase();
  const paymentMethod = "bank_transfer";
  const bankDetails = affiliateBankDetails(req.body);
  const bankValidation = affiliateBankValidation(bankDetails);
  if (!/^[A-Z0-9_-]{3,80}$/.test(referralCode)) return res.status(400).json({ message: "Choose a referral code using 3 to 80 letters, numbers, dashes, or underscores" });
  if (bankValidation) return res.status(400).json({ message: bankValidation });
  try {
    const result = await pool.query(`INSERT INTO affiliate_profiles(user_id,referral_code,commission_type,commission_value,payment_method,payout_details,status)
      VALUES($1,$2,'percentage',10,$3,$4::jsonb,'pending') RETURNING id,referral_code,status`,
      [req.user.id, referralCode, paymentMethod, JSON.stringify(bankDetails)]);
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
  const paymentMethod = "bank_transfer";
  const bankDetails = affiliateBankDetails(req.body);
  const bankValidation = affiliateBankValidation(bankDetails);
  if (bankValidation) return res.status(400).json({ message: bankValidation });
  try {
    const result = await pool.query(`UPDATE affiliate_profiles SET payment_method=$1,payout_details=$2::jsonb,updated_at=NOW()
      WHERE user_id=$3 AND status IN ('pending','active') RETURNING id,payment_method,status`, [paymentMethod, JSON.stringify(bankDetails), req.user.id]);
    if (!result.rowCount) return res.status(404).json({ message: "Active affiliate profile not found" });
    res.json({ profile: result.rows[0], message: "Payout details updated" });
  } catch (error) { next(error); }
};

exports.requestAffiliateWithdrawal = async (req, res, next) => {
  const amount = Number(req.body.amount);
  const currency = String(req.body.currency || "USD").trim().toUpperCase();
  const note = String(req.body.note || "").trim() || null;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) return res.status(400).json({ message: "Enter a valid withdrawal amount" });
  if (!normalizeCurrency(currency)) return res.status(400).json({ message: "Select a supported currency" });
  if (note && note.length > 3000) return res.status(400).json({ message: "Withdrawal note is too long" });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    const profileResult = await client.query(`SELECT ap.id,ap.payment_method,ap.payout_details,
      COALESCE((SELECT value::numeric FROM settings WHERE key='affiliate_minimum_withdrawal'),10) minimum
      FROM affiliate_profiles ap WHERE ap.user_id=$1 AND ap.status='active' FOR UPDATE`, [req.user.id]);
    if (!profileResult.rowCount) { await client.query("ROLLBACK"); return res.status(403).json({ message: "Your affiliate account is not active" }); }
    const profile = profileResult.rows[0];
    const bankDetails = affiliateBankDetails(profile.payout_details || {});
    const bankValidation = affiliateBankValidation(bankDetails);
    if (bankValidation) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Complete your bank details before requesting a withdrawal" }); }
    if (amount < number(profile.minimum)) { await client.query("ROLLBACK"); return res.status(400).json({ message: `Minimum withdrawal is ${currency} ${number(profile.minimum).toFixed(2)}` }); }
    const balanceResult = await client.query(`SELECT
      COALESCE((SELECT SUM(amount) FROM affiliate_commissions WHERE affiliate_id=$1 AND currency=$2 AND status IN ('approved','paid')),0) earned,
      COALESCE((SELECT SUM(amount) FROM withdrawals WHERE affiliate_id=$1 AND currency=$2 AND status NOT IN ('rejected','cancelled')),0) reserved`, [profile.id, currency]);
    const available = number(balanceResult.rows[0].earned) - number(balanceResult.rows[0].reserved);
    if (amount > available) { await client.query("ROLLBACK"); return res.status(409).json({ message: `Only ${currency} ${Math.max(0, available).toFixed(2)} is available` }); }
    const result = await client.query(`INSERT INTO withdrawals(user_id,affiliate_id,amount,currency,method,status,account_details,request_note)
      VALUES($1,$2,$3,$4,$5,'pending',$6::jsonb,$7) RETURNING id,amount,currency,status`,
      [req.user.id, profile.id, amount, currency, "bank_transfer", JSON.stringify(bankDetails), note]);
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

exports.downloadAffiliateWithdrawalReceipt = async (req, res, next) => {
  const withdrawalId = Number(req.params.id);
  if (!Number.isInteger(withdrawalId) || withdrawalId < 1) return res.status(400).json({ message: "Invalid withdrawal ID" });
  try {
    const result = await pool.query("SELECT transfer_receipt_url FROM withdrawals WHERE id=$1 AND user_id=$2", [withdrawalId, req.user.id]);
    if (!result.rowCount || !result.rows[0].transfer_receipt_url) return res.status(404).json({ message: "Transfer receipt is not available" });
    const receiptUrl = result.rows[0].transfer_receipt_url;
    if (!/^\/uploads\/payment-slips\/[A-Za-z0-9._-]+$/.test(receiptUrl)) return res.status(400).json({ message: "Invalid receipt path" });
    const uploadRoot = path.resolve(__dirname, "..", "..", "uploads", "payment-slips");
    const filePath = path.resolve(uploadRoot, path.basename(receiptUrl));
    if (!filePath.startsWith(uploadRoot + path.sep)) return res.status(400).json({ message: "Invalid receipt path" });
    res.download(filePath, `withdrawal-${withdrawalId}-receipt${path.extname(filePath)}`);
  } catch (error) { next(error); }
};

