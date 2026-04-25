import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import SchedulePanel from './SchedulePanel';

export default function Layout() {
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  function openSchedule()  { setSidebarOpen(false); setScheduleOpen(true);  }
  function closeSchedule() { setScheduleOpen(false); }
  function toggleSchedule() { if (scheduleOpen) closeSchedule(); else openSchedule(); }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f5fb' }}>

      {/* Mobile: sidebar backdrop */}
      {sidebarOpen && !scheduleOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile: schedule backdrop */}
      {scheduleOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-30 lg:hidden"
          onClick={closeSchedule} />
      )}

      {/* Sidebar — slides off desktop when schedule opens */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        desktopHidden={scheduleOpen}
      />

      {/* Main content column — auto-shrinks as schedule grows on desktop */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          scheduleOpen={scheduleOpen}
          onScheduleToggle={toggleSchedule}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* ── Desktop: Schedule panel as inline flex child ─────────── */}
      {/* Width animates 0 → 340px so flex-1 main content auto-shrinks */}
      <div
        className={`
          hidden lg:flex lg:flex-col shrink-0 overflow-hidden
          border-l border-slate-200 bg-white
          transition-all duration-300 ease-in-out
          ${scheduleOpen ? 'lg:w-[340px]' : 'lg:w-0'}
        `}
      >
        {/* Inner wrapper keeps panel at full 340px even while outer animates */}
        <div className="w-[340px] h-full flex flex-col">
          <SchedulePanel isOpen={scheduleOpen} onClose={closeSchedule} />
        </div>
      </div>

      {/* ── Mobile: Schedule panel as fixed overlay ───────────────── */}
      <div
        className={`
          lg:hidden fixed inset-y-0 right-0 z-40 w-[85vw] max-w-[340px]
          transition-transform duration-300 ease-in-out shadow-2xl
          ${scheduleOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <SchedulePanel isOpen={scheduleOpen} onClose={closeSchedule} />
      </div>
    </div>
  );
}
