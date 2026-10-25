import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DraftPanel from '../components/DraftPanel';
import FindingCard from '../components/FindingCard';
import StatusPill from '../components/StatusPill';
import RuleDrawer from '../components/RuleDrawer';
import DismissDialog from '../components/DismissDialog';
import {
  INITIAL_DRAFT_TEXT,
  runReviewAPI,
  fetchCurrentReviewAPI,
  acceptFindingAPI,
  dismissFindingAPI,
  submitDraftAPI,
  recordDecisionAPI,
  uploadDocumentAPI,
  fetchLLMStatusAPI,
  createDraftAPI,
  saveDraftAPI,
  restoreFindingAPI,
  getSelectedDemoRole,
  setSelectedDemoRole,
} from '../api';
import { Shield, Play, Send, CheckCircle2, RotateCcw, AlertCircle, Cpu, Save, Plus } from 'lucide-react';

export default function ReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryDraftId = searchParams.get('draftId');
  const queryRole = searchParams.get('role');

  const draftId = queryDraftId || location.state?.id || 'draft-1';
  const initialRole = queryRole || location.state?.role || getSelectedDemoRole();
  const initialDraft = location.state?.draft || INITIAL_DRAFT_TEXT;
  const initialStatus = location.state?.status || 'In review';
  const initialTitle = location.state?.title || 'Acme Fintech';

  const [role, setRole] = useState(initialRole);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [draftText, setDraftText] = useState(initialDraft);
  const [versionNo, setVersionNo] = useState(1);
  const [revisionsHistory, setRevisionsHistory] = useState([
    { version: 'v1', text: initialDraft, note: 'Initial draft revision' },
  ]);
  const [status, setStatus] = useState(initialStatus);
  const [isReviewMode, setIsReviewMode] = useState(true);
  const savedDraftRef = useRef({ id: draftId, title: initialTitle, text: initialDraft });
  const [isSaving, setIsSaving] = useState(false);
  const [coverageWarning, setCoverageWarning] = useState('');
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [newDraftTitle, setNewDraftTitle] = useState('');

  // Sync role if updated via query params or navigation state
  useEffect(() => {
    if (queryRole && (queryRole === 'creator' || queryRole === 'reviewer')) {
      setRole(queryRole);
      setSelectedDemoRole(queryRole);
    } else if (location.state?.role) {
      setRole(location.state.role);
      setSelectedDemoRole(location.state.role);
    } else {
      setRole(getSelectedDemoRole());
    }
  }, [queryRole, location.state?.role]);

  // Findings and State
  const [findings, setFindings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Validation summary line
  const [validationSummary, setValidationSummary] = useState('');

  // Document Upload (PDF/DOCX/TXT)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [llmStatus, setLlmStatus] = useState(null);

  // Fetch live LLM status on mount
  useEffect(() => {
    fetchLLMStatusAPI().then((st) => setLlmStatus(st)).catch((err) => {
      setLlmStatus({ mode: `Backend unavailable: ${err.message}` });
    });
  }, []);

  // Handle Document Upload (PDF/DOCX/TXT)
  const handleFileUpload = async (file) => {
    if (!file) return;

    const ext = file.name ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
    const allowed = ['.pdf', '.docx', '.txt', '.md'];
    if (!allowed.includes(ext)) {
      setError(`Unsupported file type "${ext}". Allowed: PDF (.pdf), Word (.docx), or Text (.txt).`);
      setLiveMessage('Upload rejected: unsupported file format.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(`File size exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      setLiveMessage('Upload rejected: file size exceeds 10MB.');
      return;
    }
    if (role !== 'creator') {
      setError('Only the demo Creator role can upload content.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setLiveMessage(`Uploading and extracting text from ${file.name}...`);

    try {
      const res = await uploadDocumentAPI(file, { draftId, runReview: true, actor: 'Alex Rivera (Creator)' });
      setDraftText(res.text);
      setUploadedFileName(res.filename);
      setDraftTitle(res.filename.replace(/\.[^/.]+$/, ''));
      setFindings([]);
      if (res.findings) {
        setFindings(res.findings);
        if (res.findings.length > 0) {
          setSelectedFindingId(res.findings[0].id);
        }
      }
      if (res.summaryLine) {
        setValidationSummary(res.summaryLine);
      }
      setCoverageWarning(res.meta?.coverage?.unverifiedRuleIds?.length
        ? `Unverified active rules: ${res.meta.coverage.unverifiedRuleIds.join(', ')}. Submission is blocked until these rules are supported.`
        : '');
      setIsReviewMode(true);
      setLiveMessage(`Extracted ${res.wordCount} words from ${res.filename}. Review updated with ${res.findings?.length || 0} findings.`);
    } catch (err) {
      setError(err.message || 'Failed to extract text from document');
      setLiveMessage(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Initial load from Backend API with fallback
  useEffect(() => {
    let isMounted = true;
    async function loadWorkspace() {
      setWorkspaceLoaded(false);
      setIsLoading(true);
      setError(null);
      setCoverageWarning('');
      setFindings([]);
      setValidationSummary('');
      setUploadedFileName(null);
      setReviewerComment('');
      setIsReviewMode(true);
      try {
        const data = await fetchCurrentReviewAPI(draftId);
        if (!isMounted) return;
        if (data.draft) {
          const loadedTitle = data.draft.title || initialTitle;
          const loadedText = data.draft.currentText ?? initialDraft;
          const loadedVersion = data.draft.currentVersion || 'v1';
          setDraftTitle(loadedTitle);
          setDraftText(loadedText);
          setStatus(data.draft.status || initialStatus);
          const verNum = parseInt((data.draft.currentVersion || 'v1').replace('v', ''), 10) || 1;
          setVersionNo(verNum);
          savedDraftRef.current = { id: data.draft.id, title: loadedTitle, text: loadedText };
          const localChangesKey = `brandguard-unsaved-${data.draft.id}`;
          const localChanges = sessionStorage.getItem(localChangesKey);
          if (localChanges) {
            try {
              const snapshot = JSON.parse(localChanges);
              if (snapshot.baseVersion === loadedVersion) {
                setDraftTitle(snapshot.title);
                setDraftText(snapshot.text);
              } else {
                sessionStorage.removeItem(localChangesKey);
              }
            } catch (parseError) {
              sessionStorage.removeItem(localChangesKey);
              console.warn('Discarded invalid unsaved draft snapshot:', parseError.message);
            }
          }
          if (data.draft.revisions?.length) {
            setRevisionsHistory(data.draft.revisions);
          }
        }
        if (data.summaryLine) {
          setValidationSummary(data.summaryLine);
        }
        if (data.findings && Array.isArray(data.findings)) {
          setFindings(data.findings);
          if (data.findings.length > 0) {
            setSelectedFindingId(data.findings[0].id);
          }
        }
        setCoverageWarning(data.coverage?.unverifiedRuleIds?.length
          ? `Unverified active rules: ${data.coverage.unverifiedRuleIds.join(', ')}. Submission is blocked until these rules are supported.`
          : '');
      } catch (err) {
        setError(`Unable to load draft: ${err.message}`);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setWorkspaceLoaded(true);
        }
      }
    }
    loadWorkspace();
    return () => { isMounted = false; };
  }, [draftId, initialDraft, initialStatus, initialTitle]);

  // Run review engine via Backend API
  const executeReview = useCallback(async (text, options = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await runReviewAPI(text, { draftId, version: versionString, ...options });
      setFindings(result.findings);
      if (result.summaryLine) {
        setValidationSummary(result.summaryLine);
      }
      setCoverageWarning(result.coverage?.unverifiedRuleIds?.length
        ? `Unverified active rules: ${result.coverage.unverifiedRuleIds.join(', ')}. Submission is blocked until these rules are supported.`
        : '');
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
    if (error) setError(null);
  };

  const isDirty = draftText !== savedDraftRef.current.text || draftTitle !== savedDraftRef.current.title;

  useEffect(() => {
    if (!workspaceLoaded || savedDraftRef.current.id !== draftId || typeof sessionStorage === 'undefined') return;
    const key = `brandguard-unsaved-${draftId}`;
    try {
      if (isDirty) {
        sessionStorage.setItem(key, JSON.stringify({
          title: draftTitle,
          text: draftText,
          baseVersion: versionString,
        }));
      } else {
        sessionStorage.removeItem(key);
      }
    } catch (storageError) {
      setError(`Local recovery storage is unavailable. Save draft to preserve your changes. ${storageError.message}`);
    }
  }, [draftId, draftText, draftTitle, isDirty, versionString, workspaceLoaded]);

  const handleSaveDraft = async () => {
    if (role !== 'creator') return null;
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveDraftAPI({
        draftId,
        title: draftTitle,
        text: draftText,
        expectedVersion: versionString,
      });
      const saved = result.draft;
      const savedText = saved.currentText ?? draftText;
      const savedTitle = saved.title ?? draftTitle;
      const savedVersion = saved.currentVersion || versionString;
      savedDraftRef.current = { id: saved.id, title: savedTitle, text: savedText };
      try {
        sessionStorage.removeItem(`brandguard-unsaved-${draftId}`);
      } catch (storageError) {
        setError(`Draft saved on the backend, but the local recovery copy could not be cleared: ${storageError.message}`);
      }
      setDraftTitle(savedTitle);
      setDraftText(savedText);
      setVersionNo(Number.parseInt(savedVersion.slice(1), 10) || versionNo);
      setStatus(saved.status || 'Draft');
      setRevisionsHistory(saved.revisions || []);
      setFindings([]);
      setLiveMessage(`Draft saved as ${savedVersion}.`);
      return saved;
    } catch (err) {
      setError(`Save failed. Your edits are still on this page. Retry Save Draft when the backend is available. ${err.message}`);
      setLiveMessage('Draft was not saved. Your edits remain unsaved.');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDraft = async (event) => {
    event.preventDefault();
    const title = newDraftTitle.trim();
    if (!title) return;
    setError(null);
    try {
      const result = await createDraftAPI({ title });
      setSelectedDemoRole('creator');
      setIsCreatingDraft(false);
      setNewDraftTitle('');
      navigate(`/review?draftId=${encodeURIComponent(result.draft.id)}&role=creator`);
    } catch (err) {
      setError(`Unable to create draft: ${err.message}`);
    }
  };

  const handleRoleChange = (nextRole) => {
    setSelectedDemoRole(nextRole);
    setRole(nextRole);
    setError(null);
  };

  const handleRunReview = async () => {
    const saved = isDirty ? await handleSaveDraft() : null;
    if (isDirty && !saved) return;
    const scanVersion = saved?.currentVersion || versionString;
    await executeReview(draftText, { version: scanVersion });
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

    // Persist to Express backend
    try {
      setError(null);
      const res = await acceptFindingAPI({
        draftId,
        findingId: finding.id,
        expectedVersion: versionString,
        newText,
      });
      const saved = res.draft;
      setDraftText(saved.currentText);
      setVersionNo(Number.parseInt(saved.currentVersion.slice(1), 10) || versionNo);
      setStatus(saved.status);
      setRevisionsHistory(saved.revisions || []);
      savedDraftRef.current = { id: saved.id, title: saved.title, text: saved.currentText };
      setFindings(res.findings || []);
      setLiveMessage(`Accepted fix for rule ${finding.ruleId}. Saved revision ${saved.currentVersion}.`);
    } catch (err) {
      setError(`Unable to apply suggested fix. No changes were saved. ${err.message}`);
    }
  };

  // Open dismiss dialog
  const handleOpenDismiss = (finding, triggerRef) => {
    setDismissTargetFinding(finding);
    setDismissTriggerRef(triggerRef);
  };

  // Confirm dismiss: persists to backend API
  const handleConfirmDismiss = async (findingId, reason) => {
    try {
      setError(null);
      await dismissFindingAPI({ draftId, findingId, reason });
      setFindings((prev) =>
        prev.map((f) =>
          f.id === findingId ? { ...f, status: 'dismissed', dismissReason: reason } : f
        )
      );
      setLiveMessage('Finding dismissed with recorded justification.');
    } catch (err) {
      setError(`Unable to dismiss finding. The finding remains active. ${err.message}`);
      throw err;
    }
  };

  // Restore finding
  const handleRestoreFinding = async (findingId) => {
    try {
      setError(null);
      const result = await restoreFindingAPI({ draftId, findingId });
      setFindings(result.findings || []);
      setLiveMessage('Finding restored.');
    } catch (err) {
      setError(`Unable to restore finding. ${err.message}`);
    }
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
      setError(null);
      if (isDirty) {
        const saved = await handleSaveDraft();
        if (!saved) return;
        const scan = await runReviewAPI(saved.currentText, {
          draftId,
          version: saved.currentVersion,
        });
        setFindings(scan.findings || []);
        setCoverageWarning(scan.coverage?.unverifiedRuleIds?.length
          ? `Unverified active rules: ${scan.coverage.unverifiedRuleIds.join(', ')}. Submission is blocked until these rules are supported.`
          : '');
        if ((scan.findings || []).some((finding) => finding.status === 'active' && finding.severity === 'high')) {
          setError('Resolve all high-severity findings before submitting this saved revision.');
          return;
        }
      }
      const res = await submitDraftAPI({ draftId, actor: 'Alex Rivera (Creator)' });
      setStatus(res.status || 'In review');
      setLiveMessage('Draft submitted for approval.');
    } catch (err) {
      setError(`Unable to submit draft: ${err.message}`);
    }
  };

  // Reviewer Decision Actions (Approve / Request Changes / Reject): persists to backend API
  const handleReviewerAction = async (newStatus) => {
    if (!reviewerComment.trim()) {
      setReviewerActionAttempted(true);
      return;
    }
    try {
      setError(null);
      await recordDecisionAPI({
        draftId,
        decision: newStatus,
        comment: reviewerComment,
        reviewer: 'Sarah Chen (Reviewer)',
      });
      setStatus(newStatus);
      setReviewerActionAttempted(false);
      setReviewerComment('');
      setLiveMessage(`Review decision recorded: ${newStatus}`);
    } catch (err) {
      setError(`Unable to record reviewer decision: ${err.message}`);
    }
  };

  const canEditDraft = role === 'creator' && ['Draft', 'Changes requested', 'Approved', 'Rejected'].includes(status);
  const canResolveFindings = role === 'creator' && ['Draft', 'Changes requested'].includes(status);
  const canReviewDraft = role === 'reviewer' && status === 'In review';

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
    <div className="flex flex-col min-h-[calc(100vh-57px)] lg:h-[calc(100vh-57px)] bg-slate-50 font-sans text-slate-900">
      {/* Aria-live region for screen reader announcements */}
      <div className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-base font-bold text-slate-900 tracking-tight">BrandGuard</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="text-sm font-semibold text-slate-700 break-words">{draftTitle}</span>
            <StatusPill status={status} />
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
              {versionString}
            </span>
            {isDirty && <span className="text-xs font-semibold text-amber-700">Unsaved changes</span>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {llmStatus && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border bg-slate-50 border-slate-200 text-slate-600" title={llmStatus.mode}>
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                {llmStatus.mode}
              </span>
            )}

            {/* Role switcher */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-semibold">Demo-only role</span>
              <div
                className="inline-flex rounded border border-slate-300 bg-slate-100 p-0.5"
                role="group"
                aria-label="Demo: switch role"
              >
                <button
                  type="button"
                  onClick={() => handleRoleChange('creator')}
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
                  onClick={() => handleRoleChange('reviewer')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                    role === 'reviewer'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-pressed={role === 'reviewer'}
                >
                  Reviewer
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('admin')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                    role === 'admin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-pressed={role === 'admin'}
                >
                  Admin
                </button>
              </div>
              <span className="hidden lg:inline max-w-40 text-[10px] text-slate-500">Not secure authentication</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace (Desktop Two Panels) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch min-h-0 lg:overflow-hidden">
        <div className="lg:col-span-12 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {role === 'creator' && (
              <>
                <button type="button" onClick={() => setIsCreatingDraft((open) => !open)} disabled={isLoading || isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> Create draft
                </button>
                {isCreatingDraft && <form onSubmit={handleCreateDraft} className="flex flex-wrap items-center gap-2">
                  <label htmlFor="new-draft-title" className="sr-only">New draft title</label>
                  <input id="new-draft-title" autoFocus maxLength={120} required value={newDraftTitle}
                    onChange={(event) => setNewDraftTitle(event.target.value)} placeholder="Draft title"
                    className="px-3 py-2 text-xs border border-slate-300 rounded focus-visible:ring-2 focus-visible:ring-blue-600" />
                  <button type="submit" disabled={!newDraftTitle.trim()} className="px-3 py-2 text-xs font-semibold rounded bg-blue-600 text-white disabled:opacity-50">Create</button>
                  <button type="button" onClick={() => setIsCreatingDraft(false)} className="px-3 py-2 text-xs border rounded">Cancel</button>
                </form>}
                <button type="button" onClick={handleSaveDraft} disabled={!isDirty || isSaving || isLoading || !canEditDraft}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500">
                  <Save className="w-3.5 h-3.5" /> {isSaving ? 'Saving...' : 'Save draft'}
                </button>
              </>
            )}
          </div>
          {coverageWarning && <p role="status" className="basis-full text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">{coverageWarning}</p>}
        </div>
        {/* Left Panel: Draft */}
        <div className="lg:col-span-7 flex flex-col min-h-[28rem] lg:h-full lg:min-h-0 lg:overflow-hidden">
          <DraftPanel
            draftText={draftText}
            onDraftChange={handleDraftTextChange}
            isReviewMode={isReviewMode}
            onToggleReviewMode={() => setIsReviewMode(!isReviewMode)}
            findings={findings}
            selectedFindingId={selectedFindingId}
            onHighlightClick={handleHighlightClick}
            onFileUpload={handleFileUpload}
            isUploading={isUploading}
            uploadedFileName={uploadedFileName}
            readOnly={!canResolveFindings}
          />
        </div>

        {/* Right Panel: Findings */}
        <div className="lg:col-span-5 flex flex-col min-h-[24rem] lg:h-full lg:min-h-0 lg:overflow-hidden bg-white rounded border border-slate-200">
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
                  <span>Action could not be completed</span>
                </div>
                <p className="text-rose-700 leading-normal">
                  {error || 'Unable to complete brand rule verification check.'}
                </p>
                <button
                  type="button"
                  onClick={handleRunReview}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white font-semibold rounded hover:bg-rose-700 transition focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:outline-none"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> {isDirty ? 'Retry Save / Review' : 'Retry Review'}
                </button>
              </div>
            )}

            {/* Empty State: only when 0 active and 0 dismissed */}
            {!isLoading && !error && activeCount === 0 && dismissedFindings.length === 0 && (
              <div className="py-16 px-4 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-3 border border-emerald-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{draftText.trim() ? 'No issues found' : 'No content to review'}</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {draftText.trim()
                    ? 'Every phrase in this revision conforms with active deterministic checks.'
                    : 'Add draft content before scanning or submitting for approval.'}
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
                      readOnly={!canResolveFindings}
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
                      readOnly={!canResolveFindings}
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
                      readOnly={!canEditDraft || isLoading}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Validation line under the findings list */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 font-mono flex items-center justify-between flex-shrink-0">
            <span>{validationSummary || `${findings.length} findings validated`}</span>
          </div>
        </div>
      </main>

      {/* Reviewer Action Bar (when Reviewer mode is active) */}
      {canReviewDraft && (
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
                title={unresolvedHighCount > 0 ? `Approval locked: ${unresolvedHighCount} unresolved high-severity finding${unresolvedHighCount > 1 ? 's' : ''}` : 'Approve draft'}
                className="px-3.5 py-2 text-xs font-semibold rounded text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none"
              >
                Approve {unresolvedHighCount > 0 ? `(${unresolvedHighCount} high open)` : ''}
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
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleRunReview}
            disabled={isLoading || role !== 'creator'}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          >
            <Play className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Run review
          </button>

          {role === 'creator' && ['Draft', 'Changes requested'].includes(status) ? (
            <div className="flex flex-wrap items-center gap-3">
              {unresolvedHighCount > 0 && (
                <span className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Submit disabled: {unresolvedHighCount} unresolved high-severity finding{unresolvedHighCount > 1 ? 's' : ''}
                </span>
              )}
              <button
                type="button"
                onClick={handleSubmitForApproval}
                disabled={unresolvedHighCount > 0 || isLoading || isSaving || !draftText.trim()}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                  unresolvedHighCount > 0 || isLoading || isSaving || !draftText.trim()
                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                aria-disabled={unresolvedHighCount > 0 || isLoading || isSaving || !draftText.trim()}
              >
                <Send className="w-3.5 h-3.5" />
                Submit for approval
              </button>
            </div>
          ) : role === 'reviewer' ? (
            <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              Reviewer Mode: Use the review controls above to approve, request changes, or reject.
            </div>
          ) : null}
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
