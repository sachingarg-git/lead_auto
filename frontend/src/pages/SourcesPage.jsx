import React, { useEffect, useState, useCallback } from 'react';
import api, { sourcesApi } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

/* ── Source types ─────────────────────────────────────────────── */
const SOURCE_TYPES = {
  meta:        { label: 'Meta / Facebook Ads', icon: '📘', desc: 'Facebook & Instagram Lead Ads via webhook' },
  landing_page:{ label: 'Landing Page / Form',  icon: '🌐', desc: 'POST form data with API key' },
  external_db: { label: 'External Database',    icon: '🗄️',  desc: 'PostgreSQL or MSSQL — auto-sync every 5 min' },
};

const CARD_STYLE = {
  meta:        { border:'border-blue-200',   headerBg:'bg-blue-50',   dot:'bg-blue-400',   badge:'bg-blue-50 text-blue-700 border border-blue-200'    },
  landing_page:{ border:'border-emerald-200',headerBg:'bg-emerald-50',dot:'bg-emerald-500',badge:'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  external_db: { border:'border-violet-200', headerBg:'bg-violet-50', dot:'bg-violet-400', badge:'bg-violet-50 text-violet-700 border border-violet-200'  },
};

/* LMS target fields for column mapping */
const LMS_FIELDS = [
  { value:'',               label:'— Skip this column —' },
  { value:'full_name',      label:'★ Full Name (required)' },
  { value:'email',          label:'Email Address' },
  { value:'phone',          label:'Phone / WhatsApp' },
  { value:'company',        label:'Company / Organization' },
  { value:'industry',       label:'Industry / Sector' },
  { value:'notes',          label:'Notes / Message' },
  { value:'slot_date',      label:'Appointment Date (YYYY-MM-DD)' },
  { value:'slot_time',      label:'Appointment Time (HH:MM)' },
  { value:'preferred_slot', label:'Preferred Slot (combined string)' },
  { value:'tags',           label:'Tags (comma-separated)' },
];

/* Auto-mapping: source column name → LMS field */
const AUTO_MAP = {
  full_name:'full_name',   name:'full_name',     lead_name:'full_name',   fullname:'full_name',
  email:'email',           email_address:'email', mail:'email',
  phone:'phone',           mobile:'phone',        contact:'phone',          phone_number:'phone', whatsapp:'phone',
  company:'company',       company_name:'company',organization:'company',   firm:'company',
  industry:'industry',     sector:'industry',     business_type:'industry',
  notes:'notes',           message:'notes',       query:'notes',            remarks:'notes',      description:'notes',
  slot_date:'slot_date',   preferred_date:'slot_date', booking_date:'slot_date', appointment_date:'slot_date', date:'slot_date',
  slot_time:'slot_time',   preferred_time:'slot_time', booking_time:'slot_time', appointment_time:'slot_time', time:'slot_time',
  preferred_slot:'preferred_slot', slot:'preferred_slot',
  tags:'tags',             labels:'tags',
};

function autoSuggest(columns) {
  const map = {};
  for (const col of columns) {
    const key = col.column_name.toLowerCase().replace(/[\s-]+/g, '_');
    if (AUTO_MAP[key]) map[col.column_name] = AUTO_MAP[key];
  }
  return map;
}

/* ════════════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════════ */
export default function SourcesPage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);

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

  async function handleSync(s) {
    try {
      await api.post(`/sources/${s.id}/sync`);
      toast.success('Sync started — check back in a moment');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Sync failed');
    }
  }

  async function handleTest(s) {
    const tid = toast.loading('Testing connection…');
    try {
      const r = await api.post(`/sources/${s.id}/test`);
      toast.dismiss(tid);
      toast.success(`✓ Connected! ${r.data.rowCount} rows in table`);
    } catch (err) {
      toast.dismiss(tid);
      toast.error(err?.response?.data?.error || 'Connection failed');
    }
  }

  const totalLeads  = sources.reduce((a, s) => a + (s.lead_count || 0), 0);
  const activeCount = sources.filter(s => s.is_active).length;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Lead Sources</h1>
          <p className="text-sm text-slate-600 mt-1">
            Connect Meta Ads, landing pages, or pull from external PostgreSQL / MSSQL databases.
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

      {/* Stats */}
      {sources.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label:'Total Sources', value:sources.length,    icon:'🔌', accent:'#0eaada', light:'#e0f4fb' },
            { label:'Active',        value:activeCount,        icon:'⚡', accent:'#22c55e', light:'#dcfce7' },
            { label:'Total Leads',   value:totalLeads,         icon:'👤', accent:'#3b82f6', light:'#dbeafe' },
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

      {/* Sources Grid */}
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
                onSync={()     => handleSync(s)}
                onTest={()     => handleTest(s)}
              />
            ))}
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
              <span className="text-xs font-medium text-slate-600 group-hover:text-slate-700">Add another source</span>
            </button>
          </div>
        )}
      </div>

      {/* API Reference (collapsed) */}
      <CentralTableGuide />

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

