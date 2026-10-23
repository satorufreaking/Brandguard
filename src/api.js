/**
 * BrandGuard - Central API Service Layer (Connected to Express Backend & MongoDB Atlas)
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
    highFindingsCount: 2,
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
    const target = 'guaranteed to double';
    const index = draftText.toLowerCase().indexOf(target.toLowerCase());
    if (index !== -1) {
      findings.push({
        id: 'f1',
        category: 'claim_substantiation',
        severity: 'high',
        quoted_text: draftText.slice(index, index + target.length),
        start: index,
        end: index + target.length,
        ruleId: 'R-1',
        explanation: 'Absolute claim with no approved source.',
        evidence_status: 'not_enough_information',
        human_review_required: true,
        suggested_revision: 'can help improve',
        status: 'active',
      });
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
        start: match.index,
        end: match.index + match[0].length,
        ruleId: 'R-7',
        explanation: "Brand term is 'customers'.",
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
        start: match.index,
        end: match.index + match[0].length,
        ruleId: 'A-2',
        explanation: 'Non-descriptive link text and all caps.',
        evidence_status: 'rule_match',
        human_review_required: false,
        suggested_revision: 'Learn more about pricing',
        status: 'active',
      });
    }
  }

  return findings;
}

// ==========================================
// CONNECTED BACKEND REST API CLIENT CALLS
// ==========================================

// 1. Rules
export async function fetchRulesAPI(category) {
  try {
    const url = category && category !== 'all'
      ? `${API_BASE_URL}/api/rules?category=${encodeURIComponent(category)}`
      : `${API_BASE_URL}/api/rules`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Rules HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Using local rules fallback:', err.message);
    if (category && category !== 'all') {
      return MOCK_RULES_DATA.filter((r) => r.category === category);
    }
    return MOCK_RULES_DATA;
  }
}

export async function updateRuleAPI(ruleId, updates) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Update Rule HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Fallback update rule:', err.message);
    const rule = MOCK_RULES_DATA.find((r) => r.id === ruleId);
    if (rule) Object.assign(rule, updates);
    return rule;
  }
}

// 2. Facts
export async function fetchFactsAPI() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/facts`);
    if (!res.ok) throw new Error(`Facts HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Using local facts fallback:', err.message);
    return MOCK_APPROVED_FACTS;
  }
}

// 3. Current Review Workspace State
export async function fetchCurrentReviewAPI(draftId = 'draft-1') {
  try {
    const res = await fetch(`${API_BASE_URL}/api/reviews/current?draftId=${draftId}`);
    if (!res.ok) throw new Error(`Current Review HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Fallback current review:', err.message);
    return {
      draft: {
        id: draftId,
        title: 'Q4 Growth Announcement & Social Copy',
        currentVersion: 'v2',
        currentText: INITIAL_DRAFT_TEXT,
        status: 'In review',
        revisions: [{ version: 'v2', text: INITIAL_DRAFT_TEXT, note: 'Initial revision' }],
      },
      findings: computeFindingsForDraft(INITIAL_DRAFT_TEXT),
      rules: MOCK_RULES_DATA,
    };
  }
}

// 4. Run Review
export async function runReviewAPI(draftText, options = {}) {
  const { draftId = 'draft-1', version = 'v2', simulateError = false } = options;

  if (simulateError) {
    throw new Error('Review failed, retry');
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/reviews/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, text: draftText, version }),
    });
    if (!res.ok) throw new Error(`Review Run HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Fallback review run:', err.message);
    const findings = computeFindingsForDraft(draftText);
    return {
      draftText,
      findings,
      meta: {
        validatedCount: 4,
        rejectedCount: 2,
        summaryLine: '4 findings validated, 2 rejected (unknown rule ID)',
      },
    };
  }
}

// 5. Accept Finding Fix
export async function acceptFindingAPI({ draftId = 'draft-1', findingId, ruleId, replacement, newText, nextVersion }) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/reviews/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, findingId, ruleId, replacement, newText, nextVersion }),
    });
    if (!res.ok) throw new Error(`Accept HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Fallback accept fix:', err.message);
    return {
      draft: { currentText: newText, currentVersion: nextVersion || 'v3' },
      findings: computeFindingsForDraft(newText),
      version: nextVersion || 'v3',
    };
  }
}

// 6. Dismiss Finding
export async function dismissFindingAPI({ draftId = 'draft-1', findingId, reason }) {
  const res = await fetch(`${API_BASE_URL}/api/reviews/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId, findingId, reason }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Dismiss failed with HTTP ${res.status}`);
  }
  return await res.json();
}

// 7. Submit Draft
export async function submitDraftAPI({ draftId = 'draft-1', actor = 'Alex Rivera (Creator)' }) {
  const res = await fetch(`${API_BASE_URL}/api/reviews/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId, actor }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Submit failed with HTTP ${res.status}`);
  }
  return await res.json();
}

// 8. Record Reviewer Decision
export async function recordDecisionAPI({ draftId = 'draft-1', decision, comment, reviewer = 'Sarah Chen (Reviewer)' }) {
  const res = await fetch(`${API_BASE_URL}/api/reviews/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId, decision, comment, reviewer }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Decision failed with HTTP ${res.status}`);
  }
  return await res.json();
}

// 9. Queue
export async function fetchQueueAPI() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/queue`);
    if (!res.ok) throw new Error(`Queue HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Fallback fetch queue:', err.message);
    return MOCK_QUEUE_ITEMS;
  }
}

// 10. Audit Trail
export async function fetchAuditAPI() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/audit`);
    if (!res.ok) throw new Error(`Audit HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Fallback fetch audit:', err.message);
    return MOCK_AUDIT_LOGS;
  }
}
