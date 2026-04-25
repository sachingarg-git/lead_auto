import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function Header({ onMenuClick, scheduleOpen, onScheduleToggle }) {
  const location  = useLocation();
  const { user }  = useAuth();
  const { t }     = useTranslation();
  const [liveCount, setLiveCount] = useState(0);

  const PAGE_TITLES = useMemo(() => ({
    '/dashboard': t('nav.dashboard'),
    '/leads':     t('nav.leads'),
    '/sources':   t('nav.sources'),
    '/admin':     t('nav.admin'),
    '/settings':  t('nav.settings'),
  }), [t]);

  const title = PAGE_TITLES[location.pathname] || 'Wizone LMS';

  useEffect(() => {
    const socket = io('/', { withCredentials: true });
    socket.emit('join:dashboard');

    socket.on('lead:new', (lead) => {
      setLiveCount(c => c + 1);
      toast.custom((t_) => (
        <div className={`${t_.visible ? 'animate-enter' : 'animate-leave'}
          flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-lg`}
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,.08)' }}>
          <div className="w-9 h-9 bg-brand-500/10 border border-brand-500/20 rounded-xl
                          flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">{t('header.newLead')}</div>
            <div className="text-xs text-slate-600 font-medium">{lead.full_name} · {lead.source}</div>
          </div>
        </div>
      ), { duration: 5000 });
    });

    return () => socket.disconnect();
  }, [t]);

  return (
    <header className="flex items-center gap-4 px-5 h-16 border-b border-slate-200/80
                       bg-white/90 backdrop-blur-sm shrink-0 sticky top-0 z-20"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>

      {/* Mobile menu */}
      <button onClick={onMenuClick}
        className="lg:hidden text-slate-600 hover:text-slate-800 p-1.5 rounded-lg
                   hover:bg-slate-100 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Page title */}
      <h1 className="text-base font-bold text-slate-800 flex-1 tracking-tight">{title}</h1>

      <div className="flex items-center gap-2">
        {/* Live badge */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80
                        rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[11px] font-bold text-emerald-600 tracking-wide">
            {t('header.live')}
          </span>
          {liveCount > 0 && (
            <span className="bg-brand-500 text-white text-[10px] font-bold rounded-full
                             px-1.5 py-0.5 leading-none">
              +{liveCount}
            </span>
          )}
        </div>

        {/* Date */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1.5">
          <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[11px] font-semibold text-slate-700">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Schedule toggle */}
        <button
          onClick={onScheduleToggle}
          title={scheduleOpen ? 'Close Schedule' : 'Open Schedule'}
          className={`
            relative flex items-center gap-2 px-3 py-1.5 rounded-full border
            transition-all duration-200 font-semibold text-[11px]
            ${scheduleOpen
              ? 'bg-brand-500 border-brand-500 text-white shadow-md shadow-brand-500/25'
              : 'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50'
            }
          `}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="hidden sm:inline">Schedule</span>
        </button>
      </div>
    </header>
  );
}
