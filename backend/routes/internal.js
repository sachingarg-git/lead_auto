/**
 * Internal API — called by the landing page backend after a slot is booked.
 * NOT exposed to the public (token-protected, no auth middleware).
 *
 * POST /api/internal/trigger/:lead_id
 *   Header: x-internal-token: <INTERNAL_API_TOKEN>
 *   → Runs triggerLeadAutomation for the lead (welcome email + WhatsApp + reminders)
 */
const router = require('express').Router();
const Lead   = require('../models/Lead');
const { triggerLeadAutomation } = require('../controllers/leadController');
const { createMeetLink }        = require('../services/googleMeetService');
const logger = require('../config/logger');

const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || 'wizone_internal_2026';

router.post('/trigger/:lead_id', async (req, res) => {
  // Simple shared-secret auth
  const token = req.headers['x-internal-token'];
  if (!token || token !== INTERNAL_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const lead_id = parseInt(req.params.lead_id);
  if (!lead_id) return res.status(400).json({ error: 'Invalid lead_id' });

  try {
    const lead = await Lead.findById(lead_id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // ── ALWAYS ensure Meet link exists if slot is booked ─────────
    // This runs regardless of welcome_sent — Meet link must NEVER be missed
    if (lead.slot_date && lead.slot_time && !lead.meeting_link) {
      try {
        const { getPool } = require('../config/database');
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
          lead.meeting_link = meetLink;
          logger.info(`[InternalTrigger] Meet link created for lead ${lead_id}: ${meetLink}`);
        }
      } catch (meetErr) {
        logger.warn(`[InternalTrigger] Meet link creation failed for lead ${lead_id}:`, meetErr.message);
      }
    }

    // Guard: skip welcome email + follow-up scheduling if automation already ran
    if (lead.welcome_sent) {
      logger.info(`[InternalTrigger] lead ${lead_id} already has welcome_sent=true — email skipped, Meet link ensured`);
      return res.json({ skipped: true, reason: 'already_sent', lead_id, meeting_link: lead.meeting_link });
    }

    await triggerLeadAutomation(lead);
    logger.info(`[InternalTrigger] Automation fired for lead ${lead_id} (${lead.full_name})`);
    res.json({ success: true, lead_id, meeting_link: lead.meeting_link });
  } catch (err) {
    logger.error(`[InternalTrigger] Error for lead ${lead_id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
