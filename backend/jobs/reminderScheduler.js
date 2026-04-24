/**
 * Reminder Scheduler for Type1 Leads (Meeting Booked)
 * No Redis required — schedules are persisted in the Reminders table.
 * node-cron polls the table every minute and fires due reminders.
 *
 * Schedule:
 *   4 days before meeting  → Confirmation + reminder
 *   Same day at 9:00 AM    → Meeting day reminder
 *   30 minutes before      → Final "join now" reminder
 *   1 hour after meeting   → Post-meeting follow-up
 */
const { query } = require('../config/database');
const logger = require('../config/logger');

const REMINDER_TYPES = [
  { key: '4_days_before',  offsetMs: -4 * 24 * 60 * 60 * 1000 },
  { key: '30_min_before',  offsetMs: -30 * 60 * 1000 },
  { key: 'post_meeting',   offsetMs:  1 * 60 * 60 * 1000 },
];

/**
 * Schedule all meeting reminders for a Type1 lead.
 * Simply inserts rows into Reminders — the cron worker picks them up.
 * Cancels any existing pending reminders first (handles reschedule).
 */
async function scheduleRemindersForLead(lead) {
  if (!lead.meeting_datetime) {
    logger.warn(`scheduleRemindersForLead: Lead ${lead.id} has no meeting_datetime`);
    return;
  }

  const meetingTime = new Date(lead.meeting_datetime).getTime();
  const now = Date.now();

  // Cancel existing pending reminders for this lead
  await query(
    `UPDATE Reminders SET status = 'Skipped' WHERE lead_id = @lead_id AND status = 'Pending'`,
    { lead_id: lead.id }
  );

  // Standard offset-based reminders
  for (const { key, offsetMs } of REMINDER_TYPES) {
    const fireAt = meetingTime + offsetMs;
    if (fireAt <= now) {
      logger.info(`Skipping past reminder "${key}" for lead ${lead.id}`);
      continue;
    }
    await query(
      `INSERT INTO Reminders (lead_id, reminder_type, scheduled_at, status, channel)
       VALUES (@lead_id, @reminder_type, @scheduled_at, 'Pending', 'All')`,
      { lead_id: lead.id, reminder_type: key, scheduled_at: new Date(fireAt) }
    );
    logger.info(`Scheduled "${key}" for lead ${lead.id} at ${new Date(fireAt).toISOString()}`);
  }

  // Same-day 9 AM reminder (independent from offset)
  const nineAM = new Date(lead.meeting_datetime);
  nineAM.setHours(9, 0, 0, 0);
  if (nineAM.getTime() > now) {
    await query(
      `INSERT INTO Reminders (lead_id, reminder_type, scheduled_at, status, channel)
       VALUES (@lead_id, 'same_day_9am', @scheduled_at, 'Pending', 'All')`,
      { lead_id: lead.id, scheduled_at: nineAM }
    );
    logger.info(`Scheduled "same_day_9am" for lead ${lead.id} at ${nineAM.toISOString()}`);
  }
}

module.exports = { scheduleRemindersForLead };
