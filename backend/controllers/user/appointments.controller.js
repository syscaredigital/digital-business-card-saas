const pool = require('../../config/database.config');
const { queueCustomerEmail } = require('../../services/lead-notifications.service');

exports.appointments = async (req, res, next) => {
  const status = String(req.query.status || "").trim().toLowerCase();
  const date = String(req.query.date || "").trim();
  if (status && !["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid appointment status filter" });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Invalid appointment date filter" });
  }
  try {
    const values = [req.user.id];
    const filters = ["a.user_id = $1"];
    if (status) {
      values.push(status);
      filters.push(`a.status = $${values.length}`);
    }
    if (date) {
      values.push(date);
      filters.push(`a.starts_at >= $${values.length}::date AND a.starts_at < $${values.length}::date + INTERVAL '1 day'`);
    }
    const [result, summaryResult] = await Promise.all([
      pool.query(
      `SELECT a.id, a.vcard_id, v.title AS vcard_name, a.name, a.email, a.phone,
              a.starts_at, a.ends_at, a.status, a.appointment_type, a.service_name, a.notes,a.decision_note,
              (SELECT e.status FROM email_outbox e WHERE e.dedup_key='appointment-decision:'||a.id::text LIMIT 1) AS email_status
       FROM appointments a LEFT JOIN vcards v ON v.id = a.vcard_id
       WHERE ${filters.join(" AND ")} ORDER BY a.starts_at DESC`,
      values
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status='pending')::int AS pending,
                COUNT(*) FILTER (WHERE status='approved')::int AS approved,
                COUNT(*) FILTER (WHERE status='rejected')::int AS rejected,
                COUNT(*) FILTER (WHERE appointment_type='online')::int AS online
         FROM appointments WHERE user_id=$1`,
        [req.user.id]
      ),
    ]);
    res.json({ appointments: result.rows, summary: summaryResult.rows[0] });
  } catch (error) { next(error); }
};

exports.updateAppointmentStatus = async (req, res, next) => {
  const appointmentId = Number(req.params.id);
  const status = String(req.body?.status || "").trim().toLowerCase();
  const note = req.body?.note == null ? '' : req.body.note;
  if (typeof note !== 'string' || note.length > 2000) return res.status(400).json({ message: 'The appointment message must be text of at most 2,000 characters' });
  if (!Number.isInteger(appointmentId) || appointmentId < 1) {
    return res.status(400).json({ message: "Invalid appointment ID" });
  }
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Status must be approved or rejected" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT a.id,a.name,a.email,a.starts_at,a.ends_at,a.status,a.appointment_type,a.service_name,
              v.title AS vcard_title,u.name AS owner_name,u.email AS owner_email,a.decision_note
       FROM appointments a
       JOIN users u ON u.id=a.user_id
       LEFT JOIN vcards v ON v.id=a.vcard_id
       WHERE a.id=$1 AND a.user_id=$2
       FOR UPDATE OF a`,
      [appointmentId, req.user.id]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Appointment not found" });
    }
    const appointment = result.rows[0];
    if (appointment.status === status) {
      await client.query("COMMIT");
      return res.json({ message: `Appointment is already ${status}`, appointment });
    }
    if (appointment.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: `A ${appointment.status} appointment cannot be changed` });
    }
    if (!appointment.email) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This appointment has no customer email address" });
    }

    const when = new Intl.DateTimeFormat('en', { dateStyle:'full',timeStyle:'short',timeZone:process.env.APP_TIMEZONE || 'Asia/Colombo' }).format(new Date(appointment.starts_at));
    const host = appointment.owner_name || appointment.vcard_title || 'the card owner';
    await queueCustomerEmail(client, {
      userId: req.user.id, key: `appointment-decision:${appointmentId}`,
      to: appointment.email, replyTo: appointment.owner_email,
      subject: `Appointment ${status === 'approved' ? 'confirmed' : 'declined'} with ${host}`,
      text: [`Hello ${appointment.name},`, '', `Your appointment with ${host} has been ${status}.`,
        `Service: ${appointment.service_name || 'Appointment'}`, `Date and time: ${when} (${process.env.APP_TIMEZONE || 'Asia/Colombo'})`,
        `Meeting mode: ${appointment.appointment_type}`, note.trim() ? `Message from the host:\n${note.trim()}` : '',
        status === 'approved' && appointment.appointment_type === 'online' && !note.trim() ? 'Please contact the host for the meeting link.' : '',
        status === 'rejected' ? 'Please contact the host or request a different time.' : '',
        '', 'You can reply to this email to contact the host.', 'Sync E-Card'].filter(Boolean).join('\n'),
    });
    const updated = await client.query(
      `UPDATE appointments SET status=$2,decision_note=$3,updated_at=NOW()
       WHERE id=$1 RETURNING id,status,decision_note,updated_at`,
      [appointmentId, status, note.trim() || null]
    );
    await client.query("COMMIT");
    res.json({
      message: `Appointment ${status}; customer email queued for delivery`,
      appointment: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
};

