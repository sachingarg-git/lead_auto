import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import api, { leadsApi, usersApi } from '../services/api';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['New', 'FollowUp', 'DemoGiven', 'Converted', 'Lost', 'Nurture'];

const STATUS_STYLE = {
  New:       { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-400',     card: 'border-sky-200 hover:border-sky-400',   cardBg: 'bg-sky-50',   num: 'text-sky-700',   icon: '🆕' },
  FollowUp:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400',   card: 'border-amber-200 hover:border-amber-400', cardBg: 'bg-amber-50', num: 'text-amber-700', icon: '🔄' },
  DemoGiven: { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-400',  card: 'border-violet-200 hover:border-violet-400',cardBg:'bg-violet-50',num:'text-violet-700',icon:'🎯' },
  Converted: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400', card: 'border-emerald-200 hover:border-emerald-400',cardBg:'bg-emerald-50',num:'text-emerald-700',icon:'✅' },
  Lost:      { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200',     dot: 'bg-red-400',     card: 'border-red-200 hover:border-red-400',    cardBg: 'bg-red-50',   num: 'text-red-600',   icon: '❌' },
  Nurture:   { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    dot: 'bg-pink-400',    card: 'border-pink-200 hover:border-pink-400',  cardBg: 'bg-pink-50',  num: 'text-pink-700',  icon: '🌱' },
};

const STAT_KEY = {
  New: 'new_leads', FollowUp: 'follow_up', DemoGiven: 'demo_given',
  Converted: 'converted', Lost: 'lost', Nurture: 'nurture',
};

const getSourceStyle = s => {
  if (!s) return 'bg-slate-100 text-slate-700 border-slate-200';
  const l = s.toLowerCase();
  if (l.includes('meta') || l.includes('facebook') || l.includes('instagram'))
    return 'bg-blue-50 text-blue-600 border-blue-200';
  if (l.includes('landing') || l.includes('form') || l.includes('page'))
    return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (l.includes('manual')) return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-violet-50 text-violet-600 border-violet-200';
};

/* ════════════════════════════════════════════════════════════════
   LeadsPage
═══════════════════════════════════════════════════════════════ */
export default function LeadsPage() {
  const { can } = useAuth();
  const { t }   = useTranslation();

  const [leads,   setLeads]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [users,   setUsers]   = useState([]);
  const [sources, setSources] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [stats,   setStats]   = useState({});
  const [filters, setFilters] = useState({ status: '', source: '', client_type: '', search: '' });

  // FollowUp modal state
  const [followupLead, setFollowupLead] = useState(null); // lead object

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const res = await leadsApi.getAll(params);
      setLeads(res.data.leads);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {}
    finally { setLoading(false); }
  }, [page, filters]);

  const loadStats = useCallback(async () => {
    try {
      const res = await leadsApi.getStats();
      setStats(res.data.stats || res.data);
    } catch {}
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    usersApi.getAll().then(r => setUsers(r.data)).catch(() => {});
    api.get('/sources/names').then(r => setSources(r.data.map(s => s.name))).catch(() => {});
  }, []);

  useEffect(() => {
    const socket = io('/', { withCredentials: true });
    socket.emit('join:dashboard');
    socket.on('lead:new',     () => { loadLeads(); loadStats(); });
    socket.on('lead:updated', () => { loadLeads(); loadStats(); });
    return () => socket.disconnect();
  }, [loadLeads, loadStats]);

  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })); setPage(1); }
  function toggleStatusFilter(s) {
    setFilters(f => ({ ...f, status: f.status === s ? '' : s }));
    setPage(1);
  }

  const activeFilters = Object.values(filters).filter(Boolean).length;

  async function handleDelete(id) {
    try {
      await leadsApi.delete(id);
      toast.success('Lead deleted');
      setLeads(prev => prev.filter(l => l.id !== id));
      setDeleteId(null);
      loadStats();
    } catch {
      toast.error('Failed to delete lead');
    }
  }

  return (
    <div className="space-y-4 max-w-[1440px] mx-auto">

      {/* ── Status Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        {STATUSES.map(s => {
          const ss = STATUS_STYLE[s];
          const count = stats[STAT_KEY[s]] ?? '—';
          const active = filters.status === s;
          return (
            <button key={s} onClick={() => toggleStatusFilter(s)}
              className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-200
                          ${active
                            ? `${ss.cardBg} ${ss.border} shadow-md scale-[1.03]`
                            : `bg-white ${ss.card} shadow-sm hover:shadow-md hover:scale-[1.02]`
                          }`}>
              <div className="text-lg mb-0.5">{ss.icon}</div>
              <div className={`text-xl font-black ${ss.num}`}>{count}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{s}</div>
            </button>
          );
        })}
      </div>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full h-10 bg-white border border-slate-200 rounded-xl pl-10 pr-4
                       text-sm text-slate-700 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/50
                       transition-all shadow-sm"
            placeholder="Search name, email, phone…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>

        {/* Filters */}
        <FilterSelect value={filters.status} onChange={v => setFilter('status', v)} placeholder="All Statuses">
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>

        <FilterSelect value={filters.source} onChange={v => setFilter('source', v)} placeholder="All Sources">
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
          {!sources.includes('Manual') && <option value="Manual">Manual</option>}
        </FilterSelect>

        <FilterSelect value={filters.client_type} onChange={v => setFilter('client_type', v)} placeholder="All Types">
          <option value="Type1">Meeting Booked</option>
          <option value="Type2">No Meeting</option>
        </FilterSelect>

        {/* Clear filters */}
        {activeFilters > 0 && (
          <button
            onClick={() => { setFilters({ status: '', source: '', client_type: '', search: '' }); setPage(1); }}
            className="h-10 flex items-center gap-1.5 px-3 rounded-xl border border-slate-200
                       text-xs font-semibold text-slate-700 hover:text-slate-700 hover:bg-slate-100
                       bg-white shadow-sm transition-all">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear ({activeFilters})
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 text-xs text-slate-600 font-medium">
          <strong className="text-slate-700 text-sm">{total}</strong>
          lead{total !== 1 ? 's' : ''}
        </div>

        {can('leads:write') && (
          <button onClick={() => setShowAdd(true)}
            className="h-10 flex items-center gap-2 bg-brand-500 hover:bg-brand-600
                       text-white font-bold text-sm px-4 rounded-xl transition-all duration-200"
            style={{ boxShadow: '0 2px 10px rgba(14,170,218,.30)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Lead
          </button>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Lead','Company','Contact','Industry','Slot','Source','Status','Date','Actions'].map(h => (
                  <th key={h}
                    className="px-4 py-3 text-[10px] font-bold text-slate-600
                               uppercase tracking-[0.1em] text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-8 h-8">
                      <div className="w-8 h-8 rounded-full border-2 border-slate-200" />
                      <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent
                                      animate-spin absolute inset-0" />
                    </div>
                    <span className="text-slate-600 text-xs">Loading leads…</span>
                  </div>
                </td></tr>
              ) : !leads.length ? (
                <tr><td colSpan={9} className="py-20 text-center">
                  <div className="text-4xl mb-3 opacity-25">👤</div>
                  <div className="text-slate-600 text-sm font-medium">No leads found</div>
                  {activeFilters > 0 && (
                    <button onClick={() => setFilters({ status: '', source: '', client_type: '', search: '' })}
                      className="mt-2 text-xs text-brand-500 hover:text-brand-600 font-semibold">
                      Clear filters
                    </button>
                  )}
                </td></tr>
              ) : leads.map(lead => (
                <LeadRow key={lead.id} lead={lead}
                  canStatus={can('leads:status')}
                  canWrite={can('leads:write')}
                  onFollowUp={() => setFollowupLead(lead)}
                  onDelete={() => setDeleteId(lead.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5
                          border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-600">
              Page <strong className="text-slate-600">{page}</strong> of{' '}
              <strong className="text-slate-600">{pages}</strong>
              <span className="text-slate-400 ml-2">· {total} total</span>
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
                      p === page
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100'
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

      {/* ── Modals ───────────────────────────────────────────── */}
      {showAdd && (
        <AddLeadModal users={users} sources={sources}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); loadLeads(); loadStats(); }} />
      )}

      {followupLead && (
        <FollowUpModal
          lead={followupLead}
          onClose={() => setFollowupLead(null)}
          onSuccess={() => { setFollowupLead(null); loadLeads(); loadStats(); }}
        />
      )}

      {deleteId && (
        <DeleteConfirm
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/* ── Lead Row ─────────────────────────────────────────────────── */
function LeadRow({ lead, canStatus, canWrite, onFollowUp, onDelete }) {
  const ss = STATUS_STYLE[lead.status] || STATUS_STYLE.New;

  return (
    <tr className="group hover:bg-slate-50/60 transition-colors">

      {/* Name — clickable to open followup */}
      <td className="px-4 py-3">
        <button onClick={onFollowUp} className="flex items-center gap-2.5 group/link text-left w-full">
          <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/15
                          flex items-center justify-center text-brand-600 text-xs font-bold shrink-0">
            {lead.full_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-slate-800 group-hover/link:text-brand-600
                            transition-colors text-[13px] whitespace-nowrap">
              {lead.full_name}
            </div>
            {lead.client_type === 'Type1' && (
              <span className="text-[9px] font-bold text-violet-500 uppercase tracking-wide">
                Meeting Booked
              </span>
            )}
          </div>
        </button>
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        <span className="text-[12px] text-slate-700 max-w-[130px] block truncate" title={lead.company}>
          {lead.company || <span className="text-slate-300">—</span>}
        </span>
      </td>

      {/* Contact */}
      <td className="px-4 py-3">
        {lead.phone ? (
          <a href={`https://wa.me/${(lead.phone).replace(/\D/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold
                       text-emerald-600 hover:text-emerald-700 transition-colors">
            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {lead.phone}
          </a>
        ) : <span className="text-slate-300 text-xs">—</span>}
        {lead.email && (
          <div className="text-[10px] text-slate-600 mt-0.5 truncate max-w-[150px]">{lead.email}</div>
        )}
      </td>

      {/* Industry */}
      <td className="px-4 py-3">
        <span className="text-[12px] text-slate-700">
          {lead.industry || <span className="text-slate-300">—</span>}
        </span>
      </td>

      {/* Slot */}
      <td className="px-4 py-3">
        <SlotCell
          slotDate={lead.slot_date}
          slotTime={lead.slot_time}
          preferred={lead.preferred_slot}
          meetingDatetime={lead.meeting_datetime}
        />
      </td>

      {/* Source */}
      <td className="px-4 py-3">
        {lead.source
          ? <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px]
                              font-semibold border ${getSourceStyle(lead.source)}`}>
              {lead.source}
            </span>
          : <span className="text-slate-300 text-xs">—</span>
        }
      </td>

      {/* Status — static badge, no dropdown */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border
                          text-[11px] font-semibold ${ss.bg} ${ss.text} ${ss.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
          {lead.status}
        </span>
      </td>

      {/* Date */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-[12px] font-semibold text-slate-600">
          {format(new Date(lead.created_at), 'dd MMM')}
        </div>
        <div className="text-[10px] text-slate-500">
          {format(new Date(lead.created_at), 'HH:mm')}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {/* View */}
          <Link to={`/leads/${lead.id}`}
            title="View Detail"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200
                       bg-white text-slate-500 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50
                       transition-all duration-150 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </Link>

          {/* FollowUp */}
          <button onClick={onFollowUp} title="Add FollowUp"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-amber-200
                       bg-amber-50 text-amber-600 hover:bg-amber-100 hover:border-amber-400
                       transition-all duration-150 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
          </button>

          {/* Delete */}
          <button onClick={onDelete} title="Delete Lead"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-200
                       bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-400
                       transition-all duration-150 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── FollowUp Modal ───────────────────────────────────────────── */
function FollowUpModal({ lead, onClose, onSuccess }) {
  const [form, setForm] = useState({ status: lead.status, note: '', next_followup_date: '' });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const ss = STATUS_STYLE[lead.status] || STATUS_STYLE.New;

  useEffect(() => {
    setLoadingHistory(true);
    leadsApi.getFollowUps(lead.id)
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [lead.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.note.trim()) { toast.error('Please add a note'); return; }
    setSaving(true);
    try {
      await leadsApi.addFollowUp(lead.id, {
        status: form.status,
        note: form.note,
        next_followup_date: form.next_followup_date || null,
      });
      toast.success('FollowUp saved & status updated!');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save followup');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50
                    flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg my-4"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,.15)' }}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-100 ${ss.cardBg} rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/80 border border-white/60
                            flex items-center justify-center font-bold text-slate-700 shadow-sm">
              {lead.full_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base leading-tight">{lead.full_name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]
                                  font-bold border ${ss.bg} ${ss.text} ${ss.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                  {lead.status}
                </span>
                {lead.phone && (
                  <span className="text-[11px] text-slate-600">{lead.phone}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5
                       hover:bg-white/60 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Status selector */}
          <div>
            <Label>Update Status</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {STATUSES.map(s => {
                const sty = STATUS_STYLE[s];
                const active = form.status === s;
                return (
                  <button type="button" key={s}
                    onClick={() => set('status', s)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px]
                                font-bold border-2 transition-all duration-150
                                ${active
                                  ? `${sty.bg} ${sty.text} ${sty.border} shadow-sm scale-105`
                                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sty.dot}`} />
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <Label>Follow-up Note *</Label>
            <textarea
              className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                         text-sm text-slate-700 placeholder-slate-400 resize-none h-24
                         focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400
                         transition-all"
              placeholder="What happened? Next action, outcome, key points…"
              value={form.note}
              onChange={e => set('note', e.target.value)}
            />
          </div>

          {/* Next followup date */}
          <div>
            <Label>Next Follow-up Date</Label>
            <input type="date"
              className="mt-1.5 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                         text-sm text-slate-700 focus:outline-none focus:ring-2
                         focus:ring-brand-500/20 focus:border-brand-400 transition-all w-full"
              value={form.next_followup_date}
              onChange={e => set('next_followup_date', e.target.value)}
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600
                         text-sm font-semibold hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 text-white
                         text-sm font-bold transition-all flex items-center justify-center gap-2"
              style={{ boxShadow: '0 2px 10px rgba(14,170,218,.30)' }}>
              {saving
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg> Saving…</>
                : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg> Save FollowUp</>
              }
            </button>
          </div>
        </form>

        {/* ── History ──────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-5 py-4">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            FollowUp History
          </h3>
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-3">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Loading history…
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No followups recorded yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {history.map((h, i) => {
                const hss = STATUS_STYLE[h.status] || STATUS_STYLE.New;
                return (
                  <div key={h.id || i}
                    className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    {/* timeline dot */}
                    <div className="flex flex-col items-center">
                      <span className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${hss.dot}`} />
                      {i < history.length - 1 && (
                        <div className="w-px flex-1 bg-slate-200 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px]
                                          font-bold border ${hss.bg} ${hss.text} ${hss.border}`}>
                          {h.status}
                        </span>
                        {h.next_followup_date && (
                          <span className="text-[10px] text-violet-600 font-semibold bg-violet-50
                                           border border-violet-100 px-1.5 py-0.5 rounded-full">
                            📅 Next: {String(h.next_followup_date).substring(0, 10)}
                          </span>
                        )}
                      </div>
                      {h.note && (
                        <p className="text-[12px] text-slate-700 mt-1 leading-relaxed">{h.note}</p>
                      )}
                      <div className="text-[10px] text-slate-400 mt-1">
                        {h.created_by_name && <span className="font-medium text-slate-500">{h.created_by_name} · </span>}
                        {h.created_at && format(new Date(h.created_at), 'dd MMM yyyy, hh:mm a')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirm ───────────────────────────────────────────── */
function DeleteConfirm({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50
                    flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm p-6 text-center"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100
                        flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </div>
        <h3 className="font-bold text-slate-800 text-base mb-1">Delete Lead?</h3>
        <p className="text-sm text-slate-500 mb-5">
          This will permanently delete the lead and all its followup history. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600
                       text-sm font-semibold hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white
                       text-sm font-bold transition-all shadow-sm">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Filter Select ───────────────────────────────────────────── */
function FilterSelect({ value, onChange, placeholder, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`h-10 appearance-none bg-white border rounded-xl px-3.5 pr-8
                    text-sm font-medium transition-all focus:outline-none
                    focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-sm
                    ${value
                      ? 'border-brand-400/60 text-brand-600'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                      text-slate-600 pointer-events-none"
        fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

/* ── Pagination Button ───────────────────────────────────────── */
function PagBtn({ onClick, disabled, label }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-8 h-8 rounded-lg text-xs font-bold text-slate-600
                 hover:text-slate-700 hover:bg-slate-100
                 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
      {label}
    </button>
  );
}

/* ── Slot cell ───────────────────────────────────────────────── */
function SlotCell({ slotDate, slotTime, preferred, meetingDatetime }) {
  if (slotDate) {
    const dateStr = String(slotDate).substring(0, 10);
    const [y, m, d] = dateStr.split('-');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const display = `${d} ${monthNames[parseInt(m, 10) - 1]} ${y}`;
    let timeDisplay = '';
    if (slotTime) {
      const parts = String(slotTime).split(':');
      const hh = parseInt(parts[0], 10);
      const mm = parts[1] || '00';
      const ampm = hh >= 12 ? 'PM' : 'AM';
      timeDisplay = `${hh % 12 || 12}:${mm} ${ampm}`;
    }
    return (
      <div>
        <div className="text-[11px] font-bold text-violet-700">{display}</div>
        {timeDisplay && <div className="text-[10px] text-violet-500 font-medium mt-0.5">{timeDisplay}</div>}
      </div>
    );
  }
  const raw = preferred || meetingDatetime;
  if (!raw) return <span className="text-slate-300 text-xs">—</span>;
  try {
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) {
      return (
        <div>
          <div className="text-[11px] font-bold text-violet-700">{format(dt, 'dd MMM yyyy')}</div>
          <div className="text-[10px] text-violet-500 font-medium mt-0.5">{format(dt, 'hh:mm a')}</div>
        </div>
      );
    }
  } catch {}
  return <span className="text-[11px] text-violet-600 font-medium">{String(raw)}</span>;
}

/* ════════════════════════════════════════════════════════════════
   Add Lead Modal
═══════════════════════════════════════════════════════════════ */
function AddLeadModal({ users, sources, onClose, onSuccess }) {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', source: 'Manual',
    client_type: 'Type2', status: 'New', assigned_to: '', notes: '',
    company: '', industry: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await leadsApi.create({ ...form, assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null });
      toast.success('Lead created & automations triggered!');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create lead');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50
                    flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg my-4"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,.12)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Add New Lead</h2>
            <p className="text-xs text-slate-600 mt-0.5">Automations trigger on save</p>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Full Name *</Label>
              <input className="input mt-1" placeholder="Sachin Singhal"
                value={form.full_name} onChange={e => set('full_name', e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <input className="input mt-1" type="email" placeholder="name@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <input className="input mt-1" placeholder="+91 99999 99999"
                value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <Label>Company</Label>
              <input className="input mt-1" placeholder="Wizone AI Labs"
                value={form.company} onChange={e => set('company', e.target.value)} />
            </div>
            <div>
              <Label>Industry</Label>
              <input className="input mt-1" placeholder="Technology"
                value={form.industry} onChange={e => set('industry', e.target.value)} />
            </div>
            <div>
              <Label>Source</Label>
              <select className="input mt-1" value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="Manual">Manual</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select className="input mt-1" value={form.client_type} onChange={e => set('client_type', e.target.value)}>
                <option value="Type2">No Meeting</option>
                <option value="Type1">Meeting Booked</option>
              </select>
            </div>
            <div>
              <Label>Assign To</Label>
              <select className="input mt-1" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select className="input mt-1" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <textarea className="input mt-1 resize-none h-20 text-sm" placeholder="Any notes…"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg> Creating…</>
                : 'Create Lead'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
      {children}
    </span>
  );
}
