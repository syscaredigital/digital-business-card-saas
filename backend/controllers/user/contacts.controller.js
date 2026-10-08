const pool = require("../../config/database.config");
const { publicVcardUrl } = require("../../helpers/vcard-url");

exports.enquiries = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ct.id, COALESCE(bc.title, v.title) AS vcard_name, ct.name, ct.email, ct.phone,
              ct.company, ct.message, ct.source, ct.contacted_at
       FROM contacts ct
       LEFT JOIN business_cards bc ON bc.id = ct.business_card_id
       LEFT JOIN vcards v ON v.id = ct.vcard_id
       WHERE COALESCE(bc.user_id, v.user_id) = $1
       ORDER BY ct.contacted_at DESC`, [req.user.id]
    );
    res.json({ enquiries: result.rows });
  } catch (error) { next(error); }
};

exports.contacts = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ct.id,ct.name,ct.email,ct.phone,ct.company,ct.message,ct.source,
              ct.contacted_at,ct.consent_at,v.id AS vcard_id,v.title AS vcard_name
       FROM contacts ct
       JOIN vcards v ON v.id=ct.vcard_id
       WHERE v.user_id=$1
       ORDER BY ct.contacted_at DESC`,
      [req.user.id]
    );
    res.json({
      contacts: result.rows,
      total: result.rowCount,
      savedContacts: result.rows.filter((contact) => contact.source === "VCard contact save").length,
    });
  } catch (error) { next(error); }
};

exports.vcardEngagement = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT v.id,v.slug,v.title,v.is_active,
              COUNT(DISTINCT e.id) FILTER (WHERE e.event_type='qr_scan')::int AS qr_scans,
              COUNT(DISTINCT e.id) FILTER (WHERE e.event_type='vcard_view')::int AS views,
              COUNT(DISTINCT e.id) FILTER (WHERE e.event_type='contact_download')::int AS contact_downloads,
              COUNT(DISTINCT ct.id)::int AS captured_contacts
       FROM vcards v
       LEFT JOIN vcard_events e ON e.vcard_id=v.id
       LEFT JOIN contacts ct ON ct.vcard_id=v.id
       WHERE v.user_id=$1
       GROUP BY v.id
       ORDER BY v.updated_at DESC`,
      [req.user.id]
    );
    res.json({ cards: result.rows.map((card) => ({ ...card, publicUrl: publicVcardUrl(req, card.slug) })) });
  } catch (error) { next(error); }
};

