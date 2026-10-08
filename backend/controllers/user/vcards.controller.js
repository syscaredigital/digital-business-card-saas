const { currentSubscription } = require('../../services/subscription-policy');
const pool = require("../../config/database.config");
const { getStorageSummary } = require("../../services/storage.service");
const { normalizeCustomSlug, publicVcardUrl } = require("../../helpers/vcard-url");
const { loadVcardEntitlements } = require('../../services/vcard-entitlements.service');
const { normalizeSections, normalizeVcardImage } = require('../../validators/vcard.validator');

exports.getVcard = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT v.id,v.slug,v.template_id,v.title,v.qualifications,v.description,v.website_url,v.phone,v.email,v.address,v.social_links,v.settings,v.is_active,
              COALESCE(
                CASE WHEN jsonb_typeof(v.settings->'contactCaptureRequired')='boolean'
                  THEN (v.settings->>'contactCaptureRequired')::boolean END,
                us.contact_capture_required,TRUE
              ) AS contact_capture_required
       FROM vcards v LEFT JOIN user_settings us ON us.user_id=v.user_id
       WHERE v.id = $1 AND v.user_id = $2`, [req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Card not found" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    res.json({ vcard: { ...result.rows[0], contactCaptureRequired: result.rows[0].contact_capture_required, publicUrl: publicVcardUrl(req, result.rows[0].slug) }, entitlements });
  } catch (error) { next(error); }
};

function vcardPayloadBytes(payload) {
  return Buffer.byteLength(JSON.stringify({
    title:payload.title || "",qualifications:payload.qualifications || "",description:payload.description || "",websiteUrl:payload.websiteUrl || "",
    phone:payload.phone || "",email:payload.email || "",address:payload.address || "",sections:payload.sections || {},
    profileImageUrl:payload.profileImageUrl || "",coverImageUrl:payload.coverImageUrl || "",
  }));
}

exports.createVcard = async (req, res, next) => {
  let client, committed = false;
  try {
    const title = String(req.body.title || "").trim();
    const qualifications = String(req.body.qualifications || "").trim();
    const slug = normalizeCustomSlug(req.body.slug);
    if (!title) return res.status(400).json({ message: "Card name is required" });
    if (qualifications.length > 500) return res.status(400).json({ message: "Qualifications must be 500 characters or fewer" });
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [req.user.id]);
    const allowance = await client.query(
      `SELECT COALESCE(p.vcard_limit, 1)::int AS card_limit,
              (SELECT COUNT(*)::int FROM vcards v WHERE v.user_id = $1) AS card_count
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND ${currentSubscription()}
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE u.id = $1 ORDER BY s.created_at DESC NULLS LAST LIMIT 1`, [req.user.id]
    );
    const limit = allowance.rows[0]?.card_limit || 1;
    if ((allowance.rows[0]?.card_count || 0) >= limit) return res.status(403).json({ message: "Your plan's card limit has been reached" });
    const entitlements = await loadVcardEntitlements(client, req.user.id);
    const templateId = Number(req.body.templateId || entitlements.templates[0]?.id);
    if (!entitlements.templates.some((template) => Number(template.id) === templateId)) return res.status(403).json({ message: "This VCard template is not included in your plan" });
    const allowedKeys = new Set(entitlements.features.map((feature) => feature.key));
    const sections = normalizeSections(req.body.sections, allowedKeys);
    const profileImageUrl=normalizeVcardImage(req.body.profileImageUrl);
    const coverImageUrl=normalizeVcardImage(req.body.coverImageUrl);
    const contactCaptureRequired=req.body.contactCaptureRequired !== false;
    const storage=await getStorageSummary(client,req.user.id);
    if(storage.usedBytes+vcardPayloadBytes({...req.body,title,sections,profileImageUrl,coverImageUrl})>storage.limitBytes){
      return res.status(413).json({message:`Your ${storage.plan.name} plan storage limit has been reached. Delete unused content or upgrade your plan.`});
    }
    const result = await client.query(
      `INSERT INTO vcards (user_id,template_id,title,qualifications,slug,description,website_url,phone,email,address,settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       RETURNING id,slug,template_id,title,qualifications,description,website_url,phone,email,address,settings,is_active,created_at`,
       [req.user.id, templateId, title, qualifications || null, slug, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null, JSON.stringify({ sections, profileImageUrl, coverImageUrl, contactCaptureRequired })]
    );
    await client.query("COMMIT");
    committed = true;
    res.status(201).json({ vcard: { ...result.rows[0], publicUrl: publicVcardUrl(req, result.rows[0].slug) } });
  } catch (error) { if(error.code==="23505")return res.status(409).json({message:"That VCard URL name is already in use. Choose another one."}); next(error); }
  finally { if(client) { if(!committed) await client.query("ROLLBACK").catch(()=>{}); client.release(); } }
};

exports.updateVcard = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const qualifications = String(req.body.qualifications || "").trim();
    const hasSlug = Object.prototype.hasOwnProperty.call(req.body, "slug");
    const slug = hasSlug ? normalizeCustomSlug(req.body.slug) : null;
    if (!title) return res.status(400).json({ message: "Card name is required" });
    if (qualifications.length > 500) return res.status(400).json({ message: "Qualifications must be 500 characters or fewer" });
    const entitlements = await loadVcardEntitlements(pool, req.user.id);
    const templateId = Number(req.body.templateId);
    if (!entitlements.templates.some((template) => Number(template.id) === templateId)) return res.status(403).json({ message: "This VCard template is not included in your plan" });
    const allowedKeys = new Set(entitlements.features.map((feature) => feature.key));
    const sections = normalizeSections(req.body.sections, allowedKeys);
    const existing=await pool.query(`SELECT title,qualifications,description,website_url,phone,email,address,settings
      FROM vcards WHERE id=$1 AND user_id=$2`,[req.params.id,req.user.id]);
    if(!existing.rowCount)return res.status(404).json({message:"Card not found"});
    const current=existing.rows[0],storage=await getStorageSummary(pool,req.user.id);
    const profileImageUrl=Object.prototype.hasOwnProperty.call(req.body,"profileImageUrl")?normalizeVcardImage(req.body.profileImageUrl):current.settings?.profileImageUrl||null;
    const coverImageUrl=Object.prototype.hasOwnProperty.call(req.body,"coverImageUrl")?normalizeVcardImage(req.body.coverImageUrl):current.settings?.coverImageUrl||null;
    const contactCaptureRequired=typeof req.body.contactCaptureRequired === "boolean" ? req.body.contactCaptureRequired : current.settings?.contactCaptureRequired !== false;
    const nextSettings={...(current.settings||{}),sections,profileImageUrl,coverImageUrl,contactCaptureRequired};
    const currentBytes=Buffer.byteLength(JSON.stringify(current));
    const proposedBytes=vcardPayloadBytes({...req.body,title,sections,profileImageUrl,coverImageUrl});
    if(storage.usedBytes-currentBytes+proposedBytes>storage.limitBytes){
      return res.status(413).json({message:`Your ${storage.plan.name} plan storage limit has been reached. Reduce uploaded content or upgrade your plan.`});
    }
    const result = await pool.query(
      `UPDATE vcards SET template_id=$1,title=$2,qualifications=$3,description=$4,website_url=$5,phone=$6,
                email=$7,address=$8,settings=$9::jsonb,
               is_active=COALESCE($10,is_active),slug=CASE WHEN $11::boolean THEN $12 ELSE slug END,updated_at=NOW()
        WHERE id=$13 AND user_id=$14
        RETURNING id,slug,template_id,title,qualifications,description,website_url,phone,email,address,settings,is_active,updated_at`,
       [templateId, title, qualifications || null, req.body.description || null, req.body.websiteUrl || null, req.body.phone || null, req.body.email || null, req.body.address || null, JSON.stringify(nextSettings), typeof req.body.isActive === "boolean" ? req.body.isActive : null, hasSlug, slug, req.params.id, req.user.id]
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
