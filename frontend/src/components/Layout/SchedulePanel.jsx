import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, meetingsApi } from '../../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

/* ── Status colours ────────────────────────────────────────── */
const STATUS_COLOR = {
  New:       'bg-sky-400',
  FollowUp:  'bg-amber-400',
  DemoGiven: 'bg-violet-400',
  Converted: 'bg-emerald-500',
  Lost:      'bg-red-400',
  Nurture:   'bg-pink-400',
};

/* ── Meeting status config ─────────────────────────────────── */
const MTG_STATUS = {
  upcoming:   { label: 'Upcoming',   cls: 'bg-sky-50 text-sky-700 border-sky-200',       dot: 'bg-sky-400' },
  started:    { label: 'In Progress',cls: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500 animate-pulse' },
  completed:  { label: 'Completed',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  missed:     { label: 'Missed',     cls: 'bg-red-50 text-red-700 border-red-200',        dot: 'bg-red-400' },
  rescheduled:{ label: 'Rescheduled',cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
};

/* ── Avatar initials ───────────────────────────────────────── */
function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

const AVATAR_COLORS = [
  'bg-brand-500','bg-violet-500','bg-emerald-500',
  'bg-amber-500', 'bg-rose-500',  'bg-indigo-500',
  'bg-teal-500',  'bg-pink-500',
];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ── Minutes until a slot ──────────────────────────────────── */
function minsUntil(isoStr) {
  if (!isoStr) return null;
  return Math.round((new Date(isoStr).getTime() - Date.now()) / 60000);
}

/* ════════════════════════════════════════════════════════════
   Schedule Panel
═══════════════════════════════════════════════════════════ */
export default function SchedulePanel({ isOpen, onClose }) {
  const navigate    = useNavigate();
  const scrollBodyRef = useRef(null);
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [now,     setNow]     = useState(Date.now());
  const [actionModal, setActionModal] = useState(null); // { item }

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await dashboardApi.getSchedule();
      setGroups(Array.isArray(r.data) ? r.data : []);
    } catch {
      setError('Could not load schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  // Tick every 30s for 5-min red alert
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to current hour row when panel opens (after data loads)
  useEffect(() => {
    if (!isOpen || loading || !scrollBodyRef.current) return;
    const currentHour = new Date().getHours();
    // Clamp to working hours for the target: if before 9 → scroll top, if ≥18 → end of today
    const targetHour = Math.min(Math.max(currentHour, WORK_START), WORK_END - 1);
    const el = scrollBodyRef.current.querySelector(`[data-hour="${targetHour}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else {
      // Fallback: scroll to the today section header
      const todayEl = scrollBodyRef.current.querySelector('[data-today="true"]');
      if (todayEl) todayEl.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [isOpen, loading]); // runs once groups appear after load

  const totalSlots = groups.reduce((s, g) => s + g.items.length, 0);

  // Check if any slot within 5 min that hasn't started yet — show notification
  const alertItems = groups.flatMap(g => g.items).filter(item => {
    if (!item.slot_iso) return false;
    if (item.meeting_status !== 'upcoming') return false;
    const mins = minsUntil(item.slot_iso);
    return mins !== null && mins >= 0 && mins <= 5;
  });

  // Find today's group + first booked slot for header indicator
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const hasTodaySlots  = groups.some(g => g.date_key === todayKey);
  const todayGroup     = groups.find(g => g.date_key === todayKey);
  const todayFirstBook = todayGroup?.items?.[0] ?? null;

  return (
    <>
      <aside className="h-full flex flex-col bg-white overflow-hidden">

        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 h-16 border-b border-slate-100 shrink-0"
          style={{ background: 'linear-gradient(135deg,#f8fafc 0%,#f0f5fb 100%)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20
                            flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                Schedule
                {totalSlots > 0 && (
                  <span className="bg-brand-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {totalSlots}
                  </span>
                )}
                {alertItems.length > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none animate-pulse">
                    ⚡ {alertItems.length} now
                  </span>
                )}
              </div>
              {/* Today's booked slot indicator or current date */}
              {todayFirstBook ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                  <span className="text-[10px] text-brand-600 font-semibold truncate max-w-[140px]">
                    {todayFirstBook.full_name}
                  </span>
                  {todayFirstBook.time_str && (
                    <span className="text-[9px] text-slate-400 font-medium shrink-0">
                      · {todayFirstBook.time_str}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 font-medium">
                  {format(new Date(), 'EEEE, d MMM yyyy')}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button onClick={load} disabled={loading} title="Refresh"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100
                         transition-colors disabled:opacity-40">
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Sub-header ─────────────────────────────────────── */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/70">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            🎯 Booked Slots — Next 30 Days
          </span>
        </div>

        {/* ── 5-min alert banner ─────────────────────────────── */}
        {alertItems.length > 0 && (
          <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <span className="text-red-500 text-sm animate-pulse">🔔</span>
            <span className="text-[11px] font-bold text-red-700">
              Meeting starting NOW — {alertItems.map(a => a.full_name).join(', ')}
            </span>
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────── */}
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto">

          {loading && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="relative w-8 h-8">
                <div className="w-8 h-8 rounded-full border-2 border-brand-100" />
                <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin absolute inset-0" />
              </div>
              <span className="text-xs text-slate-500 font-medium">Loading…</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 px-6 text-center">
              <span className="text-2xl">⚠️</span>
              <span className="text-sm text-slate-600">{error}</span>
              <button onClick={load} className="text-xs text-brand-500 hover:underline font-semibold mt-1">
                Try again
              </button>
            </div>
          )}

          {!loading && !error && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="text-5xl mb-4">📅</div>
              <div className="text-sm font-bold text-slate-700 mb-1">No slots booked</div>
              <div className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
                No meeting slots scheduled in the next 30 days.
              </div>
            </div>
          )}

          {/* "Today free" message — when today has no bookings (show as its own timeline card) */}
          {!loading && !error && !hasTodaySlots && (
            <div data-today="true">
              {/* Today header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-brand-500">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white">Today</div>
                  <div className="text-[9px] font-medium mt-0.5 text-brand-100">
                    {new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
                  </div>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white leading-none">
                  {TOTAL_WORK_SLOTS} free
                </span>
              </div>
              {/* All-free slots */}
              <div className="divide-y divide-slate-50">
                {Array.from({ length: TOTAL_WORK_SLOTS }, (_, i) => {
                  const hour = WORK_START + i;
                  return (
                    <div key={hour}
                      data-hour={hour}
                      className="flex items-center gap-3 px-4 py-2 opacity-60 hover:opacity-80 transition-opacity">
                      <div className="shrink-0 w-14 text-right">
                        <span className="text-[10px] text-slate-400 font-medium">{fmt12(hour)}</span>
                      </div>
                      <div className="w-0.5 h-5 rounded-full bg-emerald-200 shrink-0" />
                      <span className="text-[10px] text-emerald-600 font-medium">Free slot</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && !error && groups.map((group, gi) => (
            <DayGroup
              key={group.date_key}
              group={group}
              isFirst={gi === 0}
              now={now}
              onNavigate={(id) => { navigate(`/leads/${id}`); onClose(); }}
              onAction={(item) => setActionModal(item)}
            />
          ))}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <button
            onClick={() => { navigate('/leads?client_type=Type1'); onClose(); }}
            className="w-full flex items-center justify-center gap-2
                       text-xs font-semibold text-brand-600 hover:text-brand-700
                       py-2 rounded-xl border border-brand-200 hover:border-brand-300
                       bg-brand-50 hover:bg-brand-100/60 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View All Booked Leads
          </button>
        </div>
      </aside>

      {/* ── Meeting Action Modal ────────────────────────────── */}
      {actionModal && (
        <MeetingActionModal
          item={actionModal}
          onClose={() => setActionModal(null)}
          onDone={() => { setActionModal(null); load(); }}
          onNavigate={(id) => { navigate(`/leads/${id}`); onClose(); }}
        />
      )}
    </>
  );
}

/* ── Working hours config ──────────────────────────────────── */
const WORK_START = 9;   // 9 AM
const WORK_END   = 19;  // 7 PM  (last bookable slot = 18:00, ends 19:00)
const TOTAL_WORK_SLOTS = WORK_END - WORK_START; // 10

/** Parse a "HH:MM AM/PM" string → 24h hour number, or null */
function parseHour(item) {
  if (item.slot_iso) {
    // Use the IST hour from the ISO string (add 5.5h to UTC)
    const d = new Date(item.slot_iso);
    return d.getHours(); // local (IST) hours on client machine
  }
  if (!item.time_str) return null;
  const m = item.time_str.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h;
}

function fmt12(h) {
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2,'0')}:00 ${ap}`;
}

/* ── Day Group ────────────────────────────────────────────── */
function DayGroup({ group, isFirst, now, onNavigate, onAction }) {
  const isToday    = group.label === 'Today';
  const isTomorrow = group.label === 'Tomorrow';

  const headerCls = isToday
    ? 'bg-brand-500 text-white'
    : isTomorrow
      ? 'bg-violet-50 text-violet-700 border-t border-b border-violet-100'
      : 'bg-slate-50 text-slate-600 border-t border-b border-slate-100';

  const dateStr = (() => {
    try {
      const d = new Date(group.date_key + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return group.date_key; }
  })();

  // Build a map of booked hours  { hour → item }
  const bookedByHour = {};
  for (const item of group.items) {
    const h = parseHour(item);
    if (h !== null) bookedByHour[h] = item;
  }

  // Count free slots in working hours
  const bookedHours = Object.keys(bookedByHour).map(Number)
    .filter(h => h >= WORK_START && h < WORK_END);
  const freeCount = TOTAL_WORK_SLOTS - bookedHours.length;

  // Items without a parseable hour (all-day or no time)
  const untimed = group.items.filter(item => parseHour(item) === null);

  return (
    <div data-today={isToday ? 'true' : undefined}>
      {/* Day header */}
      <div className={`flex items-center justify-between px-4 py-2.5 ${headerCls}`}>
        <div>
          <div className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? 'text-white' : ''}`}>
            {group.label}
          </div>
          <div className={`text-[9px] font-medium mt-0.5 ${isToday ? 'text-brand-100' : 'text-slate-500'}`}>
            {dateStr}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {freeCount > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none
                             ${isToday ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
              {freeCount} free
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                           ${isToday
                             ? 'bg-white/20 text-white'
                             : 'bg-white text-slate-600 border border-slate-200'}`}>
            {group.items.length} booked
          </span>
        </div>
      </div>

      {/* Slot timeline: working hours 9 AM → 6 PM */}
      <div className="divide-y divide-slate-50">
        {Array.from({ length: TOTAL_WORK_SLOTS }, (_, i) => {
          const hour = WORK_START + i;
          const booked = bookedByHour[hour];

          if (booked) {
            return (
              <SlotRow
                key={`booked-${hour}`}
                item={booked}
                hour={hour}
                now={now}
                onNavigate={onNavigate}
                onAction={onAction}
                dataHour={isToday ? hour : undefined}
              />
            );
          }

          // Free slot row
          return (
            <div key={`free-${hour}`}
              data-hour={isToday ? hour : undefined}
              className="flex items-center gap-3 px-4 py-2 opacity-60 hover:opacity-80 transition-opacity">
              <div className="shrink-0 w-14 text-right">
                <span className="text-[10px] text-slate-400 font-medium">{fmt12(hour)}</span>
              </div>
              <div className="w-0.5 h-5 rounded-full bg-emerald-200 shrink-0" />
              <span className="text-[10px] text-emerald-600 font-medium">Free slot</span>
            </div>
          );
        })}

        {/* Untimed / all-day items */}
        {untimed.map((item, i) => (
          <SlotRow
            key={`untimed-${item.lead_id}-${i}`}
            item={item}
            hour={null}
            now={now}
            onNavigate={onNavigate}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Slot Row ─────────────────────────────────────────────── */
function SlotRow({ item, hour, now, onNavigate, onAction, dataHour }) {
  const ini    = initials(item.full_name);
  const bgCls  = avatarColor(item.full_name);
  const dotCls = STATUS_COLOR[item.status] || 'bg-slate-300';
  const mtgCfg = MTG_STATUS[item.meeting_status] || MTG_STATUS.upcoming;

  // 5-min alert: only for upcoming slots with a known ISO datetime
  const minsLeft  = item.slot_iso ? minsUntil(item.slot_iso) : null;
  const isImminent = minsLeft !== null && minsLeft >= 0 && minsLeft <= 5
                     && item.meeting_status === 'upcoming';
  const isOverdue  = minsLeft !== null && minsLeft < 0 && minsLeft >= -30
                     && item.meeting_status === 'upcoming';

  const rowBg = isImminent
    ? 'bg-red-50 hover:bg-red-100/70'
    : isOverdue
      ? 'bg-orange-50 hover:bg-orange-100/70'
      : 'hover:bg-brand-50/60';

  return (
    <div
      data-hour={dataHour}
      className={`flex items-center gap-3 px-4 py-3 transition-colors group ${rowBg} relative`}
    >
      {/* Time column */}
      <div className="shrink-0 w-14 text-right">
        {item.time_str ? (
          <span className={`text-[11px] font-bold leading-tight block
                           ${isImminent ? 'text-red-600' : isOverdue ? 'text-orange-600' : 'text-slate-700'}`}>
            {item.time_str}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 italic block">All day</span>
        )}
        {isImminent && (
          <span className="text-[9px] text-red-500 font-bold block animate-pulse">
            {minsLeft === 0 ? 'NOW' : `${minsLeft}m`}
          </span>
        )}
        {isOverdue && (
          <span className="text-[9px] text-orange-500 font-bold block">
            +{Math.abs(minsLeft)}m late
          </span>
        )}
      </div>

      {/* Thin vertical accent — color by meeting status */}
      <div className={`w-0.5 h-8 rounded-full shrink-0 ${
        isImminent ? 'bg-red-400' : isOverdue ? 'bg-orange-400' : 'bg-emerald-300'
      }`} />

      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full ${bgCls} flex items-center justify-center
                       text-white text-[10px] font-bold shrink-0`}>
        {ini}
      </div>

      {/* Name + company + tags */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onNavigate(item.lead_id)}
          className="flex items-center gap-1.5 text-left w-full"
        >
          <span className="text-[13px] font-semibold text-slate-800 truncate
                           group-hover:text-brand-600 transition-colors">
            {item.full_name}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
        </button>

        {item.company && (
          <span className="text-[10px] text-slate-500 truncate block">{item.company}</span>
        )}

        {/* Tags row */}
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          {/* Meeting status tag */}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none ${mtgCfg.cls}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-0.5 ${mtgCfg.dot}`} />
            {mtgCfg.label}
          </span>

          {/* Rescheduled badge */}
          {item.reschedule_count > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none
                             bg-amber-50 text-amber-700 border-amber-200">
              🔄 {item.reschedule_count}× rescheduled
            </span>
          )}
        </div>
      </div>

      {/* Action button */}
      <button
        type="button"
        onClick={() => onAction(item)}
        className="w-6 h-6 rounded-lg flex items-center justify-center
                   text-slate-400 hover:text-brand-600 hover:bg-brand-50
                   transition-colors shrink-0"
        title="Meeting actions"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01" />
        </svg>
      </button>
    </div>
  );
}

/* ── Meeting Action Modal ─────────────────────────────────── */
function MeetingActionModal({ item, onClose, onDone, onNavigate }) {
  const [view, setView] = useState('menu'); // menu | end | reschedule
  const [outcome, setOutcome]   = useState('completed');
  const [remark,  setRemark]    = useState('');
  const [newDate, setNewDate]   = useState('');
  const [newTime, setNewTime]   = useState('');
  const [reason,  setReason]    = useState('');
  const [rType,   setRType]     = useState('customer_request');
  const [sendEmail, setSendEmail] = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [conflict, setConflict] = useState(null);

  const mtgCfg = MTG_STATUS[item.meeting_status] || MTG_STATUS.upcoming;

  async function handleStart() {
    setSaving(true);
    try {
      await meetingsApi.start(item.lead_id);
      toast.success(`Meeting started — ${item.full_name}`);
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to start meeting');
    } finally { setSaving(false); }
  }

  async function handleEnd() {
    setSaving(true);
    try {
      await meetingsApi.end(item.lead_id, { outcome, remark });
      toast.success(`Meeting marked as ${outcome}`);
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to end meeting');
    } finally { setSaving(false); }
  }

  async function handleReschedule() {
    if (!newDate) { toast.error('Please select a new date'); return; }
    setSaving(true); setConflict(null);
    try {
      const newDt = newTime ? `${newDate}T${newTime}:00` : null;
      await meetingsApi.reschedule(item.lead_id, {
        new_meeting_datetime: newDt,
        new_slot_date:        newDt ? null : newDate,
        new_slot_time:        newTime || null,
        reason, type: rType, send_email: sendEmail,
      });
      toast.success('Meeting rescheduled' + (sendEmail ? ' — email sent' : ''));
      onDone();
    } catch (e) {
      const err = e.response?.data;
      if (e.response?.status === 409 && err?.conflict) {
        setConflict(err.conflict);
      } else {
        toast.error(err?.error || 'Failed to reschedule');
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
         onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm
                   shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-800">{item.full_name}</div>
              <div className="text-[11px] text-slate-500">{item.time_str || 'All day'} · {item.company || ''}</div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${mtgCfg.cls}`}>
              {mtgCfg.label}
            </span>
          </div>
          {item.reschedule_count > 0 && (
            <div className="text-[10px] text-amber-600 mt-1">
              🔄 Rescheduled {item.reschedule_count} time{item.reschedule_count > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* ── MENU view ── */}
        {view === 'menu' && (
          <div className="p-4 space-y-2">
            {item.meeting_status === 'upcoming' && (
              <button onClick={handleStart} disabled={saving}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                           bg-emerald-50 hover:bg-emerald-100 border border-emerald-200
                           text-emerald-700 font-semibold text-sm transition-colors">
                <span className="text-lg">▶</span>
                <span>Start Meeting Now</span>
              </button>
            )}
            {(item.meeting_status === 'upcoming' || item.meeting_status === 'started') && (
              <button onClick={() => setView('end')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                           bg-slate-50 hover:bg-slate-100 border border-slate-200
                           text-slate-700 font-semibold text-sm transition-colors">
                <span className="text-lg">⏹</span>
                <span>End / Close Meeting</span>
              </button>
            )}
            <button onClick={() => setView('reschedule')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                         bg-amber-50 hover:bg-amber-100 border border-amber-200
                         text-amber-700 font-semibold text-sm transition-colors">
              <span className="text-lg">📅</span>
              <span>Reschedule Meeting</span>
            </button>
            <button onClick={() => onNavigate(item.lead_id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                         bg-brand-50 hover:bg-brand-100 border border-brand-200
                         text-brand-600 font-semibold text-sm transition-colors">
              <span className="text-lg">👤</span>
              <span>View Lead Detail</span>
            </button>
          </div>
        )}

        {/* ── END view ── */}
        {view === 'end' && (
          <div className="p-4 space-y-3">
            <button onClick={() => setView('menu')}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
              ← Back
            </button>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Outcome</label>
              <div className="flex gap-2">
                {['completed','missed','no_show'].map(o => (
                  <button key={o} onClick={() => setOutcome(o)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      outcome === o
                        ? o === 'completed' ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-red-500 text-white border-red-500'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}>
                    {o === 'completed' ? '✅ Completed' : o === 'missed' ? '❌ Missed' : '🚫 No-show'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Remark / Notes (goes to lead)
              </label>
              <textarea
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
                rows={3} placeholder="Add notes about this meeting…"
                value={remark} onChange={e => setRemark(e.target.value)}
              />
            </div>
            <button onClick={handleEnd} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-bold
                         text-sm hover:bg-slate-900 transition-colors disabled:opacity-40">
              {saving ? 'Saving…' : 'Save & Close Meeting'}
            </button>
          </div>
        )}

        {/* ── RESCHEDULE view ── */}
        {view === 'reschedule' && (
          <div className="p-4 space-y-3">
            <button onClick={() => setView('menu')}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
              ← Back
            </button>

            {conflict && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                ⚠️ Slot conflict: <strong>{conflict[0]?.full_name}</strong> has a meeting within 1 hour.
                Choose a different time.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">New Date *</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">New Time</label>
                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Reschedule Reason</label>
              <select value={rType} onChange={e => setRType(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-300 mb-2">
                <option value="customer_request">Customer Request</option>
                <option value="no_show">No-show / Didn't attend</option>
                <option value="team_request">Team / Internal</option>
              </select>
              <textarea
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
                rows={2} placeholder="Optional note…"
                value={reason} onChange={e => setReason(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                className="rounded" />
              Send reschedule confirmation email to client
            </label>

            <button onClick={handleReschedule} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-bold
                         text-sm hover:bg-amber-600 transition-colors disabled:opacity-40">
              {saving ? 'Rescheduling…' : 'Confirm Reschedule'}
            </button>
          </div>
        )}

        {/* Drag handle */}
        <div className="flex justify-center pb-3 pt-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
