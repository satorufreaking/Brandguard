import { describe, expect, it } from 'vitest';
import { SEED_RULES } from './seeds/defaultData.js';
import {
  executeReviewPipeline,
  getUnverifiedRuleIds,
  runDeterministicChecks,
} from './services/reviewEngine.js';

describe('Deterministic scanner regressions', () => {
  it('detects bare 100% absolute claims and suggests text that does not repeat the claim', () => {
    const findings = runDeterministicChecks('100% uptime is guaranteed.', SEED_RULES);
    const finding = findings.find((item) => item.ruleId === 'R-1' && item.quoted_text === '100%');

    expect(finding).toBeDefined();
    expect('100% uptime is guaranteed.'.slice(finding.start, finding.end)).toBe('100%');
    expect(finding.suggested_revision).not.toMatch(/100\s*%/);
  });

  it('applies configured severity and ignores disabled rules', () => {
    const rules = SEED_RULES.map((rule) => rule.id === 'R-1'
      ? { ...rule, severity: 'low' }
      : rule);
    expect(runDeterministicChecks('This is the best offer.', rules).find((item) => item.ruleId === 'R-1').severity).toBe('low');

    const disabled = rules.map((rule) => rule.id === 'R-1' ? { ...rule, active: false } : rule);
    expect(runDeterministicChecks('This is the best offer.', disabled).some((item) => item.ruleId === 'R-1')).toBe(false);
  });

  it('checks trademark casing and leaves already-canonical names unchanged', () => {
    const findings = runDeterministicChecks('ACME fintech welcomes you; Acme Fintech welcomes customers.', SEED_RULES);
    expect(findings.filter((item) => item.ruleId === 'R-4')).toHaveLength(1);
    expect(findings.find((item) => item.ruleId === 'R-4').suggested_revision).toBe('Acme Fintech');
  });

  it('flags promotional rates missing APR or fee disclosure but accepts complete disclosures', () => {
    const incomplete = runDeterministicChecks('Enjoy our introductory rate today.', SEED_RULES);
    expect(incomplete.some((item) => item.ruleId === 'R-9')).toBe(true);

    const complete = runDeterministicChecks(
      'Enjoy our introductory rate. APR applies and annual fees may apply.',
      SEED_RULES,
    );
    expect(complete.some((item) => item.ruleId === 'R-9')).toBe(false);
  });

  it('reports enabled rule IDs without a deterministic implementation', async () => {
    const rules = [...SEED_RULES, { id: 'R-99', active: true }];
    const result = await executeReviewPipeline('Clean content.', rules);
    expect(getUnverifiedRuleIds(rules)).toContain('R-99');
    expect(result.meta.coverage.unverifiedRuleIds).toContain('R-99');
    expect(result.meta.coverage.complete).toBe(false);
    expect(result.summaryLine).toContain('R-99');
  });
});
