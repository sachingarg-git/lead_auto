import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { leadsApi, remindersApi, usersApi } from '../services/api';
import StatusBadge from '../components/shared/StatusBadge';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['New', 'FollowUp', 'DemoGiven', 'Converted', 'Lost', 'Nurture'];

const STATUS_BTN = {
  New:       { active: 'bg-sky-50 text-sky-700 border-sky-300',     hover: 'hover:bg-sky-50 hover:text-sky-600' },
  FollowUp:  { active: 'bg-amber-50 text-amber-700 border-amber-300', hover: 'hover:bg-amber-50 hover:text-amber-700' },
  DemoGiven: { active: 'bg-violet-50 text-violet-700 border-violet-300', hover: 'hover:bg-violet-50 hover:text-violet-600' },
  Converted: { active: 'bg-green-50 text-green-700 border-green-300',  hover: 'hover:bg-green-50 hover:text-green-700' },
  Lost:      { active: 'bg-red-50 text-red-700 border-red-300',      hover: 'hover:bg-red-50 hover:text-red-600' },
  Nurture:   { active: 'bg-pink-50 text-pink-700 border-pink-300',   hover: 'hover:bg-pink-50 hover:text-pink-600' },
};

export default function LeadDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const { t } = useTranslation();
  const [lead,      setLead]      = useState(null);
  const [reminders, setReminders] = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [editNotes, setEditNotes] = useState(false);
  const [notes,     setNotes]     = useState('');

  useEffect(() => {
    Promise.all([
      leadsApi.getOne(id),
      remindersApi.getForLead(id),
      usersApi.getAll(),
    ]).then(([leadRes, remindersRes, usersRes]) => {
      setLead(leadRes.data);
      setNotes(leadRes.data.notes || '');
      setReminders(remindersRes.data);
      setUsers(usersRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(newStatus) {
    try {
      const res = await leadsApi.updateStatus(id, newStatus);
      setLead(res.data);
      toast.success(`Status changed to ${newStatus}`);
    } catch {}
  }

  async function handleAssignChange(userId) {
    try {
      const res = await leadsApi.update(id, { assigned_to: userId ? parseInt(userId) : null });
      setLead(res.data);
      toast.success('Lead reassigned');
    } catch {}
  }

  async function saveNotes() {
    setSaving(true);
    try {
      await leadsApi.update(id, { notes });
      setEditNotes(false);
      toast.success('Notes saved');
    } catch {} finally { setSaving(false); }
  }

  async function handleMeetingBooked(datetime) {
    try {
      const res = await leadsApi.update(id, {
        client_type: 'Type1',
        meeting_datetime: datetime,
        status: 'FollowUp',
      });
      setLead(res.data);
      toast.success('Meeting booked! Reminders scheduled automatically.');
    } catch {}
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!lead) return (
    <div className="text-center text-slate-600 py-20">Lead not found</div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Breadcrumb ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link to="/leads" className="hover:text-brand-500 transition-colors">
          {t('leadDetail.backToLeads')}
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{lead.full_name}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Main Info ─────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Lead overview card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5"
               style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 border border-brand-200
                              flex items-center justify-center text-brand-600 text-lg font-bold shrink-0">
                {lead.full_name[0]}
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-800">{lead.full_name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <StatusBadge status={lead.status} />
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    lead.client_type === 'Type1'
                      ? 'bg-violet-50 text-violet-700 border-violet-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {lead.client_type === 'Type1' ? t('clientType.Type1') : t('clientType.Type2')}
                  </span>
                  {lead.source && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                                     border bg-slate-50 text-slate-600 border-slate-200">
                      {t('leadDetail.source')}: {lead.source}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-100">
              {[
                { label: 'Email',        value: lead.email },
                { label: 'Phone',        value: lead.phone },
                { label: 'WhatsApp',     value: lead.whatsapp_number },
                { label: 'Campaign',     value: lead.campaign_name },
                { label: 'Created',      value: lead.created_at       ? format(new Date(lead.created_at),       'PPpp') : null },
                { label: 'Last Contact', value: lead.last_contacted   ? format(new Date(lead.last_contacted),   'PPpp') : null },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-slate-600 mb-1 font-medium">{label}</div>
                  <div className="text-sm text-slate-700">{value || <span className="text-slate-300">—</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5"
               style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">{t('leadDetail.notes')}</h3>
              {can('leads:write') && !editNotes && (
                <button onClick={() => setEditNotes(true)}
                  className="text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors">
                  {t('leadDetail.editNotes')}
                </button>
              )}
            </div>
            {editNotes ? (
              <div className="space-y-3">
                <textarea className="input resize-none h-32 text-sm"
                  value={notes} onChange={e => setNotes(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => setEditNotes(false)} className="btn-secondary flex-1 py-1.5 text-sm">
                    {t('leadDetail.cancel')}
                  </button>
                  <button onClick={saveNotes} disabled={saving} className="btn-primary flex-1 py-1.5 text-sm">
                    {saving ? t('leadDetail.saving') : t('leadDetail.saveNotes')}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                {lead.notes || <span className="text-slate-600 italic">{t('leadDetail.noNotes')}</span>}
              </p>
            )}
          </div>

          {/* Meeting Booking (if Type2) */}
          {lead.client_type === 'Type2' && can('leads:write') && (
            <div className="bg-white rounded-2xl border border-violet-200 p-5"
                 style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <h3 className="text-sm font-semibold text-violet-700 mb-2">{t('leadDetail.bookMeeting')}</h3>
              <p className="text-xs text-slate-700 mb-3">{t('leadDetail.bookMeetingDesc')}</p>
              <input
                type="datetime-local"
                className="input text-sm"
                onChange={e => e.target.value && handleMeetingBooked(e.target.value)}
              />
            </div>
          )}

          {lead.client_type === 'Type1' && lead.meeting_datetime && (
            <div className="bg-violet-50 rounded-2xl border border-violet-200 p-5">
              <h3 className="text-sm font-semibold text-violet-700 mb-1">{t('leadDetail.meetingScheduled')}</h3>
              <p className="text-slate-800 text-sm font-medium">
                {format(new Date(lead.meeting_datetime), 'EEEE, MMMM d yyyy — HH:mm')}
              </p>
              {lead.meeting_link && (
                <a href={lead.meeting_link} target="_blank" rel="noopener noreferrer"
                  className="text-brand-500 text-xs hover:underline mt-1 block">
                  {lead.meeting_link}
                </a>
              )}
            </div>
          )}

          {/* Reminders timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5"
               style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('leadDetail.automationTimeline')}</h3>
            <div className="space-y-2">
              {reminders.length ? reminders.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    r.status === 'Sent'    ? 'bg-green-400' :
                    r.status === 'Failed'  ? 'bg-red-400' :
                    r.status === 'Skipped' ? 'bg-slate-400' : 'bg-yellow-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700">
                      {t(`reminders.${r.reminder_type}`, { defaultValue: r.reminder_type.replace(/_/g, ' ') })}
                    </div>
                    <div className="text-xs text-slate-600">{format(new Date(r.scheduled_at), 'PPpp')}</div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    r.status === 'Sent'    ? 'bg-green-50 text-green-700 border-green-200' :
                    r.status === 'Failed'  ? 'bg-red-50 text-red-700 border-red-200' :
                    r.status === 'Skipped' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                  }`}>
                    {t(`reminderStatus.${r.status}`, { defaultValue: r.status })}
                  </span>
                </div>
              )) : (
                <p className="text-sm text-slate-600 text-center py-6">{t('leadDetail.noAutomation')}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Status change */}
          {can('leads:status') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4"
                 style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                {t('leadDetail.changeStatus')}
              </h3>
              <div className="space-y-1.5">
                {STATUSES.map(s => {
                  const btn = STATUS_BTN[s] || {};
                  const isActive = lead.status === s;
                  return (
                    <button key={s} onClick={() => handleStatusChange(s)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                        isActive
                          ? `${btn.active} border`
                          : `border-transparent text-slate-700 ${btn.hover}`
                      }`}>
                      {t(`status.${s}`, { defaultValue: s })}
                      {isActive && <span className="float-right text-xs opacity-60">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assign */}
          {can('leads:write') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4"
                 style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                {t('leadDetail.assignedTo')}
              </h3>
              <select className="input text-sm" value={lead.assigned_to || ''}
                onChange={e => handleAssignChange(e.target.value)}>
                <option value="">{t('leadDetail.unassigned')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          {/* Quick stats */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4"
               style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              {t('leadDetail.contactStats')}
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-700">{t('leadDetail.totalContacts')}</span>
                <span className="font-semibold text-slate-800">{lead.contact_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">{t('leadDetail.welcomeSent')}</span>
                <span className={`font-semibold ${lead.welcome_sent ? 'text-green-600' : 'text-red-500'}`}>
                  {lead.welcome_sent ? t('leadDetail.yes') : t('leadDetail.no')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
