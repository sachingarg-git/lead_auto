const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const { query, getPool } = require('../config/database');
const { scheduleRemindersForLead } = require('../jobs/reminderScheduler');
const { scheduleFollowUpForLead } = require('../jobs/followUpScheduler');
const { sendWelcomeMessages, sendManualEmail, sendManualWhatsApp } = require('../services/communicationService');
const { createMeetLink } = require('../services/googleMeetService');
const logger = require('../config/logger');

// ── Field labels for readable activity log ────────────────────
const FIELD_LABELS = {
  assigned_to:      'Assigned To',
  status:           'Status',
  full_name:        'Name',
  email:            'Email',
  phone:            'Phone',
  company:          'Company',
  notes:            'Notes',
  meeting_datetime: 'Meeting Date',
  meeting_link:     'Meeting Link',
  slot_date:        'Slot Date',
  slot_time:        'Slot Time',
  client_type:      'Client Type',
  tags:             'Tags',
};

// ── Helper: log a generic field change ───────────────────────
async function logChange(lead_id, field_name, old_value, new_value, user, extraNote) {
  const label = FIELD_LABELS[field_name] || field_name;
  await Lead.logActivity({
    lead_id,
    action_type: 'edit',
    field_name:  label,
    old_value:   old_value != null ? String(old_value) : null,
    new_value:   new_value != null ? String(new_value) : null,
    note:        extraNote || null,
    created_by:  user?.id   || null,
    actor_name:  user?.name || 'System',
  });
}

// ── Fetch all users for name resolution ──────────────────────
async function getUsersMap() {
  const r = await query('SELECT id, name FROM "Users"');
  const map = {};
  r.recordset.forEach(u => { map[u.id] = u.name; });
  return map;
}

// ─────────────────────────────────────────────────────────────

