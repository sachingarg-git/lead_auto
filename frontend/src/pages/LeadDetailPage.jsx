import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { leadsApi, remindersApi, usersApi, meetingsApi, emailTemplatesApi } from '../services/api';
import StatusBadge from '../components/shared/StatusBadge';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['New', 'FollowUp', 'DemoGiven', 'Converted', 'Lost', 'Nurture'];

const STATUS_BTN = {
  New:       { active: 'bg-sky-50 text-sky-700 border-sky-300',       hover: 'hover:bg-sky-50 hover:text-sky-600' },
  FollowUp:  { active: 'bg-amber-50 text-amber-700 border-amber-300', hover: 'hover:bg-amber-50 hover:text-amber-700' },
  DemoGiven: { active: 'bg-violet-50 text-violet-700 border-violet-300', hover: 'hover:bg-violet-50 hover:text-violet-600' },
  Converted: { active: 'bg-green-50 text-green-700 border-green-300',  hover: 'hover:bg-green-50 hover:text-green-700' },
  Lost:      { active: 'bg-red-50 text-red-700 border-red-300',        hover: 'hover:bg-red-50 hover:text-red-600' },
  Nurture:   { active: 'bg-pink-50 text-pink-700 border-pink-300',     hover: 'hover:bg-pink-50 hover:text-pink-600' },
};

