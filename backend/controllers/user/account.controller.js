const pool = require('../../config/database.config');
const bcrypt = require('bcrypt');
const { currentSubscription } = require('../../services/subscription-policy');
const { getStorageSummary } = require('../../services/storage.service');
const { CURRENCY_CODES, normalizeCurrency } = require('../../config/currencies');
const { BASE_CURRENCY, getRate } = require('../../services/exchange-rate.service');

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
        WHERE s.user_id=$1 AND ${currentSubscription()} ORDER BY s.updated_at DESC,s.id DESC LIMIT 1`,[req.user.id]),
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
  let client;
  try {
    const currentPassword=String(req.body.currentPassword || ""),newPassword=String(req.body.newPassword || "");
    if(newPassword.length<12 || Buffer.byteLength(newPassword,"utf8")>72){
      return res.status(400).json({message:"New password must be at least 12 characters and no more than 72 UTF-8 bytes"});
    }
    if(currentPassword===newPassword)return res.status(400).json({message:"Choose a password different from your current password"});
    client=await pool.connect();
    await client.query("BEGIN");
    const current=await client.query("SELECT password,auth_version FROM users WHERE id=$1 FOR UPDATE",[req.user.id]);
    if(!current.rowCount || current.rows[0].auth_version!==req.user.auth_version || !(await bcrypt.compare(currentPassword,current.rows[0].password))){
      await client.query("ROLLBACK");
      return res.status(403).json({message:"Current password is incorrect or your session has changed"});
    }
    const hash=await bcrypt.hash(newPassword,10);
    await client.query("UPDATE users SET password=$1,auth_version=auth_version+1,updated_at=NOW() WHERE id=$2",[hash,req.user.id]);
    await client.query("UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL",[req.user.id]);
    await client.query("DELETE FROM password_reset_tokens WHERE user_id=$1",[req.user.id]);
    await client.query("INSERT INTO notifications(user_id,title,message,type) VALUES($1,'Password changed','Your account password was changed. All signed-in sessions were closed.','security')",[req.user.id]);
    await client.query("INSERT INTO activity_logs(user_id,action,resource_type,resource_id,ip_address,user_agent) VALUES($1,'account.password_changed','user',$1,$2,$3)",[req.user.id,req.ip || null,req.get("user-agent") || null]);
    await client.query("COMMIT");
    require("../../helpers/browser-session").clear(res);
    res.json({message:"Password changed successfully. Please sign in again.",requiresLogin:true});
  } catch(error){if(client)await client.query("ROLLBACK").catch(()=>{});next(error);}
  finally {if(client)client.release();}
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

