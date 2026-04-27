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

// GET /api/settings/email-templates
router.get('/email-templates', authorize('settings:read'), async (req, res) => {
  try {
    const { getPool } = require('../config/database');
    const pool = await getPool();
    const r = await pool.query(`
      SELECT t.*,
        COALESCE(json_agg(s.source ORDER BY s.source) FILTER (WHERE s.source IS NOT NULL), '[]') AS linked_sources
      FROM "EmailTemplates" t
      LEFT JOIN "SourceTemplateMap" s ON s.template_id = t.id
      GROUP BY t.id
      ORDER BY t.is_default DESC, t.created_at ASC
    `);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/email-templates
router.post('/email-templates', authorize('settings:write'), async (req, res) => {
  try {
    const { name, subject, body, is_default } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { getPool } = require('../config/database');
    const pool = await getPool();
    if (is_default) await pool.query(`UPDATE "EmailTemplates" SET is_default = false`);
    const r = await pool.query(
      `INSERT INTO "EmailTemplates" (name, subject, body, is_default) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, subject || '', body || '', !!is_default]
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/email-templates/:id
router.put('/email-templates/:id', authorize('settings:write'), async (req, res) => {
  try {
    const { name, subject, body, is_default } = req.body;
    const { getPool } = require('../config/database');
    const pool = await getPool();
    if (is_default) await pool.query(`UPDATE "EmailTemplates" SET is_default = false`);
    const r = await pool.query(
      `UPDATE "EmailTemplates" SET name=$1,subject=$2,body=$3,is_default=$4,updated_at=NOW() WHERE id=$5 RETURNING *`,
      [name, subject || '', body || '', !!is_default, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/settings/email-templates/:id
router.delete('/email-templates/:id', authorize('settings:write'), async (req, res) => {
  try {
    const { getPool } = require('../config/database');
    const pool = await getPool();
    await pool.query(`DELETE FROM "EmailTemplates" WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/source-template-map
router.get('/source-template-map', authorize('settings:read'), async (req, res) => {
  try {
    const { getPool } = require('../config/database');
    const pool = await getPool();
    const r = await pool.query(`
      SELECT s.source, s.template_id, t.name AS template_name
      FROM "SourceTemplateMap" s LEFT JOIN "EmailTemplates" t ON t.id=s.template_id ORDER BY s.source
    `);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/source-template-map
router.put('/source-template-map', authorize('settings:write'), async (req, res) => {
  try {
    const { source, template_id } = req.body;
    if (!source) return res.status(400).json({ error: 'source required' });
    const { getPool } = require('../config/database');
    const pool = await getPool();
    if (!template_id) {
      await pool.query(`DELETE FROM "SourceTemplateMap" WHERE source=$1`, [source]);
    } else {
      await pool.query(`
        INSERT INTO "SourceTemplateMap"(source,template_id) VALUES($1,$2)
        ON CONFLICT(source) DO UPDATE SET template_id=EXCLUDED.template_id
      `, [source, template_id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/email-templates/:id/preview
router.get('/email-templates/:id/preview', authorize('settings:read'), async (req, res) => {
  try {
    const { getPool } = require('../config/database');
    const pool = await getPool();
    const r = await pool.query(`SELECT * FROM "EmailTemplates" WHERE id=$1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const t = r.rows[0];
    const sample = { full_name: 'Rahul Sharma', phone: '+91 98765 43210', email: 'rahul@example.com', company: 'ABC Pvt Ltd', company_name: 'Wizone AI', slot_date: '28 Apr 2026', slot_time: '10:00 AM', meet_link: 'https://meet.google.com/abc-defg-hij' };
    const replace = s => s.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, k, inner) => sample[k] ? inner : '').replace(/\{\{(\w+)\}\}/g, (_, k) => sample[k] || '');
    const subject = replace(t.subject);
    const body = replace(t.body);
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9fafb;border-radius:8px"><div style="background:#0891b2;padding:20px 24px;border-radius:8px 8px 0 0"><h2 style="color:#fff;margin:0;font-size:20px">Wizone AI</h2></div><div style="background:#fff;padding:28px 24px;border-radius:0 0 8px 8px;white-space:pre-line;color:#374151;line-height:1.7;font-size:14px">${body.replace(/\n/g, '<br>')}</div></div>`;
    res.json({ subject, html, body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/send-template-email (used from lead detail)
router.post('/send-template-email', authorize('leads:write'), async (req, res) => {
  try {
    const { lead_id, template_id } = req.body;
    const { getPool } = require('../config/database');
    const pool = await getPool();

    // Get lead
    const lr = await pool.query(`SELECT * FROM "Leads" WHERE id=$1`, [lead_id]);
    if (!lr.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const lead = lr.rows[0];
    if (!lead.email) return res.status(400).json({ error: 'Lead has no email' });

    // Get template
    const tr = await pool.query(`SELECT * FROM "EmailTemplates" WHERE id=$1`, [template_id]);
    if (!tr.rows.length) return res.status(404).json({ error: 'Template not found' });
    const tmpl = tr.rows[0];

    const Settings = require('../models/Settings');
    const companyName = (await Settings.get('company_name')) || 'Wizone';

    const vars = { full_name: lead.full_name || '', phone: lead.phone || '', email: lead.email || '', company: lead.company || '', company_name: companyName, slot_date: lead.slot_date ? String(lead.slot_date).substring(0, 10) : '', slot_time: lead.slot_time ? String(lead.slot_time).substring(0, 5) : '', meet_link: lead.meeting_link || '' };

    const replace = s => s.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, k, inner) => vars[k] ? inner : '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');
    const subject = replace(tmpl.subject);
    const body = replace(tmpl.body);
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9fafb;border-radius:8px"><div style="background:#0891b2;padding:20px 24px;border-radius:8px 8px 0 0"><h2 style="color:#fff;margin:0;font-size:20px">${companyName}</h2></div><div style="background:#fff;padding:28px 24px;border-radius:0 0 8px 8px;white-space:pre-line;color:#374151;line-height:1.7;font-size:14px">${body.replace(/\n/g, '<br>')}</div></div>`;

    const { sendEmail } = require('../services/emailService');
    await sendEmail({ to: lead.email, subject, html });
    res.json({ success: true, sent_to: lead.email, subject });
  } catch (err) { logger.error('send-template-email:', err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
