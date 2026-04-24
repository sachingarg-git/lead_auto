import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { dashboardApi } from '../services/api';
import { format, parseISO } from 'date-fns';

const COLORS = ['#0eaada','#8b5cf6','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6'];

const STAT_CARDS = [
  { key:'total_leads',    label:'Total Leads',     icon:'👥', accent:'#0eaada', light:'#e0f4fb' },
  { key:'new_leads',      label:'New',             icon:'⚡', accent:'#3b82f6', light:'#dbeafe' },
  { key:'meeting_booked', label:'Meeting Booked',  icon:'📅', accent:'#8b5cf6', light:'#ede9fe' },
  { key:'converted',      label:'Converted',       icon:'✅', accent:'#10b981', light:'#d1fae5' },
  { key:'lost',           label:'Lost',            icon:'❌', accent:'#ef4444', light:'#fee2e2' },
  { key:'welcome_sent',   label:'Welcome Sent',    icon:'📧', accent:'#f59e0b', light:'#fef3c7' },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try { const r = await dashboardApi.getSummary(); setData(r.data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const s = io('/', { withCredentials: true });
    s.emit('join:dashboard');
    s.on('lead:new', loadData);
    s.on('lead:updated', loadData);
    return () => s.disconnect();
  }, [loadData]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="relative w-10 h-10">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200" />
        <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent
                        animate-spin absolute inset-0" />
      </div>
    </div>
  );

  const { stats, recentLeads, upcomingReminders, leadTrend, leadsBySource } = data || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Stat Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAT_CARDS.map(sc => (
          <div key={sc.key}
            className="bg-white rounded-2xl p-4 border border-slate-200 hover:-translate-y-0.5
                       transition-all duration-200 cursor-default"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            {/* Icon */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
              style={{ backgroundColor: sc.light }}>
              {sc.icon}
            </div>
            {/* Value */}
            <div className="text-3xl font-extrabold" style={{ color: sc.accent }}>
              {stats?.[sc.key] ?? 0}
            </div>
            {/* Label */}
            <div className="text-xs font-semibold text-slate-700 mt-1 leading-tight">
              {sc.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Area chart - lead trend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 xl:col-span-2"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-800">Lead Trend</h3>
            <p className="text-xs text-slate-600 mt-0.5">New leads over last 7 days</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={leadTrend || []} margin={{ left: -10 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#0eaada" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#0eaada" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                tickFormatter={v => format(parseISO(v), 'MMM d')}
                axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
              <YAxis allowDecimals={false}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.08)', fontSize: 13 }}
                labelStyle={{ color: '#1e293b', fontWeight: 700 }}
                itemStyle={{ color: '#0eaada' }}
                labelFormatter={v => format(parseISO(v), 'EEEE, MMM d')}
              />
              <Area type="monotone" dataKey="count" stroke="#0eaada" strokeWidth={2.5}
                fill="url(#grad)" dot={{ fill: '#0eaada', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#0eaada' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart - conversion by agent */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-800">By Agent</h3>
            <p className="text-xs text-slate-600 mt-0.5">Conversions per team member</p>
          </div>
          {stats?.conversionByUser?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.conversionByUser} layout="vertical" margin={{ left: 0 }}>
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis dataKey="agent_name" type="category"
                  tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                  width={70} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0',
                    borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.08)', fontSize: 13 }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="converted" fill="#0eaada" radius={[0, 6, 6, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-sm font-medium text-slate-500">No data yet</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Leads by Source ─────────────────────────────────── */}
      {leadsBySource?.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Donut */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <h3 className="text-base font-bold text-slate-800 mb-1">Leads by Source</h3>
            <p className="text-xs text-slate-600 mb-3">Distribution across channels</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={leadsBySource} dataKey="count" nameKey="source"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} strokeWidth={0}>
                  {leadsBySource.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0',
                    borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.08)', fontSize: 13 }}
                  formatter={(val, name) => [`${val} leads`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Source breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 xl:col-span-2"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Source Performance</h3>
                <p className="text-xs text-slate-600 mt-0.5">Leads and conversions by source</p>
              </div>
              <Link to="/sources"
                className="text-xs font-bold text-brand-500 hover:text-brand-600
                           bg-brand-50 px-3 py-1.5 rounded-lg transition-colors">
                Manage →
              </Link>
            </div>
            <div className="space-y-4">
              {leadsBySource.map((s, i) => {
                const pct = stats?.total_leads > 0
                  ? Math.round((s.count / stats.total_leads) * 100) : 0;
                const convRate = s.count > 0
                  ? Math.round((s.converted / s.count) * 100) : 0;
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }} />
                        <span className="text-sm font-semibold text-slate-700">{s.source}</span>
                        <Link to={`/leads?source=${encodeURIComponent(s.source)}`}
                          className="text-xs text-slate-500 hover:text-brand-500 transition-colors font-medium">
                          View →
                        </Link>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className="text-slate-700">{s.count} leads</span>
                        <span className="text-emerald-600">{s.converted} conv ({convRate}%)</span>
                        <span className="text-slate-600 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Recent leads */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 xl:col-span-2"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Recent Leads</h3>
              <p className="text-xs text-slate-600 mt-0.5">Latest activity</p>
            </div>
            <Link to="/leads"
              className="text-xs font-bold text-brand-500 hover:text-brand-600
                         bg-brand-50 px-3 py-1.5 rounded-lg transition-colors">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {(recentLeads || []).map(lead => (
              <Link key={lead.id} to={`/leads/${lead.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100
                           hover:border-brand-200 hover:bg-brand-50/30 transition-all group">
                <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-200
                                flex items-center justify-center text-brand-600 text-sm
                                font-bold shrink-0">
                  {lead.full_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate
                                  group-hover:text-brand-600 transition-colors">
                    {lead.full_name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <SourcePill source={lead.source} />
                    <span className="text-slate-400 text-xs">·</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {format(new Date(lead.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                </div>
                <StatusBadge status={lead.status} />
              </Link>
            ))}
            {!recentLeads?.length && (
              <EmptyState icon="👤" text="No leads yet" />
            )}
          </div>
        </div>

        {/* Reminders */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-800">Today's Reminders</h3>
            <p className="text-xs text-slate-600 mt-0.5">Upcoming follow-ups</p>
          </div>
          <div className="space-y-2">
            {(upcomingReminders || []).map(r => (
              <div key={r.id}
                className="flex items-start gap-3 p-3 rounded-xl
                           bg-amber-50 border border-amber-200">
                <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200
                                flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{r.full_name}</div>
                  <div className="text-xs text-slate-600 mt-0.5 capitalize font-medium">
                    {r.reminder_type?.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs font-bold text-amber-700 mt-0.5">
                    {format(new Date(r.scheduled_at), 'HH:mm')}
                  </div>
                </div>
              </div>
            ))}
            {!upcomingReminders?.length && (
              <EmptyState icon="🔔" text="No reminders today" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */
function SourcePill({ source }) {
  if (!source) return null;
  const l = source.toLowerCase();
  let cls = 'bg-violet-50 text-violet-700 border-violet-200';
  if (l.includes('meta') || l.includes('facebook'))
    cls = 'bg-blue-50 text-blue-700 border-blue-200';
  else if (l.includes('landing') || l.includes('page') || l.includes('form'))
    cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  else if (l.includes('manual'))
    cls = 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full
                      text-[10px] font-bold border ${cls}`}>
      {source}
    </span>
  );
}

const STATUS_BADGE = {
  New:       { bg:'#eff9ff', color:'#0889b2', border:'#bae6fd' },
  FollowUp:  { bg:'#fffbeb', color:'#b45309', border:'#fcd34d' },
  DemoGiven: { bg:'#f5f3ff', color:'#6d28d9', border:'#c4b5fd' },
  Converted: { bg:'#f0fdf4', color:'#15803d', border:'#86efac' },
  Lost:      { bg:'#fef2f2', color:'#b91c1c', border:'#fca5a5' },
  Nurture:   { bg:'#fdf4ff', color:'#a21caf', border:'#f0abfc' },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.New;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                     text-[11px] font-bold border shrink-0"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {status}
    </span>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="text-3xl mb-2 opacity-50">{icon}</div>
      <div className="text-sm font-medium text-slate-500">{text}</div>
    </div>
  );
}
