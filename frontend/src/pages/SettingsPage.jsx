import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { settingsApi } from '../services/api';

const VARS = [
  { v: '{{full_name}}',    label: 'Lead Name'    },
  { v: '{{phone}}',        label: 'Phone'        },
  { v: '{{email}}',        label: 'Email'        },
  { v: '{{company}}',      label: 'Lead Company' },
  { v: '{{company_name}}', label: 'Your Company' },
  { v: '{{slot_date}}',    label: 'Appt. Date'   },
  { v: '{{slot_time}}',    label: 'Appt. Time'   },
];

const LANG_OPTIONS = [
  { code: 'en', label: 'English', sub: 'EN · LTR', flag: 'GB' },
  { code: 'fa', label: 'فارسی',   sub: 'FA · RTL', flag: 'IR' },
  { code: 'hi', label: 'हिन्दी',  sub: 'HI · LTR', flag: 'IN' },
];

export default function SettingsPage() {
  const { i18n } = useTranslation();

  const [form, setForm] = useState({
    company_name: '', company_phone: '', company_website: '',
    smtp_enabled: 'false', smtp_host: 'smtp.gmail.com', smtp_port: '587',
    smtp_user: '', smtp_pass: '', smtp_from_name: '',
    interakt_enabled: 'false', interakt_api_key: '',
    email_welcome_subject: '', email_welcome_body: '',
    whatsapp_welcome_template: '',
  });
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [testEmailTo,  setTestEmailTo]  = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [section,      setSection]      = useState('gmail');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const tog = k => setForm(f => ({ ...f, [k]: f[k] === 'true' ? 'false' : 'true' }));

  useEffect(() => {
    settingsApi.getAll()
      .then(r => setForm(f => ({ ...f, ...r.data })))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.save(form);
      toast.success('Settings saved successfully!');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  }

  async function handleTestEmail() {
    if (!testEmailTo) { toast.error('Enter recipient email'); return; }
    setTestingEmail(true);
    try {
      await settingsApi.testEmail(testEmailTo);
      toast.success('Test email sent to ' + testEmailTo + '!');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Test failed. Check SMTP settings.');
    } finally { setTestingEmail(false); }
  }

  const insertVar = (field, v) => setForm(f => ({ ...f, [field]: (f[field] || '') + v }));

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
    </div>
  );

  const smtpOn     = form.smtp_enabled === 'true';
  const interaktOn = form.interakt_enabled === 'true';

  const NAV = [
    { id: 'gmail',     label: 'Gmail / Email',    dot: smtpOn     },
    { id: 'whatsapp',  label: 'WhatsApp',          dot: interaktOn },
    { id: 'templates', label: 'Message Templates', dot: false      },
    { id: 'company',   label: 'Company Info',      dot: false      },
    { id: 'language',  label: 'Language',          dot: false      },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-black text-slate-800">Settings & Integrations</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure automation channels, templates, and company info</p>
      </div>

      <form onSubmit={handleSave}>
        <div className="flex gap-5">

          {/* Left Nav */}
          <div className="w-52 shrink-0 space-y-1">
            {NAV.map(n => (
              <button type="button" key={n.id} onClick={() => setSection(n.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left
                            text-sm font-semibold transition-all
                            ${section === n.id
                              ? 'bg-brand-500 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'}`}>
                <span className="flex-1">{n.label}</span>
                {n.dot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
              </button>
            ))}
            <div className="pt-3">
              <button type="submit" disabled={saving}
                className="w-full h-10 rounded-xl bg-brand-500 hover:bg-brand-600 text-white
                           text-sm font-bold flex items-center justify-center gap-2 transition-all"
                style={{ boxShadow: '0 2px 10px rgba(14,170,218,.30)' }}>
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                  : '💾 Save All'}
              </button>
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* ── Gmail / SMTP ── */}
            {section === 'gmail' && (
              <SettingCard title="Gmail / SMTP Email"
                subtitle="Send automated welcome and follow-up emails to every new lead"
                badge={smtpOn ? 'Active' : null}>
                <div className="space-y-4">
                  <ToggleRow checked={smtpOn} onChange={() => tog('smtp_enabled')}
                    label="Enable Email Automation"
                    sub="Auto-send welcome email when a new lead arrives" />

                  {smtpOn && (
                    <>
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-700">
                        <strong>Gmail App Password required:</strong> Google Account → Security → 2-Step Verification → App Passwords.
                        Generate a password for "Mail" and paste below. Do NOT use your Gmail login password.
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <Lbl>Gmail Address (SMTP User)</Lbl>
                          <input className="input mt-1" type="email" placeholder="yourname@gmail.com"
                            value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} />
                        </div>
                        <div>
                          <Lbl>App Password</Lbl>
                          <input className="input mt-1" type="password" placeholder="xxxx xxxx xxxx xxxx"
                            value={form.smtp_pass} onChange={e => set('smtp_pass', e.target.value)} />
                        </div>
                        <div>
                          <Lbl>From Name (Sender)</Lbl>
                          <input className="input mt-1" placeholder="Wizone LMS"
                            value={form.smtp_from_name} onChange={e => set('smtp_from_name', e.target.value)} />
                        </div>
                        <div>
                          <Lbl>SMTP Host</Lbl>
                          <input className="input mt-1" value={form.smtp_host}
                            onChange={e => set('smtp_host', e.target.value)} />
                        </div>
                        <div>
                          <Lbl>SMTP Port</Lbl>
                          <input className="input mt-1" value={form.smtp_port}
                            onChange={e => set('smtp_port', e.target.value)} />
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-4">
                        <Lbl>Send Test Email</Lbl>
                        <div className="flex gap-2 mt-1.5">
                          <input className="input flex-1" type="email" placeholder="test@example.com"
                            value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)} />
                          <button type="button" onClick={handleTestEmail} disabled={testingEmail}
                            className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white
                                       text-sm font-bold flex items-center gap-2 shrink-0 transition-all">
                            {testingEmail
                              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                              : '📧 Send Test'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </SettingCard>
            )}

            {/* ── WhatsApp ── */}
            {section === 'whatsapp' && (
              <SettingCard title="WhatsApp — Interakt"
                subtitle="Auto-send WhatsApp messages to leads via Interakt API"
                badge={interaktOn ? 'Active' : null}>
                <div className="space-y-4">
                  <ToggleRow checked={interaktOn} onChange={() => tog('interakt_enabled')}
                    label="Enable WhatsApp Automation"
                    sub="Auto-send WhatsApp welcome message on every new lead" />

                  {interaktOn && (
                    <>
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[12px] text-emerald-700 space-y-1">
                        <strong>How to get your API Key:</strong>
                        <ol className="list-decimal ml-4 mt-1 space-y-0.5">
                          <li>Login to <strong>app.interakt.ai</strong></li>
                          <li>Go to Settings → Developer → API Keys</li>
                          <li>Copy the <strong>Base64 encoded API key</strong></li>
                          <li>Paste it below and click Save</li>
                        </ol>
                      </div>

                      <div>
                        <Lbl>Interakt API Key (Base64)</Lbl>
                        <input className="input mt-1 font-mono text-xs" type="password"
                          placeholder="Base64 encoded key from Interakt dashboard"
                          value={form.interakt_api_key}
                          onChange={e => set('interakt_api_key', e.target.value)} />
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
                        💡 Messages sent as free-text. For approved Meta templates, contact Interakt support.
                      </div>
                    </>
                  )}
                </div>
              </SettingCard>
            )}

            {/* ── Templates ── */}
            {section === 'templates' && (
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Available Variables — click to copy
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {VARS.map(v => (
                      <button type="button" key={v.v}
                        onClick={() => { navigator.clipboard?.writeText(v.v); toast.success('Copied ' + v.v); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200
                                   text-[11px] font-mono text-brand-600 hover:bg-brand-50 hover:border-brand-300
                                   transition-all cursor-copy">
                        {v.v}
                        <span className="text-slate-400 font-sans">{v.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Conditional: <code className="bg-slate-200 px-1 rounded">{'{{#if slot_date}}...{{/if}}'}</code> — shown only when a slot is booked
                  </p>
                </div>

                <SettingCard title="Email Welcome Template"
                  subtitle="Sent to every new lead that has an email address">
                  <div className="space-y-3">
                    <div>
                      <Lbl>Subject Line</Lbl>
                      <input className="input mt-1"
                        placeholder="Welcome {{full_name}}! We received your enquiry"
                        value={form.email_welcome_subject}
                        onChange={e => set('email_welcome_subject', e.target.value)} />
                    </div>
                    <div>
                      <Lbl>Body (plain text, supports variables)</Lbl>
                      <textarea
                        className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                                   text-[12px] font-mono text-slate-700 resize-y min-h-[150px] leading-relaxed
                                   focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                        value={form.email_welcome_body}
                        onChange={e => set('email_welcome_body', e.target.value)} />
                      <VarBar field="email_welcome_body" onInsert={insertVar} />
                    </div>
                  </div>
                </SettingCard>

                <SettingCard title="WhatsApp Welcome Template"
                  subtitle="Sent via Interakt to every new lead with a phone number">
                  <div className="space-y-3">
                    <div>
                      <Lbl>Message Body</Lbl>
                      <textarea
                        className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                                   text-[12px] font-mono text-slate-700 resize-y min-h-[150px] leading-relaxed
                                   focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                        value={form.whatsapp_welcome_template}
                        onChange={e => set('whatsapp_welcome_template', e.target.value)} />
                      <VarBar field="whatsapp_welcome_template" onInsert={insertVar} />
                    </div>

                    {form.whatsapp_welcome_template && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-1.5">
                          Live Preview (sample data)
                        </div>
                        <div className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {form.whatsapp_welcome_template
                            .replace(/\{\{#if slot_date\}\}[\s\S]*?\{\{\/if\}\}/g, '[slot block — shown when booked]')
                            .replace(/\{\{full_name\}\}/g,    'Rahul Sharma')
                            .replace(/\{\{phone\}\}/g,         '9876543210')
                            .replace(/\{\{company_name\}\}/g,  form.company_name || 'Wizone')
                            .replace(/\{\{slot_date\}\}/g,     '25 Apr 2026')
                            .replace(/\{\{slot_time\}\}/g,     '2:30 PM')
                            .replace(/\{\{[\w]+\}\}/g,         '...')}
                        </div>
                      </div>
                    )}
                  </div>
                </SettingCard>
              </>
            )}

            {/* ── Company ── */}
            {section === 'company' && (
              <SettingCard title="Company Information"
                subtitle="Used in email and WhatsApp templates as {{company_name}}, {{company_phone}}">
                <div className="space-y-3">
                  <div>
                    <Lbl>Company Name</Lbl>
                    <input className="input mt-1" placeholder="Wizone AI Labs Pvt. Ltd."
                      value={form.company_name} onChange={e => set('company_name', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Lbl>Contact Phone</Lbl>
                      <input className="input mt-1" placeholder="+91 99999 99999"
                        value={form.company_phone} onChange={e => set('company_phone', e.target.value)} />
                    </div>
                    <div>
                      <Lbl>Website URL</Lbl>
                      <input className="input mt-1" placeholder="https://wizone.ai"
                        value={form.company_website} onChange={e => set('company_website', e.target.value)} />
                    </div>
                  </div>
                </div>
              </SettingCard>
            )}

            {/* ── Language ── */}
            {section === 'language' && (
              <SettingCard title="Language & Region" subtitle="Interface language preference">
                <div className="grid grid-cols-3 gap-3">
                  {LANG_OPTIONS.map(l => {
                    const active = i18n.language === l.code;
                    return (
                      <button type="button" key={l.code}
                        onClick={() => i18n.changeLanguage(l.code)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left
                                    ${active
                                      ? 'border-brand-500 bg-brand-50'
                                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                          {l.flag}
                        </div>
                        <div>
                          <div className={`text-sm font-bold ${active ? 'text-brand-600' : 'text-slate-700'}`}>{l.label}</div>
                          <div className="text-[10px] text-slate-400">{l.sub}</div>
                        </div>
                        {active && (
                          <svg className="w-4 h-4 text-brand-500 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                  Current: <strong className="text-slate-600">{i18n.language}</strong> — affects UI only. Templates use whichever language you write them in.
                </p>
              </SettingCard>
            )}

          </div>
        </div>
      </form>
    </div>
  );
}

/* ── Shared Sub-components ─────────────────────────────────── */
function SettingCard({ title, subtitle, badge, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
            {badge && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                ● {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ToggleRow({ checked, onChange, label, sub }) {
  return (
    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
      <div>
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
      <button type="button" onClick={onChange}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${checked ? 'bg-brand-500' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function VarBar({ field, onInsert }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {VARS.map(v => (
        <button type="button" key={v.v} onClick={() => onInsert(field, v.v)}
          className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-600 rounded text-slate-500 transition-all">
          + {v.v}
        </button>
      ))}
    </div>
  );
}

function Lbl({ children }) {
  return <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">{children}</span>;
}
