/**
 * Meeting lifecycle endpoints:
 *   POST /api/meetings/:id/start       — mark meeting started
 *   POST /api/meetings/:id/end         — mark meeting completed / missed
 *   POST /api/meetings/:id/reschedule  — reschedule to new date/time
 *   GET  /api/meetings/:id/reschedules — reschedule history for a lead
 *   GET  /api/meetings/slots/check     — check 1-hour slot availability
 */
const router   = require('express').Router();
const { authenticate }  = require('../middleware/auth');
const { authorize }     = require('../middleware/rbac');
const { query }         = require('../config/database');
const { sendEmail, buildRescheduleEmail } = require('../services/emailService');
const Lead     = require('../models/Lead');
const logger   = require('../config/logger');

router.use(authenticate, authorize('leads:write'));

/* ── helpers ──────────────────────────────────────────────── */

function fmtIST(dt) {
  if (!dt) return null;
  return new Date(dt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/* ── GET /slots/check ─────────────────────────────────────── */
router.get('/slots/check', async (req, res) => {
  try {
    const { datetime, exclude_lead_id } = req.query;
    if (!datetime) return res.status(400).json({ error: 'datetime required' });

    const dt = new Date(datetime);
    const dtMinus1h = new Date(dt.getTime() - 60 * 60 * 1000);
    const dtPlus1h  = new Date(dt.getTime() + 60 * 60 * 1000);

    // Find any lead with a meeting_datetime within ±1 hour
    const r = await query(`
      SELECT id, full_name, meeting_datetime
      FROM Leads
      WHERE meeting_datetime IS NOT NULL
        AND meeting_datetime > @from
        AND meeting_datetime < @to
        AND status NOT IN ('Converted','Lost')
        ${exclude_lead_id ? 'AND id <> @exclude' : ''}
    `, {
      from: dtMinus1h,
      to:   dtPlus1h,
      ...(exclude_lead_id ? { exclude: parseInt(exclude_lead_id) } : {}),
    });

    if (r.recordset.length > 0) {
      return res.json({
        available: false,
        conflict: r.recordset.map(l => ({
          lead_id:          l.id,
          full_name:        l.full_name,
          meeting_datetime: l.meeting_datetime,
        })),
      });
    }
    return res.json({ available: true });
  } catch (err) {
    logger.error('slot check error:', err);
    res.status(500).json({ error: 'Failed to check slot' });
  }
});

/* ── POST /:id/start ──────────────────────────────────────── */
router.post('/:id/start', async (req, res) => {
  try {
    const id   = parseInt(req.params.id);
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const now = new Date();
    await Lead.update(id, {
      meeting_status:     'started',
      meeting_started_at: now,
    });

    // Calc delay
    const scheduledAt = lead.meeting_datetime
      ? new Date(lead.meeting_datetime)
      : lead.slot_date
        ? new Date(`${String(lead.slot_date).substring(0, 10)}T00:00:00`)
        : null;
    let delayMinutes = null;
    if (scheduledAt) {
      delayMinutes = Math.round((now.getTime() - scheduledAt.getTime()) / 60000);
      if (delayMinutes < 0) delayMinutes = 0; // early is fine
      await Lead.update(id, { meeting_delay_minutes: delayMinutes });
    }

    await Lead.logActivity({
      lead_id:     id,
      action_type: 'meeting_started',
      field_name:  'Meeting',
      new_value:   `Started at ${fmtIST(now)}${delayMinutes > 0 ? ` (${delayMinutes} min delay)` : ' (on time)'}`,
      created_by:  req.user?.id,
      actor_name:  req.user?.name || 'System',
    });

    const updated = await Lead.findById(id);
    req.app.get('io')?.to('dashboard').emit('lead:updated', updated);
    res.json({ success: true, meeting_started_at: now, delay_minutes: delayMinutes, lead: updated });
  } catch (err) {
    logger.error('meeting start error:', err);
    res.status(500).json({ error: 'Failed to start meeting' });
  }
});

/* ── POST /:id/end ────────────────────────────────────────── */
router.post('/:id/end', async (req, res) => {
  try {
    const id   = parseInt(req.params.id);
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { outcome, remark } = req.body;
    // outcome: 'completed' | 'missed' | 'no_show'
    const now    = new Date();
    const status = outcome === 'completed' ? 'completed' : 'missed';

    await Lead.update(id, {
      meeting_status:   status,
      meeting_ended_at: now,
      ...(remark ? { notes: [lead.notes, `[Meeting ${status} ${fmtIST(now)}]: ${remark}`].filter(Boolean).join('\n') } : {}),
    });

    await Lead.logActivity({
      lead_id:     id,
      action_type: 'meeting_ended',
      field_name:  'Meeting',
      new_value:   `${outcome === 'completed' ? '✅ Completed' : '❌ Missed/No-show'} at ${fmtIST(now)}`,
      note:        remark || null,
      created_by:  req.user?.id,
      actor_name:  req.user?.name || 'System',
    });

    const updated = await Lead.findById(id);
    req.app.get('io')?.to('dashboard').emit('lead:updated', updated);
    res.json({ success: true, meeting_status: status, lead: updated });
  } catch (err) {
    logger.error('meeting end error:', err);
    res.status(500).json({ error: 'Failed to end meeting' });
  }
});

/* ── POST /:id/reschedule ─────────────────────────────────── */
router.post('/:id/reschedule', async (req, res) => {
  try {
    const id   = parseInt(req.params.id);
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { new_meeting_datetime, new_slot_date, new_slot_time, reason, type, send_email } = req.body;
    // type: 'customer_request' | 'no_show' | 'team_request'

    if (!new_meeting_datetime && !new_slot_date) {
      return res.status(400).json({ error: 'new_meeting_datetime or new_slot_date required' });
    }

    // Check 1-hour gap
    if (new_meeting_datetime) {
      const dt  = new Date(new_meeting_datetime);
      const gap = await query(`
        SELECT id, full_name, meeting_datetime FROM Leads
        WHERE meeting_datetime IS NOT NULL
          AND meeting_datetime > @from AND meeting_datetime < @to
          AND status NOT IN ('Converted','Lost') AND id <> @id
      `, {
        from: new Date(dt.getTime() - 60 * 60 * 1000),
        to:   new Date(dt.getTime() + 60 * 60 * 1000),
        id,
      });
      if (gap.recordset.length > 0) {
        return res.status(409).json({
          error: 'Slot conflict — another meeting is within 1 hour of this time',
          conflict: gap.recordset,
        });
      }
    }

    // Log reschedule history
    await query(`
      INSERT INTO MeetingRescheduleLog
        (lead_id, old_meeting_datetime, old_slot_date, old_slot_time,
         new_meeting_datetime, new_slot_date, new_slot_time,
         reschedule_reason, reschedule_type, rescheduled_by_id, rescheduled_by_name)
      VALUES
        (@lead_id, @old_dt, @old_sd, @old_st,
         @new_dt, @new_sd, @new_st,
         @reason, @type, @by_id, @by_name)
    `, {
      lead_id: id,
      old_dt:  lead.meeting_datetime || null,
      old_sd:  lead.slot_date        || null,
      old_st:  lead.slot_time        || null,
      new_dt:  new_meeting_datetime  || null,
      new_sd:  new_slot_date         || null,
      new_st:  new_slot_time         || null,
      reason:  reason || null,
      type:    type   || 'team_request',
      by_id:   req.user?.id   || null,
      by_name: req.user?.name || 'System',
    });

    // Update lead
    const updatePayload = {
      meeting_status:   'upcoming',
      meeting_started_at: null,
      meeting_ended_at:   null,
    };
    if (new_meeting_datetime) updatePayload.meeting_datetime = new_meeting_datetime;
    if (new_slot_date)        updatePayload.slot_date = new_slot_date;
    if (new_slot_time !== undefined) updatePayload.slot_time = new_slot_time;

    // Increment reschedule_count
    await query(
      'UPDATE Leads SET reschedule_count = ISNULL(reschedule_count,0) + 1 WHERE id = @id',
      { id }
    );

    await Lead.update(id, updatePayload);

    await Lead.logActivity({
      lead_id:     id,
      action_type: 'rescheduled',
      field_name:  'Meeting Rescheduled',
      old_value:   lead.meeting_datetime
        ? fmtIST(lead.meeting_datetime)
        : (lead.slot_date ? String(lead.slot_date).substring(0, 10) : null),
      new_value:   new_meeting_datetime
        ? fmtIST(new_meeting_datetime)
        : new_slot_date || null,
      note: reason || null,
      created_by:  req.user?.id,
      actor_name:  req.user?.name || 'System',
    });

    // Auto send reschedule email if requested
    if (send_email && lead.email) {
      try {
        const emailPayload = await buildRescheduleEmail(lead, {
          newDate: new_meeting_datetime || new_slot_date,
          newTime: new_slot_time,
          reason,
          type,
        });
        await sendEmail(emailPayload);
      } catch (e) {
        logger.warn('Reschedule email failed:', e.message);
      }
    }

    const updated = await Lead.findById(id);
    req.app.get('io')?.to('dashboard').emit('lead:updated', updated);
    res.json({ success: true, lead: updated });
  } catch (err) {
    logger.error('reschedule error:', err);
    res.status(500).json({ error: 'Failed to reschedule meeting' });
  }
});

/* ── GET /:id/reschedules ─────────────────────────────────── */
router.get('/:id/reschedules', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const r  = await query(
      `SELECT * FROM MeetingRescheduleLog WHERE lead_id = @id ORDER BY created_at DESC`,
      { id }
    );
    res.json(r.recordset);
  } catch (err) {
    logger.error('reschedule history error:', err);
    res.status(500).json({ error: 'Failed to fetch reschedule history' });
  }
});

module.exports = router;
