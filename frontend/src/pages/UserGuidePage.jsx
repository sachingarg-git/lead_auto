import React, { useState, useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════
   GUIDE CONTENT — English + Hindi
═══════════════════════════════════════════════════════════════ */
const GUIDE = {
  en: {
    pageTitle: 'User Guide',
    pageSubtitle: 'Step-by-step guide to using Wizone LMS',
    searchPlaceholder: 'Search guide…',
    tipLabel: '💡 Tip',
    noteLabel: '📌 Note',
    sections: [
      {
        id: 'login',
        icon: '🔐',
        title: 'Login & Access',
        subsections: [
          {
            heading: 'How to Log In',
            steps: [
              'Open the LMS in your browser',
              'Enter your Email and Password',
              'If 2FA (Green PIN) is enabled — enter your 6-digit PIN within 15 minutes',
              'You will land on the Dashboard',
            ],
            tip: 'After 10 failed login attempts your IP is blocked for 15 minutes. Contact your Admin if locked out.',
          },
          {
            heading: 'Sidebar Navigation',
            table: {
              headers: ['Page', 'Who Can Access', 'Purpose'],
              rows: [
                ['🏠 Dashboard', 'Everyone', 'Live stats, charts, reminders'],
                ['👥 Leads', 'Everyone', 'Main lead pipeline'],
                ['✅ Converted Leads', 'Everyone', 'All won/converted leads'],
                ['🔗 Lead Sources', 'Admin only', 'Manage lead capture sources'],
                ['🛡️ Admin Panel', 'Admin only', 'Manage team & users'],
                ['⚙️ Settings', 'Admin only', 'Email, WhatsApp, Telegram config'],
                ['📖 User Guide', 'Everyone', 'This guide!'],
              ],
            },
          },
          {
            heading: 'Lead Types',
            note: 'Every lead is either Type 1 or Type 2 — this decides which automation runs.',
            table: {
              headers: ['Type', 'Label', 'Meaning'],
              rows: [
                ['Type 1', 'Meeting Booked ✅', 'Lead has a scheduled slot — meeting reminders fire automatically'],
                ['Type 2', 'No Meeting ⚠️', 'Lead is in follow-up mode — 7-day email drip runs automatically'],
              ],
            },
          },
          {
            heading: 'Lead Status Colors',
            table: {
              headers: ['Status', 'Color', 'Meaning'],
              rows: [
                ['New', '🔵 Blue', 'Just arrived, not yet contacted'],
                ['FollowUp', '🟡 Amber', 'Being actively followed up'],
                ['DemoGiven', '🟣 Purple', 'Demo/meeting has been conducted'],
                ['Converted', '🟢 Green', 'Successfully closed — moves to Converted Leads page'],
                ['Lost', '🔴 Red', 'Not interested — moves to Lost sub-table'],
                ['Nurture', '🩷 Pink', 'Long-term, not ready yet — moves to Nurture sub-table'],
              ],
            },
          },
        ],
      },
      {
        id: 'dashboard',
        icon: '📊',
        title: 'Dashboard',
        subsections: [
          {
            heading: 'Stats Cards (Top Row)',
            table: {
              headers: ['Card', 'What It Shows'],
              rows: [
                ['Total Leads', 'All leads ever captured in the system'],
                ['New Leads', 'Leads with status = New'],
                ['Meetings Booked', 'Type 1 leads with a slot booked'],
                ['Converted', 'Successfully closed leads'],
                ['Lost', 'Leads marked as Lost'],
                ['Welcome Sent', 'Leads that received the welcome email/WhatsApp'],
              ],
            },
            tip: 'Stats update live — no page refresh needed. When a new lead arrives numbers update instantly.',
          },
          {
            heading: 'Charts & Visuals',
            steps: [
              'Lead Trend (Area Chart) — new leads per day for last 7 days. Hover to see exact count.',
              'Conversion by Agent (Bar Chart) — shows each team member\'s conversion count.',
              'Leads by Source (Donut Chart) — which sources bring the most leads.',
              'Source Performance Table — conversion rate % for every source.',
            ],
          },
          {
            heading: 'Recent Leads Panel',
            note: 'Shows the 10 most recently added leads. Click any row to open the full Lead Detail page.',
          },
          {
            heading: 'Upcoming Reminders Panel',
            note: 'Shows all automated reminders firing in the next 4 hours — lead name, type, channel, and time.',
          },
        ],
      },
      {
        id: 'leads',
        icon: '👥',
        title: 'Leads Page',
        subsections: [
          {
            heading: 'Three-Section Layout',
            note: 'The Leads page is split into 3 separate sections — Active Pipeline on top, then Nurture, then Lost at the bottom.',
            table: {
              headers: ['Section', 'Shows'],
              rows: [
                ['Main Table (Top)', 'New • FollowUp • DemoGiven leads only'],
                ['Nurture Sub-table', 'Only Nurture-status leads'],
                ['Lost Sub-table', 'Only Lost-status leads'],
              ],
            },
          },
          {
            heading: 'Status Cards — Quick Filters',
            table: {
              headers: ['Card', 'What Happens on Click'],
              rows: [
                ['🔵 New / 🟡 FollowUp / 🟣 DemoGiven', 'Filters main table to that status'],
                ['🟢 Converted ↗', 'Navigates to the Converted Leads page'],
                ['🔴 Lost ↓', 'Scrolls down to the Lost sub-table'],
                ['🩷 Nurture ↓', 'Scrolls down to the Nurture sub-table'],
              ],
            },
          },
          {
            heading: 'Date Filter Cards',
            table: {
              headers: ['Card', 'Shows'],
              rows: [
                ['Today\'s FollowUp', 'Leads with a follow-up due today'],
                ['This Week\'s FollowUp', 'Leads due this week'],
                ['Today\'s Meetings', 'Type 1 leads with a slot today'],
                ['Tomorrow\'s Meetings', 'Type 1 leads with a slot tomorrow'],
              ],
            },
          },
          {
            heading: 'Search & Filter Bar',
            steps: [
              'Search box — type name, email, or phone. Results filter instantly.',
              'All Statuses dropdown — filter by a specific status.',
              'All Sources dropdown — filter by lead source.',
              'All Types dropdown — Meeting Booked vs No Meeting.',
              'Clear (N) button — removes all active filters at once.',
            ],
          },
          {
            heading: 'Action Buttons (Per Row)',
            table: {
              headers: ['Button', 'Icon', 'What It Does'],
              rows: [
                ['View', '👁️', 'Opens full Lead Detail page'],
                ['Assign', '👤', 'Assign/reassign lead to a team member'],
                ['FollowUp', '💬', 'Add a note + update status (modal opens)'],
                ['Email', '✉️', 'Send a manual email'],
                ['WhatsApp', '📱', 'Send a manual WhatsApp message'],
                ['Meet Link', '🎥', 'Generate/regenerate a Google Meet link'],
                ['Delete', '🗑️', 'Delete lead (confirmation required)'],
              ],
            },
          },
          {
            heading: 'Adding a New Lead',
            steps: [
              'Click the "+ Add Lead" button (top right)',
              'Fill in Full Name (required), Phone, Email, Company, Industry',
              'Select Source and Client Type (Type 1 = has meeting, Type 2 = no meeting)',
              'For Type 1: add Slot Date & Time',
              'Click Save',
            ],
            tip: 'On save: welcome email + WhatsApp sent automatically, reminders scheduled, Telegram admin notified.',
          },
          {
            heading: 'FollowUp Modal — How to Use',
            steps: [
              'Click the 💬 button on any lead row',
              'Update Status — click the new status button',
              'Write a Note — log what happened in this interaction',
              'Set Next Follow-up Date — schedule when to contact again',
              'Click Save FollowUp',
              'View Activity History at the bottom — every past action is listed',
            ],
            tip: 'Always add a note even for quick calls ("Called, no answer"). This builds a complete interaction history.',
          },
        ],
      },
      {
        id: 'lead-detail',
        icon: '📋',
        title: 'Lead Detail Page',
        subsections: [
          {
            heading: 'Opening Lead Detail',
            steps: [
              'Click the 👁️ View button on any lead row',
              'Or click the lead name in the FollowUp modal',
            ],
          },
          {
            heading: 'Editing Lead Information',
            note: 'Click any field to edit it. Changes are saved automatically and logged in the activity timeline with your name and timestamp.',
          },
          {
            heading: 'Booking / Changing a Slot (Type 1 Leads)',
            steps: [
              'Click "Set Slot" or "Reschedule" button',
              'Pick a date from the calendar',
              'Available time slots are shown — booked ones are greyed out',
              'Select your time slot',
              'If another meeting is within ±1 hour, a conflict warning shows',
              'Click Confirm to save',
            ],
            tip: 'On save: Google Meet link is created automatically and emailed to the lead.',
          },
          {
            heading: 'Meeting Status Lifecycle',
            table: {
              headers: ['Status', 'Icon', 'Meaning'],
              rows: [
                ['Upcoming', '🗓️', 'Meeting is scheduled'],
                ['In Progress', '▶️', 'Meeting is currently happening'],
                ['Completed', '✅', 'Meeting finished successfully'],
                ['Missed', '❌', 'Lead did not show up'],
                ['Rescheduled', '🔄', 'Meeting time was changed'],
              ],
            },
          },
          {
            heading: 'Automated Reminders for this Lead',
            table: {
              headers: ['Reminder', 'When Sent', 'Channel'],
              rows: [
                ['Welcome', 'Instantly on creation', 'Email + WhatsApp'],
                ['Day 1 Follow-up', '24 hours after creation', 'Email'],
                ['Day 3 Follow-up', '3 days after creation', 'Email'],
                ['Day 5 Follow-up', '5 days after creation', 'Email'],
                ['Day 7 Follow-up', '7 days after creation', 'Email'],
                ['4 Days Before Meeting', '4 days before slot', 'Email + WhatsApp'],
                ['Same Day 9 AM', 'Morning of meeting day', 'Email + WhatsApp'],
                ['30 Min Before', '30 minutes before slot', 'Email'],
                ['Post-Meeting', '1 hour after slot', 'Email'],
              ],
            },
          },
          {
            heading: 'Activity Timeline',
            note: 'Every action is permanently recorded: status changes (who changed it, old → new), field edits, notes added, emails/WhatsApps sent, assignments.',
          },
        ],
      },
      {
        id: 'converted',
        icon: '✅',
        title: 'Converted Leads',
        subsections: [
          {
            heading: 'Accessing Converted Leads',
            steps: [
              'Click "Converted Leads" in the sidebar',
              'Or click the 🟢 Converted status card on the Leads page — it navigates directly here',
            ],
          },
          {
            heading: 'What You See',
            note: 'Dedicated table showing only Converted-status leads. Stats at the top show Total Converted and This Month\'s conversions. Click View on any row to open Lead Detail.',
          },
        ],
      },
      {
        id: 'telegram',
        icon: '✈️',
        title: 'Telegram Bot',
        subsections: [
          {
            heading: 'Bot Commands',
            note: 'Open Telegram → search for @Wizone_LMS_bot → send any command.',
            table: {
              headers: ['Command', 'What You Get'],
              rows: [
                ['/start', 'Welcome message + full list of commands'],
                ['/today', 'All meetings scheduled for today (name, company, phone, time, meet link)'],
                ['/tomorrow', 'All meetings scheduled for tomorrow'],
                ['/leads', 'Count of active leads by status (New, FollowUp, DemoGiven, Nurture)'],
              ],
            },
          },
          {
            heading: 'Automatic Daily Notifications',
            table: {
              headers: ['Time / Trigger', 'Notification'],
              rows: [
                ['9:00 AM every day', '🌅 Full list of today\'s meetings with all details'],
                ['60 min before each slot', '⏰ Reminder — lead name + time + meet link'],
                ['30 min before each slot', '🔔 Reminder — "Meeting in 30 minutes"'],
                ['15 min before each slot', '🚨 Urgent — "Meeting in 15 minutes!"'],
              ],
            },
            tip: 'Add the bot to a team Telegram group so all team members see reminders together.',
          },
        ],
      },
      {
        id: 'sources',
        icon: '🔗',
        title: 'Lead Sources (Admin)',
        subsections: [
          {
            heading: 'Types of Lead Sources',
            table: {
              headers: ['Type', 'How It Works'],
              rows: [
                ['📘 Meta / Facebook Ads', 'Facebook & Instagram ad form submissions arrive automatically via webhook'],
                ['🌐 Landing Page / Form', 'Any web form sends leads via POST with your API key'],
                ['🗄️ External Database', 'Your PostgreSQL or MSSQL database is polled every 5 minutes'],
              ],
            },
          },
          {
            heading: 'Setting Up Meta Source',
            steps: [
              'Go to Lead Sources → Add Source → select Meta',
              'Copy the Webhook URL shown',
              'Go to Meta Business Suite → Webhooks → Paste the URL',
              'Enter the Verify Token (same as in LMS)',
              'Save — leads from your Facebook/Instagram ads will now flow in automatically',
            ],
          },
          {
            heading: 'Setting Up Landing Page Source',
            steps: [
              'Go to Lead Sources → Add Source → select Landing Page',
              'Copy your API Key (format: wz_xxxxxx)',
              'In your web form, send a POST request to /api/capture',
              'Include header: x-api-key: wz_your_key',
              'Required field: full_name. Optional: email, phone, company, slot_date, slot_time',
            ],
          },
          {
            heading: 'Setting Up External Database',
            steps: [
              'Go to Lead Sources → Add Source → select External DB',
              'Enter: Database type (PostgreSQL/MSSQL), Host, Port, Database, Username, Password',
              'Click Test Connection',
              'Select the table containing your leads',
              'Map columns to LMS fields (auto-suggest is available)',
              'Save — sync runs every 5 minutes automatically',
            ],
            tip: 'Deduplication is automatic — leads already in LMS (matched by email/phone) are skipped.',
          },
        ],
      },
      {
        id: 'team',
        icon: '🛡️',
        title: 'Team Management (Admin)',
        subsections: [
          {
            heading: 'Adding a New Team Member',
            steps: [
              'Go to Admin Panel → click "+ Add User"',
              'Fill in Name, Email, select Role',
              'A temporary password is shown ONCE — copy and share it securely',
              'User logs in and should change their password immediately',
            ],
          },
          {
            heading: 'User Roles',
            table: {
              headers: ['Role', 'What They Can Do'],
              rows: [
                ['Admin', 'Full access — all pages, settings, user management, sources'],
                ['Sales', 'Leads, communications, own profile. Cannot access Admin/Settings'],
                ['Support', 'View leads, add follow-up notes, send messages'],
              ],
            },
          },
          {
            heading: 'Resetting a Password',
            steps: [
              'Admin Panel → find the user → click "Reset Password"',
              'A new random password is generated and shown ONCE',
              'Copy and share securely (WhatsApp, encrypted message)',
              'User should change it immediately on next login',
            ],
          },
          {
            heading: 'Setting Up 2FA (Green PIN)',
            steps: [
              'Admin Panel → find the user → click "Generate PIN"',
              'A 6-digit PIN is shown ONCE — share it securely with the user',
              'From next login, they must enter this PIN after their password',
              'To remove 2FA: click "Remove PIN" → confirm',
            ],
            tip: 'Enable Green PIN for all Admin accounts — it adds critical security against unauthorized access.',
          },
          {
            heading: 'Activating / Deactivating Users',
            note: 'Click the toggle next to any user to Deactivate (blocks login) or Reactivate them. All their data is preserved.',
          },
        ],
      },
      {
        id: 'settings',
        icon: '⚙️',
        title: 'Settings (Admin)',
        subsections: [
          {
            heading: 'Email (SMTP) Setup',
            table: {
              headers: ['Field', 'What to Enter'],
              rows: [
                ['SMTP Host', 'smtp.gmail.com for Gmail, or your mail server'],
                ['SMTP Port', '587 for TLS (recommended), 465 for SSL'],
                ['SMTP Username', 'Your full email address'],
                ['SMTP Password', 'For Gmail: use an App Password (not your Google password)'],
                ['From Name', 'Display name, e.g. "Wizone Team"'],
              ],
            },
            tip: 'Gmail App Password: Google Account → Security → 2-Step Verification → App Passwords → Create one for "Mail".',
          },
          {
            heading: 'Testing Email',
            steps: [
              'Settings → Email → click "Send Test Email"',
              'Enter any email address to receive the test',
              'Check your inbox — confirm delivery',
              'If it fails: double-check SMTP credentials and port',
            ],
          },
          {
            heading: 'Email Templates',
            note: 'Create templates with variable placeholders. Variables are replaced with real lead data when sent.',
            table: {
              headers: ['Variable', 'Replaced With'],
              rows: [
                ['{{full_name}}', 'Lead\'s full name'],
                ['{{email}}', 'Lead\'s email address'],
                ['{{phone}}', 'Lead\'s phone number'],
                ['{{company}}', 'Lead\'s company name'],
                ['{{slot_date}}', 'Appointment date'],
                ['{{slot_time}}', 'Appointment time'],
                ['{{meet_link}}', 'Google Meet link'],
                ['{{company_name}}', 'Your company name (from Company Info)'],
              ],
            },
          },
          {
            heading: 'WhatsApp Setup (Interakt)',
            steps: [
              'Create an account at interakt.shop',
              'Get your API Key from Interakt dashboard',
              'Settings → WhatsApp → paste the API Key',
              'Click Test to verify it works',
            ],
          },
        ],
      },
      {
        id: 'permissions',
        icon: '🔒',
        title: 'Roles & Permissions',
        subsections: [
          {
            heading: 'Permission Matrix',
            table: {
              headers: ['Action', 'Admin', 'Sales', 'Support'],
              rows: [
                ['View Dashboard', '✅', '✅', '✅'],
                ['View All Leads', '✅', '✅', '✅'],
                ['Add / Edit Leads', '✅', '✅', '❌'],
                ['Delete Leads', '✅', '✅', '❌'],
                ['Update Lead Status', '✅', '✅', '✅'],
                ['Add Follow-up Notes', '✅', '✅', '✅'],
                ['Send Email / WhatsApp', '✅', '✅', '✅'],
                ['Book / Change Slots', '✅', '✅', '❌'],
                ['View Converted Leads', '✅', '✅', '✅'],
                ['Manage Lead Sources', '✅', '❌', '❌'],
                ['Manage Users & Team', '✅', '❌', '❌'],
                ['Change Settings', '✅', '❌', '❌'],
                ['Manage Email Templates', '✅', '❌', '❌'],
              ],
            },
          },
        ],
      },
      {
        id: 'tips',
        icon: '⭐',
        title: 'Tips & Best Practices',
        subsections: [
          {
            heading: 'Daily Routine for Sales Agents',
            steps: [
              'Telegram: /today → Review today\'s meeting schedule',
              'Dashboard → Check "Today\'s FollowUp" count',
              'Leads → Click "Today\'s FollowUp" card → Work through the list',
              'Leads → Click "Today\'s Meetings" card → Prepare for demos',
              'Update lead status after every interaction',
              'Add a FollowUp note after every call, email, or message',
            ],
          },
          {
            heading: 'Tips for Sales Agents',
            steps: [
              'Search before adding — check if lead already exists to avoid duplicates',
              'Book a slot before manually sending meet links — system auto-generates and emails it',
              'Use the Nurture sub-table monthly to re-engage long-term leads',
              'Check the FollowUp history before calling — know what was discussed before',
              'Add your WhatsApp number to the lead for easier communication tracking',
            ],
          },
          {
            heading: 'Tips for Admins',
            steps: [
              'Test email & WhatsApp in Settings before going live',
              'Enable Green PIN (2FA) for all Admin accounts',
              'Check Source Performance on Dashboard weekly to see best converting sources',
              'Pause sources you don\'t need — don\'t delete them (keeps historical data)',
              'Assign leads to specific agents so workload is tracked per team member',
            ],
          },
        ],
      },
    ],
  },

  /* ───── HINDI ───── */
  hi: {
    pageTitle: 'उपयोगकर्ता गाइड',
    pageSubtitle: 'Wizone LMS उपयोग करने की चरण-दर-चरण गाइड',
    searchPlaceholder: 'गाइड में खोजें…',
    tipLabel: '💡 सुझाव',
    noteLabel: '📌 ध्यान दें',
    sections: [
      {
        id: 'login',
        icon: '🔐',
        title: 'लॉगिन और एक्सेस',
        subsections: [
          {
            heading: 'लॉगिन कैसे करें',
            steps: [
              'अपने ब्राउज़र में LMS URL खोलें',
              'अपना Email और Password डालें',
              'अगर 2FA (Green PIN) चालू है — 15 मिनट के अंदर 6-अंकीय PIN डालें',
              'आप Dashboard पर पहुँच जाएंगे',
            ],
            tip: '10 बार गलत लॉगिन के बाद आपका IP 15 मिनट के लिए ब्लॉक हो जाता है। Admin से संपर्क करें।',
          },
          {
            heading: 'साइडबार नेविगेशन',
            table: {
              headers: ['पेज', 'कौन देख सकता है', 'उपयोग'],
              rows: [
                ['🏠 Dashboard', 'सभी', 'Live stats, charts, reminders'],
                ['👥 Leads', 'सभी', 'मुख्य lead pipeline'],
                ['✅ Converted Leads', 'सभी', 'सभी converted leads'],
                ['🔗 Lead Sources', 'केवल Admin', 'Lead capture sources प्रबंधित करें'],
                ['🛡️ Admin Panel', 'केवल Admin', 'Team और users प्रबंधित करें'],
                ['⚙️ Settings', 'केवल Admin', 'Email, WhatsApp, Telegram कॉन्फ़िगरेशन'],
                ['📖 User Guide', 'सभी', 'यह गाइड!'],
              ],
            },
          },
          {
            heading: 'Lead के प्रकार',
            note: 'हर lead Type 1 या Type 2 होती है — इससे तय होता है कि कौन सा automation चलेगा।',
            table: {
              headers: ['Type', 'लेबल', 'मतलब'],
              rows: [
                ['Type 1', 'Meeting Booked ✅', 'Lead का slot बुक है — meeting reminders automatic चलते हैं'],
                ['Type 2', 'No Meeting ⚠️', 'Lead follow-up mode में है — 7-दिन email drip automatic चलता है'],
              ],
            },
          },
          {
            heading: 'Lead Status के रंग',
            table: {
              headers: ['Status', 'रंग', 'मतलब'],
              rows: [
                ['New', '🔵 नीला', 'अभी आई, अभी तक contact नहीं हुआ'],
                ['FollowUp', '🟡 पीला', 'Follow-up चल रहा है'],
                ['DemoGiven', '🟣 बैंगनी', 'Demo/meeting हो चुकी है'],
                ['Converted', '🟢 हरा', 'सफलतापूर्वक close हुआ — Converted Leads page पर जाता है'],
                ['Lost', '🔴 लाल', 'Deal नहीं बनी — Lost sub-table में जाता है'],
                ['Nurture', '🩷 गुलाबी', 'लंबे समय की lead, अभी तैयार नहीं — Nurture sub-table में जाता है'],
              ],
            },
          },
        ],
      },
      {
        id: 'dashboard',
        icon: '📊',
        title: 'Dashboard',
        subsections: [
          {
            heading: 'Stats Cards (ऊपरी पंक्ति)',
            table: {
              headers: ['Card', 'क्या दिखाता है'],
              rows: [
                ['Total Leads', 'System में अब तक की सभी leads'],
                ['New Leads', 'New status वाली leads'],
                ['Meetings Booked', 'Type 1 leads जिनका slot बुक है'],
                ['Converted', 'सफलतापूर्वक close हुई leads'],
                ['Lost', 'Lost mark हुई leads'],
                ['Welcome Sent', 'Leads जिन्हें welcome email/WhatsApp मिला'],
              ],
            },
            tip: 'Stats live update होती हैं — page refresh की जरूरत नहीं। नई lead आते ही numbers बदल जाते हैं।',
          },
          {
            heading: 'Charts और Visuals',
            steps: [
              'Lead Trend (Area Chart) — पिछले 7 दिनों में रोज़ कितनी leads आईं। Hover करें exact count देखने के लिए।',
              'Conversion by Agent (Bar Chart) — हर team member ने कितनी leads convert कीं।',
              'Leads by Source (Donut Chart) — कौन से source से सबसे ज़्यादा leads आती हैं।',
              'Source Performance Table — हर source की conversion rate %।',
            ],
          },
          {
            heading: 'Recent Leads Panel',
            note: 'सबसे हाल की 10 leads दिखाता है। किसी भी row पर click करें पूरी Lead Detail page खोलने के लिए।',
          },
          {
            heading: 'Upcoming Reminders Panel',
            note: 'अगले 4 घंटों में चलने वाले सभी automated reminders दिखाता है — lead का नाम, type, channel, और समय।',
          },
        ],
      },
      {
        id: 'leads',
        icon: '👥',
        title: 'Leads Page',
        subsections: [
          {
            heading: 'तीन-भाग का Layout',
            note: 'Leads page 3 अलग हिस्सों में बँटा है — ऊपर Active Pipeline, फिर Nurture, फिर Lost नीचे।',
            table: {
              headers: ['हिस्सा', 'क्या दिखाता है'],
              rows: [
                ['Main Table (ऊपर)', 'सिर्फ New • FollowUp • DemoGiven leads'],
                ['Nurture Sub-table', 'सिर्फ Nurture-status leads'],
                ['Lost Sub-table', 'सिर्फ Lost-status leads'],
              ],
            },
          },
          {
            heading: 'Status Cards — Quick Filters',
            table: {
              headers: ['Card', 'Click करने पर क्या होता है'],
              rows: [
                ['🔵 New / 🟡 FollowUp / 🟣 DemoGiven', 'Main table उस status पर filter हो जाती है'],
                ['🟢 Converted ↗', 'Converted Leads page पर navigate करता है'],
                ['🔴 Lost ↓', 'Lost sub-table तक scroll करता है'],
                ['🩷 Nurture ↓', 'Nurture sub-table तक scroll करता है'],
              ],
            },
          },
          {
            heading: 'Search और Filter Bar',
            steps: [
              'Search box — नाम, email, या phone type करें। Results तुरंत filter होती हैं।',
              'All Statuses dropdown — किसी specific status पर filter करें।',
              'All Sources dropdown — lead source के हिसाब से filter करें।',
              'All Types — Meeting Booked vs No Meeting।',
              'Clear (N) button — सभी active filters एक साथ हटाएं।',
            ],
          },
          {
            heading: 'Action Buttons (हर Row में)',
            table: {
              headers: ['Button', 'Icon', 'क्या करता है'],
              rows: [
                ['View', '👁️', 'पूरी Lead Detail page खोलता है'],
                ['Assign', '👤', 'Lead को team member को assign/reassign करता है'],
                ['FollowUp', '💬', 'Note जोड़ें + status update करें (modal खुलता है)'],
                ['Email', '✉️', 'Manual email भेजें'],
                ['WhatsApp', '📱', 'Manual WhatsApp message भेजें'],
                ['Meet Link', '🎥', 'Google Meet link generate/regenerate करें'],
                ['Delete', '🗑️', 'Lead delete करें (confirmation लेता है)'],
              ],
            },
          },
          {
            heading: 'नई Lead कैसे जोड़ें',
            steps: [
              '"+ Add Lead" button पर click करें (ऊपर दाईं तरफ)',
              'Full Name (जरूरी), Phone, Email, Company, Industry भरें',
              'Source और Client Type चुनें (Type 1 = meeting है, Type 2 = meeting नहीं)',
              'Type 1 के लिए: Slot Date और Time भरें',
              'Save पर click करें',
            ],
            tip: 'Save करने पर: welcome email + WhatsApp automatic भेजे जाते हैं, reminders schedule होते हैं, Telegram पर admin को notify किया जाता है।',
          },
          {
            heading: 'FollowUp Modal — कैसे उपयोग करें',
            steps: [
              'किसी भी lead row पर 💬 button click करें',
              'Status Update — नया status button click करें',
              'Note लिखें — इस interaction में क्या हुआ वो लिखें',
              'Next Follow-up Date — अगली बार contact करने की date set करें',
              'Save FollowUp click करें',
              'नीचे Activity History देखें — हर पुरानी activity listed है',
            ],
            tip: 'हर call के बाद note जरूर लिखें, चाहे short हो ("Call किया, नहीं उठाया")। इससे complete history बनती है।',
          },
        ],
      },
      {
        id: 'lead-detail',
        icon: '📋',
        title: 'Lead Detail Page',
        subsections: [
          {
            heading: 'Lead Detail कैसे खोलें',
            steps: [
              'किसी भी lead row पर 👁️ View button click करें',
              'या FollowUp modal में lead का नाम click करें',
            ],
          },
          {
            heading: 'Lead Information Edit करना',
            note: 'कोई भी field click करें उसे edit करने के लिए। Changes automatically save होती हैं और activity timeline में आपके नाम और timestamp के साथ log होती हैं।',
          },
          {
            heading: 'Slot बुक करना / बदलना (Type 1 Leads)',
            steps: [
              '"Set Slot" या "Reschedule" button click करें',
              'Calendar से date चुनें',
              'Available time slots दिखती हैं — booked वाले greyed out हैं',
              'अपना time slot चुनें',
              'अगर कोई meeting ±1 घंटे के अंदर है — conflict warning दिखेगी',
              'Confirm click करें',
            ],
            tip: 'Save करने पर: Google Meet link automatic बनता है और lead को email किया जाता है।',
          },
          {
            heading: 'Meeting Status के चरण',
            table: {
              headers: ['Status', 'Icon', 'मतलब'],
              rows: [
                ['Upcoming', '🗓️', 'Meeting scheduled है'],
                ['In Progress', '▶️', 'Meeting अभी हो रही है'],
                ['Completed', '✅', 'Meeting सफलतापूर्वक हुई'],
                ['Missed', '❌', 'Lead नहीं आया'],
                ['Rescheduled', '🔄', 'Meeting का समय बदला गया'],
              ],
            },
          },
          {
            heading: 'Automated Reminders',
            table: {
              headers: ['Reminder', 'कब भेजा जाता है', 'Channel'],
              rows: [
                ['Welcome', 'Create होते ही तुरंत', 'Email + WhatsApp'],
                ['Day 1 Follow-up', 'Create के 24 घंटे बाद', 'Email'],
                ['Day 3 Follow-up', 'Create के 3 दिन बाद', 'Email'],
                ['Day 5 Follow-up', 'Create के 5 दिन बाद', 'Email'],
                ['Day 7 Follow-up', 'Create के 7 दिन बाद', 'Email'],
                ['4 Days Before Meeting', 'Slot से 4 दिन पहले', 'Email + WhatsApp'],
                ['Same Day 9 AM', 'Meeting वाले दिन सुबह 9 बजे', 'Email + WhatsApp'],
                ['30 Min Before', 'Slot से 30 मिनट पहले', 'Email'],
                ['Post-Meeting', 'Slot के 1 घंटे बाद', 'Email'],
              ],
            },
          },
        ],
      },
      {
        id: 'converted',
        icon: '✅',
        title: 'Converted Leads',
        subsections: [
          {
            heading: 'Converted Leads कैसे देखें',
            steps: [
              'Sidebar में "Converted Leads" click करें',
              'या Leads page पर 🟢 Converted status card click करें — सीधे यहाँ navigate होगा',
            ],
          },
          {
            heading: 'क्या दिखता है',
            note: 'केवल Converted-status leads की dedicated table। ऊपर Total Converted और This Month का count दिखता है। किसी भी row पर View click करें Lead Detail खोलने के लिए।',
          },
        ],
      },
      {
        id: 'telegram',
        icon: '✈️',
        title: 'Telegram Bot',
        subsections: [
          {
            heading: 'Bot Commands',
            note: 'Telegram खोलें → @Wizone_LMS_bot search करें → कोई भी command भेजें।',
            table: {
              headers: ['Command', 'क्या मिलता है'],
              rows: [
                ['/start', 'Welcome message + सभी commands की list'],
                ['/today', 'आज की सभी meetings (नाम, company, phone, time, meet link)'],
                ['/tomorrow', 'कल की सभी meetings'],
                ['/leads', 'Status के हिसाब से active leads का count'],
              ],
            },
          },
          {
            heading: 'Automatic Daily Notifications',
            table: {
              headers: ['समय / Trigger', 'Notification'],
              rows: [
                ['हर दिन सुबह 9:00 बजे', '🌅 आज की सभी meetings की पूरी list'],
                ['Slot से 60 मिनट पहले', '⏰ Reminder — lead नाम + time + meet link'],
                ['Slot से 30 मिनट पहले', '🔔 Reminder — "30 मिनट में meeting"'],
                ['Slot से 15 मिनट पहले', '🚨 Urgent — "15 मिनट में meeting!"'],
              ],
            },
            tip: 'Bot को team Telegram group में add करें ताकि सभी team members को reminders मिलें।',
          },
        ],
      },
      {
        id: 'sources',
        icon: '🔗',
        title: 'Lead Sources (Admin)',
        subsections: [
          {
            heading: 'Lead Source के प्रकार',
            table: {
              headers: ['Type', 'कैसे काम करता है'],
              rows: [
                ['📘 Meta / Facebook Ads', 'Facebook & Instagram ad form submissions webhook से automatic आती हैं'],
                ['🌐 Landing Page / Form', 'कोई भी web form API key के साथ POST करके leads भेज सकता है'],
                ['🗄️ External Database', 'आपका PostgreSQL या MSSQL database हर 5 मिनट में poll होता है'],
              ],
            },
          },
          {
            heading: 'Meta Source Setup',
            steps: [
              'Lead Sources → Add Source → Meta चुनें',
              'दिखाया गया Webhook URL copy करें',
              'Meta Business Suite → Webhooks → URL paste करें',
              'Verify Token डालें (LMS में जो है वही)',
              'Save करें — अब Facebook/Instagram ad leads automatic आएंगी',
            ],
          },
          {
            heading: 'Landing Page Source Setup',
            steps: [
              'Lead Sources → Add Source → Landing Page चुनें',
              'API Key copy करें (format: wz_xxxxxx)',
              'अपने web form से /api/capture पर POST request भेजें',
              'Header में डालें: x-api-key: wz_your_key',
              'Required field: full_name। Optional: email, phone, company, slot_date, slot_time',
            ],
          },
          {
            heading: 'External Database Setup',
            steps: [
              'Lead Sources → Add Source → External DB चुनें',
              'Database type, Host, Port, Database, Username, Password डालें',
              'Test Connection click करें',
              'Leads वाली table select करें',
              'Columns को LMS fields से map करें (auto-suggest available है)',
              'Save करें — sync हर 5 मिनट में automatic होगा',
            ],
            tip: 'Deduplication automatic है — जो leads पहले से LMS में हैं (email/phone match से) वो skip हो जाती हैं।',
          },
        ],
      },
      {
        id: 'team',
        icon: '🛡️',
        title: 'Team Management (Admin)',
        subsections: [
          {
            heading: 'नया Team Member जोड़ना',
            steps: [
              'Admin Panel → "+ Add User" click करें',
              'Name, Email, Role भरें',
              'Temporary password ONCE दिखाया जाता है — copy करें और securely share करें',
              'User login करे और password तुरंत बदले',
            ],
          },
          {
            heading: 'User Roles',
            table: {
              headers: ['Role', 'क्या कर सकते हैं'],
              rows: [
                ['Admin', 'Full access — सभी pages, settings, user management, sources'],
                ['Sales', 'Leads, communications, अपना profile। Admin/Settings access नहीं।'],
                ['Support', 'Leads देखें, follow-up notes जोड़ें, messages भेजें'],
              ],
            },
          },
          {
            heading: 'Password Reset',
            steps: [
              'Admin Panel → user खोजें → "Reset Password" click करें',
              'New random password ONCE generate होता है',
              'Copy करें और securely share करें',
              'User को next login पर password बदलना चाहिए',
            ],
          },
          {
            heading: '2FA (Green PIN) Setup',
            steps: [
              'Admin Panel → user खोजें → "Generate PIN" click करें',
              '6-digit PIN ONCE दिखाया जाता है — securely share करें',
              'अब से उनका हर login: पहले password, फिर PIN',
              '2FA हटाना: "Remove PIN" → confirm करें',
            ],
            tip: 'सभी Admin accounts पर Green PIN जरूर enable करें — unauthorized access से बचाता है।',
          },
        ],
      },
      {
        id: 'settings',
        icon: '⚙️',
        title: 'Settings (Admin)',
        subsections: [
          {
            heading: 'Email (SMTP) Setup',
            table: {
              headers: ['Field', 'क्या डालें'],
              rows: [
                ['SMTP Host', 'Gmail के लिए smtp.gmail.com, या अपना mail server'],
                ['SMTP Port', 'TLS के लिए 587 (recommended), SSL के लिए 465'],
                ['SMTP Username', 'पूरा email address'],
                ['SMTP Password', 'Gmail के लिए: App Password (Google login password नहीं)'],
                ['From Name', 'Display name, जैसे "Wizone Team"'],
              ],
            },
            tip: 'Gmail App Password: Google Account → Security → 2-Step Verification → App Passwords → "Mail" के लिए बनाएं।',
          },
          {
            heading: 'Email Test करना',
            steps: [
              'Settings → Email → "Send Test Email" click करें',
              'कोई भी email address डालें test receive करने के लिए',
              'Inbox check करें — delivery confirm करें',
              'अगर fail हो: SMTP credentials और port दोबारा check करें',
            ],
          },
          {
            heading: 'Email Template Variables',
            table: {
              headers: ['Variable', 'किससे Replace होता है'],
              rows: [
                ['{{full_name}}', 'Lead का पूरा नाम'],
                ['{{email}}', 'Lead का email'],
                ['{{phone}}', 'Lead का phone number'],
                ['{{company}}', 'Lead की company'],
                ['{{slot_date}}', 'Appointment की date'],
                ['{{slot_time}}', 'Appointment का time'],
                ['{{meet_link}}', 'Google Meet link'],
                ['{{company_name}}', 'आपकी company का नाम'],
              ],
            },
          },
          {
            heading: 'WhatsApp Setup (Interakt)',
            steps: [
              'interakt.shop पर account बनाएं',
              'Interakt dashboard से API Key लें',
              'Settings → WhatsApp → API Key paste करें',
              'Test click करें verify करने के लिए',
            ],
          },
        ],
      },
      {
        id: 'permissions',
        icon: '🔒',
        title: 'Roles और Permissions',
        subsections: [
          {
            heading: 'Permission Matrix',
            table: {
              headers: ['Action', 'Admin', 'Sales', 'Support'],
              rows: [
                ['Dashboard देखें', '✅', '✅', '✅'],
                ['सभी Leads देखें', '✅', '✅', '✅'],
                ['Lead जोड़ें / Edit करें', '✅', '✅', '❌'],
                ['Lead Delete करें', '✅', '✅', '❌'],
                ['Lead Status बदलें', '✅', '✅', '✅'],
                ['Follow-up Notes जोड़ें', '✅', '✅', '✅'],
                ['Email / WhatsApp भेजें', '✅', '✅', '✅'],
                ['Slot बुक / बदलें', '✅', '✅', '❌'],
                ['Converted Leads देखें', '✅', '✅', '✅'],
                ['Lead Sources manage करें', '✅', '❌', '❌'],
                ['Users और Team manage करें', '✅', '❌', '❌'],
                ['Settings बदलें', '✅', '❌', '❌'],
                ['Email Templates manage करें', '✅', '❌', '❌'],
              ],
            },
          },
        ],
      },
      {
        id: 'tips',
        icon: '⭐',
        title: 'Tips और Best Practices',
        subsections: [
          {
            heading: 'Sales Agents की Daily Routine',
            steps: [
              'Telegram: /today → आज की meetings का schedule देखें',
              'Dashboard → "Today\'s FollowUp" count check करें',
              'Leads → "Today\'s FollowUp" card click करें → list work करें',
              'Leads → "Today\'s Meetings" card click करें → demos की तैयारी करें',
              'हर interaction के बाद lead status update करें',
              'हर call, email, message के बाद FollowUp note जोड़ें',
            ],
          },
          {
            heading: 'Sales Agents के लिए Tips',
            steps: [
              'Add करने से पहले search करें — duplicate avoid करने के लिए',
              'Meet link manually भेजने से पहले slot book करें — system auto-generate और email करता है',
              'Nurture sub-table को monthly revisit करें long-term leads के लिए',
              'Call करने से पहले FollowUp history देखें — पता चलेगा पहले क्या discuss हुआ था',
            ],
          },
          {
            heading: 'Admins के लिए Tips',
            steps: [
              'Live जाने से पहले Settings में email और WhatsApp test करें',
              'सभी Admin accounts पर Green PIN (2FA) enable करें',
              'Dashboard पर Source Performance weekly check करें',
              'Sources pause करें, delete नहीं — historical data बचता है',
              'Leads को specific agents को assign करें ताकि per-member tracking हो',
            ],
          },
        ],
      },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════
   UserGuidePage Component
═══════════════════════════════════════════════════════════════ */
export default function UserGuidePage() {
  const [lang, setLang] = useState(() => localStorage.getItem('guideLanguage') || 'en');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState('login');
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(GUIDE.en.sections.map(s => [s.id, true]))
  );
  const contentRef = useRef(null);

  const guide = GUIDE[lang];

  function switchLang(l) {
    setLang(l);
    localStorage.setItem('guideLanguage', l);
  }

  function toggleSection(id) {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function scrollToSection(id) {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }

  // Highlight active TOC item on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('section-', '');
            setActiveId(id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    guide.sections.forEach(s => {
      const el = document.getElementById(`section-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [lang]);

  // Filter sections by search
  const filteredSections = search.trim()
    ? guide.sections.map(section => ({
        ...section,
        subsections: section.subsections.filter(sub =>
          sub.heading?.toLowerCase().includes(search.toLowerCase()) ||
          sub.steps?.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
          sub.note?.toLowerCase().includes(search.toLowerCase()) ||
          sub.tip?.toLowerCase().includes(search.toLowerCase()) ||
          sub.table?.rows?.some(r => r.some(c => c.toLowerCase().includes(search.toLowerCase())))
        ),
      })).filter(s => s.subsections.length > 0)
    : guide.sections;

  return (
    <div className="flex gap-0 h-full min-h-screen" style={{ background: '#f8fafc' }}>

      {/* ── Left TOC ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 sticky top-0 h-screen
                        bg-white border-r border-slate-200/80 overflow-y-auto"
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,.03)' }}>

        {/* Language Toggle */}
        <div className="px-4 pt-5 pb-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Language</p>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button onClick={() => switchLang('en')}
              className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${
                lang === 'en' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              🇬🇧 EN
            </button>
            <button onClick={() => switchLang('hi')}
              className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${
                lang === 'hi' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              🇮🇳 हिं
            </button>
          </div>
        </div>

        {/* TOC */}
        <nav className="px-3 py-3 flex-1">
          <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Contents</p>
          {guide.sections.map(section => (
            <button key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl mb-0.5
                          text-xs font-semibold transition-all ${
                activeId === section.id
                  ? 'bg-brand-50 text-brand-700 border border-brand-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}>
              <span className="text-base leading-none">{section.icon}</span>
              <span className="truncate">{section.title}</span>
            </button>
          ))}
        </nav>

        {/* Quick Ref Card */}
        <div className="m-3 p-3 rounded-xl bg-brand-50 border border-brand-200/60">
          <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-2">Telegram Commands</p>
          {['/today','/tomorrow','/leads','/start'].map(cmd => (
            <div key={cmd} className="font-mono text-[11px] font-bold text-brand-700 bg-white
                                      rounded-lg px-2 py-1 mb-1 border border-brand-100">
              {cmd}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" ref={contentRef}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

          {/* Page Header */}
          <div className="mb-8">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <span className="text-3xl">📖</span>
                  {guide.pageTitle}
                </h1>
                <p className="text-slate-500 text-sm mt-1">{guide.pageSubtitle}</p>
              </div>
              {/* Mobile language toggle */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm lg:hidden">
                <button onClick={() => switchLang('en')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    lang === 'en' ? 'bg-brand-500 text-white' : 'text-slate-500'
                  }`}>🇬🇧 EN</button>
                <button onClick={() => switchLang('hi')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    lang === 'hi' ? 'bg-brand-500 text-white' : 'text-slate-500'
                  }`}>🇮🇳 हिं</button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={guide.searchPlaceholder}
                className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-4
                           text-sm text-slate-700 placeholder-slate-400 shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"/>
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              )}
            </div>

            {search && (
              <p className="text-xs text-slate-400 mt-2 font-medium">
                {filteredSections.reduce((a, s) => a + s.subsections.length, 0)} result(s) for "{search}"
              </p>
            )}
          </div>

          {/* Sections */}
          {filteredSections.map((section) => (
            <div key={section.id} id={`section-${section.id}`}
              className="mb-8 scroll-mt-6">

              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 mb-4 group">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0
                                bg-brand-50 border border-brand-200/60">
                  {section.icon}
                </div>
                <h2 className="text-lg font-black text-slate-800 flex-1 text-left group-hover:text-brand-700
                               transition-colors">
                  {section.title}
                </h2>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${openSections[section.id] ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>

              {openSections[section.id] && (
                <div className="space-y-4 pl-0 sm:pl-4">
                  {section.subsections.map((sub, si) => (
                    <div key={si}
                      className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>

                      {/* Subsection heading */}
                      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                        <h3 className="text-sm font-bold text-slate-800">{sub.heading}</h3>
                      </div>

                      <div className="px-5 py-4 space-y-4">

                        {/* Note box */}
                        {sub.note && (
                          <div className="flex gap-3 bg-sky-50 border border-sky-200/60 rounded-xl px-4 py-3">
                            <span className="text-sky-500 shrink-0 text-sm mt-0.5">📌</span>
                            <p className="text-sm text-sky-800 font-medium leading-relaxed">{sub.note}</p>
                          </div>
                        )}

                        {/* Steps */}
                        {sub.steps && (
                          <ol className="space-y-2">
                            {sub.steps.map((step, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-[11px]
                                                 font-black flex items-center justify-center shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {/* Table */}
                        {sub.table && (
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-200">
                                  {sub.table.headers.map((h, i) => (
                                    <th key={i}
                                      className="px-4 py-2.5 text-[11px] font-bold text-slate-600
                                                 uppercase tracking-wider text-left whitespace-nowrap">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sub.table.rows.map((row, ri) => (
                                  <tr key={ri}
                                    className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                                    style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    {row.map((cell, ci) => (
                                      <td key={ci}
                                        className={`px-4 py-2.5 text-sm leading-relaxed
                                          ${ci === 0 ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Tip box */}
                        {sub.tip && (
                          <div className="flex gap-3 bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-3">
                            <span className="text-amber-500 shrink-0 text-sm mt-0.5">💡</span>
                            <p className="text-sm text-amber-800 font-medium leading-relaxed">{sub.tip}</p>
                          </div>
                        )}

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-400 font-medium">
              Wizone LMS User Guide · v1.0 · {lang === 'hi' ? 'सहायता के लिए:' : 'Support:'}{' '}
              <a href="mailto:sachin@wizoneit.com"
                className="text-brand-500 hover:underline font-semibold">
                sachin@wizoneit.com
              </a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
