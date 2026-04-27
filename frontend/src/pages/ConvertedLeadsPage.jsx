import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { leadsApi, usersApi } from '../services/api';
import { format } from 'date-fns';

/* ── Source badge styles ─────────────────────────────────────── */
const getSourceStyle = s => {
  if (!s) return 'bg-slate-100 text-slate-600 border-slate-200';
  const l = s.toLowerCase();
  if (l.includes('wizone'))   return 'bg-slate-800 text-cyan-300 border-cyan-700';
  if (l.includes('meta') || l.includes('facebook') || l.includes('instagram'))
                              return 'bg-blue-50 text-blue-600 border-blue-200';
  if (l.includes('landing') || l.includes('form') || l.includes('page'))
                              return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (l.includes('manual'))   return 'bg-slate-50 text-slate-600 border-slate-200';
  return 'bg-violet-50 text-violet-600 border-violet-200';
};

/* ── Pagination button ───────────────────────────────────────── */
function PagBtn({ onClick, disabled, label }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all
        ${disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}>
      {label}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════
   ConvertedLeadsPage
═══════════════════════════════════════════════════════════════ */
export default function ConvertedLeadsPage() {
  const [leads,    setLeads]   = useState([]);
  const [total,    setTotal]   = useState(0);
  const [page,     setPage]    = useState(1);
  const [pages,    setPages]   = useState(1);
  const [loading,  setLoading] = useState(true);
  const [users,    setUsers]   = useState([]);
  const [sources,  setSources] = useState([]);

  const [filters, setFilters] = useState({ source: '', client_type: '', search: '' });

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        status: 'Converted',
        page,
        limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      };
      const res = await leadsApi.getAll(params);
      setLeads(res.data.leads);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {}
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    usersApi.getAll().then(r => setUsers(r.data)).catch(() => {});
    api.get('/sources/names').then(r => setSources(r.data.map(s => s.name))).catch(() => {});
  }, []);

  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })); setPage(1); }
  function clearAll() { setFilters({ source: '', client_type: '', search: '' }); setPage(1); }

  const activeFilters = Object.values(filters).filter(Boolean).length;

  /* ── Conversion rate helpers ──────────────────────────────── */
  const thisMonth = leads.filter(l => {
    if (!l.created_at) return false;
    const d = new Date(l.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">Converted Leads</h1>
            <p className="text-[12px] text-slate-500 font-medium">All leads that have been successfully converted</p>
          </div>
        </div>

        {/* Stats pills */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
            <span className="text-2xl font-black text-emerald-600">{total}</span>
            <div>
              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Total</div>
              <div className="text-[10px] text-emerald-400">converted</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-4 py-2">
            <span className="text-2xl font-black text-sky-600">{thisMonth}</span>
            <div>
              <div className="text-[10px] font-bold text-sky-500 uppercase tracking-wide">This Month</div>
              <div className="text-[10px] text-sky-400">new conversions</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full h-10 bg-white border border-slate-200 rounded-xl pl-10 pr-4
                       text-sm text-slate-700 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                       transition-all shadow-sm"
            placeholder="Search name, email, phone…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>

        {/* Source filter */}
        <select
          value={filters.source}
          onChange={e => setFilter('source', e.target.value)}
          className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm text-slate-600
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                     transition-all shadow-sm cursor-pointer min-w-[130px]">
          <option value="">All Sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Client type filter */}
        <select
          value={filters.client_type}
          onChange={e => setFilter('client_type', e.target.value)}
          className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm text-slate-600
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
                     transition-all shadow-sm cursor-pointer min-w-[130px]">
          <option value="">All Types</option>
          <option value="Type1">Meeting Booked</option>
          <option value="Type2">No Meeting</option>
        </select>

        {activeFilters > 0 && (
          <button onClick={clearAll}
            className="h-10 flex items-center gap-1.5 px-3 rounded-xl border border-red-200
                       text-xs font-semibold text-red-500 hover:bg-red-50 bg-white shadow-sm transition-all">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear ({activeFilters})
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <strong className="text-slate-700 text-sm">{total}</strong>
          converted lead{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="border-b border-slate-100 bg-emerald-50/60">
                {['Lead', 'Company', 'Contact', 'Industry', 'Source', 'Type', 'Meet Link', 'Converted On'].map(h => (
                  <th key={h}
                    className="px-4 py-3 text-[10px] font-bold text-emerald-700
                               uppercase tracking-[0.1em] text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3 text-[10px] font-bold text-emerald-700 uppercase tracking-[0.1em]
                               text-left whitespace-nowrap sticky right-0 bg-emerald-50/80 backdrop-blur-sm
                               border-l border-emerald-100 z-10">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-8 h-8">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-200" />
                        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin absolute inset-0" />
                      </div>
                      <span className="text-slate-500 text-xs">Loading converted leads…</span>
                    </div>
                  </td>
                </tr>
              ) : !leads.length ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <div className="text-5xl mb-4 opacity-20">🏆</div>
                    <div className="text-slate-600 text-sm font-medium">No converted leads yet</div>
                    <div className="text-slate-400 text-xs mt-1">
                      {activeFilters > 0
                        ? <button onClick={clearAll} className="text-emerald-500 hover:text-emerald-600 font-semibold">Clear filters</button>
                        : 'Converted leads will appear here automatically'}
                    </div>
                  </td>
                </tr>
              ) : leads.map(lead => (
                <ConvertedRow key={lead.id} lead={lead} />
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Page <strong className="text-slate-700">{page}</strong> of <strong className="text-slate-700">{pages}</strong>
              <span className="text-slate-300 ml-2">· {total} total</span>
            </span>
            <div className="flex items-center gap-1">
              <PagBtn onClick={() => setPage(1)}           disabled={page === 1}     label="«" />
              <PagBtn onClick={() => setPage(p => p - 1)} disabled={page === 1}     label="‹" />
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, pages - 4));
                const p = start + i;
                return p <= pages ? (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                      p === page ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}>
                    {p}
                  </button>
                ) : null;
              })}
              <PagBtn onClick={() => setPage(p => p + 1)} disabled={page === pages} label="›" />
              <PagBtn onClick={() => setPage(pages)}      disabled={page === pages} label="»" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Converted Lead Row ───────────────────────────────────────── */
function ConvertedRow({ lead }) {
  return (
    <tr className="group hover:bg-emerald-50/30 transition-colors">

      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200
                          flex items-center justify-center text-emerald-700 text-xs font-bold shrink-0">
            {lead.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 text-[13px] truncate max-w-[140px]">
              {lead.full_name}
            </div>
            {/* Converted badge */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px]
                             font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Converted
            </span>
          </div>
        </div>
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        <span className="text-[12px] text-slate-800 font-medium max-w-[130px] block truncate" title={lead.company}>
          {lead.company || <span className="text-slate-300">—</span>}
        </span>
      </td>

      {/* Contact */}
      <td className="px-4 py-3">
        {lead.phone ? (
          <a href={`https://wa.me/${(lead.phone).replace(/\D/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold
                       text-emerald-600 hover:text-emerald-700 transition-colors">
            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {lead.phone}
          </a>
        ) : <span className="text-slate-300 text-xs">—</span>}
        {lead.email && (
          <div className="text-[10px] text-slate-600 mt-0.5 truncate max-w-[150px] font-medium">
            {lead.email}
          </div>
        )}
      </td>

      {/* Industry */}
      <td className="px-4 py-3">
        <span className="text-[12px] text-slate-800 font-medium">
          {lead.industry || <span className="text-slate-300">—</span>}
        </span>
      </td>

      {/* Source */}
      <td className="px-4 py-3">
        {lead.source
          ? <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px]
                              font-semibold border ${getSourceStyle(lead.source)}`}>
              {lead.source}
            </span>
          : <span className="text-slate-300 text-xs">—</span>}
      </td>

      {/* Client Type */}
      <td className="px-4 py-3">
        {lead.client_type === 'Type1'
          ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]
                             font-semibold border bg-violet-50 text-violet-700 border-violet-200">
              📅 Meeting
            </span>
          : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]
                             font-semibold border bg-slate-50 text-slate-600 border-slate-200">
              Direct
            </span>}
      </td>

      {/* Meet Link */}
      <td className="px-4 py-3 text-center">
        {lead.meeting_link ? (
          <a href={lead.meeting_link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg
                       bg-sky-50 border border-sky-200 text-sky-600 hover:bg-sky-100
                       hover:border-sky-400 transition-all">
            🎥
          </a>
        ) : (
          <span className="text-slate-200 text-lg">—</span>
        )}
      </td>

      {/* Converted On (created_at date) */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-[12px] font-bold text-slate-800">
          {lead.created_at ? format(new Date(lead.created_at), 'dd MMM yyyy') : '—'}
        </div>
        <div className="text-[10px] text-slate-500 font-medium">
          {lead.created_at ? lead.created_at.substring(11, 16) : ''}
        </div>
      </td>

      {/* Action — sticky right */}
      <td className="px-4 py-3 sticky right-0 bg-white border-l border-slate-100 z-10"
          style={{ boxShadow: '-2px 0 6px rgba(0,0,0,0.04)' }}>
        <Link to={`/leads/${lead.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200
                     bg-emerald-50 text-emerald-700 text-[11px] font-semibold
                     hover:bg-emerald-100 hover:border-emerald-400 transition-all">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
          View
        </Link>
      </td>
    </tr>
  );
}
