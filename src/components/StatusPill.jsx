import React from 'react';

export default function StatusPill({ status }) {
  const styles = {
    'Draft': 'bg-slate-100 text-slate-800 border-slate-300 dot-slate-500',
    'In review': 'bg-blue-50 text-blue-800 border-blue-200 dot-blue-600',
    'Changes requested': 'bg-amber-50 text-amber-800 border-amber-300 dot-amber-600',
    'Approved': 'bg-emerald-50 text-emerald-800 border-emerald-300 dot-emerald-600',
    'Rejected': 'bg-rose-50 text-rose-800 border-rose-300 dot-rose-600',
  }[status] || 'bg-slate-100 text-slate-800 border-slate-300 dot-slate-500';

  const dotColor = {
    'Draft': 'bg-slate-500',
    'In review': 'bg-blue-600',
    'Changes requested': 'bg-amber-600',
    'Approved': 'bg-emerald-600',
    'Rejected': 'bg-rose-600',
  }[status] || 'bg-slate-500';

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles}`}
      aria-label={`Document status: ${status}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
      {status}
    </span>
  );
}
