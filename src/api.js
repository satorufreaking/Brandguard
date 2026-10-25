/**
 * BrandGuard - Central API Service Layer (Connected to Express Backend & MongoDB Atlas)
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const INITIAL_DRAFT_TEXT =
  "Our software is guaranteed to double every customer's productivity. Join users today. CLICK HERE to learn more.";

// Default Seed / Fallback Datasets (Preserved for offline/testing fallback)
export const MOCK_RULES_DATA = [
  {
    id: 'R-1',
    code: 'R-1',
    category: 'claim_substantiation',
    severity: 'high',
    text: "No absolute claims (guaranteed, best, #1) without an approved source.",
    summary: "Prohibits unqualified absolute claims or quantifiable performance guarantees.",
    active: true,
    version: 'v1.2',
    standard: 'ASCI Code Sec 1.4 & FTC Advertising Substantiation Policy',
  },
  {
    id: 'R-7',
    code: 'R-7',
    category: 'terminology',
    severity: 'medium',
    text: "Use 'customers', not 'users'.",
    summary: "Brand voice standard requiring audience to be addressed as customers.",
    active: true,
    version: 'v1.0',
    standard: 'Acme Fintech Voice & Tone Guide § 3.2',
  },
  {
    id: 'A-2',
    code: 'A-2',
    category: 'accessibility',
    severity: 'low',
    text: "No 'click here' link text.",
    summary: "WCAG 2.1 link clarity requirement. Non-descriptive links are prohibited.",
    active: true,
    version: 'v1.1',
    standard: 'WCAG 2.1 Success Criterion 2.4.4 (Link Purpose in Context)',
  },
  {
    id: 'R-4',
    code: 'R-4',
    category: 'trademark',
    severity: 'medium',
    text: "Always capitalize 'Acme' and 'Acme Fintech' as proper nouns.",
    summary: "Corporate branding identity standard.",
    active: true,
    version: 'v1.0',
    standard: 'Brand Style Guide § 1.1',
  },
  {
    id: 'R-9',
    code: 'R-9',
    category: 'compliance',
    severity: 'high',
    text: "Promotional rate disclosures must include APR and fee disclaimers.",
    summary: "Truth-in-lending statutory disclosure requirements.",
    active: true,
    version: 'v1.3',
    standard: 'CFPB Regulation Z & Truth in Lending Act',
  },
];

export const MOCK_APPROVED_FACTS = [
  {
    id: 'fact-1',
    subject: 'Productivity Improvement',
    value: 'Average 28% efficiency boost verified across 40 beta deployments',
    source: '2025 Acme Enterprise Benchmark Study § 4.1',
    validUntil: '2027-12-31',
  },
  {
    id: 'fact-2',
    subject: 'Active Customer Base',
    value: '12,000+ active enterprise financial institutions',
    source: 'Q3 2026 Verified Metrics Report',
    validUntil: '2027-06-30',
  },
  {
    id: 'fact-3',
    subject: 'Platform Availability SLA',
    value: '99.95% verified uptime over past 24 rolling months',
    source: 'Acme Infrastructure Audit 2026',
    validUntil: '2027-01-01',
  },
];

export const MOCK_QUEUE_ITEMS = [
  {
    id: 'draft-1',
    title: 'Q4 Growth Announcement & Social Copy',
    submitter: 'Sarah Chen (Marketing)',
    highFindingsCount: 1,
    time: '14 mins ago',
    status: 'In review',
    version: 'v2',
    draft: INITIAL_DRAFT_TEXT,
  },
  {
    id: 'draft-2',
    title: 'Acme Card Rewards Promotion',
    submitter: 'Alex Rivera (Agency)',
    highFindingsCount: 3,
    time: '1 hour ago',
    status: 'Changes requested',
    version: 'v1',
    draft: 'Best card #1 guaranteed rewards with zero fees for all users. CLICK HERE.',
  },
  {
    id: 'draft-3',
    title: 'API Platform Launch Announcement',
    submitter: 'Devon Vance (Product)',
    highFindingsCount: 0,
    time: '3 hours ago',
    status: 'Approved',
    version: 'v3',
    draft: 'Acme Fintech delivers reliable infrastructure for enterprise customers worldwide.',
  },
];

export const MOCK_AUDIT_LOGS = [
  {
    id: 'audit-1',
    actor: 'Alex Rivera (Creator)',
    action: 'Saved revision',
    from: 'v1',
    to: 'v2',
    comment: "Applied suggested fix for terminology rule R-7 ('users' -> 'customers').",
    time: '10 mins ago',
  },
  {
    id: 'audit-2',
    actor: 'System (Engine)',
    action: 'Evaluated draft',
    from: 'Raw Draft',
    to: 'Validated',
    comment: '4 findings validated, 2 rejected (unknown rule ID)',
    time: '14 mins ago',
  },
  {
    id: 'audit-3',
    actor: 'Sarah Chen (Reviewer)',
    action: 'Requested changes',
    from: 'In review',
    to: 'Changes requested',
    comment: 'Please attach substantiation for the 2x performance guarantee before publication.',
    time: '1 hour ago',
  },
  {
    id: 'audit-4',
    actor: 'Alex Rivera (Creator)',
    action: 'Submitted draft',
    from: 'Draft',
    to: 'In review',
    comment: 'Initial draft submission for Q4 campaign review.',
    time: '2 hours ago',
  },
  {
    id: 'audit-5',
    actor: 'Marcus Brody (Admin)',
    action: 'Updated rule',
    from: 'R-1 v1.1',
    to: 'R-1 v1.2',
    comment: 'Clarified standard for performance multipliers under ASCI advertising code.',
    time: '1 day ago',
  },
];

/**
 * Health Check API
 */
