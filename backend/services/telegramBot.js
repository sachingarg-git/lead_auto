/**
 * Wizone LMS — Telegram Bot
 * ─────────────────────────
 * Commands:
 *   /start     → Welcome message
 *   /today     → Today's meetings list
 *   /tomorrow  → Tomorrow's meetings list
 *   /leads     → Count summary of active leads by status
 *
 * Auto Notifications (sent to TELEGRAM_ADMIN_CHAT_ID):
 *   1. Daily 9:00 AM IST  → All today's scheduled meetings
 *   2. 60 min before slot → Meeting reminder
 *   3. 30 min before slot → Meeting reminder
 *   4. 15 min before slot → Meeting reminder
 */

const axios  = require('axios');
const cron   = require('node-cron');
const { query } = require('../config/database');
const logger = require('../config/logger');

const BOT_TOKEN   = () => process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT  = () => process.env.TELEGRAM_ADMIN_CHAT_ID;
const API_BASE    = () => `https://api.telegram.org/bot${BOT_TOKEN()}`;

// ─────────────────────────────────────────────────────────────
// Core sender
// ─────────────────────────────────────────────────────────────
async function send(chatId, html, extra = {}) {
  if (!BOT_TOKEN() || !chatId) return;
  try {
    await axios.post(`${API_BASE()}/sendMessage`, {
      chat_id:    chatId,
      text:       html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    });
  } catch (err) {
    logger.error('[TelegramBot] sendMessage error:', err.response?.data?.description || err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────
async function getMeetingsForDate(offsetDays = 0) {
  const r = await query(`
    SELECT
      l.id,
      l.full_name,
      l.phone,
      l.company,
      l.industry,
      l.status,
      l.meeting_link,
      TO_CHAR(l.slot_date,  'YYYY-MM-DD') AS slot_date,
      TO_CHAR(l.slot_time,  'HH24:MI')    AS slot_time,
      l.meeting_datetime,
      l.client_type
    FROM "Leads" l
    WHERE l.client_type = 'Type1'
      AND l.status NOT IN ('Converted', 'Lost')
      AND (
        l.slot_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '${offsetDays} days'
        OR DATE(l.meeting_datetime AT TIME ZONE 'Asia/Kolkata') = (NOW() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '${offsetDays} days'
      )
    ORDER BY COALESCE(l.slot_time, (l.meeting_datetime AT TIME ZONE 'Asia/Kolkata')::time) ASC NULLS LAST
  `);
  return r.recordset || [];
}

async function getLeadStatusSummary() {
  const r = await query(`
    SELECT status, COUNT(*) AS cnt
    FROM "Leads"
    WHERE status NOT IN ('Converted', 'Lost')
    GROUP BY status
    ORDER BY cnt DESC
  `);
  return r.recordset || [];
}

async function getMeetingsAtMinutesFromNow(minutesAhead) {
  const r = await query(`
    SELECT
      l.id,
      l.full_name,
      l.phone,
      l.company,
      l.meeting_link,
      TO_CHAR(
        COALESCE(l.slot_time, (l.meeting_datetime AT TIME ZONE 'Asia/Kolkata')::time),
        'HH12:MI AM'
      ) AS time_fmt
    FROM "Leads" l
    WHERE l.client_type = 'Type1'
      AND l.status NOT IN ('Converted', 'Lost')
      AND (
        -- slot_date / slot_time path
        (
          l.slot_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          AND l.slot_time IS NOT NULL
          AND l.slot_time::time(0) = (
            (NOW() AT TIME ZONE 'Asia/Kolkata') + (${minutesAhead} * INTERVAL '1 minute')
          )::time(0)
        )
        OR
        -- meeting_datetime path (for leads without explicit slot_time)
        (
          l.slot_date IS NULL
          AND l.meeting_datetime IS NOT NULL
          AND DATE(l.meeting_datetime AT TIME ZONE 'Asia/Kolkata') = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          AND (l.meeting_datetime AT TIME ZONE 'Asia/Kolkata')::time(0) = (
            (NOW() AT TIME ZONE 'Asia/Kolkata') + (${minutesAhead} * INTERVAL '1 minute')
          )::time(0)
        )
      )
  `);
  return r.recordset || [];
}

// ─────────────────────────────────────────────────────────────
// Message formatters
// ─────────────────────────────────────────────────────────────
function fmtSlotTime(lead) {
  if (lead.slot_time) return lead.slot_time + ' IST';
  if (lead.meeting_datetime) {
    const d = new Date(lead.meeting_datetime);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST';
  }
  return 'TBD';
}

function fmtMeetingsList(leads, heading) {
  if (!leads.length) {
    return `${heading}\n\n❌ <i>No meetings scheduled.</i>`;
  }
  const lines = [`${heading}\n`];
  leads.forEach((lead, i) => {
    lines.push(`${i + 1}. 👤 <b>${lead.full_name}</b>`);
    if (lead.company)  lines.push(`   🏢 ${lead.company}`);
    if (lead.phone)    lines.push(`   📱 ${lead.phone}`);
    lines.push(`   ⏰ <b>${fmtSlotTime(lead)}</b>`);
    if (lead.meeting_link) lines.push(`   🎥 <a href="${lead.meeting_link}">Join Meeting</a>`);
    lines.push('');
  });
  lines.push(`<i>Total: ${leads.length} meeting${leads.length !== 1 ? 's' : ''}</i>`);
  return lines.join('\n');
}

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

function tomorrowLabel() {
  const d = new Date(Date.now() + 86400000);
  return d.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

// ─────────────────────────────────────────────────────────────
// Command handlers
// ─────────────────────────────────────────────────────────────
async function handleStart(chatId, firstName) {
  await send(chatId,
    `👋 <b>Welcome to Wizone LMS Bot${firstName ? ', ' + firstName : ''}!</b>\n\n` +
    `Here's what I can do:\n\n` +
    `📅 /today — Today's scheduled meetings\n` +
    `📅 /tomorrow — Tomorrow's scheduled meetings\n` +
    `📊 /leads — Active lead pipeline summary\n\n` +
    `<b>Auto-notifications I send daily:</b>\n` +
    `🌅 9:00 AM — Morning summary of all today's meetings\n` +
    `⏰ 1 hour before each meeting\n` +
    `⏰ 30 minutes before each meeting\n` +
    `⏰ 15 minutes before each meeting\n\n` +
    `<i>Powered by Wizone AI Lead Manager ⚡</i>`
  );
}

async function handleToday(chatId) {
  try {
    const leads = await getMeetingsForDate(0);
    await send(chatId, fmtMeetingsList(leads, `📅 <b>Today's Meetings</b>\n<i>${todayLabel()}</i>`));
  } catch (err) {
    logger.error('[TelegramBot] /today error:', err.message);
    await send(chatId, '❌ Failed to fetch today\'s meetings. Please try again.');
  }
}

async function handleTomorrow(chatId) {
  try {
    const leads = await getMeetingsForDate(1);
    await send(chatId, fmtMeetingsList(leads, `📅 <b>Tomorrow's Meetings</b>\n<i>${tomorrowLabel()}</i>`));
  } catch (err) {
    logger.error('[TelegramBot] /tomorrow error:', err.message);
    await send(chatId, '❌ Failed to fetch tomorrow\'s meetings. Please try again.');
  }
}

async function handleLeads(chatId) {
  try {
    const rows = await getLeadStatusSummary();
    if (!rows.length) {
      return send(chatId, '📊 <b>Lead Summary</b>\n\n<i>No active leads found.</i>');
    }
    const STATUS_EMOJI = {
      New: '🔵', FollowUp: '🟡', DemoGiven: '🟣', Nurture: '🩷', Partial: '🟠',
    };
    const lines = ['📊 <b>Active Lead Pipeline</b>\n'];
    let total = 0;
    rows.forEach(r => {
      const emoji = STATUS_EMOJI[r.status] || '⚪';
      lines.push(`${emoji} <b>${r.status}:</b> ${r.cnt}`);
      total += parseInt(r.cnt);
    });
    lines.push(`\n<b>Total Active: ${total}</b>`);
    await send(chatId, lines.join('\n'));
  } catch (err) {
    logger.error('[TelegramBot] /leads error:', err.message);
    await send(chatId, '❌ Failed to fetch lead summary.');
  }
}

// ─────────────────────────────────────────────────────────────
// Long Polling loop
// ─────────────────────────────────────────────────────────────
let pollingOffset = 0;
let pollingActive = false;

async function pollOnce() {
  try {
    const res = await axios.get(`${API_BASE()}/getUpdates`, {
      params:  { offset: pollingOffset, timeout: 30, allowed_updates: ['message'] },
      timeout: 35000,
    });

    const updates = res.data?.result || [];
    for (const update of updates) {
      pollingOffset = update.update_id + 1;
      const msg = update.message;
      if (!msg?.text) continue;

      const chatId    = msg.chat.id;
      const firstName = msg.from?.first_name || '';
      const raw       = msg.text.trim();
      // strip @botname suffix (used in groups)
      const cmd       = raw.split('@')[0].toLowerCase();

      logger.debug(`[TelegramBot] Command "${cmd}" from chat ${chatId}`);

      if      (cmd === '/start')    await handleStart(chatId, firstName);
      else if (cmd === '/today')    await handleToday(chatId);
      else if (cmd === '/tomorrow') await handleTomorrow(chatId);
      else if (cmd === '/leads')    await handleLeads(chatId);
      else {
        await send(chatId,
          `🤖 Unknown command.\n\nTry:\n/today\n/tomorrow\n/leads`
        );
      }
    }
  } catch (err) {
    // ETIMEOUT is normal (no messages in 30 s) — just continue
    if (err.code !== 'ECONNABORTED' && !err.message?.includes('timeout')) {
      logger.error('[TelegramBot] Polling error:', err.message);
    }
  }
}

function startPolling() {
  if (pollingActive) return;
  pollingActive = true;
  logger.info('[TelegramBot] Long polling started');

  async function loop() {
    if (!pollingActive) return;
    await pollOnce();
    // tiny gap to avoid hammering on rapid updates, then immediately poll again
    setTimeout(loop, 300);
  }
  loop();
}

function stopPolling() {
  pollingActive = false;
}

// ─────────────────────────────────────────────────────────────
// Scheduled notifications
// ─────────────────────────────────────────────────────────────

/** 1. Daily 9:00 AM IST — full today's meeting summary */
function scheduleDailySummary() {
  cron.schedule('0 9 * * *', async () => {
    const adminChatId = ADMIN_CHAT();
    if (!adminChatId) return;
    logger.info('[TelegramBot] Sending daily 9 AM meeting summary');
    try {
      const leads = await getMeetingsForDate(0);
      const heading = `🌅 <b>Good Morning! Today's Meetings</b>\n<i>${todayLabel()}</i>`;
      await send(adminChatId, fmtMeetingsList(leads, heading));
    } catch (err) {
      logger.error('[TelegramBot] Daily summary error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });
}

/** 2-4. Per-minute check: send reminders at 60 / 30 / 15 min before each slot */
function scheduleMeetingReminders() {
  cron.schedule('* * * * *', async () => {
    const adminChatId = ADMIN_CHAT();
    if (!adminChatId) return;

    const REMINDERS = [
      { minutes: 60, emoji: '⏰', label: '1 hour'      },
      { minutes: 30, emoji: '🔔', label: '30 minutes'  },
      { minutes: 15, emoji: '🚨', label: '15 minutes'  },
    ];

    for (const r of REMINDERS) {
      try {
        const leads = await getMeetingsAtMinutesFromNow(r.minutes);
        for (const lead of leads) {
          const msg =
            `${r.emoji} <b>Meeting in ${r.label}!</b>\n\n` +
            `👤 <b>${lead.full_name}</b>\n` +
            (lead.company ? `🏢 ${lead.company}\n` : '') +
            (lead.phone   ? `📱 ${lead.phone}\n`   : '') +
            `⏰ <b>${lead.time_fmt}</b>\n` +
            (lead.meeting_link
              ? `\n🎥 <a href="${lead.meeting_link}">Join Meeting Now</a>`
              : '\n<i>No meeting link yet</i>');
          await send(adminChatId, msg);
          logger.info(`[TelegramBot] Sent ${r.label} reminder for lead ${lead.id} (${lead.full_name})`);
        }
      } catch (err) {
        logger.error(`[TelegramBot] Reminder (${r.minutes}m) error:`, err.message);
      }
    }
  }, { timezone: 'Asia/Kolkata' });
}

// ─────────────────────────────────────────────────────────────
// Public API — used in telegramService.js notifications
// ─────────────────────────────────────────────────────────────

/**
 * Send a message to the admin channel.
 * Re-exported so existing notifyAdminNewLead / notifyAdminReminder can use it.
 */
async function sendToAdmin(text) {
  return send(ADMIN_CHAT(), text);
}

// ─────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────
function initTelegramBot() {
  if (!BOT_TOKEN()) {
    logger.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }
  if (!ADMIN_CHAT()) {
    logger.warn('[TelegramBot] TELEGRAM_ADMIN_CHAT_ID not set — scheduled notifications disabled');
  }

  startPolling();
  scheduleDailySummary();
  scheduleMeetingReminders();

  logger.info('[TelegramBot] ✅ Bot active — polling + cron reminders running');
}

module.exports = { initTelegramBot, send, sendToAdmin, stopPolling };
