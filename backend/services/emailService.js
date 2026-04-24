const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

/**
 * Send a single email.
 * @param {object} opts - { to, subject, html, text }
 * @returns {object} messageId or null on failure
 */
async function sendEmail({ to, subject, html, text }) {
  if (!to) {
    logger.warn('sendEmail: no recipient, skipping');
    return null;
  }
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || 'Wizone <no-reply@wizone.com>',
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, ''),
      html,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info.messageId;
  } catch (err) {
    logger.error(`Email failed to ${to}:`, err.message);
    throw err;
  }
}

// ── Email Templates ───────────────────────────────────────────

function buildWelcomeEmail(lead) {
  return {
    to: lead.email,
    subject: `Welcome to ${process.env.COMPANY_NAME || 'Wizone'}! We've Got Your Information`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9f9f9">
        <div style="background:#1a1a2e;padding:30px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:#00d4ff;margin:0">${process.env.COMPANY_NAME || 'Wizone'}</h1>
        </div>
        <div style="background:#fff;padding:30px;border-radius:0 0 8px 8px">
          <h2 style="color:#1a1a2e">Hi ${lead.full_name},</h2>
          <p>Thank you for reaching out! We've received your information and our team will contact you very shortly.</p>
          <p>Here's what to expect:</p>
          <ul>
            <li>Our team will review your requirements</li>
            <li>We'll reach out within the next few hours</li>
            <li>We'll present you with the best solution tailored to your needs</li>
          </ul>
          <div style="text-align:center;margin:30px 0">
            <a href="${process.env.COMPANY_WEBSITE || '#'}"
               style="background:#00d4ff;color:#000;padding:12px 30px;border-radius:5px;text-decoration:none;font-weight:bold">
              Visit Our Website
            </a>
          </div>
          <p style="color:#666">Best regards,<br><strong>${process.env.COMPANY_NAME || 'Wizone'} Team</strong></p>
        </div>
      </div>
    `,
  };
}

function buildMeetingReminderEmail(lead, reminderType) {
  const labels = {
    '4_days_before': '4 Days',
    'same_day_9am': 'Today',
    '30_min_before': '30 Minutes',
  };
  const timeLabel = labels[reminderType] || 'Upcoming';
  const meetingDate = new Date(lead.meeting_datetime).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short',
  });

  return {
    to: lead.email,
    subject: `Reminder: Your Meeting with ${process.env.COMPANY_NAME} is in ${timeLabel}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#1a1a2e;padding:20px;text-align:center">
          <h1 style="color:#00d4ff;margin:0">${process.env.COMPANY_NAME || 'Wizone'}</h1>
        </div>
        <div style="padding:30px;background:#fff">
          <h2>Hi ${lead.full_name},</h2>
          <p>This is a friendly reminder that your meeting is scheduled for:</p>
          <div style="background:#f0f8ff;border-left:4px solid #00d4ff;padding:15px;margin:20px 0">
            <strong>📅 ${meetingDate}</strong>
          </div>
          ${lead.meeting_link ? `
          <div style="text-align:center;margin:20px 0">
            <a href="${lead.meeting_link}"
               style="background:#00d4ff;color:#000;padding:12px 30px;border-radius:5px;text-decoration:none;font-weight:bold">
              Join Meeting
            </a>
          </div>` : ''}
          <p>If you need to reschedule, please contact us at ${process.env.COMPANY_PHONE || ''}.</p>
        </div>
      </div>
    `,
  };
}

function buildFollowUpEmail(lead, dayNumber) {
  const subjects = {
    0: `We're excited to connect with you, ${lead.full_name}!`,
    1: `${lead.full_name}, let's explore how we can help you`,
    3: `Real results for businesses like yours, ${lead.full_name}`,
    5: `A personal note for ${lead.full_name}`,
    7: `Last chance to connect — ${lead.full_name}`,
  };

  return {
    to: lead.email,
    subject: subjects[dayNumber] || `Following up — ${process.env.COMPANY_NAME}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#1a1a2e;padding:20px;text-align:center">
          <h1 style="color:#00d4ff;margin:0">${process.env.COMPANY_NAME || 'Wizone'}</h1>
        </div>
        <div style="padding:30px;background:#fff">
          <h2>Hi ${lead.full_name},</h2>
          <p>We noticed you haven't scheduled a meeting yet, and we'd love to show you what we can do for your business.</p>
          <p>Would you be open to a quick 15-minute call? We promise it'll be worth your time!</p>
          <div style="text-align:center;margin:20px 0">
            <a href="${process.env.COMPANY_WEBSITE || '#'}/book"
               style="background:#00d4ff;color:#000;padding:12px 30px;border-radius:5px;text-decoration:none;font-weight:bold">
              Book a Meeting Now
            </a>
          </div>
          <p>Reply to this email or call us at ${process.env.COMPANY_PHONE || ''}.</p>
          <p>Best,<br><strong>${process.env.COMPANY_NAME} Team</strong></p>
        </div>
      </div>
    `,
  };
}

module.exports = { sendEmail, buildWelcomeEmail, buildMeetingReminderEmail, buildFollowUpEmail };