const MTG_STATUS_CFG = {
  upcoming:    { label: 'Upcoming',    cls: 'bg-sky-50 text-sky-700 border-sky-200',        icon: '🗓️' },
  started:     { label: 'In Progress', cls: 'bg-green-50 text-green-700 border-green-200',  icon: '▶️' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '✅' },
  missed:      { label: 'Missed',      cls: 'bg-red-50 text-red-700 border-red-200',         icon: '❌' },
  rescheduled: { label: 'Rescheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: '🔄' },
};

const REMINDER_TYPE_CFG = {
  day_1:             { label: 'Day 1 Follow-up',      icon: '📧', color: 'text-sky-600' },
  day_3:             { label: 'Day 3 Follow-up',      icon: '📧', color: 'text-sky-600' },
  day_5:             { label: 'Day 5 Follow-up',      icon: '📧', color: 'text-sky-600' },
  day_7:             { label: 'Day 7 — Last Reminder',icon: '📧', color: 'text-red-500' },
  '4_days_before':   { label: '4 Days Before Meeting',icon: '🔔', color: 'text-violet-600' },
  same_day_9am:      { label: 'Meeting Day Reminder', icon: '⏰', color: 'text-amber-600' },
  '30_min_before':   { label: '30 Min Before Meeting',icon: '⚡', color: 'text-orange-500' },
  immediate:         { label: 'Welcome / Immediate',  icon: '👋', color: 'text-brand-600' },
};

const RESCHEDULE_TYPE_LABELS = {
  customer_request: 'Customer Request',
  no_show:          'No-show',
  team_request:     'Team / Internal',
};

function fmtDate(val) {
  if (!val) return null;
  // Backend returns IST as "YYYY-MM-DDTHH:MI:SS" (no Z) — parse directly to avoid UTC shift
  try {
    const d = new Date(val);
    return isNaN(d) ? String(val) : format(d, 'dd MMM yyyy, hh:mm a');
  } catch { return String(val); }
}

export default function LeadDetailPage() {
  const { id }   = useParams();
  const { can }  = useAuth();
  const { t }    = useTranslation();

  const [lead,          setLead]          = useState(null);
  const [reminders,     setReminders]     = useState([]);
  const [reschedules,   setReschedules]   = useState([]);
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [editNotes,     setEditNotes]     = useState(false);
  const [notes,         setNotes]         = useState('');

  // ── Email template send ───────────────────────────────────
  const [showEmailModal,   setShowEmailModal]   = useState(false);
  const [emailTemplates,   setEmailTemplates]   = useState([]);
  const [selectedTplId,    setSelectedTplId]    = useState('');
  const [emailPreview,     setEmailPreview]     = useState(null);
  const [sendingEmail,     setSendingEmail]     = useState(false);
  const [loadingPreview,   setLoadingPreview]   = useState(false);

  const [slotDate,       setSlotDate]       = useState('');
  const [bookedSlots,    setBookedSlots]     = useState([]);
  const [loadingSlots,   setLoadingSlots]    = useState(false);
  const [settingSlot,    setSettingSlot]     = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [leadRes, remRes, usersRes] = await Promise.all([
        leadsApi.getOne(id),
        remindersApi.getForLead(id),
        usersApi.getAll(),
      ]);
      setLead(leadRes.data);
      setNotes(leadRes.data.notes || '');
      setReminders(remRes.data);
      setUsers(usersRes.data);

      // Load reschedule history silently
      try {
        const rRes = await meetingsApi.getReschedules(id);
        setReschedules(rRes.data);
      } catch {}
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

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

  async function openEmailModal() {
    setShowEmailModal(true);
    setSelectedTplId('');
    setEmailPreview(null);
    try {
      const r = await emailTemplatesApi.getAll();
      setEmailTemplates(r.data);
    } catch { toast.error('Failed to load templates'); }
  }

  async function handleTemplateSelect(id) {
    setSelectedTplId(id);
    setEmailPreview(null);
    if (!id) return;
    setLoadingPreview(true);
    try {
      const r = await emailTemplatesApi.preview(id);
      setEmailPreview(r.data);
    } catch { toast.error('Failed to load preview'); }
    finally { setLoadingPreview(false); }
  }

  async function handleSendTemplateEmail() {
    if (!selectedTplId) { toast.error('Select a template first'); return; }
    setSendingEmail(true);
    try {
      const r = await emailTemplatesApi.sendToLead({ lead_id: lead.id, template_id: parseInt(selectedTplId) });
      toast.success(`Email sent to ${r.data.sent_to}`);
      setShowEmailModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to send email');
    } finally { setSendingEmail(false); }
  }

  const SLOT_HOURS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
  const SLOT_LABELS = {
    '09:00':'9:00 AM','10:00':'10:00 AM','11:00':'11:00 AM','12:00':'12:00 PM',
    '13:00':'1:00 PM','14:00':'2:00 PM','15:00':'3:00 PM','16:00':'4:00 PM',
    '17:00':'5:00 PM','18:00':'6:00 PM',
  };

  async function handleSlotDateChange(date) {
    setSlotDate(date);
    setBookedSlots([]);
    if (!date) return;
    setLoadingSlots(true);
    try {
      const r = await meetingsApi.getBookedSlots(date, lead.id);
      setBookedSlots(r.data.booked || []);
    } catch {}
    finally { setLoadingSlots(false); }
  }

  async function handleBookSlot(time) {
    if (!slotDate) return;
    setSettingSlot(time);
    try {
      const r = await leadsApi.setSlot(lead.id, { slot_date: slotDate, slot_time: time });
      setLead(r.data);
      toast.success(`Slot set: ${slotDate} at ${SLOT_LABELS[time] || time}`);
      setSlotDate('');
      setBookedSlots([]);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to set slot');
    } finally { setSettingSlot(false); }
  }

  async function handleMeetingBooked(datetime) {
    if (!datetime) return;
    // 1-hour gap check
    try {
      const chk = await meetingsApi.checkSlot({ datetime, exclude_lead_id: id });
      if (!chk.data.available) {
        const c = chk.data.conflict[0];
        toast.error(`Slot conflict with ${c.full_name}. Another meeting is within 1 hour.`);
        return;
      }
    } catch {}

    try {
      const res = await leadsApi.update(id, {
        client_type:      'Type1',
        meeting_datetime: datetime,
        meeting_status:   'upcoming',
        status:           'FollowUp',
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

  const mtgCfg = MTG_STATUS_CFG[lead.meeting_status] || MTG_STATUS_CFG.upcoming;

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
                  {/* Reschedule badge */}
                  {lead.reschedule_count > 0 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                                     border bg-amber-50 text-amber-700 border-amber-200">
                      🔄 {lead.reschedule_count}× rescheduled
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
                { label: 'Created',      value: fmtDate(lead.created_at) },
                { label: 'Last Contact', value: fmtDate(lead.last_contacted) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-slate-600 mb-1 font-medium">{label}</div>
                  <div className="text-sm text-slate-700">{value || <span className="text-slate-300">—</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Slot Appointment + Picker Card ───────────── */}
          <div className="bg-white rounded-2xl border border-sky-200 p-5"
               style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <h3 className="text-sm font-semibold text-sky-700 mb-3 flex items-center gap-1.5">
              🗓️ Slot Appointment
            </h3>

            {/* Current booked slot */}
            {lead.slot_date ? (
              <div className="mb-4 p-3 bg-sky-50 rounded-xl border border-sky-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-sky-600 font-medium mb-1">Booked Slot</div>
                    <div className="text-sm font-bold text-slate-800">
                      📅 {lead.slot_date} &nbsp;⏰ {lead.slot_time || '—'} IST
                    </div>
                  </div>
                  {lead.meeting_link ? (
                    <a href={lead.meeting_link} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700
                                  text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                      🎥 Join Meet
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Meet link pending</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic mb-4">No slot booked yet</p>
            )}

            {/* Slot picker — only for users with write permission */}
            {can('leads:write') && (
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-2">
                  {lead.slot_date ? '🔄 Reschedule Slot' : '➕ Book a Slot'}
                </div>
                <input
                  type="date"
                  value={slotDate}
                  min={new Date().toISOString().substring(0, 10)}
                  onChange={e => handleSlotDateChange(e.target.value)}
                  className="input text-sm w-full mb-3"
                />
                {slotDate && (
                  <div>
                    {loadingSlots ? (
                      <p className="text-xs text-slate-400 py-2">Loading available slots…</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {SLOT_HOURS.map(h => {
                          const isBooked = bookedSlots.includes(h);
                          const isCurrentSlot = lead.slot_date === slotDate && lead.slot_time === h;
                          const isSetting = settingSlot === h;
                          return (
                            <button
                              key={h}
                              disabled={isBooked || isSetting}
                              onClick={() => !isBooked && handleBookSlot(h)}
                              className={`text-xs font-semibold py-2 px-3 rounded-lg border transition-all ${
                                isCurrentSlot
                                  ? 'bg-sky-100 border-sky-400 text-sky-700 ring-2 ring-sky-300'
                                  : isBooked
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                                  : isSetting
                                  ? 'bg-sky-200 border-sky-400 text-sky-700 cursor-wait'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-sky-50 hover:border-sky-400 hover:text-sky-700 cursor-pointer'
                              }`}
                            >
                              {isSetting ? '⏳' : isBooked ? '🔒' : '✓'} {SLOT_LABELS[h]}
                              {isBooked && !isCurrentSlot && <span className="block text-[10px] font-normal">Booked</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Meeting Card (Type1) ──────────────────────── */}
          {lead.client_type === 'Type1' && lead.meeting_datetime && (
            <div className={`rounded-2xl border p-5 ${
              lead.meeting_status === 'completed' ? 'bg-emerald-50 border-emerald-200'
              : lead.meeting_status === 'missed'  ? 'bg-red-50 border-red-200'
              : lead.meeting_status === 'started' ? 'bg-green-50 border-green-200 animate-pulse-slow'
              : 'bg-violet-50 border-violet-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-violet-700 flex items-center gap-1.5">
                  {mtgCfg.icon} {t('leadDetail.meetingScheduled')}
                </h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${mtgCfg.cls}`}>
                  {mtgCfg.label}
                </span>
              </div>

              <p className="text-slate-800 text-sm font-medium">
                {format(new Date(lead.meeting_datetime), 'EEEE, MMMM d yyyy — HH:mm')}
              </p>
              {lead.meeting_link && (
                <a href={lead.meeting_link} target="_blank" rel="noopener noreferrer"
                  className="text-brand-500 text-xs hover:underline mt-1 block">
                  {lead.meeting_link}
                </a>
              )}

              {/* Meeting times */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {lead.meeting_started_at && (
                  <div className="bg-white/60 rounded-lg px-2 py-1.5">
                    <div className="text-slate-500 font-medium">Started</div>
                    <div className="text-slate-800 font-semibold">{fmtDate(lead.meeting_started_at)}</div>
                    {lead.meeting_delay_minutes !== null && lead.meeting_delay_minutes > 0 && (
                      <div className="text-orange-500 font-medium">{lead.meeting_delay_minutes} min late</div>
                    )}
                    {lead.meeting_delay_minutes === 0 && (
                      <div className="text-emerald-600 font-medium">On time ✓</div>
                    )}
                  </div>
                )}
                {lead.meeting_ended_at && (
                  <div className="bg-white/60 rounded-lg px-2 py-1.5">
                    <div className="text-slate-500 font-medium">Ended</div>
                    <div className="text-slate-800 font-semibold">{fmtDate(lead.meeting_ended_at)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

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

          {/* ── Automation Timeline ───────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5"
               style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('leadDetail.automationTimeline')}</h3>
            <div className="space-y-2">
              {reminders.length ? reminders.map(r => {
                const cfg = REMINDER_TYPE_CFG[r.reminder_type] || {
                  label: r.reminder_type.replace(/_/g, ' '),
                  icon: '📌', color: 'text-slate-600',
                };
                return (
                  <div key={r.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      r.status === 'Sent'    ? 'bg-emerald-50 border-emerald-100'
                      : r.status === 'Failed'  ? 'bg-red-50 border-red-100'
                      : r.status === 'Skipped' ? 'bg-slate-50 border-slate-100 opacity-60'
                      : 'bg-white border-slate-100'
                    }`}>
                    <span className="text-base shrink-0">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</div>
                      <div className="text-xs text-slate-500">{fmtDate(r.scheduled_at)}</div>
                      {r.channel && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          via {r.channel}
                        </div>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${
                      r.status === 'Sent'    ? 'bg-green-50 text-green-700 border-green-200'
                      : r.status === 'Failed'  ? 'bg-red-50 text-red-700 border-red-200'
                      : r.status === 'Skipped' ? 'bg-slate-100 text-slate-500 border-slate-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                );
              }) : (
                <p className="text-sm text-slate-600 text-center py-6">{t('leadDetail.noAutomation')}</p>
              )}
            </div>
          </div>

          {/* ── Reschedule History ────────────────────────── */}
          {reschedules.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 p-5"
                 style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <h3 className="text-sm font-semibold text-amber-700 mb-4 flex items-center gap-2">
                🔄 Reschedule History
                <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                  {reschedules.length} time{reschedules.length > 1 ? 's' : ''}
                </span>
              </h3>
              <div className="space-y-3">
                {reschedules.map((r, i) => {
                  const oldFmt = r.old_meeting_datetime
                    ? fmtDate(r.old_meeting_datetime)
                    : r.old_slot_date
                      ? String(r.old_slot_date).substring(0, 10)
                      : '—';
                  const newFmt = r.new_meeting_datetime
                    ? fmtDate(r.new_meeting_datetime)
                    : r.new_slot_date
                      ? String(r.new_slot_date).substring(0, 10)
                      : '—';

                  return (
                    <div key={r.id}
                      className="relative pl-5 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                      <span className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white ring-1 ring-amber-300" />
                      <div className="text-xs font-bold text-slate-700">
                        #{reschedules.length - i} — {RESCHEDULE_TYPE_LABELS[r.reschedule_type] || r.reschedule_type}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        <span className="line-through text-red-400">{oldFmt}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="text-emerald-600 font-medium">{newFmt}</span>
                      </div>
                      {r.reschedule_reason && (
                        <div className="text-[11px] text-slate-600 mt-0.5 italic">"{r.reschedule_reason}"</div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        by {r.rescheduled_by_name} · {fmtDate(r.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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

          {/* Meeting stats (reschedule count, on-time record) */}
          {lead.client_type === 'Type1' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4"
                 style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Meeting Stats
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Rescheduled</span>
                  <span className={`font-bold ${lead.reschedule_count > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {lead.reschedule_count || 0}×
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Meeting Status</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    (MTG_STATUS_CFG[lead.meeting_status] || MTG_STATUS_CFG.upcoming).cls
                  }`}>
                    {(MTG_STATUS_CFG[lead.meeting_status] || MTG_STATUS_CFG.upcoming).icon}{' '}
                    {(MTG_STATUS_CFG[lead.meeting_status] || MTG_STATUS_CFG.upcoming).label}
                  </span>
                </div>
                {lead.meeting_delay_minutes !== null && lead.meeting_delay_minutes !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Delay</span>
                    <span className={`font-semibold ${
                      lead.meeting_delay_minutes === 0 ? 'text-emerald-600'
                      : lead.meeting_delay_minutes > 15 ? 'text-red-500' : 'text-orange-500'
                    }`}>
                      {lead.meeting_delay_minutes === 0
                        ? 'On time ✓'
                        : `${lead.meeting_delay_minutes} min late`}
                    </span>
                  </div>
                )}
              </div>
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

          {/* Manual email send */}
          {can('leads:write') && lead.email && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4"
                 style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Send Email
              </h3>
              <p className="text-xs text-slate-500 mb-3">Manually send a template email to this lead.</p>
              <button onClick={openEmailModal}
                className="w-full h-9 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold
                           flex items-center justify-center gap-2 transition-all">
                📧 Send Template Email
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Email Template Send Modal ─────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Send Email to {lead.full_name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{lead.email}</p>
              </div>
              <button onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Select Template
                </label>
                <select value={selectedTplId} onChange={e => handleTemplateSelect(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 transition-colors">
                  <option value="">— Choose a template —</option>
                  {emailTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                  ))}
                </select>
                {emailTemplates.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1.5">No templates found. Create templates in Settings → Email Templates.</p>
                )}
              </div>

              {loadingPreview && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {emailPreview && !loadingPreview && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subject: </span>
                    <span className="text-sm text-slate-700">{emailPreview.subject}</span>
                  </div>
                  <div className="p-4 max-h-60 overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: emailPreview.html }} />
                  </div>
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
                    <p className="text-[10px] text-amber-600">Preview uses sample data. Actual email will use this lead's real details.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowEmailModal(false)}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button onClick={handleSendTemplateEmail} disabled={!selectedTplId || sendingEmail}
                className="flex-1 h-10 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600
                           disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {sendingEmail
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                  : '📧 Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
