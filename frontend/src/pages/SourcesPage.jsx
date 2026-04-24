import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import toast from 'react-hot-toast';

/* ── Source types (Meta + Landing Page only) ─────────────────── */
const SOURCE_TYPES = {
  meta:        { label: 'Meta / Facebook Ads', icon: '📘' },
  landing_page:{ label: 'Landing Page / Form',  icon: '🌐' },
};

/* card style per type */
const CARD_STYLE = {
  meta:        { border: 'border-blue-200',    headerBg: 'bg-blue-50',    dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 border border-blue-200'    },
  landing_page:{ border: 'border-emerald-200', headerBg: 'bg-emerald-50', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

/* ════════════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════════ */
export default function SourcesPage() {
  const { t } = useTranslation();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);   // null | 'add' | { source }

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/sources'); setSources(r.data); }
    catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(s) {
    try {
      await api.patch(`/sources/${s.id}`, { is_active: !s.is_active });
      toast.success(s.is_active ? 'Source paused' : 'Source activated');
      load();
    } catch {}
  }

  async function handleDelete(s) {
    if (!window.confirm(`Delete "${s.name}"?\n\nExisting leads are kept — new leads will stop.`)) return;
    try { await api.delete(`/sources/${s.id}`); toast.success('Deleted'); load(); } catch {}
  }

  async function handleRegenKey(s) {
    if (!window.confirm('Regenerate API key? Old key stops working immediately.')) return;
    try {
      const r = await api.post(`/sources/${s.id}/regenerate-key`);
      navigator.clipboard?.writeText(r.data.api_key);
      toast.success('New key generated & copied!');
      load();
    } catch {}
  }

  const totalLeads  = sources.reduce((a, s) => a + (s.lead_count || 0), 0);
  const activeCount = sources.filter(s => s.is_active).length;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Lead Sources</h1>
          <p className="text-sm text-slate-600 mt-1">
            Connect Meta Ads or your landing page — all leads land in the centralized Leads table automatically.
          </p>
        </div>
        <button onClick={() => setModal('add')}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600
                     text-white font-semibold px-5 py-2.5 rounded-xl transition-all
                     shadow-md shadow-brand-500/20">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Source
        </button>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      {sources.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Total Sources', value: sources.length, icon: '🔌', accent: '#0eaada', light: '#e0f4fb' },
            { label: 'Active',        value: activeCount,    icon: '⚡', accent: '#22c55e', light: '#dcfce7' },
            { label: 'Total Leads',   value: totalLeads,     icon: '👤', accent: '#3b82f6', light: '#dbeafe' },
          ].map(item => (
            <div key={item.label}
              className="bg-white border border-slate-200 rounded-2xl px-4 py-3
                         flex items-center gap-3 shadow-sm">
              <span className="text-xl w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: item.light }}>{item.icon}</span>
              <div>
                <div className="text-xl font-bold" style={{ color: item.accent }}>{item.value}</div>
                <div className="text-[11px] text-slate-600 font-medium">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Sources Grid ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-[0.15em]">Connected Sources</span>
          {sources.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 text-[10px] font-bold flex items-center justify-center">
              {sources.length}
            </span>
          )}
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-brand-200" />
              <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin absolute inset-0" />
            </div>
          </div>
        ) : !sources.length ? (
          <EmptyState onAdd={() => setModal('add')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sources.map(s => (
              <SourceCard key={s.id} source={s}
                onEdit={()     => setModal({ source: s })}
                onToggle={()   => handleToggle(s)}
                onDelete={()   => handleDelete(s)}
                onRegenKey={() => handleRegenKey(s)}
              />
            ))}
            {/* Ghost add card */}
            <button onClick={() => setModal('add')}
              className="group min-h-[180px] rounded-2xl border-2 border-dashed border-slate-200
                         hover:border-brand-300 hover:bg-brand-50/40
                         flex flex-col items-center justify-center gap-3 transition-all duration-300">
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300
                              group-hover:border-brand-400 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-600 group-hover:text-slate-700 transition-colors">
                Add another source
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Centralized Table Guide ───────────────────────────── */}
      <CentralTableGuide />

      {/* ── Modal ────────────────────────────────────────────── */}
      {modal && (
        <SourceModal
          editSource={modal?.source || null}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────────── */
function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center
                    border-2 border-dashed border-slate-200 rounded-2xl bg-white">
      <div className="text-5xl mb-4">🔌</div>
      <h3 className="text-slate-700 font-semibold text-lg mb-1">No sources connected yet</h3>
      <p className="text-slate-600 text-sm max-w-xs mb-6 leading-relaxed">
        Connect Meta Ads or add your landing page — leads flow into the centralized Leads table instantly.
      </p>
      <button onClick={onAdd} className="btn-primary">+ Connect First Source</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Source Card (no external_db actions)
═══════════════════════════════════════════════════════════════ */
function SourceCard({ source, onEdit, onToggle, onDelete, onRegenKey }) {
  const [copied,   setCopied]   = useState(false);
  const [showCode, setShowCode] = useState(false);
  const type  = source.source_type;
  const cfg   = SOURCE_TYPES[type] || {};
  const style = CARD_STYLE[type]   || CARD_STYLE.landing_page;

  function copyKey() {
    navigator.clipboard?.writeText(source.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`relative rounded-2xl border overflow-hidden flex flex-col
                     transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-white
                     ${style.border} ${!source.is_active ? 'opacity-60 saturate-50' : ''}`}
         style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>

      {!source.is_active && (
        <span className="absolute top-3 right-3 bg-yellow-50 border border-yellow-200
                         text-yellow-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Paused
        </span>
      )}

      {/* Header */}
      <div className={`p-4 pb-3 flex items-start gap-3 ${style.headerBg}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${style.badge}`}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-bold text-slate-800 text-[15px] leading-tight truncate" title={source.name}>
            {source.name}
          </h3>
          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${style.badge}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="px-4 py-3 flex items-center gap-4 text-xs border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <strong className="text-slate-700">{source.lead_count || 0}</strong>
          <span className="text-slate-600">leads</span>
        </div>
        {source.is_active && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
            <span className="text-slate-600 text-[10px] font-semibold uppercase tracking-wide">Live</span>
          </div>
        )}
      </div>

      {/* API Key (landing_page) */}
      {type === 'landing_page' && source.api_key && (
        <div className="mx-4 mb-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
          <div className="text-[10px] text-slate-600 mb-1.5 font-semibold uppercase tracking-wide">API Key</div>
          <div className="flex items-center gap-2">
            <code className="text-brand-600 text-[11px] font-mono flex-1 truncate">{source.api_key}</code>
            <button onClick={copyKey}
              className={`shrink-0 text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                copied
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              }`}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Meta source info */}
      {type === 'meta' && (
        <div className="mx-4 mb-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-700 space-y-0.5">
          <div className="font-semibold">Webhook endpoint:</div>
          <code className="text-[11px] break-all">{window.location.origin}/api/webhook</code>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto p-3 pt-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onEdit}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                       border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100
                       text-xs font-semibold transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button onClick={onToggle}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                        border text-xs font-semibold transition-all ${
              source.is_active
                ? 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}>
            {source.is_active ? '⏸ Pause' : '▶ Activate'}
          </button>
        </div>

        {type === 'landing_page' && (
          <button onClick={onRegenKey}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                       border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100
                       text-xs font-semibold transition-all">
            🔑 Regenerate API Key
          </button>
        )}

        <button onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl
                     text-[11px] font-medium text-red-400 hover:text-red-600
                     hover:bg-red-50 border border-transparent hover:border-red-200 transition-all">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Source
        </button>
      </div>

      {/* Code snippet (landing_page) */}
      {type === 'landing_page' && (
        <div className="px-3 pb-3">
          <button onClick={() => setShowCode(v => !v)}
            className="text-[11px] text-brand-500 hover:text-brand-600 flex items-center gap-1 transition-colors">
            <svg className={`w-2.5 h-2.5 transition-transform ${showCode ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Show integration code
          </button>
          {showCode && (
            <pre className="mt-2 bg-slate-800 border border-slate-700 rounded-xl p-3
                            text-slate-300 overflow-x-auto text-[10px] leading-relaxed font-mono">{
`fetch('${window.location.origin}/api/capture', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${source.api_key}'
  },
  body: JSON.stringify({
    full_name:  form.name,       // required
    phone:      form.phone,
    email:      form.email,
    company:    form.company,
    industry:   form.industry,
    slot_date:  form.date,       // "YYYY-MM-DD"
    slot_time:  form.time,       // "HH:MM"
    notes:      form.message
  })
});`
            }</pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Centralized Table Guide
   Shows the DB schema + API reference for the landing page dev
═══════════════════════════════════════════════════════════════ */
function CentralTableGuide() {
  const [open, setOpen] = useState(true);

  const API_URL = `${window.location.origin}/api/capture`;

  const FIELDS = [
    { field: 'full_name',  type: 'string',  req: true,  desc: 'Lead\'s full name' },
    { field: 'phone',      type: 'string',  req: false, desc: 'Mobile number (used for dedup & WhatsApp)' },
    { field: 'email',      type: 'string',  req: false, desc: 'Email address' },
    { field: 'whatsapp',   type: 'string',  req: false, desc: 'WhatsApp number (defaults to phone if blank)' },
    { field: 'company',    type: 'string',  req: false, desc: 'Company / organization name' },
    { field: 'industry',   type: 'string',  req: false, desc: 'Industry / sector' },
    { field: 'slot_date',  type: 'date',    req: false, desc: 'Appointment date — "YYYY-MM-DD"  e.g. 2025-05-20' },
    { field: 'slot_time',  type: 'time',    req: false, desc: 'Appointment time — "HH:MM"  e.g. 14:30' },
    { field: 'notes',      type: 'string',  req: false, desc: 'Message / query from the lead' },
    { field: 'tags',       type: 'string',  req: false, desc: 'Comma-separated tags' },
  ];

  const DB_COLUMNS = [
    { col: 'id',             type: 'INT IDENTITY',  note: 'Auto-increment primary key' },
    { col: 'full_name',      type: 'NVARCHAR(255)', note: 'Required' },
    { col: 'phone',          type: 'NVARCHAR(30)',  note: '' },
    { col: 'email',          type: 'NVARCHAR(255)', note: '' },
    { col: 'whatsapp_number',type: 'NVARCHAR(30)',  note: 'Defaults to phone' },
    { col: 'company',        type: 'NVARCHAR(255)', note: '' },
    { col: 'industry',       type: 'NVARCHAR(255)', note: '' },
    { col: 'slot_date',      type: 'DATE',          note: '★ Appointment date — indexed' },
    { col: 'slot_time',      type: 'TIME',          note: '★ Appointment time' },
    { col: 'preferred_slot', type: 'NVARCHAR(100)', note: 'Combined display string (auto-set)' },
    { col: 'meeting_datetime',type:'DATETIME2',     note: 'Auto-set from slot_date + slot_time' },
    { col: 'status',         type: 'NVARCHAR(30)',  note: 'New | FollowUp | DemoGiven | Converted | Lost | Nurture' },
    { col: 'client_type',    type: 'NVARCHAR(10)',  note: 'Type1 = slot booked, Type2 = drip follow-up' },
    { col: 'source',         type: 'NVARCHAR(150)', note: 'Auto-set from API key → LeadSource name' },
    { col: 'notes',          type: 'NVARCHAR(MAX)', note: '' },
    { col: 'tags',           type: 'NVARCHAR(500)', note: '' },
    { col: 'created_at',     type: 'DATETIME2',     note: 'Auto-set' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
         style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>

      {/* Header toggle */}
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center text-base">🗄️</div>
          <div>
            <div className="text-sm font-bold text-slate-800">Centralized Leads Table — API Reference</div>
            <div className="text-xs text-slate-600 mt-0.5">Schema, POST fields, and ready-to-use code for your landing page</div>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-600 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">

          {/* ── API Endpoint ────────────────────────────────── */}
          <div className="px-5 py-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">API Endpoint</h4>
            <div className="flex items-center gap-3">
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-lg">POST</span>
              <code className="text-sm text-brand-600 font-mono font-semibold">{API_URL}</code>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-700 space-y-1">
              <div><span className="font-semibold text-slate-800">Header:</span> <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">Content-Type: application/json</code></div>
              <div><span className="font-semibold text-slate-800">Header:</span> <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">x-api-key: wz_xxxxxxxxxxxxxxxx</code> <span className="text-slate-600">(from your source card above)</span></div>
            </div>
          </div>

          {/* ── POST Fields ─────────────────────────────────── */}
          <div className="px-5 py-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">POST Body Fields</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Field</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Type</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Required</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {FIELDS.map(f => (
                    <tr key={f.field} className={`hover:bg-slate-50 ${
                      f.field === 'slot_date' || f.field === 'slot_time'
                        ? 'bg-brand-50/40'
                        : ''
                    }`}>
                      <td className="px-4 py-2.5">
                        <code className="font-bold text-brand-600">{f.field}</code>
                        {(f.field === 'slot_date' || f.field === 'slot_time') && (
                          <span className="ml-1.5 text-[9px] bg-brand-100 text-brand-600 px-1 py-0.5 rounded font-bold">SLOT</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          f.type === 'date' ? 'bg-violet-50 text-violet-700' :
                          f.type === 'time' ? 'bg-violet-50 text-violet-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{f.type}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {f.req
                          ? <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Yes</span>
                          : <span className="text-slate-600">No</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Complete Code Example ────────────────────────── */}
          <div className="px-5 py-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Complete Landing Page Example</h4>
            <pre className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-300
                            overflow-x-auto text-xs leading-relaxed font-mono">{
`// Your landing page form submit handler
async function submitLead(form) {
  const response = await fetch('${API_URL}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    'wz_your_api_key_here'   // from Lead Sources page
    },
    body: JSON.stringify({
      full_name:  form.name,           // "Rahul Sharma"
      phone:      form.phone,          // "9876543210"
      email:      form.email,          // "rahul@example.com"
      company:    form.company,        // "ABC Corp"
      industry:   form.industry,       // "Real Estate"

      // ── Slot Booking ─────────────────────────────
      slot_date:  form.appointmentDate, // "2025-05-20"  (YYYY-MM-DD)
      slot_time:  form.appointmentTime, // "14:30"       (HH:MM)

      notes:      form.message         // "Interested in 2BHK"
    })
  });

  const result = await response.json();
  // result: { success: true, lead_id: 42, slot_date: "2025-05-20", slot_time: "14:30" }

  if (result.success) {
    showThankYouPage();
  }
}`
            }</pre>
          </div>

          {/* ── DB Schema ────────────────────────────────────── */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Leads Table Schema (MSSQL)</h4>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                backend/scripts/schema.sql
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Column</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">SQL Type</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DB_COLUMNS.map(c => (
                    <tr key={c.col} className={`hover:bg-slate-50 ${
                      c.col === 'slot_date' || c.col === 'slot_time' ? 'bg-brand-50/40' : ''
                    }`}>
                      <td className="px-4 py-2.5">
                        <code className={`font-bold ${
                          c.col === 'slot_date' || c.col === 'slot_time'
                            ? 'text-brand-600'
                            : 'text-slate-700'
                        }`}>{c.col}</code>
                        {c.note?.startsWith('★') && (
                          <span className="ml-1.5 text-[9px] bg-brand-100 text-brand-600 px-1 py-0.5 rounded font-bold">NEW</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          c.type === 'DATE' || c.type === 'TIME' || c.type === 'DATETIME2'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>{c.type}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {c.note?.replace('★ ', '') || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              <strong>⚠ Existing database?</strong> Run <code className="bg-amber-100 px-1 rounded">backend/scripts/add_slot_columns.sql</code> to add the <code className="bg-amber-100 px-1 rounded">slot_date</code> and <code className="bg-amber-100 px-1 rounded">slot_time</code> columns to your existing Leads table.
            </div>
          </div>

          {/* ── Response Format ──────────────────────────────── */}
          <div className="px-5 py-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">API Response</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs font-semibold text-slate-700">201 Created</span>
                </div>
                <pre className="bg-slate-800 rounded-xl p-3 text-[11px] text-green-300 font-mono">{
`{
  "success":   true,
  "lead_id":   42,
  "slot_date": "2025-05-20",
  "slot_time": "14:30"
}`
                }</pre>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs font-semibold text-slate-700">Common Errors</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <code className="text-red-500">401</code> — Invalid or missing API key
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <code className="text-red-500">400</code> — <code>full_name</code> is missing
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <code className="text-amber-600">409</code> — Duplicate phone in last 24 h
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Source Modal (Meta + Landing Page only — no external_db form)
═══════════════════════════════════════════════════════════════ */
function SourceModal({ editSource, onClose, onSuccess }) {
  const isEdit = !!editSource;
  const [sourceType, setSourceType] = useState(editSource?.source_type || '');
  const [name,       setName]       = useState(editSource?.name || '');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [savedSource,setSavedSource]= useState(null);

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim())  { toast.error('Source name is required'); return; }
    if (!sourceType)   { toast.error('Select a source type');    return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/sources/${editSource.id}`, { name: name.trim() });
        toast.success('Source updated!');
        onSuccess();
      } else {
        const res = await api.post('/sources', { name: name.trim(), source_type: sourceType });
        setSavedSource(res.data);
        setSaved(true);
        toast.success('Source connected!');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  /* ── Post-create success ──────────────────────────────────── */
  if (saved && savedSource) {
    return (
      <ModalWrap onClose={onClose} size="sm">
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-green-50 border border-green-200 rounded-2xl
                          flex items-center justify-center mx-auto mb-4 text-2xl">
            {SOURCE_TYPES[savedSource.source_type]?.icon}
          </div>
          <div className="text-lg font-bold text-slate-800 mb-1">"{savedSource.name}" Connected!</div>
          <div className="text-sm text-slate-600 mb-5">{SOURCE_TYPES[savedSource.source_type]?.label} source is live.</div>

          {savedSource.source_type === 'landing_page' && savedSource.api_key && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-left">
              <div className="text-[10px] text-slate-600 mb-1.5 uppercase tracking-wide font-bold">Your API Key</div>
              <div className="flex items-center gap-3">
                <code className="text-brand-600 text-xs font-mono flex-1 break-all">{savedSource.api_key}</code>
                <button onClick={() => { navigator.clipboard?.writeText(savedSource.api_key); toast.success('Copied!'); }}
                  className="text-xs border border-slate-200 text-slate-700 hover:text-slate-800 px-2.5 py-1 rounded-lg shrink-0">
                  Copy
                </button>
              </div>
              <p className="text-[11px] text-slate-600 mt-2">
                Use this key in the <code className="bg-slate-100 px-1 rounded">x-api-key</code> header when POSTing from your landing page.
              </p>
            </div>
          )}

          {savedSource.source_type === 'meta' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-left text-xs text-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-800">Meta Webhook Setup:</div>
              <div>Callback URL: <code className="text-brand-600">{window.location.origin}/api/webhook</code></div>
              <div>Set <code className="bg-slate-100 px-1 rounded">META_VERIFY_TOKEN</code> in backend/.env</div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={onSuccess} className="btn-secondary flex-1 text-sm">View Sources</button>
            <button onClick={() => { setSaved(false); setSavedSource(null); setName(''); setSourceType(''); }}
              className="btn-primary flex-1 text-sm">+ Add Another</button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  return (
    <ModalWrap onClose={onClose} size="md"
      title={isEdit ? `Edit: ${editSource.name}` : 'Connect New Source'}
      subtitle={isEdit ? 'Update the source name' : 'Choose a source type and give it a name'}>
      <form onSubmit={handleSave} className="space-y-5">

        {/* Type picker (new only) */}
        {!isEdit && (
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              Source Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(SOURCE_TYPES).map(([type, cfg]) => {
                const s = CARD_STYLE[type];
                return (
                  <button key={type} type="button" onClick={() => setSourceType(type)}
                    className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                      sourceType === type
                        ? `${s.border} ${s.headerBg} ring-2 ring-brand-300`
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}>
                    <div className="text-2xl mb-2">{cfg.icon}</div>
                    <div className="text-sm font-bold text-slate-700">{cfg.label}</div>
                    {type === 'landing_page' && (
                      <div className="text-[10px] text-slate-600 mt-1">POST /api/capture with API key</div>
                    )}
                    {type === 'meta' && (
                      <div className="text-[10px] text-slate-600 mt-1">Facebook / Instagram Lead Ads</div>
                    )}
                    {sourceType === type && (
                      <div className="text-[10px] text-brand-600 font-bold mt-1.5">✓ Selected</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Edit: type badge */}
        {isEdit && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold
                           ${CARD_STYLE[sourceType]?.badge || ''}`}>
            {SOURCE_TYPES[sourceType]?.icon} {SOURCE_TYPES[sourceType]?.label}
          </div>
        )}

        {/* Source name */}
        {(sourceType || isEdit) && (
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Source Name *
            </label>
            <input className="input" value={name}
              placeholder={
                sourceType === 'meta'
                  ? 'e.g. Facebook Lead Ads – India Campaign'
                  : 'e.g. Wizone Landing Page, Contact Form'
              }
              onChange={e => setName(e.target.value)} />
            <p className="text-[11px] text-slate-600 mt-1.5">
              This name tags every lead from this source — visible in the Leads table and Dashboard.
            </p>
          </div>
        )}

        {/* Info blocks */}
        {sourceType === 'meta' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
            <div className="font-bold text-slate-800">📘 After saving, configure in Meta:</div>
            <div>1. Go to <strong>Meta Developer Console → App → Webhooks</strong></div>
            <div>2. Callback URL: <code className="text-brand-600">{window.location.origin}/api/webhook</code></div>
            <div>3. Set <code className="bg-slate-100 px-1 rounded">META_VERIFY_TOKEN</code> in backend/.env</div>
            <div>4. Subscribe to <strong>leadgen</strong> events</div>
          </div>
        )}
        {sourceType === 'landing_page' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
            <div className="font-bold text-slate-800">🌐 After saving, you'll get an API key.</div>
            <div>POST to <code className="text-brand-600">{window.location.origin}/api/capture</code></div>
            <div>with <code className="bg-slate-100 px-1 rounded">x-api-key</code> header.</div>
            <div className="text-slate-600 mt-1">Include <code className="bg-slate-100 px-1 rounded">slot_date</code> + <code className="bg-slate-100 px-1 rounded">slot_time</code> for appointment booking.</div>
          </div>
        )}

        {/* Actions */}
        {(sourceType || isEdit) && (
          <div className="flex gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg> Saving…</>
                : <>{isEdit ? 'Save Changes' : 'Connect & Save'}</>
              }
            </button>
          </div>
        )}
      </form>
    </ModalWrap>
  );
}

/* ── Modal wrapper ───────────────────────────────────────────── */
function ModalWrap({ children, onClose, size = 'lg', title, subtitle }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-white border border-slate-200 rounded-2xl shadow-2xl my-4 w-full
                       ${size === 'sm' ? 'max-w-md' : size === 'md' ? 'max-w-lg' : 'max-w-2xl'}`}>
        {(title || onClose) && (
          <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
            <div>
              {title    && <h2 className="font-bold text-slate-800 text-base">{title}</h2>}
              {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
            </div>
            {onClose && (
              <button onClick={onClose} className="text-slate-600 hover:text-slate-800 transition-colors p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
