/**
 * Central Communication Orchestrator
 * Coordinates Email + WhatsApp + Telegram for each automation event.
 */
const { sendEmail, buildWelcomeEmail, buildMeetingReminderEmail, buildFollowUpEmail } = require('./emailService');
const { sendWhatsApp, buildWelcomeWA, buildMeetingReminderWA, buildFollowUpWA } = require('./whatsappService');
const { sendTelegram, notifyAdminNewLead, notifyAdminReminder } = require('./telegramService');
const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Log a communication event in DB.
 */
async function logCommunication(leadId, reminderId, channel, status, providerId, message) {
  try {
    await query(
      `INSERT INTO CommunicationLogs (lead_id, reminder_id, channel, status, provider_id, message)
       VALUES (@lead_id, @reminder_id, @channel, @status, @provider_id, @message)`,
      {
        lead_id: leadId,
        reminder_id: reminderId || null,
        channel,
        status,
        provider_id: providerId || null,
        message: message || null,
      }
    );
  } catch (err) {
    logger.error('logCommunication failed:', err.message);
  }
}

/**
 * Send Welcome messages on lead capture (all channels in parallel).
 * Matches: IMMEDIATE step in Type2 flow, and confirmation for Type1.
 */
async function sendWelcomeMessages(lead) {
  const results = await Promise.allSettled([
    // Email
    lead.email
      ? sendEmail(buildWelcomeEmail(lead)).then(id => ({ channel: 'Email', id }))
      : Promise.resolve(null),

    // WhatsApp
    lead.whatsapp_number || lead.phone
      ? sendWhatsApp(lead.whatsapp_number || lead.phone, buildWelcomeWA(lead))
          .then(id => ({ channel: 'WhatsApp', id }))
      : Promise.resolve(null),

    // Telegram (lead-facing, if they provided chat_id)
    lead.telegram_chat_id
      ? sendTelegram(lead.telegram_chat_id, buildWelcomeWA(lead))
          .then(id => ({ channel: 'Telegram', id }))
      : Promise.resolve(null),

    // Admin notification
    notifyAdminNewLead(lead),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      await logCommunication(lead.id, null, r.value.channel, 'Delivered', r.value.id, 'Welcome message');
    } else if (r.status === 'rejected') {
      logger.error('Welcome message failed:', r.reason?.message);
    }
  }

  // Mark welcome as sent
  await query('UPDATE Leads SET welcome_sent = 1, last_contacted = GETDATE() WHERE id = @id', { id: lead.id });
}

/**
 * Send meeting reminder (for Type1 leads).
 * reminderType: '4_days_before' | 'same_day_9am' | '30_min_before'
 */
async function sendMeetingReminder(lead, reminderType, reminderId) {
  const results = await Promise.allSettled([
    lead.email
      ? sendEmail(buildMeetingReminderEmail(lead, reminderType)).then(id => ({ channel: 'Email', id }))
      : Promise.resolve(null),

    (lead.whatsapp_number || lead.phone)
      ? sendWhatsApp(lead.whatsapp_number || lead.phone, buildMeetingReminderWA(lead, reminderType))
          .then(id => ({ channel: 'WhatsApp', id }))
      : Promise.resolve(null),

    notifyAdminReminder(lead, reminderType),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      await logCommunication(lead.id, reminderId, r.value.channel, 'Delivered', r.value.id, `Meeting reminder: ${reminderType}`);
    }
  }

  await query(
    `UPDATE Leads SET last_contacted = GETDATE(), contact_count = contact_count + 1 WHERE id = @id`,
    { id: lead.id }
  );
}

/**
 * Send follow-up message for Type2 leads.
 * dayNumber: 0 (immediate), 1, 3, 5, 7
 */
async function sendFollowUpMessage(lead, dayNumber, reminderId) {
  const dayLabel = dayNumber === 0 ? 'Immediate' : `Day ${dayNumber}`;

  const results = await Promise.allSettled([
    lead.email
      ? sendEmail(buildFollowUpEmail(lead, dayNumber)).then(id => ({ channel: 'Email', id }))
      : Promise.resolve(null),

    (lead.whatsapp_number || lead.phone)
      ? sendWhatsApp(lead.whatsapp_number || lead.phone, buildFollowUpWA(lead, dayLabel))
          .then(id => ({ channel: 'WhatsApp', id }))
      : Promise.resolve(null),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      await logCommunication(lead.id, reminderId, r.value.channel, 'Delivered', r.value.id, `Follow-up: ${dayLabel}`);
    }
  }

  await query(
    `UPDATE Leads SET last_contacted = GETDATE(), contact_count = contact_count + 1 WHERE id = @id`,
    { id: lead.id }
  );
}

module.exports = { sendWelcomeMessages, sendMeetingReminder, sendFollowUpMessage, logCommunication };
