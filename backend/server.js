require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const logger = require('./config/logger');
const { getPool } = require('./config/database');
const { startReminderWorker } = require('./jobs/reminderWorker');
const { startFollowUpWorker } = require('./jobs/followUpWorker');
const { startExternalSyncScheduler } = require('./services/externalDbSync');
const { initTelegramBot } = require('./services/telegramBot');

// Routes
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const userRoutes = require('./routes/users');
const reminderRoutes = require('./routes/reminders');
const webhookRoutes = require('./routes/webhook');
const dashboardRoutes = require('./routes/dashboard');
const sourcesRoutes = require('./routes/sources');
const captureRoutes  = require('./routes/capture');
const settingsRoutes = require('./routes/settings');
const meetingRoutes  = require('./routes/meetings');
const internalRoutes = require('./routes/internal');

// Ensure log directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const app = express();
const httpServer = http.createServer(app);

// ── Socket.io (real-time lead feed) ──────────────────────────
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
});
app.set('io', io); // make io accessible in controllers

io.on('connection', (socket) => {
  logger.debug(`Socket connected: ${socket.id}`);
  socket.on('join:dashboard', () => socket.join('dashboard'));
  socket.on('disconnect', () => logger.debug(`Socket disconnected: ${socket.id}`));
});

// ── Security Middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow any localhost port in development, or the configured FRONTEND_URL in production
    const allowed = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (!origin || origin === allowed || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// Rate limiting — global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// Raw body for Meta webhook signature verification (MUST be before json parser for /webhook)
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// JSON parser for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/leads',     leadRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/webhook',   webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sources',   sourcesRoutes);
app.use('/api/capture',   captureRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/meetings',  meetingRoutes);
app.use('/api/internal', internalRoutes);  // landing-page → LMS automation bridge

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'WizoneLMS' });
});

// ── 404 & Error Handlers ──────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Startup ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

