import React from 'react';
import clsx from 'clsx';

const colorMap = {
  brand:  'bg-brand-500/10 text-brand-400 border-brand-500/20',
  blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  green:  'bg-green-500/10 text-green-400 border-green-500/20',
  red:    'bg-red-500/10 text-red-400 border-red-500/20',
  cyan:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

const iconMap = {
  users: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  ),
  spark: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  ),
  calendar: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  ),
  check: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  x: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  mail: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  ),
};

export default function StatCard({ label, value, color = 'brand', icon }) {
  return (
    <div className={clsx('card border', colorMap[color])}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white/50">{label}</span>
        <div className={clsx('w-8 h-8 rounded-lg border flex items-center justify-center', colorMap[color])}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {iconMap[icon]}
          </svg>
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value ?? '—'}</div>
    </div>
  );
}
