import React, { useState, useEffect } from 'react';
import { fetchAuditAPI } from '../api';
import { History, Shield, ArrowRight, Clock, User, ShieldCheck } from 'lucide-react';

export default function AuditPage() {
  const [auditEvents, setAuditEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAudit() {
      setIsLoading(true);
      try {
        const data = await fetchAuditAPI();
        if (Array.isArray(data)) setAuditEvents(data);
        setError('');
      } catch (err) {
        setError(`Unable to load the audit trail: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
    loadAudit();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Compliance & Governance Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">
            Append-only, immutable event log tracking all revisions, policy evaluations, and reviewer sign-offs.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Immutable Log (No Edit / Delete)
        </span>
      </div>

      {error && <p role="alert" className="p-3 rounded border border-rose-200 bg-rose-50 text-xs text-rose-800">{error}</p>}
      {isLoading && <p className="text-xs text-slate-500">Loading audit history...</p>}
      {!isLoading && !error && auditEvents.length === 0 && <p className="p-5 bg-white rounded border border-slate-200 text-xs text-slate-500">No audit events have been recorded.</p>}

      {/* Vertical Timeline, Newest First */}
      <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
        {auditEvents.map((event) => (
          <div key={event.id} className="relative group">
            {/* Timeline node */}
            <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-600 ring-4 ring-slate-100" />

            {/* Event Card */}
            <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {event.actor}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {event.action}
                  </span>
                </div>
                <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {event.time}
                </div>
              </div>

              {/* State Transition (From -> To) */}
              <div className="flex items-center gap-2 text-xs font-mono py-1">
                <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200">
                  {event.from}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                  {event.to}
                </span>
              </div>

              {/* Comment */}
              <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-normal font-sans">
                {event.comment}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
