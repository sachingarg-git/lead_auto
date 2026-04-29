const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getLeads, getLead, createLead, updateLeadStatus, updateLead, assignLead,
  getStats, getFollowUps, addFollowUp, getActivity,
  sendEmail, sendWhatsApp,
  deleteLead,
} = require('../controllers/leadController');

router.use(authenticate);

router.get('/',               authorize('leads:read'),   getLeads);
router.get('/stats',          authorize('leads:read'),   getStats);
router.get('/:id',            authorize('leads:read'),   getLead);
router.post('/',              authorize('leads:write'),  createLead);
router.patch('/:id',          authorize('leads:write'),  updateLead);
router.patch('/:id/status',   authorize('leads:status'), updateLeadStatus);
router.patch('/:id/assign',   authorize('leads:write'),  assignLead);
router.delete('/:id',         authorize('leads:write'),  deleteLead);

// FollowUp + activity log
router.get('/:id/followups',  authorize('leads:read'),   getFollowUps);
router.post('/:id/followups', authorize('leads:status'), addFollowUp);
router.get('/:id/activity',   authorize('leads:read'),   getActivity);

// Manual send
router.post('/:id/send-email',     authorize('leads:write'), sendEmail);
router.post('/:id/send-whatsapp',  authorize('leads:write'), sendWhatsApp);

// POST /api/leads/:id/generate-meet-link — Manually create Meet link + send email to customer
router.post('/:id/generate-meet-link', authenticate, authorize('leads:write'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { getPool } = require('../config/database');
    const Lead = require('../models/Lead');
    const { createMeetLink } = require('../services/googleMeetService');
    const { sendMeetLinkEmail } = require('../services/emailService');
    const logger = require('../config/logger');

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Generate fresh meet link (always — allows regeneration)
    const meetLink = await createMeetLink({
      title        : `Wizone AI Demo — ${lead.full_name}`,
      slotDate     : lead.slot_date,
      slotTime     : lead.slot_time,
      durationMins : 60,
      attendeeEmail: lead.email || undefined,
    });

    if (!meetLink) return res.status(500).json({ error: 'Failed to generate meet link' });

    // Save to DB
    const pool = await getPool();
    await pool.query(`UPDATE "Leads" SET meeting_link=$1, updated_at=NOW() WHERE id=$2`, [meetLink, id]);

    // Log activity
    await Lead.logActivity({
      lead_id    : id,
      action_type: 'edit',
      field_name : 'Meeting Link',
      new_value  : meetLink,
      created_by : req.user?.id,
      actor_name : req.user?.name || 'Admin',
    });

    lead.meeting_link = meetLink;

    // Send dedicated Meet Link email to customer
    let emailSent = false;
    if (lead.email) {
      try {
        const msgId = await sendMeetLinkEmail(lead);
        emailSent = !!msgId;
        if (emailSent) logger.info(`[GenerateMeet] Meet link email sent to ${lead.email} for lead ${id}`);
      } catch (emailErr) {
        logger.warn(`[GenerateMeet] Meet link email failed for lead ${id}:`, emailErr.message);
      }
    }

    logger.info(`[GenerateMeet] Meet link created for lead ${id} (${lead.full_name}): ${meetLink}`);
    res.json({ success: true, meeting_link: meetLink, email_sent: emailSent });

  } catch (err) {
    const logger = require('../config/logger');
    logger.error('generate-meet-link error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/set-slot — Set slot date+time and auto-create Google Meet link
router.post('/:id/set-slot', authenticate, authorize('leads:write'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { slot_date, slot_time } = req.body;
    if (!slot_date || !slot_time) return res.status(400).json({ error: 'slot_date and slot_time required' });

    const { getPool } = require('../config/database');
    const pool = await getPool();

    // Check the slot isn't already taken by another lead
    const conflict = await pool.query(`
      SELECT id, full_name FROM "Leads"
      WHERE slot_date = $1::date AND slot_time = $2::time
        AND status NOT IN ('Lost') AND id <> $3
      LIMIT 1
    `, [slot_date, slot_time + ':00', id]);
    if (conflict.rows.length > 0) {
      const c = conflict.rows[0];
      return res.status(409).json({ error: `Slot already booked by ${c.full_name}` });
    }

    // Update slot in DB
    await pool.query(
      `UPDATE "Leads" SET slot_date=$1::date, slot_time=$2::time, updated_at=NOW() WHERE id=$3`,
      [slot_date, slot_time + ':00', id]
    );

    // Fetch updated lead
    const Lead = require('../models/Lead');
    const lead = await Lead.findById(id);

    // Log activity
    await Lead.logActivity({
      lead_id:     id,
      action_type: 'edit',
      field_name:  'Slot Date',
      new_value:   `${slot_date} at ${slot_time}`,
      created_by:  req.user?.id,
      actor_name:  req.user?.name || 'System',
    });

    // Auto-create Google Meet link (non-fatal)
    try {
      const { createMeetLink } = require('../services/googleMeetService');
      const meetLink = await createMeetLink({
        title        : `Wizone AI Demo — ${lead.full_name}`,
        slotDate     : slot_date,
        slotTime     : slot_time,
        durationMins : 60,
        attendeeEmail: lead.email || undefined,
      });
      if (meetLink) {
        await pool.query(`UPDATE "Leads" SET meeting_link=$1 WHERE id=$2`, [meetLink, id]);
        lead.meeting_link = meetLink;
        const logger = require('../config/logger');
        logger.info(`[set-slot] Meet link created for lead ${id}: ${meetLink}`);
      }
    } catch (meetErr) {
      const logger = require('../config/logger');
      logger.warn(`[set-slot] Meet link failed for lead ${id}:`, meetErr.message);
    }

    res.json(lead);
  } catch (err) {
    const logger = require('../config/logger');
    logger.error('set-slot error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── Manual: send questionnaire email to a specific lead ── */
router.post('/:id/send-questionnaire', authenticate, authorize('leads:write'), async (req, res) => {
  const logger = require('../config/logger');
  try {
    const Lead = require('../models/Lead');
    const { sendQuestionnaireEmail } = require('../services/emailService');
    const { generateToken } = require('./public');

    const lead = await Lead.findById(parseInt(req.params.id));
    if (!lead)        return res.status(404).json({ error: 'Lead not found' });
    if (!lead.email)  return res.status(400).json({ error: 'Lead has no email address' });

    const token = generateToken(lead.id);
    await sendQuestionnaireEmail(lead, token);

    logger.info(`[ManualQuestionnaire] Sent to lead ${lead.id} (${lead.email}) by user ${req.user?.id}`);
    res.json({ success: true, sent_to: lead.email });
  } catch (err) {
    logger.error('[ManualQuestionnaire] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
