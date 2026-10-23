import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from './index.js';
import { initDatabase, db } from './db.js';
import { executeReviewPipeline, runDeterministicChecks } from './services/reviewEngine.js';

describe('Step 6: End-to-End Workflow & Negative Edge Case Verification', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  // --- WORKFLOW SEQUENCE ---
  describe('Complete End-to-End Workflow Sequence', () => {
    const workflowDraftId = 'draft-step6-workflow';
    const initialText =
      "Our software is guaranteed to double every customer's productivity. Join users today. CLICK HERE to learn more.";

    it('Step 1: Configure brand rules (toggle rule active status)', async () => {
      // Toggle R-4 inactive
      const disableRes = await request(app)
        .put('/api/rules/R-4')
        .send({ active: false });
      expect(disableRes.status).toBe(200);
      expect(disableRes.body.active).toBe(false);

      // Verify audit trail logged rule update
      const auditRes = await request(app).get('/api/audit');
      const latestAudit = auditRes.body[0];
      expect(latestAudit.action).toBe('Updated rule');

      // Re-enable R-4
      const enableRes = await request(app)
        .put('/api/rules/R-4')
        .send({ active: true });
      expect(enableRes.status).toBe(200);
      expect(enableRes.body.active).toBe(true);
    });

    it('Step 2: Initialize draft and run review to identify findings', async () => {
      // Seed draft
      await db.updateDraft(workflowDraftId, {
        id: workflowDraftId,
        title: 'Step 6 Workflow Draft',
        currentText: initialText,
        currentVersion: 'v1',
        status: 'Draft',
        revisions: [{ version: 'v1', text: initialText, author: 'Alex Rivera' }],
      });

      const res = await request(app)
        .post('/api/reviews/run')
        .send({ draftId: workflowDraftId, text: initialText, version: 'v1' });

      expect(res.status).toBe(200);
      expect(res.body.findings.length).toBe(3);

      const ruleIds = res.body.findings.map((f) => f.ruleId);
      expect(ruleIds).toContain('R-1'); // High severity
      expect(ruleIds).toContain('R-7'); // Medium severity
      expect(ruleIds).toContain('A-2'); // Low severity
    });

    it('Step 3: Unresolved high-severity finding blocks submission to In Review', async () => {
      const res = await request(app)
        .post('/api/reviews/submit')
        .send({ draftId: workflowDraftId, actor: 'Alex Rivera (Creator)' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Submission blocked');
    });

    it('Step 4: Accept correction on finding R-7 and save revision v2', async () => {
      const textV2 =
        "Our software is guaranteed to double every customer's productivity. Join customers today. CLICK HERE to learn more.";

      const acceptRes = await request(app)
        .post('/api/reviews/accept')
        .send({
          draftId: workflowDraftId,
          findingId: 'f_r7_73',
          ruleId: 'R-7',
          replacement: 'customers',
          newText: textV2,
          nextVersion: 'v2',
        });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.version).toBe('v2');
      expect(acceptRes.body.draft.currentText).toBe(textV2);

      // R-7 finding should be resolved, R-1 and A-2 remain
      const remainingRuleIds = acceptRes.body.findings.map((f) => f.ruleId);
      expect(remainingRuleIds).not.toContain('R-7');
      expect(remainingRuleIds).toContain('R-1');
    });

    it('Step 5: Dismiss high-severity finding R-1 with required justification reason', async () => {
      const dismissRes = await request(app)
        .post('/api/reviews/dismiss')
        .send({
          draftId: workflowDraftId,
          findingId: 'f_r1_16',
          reason: 'Legal and Risk Committee pre-approved this specific productivity guarantee for pilot customers.',
        });

      expect(dismissRes.status).toBe(200);
      expect(dismissRes.body.success).toBe(true);
      expect(dismissRes.body.dismissReason).toContain('Legal and Risk Committee');
    });

    it('Step 6: Request approval (submit draft) successfully after high-severity resolution', async () => {
      const submitRes = await request(app)
        .post('/api/reviews/submit')
        .send({ draftId: workflowDraftId, actor: 'Alex Rivera (Creator)' });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.status).toBe('In review');
    });

    it('Step 7: Reviewer evaluates and records decision (Approved) with mandatory comment', async () => {
      const decideRes = await request(app)
        .post('/api/reviews/decision')
        .send({
          draftId: workflowDraftId,
          decision: 'Approved',
          comment: 'Approved based on Legal Committee justification for pilot release.',
          reviewer: 'Sarah Chen (Reviewer)',
        });

      expect(decideRes.status).toBe(200);
      expect(decideRes.body.decision).toBe('Approved');
      expect(decideRes.body.draft.status).toBe('Approved');
    });

    it('Step 8: Inspect audit history to confirm complete chronological trace', async () => {
      const auditRes = await request(app).get('/api/audit');
      expect(auditRes.status).toBe(200);

      const events = auditRes.body;
      const actions = events.map((e) => e.action);

      expect(actions).toContain('Updated rule');
      expect(actions).toContain('Saved revision');
      expect(actions).toContain('Dismissed finding');
      expect(actions).toContain('Submitted draft');
      expect(actions.some((a) => a.includes('Recorded decision'))).toBe(true);
    });
  });

  // --- EDGE CASES & FAILURE MODES ---
  describe('Input Validation & Resilience Edge Cases', () => {
    it('Rejects non-existent Rule ID with 404', async () => {
      const res = await request(app)
        .put('/api/rules/NON-EXISTENT-RULE-999')
        .send({ active: false });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('Rejects review run with invalid/missing text payload', async () => {
      const res = await request(app)
        .post('/api/reviews/run')
        .send({ draftId: 'draft-1', text: 12345 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Draft text must be a string');
    });

    it('Rejects finding dismissal with empty or whitespace-only reason', async () => {
      const whitespaceRes = await request(app)
        .post('/api/reviews/dismiss')
        .send({ draftId: 'draft-1', findingId: 'f_test', reason: '    ' });
      expect(whitespaceRes.status).toBe(400);
      expect(whitespaceRes.body.error).toContain('Mandatory justification reason is required');

      const nullRes = await request(app)
        .post('/api/reviews/dismiss')
        .send({ draftId: 'draft-1', findingId: 'f_test', reason: null });
      expect(nullRes.status).toBe(400);
    });

    it('Rejects reviewer decision with invalid decision enum', async () => {
      const res = await request(app)
        .post('/api/reviews/decision')
        .send({
          draftId: 'draft-1',
          decision: 'MaybeApproved',
          comment: 'Valid comment',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Decision must be one of');
    });

    it('Rejects reviewer decision without mandatory comment', async () => {
      const res = await request(app)
        .post('/api/reviews/decision')
        .send({
          draftId: 'draft-1',
          decision: 'Rejected',
          comment: '',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('reviewer comment is mandatory');
    });

    it('Rejects new fact creation with missing required fields', async () => {
      const res = await request(app)
        .post('/api/facts')
        .send({ subject: 'Active Users' }); // Missing value, source, validUntil
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('All fact fields');
    });

    it('Handles non-existent draft gracefully in submit endpoint', async () => {
      const res = await request(app)
        .post('/api/reviews/submit')
        .send({ draftId: 'non-existent-draft-id-xyz' });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Draft not found');
    });

    it('Missing AI credentials triggers deterministic fallback without fabricating findings', async () => {
      // executeReviewPipeline should run deterministic checks cleanly even if no LLM API keys exist
      const activeRules = await db.getRules();
      const text = 'Our software is guaranteed to double every customer productivity.';

      const result = await executeReviewPipeline(text, activeRules);
      expect(result).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.findings.length).toBeGreaterThanOrEqual(1);

      // Verify findings come only from rules, not fabricated AI text
      const ruleFinding = result.findings.find((f) => f.ruleId === 'R-1');
      expect(ruleFinding).toBeDefined();
      expect(ruleFinding.evidence_status).toBe('not_enough_information');
      expect(ruleFinding.quoted_text).toBe('guaranteed to double');
    });
  });
});
