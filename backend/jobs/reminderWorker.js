/**
 * Reminder Worker — runs every minute via node-cron.
 * Queries Reminders table for due rows and fires the appropriate messages.
 * Handles BOTH Type1 (meeting reminders) and Type2 (follow-up drip).
 * No Redis / Bull required.
 */
const cron = require('node-cron');
const { query } = require('../config/database');
const { sendMeetingReminder, sendFollowUpMessage } = require('../services/communicationService');
const Lead = require('../models/Lead');
const logger = require('../config/logger');

// Which reminder_type keys belong to Type1 meeting flow
const MEETING_TYPES = new Set(['4_days_before', 'same_day_9am', '30_min_before', 'post_meeting']);

// dayOffset map for follow-up types
const FOLLOW_UP_DAY = { day_1: 1, day_3: 3, day_5: 5, day_7: 7, immediate: 0, nurture: null };

function startReminderWorker() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const result = await query(`
        SELECT r.id, r.lead_id, r.reminder_type, r.retry_count
        FROM Reminders r
        WHERE r.status = 'Pending'
          AND r.scheduled_at <= GETDATE()
        ORDER BY r.scheduled_at ASC
      `);

      if (!result.recordset.length) return;

      logger.info(`Reminder worker: ${result.recordset.length} due reminder(s) found`);

      for (const row of result.recordset) {
        await processReminder(row);
      }
    } catch (err) {
      logger.error('Reminder worker tick error:', err.message);
    }
  });

  logger.info('Reminder worker started (node-cron, polling every minute)');
}

async function processReminder({ id, lead_id, reminder_type, retry_count }) {
  // Mark as processing immediately to prevent double-fire
  await query(
    `UPDATE Reminders SET status = 'Processing' WHERE id = @id AND status = 'Pending'`,
    { id }
  );

  try {
    const lead = await Lead.findById(lead_id);

    if (!lead) {
      await setStatus(id, 'Skipped', 'Lead not found');
      return;
    }

    // Don't send to converted or lost leads
    if (['Lost', 'Converted'].includes(lead.status)) {
      await setStatus(id, 'Skipped', 'Lead is Lost or Converted');
      return;
    }

    if (MEETING_TYPES.has(reminder_type)) {
      // Type1 — meeting reminder
      await sendMeetingReminder(lead, reminder_type, id);
    } else {
      // Type2 — follow-up drip
      const dayOffset = FOLLOW_UP_DAY[reminder_type] ?? 0;
      await sendFollowUpMessage(lead, dayOffset, id);

      // After day_7 with no conversion → move to Nurture
      if (reminder_type === 'day_7' && lead.status === 'New') {
        await query(`UPDATE Leads SET status = 'Nurture' WHERE id = @id`, { id: lead_id });
        logger.info(`Lead ${lead_id} moved to Nurture campaign`);
      }
    }

    await setStatus(id, 'Sent', null);
    logger.info(`Reminder "${reminder_type}" sent for lead ${lead_id}`);

  } catch (err) {
    logger.error(`Reminder ${id} failed:`, err.message);
    const retries = (retry_count || 0) + 1;

    if (retries >= 3) {
      await setStatus(id, 'Failed', err.message, retries);
    } else {
      // Retry in 5 minutes
      await query(
        `UPDATE Reminders SET status = 'Pending',
           scheduled_at = DATEADD(MINUTE, 5, GETDATE()),
           retry_count = @retries,
           error_log = @error
         WHERE id = @id`,
        { id, retries, error: err.message }
      );
    }
  }
}

async function setStatus(id, status, errorLog, retryCount) {
  await query(
    `UPDATE Reminders SET status = @status, sent_at = @sent_at, error_log = @error, retry_count = ISNULL(@retries, retry_count) WHERE id = @id`,
    {
      id,
      status,
      sent_at: status === 'Sent' ? new Date() : null,
      error: errorLog || null,
      retries: retryCount ?? null,
    }
  );
}

module.exports = { startReminderWorker };