export async function checkBackendHealth() {
  const startTime = performance.now();
  const res = await fetch(`${API_BASE_URL}/api/health`, {
    headers: { Accept: 'application/json' },
  });
  const latencyMs = Math.round(performance.now() - startTime);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return { ...data, latencyMs };
}

/**
 * Deterministic fallback offset calculator (retained for unit tests / offline)
 */
export function computeFindingsForDraft(draftText, rules = MOCK_RULES_DATA) {
  if (!draftText) return [];
  const findings = [];
  const activeRuleMap = new Map(rules.filter((r) => r.active !== false).map((r) => [r.id, r]));

  if (activeRuleMap.has('R-1')) {
    const r1Patterns = [
      {
        regex: /\b(guaranteed\s+to\s+double)\b/gi,
        explanation: 'Absolute claim with no approved source.',
        suggested: 'can help improve',
      },
      {
        regex: /\b(best)\b/gi,
        explanation: 'Absolute claim "Best" with no approved benchmark source.',
        suggested: 'Leading',
      },
      {
        regex: /(#1|\bno\.?\s*1\b|\bnumber\s*1\b)/gi,
        explanation: 'Unsubstantiated ranking claim "#1" with no accredited third-party study.',
        suggested: 'Top-rated',
      },
      {
        regex: /\b(guaranteed|guarantee)\b/gi,
        explanation: 'Unqualified performance guarantee with no approved underwriting terms.',
        suggested: 'flexible',
      },
    ];

    const matchedSpans = [];

    for (const pat of r1Patterns) {
      let m;
      pat.regex.lastIndex = 0;
      while ((m = pat.regex.exec(draftText)) !== null) {
        const start = m.index;
        const end = m.index + m[0].length;
        const overlaps = matchedSpans.some(
          (s) => Math.max(start, s.start) < Math.min(end, s.end)
        );
        if (!overlaps) {
          matchedSpans.push({ start, end });
          findings.push({
            id: `f1_${start}`,
            category: 'claim_substantiation',
            severity: 'high',
            quoted_text: draftText.slice(start, end),
            quote: draftText.slice(start, end),
            start,
            end,
            characterStart: start,
            characterEnd: end,
            ruleId: 'R-1',
            explanation: pat.explanation,
            message: pat.explanation,
            evidence_status: 'not_enough_information',
            human_review_required: true,
            suggested_revision: pat.suggested,
            status: 'active',
          });
        }
      }
    }
  }

  if (activeRuleMap.has('R-7')) {
    const regex = /\b(users)\b/gi;
    let match;
    while ((match = regex.exec(draftText)) !== null) {
      findings.push({
        id: `f2_${match.index}`,
        category: 'terminology',
        severity: 'medium',
        quoted_text: match[0],
        quote: match[0],
        start: match.index,
        end: match.index + match[0].length,
        characterStart: match.index,
        characterEnd: match.index + match[0].length,
        ruleId: 'R-7',
        explanation: "Brand term is 'customers'.",
        message: "Brand term is 'customers'.",
        evidence_status: 'rule_match',
        human_review_required: false,
        suggested_revision: 'customers',
        status: 'active',
      });
    }
  }

  if (activeRuleMap.has('A-2')) {
    const regex = /(CLICK\s+HERE|click\s+here)/gi;
    let match;
    while ((match = regex.exec(draftText)) !== null) {
      findings.push({
        id: `f3_${match.index}`,
        category: 'accessibility',
        severity: 'low',
        quoted_text: match[0],
        quote: match[0],
        start: match.index,
        end: match.index + match[0].length,
        characterStart: match.index,
        characterEnd: match.index + match[0].length,
        ruleId: 'A-2',
        explanation: 'Non-descriptive link text and all caps.',
        message: 'Non-descriptive link text and all caps.',
        evidence_status: 'rule_match',
        human_review_required: false,
        suggested_revision: 'Learn more about pricing',
        status: 'active',
      });
    }
  }

  // Sort by start offset ascending, then high severity first
  const rank = { high: 3, medium: 2, low: 1 };
  findings.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return rank[b.severity] - rank[a.severity];
  });

  return findings;
}

