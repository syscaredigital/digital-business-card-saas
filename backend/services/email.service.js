const nodemailer = require("nodemailer");

let transporter;
const DEFAULT_MAIL_FROM = "Sync E-Card <info@syncecard.lk>";

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

function mailFrom() {
  return process.env.MAIL_FROM || DEFAULT_MAIL_FROM;
}

function ensureMailConfigured() {
  if (!process.env.MAIL_HOST) {
    throw new Error("Email delivery is not configured");
  }
}

async function sendVcardEnquiry({
  to,
  ownerName,
  vcardTitle,
  enquirerName,
  enquirerEmail,
  enquirerPhone,
  company,
  message,
}) {
  if (!to) throw new Error("The VCard owner does not have an email address");
  ensureMailConfigured();

  const ownerLabel = ownerName || "there";
  const cardLabel = vcardTitle || "your VCard";
  const contactLines = [
    enquirerEmail ? `Email: ${enquirerEmail}` : "",
    enquirerPhone ? `Phone: ${enquirerPhone}` : "",
    company ? `Company: ${company}` : "",
  ].filter(Boolean);

  return getTransporter().sendMail({
    from: mailFrom(),
    to,
    replyTo: enquirerEmail || undefined,
    subject: `New enquiry for ${cardLabel}`,
    text: [
      `Hello ${ownerLabel},`,
      "",
      `${enquirerName} sent a new enquiry through ${cardLabel}.`,
      ...contactLines,
      "",
      "Message:",
      message,
      "",
      enquirerEmail
        ? "You can reply directly to this email to contact the enquirer."
        : "Use the phone number above to contact the enquirer.",
      "",
      "Sync E-Card",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033">
        <h2 style="color:#16865b">New VCard enquiry</h2>
        <p>Hello ${escapeHtml(ownerLabel)},</p>
        <p><strong>${escapeHtml(enquirerName)}</strong> sent a new enquiry through <strong>${escapeHtml(cardLabel)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:22px 0">
          ${enquirerEmail ? `<tr><td style="padding:10px;border:1px solid #e2e8f0"><strong>Email</strong></td><td style="padding:10px;border:1px solid #e2e8f0">${escapeHtml(enquirerEmail)}</td></tr>` : ""}
          ${enquirerPhone ? `<tr><td style="padding:10px;border:1px solid #e2e8f0"><strong>Phone</strong></td><td style="padding:10px;border:1px solid #e2e8f0">${escapeHtml(enquirerPhone)}</td></tr>` : ""}
          ${company ? `<tr><td style="padding:10px;border:1px solid #e2e8f0"><strong>Company</strong></td><td style="padding:10px;border:1px solid #e2e8f0">${escapeHtml(company)}</td></tr>` : ""}
        </table>
        <div style="padding:16px;background:#f8fafc;border-left:4px solid #16865b;white-space:pre-wrap">${escapeHtml(message)}</div>
        <p>${enquirerEmail
    ? "Reply directly to this email to contact the enquirer."
    : "Use the phone number above to contact the enquirer."}</p>
        <p>Sync E-Card</p>
      </div>
    `,
  });
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
  ensureMailConfigured();

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
    from: mailFrom(),
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

module.exports = { sendAppointmentApproved, sendVcardEnquiry };
