import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from './index.js';
import { initDatabase, db } from './db.js';

describe('BrandGuard Backend REST API & Persistence Tests', () => {
  const workflowDraftId = 'draft-server-regression';
  const decisionDraftId = 'draft-server-decision';
  const testDraft = "Our software is guaranteed to double every customer's productivity. Join users today. CLICK HERE to learn more.";
  let testFindings = [];

  beforeAll(async () => {
    await initDatabase();
    await db.createDraft({
      id: workflowDraftId, title: 'Server API regression draft', submitter: 'Alex Rivera (Creator)',
      status: 'Draft', currentVersion: 'v1', currentText: testDraft,
      revisions: [{ version: 'v1', text: testDraft }],
    });
    await db.createDraft({
      id: decisionDraftId, title: 'Decision regression draft', submitter: 'Alex Rivera (Creator)',
      status: 'In review', currentVersion: 'v1', currentText: 'Clear, review-ready content.',
      revisions: [{ version: 'v1', text: 'Clear, review-ready content.' }],
    });
  });

  // 1. Health check & DB mode
  it('GET /api/health returns 200 OK and database mode', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBeDefined();
  });

  // 2. Rules retrieval & category filter
  it('GET /api/rules returns seeded brand rules', async () => {
    const res = await request(app).get('/api/rules').set('x-brandguard-role', 'creator');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);

    const r1 = res.body.find((r) => r.id === 'R-1');
    expect(r1).toBeDefined();
    expect(r1.severity).toBe('high');
  });

  it('PUT /api/rules/:id updates rule active status', async () => {
    const res = await request(app)
      .put('/api/rules/R-4')
      .set('x-brandguard-role', 'admin')
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('R-4');
    expect(res.body.active).toBe(false);

    // Restore
    await request(app).put('/api/rules/R-4').set('x-brandguard-role', 'admin').send({ active: true });
  });

  // 3. Approved Facts API
  it('GET /api/facts returns approved facts', async () => {
    const res = await request(app).get('/api/facts').set('x-brandguard-role', 'creator');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  // 4. Review Run with deterministic checks
  it('POST /api/reviews/run evaluates draft text with exact character offsets', async () => {
    const res = await request(app)
      .post('/api/reviews/run')
      .set('x-brandguard-role', 'creator')
      .send({ draftId: workflowDraftId, text: testDraft, version: 'v1' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.findings)).toBe(true);
    expect(res.body.findings).toHaveLength(3);
    testFindings = res.body.findings;

    const f1 = res.body.findings.find((f) => f.ruleId === 'R-1');
    expect(f1).toBeDefined();
    expect(f1.quoted_text).toBe('guaranteed to double');
    expect(f1.start).toBe(16);
    expect(f1.end).toBe(36);
    expect(testDraft.slice(f1.start, f1.end)).toBe(f1.quoted_text);
  });

  // 5. Dismiss with mandatory reason
  it('POST /api/reviews/dismiss requires a mandatory reason', async () => {
    // Attempt dismissal without reason
    const failedRes = await request(app)
      .post('/api/reviews/dismiss')
      .set('x-brandguard-role', 'creator')
      .send({ draftId: workflowDraftId, findingId: testFindings.find((finding) => finding.ruleId === 'A-2').id, reason: '' });
    expect(failedRes.status).toBe(400);

    // Successful dismissal with reason
    const successRes = await request(app)
      .post('/api/reviews/dismiss')
      .set('x-brandguard-role', 'creator')
      .send({
        draftId: workflowDraftId,
        findingId: testFindings.find((finding) => finding.ruleId === 'A-2').id,
        reason: 'Approved legal exception for promotional link',
      });
    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
    expect(successRes.body.dismissReason).toBe('Approved legal exception for promotional link');
  });

  // 6. Accept fix & revision creation
  it('POST /api/reviews/accept creates revision and re-evaluates findings', async () => {
    const updatedText =
      "Our software is guaranteed to double every customer's productivity. Join customers today. CLICK HERE to learn more.";

    const res = await request(app)
      .post('/api/reviews/accept')
      .set('x-brandguard-role', 'creator')
      .send({
        draftId: workflowDraftId,
        findingId: testFindings.find((finding) => finding.ruleId === 'R-7').id,
        expectedVersion: 'v1',
        newText: updatedText,
      });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe('v2');
    expect(res.body.draft.currentText).toBe(updatedText);

    // R-7 finding should now be resolved
    const remainingR7 = res.body.findings.find((f) => f.ruleId === 'R-7');
    expect(remainingR7).toBeUndefined();
  });

  // 7. Submission blocking for active high findings
  it('POST /api/reviews/submit blocks submission when high-severity finding is active', async () => {
    const res = await request(app)
      .post('/api/reviews/submit')
      .set('x-brandguard-role', 'creator')
      .send({ draftId: workflowDraftId });

    // Since R-1 is active, should return 400
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Submission blocked');
  });

  // 8. Reviewer decision requires mandatory comment
  it('POST /api/reviews/decision requires a comment', async () => {
    const res = await request(app)
      .post('/api/reviews/decision')
      .set('x-brandguard-role', 'reviewer')
      .send({
        draftId: decisionDraftId,
        decision: 'Changes requested',
        comment: '',
      });
    expect(res.status).toBe(400);

    const validRes = await request(app)
      .post('/api/reviews/decision')
      .set('x-brandguard-role', 'reviewer')
      .send({
        draftId: decisionDraftId,
        decision: 'Changes requested',
        comment: 'Please substantiate 2x claim before approval.',
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.decision).toBe('Changes requested');
  });

  // 9. Queue & Audit Trail retrieval
  it('GET /api/queue and GET /api/audit return populated lists', async () => {
    const queueRes = await request(app).get('/api/queue').set('x-brandguard-role', 'creator');
    expect(queueRes.status).toBe(200);
    expect(Array.isArray(queueRes.body)).toBe(true);

    const auditRes = await request(app).get('/api/audit').set('x-brandguard-role', 'creator');
    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.body)).toBe(true);
    expect(auditRes.body.length).toBeGreaterThanOrEqual(1);
  });

  it('denies Creator access to Admin rule mutation', async () => {
    const res = await request(app)
      .put('/api/rules/R-4')
      .set('x-brandguard-role', 'creator')
      .send({ active: false });
    expect(res.status).toBe(403);
  });

  it('validates and audits approved fact creation, update, duplicate and deletion', async () => {
    const fact = {
      subject: `QA fact ${Date.now()}`,
      value: 'Verified prototype test metric.',
      source: 'QA regression fixture',
      validUntil: '2099-12-31',
    };
    const created = await request(app).post('/api/facts').set('x-brandguard-role', 'admin').send(fact);
    expect(created.status).toBe(201);

    const invalidUpdate = await request(app)
      .put(`/api/facts/${created.body.id}`)
      .set('x-brandguard-role', 'admin')
      .send({ validUntil: '2099-02-31' });
    expect(invalidUpdate.status).toBe(400);

    const updated = await request(app)
      .put(`/api/facts/${created.body.id}`)
      .set('x-brandguard-role', 'admin')
      .send({ source: 'QA validated source reference' });
    expect(updated.status).toBe(200);
    expect(updated.body.source).toBe('QA validated source reference');

    const duplicate = await request(app).post('/api/facts').set('x-brandguard-role', 'admin').send(fact);
    expect(duplicate.status).toBe(409);

    const removed = await request(app).delete(`/api/facts/${created.body.id}`).set('x-brandguard-role', 'admin');
    expect(removed.status).toBe(200);
    const missing = await request(app).delete(`/api/facts/${created.body.id}`).set('x-brandguard-role', 'admin');
    expect(missing.status).toBe(404);
  });

  it('returns JSON 400 for malformed JSON without entering a route handler', async () => {
    const res = await request(app)
      .post('/api/reviews/run')
      .set('Content-Type', 'application/json')
      .send('{"draftId":');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Malformed JSON request body.');
  });

  it('returns 413 for oversized uploads and 400 for mismatched extension and MIME type', async () => {
    const oversized = await request(app)
      .post('/api/documents/extract')
      .set('x-brandguard-role', 'creator')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1, 'a'), 'oversized.txt');
    expect(oversized.status).toBe(413);
    expect(oversized.body.error).toContain('10MB');

    const mismatched = await request(app)
      .post('/api/documents/extract')
      .set('x-brandguard-role', 'creator')
      .attach('file', Buffer.from('plain text'), { filename: 'not-a-pdf.pdf', contentType: 'text/plain' });
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.error).toContain('does not match');
  });
});
