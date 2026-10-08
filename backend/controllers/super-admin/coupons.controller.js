const { number } = require('../../helpers/metrics.helper');
const pool = require("../../config/database.config");
const { normalizeCurrency } = require("../../config/currencies");
const { positiveIntegerParam } = require('../../validators/id.validator');
const couponStatuses = ["active", "inactive", "expired"];
const couponDiscountTypes = ["percentage", "fixed"];

function nullableCouponDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
}

function normalizeCouponPayload(body) {
  return {
    code: String(body.code || "").trim().toUpperCase(),
    name: String(body.name || "").trim(),
    discountType: String(body.discountType || "percentage").toLowerCase(),
    discountValue: Number(body.discountValue),
    currency: String(body.currency || "USD").trim().toUpperCase(),
    usageLimit: body.usageLimit === "" || body.usageLimit === null || body.usageLimit === undefined ? null : Number(body.usageLimit),
    perUserLimit: Number(body.perUserLimit || 1),
    minimumAmount: Number(body.minimumAmount || 0),
    planId: body.planId ? Number(body.planId) : null,
    startsAt: nullableCouponDate(body.startsAt),
    expiresAt: nullableCouponDate(body.expiresAt),
    status: String(body.status || "active").toLowerCase(),
    isPublic: body.isPublic !== false && String(body.isPublic).toLowerCase() !== "false",
  };
}

function couponValidationMessage(coupon) {
  if (!/^[A-Z0-9_-]{3,80}$/.test(coupon.code)) return "Code must be 3 to 80 letters, numbers, hyphens, or underscores";
  if (!coupon.name || coupon.name.length > 150) return "Name is required and must not exceed 150 characters";
  if (!couponDiscountTypes.includes(coupon.discountType)) return "Invalid discount type";
  if (!Number.isFinite(coupon.discountValue) || coupon.discountValue < 0.01 || coupon.discountValue > 9999999999.99) return "Enter a valid discount value";
  if (coupon.discountType === "percentage" && coupon.discountValue > 100) return "Percentage discounts cannot exceed 100%";
  if (!normalizeCurrency(coupon.currency)) return "Select a valid ISO 4217 currency";
  if (coupon.usageLimit !== null && (!Number.isInteger(coupon.usageLimit) || coupon.usageLimit < 1 || coupon.usageLimit > 2147483647)) return "Usage limit must be a positive whole number";
  if (!Number.isInteger(coupon.perUserLimit) || coupon.perUserLimit < 1 || coupon.perUserLimit > 2147483647) return "Per-user limit must be a positive whole number";
  if (!Number.isFinite(coupon.minimumAmount) || coupon.minimumAmount < 0 || coupon.minimumAmount > 9999999999.99) return "Enter a valid minimum amount";
  if (coupon.planId !== null && (!Number.isInteger(coupon.planId) || coupon.planId < 1 || coupon.planId > 2147483647)) return "Select a valid plan";
  if (coupon.startsAt === "invalid" || coupon.expiresAt === "invalid") return "Enter valid promotion dates";
  if (coupon.startsAt && coupon.expiresAt && new Date(coupon.expiresAt) <= new Date(coupon.startsAt)) return "Expiry must be after the start date";
  if (!couponStatuses.includes(coupon.status)) return "Invalid coupon status";
  return null;
}

