# Wizone LMS — Setup Guide

## Prerequisites
- Node.js 18+
- Microsoft SQL Server (or Azure SQL)
- Redis 6+ (for job queues)
- Git

---

## 1. Database Setup

Open SSMS (SQL Server Management Studio) and run:
```sql
-- Execute the full schema
database/schema.sql
```

---

## 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Edit .env with your values:
#   DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD
#   JWT_SECRET (generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
#   SMTP_USER, SMTP_PASS
#   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
#   TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
#   META_APP_SECRET, META_VERIFY_TOKEN, META_PAGE_ACCESS_TOKEN

# Create the first admin user
npm run seed:admin

# Start (development)
npm run dev

# Start (production)
npm start
```

Backend runs at: http://localhost:5000

---

## 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

Frontend runs at: http://localhost:3000

---

## 4. Meta Webhook Configuration

1. Deploy backend to a public domain (e.g. Render, Railway, VPS)
2. Go to **Meta Developers** → Your App → Webhooks
3. Set Callback URL: `https://your-domain.com/api/webhook`
4. Set Verify Token: same value as `META_VERIFY_TOKEN` in `.env`
5. Subscribe to `leadgen` field under your Facebook Page
6. Save and test with a Lead Ad form

---

## 5. Project Structure

```
lead_managment_auto/
├── database/
│   └── schema.sql              ← MSSQL schema (5 tables)
├── backend/
│   ├── server.js               ← Express + Socket.io entry
│   ├── config/
│   │   ├── database.js         ← MSSQL connection pool
│   │   └── logger.js           ← Winston logger
│   ├── middleware/
│   │   ├── auth.js             ← JWT verification
│   │   └── rbac.js             ← Permission checker
│   ├── models/
│   │   ├── Lead.js             ← Lead CRUD + stats
│   │   └── User.js             ← User CRUD + bcrypt
│   ├── routes/
│   │   ├── auth.js             ← POST /api/auth/login
│   │   ├── leads.js            ← CRUD /api/leads
│   │   ├── users.js            ← Admin /api/users
│   │   ├── reminders.js        ← /api/reminders
│   │   ├── webhook.js          ← Meta /api/webhook
│   │   └── dashboard.js        ← /api/dashboard/summary
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── leadController.js   ← Triggers automation
│   │   └── userController.js
│   ├── services/
│   │   ├── emailService.js     ← Nodemailer + templates
│   │   ├── whatsappService.js  ← Twilio + Interakt
│   │   ├── telegramService.js  ← Bot API
│   │   └── communicationService.js ← Orchestrator
│   └── jobs/
│       ├── reminderScheduler.js ← Type1: meeting reminders
│       ├── reminderWorker.js    ← Processes reminder queue
│       ├── followUpScheduler.js ← Type2: drip campaign
│       └── followUpWorker.js    ← Processes follow-up queue
└── frontend/
    └── src/
        ├── App.jsx             ← Route definitions
        ├── context/
        │   └── AuthContext.jsx ← JWT auth state
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── DashboardPage.jsx ← Real-time charts
        │   ├── LeadsPage.jsx    ← Table + filters
        │   ├── LeadDetailPage.jsx ← Full CRM view
        │   ├── AdminPage.jsx    ← RBAC user mgmt
        │   └── SettingsPage.jsx ← Integration guide
        └── services/
            └── api.js          ← Axios with auth
```

---

## 6. API Reference

| Method | Route                         | Auth     | Description              |
|--------|-------------------------------|----------|--------------------------|
| POST   | /api/auth/login               | Public   | Login, get JWT           |
| GET    | /api/auth/me                  | JWT      | Current user profile     |
| GET    | /api/leads                    | JWT      | List leads (filterable)  |
| POST   | /api/leads                    | JWT+perm | Create lead + automation |
| PATCH  | /api/leads/:id/status         | JWT+perm | Update lead status       |
| GET    | /api/leads/stats              | JWT      | Conversion stats         |
| GET    | /api/dashboard/summary        | JWT      | Dashboard data           |
| GET    | /api/users                    | Admin    | List team members        |
| POST   | /api/users                    | Admin    | Create team member       |
| GET/POST | /api/webhook                | Public*  | Meta webhook endpoint    |
| GET    | /api/reminders/upcoming       | JWT      | Next 24h reminders       |

---

## 7. Default Login

After running `npm run seed:admin`:
- Email: `admin@wizone.com`
- Password: `Admin@123` ← **Change immediately**

---

## 8. Automation Flow Summary

```
Lead Arrives (Meta / Manual)
       │
       ├─ Welcome Email + WhatsApp + Telegram (instant)
       │
       ├─ Type1 (Meeting Booked)?
       │   ├─ 4 Days Before   → Confirmation reminder
       │   ├─ Same Day 9 AM   → Morning reminder
       │   ├─ 30 Min Before   → "Join now" reminder
       │   └─ 1 Hour After    → Post-meeting follow-up
       │
       └─ Type2 (No Meeting)?
           ├─ Day 1  → Interest check
           ├─ Day 3  → Benefits + case study
           ├─ Day 5  → Personal follow-up
           ├─ Day 7  → Last chance reminder
           └─ Day 7+ No response → Move to Nurture
```
