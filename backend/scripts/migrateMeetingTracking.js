/**
 * Migration: Add meeting lifecycle tracking columns + MeetingRescheduleLog table.
 * Run once: node scripts/migrateMeetingTracking.js
 */
const { query } = require('../config/database');
const logger    = require('../config/logger');

async function run() {
  console.log('Running meeting tracking migration…');

  // ── 1. Add columns to Leads (skip if already exist) ─────────
  const colChecks = [
    { col: 'meeting_status',        sql: "ALTER TABLE Leads ADD meeting_status NVARCHAR(20) NULL" },
    { col: 'meeting_started_at',    sql: "ALTER TABLE Leads ADD meeting_started_at DATETIME NULL" },
    { col: 'meeting_ended_at',      sql: "ALTER TABLE Leads ADD meeting_ended_at DATETIME NULL" },
    { col: 'meeting_delay_minutes', sql: "ALTER TABLE Leads ADD meeting_delay_minutes INT NULL" },
    { col: 'reschedule_count',      sql: "ALTER TABLE Leads ADD reschedule_count INT NOT NULL DEFAULT 0" },
  ];

  for (const { col, sql } of colChecks) {
    const exists = await query(
      `SELECT 1 AS c FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME='Leads' AND COLUMN_NAME=@col`,
      { col }
    );
    if (exists.recordset.length === 0) {
      await query(sql, {});
      console.log(`  ✅ Added column Leads.${col}`);
    } else {
      console.log(`  ⏭  Column Leads.${col} already exists`);
    }
  }

  // ── 2. MeetingRescheduleLog table ────────────────────────────
  const tableExists = await query(
    `SELECT 1 AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='MeetingRescheduleLog'`,
    {}
  );
  if (tableExists.recordset.length === 0) {
    await query(`
      CREATE TABLE MeetingRescheduleLog (
        id                   INT IDENTITY(1,1) PRIMARY KEY,
        lead_id              INT NOT NULL,
        old_meeting_datetime DATETIME NULL,
        old_slot_date        DATE NULL,
        old_slot_time        TIME NULL,
        new_meeting_datetime DATETIME NULL,
        new_slot_date        DATE NULL,
        new_slot_time        TIME NULL,
        reschedule_reason    NVARCHAR(500) NULL,
        reschedule_type      NVARCHAR(50) NULL,
        rescheduled_by_id    INT NULL,
        rescheduled_by_name  NVARCHAR(200) NULL,
        created_at           DATETIME NOT NULL DEFAULT GETDATE()
      )
    `, {});
    console.log('  ✅ Created table MeetingRescheduleLog');
  } else {
    console.log('  ⏭  Table MeetingRescheduleLog already exists');
  }

  console.log('Migration complete.');
  process.exit(0);
}

run().catch(err => {
  logger.error('Migration failed:', err);
  process.exit(1);
});
