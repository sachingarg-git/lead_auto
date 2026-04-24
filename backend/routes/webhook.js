const router = require('express').Router();
const crypto = require('crypto');
const Lead = require('../models/Lead');
const { triggerLeadAutomation } = require('../controllers/leadController');
const { query } = require('../config/database');
const logger = require('../config/logger');

// ── Meta Webhook Verification (GET) ──────────────────────────
// Meta calls GET /api/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    logger.info('Meta webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('Meta webhook verification failed');
    res.sendStatus(403);
  }
});

// ── Meta Webhook Event (POST) ─────────────────────────────────
// Body is raw buffer here (see server.js middleware setup)
router.post('/', async (req, res) => {
  // 1. Verify Meta signature
  const signature = req.headers['x-hub-signature-256'];
  if (!verifyMetaSignature(req.body, signature)) {
    logger.warn('Meta webhook: invalid signature');
    return res.sendStatus(403);
  }

  // Parse body (was kept as raw buffer)
  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  // Acknowledge immediately (Meta requires < 5s response)
  res.sendStatus(200);

  // Process asynchronously
  processMetaEvent(payload).catch(err =>
    logger.error('Meta event processing error:', err)
  );
});

// ── Signature Verification ────────────────────────────────────
function verifyMetaSignature(rawBody, signature) {
  if (!signature || !process.env.META_APP_SECRET) return true; // skip in dev if not configured
  const expected = `sha256=${crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ── Event Processing ──────────────────────────────────────────
async function processMetaEvent(payload) {
  // Store raw event for audit/replay
  await query(
    `INSERT INTO WebhookEvents (source, event_type, payload)
     VALUES ('Meta', @event_type, @payload)`,
    {
      event_type: payload.object || 'unknown',
      payload: JSON.stringify(payload),
    }
  );

  if (payload.object !== 'page' && payload.object !== 'instagram') {
    logger.debug('Meta webhook: non-lead event, skipping');
    return;
  }

  for (const entry of (payload.entry || [])) {
    for (const change of (entry.changes || [])) {
      if (change.field === 'leadgen') {
        await processLeadGenEvent(change.value, entry.id);
      }
    }
  }
}

/**
 * Process a Meta Lead Gen event.
 * Meta sends form submissions from Facebook Lead Ads here.
 */
async function processLeadGenEvent(leadgenData, pageId) {
  const metaLeadId = leadgenData.leadgen_id;

  // Dedup check
  const existing = await Lead.findByMetaLeadId(metaLeadId);
  if (existing) {
    logger.info(`Meta lead ${metaLeadId} already exists, skipping`);
    return;
  }

  // Fetch full lead data from Meta Graph API
  let formData = leadgenData;
  try {
    const axios = require('axios');
    const resp = await axios.get(
      `https://graph.facebook.com/v19.0/${metaLeadId}`,
      { params: { access_token: process.env.META_PAGE_ACCESS_TOKEN } }
    );
    formData = resp.data;
  } catch (err) {
    logger.warn(`Could not fetch Meta lead details for ${metaLeadId}:`, err.message);
  }

  // Extract standard fields from Meta form
  const fieldData = {};
  for (const f of (formData.field_data || [])) {
    fieldData[f.name] = f.values?.[0] || '';
  }

  const leadPayload = {
    full_name: fieldData.full_name || fieldData.name || `${fieldData.first_name || ''} ${fieldData.last_name || ''}`.trim() || 'Unknown',
    email: fieldData.email || null,
    phone: fieldData.phone_number || fieldData.phone || null,
    whatsapp_number: fieldData.whatsapp_number || fieldData.phone_number || null,
    source: 'Meta',
    meta_lead_id: metaLeadId,
    ad_id: leadgenData.ad_id,
    ad_name: leadgenData.ad_name,
    campaign_id: leadgenData.campaign_id,
    campaign_name: leadgenData.campaign_name,
    form_data: formData,
    client_type: 'Type2', // default; upgrade to Type1 when meeting is booked
    status: 'New',
  };

  const lead = await Lead.create(leadPayload);
  logger.info(`New Meta lead created: ${lead.id} — ${lead.full_name}`);

  // Update webhook event with lead ID
  await query(
    `UPDATE WebhookEvents SET processed = 1, lead_id = @lead_id WHERE payload LIKE @pattern`,
    { lead_id: lead.id, pattern: `%${metaLeadId}%` }
  );

  // Trigger automation (welcome message + scheduling)
  await triggerLeadAutomation(lead);
}

module.exports = router;
