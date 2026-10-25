import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchQueueAPI } from '../api';
import StatusPill from '../components/StatusPill';
import { Inbox, AlertCircle, ArrowUpRight, Clock, User, RotateCcw } from 'lucide-react';

export default function QueuePage() {
  const navigate = useNavigate();
  const [queueItems, setQueueItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadQueue() {
      setIsLoading(true);
      try {
        const data = await fetchQueueAPI();
        if (Array.isArray(data)) setQueueItems(data);
        setError('');
      } catch (err) {
        setError(`Unable to load the review queue: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
    loadQueue();
  }, []);

  const handleOpenDraftInReviewerMode = (item) => {
    // Navigate to Review screen in REVIEWER mode using React Router with query params and state
    navigate(`/review?draftId=${encodeURIComponent(item.id)}&role=reviewer`, {
      state: {
        id: item.id,
        role: 'reviewer',
        draft: item.draft,
        title: item.title,
        status: item.status,
        version: item.version,
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Review & Approval Queue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Submitted marketing campaigns and copy awaiting authorized compliance sign-off.
          </p>
        </div>
        <span className="text-xs font-mono font-semibold px-3 py-1 rounded bg-slate-100 text-slate-700 border border-slate-300">
          {queueItems.length} Submitted Items
        </span>
      </div>

      {error && <p role="alert" className="p-3 rounded border border-rose-200 bg-rose-50 text-xs text-rose-800">{error}</p>}

      {/* Queue Cards / Table */}
      <div className="bg-white rounded border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Draft Title</th>
              <th className="py-3 px-4">Submitter</th>
              <th className="py-3 px-4">High Risk Issues</th>
              <th className="py-3 px-4">Review Status</th>
              <th className="py-3 px-4">Submitted</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading review queue...</td></tr>}
            {!isLoading && queueItems.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">{error ? 'Queue unavailable.' : 'No drafts are awaiting review.'}</td></tr>}
            {queueItems.map((item) => (
              <tr
                key={item.id}
                onClick={() => handleOpenDraftInReviewerMode(item)}
                className="hover:bg-slate-50 cursor-pointer transition"
              >
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    <span>{item.title}</span>
                    <span className="text-[11px] font-mono text-slate-400">({item.version})</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-600 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{item.submitter}</span>
                </td>
                <td className="py-3.5 px-4">
                  {item.highFindingsCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-300">
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      {item.highFindingsCount} High Severity
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                      0 High Severity
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4">
                  <StatusPill status={item.status} />
                </td>
                <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                  {item.time}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDraftInReviewerMode(item);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
                  >
                    <span>Open in Reviewer Mode</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-center gap-2">
        <Inbox className="w-4 h-4 text-slate-500" />
        <span>
          Clicking any queue row opens the saved draft in <strong>Reviewer mode</strong>. Decision controls are available only while its status is In review.
        </span>
      </div>
    </div>
  );
}
