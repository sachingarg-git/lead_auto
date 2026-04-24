/**
 * Public Lead Capture API
 * Used by landing pages and external forms.
 *
 * ── Quick Start ──────────────────────────────────────────────
 *   POST /api/capture
 *   Header: x-api-key: wz_xxxxxxxxxxxxxxxx
 *   Body (JSON):
 *   {
 *     "full_name":  "Rahul Sharma",          // REQUIRED
 *     "phone":      "9876543210",
 *     "email":      "rahul@example.com",
 *     "whatsapp":   "9876543210",
 *     "company":    "ABC Corp",
 *     "industry":   "Real Estate",
 *     "slot_date":  "2025-05-20",            // Appointment date  (YYYY-MM-DD)
 *     "slot_time":  "14:30",                 // Appointment time  (HH:MM)
 *     "notes":      "Interested in 2BHK"
 *   }
 *
 * The API key ties the lead to a LeadSource and tags the lead with
 * the source name automatically. Slot date + time are stored in
 * dedicated DATE / TIME columns and also as a combined display string.
 */

const router    = require('express').Router();
const rateLimit = require('express-rate-limit');
const Lead      = require('../models/Lead');
const { query } = require('../config/database');
const { triggerLeadAutomation } = require('../controllers/leadController');
const logger    = require('../config/logger');

// ── Rate limit: 60 leads per minute per IP ────────────────────
const captureLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
});

router.post('/', captureLimiter, async (req, res) => {

  // ── 1. Validate API key ─────────────────────────────────────
  const apiKey = req.headers['x-api-key'] || req.body.api_key;
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required. Send as x-api-key header.' });
  }

  const sourceResult = await query(
    `SELECT * FROM LeadSources
     WHERE api_key = @api_key AND is_active = 1 AND source_type = 'landing_page'`,
    { api_key: apiKey }
  );

  if (!sourceResult.recordset.length) {
    return res.status(401).json({ error: 'Invalid or inactive API key' });
  }

  const source    = sourceResult.recordset[0];
  const body      = req.body;
  const columnMap = source.column_map ? JSON.parse(source.column_map) : {};

  // ── 2. Field resolver (supports aliasing via column_map) ────
  function getField(...aliases) {
    for (const alias of aliases) {
      const mapped = columnMap[alias];
      if (mapped && body[mapped] !== undefined && body[mapped] !== '') return body[mapped];
      if (body[alias]  !== undefined && body[alias]  !== '') return body[alias];
    }
    return null;
  }

  // ── 3. Validate required field ──────────────────────────────
  const full_name = getField('full_name', 'name', 'Name', 'lead_name', 'fullname');
  if (!full_name) {
    return res.status(400).json({ error: 'full_name (or name) is required' });
  }

  // ── 4. Slot booking — accept BOTH combined & separate ───────
  //  Option A — separate: slot_date="2025-05-20"  slot_time="14:30"
  //  Option B — combined: preferred_slot="2025-05-20 14:30"
  const rawSlotDate     = getField('slot_date', 'booking_date', 'appointment_date', 'date');
  const rawSlotTime     = getField('slot_time', 'booking_time', 'appointment_time', 'time');
  const rawSlotCombined = getField('preferred_slot', 'slot', 'meeting_time', 'preferred_time', 'datetime');

  let slot_date        = null;  // DATE  column
  let slot_time        = null;  // TIME  column
  let preferred_slot   = null;  // display string
  let meeting_datetime = null;  // DATETIME2 for automation
  let client_type      = 'Type2';

  if (rawSlotDate) {
    // ── Separate date + time fields ──────────────────────────
    slot_date = rawSlotDate;        // e.g. "2025-05-20"
    slot_time = rawSlotTime || null; // e.g. "14:30"

    preferred_slot = slot_time
      ? `${slot_date} ${slot_time}`
      : slot_date;

    const dtStr = slot_time ? `${slot_date}T${slot_time}:00` : `${slot_date}T00:00:00`;
    const parsed = new Date(dtStr);
    if (!isNaN(parsed.getTime())) {
      meeting_datetime = parsed;
      client_type      = 'Type1'; // meeting booked → Type1 automation path
    }
  } else if (rawSlotCombined) {
    // ── Combined string field ────────────────────────────────
    preferred_slot = rawSlotCombined;
    const parsed   = new Date(rawSlotCombined);
    if (!isNaN(parsed.getTime())) {
      meeting_datetime = parsed;
      client_type      = 'Type1';
      slot_date = parsed.toISOString().substring(0, 10);
      slot_time = parsed.toISOString().substring(11, 8);
    }
  }

  // ── 5. Build full lead payload ──────────────────────────────
  const leadData = {
    full_name,
    email:           getField('email',    'Email',    'email_address'),
    phone:           getField('phone',    'Phone',    'mobile', 'contact', 'phone_number'),
    whatsapp_number: getField('whatsapp', 'whatsapp_number', 'Phone', 'phone', 'contact'),
    company:         getField('company',  'Company',  'company_name', 'organization'),
    industry:        getField('industry', 'Industry', 'sector'),
    notes:           getField('notes',    'message',  'Message', 'query', 'comment'),
    tags:            getField('tags'),
    source:          source.name,
    api_key_used:    apiKey,
    status:          'New',
    client_type,
    preferred_slot,
    slot_date,
    slot_time,
    meeting_datetime,
  };

  try {
    // ── 6. Deduplicate (same phone + source within 24 h) ────
    if (leadData.phone) {
      const dup = await query(
        `SELECT id FROM Leads
         WHERE phone = @phone AND source = @source
           AND created_at >= DATEADD(HOUR, -24, GETDATE())`,
        { phone: leadData.phone, source: source.name }
      );
      if (dup.recordset.length) {
        return res.status(409).json({
          error: 'Duplicate lead (same phone submitted within 24 h)',
          lead_id: dup.recordset[0].id,
        });
      }
    }

    // ── 7. Insert into centralized Leads table ──────────────
    const lead = await Lead.create(leadData);

    // Increment source sync counter
    await query(
      `UPDATE LeadSources
       SET sync_count = sync_count + 1, last_synced = GETDATE()
       WHERE id = @id`,
      { id: source.id }
    );

    // ── 8. Real-time dashboard notification ─────────────────
    const io = req.app?.get('io');
    if (io) io.to('dashboard').emit('lead:new', lead);

    // ── 9. Trigger welcome message + automation ──────────────
    await triggerLeadAutomation(lead);

    logger.info(
      `Capture: "${lead.full_name}" from "${source.name}"` +
      (slot_date ? ` | slot ${slot_date} ${slot_time || ''}`.trim() : '')
    );

    return res.status(201).json({
      success:  true,
      lead_id:  lead.id,
      message:  'Lead captured successfully',
      slot_date,
      slot_time,
    });

  } catch (err) {
    logger.error('capture error:', err);
    return res.status(500).json({ error: 'Failed to capture lead' });
  }
});

module.exports = router;
