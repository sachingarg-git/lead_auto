-- ============================================================
--  Wizone LMS — Full Database Schema (MSSQL)
--  Run this on a fresh database. For existing DBs use:
--    scripts/add_slot_columns.sql  (adds slot_date / slot_time)
-- ============================================================

-- ── Roles ────────────────────────────────────────────────────
CREATE TABLE Roles (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  name        NVARCHAR(50)  NOT NULL UNIQUE,           -- Admin | Sales | Support
  permissions NVARCHAR(MAX) NOT NULL DEFAULT '[]',     -- JSON array of permission strings
  created_at  DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE Users (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  name         NVARCHAR(150) NOT NULL,
  email        NVARCHAR(255) NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  role_id      INT           NOT NULL REFERENCES Roles(id),
  is_active    BIT           NOT NULL DEFAULT 1,
  last_login   DATETIME2     NULL,
  created_at   DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Lead Sources ─────────────────────────────────────────────
--  source_type: 'meta' | 'landing_page'
CREATE TABLE LeadSources (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  name         NVARCHAR(150) NOT NULL UNIQUE,
  source_type  NVARCHAR(30)  NOT NULL,                 -- meta | landing_page
  api_key      NVARCHAR(100) NULL UNIQUE,              -- wz_<uuid> for landing_page
  config       NVARCHAR(MAX) NULL,                     -- reserved JSON field
  column_map   NVARCHAR(MAX) NULL,                     -- JSON: { "your_col": "our_field" }
  is_active    BIT           NOT NULL DEFAULT 1,
  last_synced  DATETIME2     NULL,
  sync_count   INT           NOT NULL DEFAULT 0,
  created_at   DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Leads  ───────────────────────────────────────────────────
--  Central table. Every source (Meta webhook, Landing Page API)
--  writes here. slot_date + slot_time hold structured booking data.
CREATE TABLE Leads (
  id               INT IDENTITY(1,1) PRIMARY KEY,

  -- Contact info
  full_name        NVARCHAR(255) NOT NULL,
  email            NVARCHAR(255) NULL,
  phone            NVARCHAR(30)  NULL,
  whatsapp_number  NVARCHAR(30)  NULL,
  telegram_chat_id NVARCHAR(100) NULL,

  -- Source tracking
  source           NVARCHAR(150) NULL,                 -- name of LeadSource
  api_key_used     NVARCHAR(100) NULL,
  meta_lead_id     NVARCHAR(100) NULL,
  ad_id            NVARCHAR(100) NULL,
  ad_name          NVARCHAR(255) NULL,
  campaign_id      NVARCHAR(100) NULL,
  campaign_name    NVARCHAR(255) NULL,
  form_data        NVARCHAR(MAX) NULL,                 -- raw JSON from Meta form

  -- Lead classification
  status           NVARCHAR(30)  NOT NULL DEFAULT 'New',
                   -- New | FollowUp | DemoGiven | Converted | Lost | Nurture
  client_type      NVARCHAR(10)  NOT NULL DEFAULT 'Type2',
                   -- Type1 = meeting booked, Type2 = drip follow-up

  -- Slot / Appointment Booking  ← CORE FIELDS
  slot_date        DATE          NULL,   -- e.g. 2025-05-20
  slot_time        TIME          NULL,   -- e.g. 14:30:00
  preferred_slot   NVARCHAR(100) NULL,   -- combined display string "2025-05-20 14:30"

  -- Meeting (set after manual booking in LMS)
  meeting_datetime DATETIME2     NULL,
  meeting_link     NVARCHAR(500) NULL,

  -- Additional info
  company          NVARCHAR(255) NULL,
  industry         NVARCHAR(255) NULL,
  tags             NVARCHAR(500) NULL,
  notes            NVARCHAR(MAX) NULL,

  -- Automation tracking
  welcome_sent     BIT           NOT NULL DEFAULT 0,
  contact_count    INT           NOT NULL DEFAULT 0,
  last_contacted   DATETIME2     NULL,

  -- Assignment
  assigned_to      INT           NULL REFERENCES Users(id),

  created_at       DATETIME2     NOT NULL DEFAULT GETDATE(),
  updated_at       DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Useful indexes ────────────────────────────────────────────
CREATE INDEX IX_Leads_status     ON Leads(status);
CREATE INDEX IX_Leads_source     ON Leads(source);
CREATE INDEX IX_Leads_phone      ON Leads(phone);
CREATE INDEX IX_Leads_slot_date  ON Leads(slot_date);
CREATE INDEX IX_Leads_created_at ON Leads(created_at DESC);

-- ── Lead Status History ───────────────────────────────────────
CREATE TABLE LeadStatusHistory (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  lead_id    INT           NOT NULL REFERENCES Leads(id) ON DELETE CASCADE,
  old_status NVARCHAR(30)  NULL,
  new_status NVARCHAR(30)  NOT NULL,
  changed_by INT           NULL REFERENCES Users(id),
  note       NVARCHAR(500) NULL,
  changed_at DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Reminders ────────────────────────────────────────────────
CREATE TABLE Reminders (
  id             INT IDENTITY(1,1) PRIMARY KEY,
  lead_id        INT           NOT NULL REFERENCES Leads(id) ON DELETE CASCADE,
  reminder_type  NVARCHAR(50)  NOT NULL,
  channel        NVARCHAR(30)  NOT NULL DEFAULT 'whatsapp',
  status         NVARCHAR(20)  NOT NULL DEFAULT 'Pending',
                 -- Pending | Sent | Failed | Skipped
  scheduled_at   DATETIME2     NOT NULL,
  sent_at        DATETIME2     NULL,
  error_message  NVARCHAR(MAX) NULL,
  created_at     DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_Reminders_lead_id      ON Reminders(lead_id);
CREATE INDEX IX_Reminders_scheduled_at ON Reminders(scheduled_at);
CREATE INDEX IX_Reminders_status       ON Reminders(status);

-- ── Webhook Events (Meta raw payloads) ────────────────────────
CREATE TABLE WebhookEvents (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  event_type NVARCHAR(50)  NOT NULL,
  payload    NVARCHAR(MAX) NOT NULL,
  processed  BIT           NOT NULL DEFAULT 0,
  created_at DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Communication Logs ────────────────────────────────────────
CREATE TABLE CommunicationLogs (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  lead_id     INT           NOT NULL REFERENCES Leads(id) ON DELETE CASCADE,
  channel     NVARCHAR(30)  NOT NULL,    -- whatsapp | email | telegram | sms
  direction   NVARCHAR(10)  NOT NULL DEFAULT 'out',
  message     NVARCHAR(MAX) NULL,
  status      NVARCHAR(20)  NOT NULL DEFAULT 'sent',
  provider_id NVARCHAR(200) NULL,
  created_at  DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Seed Roles ────────────────────────────────────────────────
INSERT INTO Roles (name, permissions) VALUES
  ('Admin',   '["*"]'),
  ('Sales',   '["leads:read","leads:write","leads:status","reminders:read"]'),
  ('Support', '["leads:read","reminders:read"]');
