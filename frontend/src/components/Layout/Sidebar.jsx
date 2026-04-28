import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

const DashboardIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const LeadsIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const SourcesIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);
const AdminIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const SettingsIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const ConvertedIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const GuideIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

export default function Sidebar({ isOpen, onClose, desktopHidden = false }) {
  const { user, isAdmin, logout } = useAuth();
  const { t } = useTranslation();

  const navItems = [
    { to: '/dashboard',        label: t('nav.dashboard'),   icon: <DashboardIcon /> },
    { to: '/leads',            label: t('nav.leads'),       icon: <LeadsIcon /> },
    { to: '/converted-leads',  label: 'Converted Leads',   icon: <ConvertedIcon /> },
    { to: '/guide',            label: 'User Guide',         icon: <GuideIcon /> },
  ];
  const adminNavItems = [
    { to: '/sources',  label: t('nav.sources'),  icon: <SourcesIcon /> },
    { to: '/admin',    label: t('nav.admin'),     icon: <AdminIcon /> },
    { to: '/settings', label: t('nav.settings'), icon: <SettingsIcon /> },
  ];

  return (
    <aside className={clsx(
      'fixed inset-y-0 left-0 z-30 flex flex-col w-64',
      'bg-white border-r border-slate-200/80',
      'transition-all duration-300 lg:relative',
      // Desktop: hide (slide left + zero-width) when schedule panel is open
      desktopHidden
        ? 'lg:-translate-x-full lg:w-0 lg:overflow-hidden lg:opacity-0'
        : 'lg:translate-x-0 lg:w-64 lg:opacity-100',
      // Mobile: controlled by isOpen
      isOpen ? 'translate-x-0' : '-translate-x-full'
    )}
      style={{ boxShadow: '2px 0 12px rgba(0,0,0,.04)' }}>

      {/* ── Logo ──────────────────────────────────────────── */}
      <div className="border-b border-slate-100 shrink-0 bg-white overflow-hidden">
        <img
          src="/logo.jpeg"
          alt="Wizone AI Labs"
          className="w-full h-auto block"
        />
      </div>

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
          {t('nav.main')}
        </p>

        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} onClick={onClose}
            className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}>
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] mt-5 mb-2 pt-3 border-t border-slate-100">
              {t('nav.administration')}
            </p>
            {adminNavItems.map(item => (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}>
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* ── User card ─────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center
                          text-white font-bold text-sm shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{user?.name}</div>
            <div className="text-[11px] text-slate-500 font-medium truncate capitalize">{user?.role_name}</div>
          </div>
          <button onClick={logout}
            className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg
                       hover:bg-red-50"
            title={t('nav.signOut')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
