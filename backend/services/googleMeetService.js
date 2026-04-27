/**
 * Google Meet Auto-Link Service
 * Creates a Google Calendar event with Meet conferencing for each booked lead.
 * Uses Service Account credentials — no user OAuth flow needed.
 *
 * Setup (one-time):
 *   1. Share a Google Calendar with ai-782@steam-machine-485216-v0.iam.gserviceaccount.com
 *      (give it "Make changes to events" permission)  ← OPTIONAL if using 'primary' SA calendar
 *   2. Set GOOGLE_CALENDAR_ID in .env (default: 'primary' = service account's own calendar)
 */
const { google }  = require('googleapis');
const { v4: uuidv4 } = require('crypto');
const logger = require('../config/logger');

// ── Service Account credentials ───────────────────────────────
const SA_EMAIL      = 'ai-782@steam-machine-485216-v0.iam.gserviceaccount.com';
const SA_PRIVATE_KEY = process.env.GOOGLE_SA_PRIVATE_KEY
  ? process.env.GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, '\n')
  : `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC5mOySzGFTf95K\nsOhXOt2b2OowDukqrt9+QKVoHIFGyGV63EycZDZLQHeOdao/T0/4AfPfAanPmjIs\n6sNmqoZwnDxO2lYQ9G9P2VfD+RiqZ+pOXqEZ1NdO/wGKoziKab3ddFlNtEUtkYQL\njgQ8RRZYKWmiMheQxMIhywlTVSwuDiUdq137UgqiU8Z/1MFnpSqV/NJwWfkuE9XV\nnJOvtZgNU4DM84tvKMSsgBzyJk/5kgGJmQwtoW2hMNZOxKTjqRsvvmU6FJrrPQU/\ngRcuh2s/4/qugj8RZ3v+3yvc1S/Stlkx9+eXUW8qGOutUW3mUSnZwP3V5VaJVNf9\nQFZIYIpLAgMBAAECggEADrmGv2jOqfDBopxhepY1gclWXyS3tAa2vY4EcXudeA+r\nGXHD9D5xHkxJj/he3vH8brk872ry3YEmzPB9OzZ5PxLuJ/VjkanK8QNV1rr7DX38\nFWalkmaUBHTv2t9zO2wDP8Ac27DbMi/S0ZXdWSjECo+SjWc6/mXV3xd8MGvX+vlK\ntvFPuANUKBS3R/v1WY0yGNovxRQiJ+1b/h2WGxPyYDI6qm5SFKsJy5DhnqUfiwUM\ni21BnFCRTSYUwEDbX1yytMYTCHrofBJ70vIK/9Cd57DRQYv5lu9ZNSSMefKL6QJE\ni3eYXXKQ3D/c7REYV5vaHDLT8KKmZkQ7Gb6lzkDiMQKBgQDg0/03F3DbD3s2oGPZ\nFvg+ASBc7dz9Y5DGg//c0mtx7SycI8+oLaFQwdu/BIF0iMjDfal10Ck3eQ9+3AX+\n4XheYenm2wl7vAZBgK3svzgMAk6/4v5Jv6fJTc0yLOs74gdUzlZgVHXUtDaoMSyF\nzrHVnOE4IEYivBzRwafd+bxbmwKBgQDTVHx3IMgXjRd3lwD6jnBuVtwVcC1oTZnJ\nNWvDaVAVhrRN6xeBIVK/fOl8AohQ4oP9TZnqbmXXSz2ueumZqg4ru6X5wLR4FIFW\nP8d5nMxFjJIB4qtdVXHM6PbqIQG3Tc3JZLtcU2E2nra0x3+BIXwKgVCDyPFAaPgM\nonYAq3cvEQKBgBRhg0HcQSHKnHvOPF7wox5T0dA6y964iOZGDwrAlHbmbjXVVTzE\nriv49uexC985iyGVoagJb8MUmWABqBV78QJ1U9PWpVxvJg4IETw19Wm5R9RDSpP6\n6MXp5KEYy1ZJXirE7bWb0nauw4mps4SJwTtBFnWVD2aUsPQe3w3TVszjAoGAMCSl\nHjZ3nvXjjLj33hyo/FoJVVDy5zoWeMIUxLWvKtg/JykRd7dxtHHudvPUvih8TS5q\ni/+Ob9eSO7eAlCMri0b6bsU518lEFbP963SPDKETeh57T43xmO7RoVDXpTyyTtkF\n3eiY0uqhUNnJ8E8ChRokj4EthLDlIWu5Wjm1syECgYAi0QiRd5m7/EK3+KqsxeZH\n1Z90kFB8g0cQlbgvVVNSXqQo9IVg1rgpgxfmneCg81BTxYjfB6jq7IRpcBtz2XYw\n+LEzj3U5BM2op6HCXqm5/9xlobFhhFhRjbY5IN1jnDuPv9pLV0bQ45cAzTuDxNtB\nNkrDpUmkiS+YFXXw7y341A==\n-----END PRIVATE KEY-----\n`;

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

