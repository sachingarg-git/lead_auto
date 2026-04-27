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

module.exports = router;
