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
          SUM(CASE WHEN welcome_sent=1 THEN 1 ELSE 0 END) AS welcome_sent
        FROM Leads
      `),

      // Most recent 10 leads
      query(`
        SELECT TOP 10 l.id, l.full_name, l.email, l.phone, l.status,
          l.client_type, l.source, l.created_at, u.name AS assigned_to_name
        FROM Leads l LEFT JOIN Users u ON l.assigned_to = u.id
        ORDER BY l.created_at DESC
      `),

      // Upcoming reminders (next 4h)
      query(`
        SELECT TOP 5 r.id, r.reminder_type, r.scheduled_at, r.channel,
          l.full_name, l.id AS lead_id
        FROM Reminders r JOIN Leads l ON r.lead_id = l.id
        WHERE r.status='Pending' AND r.scheduled_at BETWEEN GETDATE() AND DATEADD(HOUR, 4, GETDATE())
        ORDER BY r.scheduled_at ASC
      `),

      // 7-day lead trend
      query(`
        SELECT CAST(created_at AS DATE) AS date, COUNT(*) AS count
        FROM Leads
        WHERE created_at >= DATEADD(DAY, -7, GETDATE())
        GROUP BY CAST(created_at AS DATE)
        ORDER BY date ASC
      `),

      // Leads by source (all time)
      query(`
        SELECT source, COUNT(*) AS count,
          SUM(CASE WHEN status='Converted' THEN 1 ELSE 0 END) AS converted
        FROM Leads
        WHERE source IS NOT NULL
        GROUP BY source
        ORDER BY count DESC
      `),

      // Conversions by agent (kept for bar chart)
      query(`
        SELECT u.name AS agent_name, COUNT(*) AS converted
        FROM Leads l JOIN Users u ON l.assigned_to = u.id
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
        l.meeting_datetime          AS slot_dt,
        CAST(l.meeting_datetime AS DATE) AS slot_date_only,
        ISNULL(l.meeting_status, 'upcoming') AS meeting_status,
        ISNULL(l.reschedule_count, 0) AS reschedule_count
      FROM Leads l
      WHERE l.meeting_datetime IS NOT NULL
        AND CAST(l.meeting_datetime AS DATE) >= CAST(GETDATE() AS DATE)
        AND CAST(l.meeting_datetime AS DATE) < DATEADD(DAY, 31, CAST(GETDATE() AS DATE))
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
        ISNULL(l.meeting_status, 'upcoming') AS meeting_status,
        ISNULL(l.reschedule_count, 0) AS reschedule_count
      FROM Leads l
      WHERE l.meeting_datetime IS NULL
        AND l.slot_date IS NOT NULL
        AND TRY_CAST(l.slot_date AS DATE) >= CAST(GETDATE() AS DATE)
        AND TRY_CAST(l.slot_date AS DATE) < DATEADD(DAY, 31, CAST(GETDATE() AS DATE))
        AND l.status NOT IN ('Converted','Lost')
      ORDER BY TRY_CAST(l.slot_date AS DATE) ASC, l.slot_time ASC
    `);

    // Normalise both into a flat list: { lead_id, full_name, phone, company, status, date_key, time_str }
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    function dateKey(d) {
      // YYYY-MM-DD in LOCAL timezone (avoids UTC midnight shift in IST)
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
        lead_id:         r.lead_id,
        full_name:       r.full_name,
        phone:           r.phone,
        company:         r.company,
        status:          r.status,
        meeting_status:  r.meeting_status,
        reschedule_count: r.reschedule_count,
        date_key:        dateKey(d0),
        date_obj:        d0,
        // Store ISO datetime for 5-min alert on frontend
        slot_iso:        d.toISOString(),
        time_str:        d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }),
        sort_ts:         d.getTime(),
      });
    }

    for (const r of bySlotDate.recordset) {
      const parsed = r.slot_date ? new Date(r.slot_date) : null;
      if (!parsed || isNaN(parsed)) continue;
      parsed.setHours(0,0,0,0);
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
        time_str:  (() => {
          if (!r.slot_time) return null;
          // mssql TIME type → Date anchored at 1970-01-01 with time in UTC.
          // Use UTC methods so we read the stored time directly, not shifted by server TZ.
          const t  = new Date(r.slot_time);
          const hh = t.getUTCHours();
          const mm = String(t.getUTCMinutes()).padStart(2, '0');
          const ap = hh >= 12 ? 'PM' : 'AM';
          const h12 = hh % 12 || 12;
          return `${String(h12).padStart(2, '0')}:${mm} ${ap}`;
        })(),
        sort_ts:   parsed.getTime(),
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

    // Build ordered array: [ { date_key, label, items[] } ]
    const result = Object.entries(groups).map(([dk, its]) => {
      const d = its[0].date_obj;
      d.setHours(0,0,0,0);
      const todayTs    = today.getTime();
      const tomorrowTs = tomorrow.getTime();
      const dTs        = d.getTime();
      let label;
      if (dTs === todayTs)    label = 'Today';
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

module.exports = router;
