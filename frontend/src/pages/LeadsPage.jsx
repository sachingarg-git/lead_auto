import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import api, { leadsApi, usersApi } from '../services/api';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['New', 'FollowUp', 'DemoGiven', 'Converted', 'Lost', 'Nurture'];

/* ── Per-status style tokens ─────────────────────────────────── */
const S = {
  New:       { accent: '#0ea5e9', light: '#f0f9ff', text: '#0369a1', dot: 'bg-sky-400',     border: 'border-sky-200',     badge: 'bg-sky-50 text-sky-700 border-sky-200'     },
  FollowUp:  { accent: '#f59e0b', light: '#fffbeb', text: '#b45309', dot: 'bg-amber-400',   border: 'border-amber-200',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  DemoGiven: { accent: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', dot: 'bg-violet-400',  border: 'border-violet-200',  badge: 'bg-violet-50 text-violet-700 border-violet-200'},
  Converted: { accent: '#10b981', light: '#ecfdf5', text: '#047857', dot: 'bg-emerald-400', border: 'border-emerald-200', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'},
  Lost:      { accent: '#ef4444', light: '#fef2f2', text: '#b91c1c', dot: 'bg-red-400',     border: 'border-red-200',     badge: 'bg-red-50 text-red-600 border-red-200'       },
  Nurture:   { accent: '#ec4899', light: '#fdf2f8', text: '#9d174d', dot: 'bg-pink-400',    border: 'border-pink-200',    badge: 'bg-pink-50 text-pink-700 border-pink-200'    },
};

const STAT_KEY = {
  New: 'new_leads', FollowUp: 'follow_up', DemoGiven: 'demo_given',
  Converted: 'converted', Lost: 'lost', Nurture: 'nurture',
};

/* ── Status card icons (SVG) ─────────────────────────────────── */
const ICON = {
  New:       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />,
  FollowUp:  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
  DemoGiven: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.069A1 1 0 0121 8.82V15.18a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />,
  Converted: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></>,
  Lost:      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  Nurture:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
};

/* ── Slot tag helper: returns label + style for today/tomorrow ─ */
function getSlotTagInfo(lead) {
  if (lead.client_type !== 'Type1') return null;
  const now      = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const tom      = new Date(now); tom.setDate(now.getDate() + 1);
  const tomKey   = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,'0')}-${String(tom.getDate()).padStart(2,'0')}`;

  // Prefer meeting_datetime, fall back to slot_date
  let slotDt = null;
  if (lead.meeting_datetime) {
    slotDt = new Date(lead.meeting_datetime);
  } else if (lead.slot_date) {
    slotDt = new Date(lead.slot_date);
  }
  if (!slotDt || isNaN(slotDt)) return { label: '📅 Meeting', cls: 'bg-violet-50 text-violet-700 border-violet-200' };

  const y  = slotDt.getFullYear();
  const mo = String(slotDt.getMonth()+1).padStart(2,'0');
  const d  = String(slotDt.getDate()).padStart(2,'0');
  const dk = `${y}-${mo}-${d}`;

  // Format time from meeting_datetime
  let timeStr = '';
  if (lead.meeting_datetime) {
    const hh = slotDt.getHours();
    const mm = String(slotDt.getMinutes()).padStart(2,'0');
    const ap = hh >= 12 ? 'PM' : 'AM';
    timeStr = ` ${hh%12||12}:${mm} ${ap}`;
  }

  if (dk === todayKey) return { label: `⏰ Today${timeStr}`,    cls: 'bg-red-50 text-red-600 border-red-200',    isToday: true };
  if (dk === tomKey)   return { label: `📅 Tomorrow${timeStr}`, cls: 'bg-amber-50 text-amber-700 border-amber-200', isTomorrow: true };
  return { label: '📅 Meeting', cls: 'bg-violet-50 text-violet-700 border-violet-200' };
}

const getSourceStyle = s => {
  if (!s) return 'bg-slate-100 text-slate-600 border-slate-200';
  const l = s.toLowerCase();
  if (l.includes('wizone'))
    return 'bg-slate-800 text-cyan-300 border-cyan-700';           // dark — wizone.ai brand
  if (l.includes('meta') || l.includes('facebook') || l.includes('instagram'))
    return 'bg-blue-50 text-blue-600 border-blue-200';
  if (l.includes('landing') || l.includes('form') || l.includes('page'))
    return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (l.includes('manual')) return 'bg-slate-50 text-slate-600 border-slate-200';
  return 'bg-violet-50 text-violet-600 border-violet-200';
};

/* ════════════════════════════════════════════════════════════════
   LeadsPage
═══════════════════════════════════════════════════════════════ */
export default function LeadsPage() {
  const { can } = useAuth();

  const [leads,       setLeads]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [pages,       setPages]       = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [users,       setUsers]       = useState([]);
  const [sources,     setSources]     = useState([]);
  const [showAdd,     setShowAdd]     = useState(false);
  const [stats,       setStats]       = useState({});
  const [followupLead, setFollowupLead] = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);
  const [sendModal,   setSendModal]   = useState(null); // { lead, channel: 'email'|'whatsapp' }

  // Filters — including followup_date for Today / This Week cards
  const [filters, setFilters] = useState({
    status: '', source: '', client_type: '', search: '', followup_date: '',
  });

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
    setFilters(f => ({ ...f, status: f.status === s ? '' : s, followup_date: '' }));
    setPage(1);
  }

  function toggleFollowupDate(d) {
    setFilters(f => ({ ...f, followup_date: f.followup_date === d ? '' : d, status: '' }));
    setPage(1);
  }

  function clearAll() {
    setFilters({ status: '', source: '', client_type: '', search: '', followup_date: '' });
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
    } catch { toast.error('Failed to delete lead'); }
  }

  return (
    <div className="space-y-4 max-w-[1440px] mx-auto">

      {/* ── Status Cards Row ─────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {STATUSES.map(s => {
          const st     = S[s];
          const count  = stats[STAT_KEY[s]] ?? 0;
          const active = filters.status === s;
          return (
            <StatusCard key={s}
              label={s}
              count={count}
              accent={st.accent}
              light={st.light}
              textColor={st.text}
              icon={ICON[s]}
              active={active}
              onClick={() => toggleStatusFilter(s)}
            />
          );
        })}
      </div>

      {/* ── FollowUp Date Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <DateCard
          label="Today's FollowUp"
          sub="Leads due for follow-up today"
          count={stats.today_followups ?? 0}
          accent="#f59e0b"
          light="#fffbeb"
          textColor="#92400e"
          active={filters.followup_date === 'today'}
          onClick={() => toggleFollowupDate('today')}
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          }
        />
        <DateCard
          label="This Week's FollowUp"
          sub="Leads due this week"
          count={stats.week_followups ?? 0}
          accent="#8b5cf6"
          light="#f5f3ff"
          textColor="#5b21b6"
          active={filters.followup_date === 'week'}
          onClick={() => toggleFollowupDate('week')}
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          }
        />
      </div>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full h-10 bg-white border border-slate-200 rounded-xl pl-10 pr-4
                       text-sm text-slate-700 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400
                       transition-all shadow-sm"
            placeholder="Search name, email, phone…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>

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

        <div className="ml-auto flex items-center gap-1 text-xs text-slate-500 font-medium">
          <strong className="text-slate-700 text-sm">{total}</strong>
          lead{total !== 1 ? 's' : ''}
        </div>

        {can('leads:write') && (
          <button onClick={() => setShowAdd(true)}
            className="h-10 flex items-center gap-2 bg-brand-500 hover:bg-brand-600
                       text-white font-bold text-sm px-4 rounded-xl transition-all"
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
          <table className="w-full text-sm" style={{ minWidth: '1100px' }}>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Lead','Company','Contact','Industry','Slot','Meet','Source','Status','Date'].map(h => (
                  <th key={h}
                    className="px-4 py-3 text-[10px] font-bold text-slate-500
                               uppercase tracking-[0.1em] text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
                {/* Actions — sticky right so buttons never overflow off-screen */}
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]
                               text-left whitespace-nowrap sticky right-0 bg-slate-50/95 backdrop-blur-sm
                               border-l border-slate-100 z-10">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={9} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-8 h-8">
                      <div className="w-8 h-8 rounded-full border-2 border-slate-200" />
                      <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin absolute inset-0" />
                    </div>
                    <span className="text-slate-500 text-xs">Loading leads…</span>
                  </div>
                </td></tr>
              ) : !leads.length ? (
                <tr><td colSpan={9} className="py-20 text-center">
                  <div className="text-4xl mb-3 opacity-20">👤</div>
                  <div className="text-slate-600 text-sm font-medium">No leads found</div>
                  {activeFilters > 0 && (
                    <button onClick={clearAll}
                      className="mt-2 text-xs text-brand-500 hover:text-brand-600 font-semibold">
                      Clear filters
                    </button>
                  )}
                </td></tr>
              ) : leads.map(lead => (
                <LeadRow key={lead.id} lead={lead}
                  users={users}
                  onFollowUp={() => setFollowupLead(lead)}
                  onDelete={() => setDeleteId(lead.id)}
                  onAssigned={() => loadLeads()}
                  onEmail={() => setSendModal({ lead, channel: 'email' })}
                  onWhatsApp={() => setSendModal({ lead, channel: 'whatsapp' })}
                  onGenerateMeet={() => {
                    toast.promise(
                      leadsApi.generateMeetLink(lead.id).then(r => {
                        loadLeads(); // refresh to show new 🎥 icon
                        return r.data;
                      }),
                      {
                        loading: 'Generating meet link…',
                        success: d => d.email_sent
                          ? `✅ Meet link created & email sent to ${lead.email}`
                          : `✅ Meet link created${!lead.email ? ' (no email on file)' : ''}`,
                        error: e => `Failed: ${e.response?.data?.error || e.message}`,
                      }
                    );
                  }}
                />
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
                      p === page ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
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
        <FollowUpModal lead={followupLead}
          onClose={() => setFollowupLead(null)}
          onSuccess={() => { setFollowupLead(null); loadLeads(); loadStats(); }} />
      )}
      {deleteId && (
        <DeleteConfirm
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)} />
      )}
      {sendModal && (
        <SendMessageModal
          lead={sendModal.lead}
          channel={sendModal.channel}
          onClose={() => setSendModal(null)}
          onSuccess={() => setSendModal(null)}
        />
      )}
    </div>
  );
}

/* ── Professional Status Card ─────────────────────────────────── */
function StatusCard({ label, count, accent, light, textColor, icon, active, onClick }) {
  return (
    <button onClick={onClick}
      className="relative bg-white rounded-2xl border border-slate-200 text-left
                 transition-all duration-200 overflow-hidden group
                 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        boxShadow: active ? `0 0 0 2px ${accent}, 0 4px 16px ${accent}22` : '0 1px 4px rgba(0,0,0,.06)',
        borderColor: active ? accent : undefined,
      }}>
      {/* Colored top strip */}
      <div className="h-1 w-full" style={{ background: active ? accent : `${accent}40` }} />

      <div className="px-3.5 pt-3 pb-3.5">
        {/* Icon circle */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 transition-colors"
          style={{ background: active ? `${accent}18` : `${accent}0d` }}>
          <svg className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: accent }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {icon}
          </svg>
        </div>

        {/* Count */}
        <div className="text-2xl font-black leading-none mb-1" style={{ color: active ? accent : textColor }}>
          {count}
        </div>

        {/* Label */}
        <div className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: active ? accent : '#94a3b8' }}>
          {label}
        </div>
      </div>

      {/* Active indicator dot */}
      {active && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: accent }} />
      )}
    </button>
  );
}

/* ── FollowUp Date Card (wider) ──────────────────────────────── */
function DateCard({ label, sub, count, accent, light, textColor, icon, active, onClick }) {
  return (
    <button onClick={onClick}
      className="relative bg-white rounded-2xl border border-slate-200 text-left
                 transition-all duration-200 overflow-hidden
                 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        boxShadow: active ? `0 0 0 2px ${accent}, 0 4px 20px ${accent}22` : '0 1px 4px rgba(0,0,0,.06)',
        borderColor: active ? accent : undefined,
      }}>
      {/* Colored top strip */}
      <div className="h-1 w-full" style={{ background: active ? accent : `${accent}50` }} />

      <div className="flex items-center gap-4 px-5 py-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: active ? `${accent}18` : `${accent}0d` }}>
          <svg style={{ width: 22, height: 22, color: accent }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {icon}
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black leading-none" style={{ color: active ? accent : textColor }}>
              {count}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">leads</span>
          </div>
          <div className="font-bold text-slate-700 text-sm mt-0.5">{label}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
        </div>

        {/* Arrow */}
        <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      </div>

      {active && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: accent }} />
      )}
    </button>
  );
}

/* ── Lead Row ─────────────────────────────────────────────────── */
function LeadRow({ lead, users, onFollowUp, onDelete, onAssigned, onEmail, onWhatsApp, onGenerateMeet }) {
  const st = S[lead.status] || S.New;
  const followupCount = parseInt(lead.followup_count) || 0;
  const [showAssign, setShowAssign] = useState(false);
  const [assigning,  setAssigning]  = useState(false);

  async function handleAssign(userId) {
    setAssigning(true);
    try {
      await leadsApi.assign(lead.id, userId || null);
      toast.success(userId ? 'Lead assigned!' : 'Lead unassigned');
      setShowAssign(false);
      onAssigned();
    } catch { toast.error('Failed to assign lead'); }
    finally { setAssigning(false); }
  }

  return (
    <tr className="group hover:bg-slate-50/60 transition-colors">

      {/* Name + auto tags */}
      <td className="px-4 py-3">
        <button onClick={onFollowUp} className="flex items-center gap-2.5 text-left w-full group/link">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/15
                            flex items-center justify-center text-brand-600 text-xs font-bold">
              {lead.full_name?.[0]?.toUpperCase()}
            </div>
          </div>
          <div className="min-w-0">
            {/* ── Auto color-coded tags ABOVE the name ── */}
            <div className="flex flex-wrap items-center gap-1 mb-0.5">
              {(() => {
                const tag = getSlotTagInfo(lead);
                return tag ? (
                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold
                                   px-1.5 py-0.5 rounded-full border leading-none ${tag.cls}`}>
                    {tag.label}
                  </span>
                ) : null;
              })()}
              {parseInt(lead.reschedule_count) > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold
                                 px-1.5 py-0.5 rounded-full border leading-none
                                 bg-amber-50 text-amber-700 border-amber-200">
                  🔄 {lead.reschedule_count}×
                </span>
              )}
              {followupCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold
                                 px-1.5 py-0.5 rounded-full border leading-none
                                 bg-sky-50 text-sky-700 border-sky-200">
                  💬 {followupCount}
                </span>
              )}
            </div>
            {/* Name */}
            <div className="font-semibold text-slate-800 group-hover/link:text-brand-600
                            transition-colors text-[13px] truncate max-w-[140px]">
              {lead.full_name}
            </div>
          </div>
        </button>
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        <span className="text-[12px] text-slate-600 max-w-[130px] block truncate" title={lead.company}>
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
          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[150px]">{lead.email}</div>
        )}
      </td>

      {/* Industry */}
      <td className="px-4 py-3">
        <span className="text-[12px] text-slate-600">
          {lead.industry || <span className="text-slate-300">—</span>}
        </span>
      </td>

      {/* Slot */}
      <td className="px-4 py-3">
        <SlotCell slotDate={lead.slot_date} slotTime={lead.slot_time}
          preferred={lead.preferred_slot} meetingDatetime={lead.meeting_datetime} />
      </td>

      {/* Google Meet Link */}
      <td className="px-4 py-3 text-center">
        {lead.meeting_link ? (
          <a
            href={lead.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            title={`Join Meet: ${lead.meeting_link}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg
                       bg-sky-50 border border-sky-200 text-sky-600 hover:bg-sky-100
                       hover:border-sky-400 transition-all"
          >
            🎥
          </a>
        ) : (
          <span className="text-slate-200 text-lg" title="No Meet link">—</span>
        )}
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

      {/* Status badge — static, no dropdown */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border
                          text-[11px] font-semibold ${st.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          {lead.status}
        </span>
      </td>

      {/* Date — created_at returned as IST string "YYYY-MM-DDTHH:MI:SS" (no Z) */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-[12px] font-semibold text-slate-600">
          {lead.created_at ? format(new Date(lead.created_at), 'dd MMM') : '—'}
        </div>
        <div className="text-[10px] text-slate-400">
          {lead.created_at ? lead.created_at.substring(11, 16) : ''}
        </div>
      </td>

      {/* Actions — sticky right so buttons always visible */}
      <td className="px-4 py-3 sticky right-0 bg-white border-l border-slate-100 z-10"
          style={{ boxShadow: '-2px 0 6px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-0.5">
          {/* View */}
          <Link to={`/leads/${lead.id}`} title="View Detail"
            className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200
                       bg-white text-slate-400 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50
                       transition-all shadow-sm">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </Link>

          {/* Quick Assign */}
          <div className="relative">
            <button
              onClick={() => setShowAssign(s => !s)}
              title={lead.assigned_to_name ? `Assigned: ${lead.assigned_to_name}` : 'Assign to user'}
              className={`w-6 h-6 flex items-center justify-center rounded-md border transition-all shadow-sm
                ${lead.assigned_to_name
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-500 hover:bg-indigo-100'
                  : 'border-slate-200 bg-white text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-500'}`}>
              {assigning
                ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
              }
            </button>

            {showAssign && (
              <div className="absolute right-0 top-9 z-50 bg-white border border-slate-200 rounded-xl shadow-xl
                              min-w-[180px] py-1 overflow-hidden"
                   style={{ boxShadow:'0 8px 24px rgba(0,0,0,.12)' }}>
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assign To</p>
                  {lead.assigned_to_name && (
                    <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                      Currently: {lead.assigned_to_name}
                    </p>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <button
                    onClick={() => handleAssign(null)}
                    className="w-full text-left px-3 py-2 text-[12px] text-slate-500 hover:bg-slate-50
                               flex items-center gap-2 transition-colors">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400">—</span>
                    Unassigned
                  </button>
                  {users.map(u => (
                    <button key={u.id}
                      onClick={() => handleAssign(u.id)}
                      className={`w-full text-left px-3 py-2 text-[12px] hover:bg-indigo-50
                                  flex items-center gap-2 transition-colors
                                  ${lead.assigned_to === u.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'}`}>
                      <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center
                                       text-[9px] font-bold text-indigo-500 shrink-0">
                        {u.name[0].toUpperCase()}
                      </span>
                      {u.name}
                      {lead.assigned_to === u.id && <span className="ml-auto text-indigo-400">✓</span>}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 px-3 py-1.5">
                  <button onClick={() => setShowAssign(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 w-full text-center">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* FollowUp */}
          <button onClick={onFollowUp} title="Add FollowUp"
            className="w-6 h-6 flex items-center justify-center rounded-md border border-amber-200
                       bg-amber-50 text-amber-500 hover:bg-amber-100 hover:border-amber-400
                       transition-all shadow-sm">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
          </button>

          {/* Send Email */}
          {lead.email && (
            <button onClick={onEmail} title={`Send Email → ${lead.email}`}
              className="w-6 h-6 flex items-center justify-center rounded-md border border-sky-200
                         bg-sky-50 text-sky-500 hover:bg-sky-100 hover:border-sky-400
                         transition-all shadow-sm">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </button>
          )}

          {/* Send WhatsApp */}
          {(lead.phone || lead.whatsapp_number) && (
            <button onClick={onWhatsApp} title={`Send WhatsApp → ${lead.whatsapp_number || lead.phone}`}
              className="w-6 h-6 flex items-center justify-center rounded-md border border-emerald-200
                         bg-emerald-50 text-emerald-500 hover:bg-emerald-100 hover:border-emerald-400
                         transition-all shadow-sm">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </button>
          )}

          {/* Generate Meet Link */}
          <button
            onClick={e => { e.stopPropagation(); onGenerateMeet(); }}
            title={lead.meeting_link ? 'Regenerate Meet Link & Resend Email' : 'Generate Meet Link & Send Email'}
            className={`w-6 h-6 flex items-center justify-center rounded-md border transition-all shadow-sm
              ${lead.meeting_link
                ? 'border-violet-200 bg-violet-50 text-violet-500 hover:bg-violet-100 hover:border-violet-400'
                : 'border-teal-200 bg-teal-50 text-teal-600 hover:bg-teal-100 hover:border-teal-400'
              }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10l4.553-2.069A1 1 0 0121 8.82V15.18a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Delete */}
          <button onClick={onDelete} title="Delete Lead"
            className="w-6 h-6 flex items-center justify-center rounded-md border border-red-200
                       bg-red-50 text-red-400 hover:bg-red-100 hover:border-red-400
                       transition-all shadow-sm">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Activity type config ─────────────────────────────────────── */
const ACTIVITY_CFG = {
  followup:      { icon: '💬', label: 'Follow-up',     bg: '#fffbeb', border: '#fcd34d', color: '#b45309' },
  status_change: { icon: '🔄', label: 'Status Change', bg: '#f0f9ff', border: '#bae6fd', color: '#0369a1' },
  assigned:      { icon: '👤', label: 'Assigned',      bg: '#eef2ff', border: '#c7d2fe', color: '#4338ca' },
  edit:          { icon: '✏️', label: 'Edited',        bg: '#f8fafc', border: '#e2e8f0', color: '#475569' },
  created:       { icon: '🚀', label: 'Created',       bg: '#ecfdf5', border: '#6ee7b7', color: '#047857' },
};

/* ── FollowUp Modal ───────────────────────────────────────────── */
function FollowUpModal({ lead, onClose, onSuccess }) {
  const [form, setForm] = useState({ status: lead.status, note: '', next_followup_date: '' });
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const st = S[lead.status] || S.New;

  useEffect(() => {
    // Load full activity log (followups + assignments + edits + creation)
    leadsApi.getActivity(lead.id)
      .then(r => setActivity(r.data))
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-2xl"
          style={{ background: `${S[lead.status]?.accent || '#0ea5e9'}08` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white border border-slate-200
                            flex items-center justify-center font-bold text-slate-700 shadow-sm text-sm">
              {lead.full_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base leading-tight">{lead.full_name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]
                                  font-bold border ${st.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {lead.status}
                </span>
                {lead.phone && <span className="text-[11px] text-slate-500">{lead.phone}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 hover:bg-white/60 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Status picker */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Update Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => {
                const sty = S[s];
                const active = form.status === s;
                return (
                  <button type="button" key={s} onClick={() => set('status', s)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                text-[11px] font-bold border-2 transition-all duration-150
                                ${active ? `${sty.badge} scale-105 shadow-sm` : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sty.dot}`} />
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Follow-up Note *
            </label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                         text-sm text-slate-700 placeholder-slate-400 resize-none h-24
                         focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
              placeholder="What happened? Next action, outcome, key points…"
              value={form.note}
              onChange={e => set('note', e.target.value)}
            />
          </div>

          {/* Next date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Next Follow-up Date
            </label>
            <input type="date"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                         text-sm text-slate-700 focus:outline-none focus:ring-2
                         focus:ring-brand-500/20 focus:border-brand-400 transition-all"
              value={form.next_followup_date}
              onChange={e => set('next_followup_date', e.target.value)}
            />
          </div>

          <div className="flex gap-2.5 pt-1">
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
                    </svg>Saving…</>
                : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>Save FollowUp</>
              }
            </button>
          </div>
        </form>

        {/* Full Activity Log */}
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Activity Log
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
              {activity.length} event{activity.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loadingHistory ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg> Loading activity…
            </div>
          ) : !activity.length ? (
            <p className="text-xs text-slate-400 italic py-1">No activity recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activity.map((a, i) => {
                const cfg = ACTIVITY_CFG[a.action_type] || ACTIVITY_CFG.edit;
                return (
                  <div key={a.id || i}
                    className="flex gap-3 p-3 rounded-xl border"
                    style={{ background: cfg.bg, borderColor: cfg.border }}>

                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center pt-0.5 shrink-0">
                      <span className="text-base leading-none">{cfg.icon}</span>
                      {i < activity.length - 1 && (
                        <div className="w-px flex-1 mt-1.5" style={{ background: cfg.border }} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Action type badge */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                              style={{ background:'white', color: cfg.color, borderColor: cfg.border }}>
                          {cfg.label}
                        </span>

                        {/* For followup: show status change */}
                        {a.action_type === 'followup' && a.old_value && a.new_value && (
                          <span className="text-[10px] text-slate-500">
                            <span className={`font-semibold ${S[a.old_value]?.text || 'text-slate-500'}`}>{a.old_value}</span>
                            {' → '}
                            <span className={`font-semibold ${S[a.new_value]?.text || 'text-slate-500'}`}>{a.new_value}</span>
                          </span>
                        )}

                        {/* For status_change */}
                        {a.action_type === 'status_change' && a.old_value && a.new_value && (
                          <span className="text-[10px] text-slate-500">
                            <span className={`font-semibold ${S[a.old_value]?.text || 'text-slate-500'}`}>{a.old_value}</span>
                            {' → '}
                            <span className={`font-semibold ${S[a.new_value]?.text || 'text-slate-500'}`}>{a.new_value}</span>
                          </span>
                        )}
                      </div>

                      {/* Field change: show old → new */}
                      {(a.action_type === 'edit' || a.action_type === 'assigned') && a.field_name && (
                        <div className="text-[11px] text-slate-600 mb-1">
                          <span className="font-semibold">{a.field_name}:</span>{' '}
                          {a.old_value && (
                            <span className="line-through text-slate-400 mr-1">{a.old_value}</span>
                          )}
                          <span className="font-semibold" style={{ color: cfg.color }}>
                            {a.new_value || 'Unassigned'}
                          </span>
                        </div>
                      )}

                      {/* Note / description */}
                      {a.note && (
                        <p className="text-[12px] text-slate-700 leading-relaxed bg-white/70
                                      rounded-lg px-2.5 py-1.5 border border-white mt-1">
                          {a.note}
                        </p>
                      )}

                      {/* Footer: actor + time */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="w-4 h-4 rounded-full bg-white border flex items-center justify-center
                                         text-[8px] font-bold shrink-0"
                              style={{ color: cfg.color, borderColor: cfg.border }}>
                          {(a.actor_name || 'S')[0].toUpperCase()}
                        </span>
                        <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>
                          {a.actor_name || 'System'}
                        </span>
                        <span className="text-[10px] text-slate-300">·</span>
                        <span className="text-[10px] text-slate-400">
                          {a.created_at && format(new Date(a.created_at), 'dd MMM yyyy, hh:mm a')}
                        </span>
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
        <p className="text-sm text-slate-500 mb-5">All followup history will be permanently deleted.</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600
                       text-sm font-semibold hover:bg-slate-50 transition-all">Cancel</button>
          <button onClick={onConfirm}
            className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white
                       text-sm font-bold transition-all shadow-sm">Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ── Filter Select ───────────────────────────────────────────── */
function FilterSelect({ value, onChange, placeholder, children }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`h-10 appearance-none bg-white border rounded-xl px-3.5 pr-8
                    text-sm font-medium transition-all focus:outline-none shadow-sm cursor-pointer
                    focus:ring-2 focus:ring-brand-500/20
                    ${value ? 'border-brand-400/60 text-brand-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                      text-slate-400 pointer-events-none"
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
      className="w-8 h-8 rounded-lg text-xs font-bold text-slate-500
                 hover:text-slate-700 hover:bg-slate-100
                 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
      {label}
    </button>
  );
}

/* ── Slot Cell ───────────────────────────────────────────────── */
/**
 * Format slot time — backend now returns plain "HH:MM" string (IST, no timezone shift).
 * e.g. "10:00" → "10:00 AM" | "14:00" → "2:00 PM"
 */
function formatSlotTime(val) {
  if (!val) return '';
  // Handle "HH:MM" or "HH:MM:SS" string from backend
  const parts = String(val).split(':');
  const hh = parseInt(parts[0], 10);
  if (isNaN(hh)) return '';
  const mm = String(parseInt(parts[1] || '0', 10)).padStart(2, '0');
  return `${hh % 12 || 12}:${mm} ${hh >= 12 ? 'PM' : 'AM'}`;
}

function SlotCell({ slotDate, slotTime, preferred, meetingDatetime }) {
  if (slotDate) {
    // slotDate arrives as "2026-04-25T00:00:00.000Z" — substring(0,10) is safe
    const dateStr = String(slotDate).substring(0, 10);
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const display = `${d} ${months[parseInt(m,10)-1]} ${y}`;
    const timeDisplay = formatSlotTime(slotTime);
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
    if (!isNaN(dt.getTime())) return (
      <div>
        <div className="text-[11px] font-bold text-violet-700">{format(dt, 'dd MMM yyyy')}</div>
        <div className="text-[10px] text-violet-500 font-medium mt-0.5">{format(dt, 'hh:mm a')}</div>
      </div>
    );
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
    company: '', industry: '', slot_date: '', slot_time: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleSlotDate(v) {
    set('slot_date', v);
    if (v) set('client_type', 'Type1');
    else set('client_type', 'Type2');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await leadsApi.create({
        ...form,
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
        slot_date: form.slot_date || null,
        slot_time: form.slot_time || null,
        preferred_slot: form.slot_date
          ? (form.slot_time ? `${form.slot_date} ${form.slot_time}` : form.slot_date)
          : null,
      });
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
            <p className="text-xs text-slate-500 mt-0.5">Automations trigger on save</p>
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
            <div><Label>Email</Label>
              <input className="input mt-1" type="email" placeholder="name@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div><Label>Phone</Label>
              <input className="input mt-1" placeholder="+91 99999 99999"
                value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div><Label>Company</Label>
              <input className="input mt-1" placeholder="Wizone AI Labs"
                value={form.company} onChange={e => set('company', e.target.value)} />
            </div>
            <div><Label>Industry</Label>
              <input className="input mt-1" placeholder="Technology"
                value={form.industry} onChange={e => set('industry', e.target.value)} />
            </div>
            <div><Label>Source</Label>
              <select className="input mt-1" value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="Manual">Manual</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label>Assign To</Label>
              <select className="input mt-1" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div><Label>Status</Label>
              <select className="input mt-1" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label>Type</Label>
              <select className="input mt-1" value={form.client_type} onChange={e => set('client_type', e.target.value)}>
                <option value="Type2">No Meeting</option>
                <option value="Type1">Meeting Booked</option>
              </select>
            </div>

            {/* Slot Booking */}
            <div className="col-span-2 mt-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  📅 Slot Booking (Optional)
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
            </div>
            <div><Label>Appointment Date</Label>
              <input type="date" className="input mt-1"
                value={form.slot_date} onChange={e => handleSlotDate(e.target.value)} />
            </div>
            <div><Label>Appointment Time</Label>
              <input type="time" className="input mt-1"
                value={form.slot_time} onChange={e => set('slot_time', e.target.value)} />
            </div>
            {form.slot_date && (
              <div className="col-span-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl">
                  <span className="text-violet-500">📅</span>
                  <span className="text-[12px] font-semibold text-violet-700">
                    {form.slot_date}{form.slot_time && ` at ${form.slot_time}`}
                  </span>
                  <span className="ml-auto text-[10px] bg-violet-200 text-violet-700 px-2 py-0.5 rounded-full font-bold">
                    Reminders will trigger
                  </span>
                </div>
              </div>
            )}

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
                    </svg>Creating…</>
                : 'Create Lead'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Send Message Modal  (Email or WhatsApp)
═══════════════════════════════════════════════════════════════ */
function SendMessageModal({ lead, channel, onClose, onSuccess }) {
  const isEmail = channel === 'email';
  const [template,      setTemplate]      = useState('welcome');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody,    setCustomBody]    = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending]             = useState(false);

  // Build live welcome-template preview text
  const welcomePreviewEmail = {
    subject: `Welcome — We've received your enquiry, ${lead.full_name?.split(' ')[0] || 'there'}!`,
    body: `Hi ${lead.full_name?.split(' ')[0] || 'there'},\n\nThank you for reaching out. We've received your enquiry and our team will get back to you shortly.\n\n${lead.company ? `Company: ${lead.company}\n` : ''}${lead.phone ? `Phone: ${lead.phone}\n` : ''}\nWarm regards,\nWizone Team`,
  };
  const welcomePreviewWA =
    `Hi ${lead.full_name?.split(' ')[0] || 'there'} 👋\n\nThank you for reaching out! We've received your enquiry and will be in touch shortly.\n\nTeam Wizone`;

  async function handleSend() {
    if (isEmail) {
      if (template === 'custom' && !customSubject.trim()) { toast.error('Subject is required'); return; }
      if (template === 'custom' && !customBody.trim())    { toast.error('Message body is required'); return; }
    } else {
      if (template === 'custom' && !customMessage.trim()) { toast.error('Message is required'); return; }
    }
    setSending(true);
    try {
      if (isEmail) {
        await leadsApi.sendEmail(lead.id, {
          template,
          custom_subject: template === 'custom' ? customSubject : undefined,
          custom_body:    template === 'custom' ? customBody    : undefined,
        });
        toast.success(`Email sent to ${lead.email}!`);
      } else {
        await leadsApi.sendWhatsApp(lead.id, {
          template,
          custom_message: template === 'custom' ? customMessage : undefined,
        });
        toast.success(`WhatsApp sent to ${lead.whatsapp_number || lead.phone}!`);
      }
      onSuccess();
    } catch {
      // Error toast is already shown by the global api.js interceptor — no duplicate needed
    } finally { setSending(false); }
  }

  const accentColor  = isEmail ? '#0ea5e9' : '#10b981';
  const accentLight  = isEmail ? '#f0f9ff' : '#ecfdf5';
  const accentBorder = isEmail ? '#bae6fd' : '#6ee7b7';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50
                    flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg my-4"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,.15)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-2xl"
          style={{ background: accentLight }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: accentColor, color: 'white' }}>
              {isEmail
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                : <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
              }
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">
                {isEmail ? 'Send Email' : 'Send WhatsApp'}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEmail ? `To: ${lead.email}` : `To: ${lead.whatsapp_number || lead.phone}`}
                <span className="ml-2 font-semibold" style={{ color: accentColor }}>· {lead.full_name}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 hover:bg-white/60 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Template Picker */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Message Template
            </label>
            <div className="flex gap-2">
              {[
                { val: 'welcome', label: '⭐ Welcome Template', desc: 'Auto-built from lead data' },
                { val: 'custom',  label: '✍️ Custom Message',   desc: 'Write your own' },
              ].map(t => (
                <button key={t.val} type="button"
                  onClick={() => setTemplate(t.val)}
                  className={`flex-1 p-3 rounded-xl border-2 text-left transition-all
                    ${template === t.val
                      ? 'border-current shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                  style={template === t.val ? {
                    borderColor: accentColor,
                    background: accentLight,
                    color: accentColor,
                  } : {}}>
                  <div className="text-[12px] font-bold">{t.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview / Custom fields */}
          {template === 'welcome' ? (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Preview
              </label>
              <div className="rounded-xl border p-3.5 text-[12px] text-slate-700 leading-relaxed"
                style={{ background: accentLight, borderColor: accentBorder }}>
                {isEmail ? (
                  <>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b"
                      style={{ borderColor: accentBorder }}>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Subject</span>
                      <span className="font-semibold text-slate-700 text-[12px]">{welcomePreviewEmail.subject}</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-[12px] text-slate-700 leading-relaxed">
                      {welcomePreviewEmail.body}
                    </pre>
                  </>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-[12px] text-slate-700 leading-relaxed">
                    {welcomePreviewWA}
                  </pre>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 italic">
                Actual message uses your saved template settings from Settings page.
              </p>
            </div>
          ) : isEmail ? (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Subject *
                </label>
                <input
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                             text-sm text-slate-700 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
                  placeholder="e.g. Following up on your enquiry…"
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Message Body *
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                             text-sm text-slate-700 placeholder-slate-400 resize-none h-32
                             focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
                  placeholder={`Hi ${lead.full_name?.split(' ')[0] || 'there'},\n\nWrite your message here…`}
                  value={customBody}
                  onChange={e => setCustomBody(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                WhatsApp Message *
              </label>
              <textarea
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl
                           text-sm text-slate-700 placeholder-slate-400 resize-none h-36
                           focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                placeholder={`Hi ${lead.full_name?.split(' ')[0] || 'there'} 👋\n\nWrite your message here…`}
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Emoji and line breaks are supported.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600
                         text-sm font-semibold hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button type="button" onClick={handleSend} disabled={sending}
              className="flex-1 h-10 rounded-xl text-white text-sm font-bold
                         transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ background: accentColor, boxShadow: `0 2px 10px ${accentColor}50` }}>
              {sending
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>Sending…</>
                : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>Send {isEmail ? 'Email' : 'WhatsApp'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">{children}</span>
  );
}
