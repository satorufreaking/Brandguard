import { runSemanticReview, getLLMConfig } from './llmAdapter.js';

const SUPPORTED_RULE_IDS = new Set(['R-1', 'R-7', 'A-2', 'R-4', 'R-9']);

function addFinding(findings, rule, text, start, end, explanation, suggestedRevision, evidenceStatus = 'rule_match') {
  findings.push({
    id: `f_${rule.id.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${start}`,
    ruleId: rule.id,
    category: rule.category,
    severity: rule.severity,
    quoted_text: text.slice(start, end),
    quote: text.slice(start, end),
    start,
    end,
    characterStart: start,
    characterEnd: end,
    explanation,
    message: explanation,
    evidence_status: evidenceStatus,
    human_review_required: evidenceStatus === 'not_enough_information' || rule.id === 'R-9',
    ...(suggestedRevision ? { suggested_revision: suggestedRevision } : {}),
    status: 'active',
  });
}

function collectMatches(text, regex, callback) {
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    callback(match);
    if (match[0].length === 0) regex.lastIndex++;
  }
}

export function getUnverifiedRuleIds(activeRules = []) {
  return [...new Set(activeRules
    .filter((rule) => rule.active !== false && !SUPPORTED_RULE_IDS.has(rule.id))
    .map((rule) => rule.id))];
}

export function runDeterministicChecks(draftText, activeRules = []) {
  if (!draftText || typeof draftText !== 'string') return [];

  const findings = [];
  const rules = new Map(activeRules.filter((rule) => rule.active !== false).map((rule) => [rule.id, rule]));

  const r1 = rules.get('R-1');
  if (r1) {
    const patterns = [
      { regex: /\bguaranteed\s+to\s+double\b/gi, explanation: 'Absolute performance claim without approved substantiation.', suggested: 'can help improve' },
      { regex: /\b100\s*%|\b100\s*percent\b/gi, explanation: 'Absolute 100% claim requires approved substantiation.', suggested: 'a high level of' },
      { regex: /\bbest\b/gi, explanation: 'Absolute claim "best" requires an approved benchmark source.', suggested: 'leading' },
      { regex: /#1|\bno\.?\s*1\b|\bnumber\s*1\b/gi, explanation: 'Unsubstantiated ranking claim requires an accredited third-party study.', suggested: 'top-rated' },
      { regex: /\bguarantee(?:d|s)?\b/gi, explanation: 'Unqualified performance guarantee requires approved substantiation.', suggested: 'may' },
    ];
    const matches = [];
    for (const pattern of patterns) {
      collectMatches(draftText, pattern.regex, (match) => matches.push({
        start: match.index,
        end: match.index + match[0].length,
        ...pattern,
      }));
    }
    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const occupied = [];
    for (const match of matches) {
      if (occupied.some((span) => match.start < span.end && match.end > span.start)) continue;
      occupied.push(match);
      addFinding(findings, r1, draftText, match.start, match.end, match.explanation, match.suggested, 'not_enough_information');
    }
  }

  const r7 = rules.get('R-7');
  if (r7) {
    collectMatches(draftText, /\busers\b/gi, (match) => {
      addFinding(findings, r7, draftText, match.index, match.index + match[0].length, "Brand term is 'customers'.", 'customers');
    });
  }

  const a2 = rules.get('A-2');
  if (a2) {
    collectMatches(draftText, /\bclick\s+here\b/gi, (match) => {
      addFinding(findings, a2, draftText, match.index, match.index + match[0].length, 'Non-descriptive link text does not communicate its destination.', 'Learn more about pricing');
    });
  }

  const r4 = rules.get('R-4');
  if (r4) {
    collectMatches(draftText, /\bacme(?:\s+fintech)?\b/gi, (match) => {
      const canonical = match[0].toLowerCase() === 'acme fintech' ? 'Acme Fintech' : 'Acme';
      if (match[0] !== canonical) {
        addFinding(findings, r4, draftText, match.index, match.index + match[0].length, `Use the approved trademark capitalization "${canonical}".`, canonical);
      }
    });
  }

  const r9 = rules.get('R-9');
  if (r9) {
    const promoPattern = /\b(?:promotional|introductory|intro)\s+(?:interest\s+)?(?:rate|apr)\b|\bpromo\s+rate\b/gi;
    const promoMatches = [...draftText.matchAll(promoPattern)];
    const hasApr = /\bAPR\b/i.test(draftText);
    const hasFeeDisclosure = /\b(?:annual|late|transaction|other|applicable)\s+fees?\b|\bfees?\s+(?:may|can|will)\s+apply\b|\bno\s+(?:annual\s+)?fees?\b/i.test(draftText);
    if (promoMatches.length > 0 && (!hasApr || !hasFeeDisclosure)) {
      const match = promoMatches[0];
      const missing = [
        !hasApr ? 'APR' : null,
        !hasFeeDisclosure ? 'applicable fee disclosure' : null,
      ].filter(Boolean);
      addFinding(
        findings,
        r9,
        draftText,
        match.index,
        match.index + match[0].length,
        `Promotional rate detected; include ${missing.join(' and ')}. Verify disclosure requirements with a reviewer.`,
        null,
        'not_enough_information'
      );
    }
  }

  const rank = { high: 3, medium: 2, low: 1 };
  findings.sort((a, b) => a.start - b.start || rank[b.severity] - rank[a.severity]);
  return findings;
}

export async function executeReviewPipeline(draftText, activeRules = []) {
  const deterministicFindings = runDeterministicChecks(draftText, activeRules);
  const unverifiedRuleIds = getUnverifiedRuleIds(activeRules);
  const llmConfig = getLLMConfig();

  let semanticResult = {
    findings: [],
    rejected: [],
    used: false,
    provider: null,
    model: null,
    status: 'Deterministic Mode (No LLM credentials configured)',
  };

  if (llmConfig.configured) {
    semanticResult = await runSemanticReview(draftText, activeRules);
  }

  const combined = [...deterministicFindings];
  for (const finding of semanticResult.findings) {
    const duplicate = deterministicFindings.some(
      (item) => item.ruleId === finding.ruleId && Math.max(item.start, finding.start) < Math.min(item.end, finding.end)
    );
    if (!duplicate) combined.push(finding);
  }

  const rank = { high: 3, medium: 2, low: 1 };
  combined.sort((a, b) => a.start - b.start || rank[b.severity] - rank[a.severity]);

  const coverage = {
    supportedRuleIds: [...SUPPORTED_RULE_IDS],
    unverifiedRuleIds,
    complete: unverifiedRuleIds.length === 0,
  };
  const summaryParts = [
    `${combined.length} findings validated`,
    semanticResult.used ? 'deterministic and semantic checks' : 'deterministic checks',
  ];
  if (unverifiedRuleIds.length) summaryParts.push(`unverified active rules: ${unverifiedRuleIds.join(', ')}`);

  return {
    findings: combined,
    summaryLine: summaryParts.join('; '),
    meta: {
      engine: semanticResult.used ? 'hybrid' : 'deterministic',
      llmConfigured: llmConfig.configured,
      llmUsed: semanticResult.used,
      provider: semanticResult.provider || (llmConfig.configured ? llmConfig.provider : null),
      model: semanticResult.model || (llmConfig.configured ? llmConfig.model : null),
      deterministicCount: deterministicFindings.length,
      semanticCount: semanticResult.findings.length,
      rejectedCount: semanticResult.rejected.length,
      status: semanticResult.status,
      coverage,
      summaryLine: summaryParts.join('; '),
    },
  };
}
