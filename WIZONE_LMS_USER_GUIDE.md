# Wizone LMS — User Guide
### AI-Powered Lead Management System

> **Version:** 1.0 · **Last Updated:** April 2026  
> For support contact: sachin@wizoneit.com

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Leads — Main Pipeline](#3-leads--main-pipeline)
4. [Lead Detail Page](#4-lead-detail-page)
5. [Converted Leads](#5-converted-leads)
6. [Telegram Bot Commands](#6-telegram-bot-commands)
7. [Lead Sources](#7-lead-sources-admin-only)
8. [Team Management](#8-team-management-admin-only)
9. [Settings & Integrations](#9-settings--integrations-admin-only)
10. [Automation & How It Works](#10-automation--how-it-works)
11. [Roles & Permissions](#11-roles--permissions)
12. [Tips & Best Practices](#12-tips--best-practices)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Getting Started

### 1.1 Logging In

1. Open your browser and go to the LMS URL (e.g., `http://your-server/` or `localhost:5173`)
2. Enter your **Email** and **Password**
3. If your account has **2FA (Green PIN)** enabled:
   - Enter your 6-digit Green PIN within **15 minutes**
   - The PIN is given to you by your Admin
4. You will land on the **Dashboard**

> ⚠️ **Failed Logins:** After 10 failed attempts, your IP is blocked for 15 minutes.

---

### 1.2 Navigating the App

| Sidebar Item | Who Can See | What It Does |
|---|---|---|
| 🏠 Dashboard | Everyone | Summary stats, charts, reminders |
| 👥 Leads | Everyone | Main lead table + sub-tables |
| ✅ Converted Leads | Everyone | All converted leads |
| 🔗 Lead Sources | Admin only | Manage where leads come from |
| 🛡️ Admin Panel | Admin only | Manage users & team |
| ⚙️ Settings | Admin only | Configure email, WhatsApp, Telegram |

---

### 1.3 Understanding Lead Types

The system categorizes every lead into one of two types:

| Type | Label | Meaning |
|---|---|---|
| **Type 1** | Meeting Booked | Lead has a scheduled slot/appointment |
| **Type 2** | No Meeting | Lead is in follow-up/nurture mode |

This determines which **automation flow** runs for each lead.

---

### 1.4 Lead Statuses

Every lead moves through a pipeline. You can update statuses manually.

| Status | Color | Meaning |
|---|---|---|
| 🔵 **New** | Blue | Just arrived, not yet contacted |
| 🟡 **FollowUp** | Amber | Being actively followed up |
| 🟣 **DemoGiven** | Purple | Demo/meeting conducted |
| 🟢 **Converted** | Green | Successfully closed — moved to Converted Leads |
| 🔴 **Lost** | Red | Deal didn't work out — moved to Lost table |
| 🩷 **Nurture** | Pink | Long-term nurture, not ready yet — moved to Nurture table |

---

## 2. Dashboard

The Dashboard gives you a **real-time bird's-eye view** of your entire pipeline.

### 2.1 Top Stats Cards

| Card | What It Shows |
|---|---|
| **Total Leads** | All leads ever captured |
| **New Leads** | Leads with status = New |
| **Meetings Booked** | Leads with a slot booked (Type 1) |
| **Converted** | Successfully converted leads |
| **Lost** | Leads marked as Lost |
| **Welcome Sent** | Leads that received the welcome automation |

> 💡 Stats update **live** — no refresh needed. When a new lead arrives, the numbers update automatically.

---

### 2.2 Charts

#### Lead Trend (Area Chart)
- Shows **new leads per day** for the last 7 days
- Hover over any point to see the exact count for that day

#### Conversion by Agent (Bar Chart)
- Shows how many leads each **team member** has converted
- Great for performance tracking

#### Leads by Source (Donut Chart)
- Shows the **breakdown of where leads come from** (Meta, Landing Page, Manual, etc.)
- Hover a segment to see count + percentage

#### Source Performance Table
- Lists every source with:
  - Total leads captured
  - Conversions from that source
  - Conversion rate %
  - Share of total leads

---

### 2.3 Recent Leads

Shows the **10 most recently added leads** with:
- Name and source
- Time since arrival
- Current status badge
- Click any row to open the full Lead Detail page

---

### 2.4 Upcoming Reminders

Shows automated reminders firing in the **next 4 hours**:
- Lead name + reminder type
- Scheduled time
- Channel (Email / WhatsApp / Telegram)

> If a reminder fails to send, it will retry up to 3 times automatically.

---

## 3. Leads — Main Pipeline

The Leads page is your **primary workspace**. It is split into **3 sections**:

```
┌─────────────────────────────────────────────────────┐
│  MAIN TABLE (Active Pipeline)                        │
│  Shows: New • FollowUp • DemoGiven leads only        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  🩷 NURTURE LEADS                                    │
│  Shows: Only Nurture-status leads                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  🔴 LOST LEADS                                       │
│  Shows: Only Lost-status leads                       │
└─────────────────────────────────────────────────────┘
```

> Converted leads are on their **own page** (`/converted-leads` — sidebar)

---

### 3.1 Status Cards (Top Row)

Six cards at the top show counts for each status and act as **quick filters**:

| Card | Action When Clicked |
|---|---|
| 🔵 New | Filters main table to show only New leads |
| 🟡 FollowUp | Filters main table to FollowUp leads |
| 🟣 DemoGiven | Filters main table to DemoGiven leads |
| 🟢 Converted | **Navigates to Converted Leads page** ↗ |
| 🔴 Lost | **Scrolls down to Lost Leads sub-table** ↓ |
| 🩷 Nurture | **Scrolls down to Nurture Leads sub-table** ↓ |

---

### 3.2 Date Filter Cards

Four cards below the status cards filter by **meeting schedule**:

| Card | What It Shows |
|---|---|
| 📅 Today's FollowUp | Leads with follow-up due today |
| 📅 This Week's FollowUp | Leads due for follow-up this week |
| 🎥 Today's Meetings | Type 1 leads with a slot today |
| 🎥 Tomorrow's Meetings | Type 1 leads with a slot tomorrow |

---

### 3.3 Search & Filters (Toolbar)

| Filter | How to Use |
|---|---|
| 🔍 Search | Type name, email, or phone — results filter instantly |
| All Statuses | Dropdown to filter by a specific status |
| All Sources | Dropdown to filter by lead source |
| All Types | Filter by Meeting Booked vs No Meeting |
| Clear (N) | Removes all active filters |

The **lead count** next to the filter bar always shows how many leads match your current filters.

---

### 3.4 Table View — Column Guide

| Column | Shows |
|---|---|
| **Lead** | Name with avatar, slot tags (⏰ Today, 📅 Tomorrow), follow-up count, reschedule count |
| **Company** | Company name |
| **Contact** | WhatsApp-linked phone + email |
| **Industry** | Industry sector |
| **Slot** | Scheduled meeting date & time (if Type 1) |
| **Meet** | 🎥 icon links directly to Google Meet (if link exists) |
| **Source** | Colour-coded source badge |
| **Status** | Current pipeline status badge |
| **Date** | Lead creation date & time (IST) |
| **Actions** | 7 action buttons (see below) |

---

### 3.5 Action Buttons (Per Row)

Each lead row has **7 action buttons**:

| Button | Icon | What It Does |
|---|---|---|
| **View** | 👁️ | Opens full Lead Detail page |
| **Assign** | 👤 | Assign/reassign lead to a team member |
| **FollowUp** | 💬 | Open FollowUp modal (add note + update status) |
| **Email** | ✉️ | Send manual email to lead |
| **WhatsApp** | 📱 | Send manual WhatsApp to lead |
| **Meet Link** | 🎥 | Generate / regenerate a Google Meet link |
| **Delete** | 🗑️ | Delete lead (asks for confirmation) |

---

### 3.6 Adding a New Lead (Manually)

1. Click the **`+ Add Lead`** button (top right)
2. Fill in the form:
   - **Full Name** (required)
   - Phone / WhatsApp Number
   - Email
   - Company, Industry
   - Source (dropdown)
   - Client Type (Type 1 = has meeting, Type 2 = no meeting)
   - Slot Date & Time (if Type 1)
   - Notes
3. Click **Save**

> ✅ When you save, the system automatically:
> - Sends a **welcome email** (if SMTP configured)
> - Sends a **welcome WhatsApp** (if phone + Interakt configured)
> - Notifies the **Telegram admin channel**
> - Schedules **reminders** based on client type

---

### 3.7 FollowUp Modal

Click the 💬 button or the lead name to open the FollowUp modal.

**What you can do:**
1. **Update Status** — pick the new pipeline status
2. **Write a Note** — log what happened in this interaction
3. **Set Next Follow-up Date** — schedule when to follow up again
4. **View Full Activity History** — see every action ever taken on this lead

> Every note and status change is permanently logged with your name and timestamp.

---

### 3.8 View Modes

Toggle between two views with the buttons in the toolbar (top right):

| Mode | When to Use |
|---|---|
| **Table View** (≡) | Best for large lists, bulk work |
| **Grid View** (⊞) | Better for visual browsing, checking slot info |

Your view preference is saved in the browser.

---

## 4. Lead Detail Page

Click **View** (👁️) on any lead to open the full detail page.

### 4.1 Lead Info Panel

Displays all fields: Name, Email, Phone, WhatsApp, Company, Industry, Source, Status, Type, Tags, Notes.

**Editing:** Click any field to edit it inline. Changes are saved immediately with an activity log entry.

---

### 4.2 Meeting / Slot Management

For **Type 1 leads** (Meeting Booked), you'll see the meeting panel.

#### Setting or Changing a Slot

1. Click **"Set Slot"** or **"Reschedule"**
2. Pick a **date** from the calendar
3. Available time slots are shown — booked slots are greyed out
4. Select a **time slot**
5. If another meeting is within ±1 hour, you'll see a **conflict warning**
6. Click **Confirm**

> ✅ On save: A **Google Meet link** is created and stored. An email with the link is sent to the customer.

#### Generating a Meet Link Manually

If a lead has a slot but no meet link, or you need a fresh link:
1. Click **"Generate Meet Link"**
2. The link is created and emailed to the customer automatically

#### Meeting Status Lifecycle

| Status | Icon | Meaning |
|---|---|---|
| Upcoming | 🗓️ | Meeting is scheduled |
| In Progress | ▶️ | Meeting is currently happening |
| Completed | ✅ | Meeting finished |
| Missed | ❌ | Lead didn't show up |
| Rescheduled | 🔄 | Meeting was moved |

---

### 4.3 Reschedule History

Shows all previous rescheduling events:
- Old date/time → New date/time
- Reason (Customer Request / No Show / Team Request)
- Who rescheduled it and when

---

### 4.4 Scheduled Reminders

Shows all reminders linked to this lead:

| Reminder Type | When Sent | Channel |
|---|---|---|
| Welcome / Immediate | Instantly on creation | Email + WhatsApp |
| Day 1 Follow-up | 24 hours after creation | Email |
| Day 3 Follow-up | 3 days after creation | Email |
| Day 5 Follow-up | 5 days after creation | Email |
| Day 7 Follow-up | 7 days after creation | Email |
| 4 Days Before Meeting | 4 days before slot | Email + WhatsApp |
| Same Day 9 AM | Morning of slot day | Email + WhatsApp |
| 30 Min Before | 30 minutes before slot | Email |
| Post-Meeting | 1 hour after slot | Email |

**Reminder statuses:** `Pending` → `Sent` / `Failed` / `Cancelled`

---

### 4.5 Sending Communications

#### Send Email
1. Click **"Send Email"** button
2. Select a template (or write custom message)
3. Preview the email with this lead's data substituted in
4. Click **Send**
5. Delivery is logged in the activity timeline

#### Send WhatsApp
1. Click **"Send WhatsApp"** button
2. Type your message (template variables supported)
3. Click **Send**
4. Delivery is logged in the activity timeline

---

### 4.6 Activity Timeline

Every action on a lead is recorded here:
- 🚀 Lead created
- 🔄 Status changes (who changed it, old → new)
- ✏️ Field edits (which field, old value → new value)
- 💬 Follow-up notes added
- 👤 Assignment changes
- ✉️ Emails sent
- 📱 WhatsApps sent

---

## 5. Converted Leads

Access via **Sidebar → Converted Leads** or click the **Converted** status card.

### What You'll See

A dedicated table showing only leads with status = **Converted**, with:
- Lead name, company, contact
- Source and assigned agent
- Conversion date
- View button → opens Lead Detail

### Stats at the Top

| Stat | Meaning |
|---|---|
| **Total Converted** | All-time conversion count |
| **This Month** | Conversions in the current calendar month |

---

## 6. Telegram Bot Commands

Your Telegram bot **@Wizone_LMS_bot** can answer questions anytime.

### Commands

Send these in your Telegram chat with the bot:

| Command | What You Get |
|---|---|
| `/start` | Welcome message + list of commands |
| `/today` | All meetings scheduled for today (name, company, phone, time, meet link) |
| `/tomorrow` | All meetings scheduled for tomorrow |
| `/leads` | Count of active leads by status (New, FollowUp, DemoGiven, Nurture) |

### Automatic Daily Notifications

The bot sends these automatically to the admin channel:

| Time | Notification |
|---|---|
| **9:00 AM daily** | Full list of today's meetings with details |
| **60 min before each slot** | ⏰ Reminder with lead name + meet link |
| **30 min before each slot** | 🔔 Reminder — "Meeting in 30 minutes" |
| **15 min before each slot** | 🚨 Urgent — "Meeting in 15 minutes!" |

> 💡 **Group Use:** Add the bot to a team Telegram group. Everyone sees the reminders and can use commands.

---

## 7. Lead Sources *(Admin Only)*

Manage where leads enter the system. Go to **Sidebar → Lead Sources**.

### Source Types

#### 📘 Meta / Facebook Lead Ads
Leads from Facebook and Instagram ad forms arrive automatically.

**Setup:**
1. Create a source → Copy the **Webhook URL**
2. Go to Meta Business Suite → Webhooks
3. Paste the Webhook URL and your **Verify Token**
4. Meta will start sending leads automatically

---

#### 🌐 Landing Page / Form
For any web form that should send leads to the LMS.

**Setup:**
1. Create a source → Copy your **API Key** (`wz_xxxxx`)
2. Send a POST request to `/api/capture` with header `x-api-key: wz_xxxxx`
3. Body fields: `full_name` (required), `email`, `phone`, `company`, `industry`, `slot_date`, `slot_time`

**Example (JavaScript):**
```js
fetch('/api/capture', {
  method: 'POST',
  headers: { 'x-api-key': 'wz_your_key', 'Content-Type': 'application/json' },
  body: JSON.stringify({ full_name: 'John Doe', phone: '+919999999999', email: 'john@example.com' })
});
```

---

#### 🗄️ External Database
Sync leads from an existing PostgreSQL or MSSQL database.

**Setup:**
1. Enter database credentials (host, port, database, username, password)
2. Click **Test Connection**
3. Select the table containing leads
4. Map columns to LMS fields (auto-suggestions available)
5. Save — sync runs every **5 minutes** automatically

**Deduplication:** Leads that already exist (matched by email or phone) are skipped.

---

### Managing Sources

| Action | What It Does |
|---|---|
| **Edit** | Update name, credentials, column mapping |
| **Pause / Resume** | Stop/start accepting new leads from this source |
| **Test** | Verify connection or webhook is working |
| **Sync Now** | Manually trigger an external DB sync |
| **Delete** | Remove source (does NOT delete existing leads) |
| **Regenerate API Key** | Issues a new API key (old key stops working) |

---

## 8. Team Management *(Admin Only)*

Go to **Sidebar → Admin Panel**.

### 8.1 Adding a New Team Member

1. Click **"+ Add User"**
2. Fill in: Name, Email, Role
3. A **temporary password** is shown — copy and share it securely
4. The user can log in and change their password

---

### 8.2 User Roles

| Role | Access Level |
|---|---|
| **Admin** | Full access — all pages, settings, user management |
| **Sales** | Leads, communications, own profile. Cannot access Admin/Settings |
| **Support** | View leads, add follow-up notes, send messages |

---

### 8.3 Resetting a Password

1. Find the user in the list
2. Click **"Reset Password"**
3. A new random password is generated and shown **once**
4. Copy and share it securely with the user
5. They should change it immediately after logging in

---

### 8.4 Two-Factor Authentication (Green PIN)

2FA adds an extra security step — after entering their password, the user must also enter a 6-digit PIN.

**To enable 2FA for a user:**
1. Click **"Generate PIN"** next to the user
2. A 6-digit PIN is shown **once**
3. Share it securely with the user (WhatsApp, encrypted message)
4. From their next login, they'll need to enter this PIN

**To remove 2FA:**
1. Click **"Remove PIN"** next to the user
2. Confirm — they can now log in with password only

---

### 8.5 Deactivating a User

Click the toggle next to a user to **Deactivate** them.
- They cannot log in
- Their past data and leads remain intact
- Reactivate anytime by clicking the toggle again

---

## 9. Settings & Integrations *(Admin Only)*

Go to **Sidebar → Settings**.

---

### 9.1 Company Info

Set your company details used in all email and WhatsApp templates:
- **Company Name** — appears in email signatures and templates
- **Company Phone** — shown in communications
- **Company Website** — linked in email footers

---

### 9.2 Email (SMTP) Setup

Configure outgoing email to send automated emails to leads.

| Field | What to Enter |
|---|---|
| SMTP Host | `smtp.gmail.com` (Gmail) or your server |
| SMTP Port | `587` for TLS, `465` for SSL |
| SMTP Username | Your full email address |
| SMTP Password | For Gmail: use an **App Password** (not your Google login) |
| From Name | Display name e.g. "Wizone Team" |

**Getting a Gmail App Password:**
1. Go to Google Account → Security → 2-Step Verification → App Passwords
2. Create an app password for "Mail"
3. Use that 16-character code in SMTP Password

**Test Email:**
Click **"Send Test Email"** → enter any email → confirm delivery before saving.

---

### 9.3 Email Templates

Create and manage templates used in automated and manual emails.

**Template Variables** (replaced with real lead data):

| Variable | Replaced With |
|---|---|
| `{{full_name}}` | Lead's full name |
| `{{email}}` | Lead's email |
| `{{phone}}` | Lead's phone number |
| `{{company}}` | Lead's company |
| `{{company_name}}` | Your company name (from Company Info) |
| `{{slot_date}}` | Appointment date |
| `{{slot_time}}` | Appointment time |
| `{{meet_link}}` | Google Meet link |

**Conditional Blocks:**
```
{{#if meet_link}}
Join your meeting: {{meet_link}}
{{/if}}
```
This section only appears if the lead has a meet link.

**Source-Template Mapping:**
Link specific templates to specific sources — e.g., Meta leads get "Meta Welcome Template" and landing page leads get "Landing Page Welcome".

---

### 9.4 WhatsApp Setup

#### Option A — Interakt (Recommended)
1. Create an account at [interakt.shop](https://interakt.shop)
2. Get your **API Key** from Interakt dashboard
3. Paste it in Settings → WhatsApp → Interakt API Key
4. Test with the Test button

#### Option B — Twilio
Used as a fallback. Requires Twilio Account SID, Auth Token, and a WhatsApp sender number.

---

### 9.5 Language / Localization

Change the UI language:
- 🇬🇧 **English** (default)
- 🇮🇷 **فارسی** — Farsi/Persian (full RTL support)
- 🇮🇳 **हिन्दी** — Hindi

Changes apply immediately for all users.

---

## 10. Automation & How It Works

### 10.1 What Happens When a New Lead Arrives

```
Lead arrives (any source)
        │
        ▼
1. Saved to database
2. Welcome email sent       ← if SMTP configured
3. Welcome WhatsApp sent    ← if phone + Interakt configured
4. Telegram admin notified  ← if bot configured
5. Reminders scheduled      ← based on lead type
        │
        ├── Type 1 (Meeting Booked) ──────────────────────────┐
        │   • Meet link created                                │
        │   • Meet link emailed to lead                        │
        │   • 4 days before → confirmation email              │
        │   • Day of, 9 AM → morning reminder                 │
        │   • 30 min before → "Join now" alert                │
        │   • 1 hr after → post-meeting follow-up email       │
        │                                                      │
        └── Type 2 (No Meeting) ───────────────────────────────┘
            • Immediate welcome
            • Day 1 → interest check email
            • Day 3 → benefits email
            • Day 5 → personal follow-up
            • Day 7 → last chance reminder
            • No response → moves to Nurture
```

---

### 10.2 Status Change Triggers

| When Status Changes To | What Automatically Happens |
|---|---|
| **Converted** | Conversion notification sent to admin + agent. Lead moves to Converted page. |
| **Lost** | All pending reminders cancelled. Lead moves to Lost sub-table. |
| **Nurture** | Meeting reminders cancelled. Lead moves to Nurture sub-table. Monthly check-in sequence starts. |

---

### 10.3 External DB Sync — What Happens

Every **5 minutes**, for each active External DB source:
1. System connects to your external database
2. Reads the configured table
3. Checks each row against existing leads (by email & phone)
4. **New leads** are created and automated welcome flow starts
5. **Existing leads** are skipped (no duplicate)
6. Sync count is logged (synced / skipped / errors)

---

## 11. Roles & Permissions

| Action | Admin | Sales | Support |
|---|---|---|---|
| View Dashboard | ✅ | ✅ | ✅ |
| View All Leads | ✅ | ✅ | ✅ |
| Add / Edit Leads | ✅ | ✅ | ❌ |
| Delete Leads | ✅ | ✅ | ❌ |
| Update Status | ✅ | ✅ | ✅ |
| Add Follow-up Notes | ✅ | ✅ | ✅ |
| Send Email / WhatsApp | ✅ | ✅ | ✅ |
| Book / Change Slots | ✅ | ✅ | ❌ |
| View Converted Leads | ✅ | ✅ | ✅ |
| Manage Lead Sources | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ |
| Change Settings | ✅ | ❌ | ❌ |
| Manage Email Templates | ✅ | ❌ | ❌ |

---

## 12. Tips & Best Practices

### For Sales Agents

- **Use the FollowUp modal** every time you contact a lead — even a quick "called, no answer" note builds a complete history.
- **Keep statuses updated** — the dashboard charts and Telegram reports are only as good as your status updates.
- **Slot booking tip:** Always book a slot before sending the meet link manually — the system auto-generates and emails it.
- **Use `/today` on Telegram** first thing every morning to review your meeting schedule.
- **Search first before adding** — use the search bar to check if a lead already exists before creating a duplicate.

### For Admins

- **Test email/WhatsApp before going live** — use the Test buttons in Settings to confirm delivery works.
- **Assign leads to agents** using the 👤 button so workload is distributed and agents only see their relevant leads.
- **Green PIN (2FA) for all admins** — highly recommended for admin accounts.
- **Check Source Performance** on the Dashboard weekly to see which lead sources convert best.
- **Pause sources** you don't need instead of deleting — all historical leads are preserved.
- **Column mapping for external DB** — use the "Auto-map" suggestion first, then adjust manually if needed.

### For Team Leads

- **Conversion by Agent chart** on Dashboard shows who is performing best.
- Use the **FollowUp Date filter** (Today's FollowUp) every morning to catch leads due for contact.
- **Nurture leads aren't lost** — revisit the Nurture sub-table monthly to re-engage them.

---

## 13. Troubleshooting

### "Welcome email not sending"
1. Go to **Settings → Email**
2. Click **"Send Test Email"** — if it fails, check SMTP credentials
3. Gmail users: Make sure you're using an **App Password**, not your regular Google password
4. Check that **SMTP Port** is correct: `587` for TLS or `465` for SSL

---

### "WhatsApp message not delivering"
1. Go to **Settings → WhatsApp**
2. Test the Interakt API Key
3. Verify the lead's phone number includes country code (e.g., `+919XXXXXXXXX`)
4. Check Interakt dashboard for delivery logs

---

### "Telegram bot not responding"
1. Make sure `TELEGRAM_BOT_TOKEN` is set correctly in `.env`
2. Restart the backend server
3. Send `/start` to `@Wizone_LMS_bot` — if no response, check server logs
4. For scheduled notifications: verify `TELEGRAM_ADMIN_CHAT_ID` is set in `.env`

---

### "Lead from Meta/Facebook not appearing"
1. Go to **Sources → your Meta source → Test Connection**
2. Verify the **Webhook URL** is set correctly in Meta Business Suite
3. Confirm the **Verify Token** matches between Meta settings and LMS
4. Check if the source is **Active** (not paused)

---

### "External DB sync not working"
1. Go to **Sources → your DB source → Test Connection**
2. If test fails: check host, port, username, password
3. Make sure the LMS server can reach your database server (firewall rules)
4. Click **"Sync Now"** to manually trigger and watch for error messages

---

### "Slot conflict warning showing"
The system checks if another lead has a meeting within ±1 hour of your chosen time. You can:
- Choose a different time slot (shown as available)
- Override the warning if you know the meetings won't conflict (same team, different agents)

---

### "Reminders not being sent"
1. Check the lead's reminder list in the Lead Detail page
2. If a reminder shows "Failed" — it will retry up to 3 times
3. If all retries fail: re-check email/WhatsApp settings
4. Ensure the backend server is running (reminders need the server to be up)

---

### "I can't see certain pages in the sidebar"
Your role may not have access to that page. Contact your Admin to:
- Adjust your role (Admin / Sales / Support)
- Or grant access to the specific feature

---

## Appendix — Quick Reference Card

```
DAILY ROUTINE FOR SALES AGENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Telegram: /today       → See today's meetings
2. Dashboard              → Check Today's FollowUp count
3. Leads → Today's FollowUp card → Work through follow-ups
4. Leads → Today's Meetings card → Prepare for scheduled demos
5. Update status after every interaction
6. Add FollowUp note after every call/email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK STATUS GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
New       → Just arrived, not contacted yet
FollowUp  → In active conversation
DemoGiven → Demo/meeting done, evaluating
Converted → Closed! Move here when won
Lost      → Not interested / closed lost
Nurture   → Long term, check back later
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TELEGRAM BOT COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/today     → Today's meetings
/tomorrow  → Tomorrow's meetings
/leads     → Pipeline status counts
/start     → Help & command list
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Wizone LMS — Built for high-performance sales teams*  
*Support: sachin@wizoneit.com*
