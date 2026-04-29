import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

// ── Icon helpers ──────────────────────────────────────────────
const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const EyeIcon = ({ open }) => open ? (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
) : (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// ── Input with eye toggle ────────────────────────────────────
function PasswordInput({ id, label, value, onChange, placeholder = '••••••••', maxLength }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          className="w-full h-11 px-4 pr-10 rounded-xl border border-slate-200 bg-slate-50
                     text-slate-800 text-sm placeholder-slate-400
                     focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                     transition-all"
        />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

// ── PIN dot indicator ────────────────────────────────────────
function PinDots({ value, max = 6 }) {
  return (
    <div className="flex gap-2 mt-2">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all
          ${i < value.length
            ? 'bg-green-500 border-green-500'
            : 'bg-transparent border-slate-300'}`} />
      ))}
    </div>
  );
}

export default function AccountPage() {
  const { user, logout } = useAuth();

  // ── Change Password state ─────────────────────────────────
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  // ── Change PIN state ──────────────────────────────────────
  const [pinData, setPinData] = useState({ current: '', newPin: '', confirm: '' });
  const [savingPin, setSavingPin] = useState(false);
  const [showRemovePin, setShowRemovePin] = useState(false);
  const [removeCurrentPin, setRemoveCurrentPin] = useState('');
  const [removingPin, setRemovingPin] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(user?.pin_enabled ?? false);

  // ── Password submit ───────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    if (!pwd.current || !pwd.newPwd || !pwd.confirm) {
      toast.error('Please fill all password fields'); return;
    }
    if (pwd.newPwd !== pwd.confirm) {
      toast.error('New passwords do not match'); return;
    }
    if (pwd.newPwd.length < 6) {
      toast.error('New password must be at least 6 characters'); return;
    }
    setSavingPwd(true);
    try {
      const res = await authApi.changePassword({
        currentPassword: pwd.current,
        newPassword:     pwd.newPwd,
        confirmPassword: pwd.confirm,
      });
      toast.success(res.data.message || 'Password updated!');
      setPwd({ current: '', newPwd: '', confirm: '' });
    } catch (err) {
      // toast shown by interceptor
    } finally {
      setSavingPwd(false);
    }
  }

  // ── PIN submit ────────────────────────────────────────────
  async function handleChangePin(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pinData.newPin)) {
      toast.error('PIN must be exactly 6 digits'); return;
    }
    if (pinData.newPin !== pinData.confirm) {
      toast.error('PINs do not match'); return;
    }
    if (pinEnabled && !pinData.current) {
      toast.error('Enter your current PIN'); return;
    }
    setSavingPin(true);
    try {
      const res = await authApi.changePin({
        currentPin: pinData.current || undefined,
        newPin:     pinData.newPin,
        confirmPin: pinData.confirm,
      });
      toast.success(res.data.message || 'PIN updated!');
      setPinData({ current: '', newPin: '', confirm: '' });
      setPinEnabled(true);
      // update local session so header reflects pin_enabled
      try {
        const stored = JSON.parse(localStorage.getItem('lms_user') || '{}');
        localStorage.setItem('lms_user', JSON.stringify({ ...stored, pin_enabled: true }));
      } catch {}
    } catch (err) {
      // toast shown by interceptor
    } finally {
      setSavingPin(false);
    }
  }

  // ── Remove PIN ────────────────────────────────────────────
  async function handleRemovePin(e) {
    e.preventDefault();
    if (!removeCurrentPin) { toast.error('Enter your current PIN'); return; }
    setRemovingPin(true);
    try {
      const res = await authApi.removePin(removeCurrentPin);
      toast.success(res.data.message || 'PIN removed');
      setPinEnabled(false);
      setShowRemovePin(false);
      setRemoveCurrentPin('');
      try {
        const stored = JSON.parse(localStorage.getItem('lms_user') || '{}');
        localStorage.setItem('lms_user', JSON.stringify({ ...stored, pin_enabled: false }));
      } catch {}
    } catch (err) {
      // toast shown by interceptor
    } finally {
      setRemovingPin(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* ── Profile header ── */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center
                        text-white font-bold text-2xl shadow-md shadow-brand-200 shrink-0">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{user?.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-slate-500">{user?.email}</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full capitalize">
              {user?.role_name}
            </span>
          </div>
        </div>
      </div>

      {/* ── Change Password card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <span className="text-slate-500"><LockIcon /></span>
          <div>
            <h2 className="text-base font-bold text-slate-800">Change Password</h2>
            <p className="text-xs text-slate-500 mt-0.5">Update your login password</p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4">
          <PasswordInput
            id="cur-pwd"
            label="Current Password"
            value={pwd.current}
            onChange={e => setPwd(p => ({ ...p, current: e.target.value }))}
            placeholder="Enter current password"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PasswordInput
              id="new-pwd"
              label="New Password"
              value={pwd.newPwd}
              onChange={e => setPwd(p => ({ ...p, newPwd: e.target.value }))}
              placeholder="Min. 6 characters"
            />
            <PasswordInput
              id="confirm-pwd"
              label="Confirm New Password"
              value={pwd.confirm}
              onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
              placeholder="Re-enter new password"
            />
          </div>
          <div className="pt-1">
            <button type="submit" disabled={savingPwd}
              className="h-10 px-6 rounded-xl bg-brand-500 hover:bg-brand-600 text-white
                         text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {savingPwd ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Green PIN / 2FA card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <span className="text-green-500"><ShieldIcon /></span>
            <div>
              <h2 className="text-base font-bold text-slate-800">Green PIN &amp; 2FA</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {pinEnabled
                  ? '2FA is active — PIN required at every login'
                  : 'Set a 6-digit PIN to enable two-factor authentication'}
              </p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full
            ${pinEnabled ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {pinEnabled ? '✓ Active' : 'Not set'}
          </span>
        </div>

        <form onSubmit={handleChangePin} className="px-6 py-5 space-y-4">
          {/* Current PIN — only shown if PIN already enabled */}
          {pinEnabled && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Current PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinData.current}
                onChange={e => setPinData(p => ({ ...p, current: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder="Enter current 6-digit PIN"
                autoComplete="off"
                className="w-full sm:w-56 h-11 px-4 rounded-xl border border-slate-200 bg-slate-50
                           text-slate-800 text-sm tracking-widest placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent
                           transition-all"
              />
              <PinDots value={pinData.current} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                {pinEnabled ? 'New PIN' : 'Set 6-Digit PIN'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinData.newPin}
                onChange={e => setPinData(p => ({ ...p, newPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder="6 digits"
                autoComplete="off"
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50
                           text-slate-800 text-sm tracking-widest placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent
                           transition-all"
              />
              <PinDots value={pinData.newPin} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Confirm PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinData.confirm}
                onChange={e => setPinData(p => ({ ...p, confirm: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder="Re-enter PIN"
                autoComplete="off"
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50
                           text-slate-800 text-sm tracking-widest placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent
                           transition-all"
              />
              <PinDots value={pinData.confirm} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={savingPin}
              className="h-10 px-6 rounded-xl bg-green-600 hover:bg-green-700 text-white
                         text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {savingPin ? 'Saving…' : pinEnabled ? 'Update PIN' : 'Set PIN & Enable 2FA'}
            </button>

            {/* Remove PIN option — only shown if PIN is enabled */}
            {pinEnabled && !showRemovePin && (
              <button type="button" onClick={() => setShowRemovePin(true)}
                className="h-10 px-4 rounded-xl border border-red-200 text-red-500 hover:bg-red-50
                           text-sm font-medium transition-colors flex items-center gap-1.5">
                <TrashIcon /> Remove PIN
              </button>
            )}
          </div>
        </form>

        {/* Remove PIN confirmation */}
        {showRemovePin && (
          <div className="mx-6 mb-5 p-4 rounded-xl border border-red-200 bg-red-50/60">
            <p className="text-sm font-semibold text-red-700 mb-3">
              ⚠️ Removing PIN will disable 2FA on your account
            </p>
            <form onSubmit={handleRemovePin} className="flex items-center gap-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={removeCurrentPin}
                onChange={e => setRemoveCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter current PIN to confirm"
                autoComplete="off"
                className="h-10 px-4 rounded-xl border border-red-300 bg-white
                           text-slate-800 text-sm tracking-widest placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-red-400 transition-all w-56"
              />
              <button type="submit" disabled={removingPin}
                className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white
                           text-sm font-semibold transition-colors disabled:opacity-60">
                {removingPin ? 'Removing…' : 'Confirm Remove'}
              </button>
              <button type="button" onClick={() => { setShowRemovePin(false); setRemoveCurrentPin(''); }}
                className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600
                           hover:bg-slate-50 text-sm font-medium transition-colors">
                Cancel
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Security note ── */}
      <p className="text-xs text-slate-400 text-center pb-4">
        Changes take effect immediately. You will remain logged in after updating credentials.
      </p>
    </div>
  );
}
