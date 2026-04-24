const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { query } = require('../config/database');
const logger = require('../config/logger');

router.use(authenticate);

// Get all reminders for a lead
router.get('/lead/:leadId', authorize('reminders:read'), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM Reminders WHERE lead_id = @lead_id ORDER BY scheduled_at ASC`,
      { lead_id: parseInt(req.params.leadId) }
    );
    res.json(result.recordset);
  } catch (err) {
    logger.error('get reminders error:', err);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// Get upcoming reminders (next 24h)
router.get('/upcoming', authorize('reminders:read'), async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, l.full_name, l.phone, l.email, l.whatsapp_number
      FROM Reminders r
      JOIN Leads l ON r.lead_id = l.id
      WHERE r.status = 'Pending'
        AND r.scheduled_at BETWEEN GETDATE() AND DATEADD(HOUR, 24, GETDATE())
      ORDER BY r.scheduled_at ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    logger.error('upcoming reminders error:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming reminders' });
  }
});

module.exports = router;
