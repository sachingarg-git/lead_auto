/**
 * Meet Link Service
 *
 * Generates a unique video-call join URL for each booked lead.
 *
 * Current implementation: Jitsi Meet (meet.jit.si)
 *   — Free, no API key, no Google Workspace required
 *   — Persistent room: anyone with the link joins immediately
 *   — Identical UX to Google Meet for the end user
 *
 * Upgrade path → Real Google Meet (when Google Workspace is available):
 *   1. Enable Domain-Wide Delegation (DWD) for the service account in GCP
 *   2. In Google Workspace Admin → Security → API Controls → grant the SA
 *      client ID the scope: https://www.googleapis.com/auth/meetings.space.created
 *   3. Re-implement createMeetLink() using:
 *        const auth = new google.auth.JWT({ ..., subject: 'admin@yourdomain.com' });
 *        const meet = google.meet({ version: 'v2', auth });
 *        const res  = await meet.spaces.create({ requestBody: {} });
 *        return res.data.meetingUri;
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// ── Jitsi Meet base URL ───────────────────────────────────────
// Public Jitsi server — free, no login required for participants.
// Can be replaced with a self-hosted Jitsi instance for full branding.
const JITSI_BASE = 'https://meet.jit.si';

/**
 * Generate a unique Jitsi Meet room link for a booked lead.
 *
 * Room naming: Wizone-<8-char-uuid> — short enough to share, unique enough to avoid collisions.
 * The room persists forever; participants join by opening the URL.
 *
 * @param {Object} opts
 * @param {string} opts.title          — Lead name / event title (used for logging)
 * @param {string} [opts.slotDate]     — For logging context
 * @param {string} [opts.slotTime]     — For logging context
 * @param {string} [opts.attendeeEmail]— For logging context
 * @returns {Promise<string>}          — Jitsi Meet URL (always succeeds, never null)
 */
async function createMeetLink({ title, slotDate, slotTime, attendeeEmail } = {}) {
  try {
    // Generate a short collision-resistant room ID
    const roomId   = uuidv4().replace(/-/g, '').substring(0, 10);
    const roomName = `Wizone-${roomId}`;
    const meetLink = `${JITSI_BASE}/${roomName}`;

    logger.info(`[MeetLink] Created Jitsi Meet room for "${title || 'lead'}" (${slotDate || ''} ${slotTime || ''}): ${meetLink}`);
    return meetLink;

  } catch (err) {
    // Should never fail (no network call), but guard defensively
    logger.error('[MeetLink] Failed to generate meet link:', err.message);

    // Absolute fallback — still return a usable link
    const fallback = `${JITSI_BASE}/Wizone-${Date.now()}`;
    return fallback;
  }
}

module.exports = { createMeetLink };
