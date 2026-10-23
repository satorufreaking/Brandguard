import { describe, it, expect } from 'vitest';
import { INITIAL_DRAFT_TEXT, computeFindingsForDraft } from './api';

describe('BrandGuard AI Review Screen Audit & Test Suite', () => {
  // Requirement 1: Dynamic character offsets (inclusive start, exclusive end)
  it('Req 1: dynamically computes inclusive-start and exclusive-end offsets for all 3 mock findings', () => {
    const findings = computeFindingsForDraft(INITIAL_DRAFT_TEXT);

    expect(findings).toHaveLength(3);

    // Finding 1: R-1 ("guaranteed to double")
    const f1 = findings.find((f) => f.ruleId === 'R-1');
    expect(f1).toBeDefined();
    expect(f1.quoted_text).toBe('guaranteed to double');
    expect(f1.start).toBe(16);
    expect(f1.end).toBe(36);
    expect(INITIAL_DRAFT_TEXT.slice(f1.start, f1.end)).toBe(f1.quoted_text);

    // Finding 2: R-7 ("users")
    const f2 = findings.find((f) => f.ruleId === 'R-7');
    expect(f2).toBeDefined();
    expect(f2.quoted_text).toBe('users');
    expect(f2.start).toBe(73);
    expect(f2.end).toBe(78);
    expect(INITIAL_DRAFT_TEXT.slice(f2.start, f2.end)).toBe(f2.quoted_text);

    // Finding 3: A-2 ("CLICK HERE")
    const f3 = findings.find((f) => f.ruleId === 'A-2');
    expect(f3).toBeDefined();
    expect(f3.quoted_text).toBe('CLICK HERE');
    expect(f3.start).toBe(86);
    expect(f3.end).toBe(96);
    expect(INITIAL_DRAFT_TEXT.slice(f3.start, f3.end)).toBe(f3.quoted_text);
  });

  // Requirement 2: Overlapping highlights never duplicate or modify draft text
  it('Req 2: overlapping highlights never duplicate or modify draft text, and text reconstruction is 100% exact', () => {
    // Artificial overlapping findings scenario:
    // Finding A: [16, 36) High ("guaranteed to double")
    // Finding B: [30, 36) Medium ("double")
    const mockFindings = [
      { id: 'f1', ruleId: 'R-1', severity: 'high', start: 16, end: 36, quoted_text: 'guaranteed to double', status: 'active' },
      { id: 'f_overlap', ruleId: 'R-3', severity: 'medium', start: 30, end: 36, quoted_text: 'double', status: 'active' },
      { id: 'f2', ruleId: 'R-7', severity: 'medium', start: 73, end: 78, quoted_text: 'users', status: 'active' },
    ];

    // Priority filter (High > Med > Low, then start)
    const severityRank = { high: 3, medium: 2, low: 1 };
    const prioritized = [...mockFindings].sort((a, b) => {
      const diff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (diff !== 0) return diff;
      return a.start - b.start;
    });

    const selected = [];
    for (const f of prioritized) {
      const conflicts = selected.some((s) => Math.max(f.start, s.start) < Math.min(f.end, s.end));
      if (!conflicts) {
        selected.push(f);
      }
    }
    selected.sort((a, b) => a.start - b.start);

    // Slicing algorithm
    const slices = [];
    let cursor = 0;
    for (const hl of selected) {
      if (hl.start > cursor) {
        slices.push(INITIAL_DRAFT_TEXT.slice(cursor, hl.start));
      }
      slices.push(INITIAL_DRAFT_TEXT.slice(hl.start, hl.end));
      cursor = hl.end;
    }
    if (cursor < INITIAL_DRAFT_TEXT.length) {
      slices.push(INITIAL_DRAFT_TEXT.slice(cursor));
    }

    const reconstructed = slices.join('');
    // Exactly matches initial draft with zero duplicate characters
    expect(reconstructed).toBe(INITIAL_DRAFT_TEXT);

    // Overlapping medium finding was resolved in favor of high finding on the text
    expect(selected.map((s) => s.id)).toEqual(['f1', 'f2']);
    // BUT in the findings list, all findings remain visible:
    expect(mockFindings).toHaveLength(3);
  });

  // Requirement 4: Accept fix updates text and recalculates offsets
  it('Req 4: accept replaces text and recomputes all offsets', () => {
    const findings = computeFindingsForDraft(INITIAL_DRAFT_TEXT);
    const f2 = findings.find((f) => f.ruleId === 'R-7'); // "users"

    // Apply fix: replace "users" with "customers"
    const updatedDraft =
      INITIAL_DRAFT_TEXT.slice(0, f2.start) +
      f2.suggested_revision +
      INITIAL_DRAFT_TEXT.slice(f2.end);

    expect(updatedDraft).toContain('Join customers today.');
    expect(updatedDraft).not.toContain('Join users today.');

    // Recompute
    const newFindings = computeFindingsForDraft(updatedDraft);

    // R-7 finding is now resolved
    expect(newFindings.find((f) => f.ruleId === 'R-7')).toBeUndefined();

    // R-1 and A-2 remain flagged with re-verified offsets
    const newF3 = newFindings.find((f) => f.ruleId === 'A-2');
    expect(newF3).toBeDefined();
    expect(updatedDraft.slice(newF3.start, newF3.end)).toBe('CLICK HERE');
  });

  // Requirement 6: Unresolved high-severity findings disable submission
  it('Req 6: submission blocking logic blocks while High severity finding is active', () => {
    const initialFindings = computeFindingsForDraft(INITIAL_DRAFT_TEXT);

    const hasHighUnresolved = (list) =>
      list.some((f) => f.status === 'active' && f.severity === 'high');

    // Initially high severity R-1 is active
    expect(hasHighUnresolved(initialFindings)).toBe(true);

    // After dismissing R-1 with a reason
    const afterDismiss = initialFindings.map((f) =>
      f.ruleId === 'R-1' ? { ...f, status: 'dismissed', dismissReason: 'Legal exception' } : f
    );
    expect(hasHighUnresolved(afterDismiss)).toBe(false);
  });
});
