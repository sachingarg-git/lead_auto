/**
 * Central Communication Orchestrator
 * Coordinates Email + WhatsApp + Telegram for each automation event.
 */
const { sendEmail, buildWelcomeEmail, buildMeetingReminderEmail, buildFollowUpEmail, sendQuestionnaireEmail } = require('./emailService');
const { sendWhatsApp, buildWelcomeWA, buildMeetingReminderWA, buildFollowUpWA } = require('./whatsappService');
const { sendTelegram, notifyAdminNewLead, notifyAdminReminder } = require('./telegramService');
const { query } = require('../config/database');
const logger = require('../config/logger');
const { generateToken } = require('../routes/public');

/**
 * Log a communication event in DB.
 */
async function logCommunication(leadId, reminderId, channel, status, providerId, message) {
  try {
    await query(
      `INSERT INTO "CommunicationLogs" (lead_id, reminder_id, channel, status, provider_id, message)
       VALUES (@lead_id, @reminder_id, @channel, @status, @provider_id, @message)`,
      {
        lead_id:    leadId,
        reminder_id: reminderId || null,
        channel,
        status,
        provider_id: providerId || null,
        message:    message || null,
      }
    );
  } catch (err) {
    logger.error('logCommunication failed:', err.message);
  }
}

/**
 * Send Welcome messages on lead capture (all channels in parallel).
 * Auto-send runs ONCE — guarded by welcome_sent flag in DB.
 */
async function sendWelcomeMessages(lead) {
  // ── Build message payloads first (these are async) ──────────
  const [emailPayload, waMessage] = await Promise.all([
    lead.email ? buildWelcomeEmail(lead) : Promise.resolve(null),
    (lead.whatsapp_number || lead.phone) ? buildWelcomeWA(lead) : Promise.resolve(null),
  ]);

  const results = await Promise.allSettled([
    // Email
    emailPayload
      ? sendEmail(emailPayload).then(id => ({ channel: 'Email', id }))
      : Promise.resolve(null),

    // WhatsApp
    waMessage && (lead.whatsapp_number || lead.phone)
      ? sendWhatsApp(lead.whatsapp_number || lead.phone, waMessage)
          .then(id => ({ channel: 'WhatsApp', id }))
      : Promise.resolve(null),

    // Telegram (lead-facing, if they provided chat_id)
    lead.telegram_chat_id
      ? sendTelegram(lead.telegram_chat_id, waMessage || '')
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

  // Mark welcome as sent (once-only flag)
  await query(
    'UPDATE "Leads" SET welcome_sent = true, last_contacted = NOW() WHERE id = @id',
    { id: lead.id }
  );

  // ── Send questionnaire email immediately after welcome ───────
  if (lead.email) {
    try {
      const token = generateToken(lead.id);
      await sendQuestionnaireEmail(lead, token);
      logger.info(`[communicationService] Questionnaire email sent to lead ${lead.id}`);
    } catch (err) {
      logger.warn(`[communicationService] Questionnaire email failed for lead ${lead.id}:`, err.message);
    }
  }
}

/**
 * Manual: Send email to a specific lead.
 * template: 'welcome' | 'custom'
 */
async function sendManualEmail(lead, { template = 'welcome', customSubject, customBody } = {}) {
  let payload;

  if (template === 'welcome') {
    payload = await buildWelcomeEmail(lead);
  } else {
    payload = {
      to:      lead.email,
      subject: customSubject || `Message from our team`,
      html:    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;white-space:pre-line">${(customBody || '').replace(/\n/g, '<br>')}</div>`,
    };
  }

  if (!payload?.to) throw new Error('Lead has no email address');

  const msgId = await sendEmail(payload);
  if (msgId) {
    await logCommunication(lead.id, null, 'Email', 'Delivered', msgId, `Manual email — ${template}`);
    await query(
      'UPDATE "Leads" SET last_contacted = NOW(), contact_count = contact_count + 1 WHERE id = @id',
      { id: lead.id }
    );
  }
  return { sent: !!msgId, to: payload.to, subject: payload.subject };
}

/**
 * Manual: Send WhatsApp to a specific lead.
 * template: 'welcome' | 'custom'
 */
async function sendManualWhatsApp(lead, { template = 'welcome', customMessage } = {}) {
  const phone = lead.whatsapp_number || lead.phone;
  if (!phone) throw new Error('Lead has no phone number');

  let message;
  if (template === 'welcome') {
    message = await buildWelcomeWA(lead);
  } else {
    message = customMessage || '';
  }

  if (!message) throw new Error('Message cannot be empty');

  const result = await sendWhatsApp(phone, message);
  if (result) {
    await logCommunication(lead.id, null, 'WhatsApp', 'Delivered', null, `Manual WA — ${template}`);
    await query(
      'UPDATE "Leads" SET last_contacted = NOW(), contact_count = contact_count + 1 WHERE id = @id',
      { id: lead.id }
    );
  }
  return { sent: !!result, to: phone };
}

/**
 * Send meeting reminder (for Type1 leads).
 */
async function sendMeetingReminder(lead, reminderType, reminderId) {
  const [emailPayload, waMessage] = await Promise.all([
    lead.email ? buildMeetingReminderEmail(lead, reminderType) : null,
    (lead.whatsapp_number || lead.phone) ? buildMeetingReminderWA(lead, reminderType) : null,
  ]);

  const results = await Promise.allSettled([
    emailPayload
      ? sendEmail(emailPayload).then(id => ({ channel: 'Email', id }))
      : Promise.resolve(null),

    waMessage && (lead.whatsapp_number || lead.phone)
      ? sendWhatsApp(lead.whatsapp_number || lead.phone, waMessage)
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
    'UPDATE "Leads" SET last_contacted = NOW(), contact_count = contact_count + 1 WHERE id = @id',
    { id: lead.id }
  );
}

/**
 * Send follow-up message for Type2 leads.
 */
async function sendFollowUpMessage(lead, dayNumber, reminderId) {
  const dayLabel = dayNumber === 0 ? 'Immediate' : `Day ${dayNumber}`;
  const waMsg    = buildFollowUpWA(lead, dayLabel);

  const results = await Promise.allSettled([
    lead.email
      ? sendEmail(buildFollowUpEmail(lead, dayNumber)).then(id => ({ channel: 'Email', id }))
      : Promise.resolve(null),

    (lead.whatsapp_number || lead.phone)
      ? sendWhatsApp(lead.whatsapp_number || lead.phone, waMsg)
          .then(id => ({ channel: 'WhatsApp', id }))
      : Promise.resolve(null),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      await logCommunication(lead.id, reminderId, r.value.channel, 'Delivered', r.value.id, `Follow-up: ${dayLabel}`);
    }
  }

  await query(
    'UPDATE "Leads" SET last_contacted = NOW(), contact_count = contact_count + 1 WHERE id = @id',
    { id: lead.id }
  );
}

module.exports = {
  sendWelcomeMessages, sendMeetingReminder, sendFollowUpMessage, logCommunication,
  sendManualEmail, sendManualWhatsApp,
};
