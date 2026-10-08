const pool = require('../../config/database.config');
const { sendAppointmentApproved } = require('../../services/email.service');

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
              a.starts_at, a.ends_at, a.status, a.appointment_type, a.service_name, a.notes
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
              v.title AS vcard_title,u.name AS owner_name
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
    if (status === "rejected") {
      const rejected = await client.query(
        `UPDATE appointments SET status='rejected',updated_at=NOW()
         WHERE id=$1 RETURNING id,status,updated_at`,
        [appointmentId]
      );
      await client.query("COMMIT");
      return res.json({ message: "Appointment rejected", appointment: rejected.rows[0] });
    }
    if (!appointment.email) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This appointment has no customer email address" });
    }

    await sendAppointmentApproved({
      to: appointment.email,
      customerName: appointment.name,
      ownerName: appointment.owner_name,
      vcardTitle: appointment.vcard_title,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      meetingMode: appointment.appointment_type,
      serviceName: appointment.service_name,
    });
    const updated = await client.query(
      `UPDATE appointments SET status='approved',updated_at=NOW()
       WHERE id=$1 RETURNING id,status,updated_at`,
      [appointmentId]
    );
    await client.query("COMMIT");
    res.json({
      message: "Appointment approved and confirmation email sent",
      appointment: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (/email|mail|smtp|auth|login|recipient|envelope|connect|timeout/i.test(error.message || "")) {
      return res.status(502).json({ message: "The appointment was not approved because the confirmation email could not be sent" });
    }
    next(error);
  } finally {
    client.release();
  }
};