// ==========================================
// CONNECTED BACKEND REST API CLIENT CALLS
// ==========================================

const DEMO_ROLE_STORAGE_KEY = 'brandguard-demo-role';

export function getSelectedDemoRole() {
  if (typeof localStorage === 'undefined') return 'creator';
  const role = localStorage.getItem(DEMO_ROLE_STORAGE_KEY);
  return ['creator', 'reviewer', 'admin'].includes(role) ? role : 'creator';
}

export function setSelectedDemoRole(role) {
  if (!['creator', 'reviewer', 'admin'].includes(role)) {
    throw new Error('Invalid demo role.');
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('x-brandguard-role', getSelectedDemoRole());
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || `Request failed with HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// 1. Rules
export async function fetchRulesAPI(category) {
  const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
  return apiRequest(`/rules${query}`);
}

export async function updateRuleAPI(ruleId, updates) {
  return apiRequest(`/rules/${encodeURIComponent(ruleId)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// 2. Facts
export async function fetchFactsAPI() {
  return apiRequest('/facts');
}

export async function createFactAPI(fact) {
  return apiRequest('/facts', { method: 'POST', body: JSON.stringify(fact) });
}

export async function updateFactAPI(id, fact) {
  return apiRequest(`/facts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(fact) });
}

export async function deleteFactAPI(id) {
  return apiRequest(`/facts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// 3. Current Review Workspace State
export async function fetchCurrentReviewAPI(draftId = 'draft-1') {
  return apiRequest(`/reviews/current?draftId=${encodeURIComponent(draftId)}`);
}

export async function createDraftAPI({ title, text = '' }) {
  return apiRequest('/drafts', { method: 'POST', body: JSON.stringify({ title, text }) });
}

export async function saveDraftAPI({ draftId, title, text, expectedVersion }) {
  return apiRequest(`/drafts/${encodeURIComponent(draftId)}`, {
    method: 'PUT',
    body: JSON.stringify({ title, text, expectedVersion }),
  });
}

// 4. Run Review
export async function runReviewAPI(draftText, options = {}) {
  const { draftId = 'draft-1', version, simulateError = false } = options;

  if (simulateError) {
    throw new Error('Review failed, retry');
  }
  return apiRequest('/reviews/run', {
    method: 'POST',
    body: JSON.stringify({ draftId, text: draftText, version }),
  });
}

// 5. Accept Finding Fix
export async function acceptFindingAPI({ draftId = 'draft-1', findingId, expectedVersion, newText }) {
  return apiRequest('/reviews/accept', {
    method: 'POST',
    body: JSON.stringify({ draftId, findingId, expectedVersion, newText }),
  });
}

// 6. Dismiss Finding
export async function dismissFindingAPI({ draftId = 'draft-1', findingId, reason }) {
  return apiRequest('/reviews/dismiss', {
    method: 'POST',
    body: JSON.stringify({ draftId, findingId, reason }),
  });
}

export async function restoreFindingAPI({ draftId = 'draft-1', findingId }) {
  return apiRequest('/reviews/restore', {
    method: 'POST',
    body: JSON.stringify({ draftId, findingId }),
  });
}

// 7. Submit Draft
export async function submitDraftAPI({ draftId = 'draft-1' }) {
  return apiRequest('/reviews/submit', {
    method: 'POST',
    body: JSON.stringify({ draftId }),
  });
}

// 8. Record Reviewer Decision
export async function recordDecisionAPI({ draftId = 'draft-1', decision, comment }) {
  return apiRequest('/reviews/decision', {
    method: 'POST',
    body: JSON.stringify({ draftId, decision, comment }),
  });
}

// 9. Queue
export async function fetchQueueAPI() {
  return apiRequest('/queue');
}

// 10. Audit Trail
export async function fetchAuditAPI() {
  return apiRequest('/audit');
}

// 11. Document Ingestion & Text Extraction (PDF/DOCX/TXT)
export async function uploadDocumentAPI(file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (options.runReview !== false) formData.append('runReview', 'true');
  if (options.draftId) formData.append('draftId', options.draftId);
  return apiRequest('/documents/extract', { method: 'POST', body: formData });
}

// 12. Governance Analytics
export async function fetchGovernanceAnalyticsAPI() {
  return apiRequest('/analytics/governance');
}

// 13. LLM Provider Status
export async function fetchLLMStatusAPI() {
  return apiRequest('/llm/status');
}

// 14. Auth & Role Switcher
export async function fetchCurrentUserAPI(role = 'creator') {
  setSelectedDemoRole(role);
  return apiRequest('/auth/me');
}
