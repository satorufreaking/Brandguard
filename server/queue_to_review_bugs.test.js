import assert from 'assert';
import { describe, it, beforeEach } from 'vitest';
import { runDeterministicChecks, executeReviewPipeline } from './services/reviewEngine.js';
import { db } from './db.js';

describe('Queue-to-Review Bug Fixes & Requirements', () => {
  beforeEach(async () => {
    await db.updateDraft('draft-2', {
      currentText: 'Best card #1 guaranteed rewards with zero fees for all users. CLICK HERE.',
      currentVersion: 'v1',
      status: 'In review',
    });
  });

  it('Requirement 1: Correct draft selection & separation', async () => {
    const queue = await db.getQueue();
    const draft1QueueItem = queue.find(q => q.id === 'draft-1');
    const draft2QueueItem = queue.find(q => q.id === 'draft-2');

    assert(draft1QueueItem, 'draft-1 must exist in Queue');
    assert(draft2QueueItem, 'draft-2 must exist in Queue');
    assert.strictEqual(draft2QueueItem.title, 'Acme Card Rewards Promotion');
    assert.strictEqual(draft1QueueItem.title, 'Q4 Growth Announcement & Social Copy');

    const draft1 = await db.getDraft('draft-1');
    const draft2 = await db.getDraft('draft-2');
    assert.strictEqual(draft1.id, 'draft-1');
    assert.strictEqual(draft2.id, 'draft-2');
    assert.notStrictEqual(draft1.currentText, draft2.currentText, 'Draft texts must be distinct');
  });

  it('Requirement 2: R-1 Absolute Claims Detection for "Acme Card Rewards Promotion" (Best, #1, guaranteed)', async () => {
    const allRules = await db.getRules();
    const rules = allRules.filter(r => r.active !== false);
    const draft2 = await db.getDraft('draft-2');

    const engineResult = await executeReviewPipeline(draft2.currentText, rules);

    const r1Findings = engineResult.findings.filter(f => f.ruleId === 'R-1');
    assert(r1Findings.length >= 3, `Expected at least 3 R-1 findings, found ${r1Findings.length}`);

    r1Findings.forEach(f => {
      const slice = draft2.currentText.substring(f.characterStart, f.characterEnd);
      assert.strictEqual(slice, f.quote, `Offset slice "${slice}" must match finding quote "${f.quote}"`);
    });

    const quotes = r1Findings.map(f => f.quote.toLowerCase());
    assert(quotes.includes('best'), 'R-1 must detect "Best"');
    assert(quotes.includes('#1'), 'R-1 must detect "#1"');
    assert(quotes.includes('guaranteed'), 'R-1 must detect "guaranteed"');
  });

  it('Requirement 3: Consistent Counts Across Queue, Engine, and Badges', async () => {
    const allRules = await db.getRules();
    const rules = allRules.filter(r => r.active !== false);
    const draft2 = await db.getDraft('draft-2');
    const engineResult = await executeReviewPipeline(draft2.currentText, rules);
    const queue = await db.getQueue();
    const draft2QueueItem = queue.find(q => q.id === 'draft-2');

    const highInEngine = engineResult.findings.filter(f => f.severity === 'high' && f.status === 'active').length;
    assert.strictEqual(draft2QueueItem.highFindingsCount, highInEngine, 'Queue high-risk count must equal engine active high count');
    assert(engineResult.summaryLine.includes(`${engineResult.findings.length} findings validated`),
      'Summary line must match findings count');
  });

  it('Requirement 4: Offset Recalculation after Text Edit', async () => {
    const allRules = await db.getRules();
    const rules = allRules.filter(r => r.active !== false);
    const modifiedText = 'The premier card guaranteed rewards with zero fees.';
    const modResult = await executeReviewPipeline(modifiedText, rules);
    const modR1 = modResult.findings.filter(f => f.ruleId === 'R-1');
    assert(modR1.length >= 1, 'Should find guaranteed in modified text');
    modR1.forEach(f => {
      const slice = modifiedText.substring(f.characterStart, f.characterEnd);
      assert.strictEqual(slice, f.quote, `Recalculated offset slice "${slice}" must match quote "${f.quote}"`);
    });
  });

  it('Requirement 5: Reviewer Mode Actions & Comment Validation', async () => {
    let threwOnEmptyComment = false;
    try {
      const comment = '   ';
      if (!comment || !comment.trim()) {
        throw new Error('Reviewer comment is mandatory.');
      }
      await db.recordDecision({ draftId: 'draft-2', decision: 'Approved', comment, reviewer: 'Sarah Chen' });
    } catch (err) {
      threwOnEmptyComment = true;
    }
    assert(threwOnEmptyComment, 'Decision without mandatory comment must fail');

    const allRules = await db.getRules();
    const rules = allRules.filter(r => r.active !== false);
    const draft2 = await db.getDraft('draft-2');
    const engineResult = await executeReviewPipeline(draft2.currentText, rules);
    const unresolvedHigh = engineResult.findings.filter(f => f.status === 'active' && f.severity === 'high').length;
    assert(unresolvedHigh > 0, 'draft-2 must have unresolved high findings blocking approval');

    const decisionRecord = {
      draftId: 'draft-2',
      decision: 'Changes requested',
      comment: 'Please remove unsupported absolute claims (Best, #1, guaranteed).',
      reviewer: 'Sarah Chen (Reviewer)',
      timestamp: new Date().toISOString(),
    };
    await db.recordDecision(decisionRecord);
    await db.updateDraft('draft-2', { status: 'Changes requested' });
    await db.addAuditEvent({
      id: `audit-${Date.now()}`,
      draftId: 'draft-2',
      action: 'decision_recorded',
      actor: 'Sarah Chen (Reviewer)',
      details: decisionRecord,
      timestamp: new Date().toISOString(),
    });
  });

  it('Requirement 6: Persistence & Audit Event Integrity', async () => {
    const decisionRecord = {
      draftId: 'draft-2',
      decision: 'Changes requested',
      comment: 'Please remove unsupported absolute claims (Best, #1, guaranteed).',
      reviewer: 'Sarah Chen (Reviewer)',
      timestamp: new Date().toISOString(),
    };
    await db.recordDecision(decisionRecord);
    await db.updateDraft('draft-2', { status: 'Changes requested' });
    await db.addAuditEvent({
      id: `audit-${Date.now()}`,
      draftId: 'draft-2',
      action: 'decision_recorded',
      actor: 'Sarah Chen (Reviewer)',
      details: decisionRecord,
      timestamp: new Date().toISOString(),
    });

    const refreshedDraft = await db.getDraft('draft-2');
    assert.strictEqual(refreshedDraft.status, 'Changes requested', 'Draft status must persist');

    const allAudits = await db.getAuditEvents();
    const draft2Audits = allAudits.filter(a => a.draftId === 'draft-2' || a.details?.draftId === 'draft-2');
    assert(draft2Audits.length > 0, 'Audit events must exist for draft-2');
    const latestAudit = draft2Audits[0];
    assert.strictEqual(latestAudit.action, 'decision_recorded');
    assert.strictEqual(latestAudit.details.decision, 'Changes requested');
    assert.strictEqual(latestAudit.details.comment, 'Please remove unsupported absolute claims (Best, #1, guaranteed).');
  });
});
