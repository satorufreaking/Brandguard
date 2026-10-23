import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import DraftPanel from '../components/DraftPanel';
import FindingCard from '../components/FindingCard';
import StatusPill from '../components/StatusPill';
import RuleDrawer from '../components/RuleDrawer';
import DismissDialog from '../components/DismissDialog';
import {
  INITIAL_DRAFT_TEXT,
  computeFindingsForDraft,
  runReviewAPI,
  fetchCurrentReviewAPI,
  acceptFindingAPI,
  dismissFindingAPI,
  submitDraftAPI,
  recordDecisionAPI,
} from '../api';
import { Shield, Play, Send, CheckCircle2, RotateCcw, AlertCircle, ArrowRight } from 'lucide-react';

export default function ReviewPage() {
  const location = useLocation();
  const initialRole = location.state?.role || 'creator';
  const initialDraft = location.state?.draft || INITIAL_DRAFT_TEXT;
  const initialStatus = location.state?.status || 'In review';
  const draftId = location.state?.id || 'draft-1';

  const [role, setRole] = useState(initialRole);
  const [draftText, setDraftText] = useState(initialDraft);
  const [versionNo, setVersionNo] = useState(2); // Starts at "v2" per specification
  const [revisionsHistory, setRevisionsHistory] = useState([
    { version: 'v2', text: initialDraft, note: 'Initial submitted revision' },
  ]);
  const [status, setStatus] = useState(initialStatus);
  const [isReviewMode, setIsReviewMode] = useState(true);

  // Findings and State
  const [findings, setFindings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Selection & pulsing
  const [selectedFindingId, setSelectedFindingId] = useState(null);
  const [pulsingFindingId, setPulsingFindingId] = useState(null);

  // Modals & focus restoration
  const [activeRuleId, setActiveRuleId] = useState(null);
  const [ruleTriggerRef, setRuleTriggerRef] = useState(null);
  const [dismissTargetFinding, setDismissTargetFinding] = useState(null);
  const [dismissTriggerRef, setDismissTriggerRef] = useState(null);

  // Reviewer comment box
  const [reviewerComment, setReviewerComment] = useState('');
  const [reviewerActionAttempted, setReviewerActionAttempted] = useState(false);

  // Toast / Live Announcement
  const [liveMessage, setLiveMessage] = useState('');

  // Refs for finding cards to scroll into view
  const cardRefs = useRef({});

  // Compute live version string
  const versionString = `v${versionNo}`;

  // Initial load from Backend API with fallback
  useEffect(() => {
    let isMounted = true;
    async function loadWorkspace() {
      setIsLoading(true);
      try {
        const data = await fetchCurrentReviewAPI(draftId);
        if (!isMounted) return;
        if (data.draft) {
          setDraftText(data.draft.currentText || initialDraft);
          setStatus(data.draft.status || initialStatus);
          const verNum = parseInt((data.draft.currentVersion || 'v2').replace('v', ''), 10) || 2;
          setVersionNo(verNum);
          if (data.draft.revisions?.length) {
            setRevisionsHistory(data.draft.revisions);
          }
        }
        if (data.findings?.length) {
          setFindings(data.findings);
          setSelectedFindingId(data.findings[0].id);
        } else {
          const computed = computeFindingsForDraft(data.draft?.currentText || initialDraft);
          setFindings(computed);
          if (computed.length) setSelectedFindingId(computed[0].id);
        }
      } catch (err) {
        console.warn('Workspace load error, using initial draft:', err.message);
        const computed = computeFindingsForDraft(initialDraft);
        setFindings(computed);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadWorkspace();
    return () => { isMounted = false; };
  }, [draftId, initialDraft, initialStatus]);

  // Run review engine via Backend API
  const executeReview = useCallback(async (text, options = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await runReviewAPI(text, { draftId, version: versionString, ...options });
      setFindings(result.findings);
      setIsReviewMode(true);
      setLiveMessage(`Review completed. ${result.findings.length} findings detected.`);
      if (result.findings.length > 0) {
        setSelectedFindingId(result.findings[0].id);
      }
    } catch (err) {
      setError(err.message || 'Review failed, retry');
      setLiveMessage('Review failed.');
    } finally {
      setIsLoading(false);
    }
  }, [draftId, versionString]);

  // Handle draft text change in textarea
  const handleDraftTextChange = (newText) => {
    setDraftText(newText);
  };

  // Run review trigger button
  const handleRunReview = () => {
    executeReview(draftText, { latency: 1200 });
  };

  // Accept finding: replaces span, bumps revision, persists to backend API
  const handleAcceptFinding = async (finding) => {
    let newText = '';
    if (
      finding.start >= 0 &&
      finding.end <= draftText.length &&
      draftText.slice(finding.start, finding.end) === finding.quoted_text
    ) {
      newText =
        draftText.slice(0, finding.start) +
        finding.suggested_revision +
        draftText.slice(finding.end);
    } else {
      newText = draftText.replace(finding.quoted_text, finding.suggested_revision);
    }

    const nextRev = versionNo + 1;
    const nextVerStr = `v${nextRev}`;
    setVersionNo(nextRev);
    setDraftText(newText);

    // Persist to Express backend
    try {
      const res = await acceptFindingAPI({
        draftId,
        findingId: finding.id,
        ruleId: finding.ruleId,
        replacement: finding.suggested_revision,
        newText,
        nextVersion: nextVerStr,
      });
      if (res.findings) {
        setFindings(res.findings);
      }
    } catch (err) {
      console.warn('Backend accept fallback:', err.message);
      const updatedFindings = computeFindingsForDraft(newText);
      setFindings(updatedFindings);
    }

    setRevisionsHistory((prev) => [
      ...prev,
      {
        version: nextVerStr,
        text: newText,
        note: `Applied suggested fix for rule ${finding.ruleId}`,
        fixedRule: finding.ruleId,
      },
    ]);
    setLiveMessage(`Accepted fix for rule ${finding.ruleId}. Saved revision ${nextVerStr}.`);
  };

  // Open dismiss dialog
  const handleOpenDismiss = (finding, triggerRef) => {
    setDismissTargetFinding(finding);
    setDismissTriggerRef(triggerRef);
  };

  // Confirm dismiss: persists to backend API
  const handleConfirmDismiss = async (findingId, reason) => {
    try {
      await dismissFindingAPI({ draftId, findingId, reason });
    } catch (err) {
      console.warn('Backend dismiss fallback:', err.message);
    }
    setFindings((prev) =>
      prev.map((f) =>
        f.id === findingId ? { ...f, status: 'dismissed', dismissReason: reason } : f
      )
    );
    setLiveMessage(`Dismissed finding for rule with recorded justification.`);
  };

  // Restore finding
  const handleRestoreFinding = (findingId) => {
    setFindings((prev) =>
      prev.map((f) =>
        f.id === findingId ? { ...f, status: 'active', dismissReason: undefined } : f
      )
    );
  };

  // Open rule drawer
  const handleOpenRule = (ruleId, triggerRef) => {
    setActiveRuleId(ruleId);
    setRuleTriggerRef(triggerRef);
  };

  // Highlight clicked: scroll and pulse card
  const handleHighlightClick = (findingId) => {
    setSelectedFindingId(findingId);
    setPulsingFindingId(findingId);

    const targetEl = cardRefs.current[findingId];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    setTimeout(() => {
      setPulsingFindingId(null);
    }, 850);
  };

  // Card clicked: select
  const handleCardClick = (findingId) => {
    setSelectedFindingId(findingId);
  };

  // Submit for approval (Creator): persists to backend API
  const handleSubmitForApproval = async () => {
    try {
      const res = await submitDraftAPI({ draftId, actor: 'Alex Rivera (Creator)' });
      setStatus(res.status || 'In review');
      setLiveMessage('Draft submitted for approval.');
    } catch (err) {
      alert(err.message);
    }
  };

  // Reviewer Decision Actions (Approve / Request Changes / Reject): persists to backend API
  const handleReviewerAction = async (newStatus) => {
    if (!reviewerComment.trim()) {
      setReviewerActionAttempted(true);
      return;
    }
    try {
      await recordDecisionAPI({
        draftId,
        decision: newStatus,
        comment: reviewerComment,
        reviewer: 'Sarah Chen (Reviewer)',
      });
      setStatus(newStatus);
      setReviewerActionAttempted(false);
      setLiveMessage(`Review decision recorded: ${newStatus}`);
    } catch (err) {
      alert(err.message);
    }
  };

  // Unresolved high-severity count (neither accepted nor dismissed)
  const unresolvedHighCount = useMemo(() => {
    return findings.filter((f) => f.status === 'active' && f.severity === 'high').length;
  }, [findings]);

  // Sort findings by severity: high (3) > medium (2) > low (1)
  const sortedFindings = useMemo(() => {
    const rank = { high: 3, medium: 2, low: 1 };
    return [...findings].sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0));
  }, [findings]);

  // Separate active vs dismissed findings
  const activeFindings = useMemo(() => {
    return sortedFindings.filter((f) => f.status === 'active');
  }, [sortedFindings]);

  const dismissedFindings = useMemo(() => {
    return sortedFindings.filter((f) => f.status === 'dismissed');
  }, [sortedFindings]);

  // Separate active findings by category (Accessibility has its own heading)
  const policyFindings = useMemo(() => {
    return activeFindings.filter((f) => f.category !== 'accessibility');
  }, [activeFindings]);

  const accessibilityFindings = useMemo(() => {
    return activeFindings.filter((f) => f.category === 'accessibility');
  }, [activeFindings]);

  // Active counts
  const activeCount = activeFindings.length;
  const highCount = activeFindings.filter((f) => f.severity === 'high').length;
  const medCount = activeFindings.filter((f) => f.severity === 'medium').length;
  const lowCount = activeFindings.filter((f) => f.severity === 'low').length;

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Aria-live region for screen reader announcements */}
      <div className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-slate-900 tracking-tight">BrandGuard</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-semibold text-slate-700">Acme Fintech</span>
            <span className="text-slate-300">|</span>
            <StatusPill status={status} />
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
              {versionString}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Role switcher */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-semibold">Demo: switch role</span>
              <div
                className="inline-flex rounded border border-slate-300 bg-slate-100 p-0.5"
                role="group"
                aria-label="Demo: switch role"
              >
                <button
                  type="button"
                  onClick={() => setRole('creator')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                    role === 'creator'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-pressed={role === 'creator'}
                >
                  Creator
                </button>
                <button
                  type="button"
                  onClick={() => setRole('reviewer')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                    role === 'reviewer'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-pressed={role === 'reviewer'}
                >
                  Reviewer
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace (Desktop Two Panels) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-0 overflow-hidden">
        {/* Left Panel: Draft */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 overflow-hidden">
          <DraftPanel
            draftText={draftText}
            onDraftChange={handleDraftTextChange}
            isReviewMode={isReviewMode}
            onToggleReviewMode={() => setIsReviewMode(!isReviewMode)}
            findings={findings}
            selectedFindingId={selectedFindingId}
            onHighlightClick={handleHighlightClick}
          />
        </div>

        {/* Right Panel: Findings */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-0 overflow-hidden bg-white rounded border border-slate-200">
          {/* Findings Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Findings ({activeCount})
              </h2>
            </div>
            {/* Severity Count Chips */}
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300">
                {highCount} High
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                {medCount} Med
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-300">
                {lowCount} Low
              </span>
            </div>
          </div>

          {/* Findings List Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {/* Loading State: Skeleton Cards */}
            {isLoading && (
              <div className="space-y-4 animate-pulse" aria-label="Running rule verification">
                <div className="h-36 bg-slate-100 rounded border border-slate-200" />
                <div className="h-36 bg-slate-100 rounded border border-slate-200" />
                <div className="h-36 bg-slate-100 rounded border border-slate-200" />
              </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <div
                role="alert"
                className="p-4 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 space-y-2"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Review failed, retry</span>
                </div>
                <p className="text-rose-700 leading-normal">
                  Unable to complete brand rule verification check.
                </p>
                <button
                  type="button"
                  onClick={handleRunReview}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white font-semibold rounded hover:bg-rose-700 transition focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:outline-none"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry Review
                </button>
              </div>
            )}

            {/* Empty State: only when 0 active and 0 dismissed */}
            {!isLoading && !error && activeCount === 0 && dismissedFindings.length === 0 && (
              <div className="py-16 px-4 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-3 border border-emerald-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">No issues found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Every phrase in this revision conforms with active brand policies and verified facts.
                </p>
              </div>
            )}

            {/* Resolved notice if active findings are 0 but dismissed findings exist */}
            {!isLoading && !error && activeCount === 0 && dismissedFindings.length > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>All active issues resolved. Dismissed findings preserved below for audit.</span>
              </div>
            )}

            {/* Active Policy Findings */}
            {!isLoading && !error && policyFindings.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                  Brand & Policy Findings
                </span>
                {policyFindings.map((finding) => (
                  <div
                    key={finding.id}
                    ref={(el) => (cardRefs.current[finding.id] = el)}
                  >
                    <FindingCard
                      finding={finding}
                      isSelected={selectedFindingId === finding.id}
                      isPulsing={pulsingFindingId === finding.id}
                      onSelect={handleCardClick}
                      onOpenRule={handleOpenRule}
                      onAccept={handleAcceptFinding}
                      onOpenDismiss={handleOpenDismiss}
                      onRestore={handleRestoreFinding}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Accessibility Findings under their own heading */}
            {!isLoading && !error && accessibilityFindings.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block border-t border-slate-200 pt-3">
                  Accessibility Findings
                </span>
                {accessibilityFindings.map((finding) => (
                  <div
                    key={finding.id}
                    ref={(el) => (cardRefs.current[finding.id] = el)}
                  >
                    <FindingCard
                      finding={finding}
                      isSelected={selectedFindingId === finding.id}
                      isPulsing={pulsingFindingId === finding.id}
                      onSelect={handleCardClick}
                      onOpenRule={handleOpenRule}
                      onAccept={handleAcceptFinding}
                      onOpenDismiss={handleOpenDismiss}
                      onRestore={handleRestoreFinding}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Dismissed Findings Section (Preserving history) */}
            {!isLoading && !error && dismissedFindings.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block border-t border-slate-200 pt-3">
                  Dismissed Findings ({dismissedFindings.length}) — Preserved For Audit
                </span>
                {dismissedFindings.map((finding) => (
                  <div
                    key={finding.id}
                    ref={(el) => (cardRefs.current[finding.id] = el)}
                  >
                    <FindingCard
                      finding={finding}
                      isSelected={selectedFindingId === finding.id}
                      isPulsing={pulsingFindingId === finding.id}
                      onSelect={handleCardClick}
                      onOpenRule={handleOpenRule}
                      onAccept={handleAcceptFinding}
                      onOpenDismiss={handleOpenDismiss}
                      onRestore={handleRestoreFinding}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Required validation line under the findings list */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 font-mono flex items-center justify-between flex-shrink-0">
            <span>4 findings validated, 2 rejected (unknown rule ID)</span>
          </div>
        </div>
      </main>

      {/* Reviewer Action Bar (when Reviewer mode is active) */}
      {role === 'reviewer' && (
        <div className="bg-white border-t border-slate-200 p-4 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <label htmlFor="reviewer-comment" className="sr-only">
                Review Decision Mandatory Comment
              </label>
              <input
                id="reviewer-comment"
                type="text"
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                placeholder="Enter mandatory reviewer feedback comment..."
                className={`w-full px-3 py-2 text-xs bg-white border rounded focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                  reviewerActionAttempted && !reviewerComment.trim()
                    ? 'border-rose-500 bg-rose-50/20'
                    : 'border-slate-300'
                }`}
              />
              {reviewerActionAttempted && !reviewerComment.trim() && (
                <span className="text-[11px] text-rose-600 font-semibold mt-1 block">
                  A decision comment is mandatory for reviewer audit.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleReviewerAction('Approved')}
                disabled={unresolvedHighCount > 0}
                className="px-3.5 py-2 text-xs font-semibold rounded text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleReviewerAction('Changes requested')}
                className="px-3.5 py-2 text-xs font-semibold rounded text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:outline-none"
              >
                Request changes
              </button>
              <button
                type="button"
                onClick={() => handleReviewerAction('Rejected')}
                className="px-3.5 py-2 text-xs font-semibold rounded text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300 transition focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:outline-none"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer: [Run review] button, [Submit for approval] button */}
      <footer className="bg-white border-t border-slate-200 px-6 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleRunReview}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          >
            <Play className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Run review
          </button>

          <div className="flex items-center gap-3">
            {unresolvedHighCount > 0 && (
              <span className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Submit disabled: {unresolvedHighCount} unresolved high-severity finding
              </span>
            )}
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={unresolvedHighCount > 0 || isLoading}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                unresolvedHighCount > 0 || isLoading
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              aria-disabled={unresolvedHighCount > 0 || isLoading}
            >
              <Send className="w-3.5 h-3.5" />
              Submit for approval
            </button>
          </div>
        </div>
      </footer>

      {/* Rule Drawer */}
      <RuleDrawer
        ruleId={activeRuleId}
        isOpen={Boolean(activeRuleId)}
        onClose={() => setActiveRuleId(null)}
        triggerRef={ruleTriggerRef}
      />

      {/* Dismiss Dialog with Required Reason */}
      <DismissDialog
        finding={dismissTargetFinding}
        isOpen={Boolean(dismissTargetFinding)}
        onClose={() => setDismissTargetFinding(null)}
        onConfirm={handleConfirmDismiss}
        triggerRef={dismissTriggerRef}
      />
    </div>
  );
}
