import React, { useMemo, useState } from 'react';
import { FileText, AlertCircle, AlertTriangle, Info, Edit3, Eye, Upload } from 'lucide-react';

export default function DraftPanel({
  draftText,
  onDraftChange,
  isReviewMode,
  onToggleReviewMode,
  findings,
  selectedFindingId,
  onHighlightClick,
  onFileUpload,
  isUploading = false,
  uploadedFileName = null,
  readOnly = false,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!readOnly && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (onFileUpload) onFileUpload(file);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (onFileUpload) onFileUpload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };
  // Slicing engine: selects highest-severity highlight for overlapping ranges, sorted by start offset
  const textSlices = useMemo(() => {
    if (!draftText) return [];

    const activeFindings = findings.filter(
      (f) =>
        f.status === 'active' &&
        typeof f.start === 'number' &&
        typeof f.end === 'number' &&
        f.start >= 0 &&
        f.end <= draftText.length &&
        f.start < f.end
    );

    if (activeFindings.length === 0) {
      return [{ type: 'text', content: draftText, key: 'text_all' }];
    }

    // Sort by severity (high > medium > low), then start offset
    const severityRank = { high: 3, medium: 2, low: 1 };
    const prioritized = [...activeFindings].sort((a, b) => {
      const diff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (diff !== 0) return diff;
      return a.start - b.start;
    });

    // Greedily pick non-overlapping highlights (keeping higher severity)
    const selected = [];
    for (const f of prioritized) {
      const conflicts = selected.some(
        (s) => Math.max(f.start, s.start) < Math.min(f.end, s.end)
      );
      if (!conflicts) {
        selected.push(f);
      }
    }

    // Sort selected highlights by start offset ascending for linear text flow
    selected.sort((a, b) => a.start - b.start);

    const slices = [];
    let cursor = 0;

    for (const hl of selected) {
      if (hl.start > cursor) {
        slices.push({
          type: 'text',
          content: draftText.slice(cursor, hl.start),
          key: `txt_${cursor}_${hl.start}`,
        });
      }

      slices.push({
        type: 'mark',
        content: draftText.slice(hl.start, hl.end),
        finding: hl,
        severity: hl.severity,
        key: `mark_${hl.id}_${hl.start}`,
      });

      cursor = hl.end;
    }

    if (cursor < draftText.length) {
      slices.push({
        type: 'text',
        content: draftText.slice(cursor),
        key: `txt_${cursor}_end`,
      });
    }

    return slices;
  }, [draftText, findings]);

  return (
    <section
      aria-label="Draft text workspace"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-full bg-white rounded border transition-colors overflow-hidden ${
        isDragging ? 'border-2 border-dashed border-blue-500 bg-blue-50/30' : 'border-slate-200'
      }`}
    >
      {/* Draft Panel Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900">
            {isReviewMode ? 'Reviewed Draft (Read-only)' : 'Editable Draft Input'}
          </h2>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-slate-500 font-mono">
            {draftText.length} characters
          </span>
          {uploadedFileName && (
            <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hidden sm:inline-block truncate max-w-[180px]">
              {uploadedFileName}
            </span>
          )}
        </div>

        {!readOnly && <div className="flex flex-wrap items-center gap-2">
          {/* Upload Button */}
          <label
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition focus-within:ring-2 focus-within:ring-blue-600 ${
              isUploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Upload a PDF, DOCX, or TXT file"
          >
            <Upload className={`w-3.5 h-3.5 text-blue-600 ${isUploading ? 'animate-bounce' : ''}`} />
            <span>{isUploading ? 'Extracting...' : 'Upload PDF/DOCX'}</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="sr-only"
              onChange={handleFileInputChange}
              disabled={isUploading}
            />
          </label>

          <button
            type="button"
            onClick={onToggleReviewMode}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
            aria-label={isReviewMode ? 'Switch to text editing mode' : 'Switch to review highlights mode'}
          >
            {isReviewMode ? (
              <>
                <Edit3 className="w-3.5 h-3.5" /> Edit text
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> View highlights
              </>
            )}
          </button>
        </div>}
      </div>

      {/* Draft Content: Before review (Textarea) vs After review (Highlighted Spans) */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!isReviewMode ? (
          <div className="h-full flex flex-col">
            <label htmlFor="draft-editor-textarea" className="sr-only">
              Draft Content Textarea
            </label>
            <textarea
              id="draft-editor-textarea"
              value={draftText}
              onChange={(e) => onDraftChange(e.target.value)}
              readOnly={readOnly}
              placeholder="Paste or write draft copy here before review..."
              className="w-full flex-1 min-h-[300px] p-4 text-sm font-normal text-slate-900 bg-white border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none resize-none leading-relaxed"
            />
            <p className="mt-2 text-xs text-slate-500">
              Click "[Run review]" below to analyze draft and inspect rule findings.
            </p>
          </div>
        ) : (
          <div
            className="text-base text-slate-900 leading-loose p-4 rounded bg-slate-50 border border-slate-200 select-text"
            tabIndex={0}
            role="region"
            aria-label="Highlighted draft document"
          >
            {textSlices.map((slice) => {
              if (slice.type === 'text') {
                return <span key={slice.key}>{slice.content}</span>;
              }

              const { finding, severity } = slice;
              const isSelected = selectedFindingId === finding.id;

              const markClass = {
                high: 'mark-high',
                medium: 'mark-medium',
                low: 'mark-low',
              }[severity] || 'mark-medium';

              const SeverityIcon = {
                high: AlertCircle,
                medium: AlertTriangle,
                low: Info,
              }[severity] || Info;

              return (
                <mark
                  key={slice.key}
                  onClick={() => onHighlightClick(finding.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onHighlightClick(finding.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${severity.toUpperCase()} severity issue: ${finding.quoted_text} (${finding.explanation})`}
                  title={`[Rule ${finding.ruleId}] ${finding.explanation}`}
                  className={`${markClass} ${
                    isSelected ? 'active ring-2 ring-blue-600' : ''
                  } focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none inline-flex items-center gap-1 mx-0.5`}
                >
                  <SeverityIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>{slice.content}</span>
                </mark>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer helper */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>Click any highlighted phrase to scroll to and pulse its finding card.</span>
        <span className="font-mono text-[11px] text-slate-400">Inclusive [start], Exclusive [end]</span>
      </div>
    </section>
  );
}
