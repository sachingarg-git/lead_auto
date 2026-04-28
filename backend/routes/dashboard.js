const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { query } = require('../config/database');
const logger = require('../config/logger');

router.use(authenticate, authorize('leads:read'));

// Main dashboard summary
router.get('/summary', async (req, res) => {
  try {
    const [statsRes, recentRes, upcomingRes, trendRes, sourceRes, convRes] = await Promise.all([
      // Overall stats
      query(`
        SELECT
          COUNT(*) AS total_leads,
          SUM(CASE WHEN status='New' THEN 1 ELSE 0 END) AS new_leads,
          SUM(CASE WHEN status='Converted' THEN 1 ELSE 0 END) AS converted,
          SUM(CASE WHEN status='Lost' THEN 1 ELSE 0 END) AS lost,
          SUM(CASE WHEN client_type='Type1' THEN 1 ELSE 0 END) AS meeting_booked,
          SUM(CASE WHEN welcome_sent = true THEN 1 ELSE 0 END) AS welcome_sent
        FROM "Leads"
      `),

      // Most recent 10 leads
      query(`
        SELECT l.id, l.full_name, l.email, l.phone, l.status,
          l.client_type, l.source, l.created_at, u.name AS assigned_to_name
        FROM "Leads" l LEFT JOIN "Users" u ON l.assigned_to = u.id
        ORDER BY l.created_at DESC
        LIMIT 10
      `),

      // Upcoming reminders (next 4h)
      query(`
        SELECT r.id, r.reminder_type, r.scheduled_at, r.channel,
          l.full_name, l.id AS lead_id
        FROM "Reminders" r JOIN "Leads" l ON r.lead_id = l.id
        WHERE r.status='Pending'
          AND r.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '4 hours'
        ORDER BY r.scheduled_at ASC
        LIMIT 5
      `),

      // 7-day lead trend
      query(`
        SELECT created_at::date AS date, COUNT(*) AS count
        FROM "Leads"
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY created_at::date
        ORDER BY date ASC
      `),

      // Leads by source (all time)
      query(`
        SELECT source, COUNT(*) AS count,
          SUM(CASE WHEN status='Converted' THEN 1 ELSE 0 END) AS converted
        FROM "Leads"
        WHERE source IS NOT NULL
        GROUP BY source
        ORDER BY count DESC
      `),

      // Conversions by agent (kept for bar chart)
      query(`
        SELECT u.name AS agent_name, COUNT(*) AS converted
        FROM "Leads" l JOIN "Users" u ON l.assigned_to = u.id
        WHERE l.status = 'Converted'
        GROUP BY u.name
        ORDER BY converted DESC
      `),
    ]);

    res.json({
      stats: {
        ...statsRes.recordset[0],
        conversionByUser: convRes.recordset,
      },
      recentLeads:       recentRes.recordset,
      upcomingReminders: upcomingRes.recordset,
      leadTrend:         trendRes.recordset,
      leadsBySource:     sourceRes.recordset,
    });
  } catch (err) {
    logger.error('dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Schedule: only slot-booked leads, grouped by calendar date (30-day window)
router.get('/schedule', async (req, res) => {
  try {
    // Leads with a confirmed meeting_datetime (Type1 - slot booked)
    const byDatetime = await query(`
      SELECT
        l.id   AS lead_id,
        l.full_name,
        l.phone,
        l.company,
        l.status,
        l.source,
        l.meeting_datetime                          AS slot_dt,
        l.meeting_datetime::date                    AS slot_date_only,
        COALESCE(l.meeting_status, 'upcoming')      AS meeting_status,
        COALESCE(l.reschedule_count, 0)             AS reschedule_count
      FROM "Leads" l
      WHERE l.meeting_datetime IS NOT NULL
        AND l.meeting_datetime::date >= CURRENT_DATE
        AND l.meeting_datetime::date <  CURRENT_DATE + INTERVAL '31 days'
        AND l.status NOT IN ('Converted','Lost')
      ORDER BY l.meeting_datetime ASC
    `);

    // Leads with only slot_date / slot_time (no meeting_datetime parsed yet)
    const bySlotDate = await query(`
      SELECT
        l.id   AS lead_id,
        l.full_name,
        l.phone,
        l.company,
        l.status,
        l.source,
        l.slot_date,
        l.slot_time,
        COALESCE(l.meeting_status, 'upcoming')  AS meeting_status,
        COALESCE(l.reschedule_count, 0)         AS reschedule_count
      FROM "Leads" l
      WHERE l.meeting_datetime IS NULL
        AND l.slot_date IS NOT NULL
        AND l.slot_date >= CURRENT_DATE
        AND l.slot_date <  CURRENT_DATE + INTERVAL '31 days'
        AND l.status NOT IN ('Converted','Lost')
      ORDER BY l.slot_date ASC, l.slot_time ASC
    `);

    // Normalise both into a flat list
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    function dateKey(d) {
      const y   = d.getFullYear();
      const m   = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    const items = [];

    for (const r of byDatetime.recordset) {
      const d = new Date(r.slot_dt);
      const d0 = new Date(d); d0.setHours(0,0,0,0);
      items.push({
        lead_id:          r.lead_id,
        full_name:        r.full_name,
        phone:            r.phone,
        company:          r.company,
        status:           r.status,
        meeting_status:   r.meeting_status,
        reschedule_count: r.reschedule_count,
        date_key:         dateKey(d0),
        date_obj:         d0,
        slot_iso:         d.toISOString(),
        time_str:         d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }),
        sort_ts:          d.getTime(),
      });
    }

    for (const r of bySlotDate.recordset) {
      const parsed = r.slot_date ? new Date(r.slot_date) : null;
      if (!parsed || isNaN(parsed)) continue;
      parsed.setHours(0,0,0,0);

      // PostgreSQL TIME columns are returned as "HH:MM:SS" strings
      const timeStr = (() => {
        if (!r.slot_time) return null;
        const t = String(r.slot_time);
        const parts = t.split(':');
        const hh = parseInt(parts[0], 10);
        const mm = (parts[1] || '00').substring(0, 2);
        const ap = hh >= 12 ? 'PM' : 'AM';
        const h12 = hh % 12 || 12;
        return `${String(h12).padStart(2,'0')}:${mm} ${ap}`;
      })();

      items.push({
        lead_id:          r.lead_id,
        full_name:        r.full_name,
        phone:            r.phone,
        company:          r.company,
        status:           r.status,
        meeting_status:   r.meeting_status,
        reschedule_count: r.reschedule_count,
        date_key:         dateKey(parsed),
        date_obj:         parsed,
        slot_iso:         null,
        time_str:         timeStr,
        sort_ts:          parsed.getTime(),
      });
    }

    // Sort all by date+time
    items.sort((a, b) => a.sort_ts - b.sort_ts);

    // Group by date_key
    const groups = {};
    for (const item of items) {
      if (!groups[item.date_key]) groups[item.date_key] = [];
      groups[item.date_key].push(item);
    }

    // Build ordered array
    const result = Object.entries(groups).map(([dk, its]) => {
      const d = its[0].date_obj;
      d.setHours(0,0,0,0);
      const todayTs    = today.getTime();
      const tomorrowTs = tomorrow.getTime();
      const dTs        = d.getTime();
      let label;
      if (dTs === todayTs)         label = 'Today';
      else if (dTs === tomorrowTs) label = 'Tomorrow';
      else label = d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });

      return { date_key: dk, label, items: its };
    });

    res.json(result);
  } catch (err) {
    logger.error('schedule error:', err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Assignment overview — leads per agent + unassigned count
router.get('/assignment', async (req, res) => {
  try {
    const r = await query(`
      SELECT
        COALESCE(u.name, 'Unassigned')          AS agent_name,
        COALESCE(u.id::text, 'none')            AS agent_key,
        COUNT(l.id)::int                        AS lead_count
      FROM "Leads" l
      LEFT JOIN "Users" u ON l.assigned_to = u.id
      WHERE l.status NOT IN ('Converted', 'Lost', 'Nurture')
      GROUP BY u.id, u.name, l.assigned_to
      ORDER BY
        CASE WHEN l.assigned_to IS NULL THEN 1 ELSE 0 END ASC,
        lead_count DESC
    `);
    res.json(r.recordset || []);
  } catch (err) {
    logger.error('assignment overview error:', err);
    res.status(500).json({ error: 'Failed to fetch assignment data' });
  }
});

module.exports = router;
