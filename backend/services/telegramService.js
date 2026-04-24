const axios = require('axios');
const logger = require('../config/logger');

function getTelegramApiBase() {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
}

/**
 * Send a Telegram message.
 * @param {string} chatId - Telegram chat ID (lead's or admin's)
 * @param {string} text - Message text (Markdown supported)
 */
async function sendTelegram(chatId, text) {
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) {
    logger.warn('sendTelegram: no chatId or bot token, skipping');
    return null;
  }
  try {
    const resp = await axios.post(`${getTelegramApiBase()}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });
    logger.info(`Telegram sent to ${chatId}`);
    return resp.data.result?.message_id;
  } catch (err) {
    logger.error(`Telegram failed to ${chatId}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Notify the internal admin/team on Telegram when a new lead arrives.
 */
async function notifyAdminNewLead(lead) {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatId) return;

  const message = `🔔 *New Lead Captured!*

👤 *Name:* ${lead.full_name}
📧 *Email:* ${lead.email || 'N/A'}
📱 *Phone:* ${lead.phone || 'N/A'}
🏷️ *Source:* ${lead.source}
📅 *Type:* ${lead.client_type === 'Type1' ? '✅ Meeting Booked' : '⚠️ No Meeting Booked'}
🕐 *Time:* ${new Date(lead.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

[Open Dashboard](${process.env.FRONTEND_URL || 'http://localhost:3000'}/leads/${lead.id})`;

  return sendTelegram(adminChatId, message);
}

/**
 * Notify admin of a reminder being triggered.
 */
async function notifyAdminReminder(lead, reminderType) {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatId) return;

  const message = `⏰ *Reminder Triggered*

👤 *Lead:* ${lead.full_name}
📱 *Phone:* ${lead.phone || 'N/A'}
🔔 *Type:* ${reminderType}
🕐 *At:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

  return sendTelegram(adminChatId, message);
}

module.exports = { sendTelegram, notifyAdminNewLead, notifyAdminReminder };
