import React, { useState, useRef, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Check,
  X,
  ExternalLink,
  UserCheck,
  Sparkles,
  Layers,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

export default function FindingsPanel({
  findings,
  isLoading,
  error,
  onRetry,
  onAcceptFinding,
  onOpenDismiss,
  onRestoreFinding,
  onOpenRuleDrawer,
  selectedFindingId,
  onSelectFinding,
  role,
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'high' | 'medium' | 'low' | 'dismissed'
  const cardRefs = useRef({});

  // Auto-scroll to selected card
  useEffect(() => {
    if (selectedFindingId && cardRefs.current[selectedFindingId]) {
      cardRefs.current[selectedFindingId].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedFindingId]);

  // Compute counts
  const counts = {
    all: findings.filter((f) => f.status === 'active').length,
    high: findings.filter((f) => f.status === 'active' && f.severity === 'high').length,
    medium: findings.filter((f) => f.status === 'active' && f.severity === 'medium').length,
    low: findings.filter((f) => f.status === 'active' && f.severity === 'low').length,
    dismissed: findings.filter((f) => f.status === 'dismissed').length,
  };

  // Filter findings based on active tab
  const filteredFindings = findings.filter((f) => {
    if (filter === 'all') return f.status === 'active';
    if (filter === 'dismissed') return f.status === 'dismissed';
    return f.status === 'active' && f.severity === filter;
  });

  return (
    <aside
      aria-label="Findings and Recommendations Panel"
      className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
    >
      {/* Panel Header & Severity Counts */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/75 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Governance Findings</h2>
            <span
              className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-slate-200 text-slate-800 rounded-full"
              aria-label={`${counts.all} active findings`}
            >
              {counts.all}
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {counts.high} High • {counts.medium} Med • {counts.low} Low
          </span>
        </div>

        {/* Filter Pills with Counts */}
        <div
          className="flex flex-wrap items-center gap-1.5 text-xs"
          role="tablist"
          aria-label="Filter findings by severity"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
              filter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Active ({counts.all})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'high'}
            onClick={() => setFilter('high')}
            className={`px-2.5 py-1 rounded-md font-medium transition focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:outline-none ${
              filter === 'high'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          >
            High ({counts.high})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'medium'}
            onClick={() => setFilter('medium')}
            className={`px-2.5 py-1 rounded-md font-medium transition focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:outline-none ${
              filter === 'medium'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Medium ({counts.medium})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'low'}
            onClick={() => setFilter('low')}
            className={`px-2.5 py-1 rounded-md font-medium transition focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:outline-none ${
              filter === 'low'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100'
            }`}
          >
            Low ({counts.low})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'dismissed'}
            onClick={() => setFilter('dismissed')}
            className={`px-2.5 py-1 rounded-md font-medium transition focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:outline-none ${
              filter === 'dismissed'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            Dismissed ({counts.dismissed})
          </button>
        </div>
      </div>

      {/* Findings Content List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Evaluating brand rules">
            <div className="h-32 bg-slate-100 rounded-lg border border-slate-200" />
            <div className="h-32 bg-slate-100 rounded-lg border border-slate-200" />
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div
            role="alert"
            className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs space-y-2"
          >
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Review Engine Analysis Error</span>
            </div>
            <p className="text-rose-700 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white font-medium rounded-md hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:outline-none transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry Analysis
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredFindings.length === 0 && (
          <div className="py-14 px-4 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-3 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {filter === 'dismissed' ? 'No dismissed findings' : 'All brand rules pass'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
              {filter === 'dismissed'
                ? 'Any rule findings bypassed with an audit justification will appear here.'
                : 'No policy conflicts or ungrounded claims detected in this revision.'}
            </p>
          </div>
        )}

        {/* Active Finding Cards */}
        {!isLoading &&
          !error &&
          filteredFindings.map((finding) => {
            const isSelected = selectedFindingId === finding.id;

            const severityStyles = {
              high: {
                badge: 'bg-rose-50 text-rose-700 border-rose-200',
                border: isSelected ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-rose-200/90',
                headerBg: 'bg-rose-50/40',
                icon: AlertCircle,
              },
              medium: {
                badge: 'bg-amber-50 text-amber-800 border-amber-200',
                border: isSelected ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-amber-200/90',
                headerBg: 'bg-amber-50/40',
                icon: AlertTriangle,
              },
              low: {
                badge: 'bg-sky-50 text-sky-700 border-sky-200',
                border: isSelected ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-sky-200/90',
                headerBg: 'bg-sky-50/40',
                icon: Info,
              },
            }[finding.severity] || {
              badge: 'bg-slate-100 text-slate-700 border-slate-200',
              border: isSelected ? 'border-slate-500 ring-2 ring-slate-500/20' : 'border-slate-200',
              headerBg: 'bg-slate-50',
              icon: Info,
            };

            const SeverityIcon = severityStyles.icon;

            return (
              <div
                key={finding.id}
                ref={(el) => (cardRefs.current[finding.id] = el)}
                onClick={() => onSelectFinding(finding.id)}
                className={`bg-white rounded-lg border transition-all shadow-xs ${severityStyles.border} overflow-hidden`}
                tabIndex={0}
                role="article"
                aria-label={`${finding.severity.toUpperCase()} severity finding: ${finding.ruleId}`}
              >
                {/* Finding Header */}
                <div
                  className={`px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 ${severityStyles.headerBg}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${severityStyles.badge}`}
                    >
                      <SeverityIcon className="w-3 h-3" />
                      {finding.severity}
                    </span>

                    {/* Clickable Rule ID Link */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRuleDrawer(finding.ruleId);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none rounded px-1"
                      aria-label={`Open rule drawer for rule ${finding.ruleId}`}
                      title="Inspect governance rule definition and compliance standard"
                    >
                      <span>Rule {finding.ruleId}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {finding.isOverlapping && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200"
                        title={
                          finding.overlapsWithRuleIds?.length
                            ? `Overlaps with Rule ${finding.overlapsWithRuleIds.join(', ')}`
                            : 'Overlaps with another finding'
                        }
                      >
                        <Layers className="w-2.5 h-2.5" />
                        {finding.overlapsWithRuleIds?.length
                          ? `Overlaps ${finding.overlapsWithRuleIds.join(', ')}`
                          : 'Overlapping Span'}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 font-mono">
                      [{finding.start}:{finding.end}]
                    </span>
                  </div>
                </div>

                {/* Finding Content */}
                <div className="p-3.5 space-y-2.5 text-xs">
                  {/* Quoted Text */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                      Flagged Phrase:
                    </span>
                    <blockquote className="bg-slate-50 px-2.5 py-1.5 rounded border-l-2 border-slate-300 text-slate-900 font-mono text-[11.5px] italic">
                      "{finding.quotedText}"
                    </blockquote>
                  </div>

                  {/* Explanation */}
                  <p className="text-slate-700 leading-relaxed font-normal">
                    {finding.explanation}
                  </p>

                  {/* Metadata Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Evidence: <strong>{finding.evidenceStatus}</strong>
                    </span>
                    {finding.humanReviewRequired && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                        <UserCheck className="w-3 h-3" />
                        Human Review Required
                      </span>
                    )}
                  </div>

                  {/* Suggested Correction Box */}
                  {finding.suggestedCorrection && (
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-md">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 mb-1">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Suggested Fix:</span>
                      </div>
                      <div className="font-mono text-emerald-950 bg-white/90 p-1.5 rounded border border-emerald-200/80 text-[11.5px]">
                        "{finding.suggestedCorrection}"
                      </div>
                    </div>
                  )}

                  {/* Preserved Dismiss Reason */}
                  {finding.status === 'dismissed' && (
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-md text-[11px] text-slate-700">
                      <strong>Dismiss Justification:</strong> {finding.dismissReason || 'No reason provided'}
                    </div>
                  )}
                </div>

                {/* Finding Action Buttons */}
                <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                  {finding.status === 'active' ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDismiss(finding);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-md transition focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
                        aria-label={`Dismiss finding for ${finding.ruleId}`}
                      >
                        <X className="w-3 h-3" /> Dismiss
                      </button>

                      {finding.suggestedCorrection && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAcceptFinding(finding);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-2xs transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none"
                          aria-label={`Accept correction for ${finding.ruleId}`}
                        >
                          <Check className="w-3.5 h-3.5" /> Accept Fix
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestoreFinding(finding.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-md transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                    >
                      <RotateCcw className="w-3 h-3" /> Restore Finding
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
