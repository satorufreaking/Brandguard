import React, { useRef } from 'react';
import { AlertCircle, AlertTriangle, Info, UserCheck, ArrowRight, Check, X, RotateCcw } from 'lucide-react';
import EvidenceBadge from './EvidenceBadge';

export default function FindingCard({
  finding,
  isSelected,
  isPulsing,
  onSelect,
  onOpenRule,
  onAccept,
  onOpenDismiss,
  onRestore,
}) {
  const chipRef = useRef(null);
  const dismissBtnRef = useRef(null);

  const isHigh = finding.severity === 'high';
  const isMed = finding.severity === 'medium';
  const isLow = finding.severity === 'low';

  const SeverityIcon = isHigh ? AlertCircle : isMed ? AlertTriangle : Info;

  const severityDotColor = isHigh
    ? 'bg-rose-600'
    : isMed
    ? 'bg-amber-600'
    : 'bg-blue-600';

  const severityBorder = isSelected
    ? 'ring-2 ring-blue-600 border-blue-600'
    : isHigh
    ? 'border-rose-200'
    : isMed
    ? 'border-amber-200'
    : 'border-blue-200';

  return (
    <article
      onClick={() => onSelect(finding.id)}
      className={`bg-white rounded border ${severityBorder} p-4 space-y-3 transition-all ${
        isPulsing ? 'animate-target-pulse' : ''
      }`}
      aria-label={`${finding.severity.toUpperCase()} severity finding for rule ${finding.ruleId}`}
    >
      {/* 1. Severity dot + icon, category label */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${severityDotColor}`} aria-hidden="true" />
          <SeverityIcon
            className={`w-4 h-4 ${
              isHigh ? 'text-rose-600' : isMed ? 'text-amber-600' : 'text-blue-600'
            }`}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            {finding.category?.replace('_', ' ')}
          </span>
        </div>

        {/* 3. Rule ID as a clickable chip (opens side drawer) */}
        <button
          ref={chipRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenRule(finding.ruleId, chipRef);
          }}
          className="px-2 py-0.5 rounded font-mono text-xs font-semibold bg-slate-100 hover:bg-blue-50 text-blue-700 border border-slate-300 hover:border-blue-400 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          aria-label={`Open rule drawer for ${finding.ruleId}`}
        >
          {finding.ruleId}
        </button>
      </div>

      {/* 2. Quoted text in quotes */}
      <div>
        <span className="text-xs text-slate-500 font-semibold block mb-0.5">Quoted Text:</span>
        <blockquote className="text-xs font-mono italic text-slate-900 bg-slate-50 p-2 rounded border border-slate-200">
          "{finding.quoted_text}"
        </blockquote>
      </div>

      {/* 4. One-line explanation */}
      <p className="text-xs text-slate-800 leading-normal font-normal">
        {finding.explanation}
      </p>

      {/* 5. Evidence badge & 6. "human review required" flag */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        <EvidenceBadge status={finding.evidence_status} />
        {finding.human_review_required && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <UserCheck className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
            Human review required
          </span>
        )}
      </div>

      {/* 7. Suggested fix as before/after: old text struck through, new text green */}
      {finding.suggested_revision && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 block">Suggested Fix:</span>
          <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
            <span className="line-through text-slate-400">"{finding.quoted_text}"</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span className="text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
              "{finding.suggested_revision}"
            </span>
          </div>
        </div>
      )}

      {/* Dismissed reason display */}
      {finding.status === 'dismissed' && (
        <div className="p-2 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700">
          <span className="font-semibold text-slate-800">Dismissed:</span> {finding.dismissReason}
        </div>
      )}

      {/* 8. [Accept] and [Dismiss] buttons */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
        {finding.status === 'active' ? (
          <>
            <button
              ref={dismissBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDismiss(finding, dismissBtnRef);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
            >
              Dismiss
            </button>
            {finding.suggested_revision && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept(finding);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none"
              >
                Accept
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestore(finding.id);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restore Finding
          </button>
        )}
      </div>
    </article>
  );
}
