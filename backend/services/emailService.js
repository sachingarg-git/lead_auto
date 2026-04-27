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

/* ── Date/time helpers (IST-aware, handle mssql Date objects) ─ */

/**
 * Format a slot_date value for display.
 * Handles: JS Date from mssql DATE column, ISO string "2026-04-26", etc.
 * Returns e.g. "Sat, 26 April 2026"
 */
function formatSlotDate(val) {
  if (!val) return '';
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d)) return String(val);
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return String(val); }
}

/**
 * Format a slot_time value for display.
 * Handles: JS Date from mssql TIME column (UTC epoch + time), HH:MM string, etc.
 * Returns e.g. "12:00 PM"
 */
function formatSlotTime(val) {
  if (!val) return '';
  try {
    if (val instanceof Date) {
      // mssql TIME → Date anchored at 1970-01-01 with time stored as UTC
      const hh = val.getUTCHours();
      const mm = String(val.getUTCMinutes()).padStart(2, '0');
      return `${String(hh % 12 || 12).padStart(2, '0')}:${mm} ${hh >= 12 ? 'PM' : 'AM'}`;
    }
    const parts = String(val).split(':');
    if (parts.length >= 2) {
      const hh = parseInt(parts[0]);
      const mm = String(parseInt(parts[1])).padStart(2, '0');
      return `${String(hh % 12 || 12).padStart(2, '0')}:${mm} ${hh >= 12 ? 'PM' : 'AM'}`;
    }
    return String(val);
  } catch { return String(val); }
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
 * Wrap rendered body text inside a branded Wizone email shell with logo header + footer.
 */
function wrapEmailHtml(bodyHtml, companyName = 'Wizone AI') {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- ── Logo Header ───────────────────────────── -->
        <tr>
          <td style="background:#ffffff;border-radius:12px 12px 0 0;
                     padding:20px 32px 18px;
                     border-bottom:3px solid #0891b2;
                     border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-top:1px solid #e2e8f0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:4px 0;">
                  <!-- Primary: hosted logo; onerror falls back to text mark -->
                  <img src="https://wizone.ai/assets/WIZONE%20AI%20LABS%20LOGO.png"
                       alt="Wizone AI Labs"
                       width="150" height="50"
                       style="display:block;max-width:150px;height:50px;object-fit:contain;"
                       onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'">
                  <!-- Fallback text logo (shown only when image fails) -->
                  <span style="display:none;font-size:20px;font-weight:900;color:#0e7490;
                               letter-spacing:-0.5px;font-family:Arial,sans-serif;">
                    Wi<span style="color:#0891b2;">zone</span>
                    <sup style="font-size:10px;color:#0891b2;font-weight:700;letter-spacing:1px;">AI</sup>
                  </span>
                </td>
                <td style="padding-left:14px;vertical-align:middle;text-align:right;">
                  <span style="color:#0e7490;font-size:11px;font-weight:600;letter-spacing:0.5px;
                               display:block;">AI Lead Manager</span>
                  <span style="color:#94a3b8;font-size:10px;">wizone.ai</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Body ──────────────────────────────────── -->
        <tr>
          <td style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;
                     border-right:1px solid #e2e8f0;color:#374151;
                     font-size:14px;line-height:1.8;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- ── Footer ────────────────────────────────── -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;
                     border-top:none;border-radius:0 0 12px 12px;
                     padding:20px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">
              © ${new Date().getFullYear()} ${companyName} &nbsp;·&nbsp; All rights reserved
            </p>
            <p style="margin:0;font-size:11px;color:#cbd5e1;">
              You are receiving this email because you enquired about our services.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
  let subject = '', body = '';

  try {
    const { getPool } = require('../config/database');
    const pool = await getPool();

    // 1. Source-linked template
    if (lead.source) {
      const r = await pool.query(`
        SELECT t.subject, t.body FROM "SourceTemplateMap" s
        JOIN "EmailTemplates" t ON t.id = s.template_id
        WHERE s.source = $1
      `, [lead.source]);
      if (r.rows.length) { subject = r.rows[0].subject; body = r.rows[0].body; }
    }

    // 2. Default template
    if (!subject) {
      const r = await pool.query(`SELECT subject, body FROM "EmailTemplates" WHERE is_default=true LIMIT 1`);
      if (r.rows.length) { subject = r.rows[0].subject; body = r.rows[0].body; }
    }
  } catch (err) {
    logger.warn('buildWelcomeEmail template lookup failed:', err.message);
  }

  // 3. AppSettings fallback (existing behaviour)
  if (!subject) {
    try {
      const Settings = require('../models/Settings');
      subject = await Settings.get('email_welcome_subject') || '';
      body    = await Settings.get('email_welcome_body') || '';
    } catch {}
  }

  const vars = {
    full_name:    lead.full_name    || '',
    phone:        lead.phone        || '',
    email:        lead.email        || '',
    company:      lead.company      || '',
    company_name: companyName,
    slot_date:    formatSlotDate(lead.slot_date),
    slot_time:    formatSlotTime(lead.slot_time),
    meet_link:    lead.meeting_link || '',
  };

  if (subject && body) {
    const renderedSubject = renderTemplate(subject, vars);
    const renderedBody    = renderTemplate(body, vars);
    const bodyHtml = `<div style="white-space:pre-line">${renderedBody.replace(/\n/g, '<br>')}</div>`;
    return { to: lead.email, subject: renderedSubject, html: wrapEmailHtml(bodyHtml, companyName) };
  }

  // Built-in fallback
  const fallbackBody = `
    <p style="font-size:16px;font-weight:bold;color:#0e7490;margin:0 0 16px;">
      Hi ${lead.full_name},
    </p>
    <p style="margin:0 0 12px;">
      Thank you for reaching out to <strong>${companyName}</strong>.
      We have received your enquiry and will contact you shortly!
    </p>
    ${lead.slot_date ? `
    <div style="background:#f0f9ff;border-left:4px solid #0891b2;padding:14px 18px;
                border-radius:6px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#0e7490;font-weight:600;">📅 Your Appointment</p>
      <p style="margin:6px 0 0;font-size:15px;font-weight:bold;color:#1e293b;">
        ${formatSlotDate(lead.slot_date)}${lead.slot_time ? ' &nbsp;at&nbsp; ' + formatSlotTime(lead.slot_time) + ' IST' : ''}
      </p>
    </div>` : ''}
    ${lead.meeting_link ? `
    <p style="margin:20px 0 0;">
      <a href="${lead.meeting_link}"
         style="display:inline-block;background:#0891b2;color:#ffffff;
                padding:13px 30px;border-radius:8px;text-decoration:none;
                font-weight:bold;font-size:14px;">
        🎥 Join Google Meet
      </a>
    </p>` : ''}
    <p style="margin:28px 0 0;color:#64748b;font-size:13px;">
      Best regards,<br><strong>${companyName} Team</strong>
    </p>`;
  return {
    to:      lead.email,
    subject: `Welcome ${lead.full_name}! Your enquiry is confirmed`,
    html:    wrapEmailHtml(fallbackBody, companyName),
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

/**
 * Send reschedule confirmation email to the lead.
 * Called when a meeting is rescheduled (customer request or team-initiated).
 */
async function buildRescheduleEmail(lead, { newDate, newTime, reason, type } = {}) {
  const companyName = await getCompanyName();
  const typeLabel   = type === 'customer_request' ? 'your request' : 'scheduling reasons';
  const dateStr     = newDate ? formatSlotDate(newDate instanceof Date ? newDate : new Date(newDate)) : '';
  const timeStr     = newTime ? formatSlotTime(newTime) : '';
  const when        = dateStr ? `${dateStr}${timeStr ? ' at ' + timeStr : ''}` : 'a new time (to be confirmed)';

  return {
    to:      lead.email,
    subject: `📅 Meeting Rescheduled — ${companyName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9fafb;border-radius:8px">
      <div style="background:#0891b2;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:20px">${companyName}</h2>
      </div>
      <div style="background:#fff;padding:28px 24px;border-radius:0 0 8px 8px;color:#374151;line-height:1.7;font-size:14px">
        <p>Hi <strong>${lead.full_name}</strong>,</p>
        <p>Your meeting has been rescheduled due to <strong>${typeLabel}</strong>.</p>
        <div style="background:#f0f9ff;border-left:4px solid #0891b2;padding:14px;margin:16px 0;border-radius:4px">
          <strong>📅 New appointment: ${when}</strong>
        </div>
        ${reason ? `<p><em>Reason: ${reason}</em></p>` : ''}
        <p>If you have any questions, please don't hesitate to reach out.</p>
        <p>Best regards,<br><strong>${companyName} Team</strong></p>
      </div>
    </div>`,
  };
}

/**
 * Build and send a dedicated "Your Meet Link" email to the lead.
 * Checks EmailTemplates for a template named matching 'meet' keywords first.
 * Falls back to a branded built-in template.
 *
 * @param {Object} lead  — full lead row from DB (must have email + meeting_link)
 * @returns {Promise<string|null>} — messageId or null
 */
async function sendMeetLinkEmail(lead) {
  if (!lead.email)        { logger.warn(`[MeetEmail] No email for lead ${lead.id}`); return null; }
  if (!lead.meeting_link) { logger.warn(`[MeetEmail] No meeting_link for lead ${lead.id}`); return null; }

  const companyName = process.env.COMPANY_NAME || 'Wizone AI';

  // ── Try to find a "Meet Link" template in DB ──────────────────
  let subject = '', body = '';
  try {
    const { getPool } = require('../config/database');
    const pool = await getPool();
    // Look for a template whose name contains 'meet' (case-insensitive)
    const r = await pool.query(
      `SELECT subject, body FROM "EmailTemplates"
       WHERE LOWER(name) LIKE '%meet%' OR LOWER(name) LIKE '%video%' OR LOWER(name) LIKE '%link%'
       ORDER BY id ASC LIMIT 1`
    );
    if (r.rows.length) { subject = r.rows[0].subject; body = r.rows[0].body; }
  } catch (err) {
    logger.warn('[MeetEmail] Template lookup failed:', err.message);
  }

  const slotDateStr = formatSlotDate(lead.slot_date);
  const slotTimeStr = formatSlotTime(lead.slot_time);

  if (subject && body) {
    // Render configured template
    const vars = {
      full_name:    lead.full_name    || '',
      phone:        lead.phone        || '',
      email:        lead.email        || '',
      company:      lead.company      || '',
      company_name: companyName,
      slot_date:    slotDateStr,
      slot_time:    slotTimeStr,
      meet_link:    lead.meeting_link,
    };
    const renderedSubject = renderTemplate(subject, vars);
    const renderedBody    = renderTemplate(body, vars);
    const html = wrapEmailHtml(
      `<div style="white-space:pre-line">${renderedBody.replace(/\n/g, '<br>')}</div>`,
      companyName
    );
    return sendEmail({ to: lead.email, subject: renderedSubject, html });
  }

  // ── Built-in branded fallback ─────────────────────────────────
  const slotCard = slotDateStr ? `
    <div style="background:#f0f9ff;border-left:4px solid #0891b2;padding:14px 18px;
                border-radius:6px;margin:0 0 24px;">
      <p style="margin:0;font-size:12px;color:#0e7490;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        📅 Your Appointment
      </p>
      <p style="margin:6px 0 0;font-size:16px;font-weight:bold;color:#1e293b;">
        ${slotDateStr}${slotTimeStr ? ' &nbsp;at&nbsp; <span style="color:#0891b2">' + slotTimeStr + ' IST</span>' : ''}
      </p>
    </div>` : '';

  const html = wrapEmailHtml(`
    <p style="font-size:17px;font-weight:bold;color:#0e7490;margin:0 0 8px;">
      Hi ${lead.full_name},
    </p>
    <p style="margin:0 0 24px;color:#475569;line-height:1.7;">
      Your Wizone AI demo meeting link is ready. Join a few minutes before your scheduled time.
    </p>
    ${slotCard}
    <div style="text-align:center;background:#f8fafc;border:2px dashed #0891b2;
                border-radius:12px;padding:28px 24px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;letter-spacing:1px;text-transform:uppercase;">
        🎥 Your Video Meeting Link
      </p>
      <a href="${lead.meeting_link}"
         style="display:inline-block;background:#0891b2;color:#ffffff;
                padding:14px 36px;border-radius:8px;text-decoration:none;
                font-weight:bold;font-size:15px;margin:12px 0;">
        Join Meeting →
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">
        ${lead.meeting_link}
      </p>
    </div>
    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">
      Please keep this link safe — it is unique to your session.<br>
      If you have any questions, reply to this email or contact us on WhatsApp.<br><br>
      <strong>${companyName} Team</strong>
    </p>
  `, companyName);

  const renderedSubject = slotDateStr
    ? `🎥 Your Meeting Link — ${slotDateStr} ${slotTimeStr ? 'at ' + slotTimeStr : ''} | ${companyName}`
    : `🎥 Your Meeting Link | ${companyName}`;

  return sendEmail({ to: lead.email, subject: renderedSubject, html });
}

module.exports = {
  sendEmail, testEmail, resetTransporter,
  buildWelcomeEmail, buildMeetingReminderEmail, buildFollowUpEmail,
  buildRescheduleEmail, formatSlotDate, formatSlotTime, renderTemplate, wrapEmailHtml,
  sendMeetLinkEmail,
};
