const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const { query } = require('../config/database');
const { scheduleRemindersForLead } = require('../jobs/reminderScheduler');
const { scheduleFollowUpForLead } = require('../jobs/followUpScheduler');
const { sendWelcomeMessages } = require('../services/communicationService');
const logger = require('../config/logger');

async function getLeads(req, res) {
  try {
    const { status, source, assigned_to, client_type, search, followup_date, page, limit } = req.query;
    const data = await Lead.findAll({
      status, source, client_type, followup_date,
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

    // Emit to dashboard in real time
    const io = req.app.get('io');
    io.to('dashboard').emit('lead:new', lead);

    // Trigger automation
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
    const updated = await Lead.update(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Lead not found' });

    const io = req.app.get('io');
    io.to('dashboard').emit('lead:updated', updated);

    // Re-schedule if meeting datetime changed (Type1)
    if (req.body.meeting_datetime && updated.client_type === 'Type1') {
      await scheduleRemindersForLead(updated);
    }

    res.json(updated);
  } catch (err) {
    logger.error('updateLead error:', err);
    res.status(500).json({ error: 'Failed to update lead' });
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
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid or missing status' });
    }

    // Update lead status
    const lead = await Lead.updateStatus(lead_id, status, req.user.id, note);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Record followup entry
    const followup = await FollowUp.create({
      lead_id,
      status,
      note,
      next_followup_date,
      created_by: req.user.id,
    });

    const io = req.app.get('io');
    io.to('dashboard').emit('lead:updated', lead);

    res.status(201).json({ followup, lead });
  } catch (err) {
    logger.error('addFollowUp error:', err);
    res.status(500).json({ error: 'Failed to add followup' });
  }
}

// ── Delete Lead ──────────────────────────────────────────────
async function deleteLead(req, res) {
  try {
    const id = parseInt(req.params.id);
    // Delete followups and history first (no FK cascade set up)
    await query(`DELETE FROM FollowUps WHERE lead_id = @id`, { id });
    await query(`DELETE FROM LeadStatusHistory WHERE lead_id = @id`, { id }).catch(() => {});
    await query(`DELETE FROM Reminders WHERE lead_id = @id`, { id }).catch(() => {});
    await query(`DELETE FROM Leads WHERE id = @id`, { id });

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
    // 1. Send welcome/intro messages across all channels
    await sendWelcomeMessages(lead);

    // 2. Schedule reminders based on client type
    if (lead.client_type === 'Type1' && lead.meeting_datetime) {
      await scheduleRemindersForLead(lead);
    } else {
      await scheduleFollowUpForLead(lead);
    }
  } catch (err) {
    logger.error(`Automation trigger failed for lead ${lead.id}:`, err);
    // Don't throw — lead was created successfully
  }
}

module.exports = { getLeads, getLead, createLead, updateLeadStatus, updateLead, getStats, getFollowUps, addFollowUp, deleteLead, triggerLeadAutomation };
