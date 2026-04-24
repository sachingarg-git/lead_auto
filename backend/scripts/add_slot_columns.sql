-- ============================================================
--  Migration: Add slot_date and slot_time to existing Leads table
--  Run ONCE on your existing database.
-- ============================================================

-- Add slot_date (DATE) column
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Leads') AND name = 'slot_date'
)
  ALTER TABLE Leads ADD slot_date DATE NULL;

-- Add slot_time (TIME) column
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Leads') AND name = 'slot_time'
)
  ALTER TABLE Leads ADD slot_time TIME NULL;

-- Add index for slot_date queries
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Leads') AND name = 'IX_Leads_slot_date'
)
  CREATE INDEX IX_Leads_slot_date ON Leads(slot_date);

PRINT 'Migration complete: slot_date and slot_time columns added to Leads table.';