/** Ensure 2FA columns exist — safe to run on every startup (PostgreSQL ADD COLUMN IF NOT EXISTS) */
async function runStartupMigrations(pool) {
  try {
    // green_pin — bcrypt hash of the user's PIN
    await pool.query(`ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS green_pin VARCHAR(100) NULL`);
    // pin_enabled — true means 2FA is active for this account
    await pool.query(`ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS pin_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
    // avatar_url — optional profile picture
    await pool.query(`ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL`);

    // EmailTemplates
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "EmailTemplates" (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(200)  NOT NULL,
        subject     VARCHAR(500)  NOT NULL DEFAULT '',
        body        TEXT          NOT NULL DEFAULT '',
        is_default  BOOLEAN       NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "SourceTemplateMap" (
        source       VARCHAR(150) PRIMARY KEY,
        template_id  INTEGER REFERENCES "EmailTemplates"(id) ON DELETE SET NULL
      )
    `);

    // MeetingRescheduleLog — stores history of every reschedule
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "MeetingRescheduleLog" (
        id                    SERIAL PRIMARY KEY,
        lead_id               INTEGER NOT NULL,
        old_meeting_datetime  TIMESTAMPTZ,
        old_slot_date         DATE,
        old_slot_time         TIME,
        new_meeting_datetime  TIMESTAMPTZ,
        new_slot_date         DATE,
        new_slot_time         TIME,
        reschedule_reason     TEXT,
        reschedule_type       VARCHAR(50),
        rescheduled_by_id     INTEGER,
        rescheduled_by_name   VARCHAR(200),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Seed default templates (only if table is empty) ────────
    const { rows: countRows } = await pool.query(`SELECT COUNT(*) AS cnt FROM "EmailTemplates"`);
    if (parseInt(countRows[0].cnt) === 0) {
      const templates = [
        {
          name      : '🎉 Welcome — Slot Booked',
          subject   : 'Your Demo is Confirmed, {{full_name}}! 🎉',
          body      :
`Hi {{full_name}},

Thank you for booking your Wizone AI demo! We're excited to show you what's possible.

📅 Your Appointment
Date: {{slot_date}}
Time: {{slot_time}} IST

{{#if meet_link}}
🎥 Join your Google Meet session:
{{meet_link}}
{{/if}}

Please keep this link handy and join 2–3 minutes before your session begins.

If you need to reschedule or have any questions, just reply to this email.

See you soon! 🚀
{{company_name}} Team`,
          is_default: true,
        },
        {
          name      : '👋 Welcome — General Enquiry',
          subject   : 'We received your enquiry, {{full_name}}!',
          body      :
`Hi {{full_name}},

Thank you for reaching out to {{company_name}}! We've received your enquiry and our team will get back to you within 24 hours.

{{#if company}}
We look forward to learning more about {{company}} and how we can help.
{{/if}}

In the meantime, feel free to reply to this email with any questions.

Warm regards,
{{company_name}} Team`,
          is_default: false,
        },
        {
          name      : '🔔 Demo Reminder',
          subject   : 'Reminder: Your Wizone AI Demo is Tomorrow, {{full_name}}',
          body      :
`Hi {{full_name}},

Just a quick reminder that your Wizone AI demo is scheduled for:

📅 Date: {{slot_date}}
⏰ Time: {{slot_time}} IST

{{#if meet_link}}
🎥 Google Meet link:
{{meet_link}}
{{/if}}

Tips for a great session:
• Join 2 minutes early
• Have a stable internet connection
• Keep a notepad handy for questions

We're looking forward to speaking with you!

{{company_name}} Team`,
          is_default: false,
        },
        {
          name      : '📞 Follow-up — Day 1',
          subject   : 'Following up on your enquiry, {{full_name}}',
          body      :
`Hi {{full_name}},

We noticed you reached out to us recently and wanted to follow up personally.

At {{company_name}}, we help businesses like yours automate lead management, track conversions, and close more deals — all from one place.

Would you be open to a quick 15-minute call this week? We'd love to understand your needs and show you how we can help.

Reply to this email or let us know a good time to connect.

Best regards,
{{company_name}} Team`,
          is_default: false,
        },
        {
          name      : '✅ Demo Done — Next Steps',
          subject   : 'Great connecting with you, {{full_name}}! Here\'s what\'s next',
          body      :
`Hi {{full_name}},

It was wonderful speaking with you today! We hope the demo gave you a clear picture of how {{company_name}} can transform your lead management process.

Here's a quick recap of what we discussed:
• Automated lead capture from multiple sources
• Smart follow-up scheduling
• Real-time pipeline tracking
• WhatsApp & Email automation

📌 Next Steps
Our team will send you a detailed proposal within 24 hours. In the meantime, feel free to reply with any questions.

We're excited about the possibility of working together!

Warm regards,
{{company_name}} Team`,
          is_default: false,
        },
        {
          name      : '💬 Nurture — Last Follow-up',
          subject   : 'One last thought for you, {{full_name}}',
          body      :
`Hi {{full_name}},

I know you're busy, so I'll keep this short.

We've been helping businesses automate their sales pipeline and we'd love to do the same for you{{#if company}} at {{company}}{{/if}}.

If the timing isn't right right now — no worries at all. Just reply with "later" and I'll check back in next quarter.

But if you're still interested, I'm happy to schedule a quick 10-minute call at your convenience.

Either way, wishing you a great week ahead!

{{company_name}} Team`,
          is_default: false,
        },
      ];

      for (const tpl of templates) {
        await pool.query(
          `INSERT INTO "EmailTemplates" (name, subject, body, is_default) VALUES ($1, $2, $3, $4)`,
          [tpl.name, tpl.subject, tpl.body, tpl.is_default]
        );
      }
      logger.info(`Startup: seeded ${templates.length} default email templates`);
    }
    // ────────────────────────────────────────────────────────────

    logger.info('Startup migrations: Users 2FA columns verified');
  } catch (err) {
    logger.warn('Startup migration warning (non-fatal):', err.message);
  }
}

async function start() {
  try {
    const pool = await getPool();
    logger.info('Database connected');

    await runStartupMigrations(pool);

    startReminderWorker();
    startFollowUpWorker();
    startExternalSyncScheduler();
    initTelegramBot();
    logger.info('Background workers started');

    // ── Auto-heal: generate Meet links for any slotted leads that missed them ──
    // Runs once at startup — catches leads that were booked while server was down
    setImmediate(async () => {
      try {
        const { createMeetLink } = require('./services/googleMeetService');
        const missed = await pool.query(
          `SELECT id, full_name, slot_date, slot_time, email
           FROM "Leads"
           WHERE slot_date IS NOT NULL
             AND slot_time IS NOT NULL
             AND (meeting_link IS NULL OR meeting_link = '')
           LIMIT 50`
        );
        if (missed.rows.length > 0) {
          logger.info(`[Startup] Auto-generating Meet links for ${missed.rows.length} lead(s) that missed automation`);
          for (const lead of missed.rows) {
            try {
              const meetLink = await createMeetLink({
                title        : `Wizone AI Demo — ${lead.full_name}`,
                slotDate     : lead.slot_date,
                slotTime     : lead.slot_time,
                durationMins : 60,
                attendeeEmail: lead.email || undefined,
              });
              if (meetLink) {
                await pool.query(`UPDATE "Leads" SET meeting_link=$1 WHERE id=$2`, [meetLink, lead.id]);
                logger.info(`[Startup] Meet link healed for lead ${lead.id} (${lead.full_name}): ${meetLink}`);
              }
            } catch (e) {
              logger.warn(`[Startup] Meet link heal failed for lead ${lead.id}:`, e.message);
            }
          }
        }
      } catch (e) {
        logger.warn('[Startup] Meet link auto-heal skipped:', e.message);
      }
    });

    httpServer.listen(PORT, () => {
      logger.info(`Wizone LMS backend running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down...');
  const { closePool } = require('./config/database');
  await closePool();
  process.exit(0);
});
