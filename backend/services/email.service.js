const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.MAIL_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure: port === 465,
    auth: process.env.MAIL_USER && process.env.MAIL_PASS
      ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
      : undefined,
  });
  return transporter;
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function appointmentDate(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: process.env.APP_TIMEZONE || "Asia/Colombo",
  }).format(new Date(value));
}

async function sendAppointmentApproved({
  to,
  customerName,
  ownerName,
  vcardTitle,
  startsAt,
  endsAt,
  meetingMode,
}) {
  if (!to) throw new Error("The customer does not have an email address");
  if (!process.env.MAIL_HOST || !process.env.MAIL_FROM) {
    throw new Error("Email delivery is not configured");
  }

  const startLabel = appointmentDate(startsAt);
  const endLabel = endsAt
    ? new Intl.DateTimeFormat("en", {
      timeStyle: "short",
      timeZone: process.env.APP_TIMEZONE || "Asia/Colombo",
    }).format(new Date(endsAt))
    : "";
  const normalizedMode = String(meetingMode || "").toLowerCase();
  const modeLabel = normalizedMode === "online"
    ? "Online meeting"
    : normalizedMode === "office"
      ? "Visit office"
      : /online/.test(normalizedMode) && /visit|office/.test(normalizedMode)
        ? "Office or online"
        : "Appointment";
  const hostLabel = ownerName || vcardTitle || "the card owner";
  const subject = `Appointment confirmed with ${hostLabel}`;
  const timeLabel = endLabel ? `${startLabel} – ${endLabel}` : startLabel;

  return getTransporter().sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text: [
      `Hello ${customerName},`,
      "",
      `Your appointment with ${hostLabel} has been approved.`,
      `Date and time: ${timeLabel}`,
      `Meeting mode: ${modeLabel}`,
      "",
      normalizedMode === "online"
        ? "The host will provide the online meeting details separately."
        : normalizedMode === "office"
          ? "Please arrive at the office a few minutes before your appointment."
          : "Please coordinate the meeting details with the host.",
      "",
      "Thank you,",
      "Sync E-Card",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033">
        <h2 style="color:#16865b">Appointment confirmed</h2>
        <p>Hello ${escapeHtml(customerName)},</p>
        <p>Your appointment with <strong>${escapeHtml(hostLabel)}</strong> has been approved.</p>
        <table style="width:100%;border-collapse:collapse;margin:22px 0">
          <tr><td style="padding:10px;border:1px solid #e2e8f0"><strong>Date and time</strong></td><td style="padding:10px;border:1px solid #e2e8f0">${escapeHtml(timeLabel)}</td></tr>
          <tr><td style="padding:10px;border:1px solid #e2e8f0"><strong>Meeting mode</strong></td><td style="padding:10px;border:1px solid #e2e8f0">${escapeHtml(modeLabel)}</td></tr>
        </table>
        <p>${normalizedMode === "online"
    ? "The host will provide the online meeting details separately."
    : normalizedMode === "office"
      ? "Please arrive at the office a few minutes before your appointment."
      : "Please coordinate the meeting details with the host."}</p>
        <p>Thank you,<br>Sync E-Card</p>
      </div>
    `,
  });
}

module.exports = { sendAppointmentApproved };
