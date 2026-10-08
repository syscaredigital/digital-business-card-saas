const { currentSubscription } = require('./subscription-policy');
const { VCARD_FEATURES, normalizePlanFeatures } = require('../config/vcard-features');
function number(value) { return Number(value || 0); }

async function loadVcardEntitlements(db, userId) {
  const [planResult, templateResult] = await Promise.all([
    db.query(`SELECT p.id,p.name,p.vcard_limit,p.features
      FROM subscriptions s JOIN plans p ON p.id=s.plan_id
      WHERE s.user_id=$1 AND ${currentSubscription()}
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


module.exports = { loadVcardEntitlements };
