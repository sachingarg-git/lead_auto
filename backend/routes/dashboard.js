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

module.exports = router;
