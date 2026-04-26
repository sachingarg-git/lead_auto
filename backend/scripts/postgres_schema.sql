-- ============================================================
--  Wizone LMS — PostgreSQL Schema
--  Converted from MSSQL. Run ONCE on the target PostgreSQL DB.
-- ============================================================

-- ── Roles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Roles" (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  permissions TEXT         NOT NULL DEFAULT '[]',
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Users" (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT          NOT NULL REFERENCES "Roles"(id),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  avatar_url    VARCHAR(500) NULL,
  created_by    INT          NULL,
  last_login    TIMESTAMP    NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP    NULL,
  -- 2FA columns
  green_pin     VARCHAR(255) NULL,
  pin_enabled   BOOLEAN      NOT NULL DEFAULT FALSE
);

-- ── Lead Sources ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadSources" (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL UNIQUE,
  source_type  VARCHAR(30)  NOT NULL,
  api_key      VARCHAR(100) NULL UNIQUE,
  config       TEXT         NULL,
  column_map   TEXT         NULL,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  last_synced  TIMESTAMP    NULL,
  sync_count   INT          NOT NULL DEFAULT 0,
  last_sync_id VARCHAR(100) NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Leads ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Leads" (
  id               SERIAL PRIMARY KEY,
  full_name        VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NULL,
  phone            VARCHAR(30)  NULL,
  whatsapp_number  VARCHAR(30)  NULL,
  telegram_chat_id VARCHAR(100) NULL,
  source           VARCHAR(150) NULL,
  api_key_used     VARCHAR(100) NULL,
  meta_lead_id     VARCHAR(100) NULL,
  ad_id            VARCHAR(100) NULL,
  ad_name          VARCHAR(255) NULL,
  campaign_id      VARCHAR(100) NULL,
  campaign_name    VARCHAR(255) NULL,
  form_data        TEXT         NULL,
  status           VARCHAR(30)  NOT NULL DEFAULT 'New',
  client_type      VARCHAR(10)  NOT NULL DEFAULT 'Type2',
  slot_date        DATE         NULL,
  slot_time        TIME         NULL,
  preferred_slot   VARCHAR(100) NULL,
  meeting_datetime TIMESTAMP    NULL,
  meeting_link     VARCHAR(500) NULL,
  company          VARCHAR(255) NULL,
  industry         VARCHAR(255) NULL,
  tags             VARCHAR(500) NULL,
  notes            TEXT         NULL,
  welcome_sent           BOOLEAN      NOT NULL DEFAULT FALSE,
  contact_count          INT          NOT NULL DEFAULT 0,
  last_contacted         TIMESTAMP    NULL,
  assigned_to            INT          NULL REFERENCES "Users"(id),
  created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
  -- Meeting tracking columns
  meeting_status         VARCHAR(20)  NULL,
  meeting_started_at     TIMESTAMP    NULL,
  meeting_ended_at       TIMESTAMP    NULL,
  meeting_delay_minutes  INT          NULL,
  reschedule_count       INT          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS IX_Leads_status     ON "Leads"(status);
CREATE INDEX IF NOT EXISTS IX_Leads_source     ON "Leads"(source);
CREATE INDEX IF NOT EXISTS IX_Leads_phone      ON "Leads"(phone);
CREATE INDEX IF NOT EXISTS IX_Leads_slot_date  ON "Leads"(slot_date);
CREATE INDEX IF NOT EXISTS IX_Leads_created_at ON "Leads"(created_at DESC);

-- ── Follow Ups ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FollowUps" (
  id                 SERIAL PRIMARY KEY,
  lead_id            INT          NOT NULL REFERENCES "Leads"(id) ON DELETE CASCADE,
  status             VARCHAR(30)  NULL,
  note               TEXT         NULL,
  next_followup_date DATE         NULL,
  created_by         INT          NULL REFERENCES "Users"(id),
  created_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Lead Status History ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadStatusHistory" (
  id         SERIAL PRIMARY KEY,
  lead_id    INT          NOT NULL REFERENCES "Leads"(id) ON DELETE CASCADE,
  old_status VARCHAR(30)  NULL,
  new_status VARCHAR(30)  NOT NULL,
  changed_by INT          NULL REFERENCES "Users"(id),
  note       VARCHAR(500) NULL,
  changed_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Reminders ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Reminders" (
  id             SERIAL PRIMARY KEY,
  lead_id        INT          NOT NULL REFERENCES "Leads"(id) ON DELETE CASCADE,
  reminder_type  VARCHAR(50)  NOT NULL,
  channel        VARCHAR(30)  NOT NULL DEFAULT 'All',
  status         VARCHAR(20)  NOT NULL DEFAULT 'Pending',
  scheduled_at   TIMESTAMP    NOT NULL,
  sent_at        TIMESTAMP    NULL,
  error_log      TEXT         NULL,
  error_message  TEXT         NULL,
  retry_count    INT          NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
  -- Extra columns carried from MSSQL
  message_body   TEXT         NULL,
  bull_job_id    VARCHAR(100) NULL,
  updated_at     TIMESTAMP    NULL
);

CREATE INDEX IF NOT EXISTS IX_Reminders_lead_id      ON "Reminders"(lead_id);
CREATE INDEX IF NOT EXISTS IX_Reminders_scheduled_at ON "Reminders"(scheduled_at);
CREATE INDEX IF NOT EXISTS IX_Reminders_status       ON "Reminders"(status);

-- ── Webhook Events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WebhookEvents" (
  id         SERIAL PRIMARY KEY,
  event_type VARCHAR(50)  NOT NULL,
  payload    TEXT         NOT NULL,
  processed  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Communication Logs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CommunicationLogs" (
  id          SERIAL PRIMARY KEY,
  lead_id     INT          NOT NULL REFERENCES "Leads"(id) ON DELETE CASCADE,
  reminder_id INT          NULL REFERENCES "Reminders"(id) ON DELETE SET NULL,
  channel     VARCHAR(30)  NOT NULL,
  direction   VARCHAR(10)  NOT NULL DEFAULT 'out',
  message     TEXT         NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'sent',
  provider_id VARCHAR(200) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  sent_at     TIMESTAMP    NULL
);

-- ── App Settings (key/value store) ───────────────────────────
CREATE TABLE IF NOT EXISTS "AppSettings" (
  id         SERIAL PRIMARY KEY,
  key_name   VARCHAR(100) NOT NULL UNIQUE,
  val        TEXT         NULL,
  updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Lead Activity Log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadActivityLog" (
  id          SERIAL PRIMARY KEY,
  lead_id     INT          NOT NULL REFERENCES "Leads"(id) ON DELETE CASCADE,
  action_type VARCHAR(50)  NOT NULL DEFAULT 'edit',
  field_name  VARCHAR(100) NULL,
  old_value   TEXT         NULL,
  new_value   TEXT         NULL,
  note        TEXT         NULL,
  created_by  INT          NULL REFERENCES "Users"(id),
  actor_name  VARCHAR(150) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── Seed Roles (only if empty) ────────────────────────────────
INSERT INTO "Roles" (name, permissions)
SELECT name, permissions FROM (VALUES
  ('Admin',   '["*"]'),
  ('Sales',   '["leads:read","leads:write","leads:status","reminders:read"]'),
  ('Support', '["leads:read","reminders:read"]')
) AS t(name, permissions)
WHERE NOT EXISTS (SELECT 1 FROM "Roles");
