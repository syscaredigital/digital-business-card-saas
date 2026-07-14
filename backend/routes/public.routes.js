const express = require("express");
const pool = require("../config/database.config");
const { normalizePlanFeatures } = require("../config/vcard-features");

const router = express.Router();

router.get("/plans", async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT id,name,price,billing_interval,vcard_limit,nfc_limit,analytics_limit,features,updated_at FROM plans WHERE status='active' ORDER BY price,name`);
    res.json({ data: result.rows.map((plan) => ({
      id: plan.id, name: plan.name, price: Number(plan.price), billingInterval: plan.billing_interval,
      vcardLimit: Number(plan.vcard_limit), nfcLimit: Number(plan.nfc_limit), analyticsLimit: Number(plan.analytics_limit),
      features: normalizePlanFeatures(plan.features).benefits, updatedAt: plan.updated_at,
    })) });
  } catch (error) { next(error); }
});

router.get("/nfc-products", async (req, res, next) => {
  try {
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
        price: Number(product.price),
        description: product.description || "",
        frontImage: product.front_image,
        backImage: product.back_image,
        category: product.category,
        updatedAt: product.updated_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/vcards/featured", async (req, res, next) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 12) : 6;

  try {
    const result = await pool.query(
      `
        SELECT *
        FROM (
          SELECT
            v.id,
            'vcard' AS source,
            COALESCE(NULLIF(u.name, ''), NULLIF(v.title, ''), 'Untitled VCard') AS name,
            COALESCE(NULLIF(v.title, ''), 'Digital Business Card') AS title,
            NULLIF(v.description, '') AS description,
            COALESCE(NULLIF(c.name, ''), 'Independent Professional') AS company,
            u.avatar_url,
            v.website_url,
            v.created_at
          FROM vcards v
          LEFT JOIN users u ON u.id = v.user_id
          LEFT JOIN companies c ON c.id = COALESCE(v.company_id, u.company_id)
          WHERE v.is_active = TRUE

          UNION ALL

          SELECT
            b.id,
            'business_card' AS source,
            COALESCE(NULLIF(u.name, ''), NULLIF(b.title, ''), 'Untitled VCard') AS name,
            COALESCE(NULLIF(b.title, ''), 'Digital Business Card') AS title,
            NULLIF(b.description, '') AS description,
            COALESCE(NULLIF(c.name, ''), 'Independent Professional') AS company,
            u.avatar_url,
            COALESCE(NULLIF(b.public_url, ''), NULLIF(b.website_url, '')) AS website_url,
            b.created_at
          FROM business_cards b
          LEFT JOIN users u ON u.id = b.user_id
          LEFT JOIN companies c ON c.id = COALESCE(b.company_id, u.company_id)
          WHERE b.is_active = TRUE AND b.status = 'active'
        ) cards
        ORDER BY created_at DESC
        LIMIT $1;
      `,
      [limit]
    );

    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/vcards/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid VCard ID" });
  try {
    const result = await pool.query(`
      SELECT v.id,v.title,v.description,v.website_url,v.phone,v.email,v.address,v.social_links,v.settings,
             t.id AS template_id,t.name AS template_name,t.preview_url,t.template_json,
             u.name AS owner_name,u.avatar_url,c.name AS company_name,p.features AS plan_features
      FROM vcards v
      LEFT JOIN vcard_templates t ON t.id=v.template_id
      LEFT JOIN users u ON u.id=v.user_id
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
      id: card.id, title: card.title, description: card.description, websiteUrl: card.website_url,
      phone: card.phone, email: card.email, address: card.address, socialLinks: card.social_links || [],
      sections: visibleSections, ownerName: card.owner_name, avatarUrl: card.avatar_url,
      enabledFeatures: Array.from(allowedFeatures),
      companyName: card.company_name, template: { id: card.template_id, name: card.template_name, previewUrl: card.preview_url || null, config: card.template_json || {} },
    } });
  } catch (error) { next(error); }
});

module.exports = router;
