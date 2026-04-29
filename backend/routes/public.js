/**
 * Public Questionnaire Routes — /api/public
 *
 * No JWT auth required. Protection comes from a short-lived signed token
 * embedded in the email link (lead_id + expiry, HMAC-signed).
 *
 * Endpoints:
 *   GET  /api/public/questionnaire/info    — returns lead name for greeting
 *   POST /api/public/questionnaire/submit  — saves answers as lead activity
 */

const router = require('express').Router();
const crypto = require('crypto');
const { query } = require('../config/database');
const logger   = require('../config/logger');

// ── Token helpers ─────────────────────────────────────────────
const SECRET = process.env.QUESTIONNAIRE_SECRET || process.env.JWT_SECRET || 'wizone-q-secret';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a token:  base64( JSON({ lead_id, exp }) ) + '.' + HMAC(payload)
 */
function generateToken(lead_id) {
  const payload = Buffer.from(JSON.stringify({
    lead_id,
    exp: Date.now() + TOKEN_TTL_MS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify a token — returns lead_id or throws.
 */
function verifyToken(token) {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) throw new Error('Invalid token format');
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Token signature invalid');
  }
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (Date.now() > data.exp) throw new Error('Token expired');
  return data.lead_id;
}

// ── Rate limit for public endpoints ──────────────────────────
const requestCounts = new Map();
function publicRateLimit(req, res, next) {
  const key = req.ip;
  const now  = Date.now();
  const window = 60_000; // 1 minute
  const max    = 20;
  const entry  = requestCounts.get(key) || { count: 0, ts: now };
  if (now - entry.ts > window) { entry.count = 0; entry.ts = now; }
  entry.count++;
  requestCounts.set(key, entry);
  if (entry.count > max) return res.status(429).json({ error: 'Too many requests' });
  next();
}

// ── GET /api/public/questionnaire/info ───────────────────────
// Returns minimal lead info for the greeting (name only)
router.get('/questionnaire/info', publicRateLimit, async (req, res) => {
  try {
    const { token, lid } = req.query;
    let lead_id;

    if (token) {
      lead_id = verifyToken(token);
    } else if (lid) {
      // Fallback: direct lead_id (less secure, only used if token not set up)
      lead_id = parseInt(lid);
      if (isNaN(lead_id)) return res.status(400).json({ error: 'Invalid lead id' });
    } else {
      return res.status(400).json({ error: 'Token required' });
    }

    const result = await query(
      `SELECT full_name, company FROM "Leads" WHERE id = @id`,
      { id: lead_id }
    );
    const lead = result.recordset[0];
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    res.json({ full_name: lead.full_name, company: lead.company || null });
  } catch (err) {
    logger.warn('[public/questionnaire/info] error:', err.message);
    res.status(401).json({ error: err.message || 'Invalid or expired link' });
  }
});

// ── POST /api/public/questionnaire/submit ───────────────────
// Saves questionnaire answers as a lead activity log + updates notes
router.post('/questionnaire/submit', publicRateLimit, async (req, res) => {
  try {
    const { token, lead_id: rawLeadId, answers } = req.body;

    let lead_id;
    if (token) {
      lead_id = verifyToken(token);
    } else if (rawLeadId) {
      lead_id = parseInt(rawLeadId);
      if (isNaN(lead_id)) return res.status(400).json({ error: 'Invalid lead id' });
    } else {
      return res.status(400).json({ error: 'Token required' });
    }

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Answers object required' });
    }

    // Verify lead exists
    const leadRes = await query(
      `SELECT id, full_name, notes FROM "Leads" WHERE id = @id`,
      { id: lead_id }
    );
    const lead = leadRes.recordset[0];
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Format answers into a readable note block
    const lines = [
      `📋 PRE-MEETING QUESTIONNAIRE — submitted ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      ``,
      `[Section 1 — Basic Context]`,
      `Q1. Business description: ${answers.q1 || '—'}`,
      `Q2. Team size: ${answers.q2 || '—'}`,
      ``,
      `[Section 2 — Current Workflow]`,
      `Q3. Data management: ${answers.q3 || '—'}`,
      `Q4. Biggest headache: ${answers.q4 || '—'}`,
      ``,
      `[Section 3 — Impact]`,
      `Q5. Biggest loss area: ${answers.q5 || '—'}`,
      `Q6. Problem frequency: ${answers.q6 || '—'}`,
      ``,
      `[Section 4 — Urgency]`,
      `Q7. Why fixing now: ${answers.q7 || '—'}`,
      ``,
      `[Section 5 — Outcome]`,
      `Q8. Expected change: ${answers.q8 || '—'}`,
      ``,
      `[Section 6 — Future Vision]`,
      `Q9. 6–12 month goal: ${answers.q9 || '—'}`,
      `Q9b. Vision detail: ${answers.q9_more || '(not provided)'}`,
      ``,
      `[Optional — Gold Insight]`,
      `Q10. Specific focus: ${answers.q10 || '(not provided)'}`,
    ].join('\n');

    // 1. Save as LeadActivityLog entry so it appears in the timeline
    await query(
      `INSERT INTO "LeadActivityLog"
         (lead_id, action_type, field_name, new_value, note, actor_name)
       VALUES (@lead_id, @action_type, @field_name, @new_value, @note, @actor_name)`,
      {
        lead_id,
        action_type: 'questionnaire',
        field_name:  'Pre-Meeting Questionnaire',
        new_value:   'Completed',
        note:        lines,
        actor_name:  lead.full_name,
      }
    );

    // 2. Also append answers to the lead's notes field
    const sep = lead.notes ? '\n\n' + '─'.repeat(40) + '\n' : '';
    const updatedNotes = (lead.notes || '') + sep + lines;
    await query(
      `UPDATE "Leads" SET notes = @notes WHERE id = @id`,
      { notes: updatedNotes.substring(0, 8000), id: lead_id } // cap at 8000 chars
    );

    // 3. Optionally mark a tag on the lead
    await query(
      `UPDATE "Leads"
       SET tags = CASE
         WHEN tags IS NULL OR tags = '' THEN 'questionnaire-done'
         WHEN tags NOT LIKE '%questionnaire-done%' THEN tags || ',questionnaire-done'
         ELSE tags
       END
       WHERE id = @id`,
      { id: lead_id }
    );

    logger.info(`[public/questionnaire] Lead ${lead_id} (${lead.full_name}) submitted questionnaire`);
    res.json({ success: true, message: 'Thank you! Your answers have been saved.' });

  } catch (err) {
    logger.error('[public/questionnaire/submit] error:', err.message);
    res.status(err.message.includes('Token') ? 401 : 500).json({
      error: err.message || 'Failed to save answers',
    });
  }
});

module.exports = router;
module.exports.generateToken = generateToken;
