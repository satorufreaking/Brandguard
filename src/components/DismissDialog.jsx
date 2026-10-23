import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';

export default function DismissDialog({ finding, isOpen, onClose, onConfirm, triggerRef }) {
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setAttempted(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else if (triggerRef?.current) {
      triggerRef.current.focus();
    }
  }, [isOpen, triggerRef]);

  if (!isOpen || !finding) return null;

  const isReasonValid = reason.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setAttempted(true);
    if (!isReasonValid) return;
    onConfirm(finding.id, reason.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dismiss-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-10">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />
            <h3 id="dismiss-dialog-title" className="text-sm font-semibold text-slate-900">
              Dismiss Finding: Rule {finding.ruleId}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
            aria-label="Cancel and close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          <div>
            <span className="text-slate-500 font-semibold block mb-1">Flagged Content:</span>
            <div className="p-2 bg-slate-50 rounded border border-slate-200 font-mono text-slate-800">
              "{finding.quoted_text}"
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="dismiss-reason" className="font-semibold text-slate-700">
                Dismiss Justification <span className="text-rose-600">* (Required)</span>
              </label>
            </div>
            <textarea
              ref={textareaRef}
              id="dismiss-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a mandatory reason for bypassing this brand rule..."
              className={`w-full p-2.5 text-xs text-slate-900 bg-white border rounded focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none resize-none ${
                attempted && !isReasonValid ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
              required
              aria-required="true"
              aria-invalid={attempted && !isReasonValid}
              aria-describedby={attempted && !isReasonValid ? 'dismiss-error' : undefined}
            />
            {attempted && !isReasonValid && (
              <p id="dismiss-error" className="text-rose-600 text-xs font-semibold">
                Reason is mandatory to preserve the governance audit trail.
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isReasonValid}
              className={`px-3 py-1.5 text-xs font-semibold rounded text-white transition focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:outline-none ${
                isReasonValid
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
              aria-disabled={!isReasonValid}
            >
              Confirm Dismissal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
