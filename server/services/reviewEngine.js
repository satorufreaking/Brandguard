import { runSemanticReview, getLLMConfig } from './llmAdapter.js';

/**
 * BrandGuard Backend Review Engine
 * Implements deterministic brand-rule checks with dynamic inclusive-start / exclusive-end offsets.
 * Optionally integrates configured LLM credentials without fabricating evidence.
 */

export function runDeterministicChecks(draftText, activeRules = []) {
  if (!draftText || typeof draftText !== 'string') {
    return [];
  }

  const findings = [];
  const ruleMap = new Map(activeRules.map((r) => [r.id, r]));

  // 1. Rule R-1: Unsupported absolute claim ("guaranteed to double", "Best", "#1", "guaranteed")
  if (ruleMap.has('R-1') && ruleMap.get('R-1').active !== false) {
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
        // Avoid overlapping with an already matched R-1 span (e.g. 'guaranteed' inside 'guaranteed to double')
        const overlaps = matchedSpans.some(
          (s) => Math.max(start, s.start) < Math.min(end, s.end)
        );
        if (!overlaps) {
          matchedSpans.push({ start, end });
          findings.push({
            id: `f_r1_${start}`,
            ruleId: 'R-1',
            category: 'claim_substantiation',
            severity: 'high',
            quoted_text: draftText.slice(start, end),
            quote: draftText.slice(start, end),
            start,
            end,
            characterStart: start,
            characterEnd: end,
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

  // 2. Rule R-7: Terminology check ("users")
  if (ruleMap.has('R-7') && ruleMap.get('R-7').active !== false) {
    const regex = /\b(users)\b/gi;
    let match;
    while ((match = regex.exec(draftText)) !== null) {
      findings.push({
        id: `f_r7_${match.index}`,
        ruleId: 'R-7',
        category: 'terminology',
        severity: 'medium',
        quoted_text: match[0],
        quote: match[0],
        start: match.index,
        end: match.index + match[0].length,
        characterStart: match.index,
        characterEnd: match.index + match[0].length,
        explanation: "Brand term is 'customers'.",
        message: "Brand term is 'customers'.",
        evidence_status: 'rule_match',
        human_review_required: false,
        suggested_revision: 'customers',
        status: 'active',
      });
    }
  }

  // 3. Rule A-2: Accessibility link text ("CLICK HERE")
  if (ruleMap.has('A-2') && ruleMap.get('A-2').active !== false) {
    const regex = /(CLICK\s+HERE|click\s+here)/gi;
    let match;
    while ((match = regex.exec(draftText)) !== null) {
      findings.push({
        id: `f_a2_${match.index}`,
        ruleId: 'A-2',
        category: 'accessibility',
        severity: 'low',
        quoted_text: match[0],
        quote: match[0],
        start: match.index,
        end: match.index + match[0].length,
        characterStart: match.index,
        characterEnd: match.index + match[0].length,
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

/**
 * Executes review pipeline: deterministic first, then semantic if LLM configured
 */
export async function executeReviewPipeline(draftText, activeRules = []) {
  const deterministicFindings = runDeterministicChecks(draftText, activeRules);
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

  // Combine findings, filtering out duplicate spans for same rule
  const combined = [...deterministicFindings];
  for (const sf of semanticResult.findings) {
    const isDuplicate = deterministicFindings.some(
      (df) => df.ruleId === sf.ruleId && Math.max(df.start, sf.start) < Math.min(df.end, sf.end)
    );
    if (!isDuplicate) {
      combined.push(sf);
    }
  }

  // Sort by start offset ascending, then high severity first
  const rank = { high: 3, medium: 2, low: 1 };
  combined.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return rank[b.severity] - rank[a.severity];
  });

  const rejectedCount = semanticResult.rejected.length;
  let summaryLine = '';
  if (semanticResult.used) {
    summaryLine = `${combined.length} finding${combined.length === 1 ? '' : 's'} validated across active brand rules (${deterministicFindings.length} deterministic, ${semanticResult.findings.length} semantic)${
      rejectedCount > 0 ? `, ${rejectedCount} rejected (unknown rule/unmatched)` : ''
    }`;
  } else {
    summaryLine = combined.length > 0
      ? `${combined.length} finding${combined.length === 1 ? '' : 's'} validated across active brand rules`
      : '0 violations flagged across active brand rules (all rules passed)';
  }

  return {
    findings: combined,
    summaryLine,
    meta: {
      engine: semanticResult.used ? 'hybrid' : 'deterministic',
      llmConfigured: llmConfig.configured,
      llmUsed: semanticResult.used,
      provider: semanticResult.provider || (llmConfig.configured ? llmConfig.provider : null),
      model: semanticResult.model || (llmConfig.configured ? llmConfig.model : null),
      deterministicCount: deterministicFindings.length,
      semanticCount: semanticResult.findings.length,
      rejectedCount,
      status: semanticResult.status,
      summaryLine,
    },
  };
}
