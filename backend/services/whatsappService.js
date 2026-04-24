const twilio = require('twilio');
const axios = require('axios');
const logger = require('../config/logger');

// Twilio WhatsApp client
let twilioClient = null;
function getTwilio() {
  if (!twilioClient) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Send WhatsApp message via Twilio.
 * @param {string} to - phone number with country code (without whatsapp: prefix)
 * @param {string} body - message text
 */
async function sendWhatsAppTwilio(to, body) {
  try {
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const msg = await getTwilio().messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      to: formattedTo,
      body,
    });
    logger.info(`WhatsApp (Twilio) sent to ${to}: ${msg.sid}`);
    return msg.sid;
  } catch (err) {
    logger.error(`WhatsApp Twilio failed to ${to}:`, err.message);
    throw err;
  }
}

/**
 * Send WhatsApp message via Interakt API (alternative).
 * @param {string} phoneNumber - phone with country code
 * @param {string} message - text message
 * @param {string} templateName - optional Interakt template name
 */
async function sendWhatsAppInterakt(phoneNumber, message, templateName = null) {
  try {
    const payload = {
      countryCode: phoneNumber.startsWith('+91') ? '+91' : '+1',
      phoneNumber: phoneNumber.replace(/^\+\d{1,3}/, ''),
      type: 'Text',
      data: { message },
    };

    if (templateName) {
      payload.type = 'Template';
      payload.template = { name: templateName, languageCode: 'en', bodyValues: [message] };
    }

    const resp = await axios.post('https://api.interakt.ai/v1/public/message/', payload, {
      headers: {
        Authorization: `Basic ${process.env.INTERAKT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    logger.info(`WhatsApp (Interakt) sent to ${phoneNumber}`);
    return resp.data;
  } catch (err) {
    logger.error(`WhatsApp Interakt failed to ${phoneNumber}:`, err.message);
    throw err;
  }
}

/**
 * Main send function — uses Twilio by default, falls back to Interakt.
 */
async function sendWhatsApp(phone, message) {
  if (!phone) {
    logger.warn('sendWhatsApp: no phone number, skipping');
    return null;
  }

  // Prefer Twilio if configured
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    return sendWhatsAppTwilio(phone, message);
  }

  // Fallback to Interakt
  if (process.env.INTERAKT_API_KEY) {
    return sendWhatsAppInterakt(phone, message);
  }

  logger.warn('No WhatsApp provider configured. Skipping.');
  return null;
}

// ── WhatsApp Message Templates ────────────────────────────────

function buildWelcomeWA(lead) {
  return `Hi ${lead.full_name}! 👋

Thank you for reaching out to *${process.env.COMPANY_NAME || 'Wizone'}*!

We've received your information and our team will contact you very shortly to discuss how we can help grow your business. 🚀

In the meantime, feel free to reply to this message with any questions.

Best regards,
${process.env.COMPANY_NAME} Team`;
}

function buildMeetingReminderWA(lead, reminderType) {
  const labels = {
    '4_days_before': '4 days',
    'same_day_9am': 'TODAY at 9:00 AM',
    '30_min_before': '30 minutes',
  };
  const timeLabel = labels[reminderType] || 'soon';

  return `⏰ *Meeting Reminder — ${process.env.COMPANY_NAME}*

Hi ${lead.full_name}! Your meeting is in *${timeLabel}*.

📅 ${new Date(lead.meeting_datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
${lead.meeting_link ? `\n🔗 Join here: ${lead.meeting_link}` : ''}

See you soon! 🎯`;
}

function buildFollowUpWA(lead, dayLabel) {
  return `Hi ${lead.full_name}! 👋

This is *${process.env.COMPANY_NAME}*. We noticed you haven't scheduled a meeting yet.

We'd love to show you how we can help your business grow! 📈

Would you be available for a quick 15-min call? Reply YES and we'll set it up right away! ✅

Or call us: ${process.env.COMPANY_PHONE || ''}`;
}

module.exports = { sendWhatsApp, buildWelcomeWA, buildMeetingReminderWA, buildFollowUpWA };
