const validEmail = value => typeof value === 'string' && value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function dashboardLink(page, key, id) {
  try {
    const url = new URL(`/pages/user/${page}.html`, process.env.PUBLIC_APP_URL);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (key && id) url.searchParams.set(key, id);
    return url.href;
  } catch (_) { return ''; }
}

async function queueCustomerEmail(db, { userId, key, to, replyTo, subject, text }) {
  if (!validEmail(to) || (replyTo && !validEmail(replyTo))) throw new Error('A valid recipient and reply address are required');
  const result = await db.query(`INSERT INTO email_outbox(user_id,dedup_key,recipient_email,reply_to,subject,body)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(dedup_key) DO UPDATE SET dedup_key=EXCLUDED.dedup_key RETURNING id,status`,
  [userId, key, to, replyTo || null, subject, text]);
  return result.rows[0];
}

module.exports = { dashboardLink, queueCustomerEmail, validEmail };
