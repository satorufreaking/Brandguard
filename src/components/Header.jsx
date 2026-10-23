import React from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  FileCheck2,
} from 'lucide-react';

export default function Header({
  brandName,
  documentTitle,
  reviewStatus,
  version,
  role,
  onRoleChange,
  unresolvedHighCount,
  onSubmitReview,
  onSimulateLoading,
  onSimulateError,
  onResetDraft,
  onLoadOverlapDemo,
  isSubmitted,
  isLoading,
}) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Document Metadata */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white shadow-2xs">
              <Shield className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-slate-900 tracking-tight">
                  BrandGuard AI
                </span>
                <span className="text-slate-300">/</span>
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {brandName}
                </span>
                <span className="text-xs font-mono font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {version}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">{documentTitle}</p>
            </div>
          </div>

          {/* Status Pill, Role Switcher, & Action Button */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Pill */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isSubmitted
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : unresolvedHighCount > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
              role="status"
              aria-label={`Review status: ${isSubmitted ? 'Submitted for Approval' : reviewStatus}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSubmitted ? 'bg-emerald-500' : unresolvedHighCount > 0 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
              />
              <span>{isSubmitted ? 'Submitted for Approval' : reviewStatus}</span>
            </div>

            {/* Segmented Role Switcher */}
            <div
              className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium text-slate-600"
              role="group"
              aria-label="Role Switcher"
            >
              <button
                type="button"
                onClick={() => onRoleChange('creator')}
                className={`px-3 py-1 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                  role === 'creator'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                aria-pressed={role === 'creator'}
              >
                Creator
              </button>
              <button
                type="button"
                onClick={() => onRoleChange('reviewer')}
                className={`px-3 py-1 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                  role === 'reviewer'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                aria-pressed={role === 'reviewer'}
              >
                Reviewer
              </button>
            </div>

            {/* Primary Submit/Approve Action Button with Blocking Logic */}
            <div className="relative group">
              <button
                type="button"
                onClick={onSubmitReview}
                disabled={unresolvedHighCount > 0 || isSubmitted || isLoading}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                  unresolvedHighCount > 0 || isSubmitted || isLoading
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                }`}
                aria-disabled={unresolvedHighCount > 0 || isSubmitted}
                aria-label={
                  unresolvedHighCount > 0
                    ? 'Submission blocked due to unresolved high severity findings'
                    : role === 'creator'
                    ? 'Submit Draft for Review'
                    : 'Approve Publication'
                }
              >
                {isSubmitted ? (
                  <FileCheck2 className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {isSubmitted
                  ? 'Submitted'
                  : role === 'creator'
                  ? 'Submit for Review'
                  : 'Approve Publication'}
              </button>

              {/* Tooltip on disabled submission */}
              {unresolvedHighCount > 0 && !isSubmitted && (
                <div
                  role="tooltip"
                  className="hidden group-hover:block absolute right-0 top-full mt-1.5 w-64 p-2 bg-slate-900 text-white text-[11px] rounded-md shadow-lg z-50 pointer-events-none"
                >
                  <div className="flex items-center gap-1 text-amber-300 font-semibold mb-0.5">
                    <AlertTriangle className="w-3 h-3 inline" />
                    <span>Submission Blocked</span>
                  </div>
                  Resolve or dismiss all High-severity findings before submitting. ({unresolvedHighCount} remaining)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Verification Scenarios Toolbar */}
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Verification:</span>
            <button
              onClick={onResetDraft}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition focus-visible:ring-1 focus-visible:ring-blue-600"
              title="Reset to default mock draft (3 findings)"
            >
              Default Draft (3 Rules)
            </button>
            <button
              onClick={onLoadOverlapDemo}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition focus-visible:ring-1 focus-visible:ring-blue-600 flex items-center gap-1"
              title="Load overlapping spans (R-1 High + R-3 Medium on 'double')"
            >
              <Layers className="w-3 h-3" /> Overlapping Spans Demo
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSimulateLoading}
              disabled={isLoading}
              className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 transition flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-blue-600"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Simulate Loading
            </button>
            <button
              onClick={onSimulateError}
              className="px-2 py-0.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium transition focus-visible:ring-1 focus-visible:ring-rose-600"
            >
              Simulate Error State
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
