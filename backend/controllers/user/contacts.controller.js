const pool = require("../../config/database.config");
const { publicVcardUrl } = require("../../helpers/vcard-url");
const { queueCustomerEmail } = require('../../services/lead-notifications.service');

exports.enquiries = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ct.id, COALESCE(bc.title, v.title) AS vcard_name, ct.name, ct.email, ct.phone,
              ct.company, ct.message, ct.source, ct.contacted_at,ct.enquiry_status,ct.read_at,
              (SELECT e.status FROM contact_replies r JOIN email_outbox e ON e.id=r.email_outbox_id
               WHERE r.contact_id=ct.id ORDER BY r.id DESC LIMIT 1) AS reply_email_status
       FROM contacts ct
       LEFT JOIN business_cards bc ON bc.id = ct.business_card_id
       LEFT JOIN vcards v ON v.id = ct.vcard_id
       WHERE COALESCE(bc.user_id, v.user_id) = $1
       ORDER BY ct.contacted_at DESC`, [req.user.id]
    );
    res.json({ enquiries: result.rows });
  } catch (error) { next(error); }
};

function contactId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

async function ownedContact(db, id, userId, lock = false) {
  return (await db.query(`SELECT ct.*,COALESCE(v.title,bc.title) AS vcard_name,u.name AS owner_name,u.email AS owner_email
    FROM contacts ct LEFT JOIN vcards v ON v.id=ct.vcard_id
    LEFT JOIN business_cards bc ON bc.id=ct.business_card_id
    JOIN users u ON u.id=COALESCE(v.user_id,bc.user_id)
    WHERE ct.id=$1 AND u.id=$2 ${lock ? 'FOR UPDATE OF ct' : ''}`, [id, userId])).rows[0];
}

exports.getEnquiry = async (req, res, next) => {
  const id = contactId(req);
  if (!id) return res.status(400).json({ message: 'Invalid enquiry ID' });
  try {
    const contact = await ownedContact(pool, id, req.user.id);
    if (!contact) return res.status(404).json({ message: 'Enquiry not found' });
    const replies = await pool.query(`SELECT r.id,r.message,r.created_at,e.status AS email_status
      FROM contact_replies r JOIN email_outbox e ON e.id=r.email_outbox_id
      WHERE r.contact_id=$1 AND r.user_id=$2 ORDER BY r.id`, [id, req.user.id]);
    res.json({ enquiry: contact, replies: replies.rows });
  } catch (error) { next(error); }
};

exports.updateEnquiry = async (req, res, next) => {
  const id = contactId(req), status = req.body?.status, read = req.body?.read;
  if (!id) return res.status(400).json({ message: 'Invalid enquiry ID' });
  if ((status != null && !['new','replied','closed'].includes(status)) || (read != null && typeof read !== 'boolean') || (status == null && read == null)) {
    return res.status(400).json({ message: 'Choose a valid enquiry status or read state' });
  }
  try {
    const result = await pool.query(`UPDATE contacts ct SET enquiry_status=COALESCE($3,enquiry_status),
      read_at=CASE WHEN $4::boolean IS TRUE THEN COALESCE(read_at,NOW()) WHEN $4::boolean IS FALSE THEN NULL ELSE read_at END
      WHERE ct.id=$1 AND (EXISTS(SELECT 1 FROM vcards v WHERE v.id=ct.vcard_id AND v.user_id=$2)
        OR (ct.vcard_id IS NULL AND EXISTS(SELECT 1 FROM business_cards b WHERE b.id=ct.business_card_id AND b.user_id=$2)))
      RETURNING ct.id,ct.enquiry_status,ct.read_at`, [id, req.user.id, status || null, read == null ? null : read]);
    if (!result.rowCount) return res.status(404).json({ message: 'Enquiry not found' });
    res.json({ message: 'Enquiry updated', enquiry: result.rows[0] });
  } catch (error) { next(error); }
};

exports.replyToEnquiry = async (req, res, next) => {
  const id = contactId(req), message = req.body?.message, key = req.body?.requestKey;
  if (!id) return res.status(400).json({ message: 'Invalid enquiry ID' });
  if (typeof message !== 'string' || !message.trim() || message.length > 5000 || typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return res.status(400).json({ message: 'Enter a reply of 1–5,000 characters and a valid request key' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`reply:${req.user.id}`]);
    const contact = await ownedContact(client, id, req.user.id, true);
    if (!contact) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Enquiry not found' }); }
    if (!contact.email) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'This contact has no email address. Use their phone number instead.' }); }
    const prior = (await client.query('SELECT id,contact_id,message FROM contact_replies WHERE user_id=$1 AND request_key=$2', [req.user.id, key])).rows[0];
    if (prior) {
      await client.query('ROLLBACK');
      if (prior.contact_id !== id || prior.message !== message.trim()) return res.status(409).json({ message: 'This request key was used for a different reply' });
      return res.json({ message: 'Your reply is already queued or delivered', reply: { id: prior.id } });
    }
    const recent = await client.query("SELECT COUNT(*)::int count FROM contact_replies WHERE user_id=$1 AND created_at>NOW()-INTERVAL '1 hour'", [req.user.id]);
    if (recent.rows[0].count >= 60) { await client.query('ROLLBACK'); return res.status(429).json({ message: 'Hourly reply limit reached. Please try again later.' }); }
    const queued = await queueCustomerEmail(client, {
      userId: req.user.id, key: `contact-reply:${req.user.id}:${key}`, to: contact.email, replyTo: contact.owner_email,
      subject: `Reply from ${contact.owner_name} — ${contact.vcard_name || 'your enquiry'}`,
      text: [`Hello ${contact.name || 'there'},`, '', message.trim(), '', `From ${contact.owner_name}`, contact.vcard_name || '',
        '', 'Your original message:', contact.message || 'Contact details shared through a VCard.',
        '', 'Reply to this email to contact the card owner directly.', 'Sent through Sync E-Card'].join('\n'),
    });
    const saved = await client.query(`INSERT INTO contact_replies(contact_id,user_id,request_key,message,email_outbox_id)
      VALUES($1,$2,$3,$4,$5) RETURNING id,message,created_at`, [id, req.user.id, key, message.trim(), queued.id]);
    await client.query("UPDATE contacts SET enquiry_status='replied',read_at=COALESCE(read_at,NOW()) WHERE id=$1", [id]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Reply queued for email delivery', reply: { ...saved.rows[0], email_status: queued.status } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ message: 'This reply request has already been processed. Refresh the conversation.' });
    next(error);
  } finally { client.release(); }
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

