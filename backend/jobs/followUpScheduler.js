/**
 * Follow-Up Scheduler for Type2 Leads (No Meeting Booked)
 * No Redis required — schedules are persisted in the Reminders table.
 *
 * Drip sequence from lead creation:
 *   Day 1  → Check interest + schedule meeting request
 *   Day 3  → Benefits + case study
 *   Day 5  → Personal call follow-up
 *   Day 7  → Last reminder
 */
const { query } = require('../config/database');
const logger = require('../config/logger');

const FOLLOW_UP_STEPS = [
  { key: 'day_1', dayOffset: 1 },
  { key: 'day_3', dayOffset: 3 },
  { key: 'day_5', dayOffset: 5 },
  { key: 'day_7', dayOffset: 7 },
];

async function scheduleFollowUpForLead(lead) {
  const createdAt = new Date(lead.created_at || Date.now()).getTime();
  const now = Date.now();

  for (const { key, dayOffset } of FOLLOW_UP_STEPS) {
    const fireAt = createdAt + dayOffset * 24 * 60 * 60 * 1000;
    if (fireAt <= now) continue;

    await query(
      `INSERT INTO Reminders (lead_id, reminder_type, scheduled_at, status, channel)
       VALUES (@lead_id, @reminder_type, @scheduled_at, 'Pending', 'All')`,
      { lead_id: lead.id, reminder_type: key, scheduled_at: new Date(fireAt) }
    );
    logger.info(`Scheduled follow-up "${key}" for lead ${lead.id} at ${new Date(fireAt).toISOString()}`);
  }
}

module.exports = { scheduleFollowUpForLead };
