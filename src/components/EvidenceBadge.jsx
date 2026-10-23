import React from 'react';
import { CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';

export default function EvidenceBadge({ status }) {
  if (status === 'rule_match') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
        Rule match
      </span>
    );
  }

  if (status === 'verified_fact') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
        Verified fact
      </span>
    );
  }

  // 'not_enough_information' (grey/amber, NEVER red)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
      <HelpCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
      Not enough information
    </span>
  );
}