async function getLeads(req, res) {
  try {
    const { status, source, assigned_to, client_type, search, followup_date, slot_date, not_statuses, page, limit } = req.query;
    const data = await Lead.findAll({
      status, source, client_type, followup_date, slot_date, not_statuses,
      assigned_to: assigned_to ? parseInt(assigned_to) : undefined,
      search, page: parseInt(page) || 1, limit: parseInt(limit) || 20,
    });
    res.json(data);
  } catch (err) {
    logger.error('getLeads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
}

async function getLead(req, res) {
  try {
    const lead = await Lead.findById(parseInt(req.params.id));
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    logger.error('getLead error:', err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
}

async function createLead(req, res) {
  try {
    const lead = await Lead.create({ ...req.body, source: req.body.source || 'Manual' });

    const io = req.app.get('io');
    io.to('dashboard').emit('lead:new', lead);

    // Log creation
    await Lead.logActivity({
      lead_id:     lead.id,
      action_type: 'created',
      note:        `Lead created via ${lead.source}`,
      created_by:  req.user?.id   || null,
      actor_name:  req.user?.name || 'System',
    });

    await triggerLeadAutomation(lead);

    res.status(201).json(lead);
  } catch (err) {
    logger.error('createLead error:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
}

async function updateLeadStatus(req, res) {
  try {
    const { status, note } = req.body;
    const validStatuses = ['New', 'FollowUp', 'DemoGiven', 'Converted', 'Lost', 'Nurture'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', valid: validStatuses });
    }

    const lead = await Lead.updateStatus(parseInt(req.params.id), status, req.user.id, note);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const io = req.app.get('io');
    io.to('dashboard').emit('lead:updated', lead);

    res.json(lead);
  } catch (err) {
    logger.error('updateLeadStatus error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
}

async function updateLead(req, res) {
  try {
    const id = parseInt(req.params.id);
    const old = await Lead.findById(id);
    if (!old) return res.status(404).json({ error: 'Lead not found' });

    // Resolve assigned_to names for log
    let usersMap = {};
    if (req.body.assigned_to !== undefined) {
      usersMap = await getUsersMap();
    }

    const updated = await Lead.update(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Lead not found' });

    // ── Log every changed field ────────────────────────────
    const actor = req.user;
    const loggable = Object.keys(FIELD_LABELS);

    for (const field of loggable) {
      if (!(field in req.body)) continue;
      const oldVal = old[field];
      const newVal = req.body[field];
      if (String(oldVal ?? '') === String(newVal ?? '')) continue; // no change

      if (field === 'assigned_to') {
        // Show names, not IDs
        const oldName = oldVal ? (usersMap[oldVal] || `User #${oldVal}`) : 'Unassigned';
        const newName = newVal ? (usersMap[newVal] || `User #${newVal}`) : 'Unassigned';
        await Lead.logActivity({
          lead_id:     id,
          action_type: 'assigned',
          field_name:  'Assigned To',
          old_value:   oldName,
          new_value:   newName,
          created_by:  actor?.id,
          actor_name:  actor?.name || 'System',
        });
      } else {
        await logChange(id, field, oldVal, newVal, actor);
      }
    }

    const io = req.app.get('io');
    io.to('dashboard').emit('lead:updated', updated);

    if (req.body.meeting_datetime && updated.client_type === 'Type1') {
      await scheduleRemindersForLead(updated);
    }

    // ── Auto-create Meet link if slot was just set and no link exists yet ──
    // Covers all update paths: edit form, inline edit, any field update with slot
    const slotJustSet = (req.body.slot_date || req.body.slot_time) && !old.meeting_link && !updated.meeting_link;
    if (slotJustSet && updated.slot_date && updated.slot_time) {
      try {
        const meetLink = await createMeetLink({
          title        : `Wizone AI Demo — ${updated.full_name}`,
          slotDate     : updated.slot_date,
          slotTime     : updated.slot_time,
          durationMins : 60,
          attendeeEmail: updated.email || undefined,
        });
        if (meetLink) {
          const pool = await getPool();
          await pool.query(`UPDATE "Leads" SET meeting_link=$1 WHERE id=$2`, [meetLink, id]);
          updated.meeting_link = meetLink;
          logger.info(`[updateLead] Meet link auto-created for lead ${id}: ${meetLink}`);
          io.to('dashboard').emit('lead:updated', updated);
        }
      } catch (meetErr) {
        logger.warn(`[updateLead] Meet link skipped for lead ${id}:`, meetErr.message);
      }
    }

    res.json(updated);
  } catch (err) {
    logger.error('updateLead error:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
}

// ── Quick assign from leads list ──────────────────────────────
async function assignLead(req, res) {
  try {
    const id        = parseInt(req.params.id);
    const { user_id } = req.body;
    const old       = await Lead.findById(id);
    if (!old) return res.status(404).json({ error: 'Lead not found' });

    const usersMap  = await getUsersMap();
    const newUserId = user_id ? parseInt(user_id) : null;

    await Lead.update(id, { assigned_to: newUserId });

    const oldName = old.assigned_to ? (usersMap[old.assigned_to] || `User #${old.assigned_to}`) : 'Unassigned';
    const newName = newUserId       ? (usersMap[newUserId]        || `User #${newUserId}`)        : 'Unassigned';

    await Lead.logActivity({
      lead_id:     id,
      action_type: 'assigned',
      field_name:  'Assigned To',
      old_value:   oldName,
      new_value:   newName,
      created_by:  req.user?.id,
      actor_name:  req.user?.name || 'System',
    });

    const updated = await Lead.findById(id);
    const io = req.app.get('io');
    io.to('dashboard').emit('lead:updated', updated);

    res.json(updated);
  } catch (err) {
    logger.error('assignLead error:', err);
    res.status(500).json({ error: 'Failed to assign lead' });
  }
}

async function getStats(req, res) {
  try {
    const [stats, conversionByUser] = await Promise.all([
      Lead.getStats(),
      Lead.getConversionByUser(),
    ]);
    res.json({ stats, conversionByUser });
  } catch (err) {
    logger.error('getStats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

// ── FollowUps ────────────────────────────────────────────────
async function getFollowUps(req, res) {
  try {
    const followups = await FollowUp.findByLeadId(parseInt(req.params.id));
    res.json(followups);
  } catch (err) {
    logger.error('getFollowUps error:', err);
    res.status(500).json({ error: 'Failed to fetch followups' });
  }
}

async function addFollowUp(req, res) {
  try {
    const { status, note, next_followup_date } = req.body;
    const lead_id = parseInt(req.params.id);

    const validStatuses = ['New', 'FollowUp', 'DemoGiven', 'Converted', 'Lost', 'Nurture'];

    // status is OPTIONAL — if provided it must be a valid LMS status
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', valid: validStatuses });
    }

    // Need at least a note or a status change
    if (!status && !note?.trim()) {
      return res.status(400).json({ error: 'Please provide a follow-up note or select a new status' });
    }

    const oldLead = await Lead.findById(lead_id);
    if (!oldLead) return res.status(404).json({ error: 'Lead not found' });

    // Only update the lead's status if a valid new status was explicitly chosen
    let lead;
    if (status && validStatuses.includes(status)) {
      lead = await Lead.updateStatus(lead_id, status, req.user.id, note);
    } else {
      lead = oldLead;
    }

    // Store follow-up with effective status (new or current)
    const effectiveStatus = status || oldLead.status;
    const followup = await FollowUp.create({
      lead_id,
      status: effectiveStatus,
      note,
      next_followup_date,
      created_by: req.user.id,
    });

    // Log followup action to activity
    await Lead.logActivity({
      lead_id,
      action_type: 'followup',
      field_name:  status ? 'Status' : 'Note',
      old_value:   status ? (oldLead?.status || null) : null,
      new_value:   status || null,
      note:        [
        note?.trim() || '',
        next_followup_date ? `Next follow-up: ${next_followup_date}` : '',
      ].filter(Boolean).join(' | ') || null,
      created_by:  req.user.id,
      actor_name:  req.user.name || req.user.email,
    });

    const io = req.app.get('io');
    io.to('dashboard').emit('lead:updated', lead);

    res.status(201).json({ followup, lead });
  } catch (err) {
    logger.error('addFollowUp error:', err);
    res.status(500).json({ error: 'Failed to add followup' });
  }
}

// ── Manual Send Email ────────────────────────────────────────
async function sendEmail(req, res) {
  try {
    const lead = await Lead.findById(parseInt(req.params.id));
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.email) return res.status(400).json({ error: 'Lead has no email address' });

    const { template, custom_subject, custom_body } = req.body;
    const result = await sendManualEmail(lead, {
      template:      template || 'welcome',
      customSubject: custom_subject,
      customBody:    custom_body,
    });

    // Log to activity
    await Lead.logActivity({
      lead_id:     lead.id,
      action_type: 'edit',
      field_name:  'Email Sent',
      new_value:   `${template === 'custom' ? 'Custom' : 'Welcome'} email → ${lead.email}`,
      created_by:  req.user?.id,
      actor_name:  req.user?.name || 'System',
    });

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('sendEmail error:', err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
}

// ── Manual Send WhatsApp ──────────────────────────────────────
async function sendWhatsApp(req, res) {
  try {
    const lead = await Lead.findById(parseInt(req.params.id));
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.phone && !lead.whatsapp_number) return res.status(400).json({ error: 'Lead has no phone number' });

    const { template, custom_message } = req.body;
    const result = await sendManualWhatsApp(lead, {
      template:      template || 'welcome',
      customMessage: custom_message,
    });

    await Lead.logActivity({
      lead_id:     lead.id,
      action_type: 'edit',
      field_name:  'WhatsApp Sent',
      new_value:   `${template === 'custom' ? 'Custom' : 'Welcome'} WA → ${lead.phone}`,
      created_by:  req.user?.id,
      actor_name:  req.user?.name || 'System',
    });

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('sendWhatsApp error:', err);
    res.status(500).json({ error: err.message || 'Failed to send WhatsApp' });
  }
}

// ── Full Activity Log ────────────────────────────────────────
async function getActivity(req, res) {
  try {
    const lead_id = parseInt(req.params.id);
    const activity = await Lead.getActivity(lead_id);
    res.json(activity);
  } catch (err) {
    logger.error('getActivity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
}

// ── Delete Lead ──────────────────────────────────────────────
async function deleteLead(req, res) {
  try {
    const id = parseInt(req.params.id);
    await query('DELETE FROM "FollowUps" WHERE lead_id = @id',         { id });
    await query('DELETE FROM "LeadStatusHistory" WHERE lead_id = @id', { id }).catch(() => {});
    await query('DELETE FROM "LeadActivityLog" WHERE lead_id = @id',   { id }).catch(() => {});
    await query('DELETE FROM "Reminders" WHERE lead_id = @id',         { id }).catch(() => {});
    await query('DELETE FROM "Leads" WHERE id = @id',                  { id });

    const io = req.app.get('io');
    io.to('dashboard').emit('lead:updated', { id, deleted: true });

    res.json({ success: true });
  } catch (err) {
    logger.error('deleteLead error:', err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
}

// ── Internal helper ─────────────────────────────────────────
async function triggerLeadAutomation(lead) {
  try {
    // ── Auto-create Google Meet link when a slot is booked ──
    if (lead.slot_date && lead.slot_time && !lead.meeting_link) {
      try {
        const meetLink = await createMeetLink({
          title        : `Wizone AI Demo — ${lead.full_name}`,
          slotDate     : lead.slot_date,
          slotTime     : lead.slot_time,
          durationMins : 60,
          attendeeEmail: lead.email || undefined,
        });
        if (meetLink) {
          const pool = await getPool();
          await pool.query(`UPDATE "Leads" SET meeting_link=$1 WHERE id=$2`, [meetLink, lead.id]);
          lead.meeting_link = meetLink; // make available to email builder
          logger.info(`[Automation] Meet link saved for lead ${lead.id}: ${meetLink}`);
        }
      } catch (meetErr) {
        logger.warn(`[Automation] Meet link creation skipped for lead ${lead.id}:`, meetErr.message);
      }
    }

    await sendWelcomeMessages(lead);
    if (lead.client_type === 'Type1' && lead.meeting_datetime) {
      await scheduleRemindersForLead(lead);
    } else {
      await scheduleFollowUpForLead(lead);
    }
  } catch (err) {
    logger.error(`Automation trigger failed for lead ${lead.id}:`, err);
  }
}

module.exports = {
  getLeads, getLead, createLead,
  updateLeadStatus, updateLead, assignLead,
  getStats,
  getFollowUps, addFollowUp,
  getActivity,
  sendEmail, sendWhatsApp,
  deleteLead, triggerLeadAutomation,
};
