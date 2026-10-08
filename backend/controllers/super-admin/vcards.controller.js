const pool = require("../../config/database.config");
function vcardIdFromRequest(req) {
  const rawId = String(req.params.id || "");
  if (!/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function mapAdminVCard(card) {
  return {
    id: card.id,
    title: card.title || "Untitled VCard",
    description: card.description || null,
    owner: {
      id: card.user_id,
      name: card.user_name || "Unknown user",
      email: card.user_email || null,
    },
    template: card.template_id
      ? { id: card.template_id, name: card.template_name || "Template", previewUrl: card.preview_url || null }
      : null,
    email: card.email || null,
    phone: card.phone || null,
    websiteUrl: card.website_url || null,
    isActive: Boolean(card.is_active),
    createdAt: card.created_at,
    updatedAt: card.updated_at,
  };
}

exports.listVCards = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const values = [];
    let searchCondition = "";
    if (search) {
      values.push(`%${search}%`);
      searchCondition = `WHERE (
        COALESCE(v.title, '') ILIKE $1 OR COALESCE(v.email, '') ILIKE $1 OR
        COALESCE(v.website_url, '') ILIKE $1 OR COALESCE(u.name, '') ILIKE $1 OR
        COALESCE(u.email, '') ILIKE $1 OR COALESCE(t.name, '') ILIKE $1
      )`;
    }

    const [cardsResult, summaryResult, usersResult, templatesResult] = await Promise.all([
      pool.query(
        `SELECT v.id, v.user_id, v.template_id, v.title, v.description, v.email, v.phone,
                v.website_url, v.is_active, v.created_at, v.updated_at,
                u.name AS user_name, u.email AS user_email,
                t.name AS template_name, t.preview_url
         FROM vcards v
         LEFT JOIN users u ON u.id = v.user_id
         LEFT JOIN vcard_templates t ON t.id = v.template_id
         ${searchCondition}
         ORDER BY v.updated_at DESC
         LIMIT 100`,
        values
      ),
      pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
               COUNT(*) FILTER (WHERE is_active = FALSE)::int AS inactive
        FROM vcards
      `),
      pool.query(`
        SELECT u.id, u.name, u.email
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active'
        ORDER BY u.name, u.email
      `),
      pool.query(`
        SELECT id, name, description, preview_url, template_json, is_public
        FROM vcard_templates
        ORDER BY is_public DESC, id
      `),
    ]);

    res.json({
      vcards: cardsResult.rows.map(mapAdminVCard),
      summary: summaryResult.rows[0],
      users: usersResult.rows,
      templates: templatesResult.rows.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description || null,
        previewUrl: template.preview_url || null,
        config: template.template_json || {},
        isPublic: Boolean(template.is_public),
      })),
    });
  } catch (error) {
    next(error);
  }
};

exports.createVCard = async (req, res, next) => {
  let client;
  try {
    const userId = Number(req.body.userId);
    const templateId = req.body.templateId ? Number(req.body.templateId) : null;
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim() || null;
    const email = String(req.body.email || "").trim().toLowerCase() || null;
    const phone = String(req.body.phone || "").trim() || null;
    const websiteUrl = String(req.body.websiteUrl || "").trim() || null;
    const isActive = req.body.isActive !== false;

    if (!Number.isInteger(userId) || userId < 1 || userId > 2147483647 || !title) {
      return res.status(400).json({ message: "An owner and VCard title are required" });
    }
    if (title.length > 255 || (email && email.length > 255) || (phone && phone.length > 50)) {
      return res.status(400).json({ message: "VCard title, email, or phone number is too long" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid VCard email address" });
    }
    if (websiteUrl) {
      try {
        const parsedUrl = new URL(websiteUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ message: "Website URL must start with http:// or https://" });
      }
    }

    client = await pool.connect();
    await client.query("BEGIN");
    const ownerResult = await client.query(
      `SELECT u.id
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND COALESCE(r.name, 'user') <> 'super_admin' AND u.status = 'active'`,
      [userId]
    );
    if (!ownerResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Select an active user account" });
    }
    if (templateId) {
      const templateResult = await client.query("SELECT id FROM vcard_templates WHERE id = $1", [templateId]);
      if (!templateResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Selected template was not found" });
      }
    }

    const result = await client.query(
      `INSERT INTO vcards (user_id, template_id, title, description, email, phone, website_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, is_active`,
      [userId, templateId, title, description, email, phone, websiteUrl, isActive]
    );
    const card = result.rows[0];
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'vcard.created', 'vcard', $2, $3::jsonb, $4, $5)`,
      [req.user.id, card.id, JSON.stringify({ title: card.title, ownerId: userId }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.status(201).json({ vcard: card });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.updateVCardStatus = async (req, res, next) => {
  const vcardId = vcardIdFromRequest(req);
  if (!vcardId || typeof req.body.isActive !== "boolean") {
    return res.status(400).json({ message: "A valid VCard ID and active state are required" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE vcards SET is_active = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, title, is_active`,
      [req.body.isActive, vcardId]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "VCard not found" });
    }
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'vcard.status_changed', 'vcard', $2, $3::jsonb, $4, $5)`,
      [req.user.id, vcardId, JSON.stringify({ isActive: req.body.isActive }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ vcard: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

exports.deleteVCard = async (req, res, next) => {
  const vcardId = vcardIdFromRequest(req);
  if (!vcardId) return res.status(400).json({ message: "Invalid VCard ID" });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query("DELETE FROM vcards WHERE id = $1 RETURNING id, title", [vcardId]);
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "VCard not found" });
    }
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, 'vcard.deleted', 'vcard', $2, $3::jsonb, $4, $5)`,
      [req.user.id, vcardId, JSON.stringify({ title: result.rows[0].title }), req.ip || null, req.get("user-agent") || null]
    );
    await client.query("COMMIT");
    res.json({ message: "VCard deleted successfully" });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
};

