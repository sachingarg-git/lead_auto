const axios  = require('axios');
const logger = require('../config/logger');

/** Resolve Interakt API key: DB first, .env fallback */
async function getInteraktKey() {
  try {
    const Settings = require('../models/Settings');
    const s = await Settings.getAll();
    if (s.interakt_enabled === 'true' && s.interakt_api_key && s.interakt_api_key.length > 4) {
      return s.interakt_api_key;
    }
  } catch {}
  return process.env.INTERAKT_API_KEY || null;
}

/**
 * Substitute {{variable}} placeholders in a template string.
 * Supports {{#if key}}...{{/if}} conditional blocks.
 */
function renderTemplate(template, vars) {
  let out = template;
  out = out.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) => {
    return vars[key] ? inner : '';
  });
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
  return out;
}

/**
 * Send WhatsApp message via Interakt API.
 */
async function sendWhatsAppInterakt(phoneNumber, message) {
  const apiKey = await getInteraktKey();
  if (!apiKey) {
    logger.warn('sendWhatsApp: Interakt API key not configured, skipping');
    return null;
  }

  try {
    // Normalize phone number
    let phone = String(phoneNumber).replace(/\D/g, '');
    // Remove leading country code if present for Interakt format
    let countryCode = '+91';
    if (phone.startsWith('91') && phone.length > 10) {
      phone = phone.slice(2);
    } else if (phone.startsWith('1') && phone.length === 11) {
      phone = phone.slice(1);
      countryCode = '+1';
    }

    const payload = {
      countryCode,
      phoneNumber: phone,
      type: 'Text',
      data: { message },
    };

    const resp = await axios.post('https://api.interakt.ai/v1/public/message/', payload, {
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    logger.info(`WhatsApp (Interakt) sent to ${phoneNumber}`);
    return resp.data;
  } catch (err) {
    const errMsg = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    logger.error(`WhatsApp Interakt failed to ${phoneNumber}: ${errMsg}`);
    return null; // don't throw — WA failure should not block lead creation
  }
}

/**
 * Main send function.
 */
async function sendWhatsApp(phone, message) {
  if (!phone) { logger.warn('sendWhatsApp: no phone number'); return null; }
  return sendWhatsAppInterakt(phone, message);
}

// ── Template builders ────────────────────────────────────────

async function buildWelcomeWA(lead) {
  let template = '';
  try {
    const Settings = require('../models/Settings');
    template = await Settings.get('whatsapp_welcome_template') || '';
  } catch {}

  const companyName = (() => {
    try { return require('../models/Settings'); } catch {}
    return null;
  })();

  const vars = {
    full_name:    lead.full_name    || '',
    phone:        lead.phone        || '',
    company:      lead.company      || '',
    company_name: process.env.COMPANY_NAME || 'Wizone',
    slot_date:    lead.slot_date ? String(lead.slot_date).substring(0, 10) : '',
    slot_time:    lead.slot_time    || '',
  };

  // Resolve company_name from DB async
  try {
    const S = require('../models/Settings');
    const cn = await S.get('company_name');
    if (cn) vars.company_name = cn;
  } catch {}

  if (template) return renderTemplate(template, vars);

  // Built-in fallback
  return `Hi ${vars.full_name}! 👋\n\nThank you for reaching out to *${vars.company_name}*! We received your information and will contact you shortly. 🚀${vars.slot_date ? `\n\n📅 Appointment: *${vars.slot_date}*${vars.slot_time ? ' at ' + vars.slot_time : ''}` : ''}\n\nReply with any questions!\n— ${vars.company_name} Team`;
}

function buildMeetingReminderWA(lead, reminderType) {
  const labels = {
    '4_days_before': '4 days',
    'same_day_9am':  'TODAY',
    '30_min_before': '30 minutes',
  };
  const timeLabel   = labels[reminderType] || 'soon';
  const companyName = process.env.COMPANY_NAME || 'Wizone';
  const meetingStr  = lead.meeting_datetime
    ? new Date(lead.meeting_datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : '';

  return `⏰ *Meeting Reminder — ${companyName}*\n\nHi ${lead.full_name}! Your meeting is in *${timeLabel}*.\n📅 ${meetingStr}${lead.meeting_link ? `\n🔗 ${lead.meeting_link}` : ''}\n\nSee you soon! 🎯`;
}

function buildFollowUpWA(lead, dayLabel) {
  const companyName = process.env.COMPANY_NAME || 'Wizone';
  return `Hi ${lead.full_name}! 👋\n\nThis is *${companyName}*. We'd love to show you how we can help your business grow! 📈\n\nWould you be free for a quick 15-min call? Reply *YES* and we'll set it up! ✅\n\n${process.env.COMPANY_PHONE ? 'Call us: ' + process.env.COMPANY_PHONE : ''}`;
}

module.exports = { sendWhatsApp, buildWelcomeWA, buildMeetingReminderWA, buildFollowUpWA };