function mapCoupon(row) {
  const now = Date.now();
  const usedCount = Number(row.used_count || 0);
  let effectiveStatus = row.status;
  if (effectiveStatus === "active" && row.starts_at && new Date(row.starts_at).getTime() > now) effectiveStatus = "scheduled";
  if (effectiveStatus === "active" && row.expires_at && new Date(row.expires_at).getTime() <= now) effectiveStatus = "expired";
  if (effectiveStatus === "active" && row.usage_limit !== null && usedCount >= Number(row.usage_limit)) effectiveStatus = "exhausted";
  return {
    id: row.id, code: row.code, name: row.name, discountType: row.discount_type,
    discountValue: number(row.discount_value), currency: row.currency,
    usageLimit: row.usage_limit === null ? null : Number(row.usage_limit), perUserLimit: Number(row.per_user_limit),
    usedCount, remaining: row.usage_limit === null ? null : Math.max(Number(row.usage_limit) - usedCount, 0),
    minimumAmount: number(row.minimum_amount), planId: row.applicable_plan_id || null,
    planName: row.plan_name || null, startsAt: row.starts_at, expiresAt: row.expires_at,
    status: row.status, isPublic: Boolean(row.is_public), effectiveStatus, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

exports.listCoupons = async (req, res, next) => {
  const search = String(req.query.search || "").trim().slice(0, 100);
  const pattern = search ? `%${search}%` : null;
  try {
    const [couponsResult, redemptionsResult, plansResult, usersResult, summaryResult, discountTotalsResult] = await Promise.all([
      pool.query(`SELECT c.*, p.name plan_name, COUNT(cr.id) FILTER (WHERE cr.status IN ('pending','applied'))::int used_count
        FROM coupon_codes c LEFT JOIN plans p ON p.id=c.applicable_plan_id LEFT JOIN coupon_redemptions cr ON cr.coupon_id=c.id
        WHERE ($1::text IS NULL OR c.code ILIKE $1 OR c.name ILIKE $1 OR c.status ILIKE $1 OR COALESCE(p.name,'') ILIKE $1)
        GROUP BY c.id,p.name ORDER BY c.created_at DESC`, [pattern]),
      pool.query(`SELECT cr.*, c.code, c.name coupon_name, u.name user_name, u.email user_email, p.name plan_name
        FROM coupon_redemptions cr JOIN coupon_codes c ON c.id=cr.coupon_id LEFT JOIN users u ON u.id=cr.user_id LEFT JOIN plans p ON p.id=cr.plan_id
        WHERE ($1::text IS NULL OR c.code ILIKE $1 OR c.name ILIKE $1 OR COALESCE(u.name,'') ILIKE $1 OR COALESCE(u.email,'') ILIKE $1 OR COALESCE(p.name,'') ILIKE $1)
        ORDER BY cr.redeemed_at DESC`, [pattern]),
      pool.query("SELECT id,name,price,billing_interval FROM plans WHERE status='active' ORDER BY name"),
      pool.query(`SELECT u.id,u.name,u.email FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE COALESCE(r.name,'user')<>'super_admin' AND u.status='active' ORDER BY u.name,u.email`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE c.status='active' AND (c.starts_at IS NULL OR c.starts_at<=NOW()) AND (c.expires_at IS NULL OR c.expires_at>NOW()) AND (c.usage_limit IS NULL OR COALESCE(r.used,0)<c.usage_limit))::int active_coupons,
        COUNT(*) FILTER (WHERE c.status='active' AND c.expires_at>NOW() AND c.expires_at<=NOW()+INTERVAL '7 days')::int ending_soon,
        (SELECT COUNT(*) FROM coupon_redemptions WHERE status='applied')::int total_redemptions
        FROM coupon_codes c LEFT JOIN (SELECT coupon_id,COUNT(*)::int used FROM coupon_redemptions WHERE status IN ('pending','applied') GROUP BY coupon_id) r ON r.coupon_id=c.id`),
      pool.query(`SELECT currency,COALESCE(SUM(discount_amount),0) amount FROM coupon_redemptions WHERE status='applied' AND redeemed_at>=DATE_TRUNC('month',CURRENT_DATE) GROUP BY currency ORDER BY currency`),
    ]);
    res.json({ coupons: couponsResult.rows.map(mapCoupon), redemptions: redemptionsResult.rows.map((row) => ({
      id: row.id, couponId: row.coupon_id, coupon: { code: row.code, name: row.coupon_name },
      user: row.user_id ? { id: row.user_id, name: row.user_name, email: row.user_email } : null,
      planId: row.plan_id || null, planName: row.plan_name || null, originalAmount: number(row.original_amount),
      discountAmount: number(row.discount_amount), finalAmount: number(row.final_amount), currency: row.currency,
      status: row.status || "applied", redeemedAt: row.redeemed_at,
    })), plans: plansResult.rows, users: usersResult.rows, summary: { ...(summaryResult.rows[0] || { active_coupons: 0, ending_soon: 0, total_redemptions: 0 }), discountsByCurrency: discountTotalsResult.rows.map((row) => ({ currency: row.currency, amount: number(row.amount) })) } });
  } catch (error) { next(error); }
};

async function saveCoupon(req, res, next, couponId) {
  const coupon = normalizeCouponPayload(req.body);
  const validation = couponValidationMessage(coupon);
  if (validation) return res.status(400).json({ message: validation });
  let client;
  try {
    client = await pool.connect(); await client.query("BEGIN");
    if (couponId) {
      const existing = await client.query(
        `SELECT c.*,
          (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=c.id AND status IN ('pending','applied'))::int active_uses,
          (SELECT COALESCE(MAX(uses),0) FROM (
            SELECT COUNT(*)::int uses FROM coupon_redemptions
            WHERE coupon_id=c.id AND status IN ('pending','applied') GROUP BY user_id
          ) per_user)::int max_user_uses
         FROM coupon_codes c WHERE c.id=$1 FOR UPDATE OF c`,
        [couponId]
      );
      if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Coupon not found" }); }
      const current = existing.rows[0];
      if (Number(current.active_uses) > 0) {
        const financialRulesChanged =
          current.code !== coupon.code ||
          current.discount_type !== coupon.discountType ||
          number(current.discount_value) !== coupon.discountValue ||
          current.currency !== coupon.currency ||
          number(current.minimum_amount) !== coupon.minimumAmount ||
          Number(current.applicable_plan_id || 0) !== Number(coupon.planId || 0);
        if (financialRulesChanged) {
          await client.query("ROLLBACK");
          return res.status(409).json({ message: "Coupon financial rules cannot change after customer use. Deactivate it and create a new coupon instead." });
        }
        if (coupon.usageLimit !== null && coupon.usageLimit < Number(current.active_uses)) {
          await client.query("ROLLBACK");
          return res.status(409).json({ message: "Usage limit cannot be lower than existing coupon uses" });
        }
        if (coupon.perUserLimit < Number(current.max_user_uses)) {
          await client.query("ROLLBACK");
          return res.status(409).json({ message: "Per-customer limit cannot be lower than existing usage" });
        }
      }
    }
    if (coupon.planId) {
      const plan = await client.query("SELECT id FROM plans WHERE id=$1", [coupon.planId]);
      if (!plan.rowCount) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Selected plan was not found" }); }
    }
    const values = [coupon.code,coupon.name,coupon.discountType,coupon.discountValue,coupon.currency,coupon.usageLimit,coupon.perUserLimit,coupon.minimumAmount,coupon.planId,coupon.startsAt,coupon.expiresAt,coupon.status,coupon.isPublic];
    const result = couponId
      ? await client.query(`UPDATE coupon_codes SET code=$1,name=$2,discount_type=$3,discount_value=$4,currency=$5,usage_limit=$6,per_user_limit=$7,minimum_amount=$8,applicable_plan_id=$9,starts_at=$10,expires_at=$11,status=$12,is_public=$13,updated_at=NOW() WHERE id=$14 RETURNING id,code,status,is_public`, [...values,couponId])
      : await client.query(`INSERT INTO coupon_codes(code,name,discount_type,discount_value,currency,usage_limit,per_user_limit,minimum_amount,applicable_plan_id,starts_at,expires_at,status,is_public,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,code,status,is_public`, [...values,req.user.id]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Coupon not found" }); }
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,'coupon',$3,$4::jsonb)`, [req.user.id,couponId?"coupon.updated":"coupon.created",result.rows[0].id,JSON.stringify({ code: coupon.code, status: coupon.status })]);
    await client.query("COMMIT"); res.status(couponId ? 200 : 201).json({ coupon: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "That coupon code already exists" });
    next(error);
  } finally { if (client) client.release(); }
}

exports.createCoupon = (req,res,next) => saveCoupon(req,res,next,null);
exports.updateCoupon = (req,res,next) => { const id=positiveIntegerParam(req); if(!id)return res.status(400).json({message:"Invalid coupon ID"}); return saveCoupon(req,res,next,id); };
exports.deleteCoupon = async (req,res,next) => {
  const id=positiveIntegerParam(req); if(!id)return res.status(400).json({message:"Invalid coupon ID"});
  let client; try { client=await pool.connect(); await client.query("BEGIN");
    const used=await client.query("SELECT COUNT(*)::int count FROM coupon_redemptions WHERE coupon_id=$1",[id]);
    if(used.rows[0].count){await client.query("ROLLBACK");return res.status(409).json({message:"This coupon has redemptions. Deactivate it to preserve the promotion history."});}
    const result=await client.query("DELETE FROM coupon_codes WHERE id=$1 RETURNING id,code",[id]);
    if(!result.rowCount){await client.query("ROLLBACK");return res.status(404).json({message:"Coupon not found"});}
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,'coupon.deleted','coupon',$2,$3::jsonb)`,[req.user.id,id,JSON.stringify(result.rows[0])]);
    await client.query("COMMIT");res.json({message:"Coupon deleted successfully"});
  }catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}
};

exports.createCouponRedemption = async (req,res,next) => {
  const couponId=Number(req.body.couponId), userId=Number(req.body.userId), planId=req.body.planId?Number(req.body.planId):null, originalAmount=Number(req.body.originalAmount);
  if(!Number.isInteger(couponId)||couponId<1||couponId>2147483647||!Number.isInteger(userId)||userId<1||userId>2147483647)return res.status(400).json({message:"Select a valid coupon and user"});
  if(planId!==null&&(!Number.isInteger(planId)||planId<1||planId>2147483647))return res.status(400).json({message:"Select a valid plan"});
  if(!Number.isFinite(originalAmount)||originalAmount<0.01||originalAmount>9999999999.99)return res.status(400).json({message:"Enter a valid original amount"});
  let client; try { client=await pool.connect();await client.query("BEGIN");
    const couponResult=await client.query(`SELECT c.*,(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=c.id AND status IN ('pending','applied'))::int used_count,(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=c.id AND user_id=$2 AND status IN ('pending','applied'))::int user_count FROM coupon_codes c WHERE c.id=$1 FOR UPDATE`,[couponId,userId]);
    if(!couponResult.rowCount){await client.query("ROLLBACK");return res.status(404).json({message:"Coupon not found"});}
    const c=couponResult.rows[0], now=new Date();
    if(c.status!=="active"||(c.starts_at&&new Date(c.starts_at)>now)||(c.expires_at&&new Date(c.expires_at)<=now)){await client.query("ROLLBACK");return res.status(409).json({message:"This coupon is not currently available"});}
    if(c.usage_limit!==null&&Number(c.used_count)>=Number(c.usage_limit)){await client.query("ROLLBACK");return res.status(409).json({message:"This coupon has reached its usage limit"});}
    if(Number(c.user_count)>=Number(c.per_user_limit)){await client.query("ROLLBACK");return res.status(409).json({message:"This user has reached the coupon limit"});}
    if(c.applicable_plan_id!==null&&Number(c.applicable_plan_id)!==planId){await client.query("ROLLBACK");return res.status(409).json({message:"This coupon is restricted to another plan"});}
    if(originalAmount<Number(c.minimum_amount)){await client.query("ROLLBACK");return res.status(409).json({message:`Minimum order amount is ${c.currency} ${Number(c.minimum_amount).toFixed(2)}`});}
    const relation=await client.query(`SELECT EXISTS(SELECT 1 FROM users WHERE id=$1) user_exists,CASE WHEN $2::integer IS NULL THEN TRUE ELSE EXISTS(SELECT 1 FROM plans WHERE id=$2) END plan_exists`,[userId,planId]);
    if(!relation.rows[0].user_exists||!relation.rows[0].plan_exists){await client.query("ROLLBACK");return res.status(400).json({message:"Selected user or plan was not found"});}
    const rawDiscount=c.discount_type==="percentage"?originalAmount*Number(c.discount_value)/100:Number(c.discount_value);
    const discountAmount=Number(Math.min(rawDiscount,originalAmount).toFixed(2)), finalAmount=Number((originalAmount-discountAmount).toFixed(2));
    const result=await client.query(`INSERT INTO coupon_redemptions(coupon_id,user_id,plan_id,original_amount,discount_amount,final_amount,currency,status,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,'applied',$8::jsonb) RETURNING id`,[couponId,userId,planId,originalAmount,discountAmount,finalAmount,c.currency,JSON.stringify({recordedBy:req.user.id})]);
    await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,'coupon_redemption.created','coupon_redemption',$2,$3::jsonb)`,[req.user.id,result.rows[0].id,JSON.stringify({couponId,userId,discountAmount})]);
    await client.query("COMMIT");res.status(201).json({redemption:{id:result.rows[0].id,discountAmount,finalAmount}});
  }catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}
};

exports.deleteCouponRedemption = async (req,res,next) => {
  const id=positiveIntegerParam(req);if(!id)return res.status(400).json({message:"Invalid redemption ID"});
  let client;try{client=await pool.connect();await client.query("BEGIN");const result=await client.query("DELETE FROM coupon_redemptions WHERE id=$1 RETURNING id,coupon_id,user_id",[id]);if(!result.rowCount){await client.query("ROLLBACK");return res.status(404).json({message:"Redemption not found"});}await client.query(`INSERT INTO activity_logs(user_id,action,resource_type,resource_id,metadata) VALUES($1,'coupon_redemption.deleted','coupon_redemption',$2,$3::jsonb)`,[req.user.id,id,JSON.stringify(result.rows[0])]);await client.query("COMMIT");res.json({message:"Redemption removed successfully"});}catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}finally{if(client)client.release();}
};

