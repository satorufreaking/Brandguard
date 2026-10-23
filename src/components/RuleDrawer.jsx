import React, { useEffect, useRef } from 'react';
import { X, Shield, BookOpen, AlertCircle, AlertTriangle, Info, Check } from 'lucide-react';
import { MOCK_RULES_DATA } from '../api';

export default function RuleDrawer({ ruleId, isOpen, onClose, triggerRef, onSaveRule }) {
  const closeBtnRef = useRef(null);
  const rule = ruleId ? MOCK_RULES_DATA.find((r) => r.id === ruleId) : null;

  // Accessible Escape key and focus restoration
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setTimeout(() => closeBtnRef.current?.focus(), 50);
    } else if (triggerRef?.current) {
      triggerRef.current.focus();
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || !rule) return null;

  const SeverityIcon = {
    high: AlertCircle,
    medium: AlertTriangle,
    low: Info,
  }[rule.severity] || Info;

  const severityBadgeClass = {
    high: 'bg-rose-50 text-rose-800 border-rose-300',
    medium: 'bg-amber-50 text-amber-800 border-amber-300',
    low: 'bg-blue-50 text-blue-800 border-blue-300',
  }[rule.severity];

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-drawer-title"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-8">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                {rule.id}
              </span>
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                {rule.category.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {rule.version}
              </span>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
              aria-label="Close rule details drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Rule Definition
              </span>
              <h2 id="rule-drawer-title" className="text-lg font-semibold text-slate-900 leading-snug">
                {rule.text}
              </h2>
            </div>

            {/* Severity & Version Metadata */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Enforcement Severity:</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold border ${severityBadgeClass}`}>
                  <SeverityIcon className="w-3.5 h-3.5" />
                  {rule.severity.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Rule Version:</span>
                <span className="font-mono font-semibold text-slate-800">{rule.version}</span>
              </div>
            </div>

            {/* Regulatory Standard */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                Governing Standard Reference
              </span>
              <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed font-mono">
                {rule.standard || 'Acme Fintech Corporate Brand Governance Standard'}
              </p>
            </div>

            {/* Policy Intent */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Policy Objective
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {rule.summary || rule.text}
              </p>
            </div>

            {/* Status */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Active in Workspace Policy:</span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Enabled
              </span>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">Every finding is traceable to a rule</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
