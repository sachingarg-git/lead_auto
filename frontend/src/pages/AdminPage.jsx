import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usersApi } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ROLE_STYLE = {
  Admin:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200'   },
  Sales:   { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200'  },
  Support: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
};

export default function AdminPage() {
  const { t } = useTranslation();
  const [users,     setUsers]     = useState([]);
  const [roles,     setRoles]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser,  setEditUser]  = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        usersApi.getAll(),
        usersApi.getRoles(),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  async function toggleUser(user) {
    try {
      await usersApi.toggle(user.id);
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      loadUsers();
    } catch { }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t('admin.title')}</h2>
          <p className="text-sm text-slate-700 mt-0.5">{t('admin.subtitle')}</p>
        </div>
        <button
          onClick={() => { setEditUser(null); setShowModal(true); }}
          className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('admin.addMember')}
        </button>
      </div>

      {/* ── RBAC Role Summary ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { role: 'Admin',   desc: 'Full access — manage users, leads, settings',           accent: '#ef4444', light: '#fef2f2', border: '#fecaca' },
          { role: 'Sales',   desc: 'Create & update leads, change status, view reminders',  accent: '#3b82f6', light: '#eff6ff', border: '#bfdbfe' },
          { role: 'Support', desc: 'Read-only leads and reminders',                         accent: '#22c55e', light: '#f0fdf4', border: '#bbf7d0' },
        ].map(({ role, desc, accent, light, border }) => (
          <div key={role} className="rounded-2xl p-4 border"
               style={{ background: light, borderColor: border, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border mb-2"
                 style={{ background: '#fff', color: accent, borderColor: border }}>
              {role}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── Users Table ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
           style={{ boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            {t('admin.members')}
            <span className="ml-2 bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {users.length}
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-left">{t('admin.member')}</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-left">{t('admin.role')}</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-left">{t('admin.status')}</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-left">{t('admin.lastLogin')}</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-left">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-600">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      {t('common.loading')}
                    </div>
                  </td>
                </tr>
              ) : users.map(user => {
                const rs = ROLE_STYLE[user.role_name] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center
                                        text-brand-600 font-bold text-sm shrink-0">
                          {user.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{user.name}</div>
                          <div className="text-xs text-slate-600">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                                        border ${rs.bg} ${rs.text} ${rs.border}`}>
                        {user.role_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        user.is_active
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                        {user.is_active ? t('admin.active') : t('admin.inactive')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 text-xs">
                      {user.last_login ? format(new Date(user.last_login), 'MMM d, HH:mm') : (
                        <span className="text-slate-300">{t('admin.never')}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditUser(user); setShowModal(true); }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50
                                     text-slate-600 hover:bg-slate-100 font-medium transition-colors">
                          {t('admin.edit')}
                        </button>
                        <button
                          onClick={() => toggleUser(user)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                            user.is_active
                              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                              : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                          }`}>
                          {user.is_active ? t('admin.deactivate') : t('admin.activate')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <UserModal
          user={editUser}
          roles={roles}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); loadUsers(); }}
        />
      )}
    </div>
  );
}

/* ── User Create/Edit Modal ─────────────────────────────────── */
function UserModal({ user, roles, onClose, onSuccess }) {
  const { t } = useTranslation();
  const isEdit = !!user;
  const [form, setForm] = useState({
    name:     user?.name     || '',
    email:    user?.email    || '',
    password: '',
    role_id:  user?.role_id  || (roles[0]?.id || ''),
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || (!isEdit && !form.password)) {
      toast.error('Fill all required fields'); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await usersApi.update(user.id, { name: form.name, email: form.email, role_id: parseInt(form.role_id) });
        toast.success('User updated');
      } else {
        await usersApi.create({ ...form, role_id: parseInt(form.role_id) });
        toast.success('Team member created');
      }
      onSuccess();
    } catch { }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-base">
            {isEdit ? t('admin.editUser') : t('admin.addUser')}
          </h2>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('admin.fullName')} *</label>
            <input className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('admin.email')} *</label>
            <input className="input" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('admin.password')} *</label>
              <input className="input" type="password" placeholder={t('admin.passwordHint')}
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('admin.roleLabel')}</label>
            <select className="input" value={form.role_id}
              onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              {t('admin.cancel')}
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? t('admin.saving') : isEdit ? t('admin.update') : t('admin.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
