const router   = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize }   = require('../middleware/rbac');
const Settings = require('../models/Settings');
const { testEmail } = require('../services/emailService');
const logger   = require('../config/logger');

router.use(authenticate);

// GET /api/settings — Admin only, returns all settings (passwords masked)
router.get('/', authorize('settings:read'), async (req, res) => {
  try {
    const s = await Settings.getAll();
    // Mask passwords in the response
    if (s.smtp_pass && s.smtp_pass.length > 0) s.smtp_pass = '••••••••';
    if (s.interakt_api_key && s.interakt_api_key.length > 4)
      s.interakt_api_key = s.interakt_api_key.slice(0, 4) + '••••••••';
    res.json(s);
  } catch (err) {
    logger.error('GET settings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PUT /api/settings — Save settings
router.put('/', authorize('settings:write'), async (req, res) => {
  try {
    const allowed = [
      'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name',
      'interakt_enabled', 'interakt_api_key',
      'company_name', 'company_phone', 'company_website',
      'email_welcome_subject', 'email_welcome_body',
      'whatsapp_welcome_template',
    ];
    const toSave = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        // Don't overwrite password if placeholder or empty (keep existing value)
        if (key === 'smtp_pass' || key === 'interakt_api_key') {
          const v = req.body[key];
          if (!v || v.includes('••••')) continue; // skip blank or masked
        }
        toSave[key] = req.body[key];
      }
    }
    await Settings.setMany(toSave);

    // Reset cached transporter so new SMTP creds are used immediately
    const emailSvc = require('../services/emailService');
    if (emailSvc.resetTransporter) emailSvc.resetTransporter();

    logger.info(`Settings updated by user ${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('PUT settings error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// POST /api/settings/test-email — Send a test email
router.post('/test-email', authorize('settings:write'), async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient email required' });
    await testEmail(to);
    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    logger.error('test-email error:', err);
    res.status(500).json({ error: err.message || 'Failed to send test email' });
  }
});

module.exports = router;