/* ════════════════════════════════════════════════════════════════
   Source Card
═══════════════════════════════════════════════════════════════ */
function SourceCard({ source, onEdit, onToggle, onDelete, onRegenKey, onSync, onTest }) {
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

  const extConfig  = source.config     || {};
  const colMap     = source.column_map || {};
  const mappedCount = Object.values(colMap).filter(Boolean).length;

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
          {type === 'external_db' && extConfig.db_type && (
            <span className="ml-1.5 inline-flex items-center text-[10px] font-semibold px-2 py-0.5
                             rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {extConfig.db_type === 'postgres' ? '🐘 PostgreSQL' : '🟦 MSSQL'}
            </span>
          )}
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
        {type === 'external_db' && extConfig.table && (
          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">
            {extConfig.database}.{extConfig.table}
          </span>
        )}
        {source.is_active && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
            <span className="text-slate-600 text-[10px] font-semibold uppercase tracking-wide">Live</span>
          </div>
        )}
      </div>

      {/* External DB info */}
      {type === 'external_db' && (
        <div className="mx-4 mb-3 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Connection</span>
            {mappedCount > 0 && (
              <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">
                {mappedCount} columns mapped
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-600 font-mono truncate">
            {extConfig.server}:{extConfig.port} / {extConfig.database}
          </div>
          {source.last_synced && (
            <div className="text-[10px] text-slate-500">
              Last sync: {format(new Date(source.last_synced), 'dd MMM, HH:mm')}
              {source.sync_count > 0 && ` · ${source.sync_count} imported`}
            </div>
          )}
        </div>
      )}

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
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Meta webhook info */}
      {type === 'meta' && (
        <div className="mx-4 mb-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-700">
          <div className="font-semibold mb-0.5">Webhook endpoint:</div>
          <code className="text-[11px] break-all">{window.location.origin}/api/webhook</code>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto p-3 pt-0 space-y-2">
        {type === 'external_db' && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onTest}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                         border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100
                         text-xs font-semibold transition-all">
              🔌 Test DB
            </button>
            <button onClick={onSync}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                         border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100
                         text-xs font-semibold transition-all">
              🔄 Sync Now
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onEdit}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                       border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100
                       text-xs font-semibold transition-all">
            ✏️ Edit
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
          🗑️ Delete Source
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
    full_name:  form.name,
    phone:      form.phone,
    email:      form.email,
    company:    form.company,
    industry:   form.industry,
    slot_date:  form.date,    // "YYYY-MM-DD"
    slot_time:  form.time,    // "HH:MM"
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
   Source Modal — multi-step (supports all 3 types)
═══════════════════════════════════════════════════════════════ */
function SourceModal({ editSource, onClose, onSuccess }) {
  const isEdit     = !!editSource;
  const initType   = editSource?.source_type || '';
  const initConfig = editSource?.config || {};

  // Step: 1=type, 2=config (meta/lp name OR db config), 3=column mapper (db only), 4=success
  const [step,       setStep]       = useState(isEdit ? 2 : 1);
  const [sourceType, setSourceType] = useState(initType);
  const [name,       setName]       = useState(editSource?.name || '');
  const [saving,     setSaving]     = useState(false);
  const [savedSource,setSavedSource]= useState(null);

  // External DB config
  const [dbCfg, setDbCfg] = useState({
    db_type:   initConfig.db_type   || 'postgres',
    server:    initConfig.server    || '',
    port:      initConfig.port      || '',
    database:  initConfig.database  || '',
    user:      initConfig.user      || '',
    password:  '',          // never prefill password
    table:     initConfig.table     || '',
    id_column: initConfig.id_column || 'id',
    encrypt:   initConfig.encrypt   || false,
  });

  // Column mapper state
  const [columns,     setColumns]     = useState([]);
  const [sampleRow,   setSampleRow]   = useState(null);
  const [columnMap,   setColumnMap]   = useState(editSource?.column_map || {});
  const [fetchingCols,setFetchingCols]= useState(false);

  function setCfg(k, v) { setDbCfg(prev => ({ ...prev, [k]: v })); }

  /* ── Step 2 → Step 3: fetch columns from external DB ───────── */
  async function handleFetchColumns() {
    if (!dbCfg.server || !dbCfg.database || !dbCfg.table || !dbCfg.user) {
      toast.error('Fill in host, database, table and username first');
      return;
    }
    setFetchingCols(true);
    try {
      const r = await sourcesApi.fetchColumns({
        db_type:  dbCfg.db_type,
        server:   dbCfg.server,
        port:     dbCfg.port || (dbCfg.db_type === 'postgres' ? 5432 : 1433),
        database: dbCfg.database,
        user:     dbCfg.user,
        password: dbCfg.password || (isEdit ? '__keep__' : ''),
        table:    dbCfg.table,
        encrypt:  dbCfg.encrypt,
        // Pass source ID so backend can reuse existing password if editing
        source_id: editSource?.id,
      });
      setColumns(r.data.columns);
      setSampleRow(r.data.sample);
      // Auto-suggest + merge with existing map
      const suggested = autoSuggest(r.data.columns);
      setColumnMap(prev => ({ ...suggested, ...prev }));
      toast.success(`✓ Connected — ${r.data.columns.length} columns found`);
      setStep(3);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Connection failed');
    } finally {
      setFetchingCols(false);
    }
  }

  /* ── Save meta / landing_page (simple) ─────────────────────── */
  async function handleSaveSimple(e) {
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
        setStep(4);
        toast.success('Source connected!');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  /* ── Save external_db with config + column_map ─────────────── */
  async function handleSaveDb() {
    const hasName = name.trim();
    if (!hasName) { toast.error('Source name is required'); return; }

    const mapped = Object.entries(columnMap).filter(([, v]) => v);
    const hasFull = mapped.some(([, v]) => v === 'full_name');
    if (!hasFull) { toast.error('You must map at least one column to ★ Full Name'); return; }

    setSaving(true);
    const payload = {
      name: name.trim(),
      source_type: 'external_db',
      config: {
        db_type:   dbCfg.db_type,
        server:    dbCfg.server,
        port:      parseInt(dbCfg.port) || (dbCfg.db_type === 'postgres' ? 5432 : 1433),
        database:  dbCfg.database,
        user:      dbCfg.user,
        table:     dbCfg.table,
        id_column: dbCfg.id_column || 'id',
        encrypt:   dbCfg.encrypt,
        // only include password if user typed one
        ...(dbCfg.password ? { password: dbCfg.password } : {}),
      },
      column_map: Object.fromEntries(mapped),
    };

    try {
      if (isEdit) {
        await api.patch(`/sources/${editSource.id}`, payload);
        toast.success('Database source updated!');
        onSuccess();
      } else {
        const res = await api.post('/sources', payload);
        setSavedSource(res.data);
        setStep(4);
        toast.success('Database source connected!');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  /* ── Step 4: success ────────────────────────────────────────── */
  if (step === 4 && savedSource) {
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
            </div>
          )}

          {savedSource.source_type === 'meta' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-left text-xs text-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-800">📘 Meta Webhook Setup:</div>
              <div>Callback URL: <code className="text-brand-600">{window.location.origin}/api/webhook</code></div>
              <div>Set <code className="bg-slate-100 px-1 rounded">META_VERIFY_TOKEN</code> in backend/.env</div>
            </div>
          )}

          {savedSource.source_type === 'external_db' && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4 text-left text-xs text-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-800">🗄️ Auto-sync is running!</div>
              <div>New rows from <code className="bg-slate-100 px-1 rounded">{dbCfg.table}</code> will be imported every 5 minutes.</div>
              <div>Use <strong>Sync Now</strong> on the card to trigger immediately.</div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={onSuccess} className="btn-secondary flex-1 text-sm">View Sources</button>
            <button onClick={() => { setStep(1); setSavedSource(null); setName(''); setSourceType(''); }}
              className="btn-primary flex-1 text-sm">+ Add Another</button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  /* ── Step 3: Column Mapper ──────────────────────────────────── */
  if (step === 3) {
    return (
      <ModalWrap onClose={onClose} size="xl"
        title="Map Columns"
        subtitle={`${columns.length} columns found in "${dbCfg.table}" — map each to a Wizone LMS field`}>

        {/* Auto-map strip */}
        <div className="flex items-center justify-between mb-4 p-3 bg-violet-50 border border-violet-200 rounded-xl">
          <div className="text-xs text-violet-800">
            <strong>{Object.values(columnMap).filter(Boolean).length}</strong> of {columns.length} columns mapped
          </div>
          <button
            onClick={() => setColumnMap(autoSuggest(columns))}
            className="text-xs bg-violet-600 hover:bg-violet-700 text-white font-semibold
                       px-3 py-1.5 rounded-lg transition-all">
            ✨ Auto-Map All
          </button>
        </div>

        {/* Two-column mapper */}
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {/* Header */}
          <div className="grid grid-cols-2 gap-3 px-1 mb-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              📥 Source Column ({dbCfg.db_type === 'postgres' ? 'PostgreSQL' : 'MSSQL'})
            </div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              📤 Maps To (Wizone LMS Field)
            </div>
          </div>

          {columns.map(col => {
            const sample = sampleRow ? sampleRow[col.column_name] : undefined;
            const isMapped = !!columnMap[col.column_name];
            const isRequired = columnMap[col.column_name] === 'full_name';
            return (
              <div key={col.column_name}
                className={`grid grid-cols-2 gap-3 p-3 rounded-xl border transition-colors ${
                  isRequired ? 'bg-emerald-50 border-emerald-200' :
                  isMapped   ? 'bg-slate-50 border-slate-200' :
                               'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                {/* Left: source column */}
                <div className="flex flex-col justify-center min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-700 text-[13px] font-mono truncate">
                      {col.column_name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-slate-200 text-slate-600 shrink-0">
                      {col.data_type}
                    </span>
                  </div>
                  {sample !== undefined && sample !== null && (
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate font-mono"
                         title={String(sample)}>
                      e.g. "{String(sample).substring(0, 40)}"
                    </div>
                  )}
                  {(sample === null || sample === undefined) && (
                    <div className="text-[10px] text-slate-400 mt-0.5 italic">null</div>
                  )}
                </div>

                {/* Right: LMS field dropdown */}
                <div className="flex items-center">
                  <div className="relative w-full">
                    <select
                      value={columnMap[col.column_name] || ''}
                      onChange={e => setColumnMap(prev => ({ ...prev, [col.column_name]: e.target.value }))}
                      className={`w-full text-[12px] font-medium px-3 py-2 pr-8 rounded-xl border
                                  appearance-none focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                        isRequired ? 'border-emerald-300 bg-emerald-50 text-emerald-700 focus:ring-emerald-200' :
                        isMapped   ? 'border-brand-300 bg-white text-brand-700 focus:ring-brand-200' :
                                     'border-slate-200 bg-white text-slate-500 focus:ring-slate-200'
                      }`}>
                      {LMS_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Source name + save */}
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Source Name *
            </label>
            <input className="input" value={name}
              placeholder="e.g. LandingWizoneAi — Leads Table"
              onChange={e => setName(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="btn-secondary flex-1">← Back to Config</button>
            <button onClick={handleSaveDb} disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>Saving…</>
                : <>{isEdit ? 'Update Source' : '✓ Save & Activate'}</>
              }
            </button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  /* ── Step 2 for external_db: DB Config form ─────────────────── */
  if (step === 2 && (sourceType === 'external_db' || (isEdit && initType === 'external_db'))) {
    return (
      <ModalWrap onClose={onClose} size="lg"
        title={isEdit ? `Edit: ${editSource.name}` : '🗄️ Configure Database Connection'}
        subtitle="Enter your database details — we'll fetch the table columns next">

        <div className="space-y-4">
          {/* DB Type */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Database Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val:'postgres', label:'PostgreSQL', icon:'🐘', default_port:'5432' },
                { val:'mssql',    label:'MSSQL / SQL Server', icon:'🟦', default_port:'1433' },
              ].map(db => (
                <button key={db.val} type="button"
                  onClick={() => setCfg('db_type', db.val)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    dbCfg.db_type === db.val
                      ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}>
                  <div className="text-xl mb-1">{db.icon}</div>
                  <div className="text-sm font-bold text-slate-700">{db.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Default port: {db.default_port}</div>
                  {dbCfg.db_type === db.val && (
                    <div className="text-[10px] text-violet-600 font-bold mt-1">✓ Selected</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Host / Server *</label>
              <input className="input" placeholder="e.g. 72.61.170.243 or db.mysite.com"
                value={dbCfg.server} onChange={e => setCfg('server', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Port * <span className="text-slate-400 font-normal">(default: {dbCfg.db_type === 'postgres' ? '5432' : '1433'})</span>
              </label>
              <input className="input" type="number"
                placeholder={dbCfg.db_type === 'postgres' ? '5432' : '1433'}
                value={dbCfg.port} onChange={e => setCfg('port', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Database Name *</label>
              <input className="input" placeholder="e.g. LandingWizoneAi"
                value={dbCfg.database} onChange={e => setCfg('database', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Table Name *</label>
              <input className="input" placeholder="e.g. leads"
                value={dbCfg.table} onChange={e => setCfg('table', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Username *</label>
              <input className="input" placeholder="e.g. postgres"
                value={dbCfg.user} onChange={e => setCfg('user', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Password {isEdit && <span className="text-slate-400 font-normal">(leave blank to keep existing)</span>}
              </label>
              <input className="input" type="password"
                placeholder={isEdit ? '(unchanged)' : 'Database password'}
                value={dbCfg.password} onChange={e => setCfg('password', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                ID Column <span className="text-slate-400 font-normal">(for sync tracking)</span>
              </label>
              <input className="input" placeholder="id"
                value={dbCfg.id_column} onChange={e => setCfg('id_column', e.target.value)} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={dbCfg.encrypt}
                  onChange={e => setCfg('encrypt', e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 border-slate-300" />
                <span className="text-[12px] text-slate-700 font-medium">Use SSL / TLS encryption</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-200">
            {!isEdit && (
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
                ← Back
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleFetchColumns} disabled={fetchingCols}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {fetchingCols
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>Connecting…</>
                : <>🔌 Connect & Fetch Columns →</>
              }
            </button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  /* ── Step 2 for meta / landing_page: name only ──────────────── */
  if (step === 2) {
    return (
      <ModalWrap onClose={onClose} size="md"
        title={isEdit ? `Edit: ${editSource.name}` : 'Connect New Source'}
        subtitle="Give this source a name">
        <form onSubmit={handleSaveSimple} className="space-y-5">
          {isEdit && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold
                             ${CARD_STYLE[sourceType]?.badge || ''}`}>
              {SOURCE_TYPES[sourceType]?.icon} {SOURCE_TYPES[sourceType]?.label}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Source Name *</label>
            <input className="input" value={name}
              placeholder={sourceType === 'meta' ? 'e.g. Facebook Lead Ads — India' : 'e.g. Wizone Landing Page'}
              onChange={e => setName(e.target.value)} />
          </div>

          {sourceType === 'meta' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
              <div className="font-bold text-slate-800">📘 After saving, configure in Meta:</div>
              <div>1. Callback URL: <code className="text-brand-600">{window.location.origin}/api/webhook</code></div>
              <div>2. Set <code className="bg-slate-100 px-1 rounded">META_VERIFY_TOKEN</code> in backend/.env</div>
              <div>3. Subscribe to <strong>leadgen</strong> events</div>
            </div>
          )}
          {sourceType === 'landing_page' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
              <div className="font-bold text-slate-800">🌐 After saving, you'll get an API key.</div>
              <div>POST to <code className="text-brand-600">{window.location.origin}/api/capture</code></div>
              <div>with <code className="bg-slate-100 px-1 rounded">x-api-key</code> header.</div>
            </div>
          )}

          <div className="flex gap-3 pt-3 border-t border-slate-200">
            {!isEdit && <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>}
            {isEdit  && <button type="button" onClick={onClose}          className="btn-secondary flex-1">Cancel</button>}
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Connect & Save')}
            </button>
          </div>
        </form>
      </ModalWrap>
    );
  }

  /* ── Step 1: Type picker ─────────────────────────────────────── */
  return (
    <ModalWrap onClose={onClose} size="lg"
      title="Connect New Source"
      subtitle="Choose where leads come from">
      <div className="grid grid-cols-1 gap-3">
        {Object.entries(SOURCE_TYPES).map(([type, cfg]) => {
          const s = CARD_STYLE[type];
          return (
            <button key={type} type="button"
              onClick={() => { setSourceType(type); setStep(2); }}
              className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-center gap-4
                          hover:shadow-md ${s.border} ${s.headerBg} hover:-translate-y-0.5`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${s.badge}`}>
                {cfg.icon}
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-800 text-sm">{cfg.label}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{cfg.desc}</div>
              </div>
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          );
        })}
      </div>
    </ModalWrap>
  );
}

/* ── Modal wrapper ───────────────────────────────────────────── */
function ModalWrap({ children, onClose, size = 'lg', title, subtitle }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50
                    flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-white border border-slate-200 rounded-2xl shadow-2xl my-4 w-full
                       ${size === 'sm' ? 'max-w-md' : size === 'md' ? 'max-w-lg' :
                         size === 'xl' ? 'max-w-3xl' : 'max-w-2xl'}`}>
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

/* ── Empty State ─────────────────────────────────────────────── */
function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center
                    border-2 border-dashed border-slate-200 rounded-2xl bg-white">
      <div className="text-5xl mb-4">🔌</div>
      <h3 className="text-slate-700 font-semibold text-lg mb-1">No sources connected yet</h3>
      <p className="text-slate-600 text-sm max-w-xs mb-6 leading-relaxed">
        Connect Meta Ads, a landing page form, or pull from an external PostgreSQL / MSSQL database.
      </p>
      <button onClick={onAdd} className="btn-primary">+ Connect First Source</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Centralized Table Guide
═══════════════════════════════════════════════════════════════ */
function CentralTableGuide() {
  const [open, setOpen] = useState(false);
  const API_URL = `${window.location.origin}/api/capture`;

  const FIELDS = [
    { field:'full_name', type:'string', req:true,  desc:"Lead's full name" },
    { field:'phone',     type:'string', req:false, desc:'Mobile (used for dedup & WhatsApp)' },
    { field:'email',     type:'string', req:false, desc:'Email address' },
    { field:'company',   type:'string', req:false, desc:'Company / organization' },
    { field:'industry',  type:'string', req:false, desc:'Industry / sector' },
    { field:'slot_date', type:'date',   req:false, desc:'Appointment date — "YYYY-MM-DD"' },
    { field:'slot_time', type:'time',   req:false, desc:'Appointment time — "HH:MM"' },
    { field:'notes',     type:'string', req:false, desc:'Message / query from the lead' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
         style={{ boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
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
        <div className="border-t border-slate-100 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-lg">POST</span>
            <code className="text-sm text-brand-600 font-mono font-semibold">{API_URL}</code>
          </div>
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
                  <tr key={f.field} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5"><code className="font-bold text-brand-600">{f.field}</code></td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600">{f.type}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {f.req
                        ? <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Yes</span>
                        : <span className="text-slate-600">No</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
