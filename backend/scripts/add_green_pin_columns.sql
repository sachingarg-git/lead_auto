-- ============================================================
--  Migration: Add Green PIN 2FA columns to Users table
--  Run once against your live lead_management database.
--  Safe to run on a DB that already has the columns (IF NOT EXISTS).
-- ============================================================

-- 2FA PIN hash (bcrypt, always 60 chars)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'green_pin'
)
BEGIN
  ALTER TABLE Users ADD green_pin NVARCHAR(100) NULL;
  PRINT 'Column green_pin added to Users.';
END
ELSE
  PRINT 'Column green_pin already exists — skipped.';

-- Flag: 1 = PIN enabled, 0 = no PIN (password-only login)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'pin_enabled'
)
BEGIN
  ALTER TABLE Users ADD pin_enabled BIT NOT NULL DEFAULT 0;
  PRINT 'Column pin_enabled added to Users.';
END
ELSE
  PRINT 'Column pin_enabled already exists — skipped.';

-- Avatar URL (used in findById query)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'avatar_url'
)
BEGIN
  ALTER TABLE Users ADD avatar_url NVARCHAR(500) NULL;
  PRINT 'Column avatar_url added to Users.';
END
ELSE
  PRINT 'Column avatar_url already exists — skipped.';

PRINT 'Migration complete.';
