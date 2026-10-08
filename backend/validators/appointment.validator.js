function parseAppointment(body = {}, now = Date.now()) {
  const limits = { name: 150, email: 255, phone: 50, notes: 2000, serviceName: 150, appointmentType: 20 };
  const value = {};
  for (const [key, max] of Object.entries(limits)) {
    if (body[key] != null && (typeof body[key] !== 'string' || body[key].length > max)) {
      return { error: `${key} must be text of at most ${max} characters` };
    }
    value[key] = (body[key] || '').trim();
  }
  value.appointmentType = value.appointmentType.toLowerCase();
  if (!value.name || !value.email) return { error: 'Name and email are required for appointment confirmation' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) return { error: 'Enter a valid email address' };
  if (!['office', 'online'].includes(value.appointmentType)) return { error: 'Choose either an office visit or an online meeting' };
  if (typeof body.startsAt !== 'string') return { error: 'Select a valid appointment date and time' };
  value.startsAt = new Date(body.startsAt);
  if (Number.isNaN(value.startsAt.getTime())) return { error: 'Select a valid appointment date and time' };
  if (value.startsAt.getTime() < now + 5 * 60 * 1000) return { error: 'Appointments must be booked at least 5 minutes in advance' };
  value.requestedDuration = Number.parseInt(body.durationMinutes, 10);
  return { value };
}

function validateAppointment(req, res, next) {
  const result = parseAppointment(req.body || {});
  if (result.error) return res.status(400).json({ message: result.error });
  req.validatedAppointment = result.value;
  next();
}
module.exports = { parseAppointment, validateAppointment };
