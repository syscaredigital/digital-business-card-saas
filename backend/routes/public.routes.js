const express = require("express");
const pool = require("../config/database.config");

const router = express.Router();

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

module.exports = router;
