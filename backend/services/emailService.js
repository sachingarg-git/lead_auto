const nodemailer = require('nodemailer');
const logger     = require('../config/logger');

let _transporter = null;

/** Reset cached transporter (called when SMTP settings are updated) */
function resetTransporter() { _transporter = null; }

/** Build transporter from DB settings (with .env fallback) */
async function getTransporter() {
  if (_transporter) return _transporter;

  let host, port, user, pass, secure;
  try {
    const Settings = require('../models/Settings');
    const s = await Settings.getAll();
    if (s.smtp_enabled === 'true' && s.smtp_user && s.smtp_pass) {
      host   = s.smtp_host  || 'smtp.gmail.com';
      port   = parseInt(s.smtp_port) || 587;
      user   = s.smtp_user;
      pass   = s.smtp_pass;
      secure = port === 465;
    }
  } catch {}

  // Fallback to .env
  if (!user) {
    host   = process.env.SMTP_HOST || 'smtp.gmail.com';
    port   = parseInt(process.env.SMTP_PORT) || 587;
    user   = process.env.SMTP_USER;
    pass   = process.env.SMTP_PASS;
    secure = process.env.SMTP_SECURE === 'true';
  }

  if (!user || !pass) return null; // not configured

  _transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return _transporter;
}

/** Resolve company name from DB or .env */
async function getCompanyName() {
  try {
    const Settings = require('../models/Settings');
    const name = await Settings.get('company_name');
    if (name) return name;
  } catch {}
  return process.env.COMPANY_NAME || 'Wizone';
}

/** Resolve SMTP from-name */
async function getFromName() {
  try {
    const Settings = require('../models/Settings');
    const name = await Settings.get('smtp_from_name');
    if (name) return name;
  } catch {}
  return process.env.COMPANY_NAME || 'Wizone LMS';
}

/**
 * Substitute {{variable}} placeholders in a template string.
 * Supports: {{full_name}}, {{phone}}, {{email}}, {{company}},
 *           {{company_name}}, {{slot_date}}, {{slot_time}}
 * Also handles simple {{#if slot_date}}...{{/if}} blocks.
 */
function renderTemplate(template, vars) {
  let out = template;

  // Handle {{#if key}}...{{/if}} blocks
  out = out.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) => {
    return vars[key] ? inner : '';
  });

  // Replace {{variable}} with value
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
  return out;
}

/**
 * Send a single email.
 */
async function sendEmail({ to, subject, html, text }) {
  if (!to) { logger.warn('sendEmail: no recipient'); return null; }
  const t = await getTransporter();
  if (!t) { logger.warn('sendEmail: SMTP not configured, skipping'); return null; }

  try {
    const fromName  = await getFromName();
    const fromEmail = process.env.SMTP_USER || (await (async () => {
      try { const S = require('../models/Settings'); return await S.get('smtp_user'); } catch { return ''; }
    })());

    const info = await t.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to, subject,
      text: text || html?.replace(/<[^>]+>/g, '') || '',
      html: html || undefined,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info.messageId;
  } catch (err) {
    logger.error(`Email failed to ${to}:`, err.message);
    return null; // don't throw — email failure should not block lead creation
  }
}

/** Send test email (plain text) */
async function testEmail(to) {
  const t = await getTransporter();
  if (!t) throw new Error('SMTP not configured. Enable SMTP and enter credentials in Settings.');
  const fromName  = await getFromName();
  const Settings  = require('../models/Settings');
  const fromEmail = await Settings.get('smtp_user') || process.env.SMTP_USER || '';
  await t.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: '✅ Wizone LMS — SMTP Test Email',
    text: 'This is a test email from Wizone LMS. Your SMTP configuration is working correctly!',
  });
}

// ── Template builders (use DB templates, fallback to built-in) ──

async function buildWelcomeEmail(lead) {
  const companyName = await getCompanyName();
  let subject, body;

  try {
    const Settings = require('../models/Settings');
    subject = await Settings.get('email_welcome_subject') || '';
    body    = await Settings.get('email_welcome_body') || '';
  } catch {}

  const vars = {
    full_name:    lead.full_name    || '',
    phone:        lead.phone        || '',
    email:        lead.email        || '',
    company:      lead.company      || '',
    company_name: companyName,
    slot_date:    lead.slot_date ? String(lead.slot_date).substring(0, 10) : '',
    slot_time:    lead.slot_time    || '',
  };

  if (subject && body) {
    const renderedSubject = renderTemplate(subject, vars);
    const renderedBody    = renderTemplate(body, vars);
    // Convert plain text to simple HTML
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9fafb;border-radius:8px">
      <div style="background:#0891b2;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:20px">${companyName}</h2>
      </div>
      <div style="background:#fff;padding:28px 24px;border-radius:0 0 8px 8px;white-space:pre-line;color:#374151;line-height:1.7;font-size:14px">
        ${renderedBody.replace(/\n/g, '<br>')}
      </div>
    </div>`;
    return { to: lead.email, subject: renderedSubject, html };
  }

  // Built-in fallback
  return {
    to: lead.email,
    subject: `Welcome ${lead.full_name}! We received your enquiry`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
      <h2>Hi ${lead.full_name},</h2>
      <p>Thank you for reaching out to <strong>${companyName}</strong>. We will contact you shortly!</p>
      ${lead.slot_date ? `<p>📅 Your appointment: <strong>${String(lead.slot_date).substring(0,10)}${lead.slot_time ? ' at ' + lead.slot_time : ''}</strong></p>` : ''}
      <p>Best regards,<br>${companyName} Team</p>
    </div>`,
  };
}

function buildMeetingReminderEmail(lead, reminderType) {
  const labels = { '4_days_before': '4 Days', 'same_day_9am': 'Today', '30_min_before': '30 Minutes' };
  const timeLabel = labels[reminderType] || 'Upcoming';
  const companyName = process.env.COMPANY_NAME || 'Wizone';
  const meetingDate = lead.meeting_datetime
    ? new Date(lead.meeting_datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })
    : '';

  return {
    to: lead.email,
    subject: `Reminder: Your Meeting with ${companyName} is in ${timeLabel}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
      <h2>Hi ${lead.full_name},</h2>
      <p>Your meeting is scheduled for:</p>
      <div style="background:#f0f9ff;border-left:4px solid #0891b2;padding:14px;margin:16px 0;border-radius:4px">
        <strong>📅 ${meetingDate}</strong>
      </div>
      ${lead.meeting_link ? `<p><a href="${lead.meeting_link}" style="background:#0891b2;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Join Meeting</a></p>` : ''}
      <p>— ${companyName} Team</p>
    </div>`,
  };
}

function buildFollowUpEmail(lead, dayNumber) {
  const companyName = process.env.COMPANY_NAME || 'Wizone';
  const subjects = {
    0: `We're excited to connect with you, ${lead.full_name}!`,
    1: `${lead.full_name}, let's explore how we can help`,
    3: `Real results for businesses like yours, ${lead.full_name}`,
    5: `A personal note for ${lead.full_name}`,
    7: `Last chance to connect — ${lead.full_name}`,
  };
  return {
    to: lead.email,
    subject: subjects[dayNumber] || `Following up — ${companyName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
      <h2>Hi ${lead.full_name},</h2>
      <p>We'd love to show you what <strong>${companyName}</strong> can do for your business. Would you be open to a quick 15-minute call?</p>
      <p>— ${companyName} Team</p>
    </div>`,
  };
}

module.exports = {
  sendEmail, testEmail, resetTransporter,
  buildWelcomeEmail, buildMeetingReminderEmail, buildFollowUpEmail,
};
