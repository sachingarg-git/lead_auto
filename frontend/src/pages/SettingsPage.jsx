import React from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n/index.js';

const integrations = [
  { label: 'Meta / Facebook Ads',  key: 'META_APP_SECRET',    icon: '📘', color: 'blue',
    desc: 'Set META_APP_SECRET, META_VERIFY_TOKEN in .env. Register your webhook URL with Meta: POST /api/webhook' },
  { label: 'Gmail / SMTP Email',   key: 'SMTP_USER',          icon: '📧', color: 'slate',
    desc: 'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env. Works with Gmail App Passwords.' },
  { label: 'Twilio WhatsApp',      key: 'TWILIO_ACCOUNT_SID', icon: '💬', color: 'green',
    desc: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM. Enable WhatsApp sandbox in Twilio.' },
  { label: 'Interakt WhatsApp',    key: 'INTERAKT_API_KEY',   icon: '💬', color: 'emerald',
    desc: 'Alternative to Twilio. Set INTERAKT_API_KEY in .env. Used as fallback if Twilio is not configured.' },
  { label: 'Telegram Bot',         key: 'TELEGRAM_BOT_TOKEN', icon: '✈️', color: 'sky',
    desc: 'Create bot via @BotFather. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID for admin alerts.' },
  { label: 'Redis (BullMQ)',        key: 'REDIS_HOST',         icon: '🔴', color: 'red',
    desc: 'Required for job scheduling. Install Redis locally or use Redis Cloud. Set REDIS_HOST, REDIS_PORT.' },
];

const INT_COLORS = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    code: 'bg-blue-100 text-blue-700'    },
  slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   code: 'bg-slate-100 text-slate-700'  },
  green:   { bg: 'bg-green-50',   border: 'border-green-200',   code: 'bg-green-100 text-green-700'  },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', code: 'bg-emerald-100 text-emerald-700' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-200',     code: 'bg-sky-100 text-sky-700'      },
  red:     { bg: 'bg-red-50',     border: 'border-red-200',     code: 'bg-red-100 text-red-700'      },
};

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.split('-')[0] || 'en';

  function handleLanguageChange(code) {
    i18n.changeLanguage(code);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">{t('settings.title')}</h2>
        <p className="text-sm text-slate-700 mt-0.5">{t('settings.subtitle')}</p>
      </div>

      {/* ── Language Selector ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5"
           style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center text-lg">🌐</div>
          <div>
            <h3 className="font-semibold text-slate-800">{t('settings.languageTitle')}</h3>
            <p className="text-xs text-slate-600 mt-0.5">{t('settings.languageSubtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SUPPORTED_LANGUAGES.map(lang => {
            const isActive = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                  isActive
                    ? 'border-brand-300 bg-brand-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${isActive ? 'text-brand-600' : 'text-slate-700'}`}>
                    {lang.label}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 uppercase tracking-wider">
                    {lang.code} · {lang.dir.toUpperCase()}
                  </div>
                </div>
                {isActive && (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 border border-brand-300
                                   flex items-center justify-center">
                    <svg className="w-3 h-3 text-brand-600" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* RTL note */}
        {['fa', 'ar', 'ur'].includes(currentLang) && (
          <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <span className="text-blue-500 text-sm">↔️</span>
            <p className="text-xs text-blue-600">{t('settings.rtlNote')}</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('settings.currentLanguage')}: <span className="text-slate-600 font-medium ml-1">
            {SUPPORTED_LANGUAGES.find(l => l.code === currentLang)?.label || currentLang}
          </span>
          &nbsp;— {t('settings.selectLanguage').toLowerCase()}
        </div>
      </div>

      {/* ── Environment note ─────────────────────────────────── */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <span className="text-yellow-500 text-lg mt-0.5">⚠️</span>
          <div>
            <div className="font-semibold text-yellow-800 text-sm">{t('settings.envNote')}</div>
            <p className="text-xs text-yellow-700 mt-1 leading-relaxed">{t('settings.envDesc')}</p>
          </div>
        </div>
      </div>

      {/* ── Integration cards ─────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">
          {t('settings.integrationsTitle')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map(item => {
            const c = INT_COLORS[item.color] || INT_COLORS.slate;
            return (
              <div key={item.key}
                   className={`rounded-2xl border p-5 ${c.bg} ${c.border}`}
                   style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{item.icon}</span>
                  <h3 className="font-semibold text-slate-800 text-sm flex-1">{item.label}</h3>
                  <span className="text-[10px] font-semibold bg-white border border-slate-200
                                   text-slate-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    ENV Config
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{item.desc}</p>
                <code className={`block rounded-lg px-3 py-2 text-xs font-mono ${c.code}`}>
                  {item.key}=...
                </code>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Meta Webhook guide ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5"
           style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        <h3 className="font-semibold text-slate-800 mb-4">{t('settings.webhookTitle')}</h3>
        <ol className="space-y-3 text-sm">
          {[
            'Deploy your backend to a public URL (e.g., https://api.wizone.com)',
            'Go to Meta Developer Console → Your App → Webhooks',
            'Add webhook URL: https://your-domain.com/api/webhook',
            'Verify token: set the same value as META_VERIFY_TOKEN in your .env',
            'Subscribe to leadgen events under your Facebook Page',
            'Test with a sample lead form submission',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-600
                               text-xs flex items-center justify-center font-bold">
                {i + 1}
              </span>
              <span className="text-slate-600 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