/**
 * Build JWT auth for the service account.
 */
function getAuth() {
  return new google.auth.JWT({
    email : SA_EMAIL,
    key   : SA_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });
}

/**
 * Create a Google Calendar event with Meet conferencing.
 *
 * @param {Object} opts
 * @param {string} opts.title          — Event title, e.g. "Wizone Demo — Rahul Sharma"
 * @param {string} opts.slotDate       — "YYYY-MM-DD"
 * @param {string} opts.slotTime       — "HH:MM" (IST)
 * @param {number} opts.durationMins   — default 60
 * @param {string} opts.attendeeEmail  — customer's email (added as attendee)
 * @returns {Promise<string|null>}     — Google Meet join URL or null on failure
 */
async function createMeetLink({ title, slotDate, slotTime, durationMins = 60, attendeeEmail }) {
  try {
    if (!slotDate || !slotTime) {
      logger.warn('[GoogleMeet] No slot date/time — skipping Meet creation');
      return null;
    }

    const auth     = getAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    // Combine date + time into IST datetime string
    // slotTime is "HH:MM" or "HH:MM:SS"
    const timeStr  = String(slotTime).substring(0, 5); // "HH:MM"
    const dateStr  = String(slotDate).substring(0, 10); // "YYYY-MM-DD"
    const startISO = `${dateStr}T${timeStr}:00+05:30`; // IST offset

    const startDt  = new Date(startISO);
    const endDt    = new Date(startDt.getTime() + durationMins * 60 * 1000);

    const event = {
      summary    : title || 'Wizone AI Demo',
      description: 'Wizone AI — 48-Hour Demo Session',
      start      : { dateTime: startDt.toISOString(), timeZone: 'Asia/Kolkata' },
      end        : { dateTime: endDt.toISOString(),   timeZone: 'Asia/Kolkata' },
      attendees  : attendeeEmail ? [{ email: attendeeEmail }] : [],
      conferenceData: {
        createRequest: {
          requestId              : `wizone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey  : { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides : [
          { method: 'email',  minutes: 60 },
          { method: 'popup',  minutes: 10 },
        ],
      },
    };

    const res = await calendar.events.insert({
      calendarId           : CALENDAR_ID,
      requestBody          : event,
      conferenceDataVersion: 1,   // required to generate Meet link
      sendUpdates          : 'all', // send invite to attendees
    });

    // Extract Meet join URL
    const meetLink = res.data.conferenceData?.entryPoints
      ?.find(ep => ep.entryPointType === 'video')
      ?.uri || null;

    if (meetLink) {
      logger.info(`[GoogleMeet] Created Meet link for "${title}": ${meetLink}`);
    } else {
      logger.warn('[GoogleMeet] Event created but no Meet link returned');
    }

    return meetLink;
  } catch (err) {
    logger.error('[GoogleMeet] Failed to create Meet link:', err.message);
    return null; // non-fatal — don't block lead creation
  }
}

module.exports = { createMeetLink };
