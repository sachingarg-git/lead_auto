-- ============================================================
-- WIZONE LEAD MANAGEMENT SYSTEM - MSSQL SCHEMA
-- Version: 1.0.0
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'lead_management')
    CREATE DATABASE lead_management;
GO

USE lead_management;
GO

-- ============================================================
-- TABLE: Roles
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Roles' AND xtype='U')
CREATE TABLE Roles (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(50) NOT NULL UNIQUE,   -- 'Admin','Sales','Support'
    permissions NVARCHAR(MAX) NOT NULL,          -- JSON: ["leads:read","leads:write",...]
    created_at  DATETIME2 DEFAULT GETDATE()
);
GO

-- Seed default roles
INSERT INTO Roles (name, permissions) VALUES
    ('Admin',   '["*"]'),
    ('Sales',   '["leads:read","leads:write","leads:status","reminders:read","reminders:write"]'),
    ('Support', '["leads:read","reminders:read"]');
GO

-- ============================================================
-- TABLE: Users  (internal team members)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
CREATE TABLE Users (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(100) NOT NULL,
    email         NVARCHAR(150) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    role_id       INT NOT NULL REFERENCES Roles(id),
    is_active     BIT DEFAULT 1,
    avatar_url    NVARCHAR(500) NULL,
    created_by    INT NULL REFERENCES Users(id),
    last_login    DATETIME2 NULL,
    created_at    DATETIME2 DEFAULT GETDATE(),
    updated_at    DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- TABLE: Leads
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Leads' AND xtype='U')
CREATE TABLE Leads (
    id              INT IDENTITY(1,1) PRIMARY KEY,

    -- Contact Info
    full_name       NVARCHAR(150) NOT NULL,
    email           NVARCHAR(150) NULL,
    phone           NVARCHAR(30)  NULL,
    whatsapp_number NVARCHAR(30)  NULL,
    telegram_chat_id NVARCHAR(50) NULL,

    -- Source & Segmentation
    source          NVARCHAR(50)  NOT NULL DEFAULT 'Meta',  -- 'Meta','Manual','Landing'
    meta_lead_id    NVARCHAR(100) NULL UNIQUE,              -- from Meta webhook
    ad_id           NVARCHAR(100) NULL,
    ad_name         NVARCHAR(200) NULL,
    campaign_id     NVARCHAR(100) NULL,
    campaign_name   NVARCHAR(200) NULL,
    form_data       NVARCHAR(MAX) NULL,                     -- raw JSON from Meta form

    -- Client Type (matches your flow diagram)
    client_type     NVARCHAR(10)  NOT NULL DEFAULT 'Type2', -- 'Type1'=booked,'Type2'=not booked
    meeting_datetime DATETIME2    NULL,                     -- set when Type1 books slot
    meeting_link    NVARCHAR(500) NULL,

    -- CRM Status
    status          NVARCHAR(30)  NOT NULL DEFAULT 'New',
    -- Values: New | FollowUp | DemoGiven | Converted | Lost | Nurture

    assigned_to     INT NULL REFERENCES Users(id),
    notes           NVARCHAR(MAX) NULL,
    tags            NVARCHAR(500) NULL,                     -- comma-separated

    -- Communication flags
    welcome_sent    BIT DEFAULT 0,
    last_contacted  DATETIME2 NULL,
    contact_count   INT DEFAULT 0,

    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);
GO

-- Index for fast webhook dedup lookup
CREATE INDEX IX_Leads_MetaLeadId ON Leads(meta_lead_id) WHERE meta_lead_id IS NOT NULL;
CREATE INDEX IX_Leads_Status ON Leads(status);
CREATE INDEX IX_Leads_AssignedTo ON Leads(assigned_to);
CREATE INDEX IX_Leads_ClientType ON Leads(client_type);
GO

-- ============================================================
-- TABLE: Reminders
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Reminders' AND xtype='U')
CREATE TABLE Reminders (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    lead_id         INT NOT NULL REFERENCES Leads(id) ON DELETE CASCADE,

    reminder_type   NVARCHAR(50) NOT NULL,
    -- Type1: '4_days_before' | 'same_day_9am' | '30_min_before' | 'post_meeting'
    -- Type2: 'immediate' | 'day_1' | 'day_3' | 'day_5' | 'day_7' | 'nurture'

    scheduled_at    DATETIME2 NOT NULL,
    sent_at         DATETIME2 NULL,
    status          NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending|Sent|Failed|Skipped
    channel         NVARCHAR(20) NOT NULL,                   -- WhatsApp|Email|Call|All
    message_body    NVARCHAR(MAX) NULL,
    error_log       NVARCHAR(MAX) NULL,
    bull_job_id     NVARCHAR(100) NULL,                      -- BullMQ job reference
    retry_count     INT DEFAULT 0,

    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX IX_Reminders_LeadId ON Reminders(lead_id);
CREATE INDEX IX_Reminders_Status ON Reminders(status);
CREATE INDEX IX_Reminders_ScheduledAt ON Reminders(scheduled_at);
GO

-- ============================================================
-- TABLE: CommunicationLogs
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CommunicationLogs' AND xtype='U')
CREATE TABLE CommunicationLogs (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    lead_id     INT NOT NULL REFERENCES Leads(id) ON DELETE CASCADE,
    reminder_id INT NULL REFERENCES Reminders(id),
    channel     NVARCHAR(20) NOT NULL,   -- WhatsApp|Email|Telegram|Call
    direction   NVARCHAR(10) NOT NULL DEFAULT 'Outbound', -- Outbound|Inbound
    status      NVARCHAR(20) NOT NULL,   -- Delivered|Failed|Pending|Read
    provider_id NVARCHAR(200) NULL,      -- Twilio SID / SendGrid ID
    message     NVARCHAR(MAX) NULL,
    sent_at     DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX IX_CommLogs_LeadId ON CommunicationLogs(lead_id);
GO

-- ============================================================
-- TABLE: WebhookEvents  (raw Meta events for audit/replay)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebhookEvents' AND xtype='U')
CREATE TABLE WebhookEvents (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    source      NVARCHAR(30) NOT NULL DEFAULT 'Meta',
    event_type  NVARCHAR(50) NULL,
    payload     NVARCHAR(MAX) NOT NULL,
    processed   BIT DEFAULT 0,
    lead_id     INT NULL REFERENCES Leads(id),
    error       NVARCHAR(MAX) NULL,
    received_at DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- TABLE: LeadStatusHistory
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LeadStatusHistory' AND xtype='U')
CREATE TABLE LeadStatusHistory (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    lead_id     INT NOT NULL REFERENCES Leads(id) ON DELETE CASCADE,
    old_status  NVARCHAR(30) NULL,
    new_status  NVARCHAR(30) NOT NULL,
    changed_by  INT NULL REFERENCES Users(id),
    note        NVARCHAR(500) NULL,
    changed_at  DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- STORED PROCEDURE: Update Lead Timestamps Trigger Equivalent
-- ============================================================
GO
CREATE OR ALTER TRIGGER trg_Leads_UpdatedAt
ON Leads
AFTER UPDATE AS
BEGIN
    UPDATE Leads SET updated_at = GETDATE()
    FROM Leads l
    INNER JOIN inserted i ON l.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER trg_Reminders_UpdatedAt
ON Reminders
AFTER UPDATE AS
BEGIN
    UPDATE Reminders SET updated_at = GETDATE()
    FROM Reminders r
    INNER JOIN inserted i ON r.id = i.id;
END;
GO

-- ============================================================
-- DEFAULT ADMIN USER (password: Admin@123 — change immediately)
-- bcrypt hash of 'Admin@123' with 12 rounds
-- ============================================================
-- Run this after setting up bcrypt in Node and hashing 'Admin@123'
-- INSERT INTO Users (name, email, password_hash, role_id)
-- VALUES ('Wizone Admin', 'admin@wizone.com', '<bcrypt_hash>', 1);

PRINT 'lead_management Schema created successfully.';
GO
