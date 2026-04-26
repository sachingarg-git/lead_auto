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

    // Guard: skip if automation already ran (welcome_sent = true)
    if (lead.welcome_sent) {
      logger.info(`Internal trigger: lead ${lead_id} already has welcome_sent=true — skipped`);
      return res.json({ skipped: true, reason: 'already_sent', lead_id });
    }

    await triggerLeadAutomation(lead);
    logger.info(`Internal trigger: automation fired for lead ${lead_id} (${lead.full_name})`);
    res.json({ success: true, lead_id });
  } catch (err) {
    logger.error(`Internal trigger error for lead ${lead_id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
