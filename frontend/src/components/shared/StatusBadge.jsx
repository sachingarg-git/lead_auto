import React from 'react';
import { useTranslation } from 'react-i18next';

const STATUS_STYLE = {
  New:       { bg: '#eff9ff', color: '#0889b2', border: '#bae6fd', dot: '#0eaada'  },
  FollowUp:  { bg: '#fffbeb', color: '#b45309', border: '#fcd34d', dot: '#f59e0b'  },
  DemoGiven: { bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd', dot: '#8b5cf6'  },
  Converted: { bg: '#f0fdf4', color: '#15803d', border: '#86efac', dot: '#22c55e'  },
  Lost:      { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5', dot: '#ef4444'  },
  Nurture:   { bg: '#fdf4ff', color: '#a21caf', border: '#f0abfc', dot: '#d946ef'  },
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const s = STATUS_STYLE[status] || STATUS_STYLE.New;
  const label = t(`status.${status}`, { defaultValue: status });

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: s.dot }} />
      {label}
    </span>
  );
}
