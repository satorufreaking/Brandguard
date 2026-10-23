import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from './index.js';
import { initDatabase } from './db.js';

describe('BrandGuard Backend REST API & Persistence Tests', () => {
  beforeAll(async () => {
    await initDatabase();
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
    const res = await request(app).get('/api/rules');
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
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('R-4');
    expect(res.body.active).toBe(false);

    // Restore
    await request(app).put('/api/rules/R-4').send({ active: true });
  });

  // 3. Approved Facts API
  it('GET /api/facts returns approved facts', async () => {
    const res = await request(app).get('/api/facts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  // 4. Review Run with deterministic checks
  it('POST /api/reviews/run evaluates draft text with exact character offsets', async () => {
    const testDraft =
      "Our software is guaranteed to double every customer's productivity. Join users today. CLICK HERE to learn more.";

    const res = await request(app)
      .post('/api/reviews/run')
      .send({ draftId: 'draft-1', text: testDraft, version: 'v2' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.findings)).toBe(true);
    expect(res.body.findings).toHaveLength(3);

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
      .send({ draftId: 'draft-1', findingId: 'f_a2_86', reason: '' });
    expect(failedRes.status).toBe(400);

    // Successful dismissal with reason
    const successRes = await request(app)
      .post('/api/reviews/dismiss')
      .send({
        draftId: 'draft-1',
        findingId: 'f_a2_86',
        reason: 'Approved legal exception for promotional link',
      });
    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
    expect(successRes.body.dismissReason).toBe('Approved legal exception for promotional link');
  });

  // 6. Accept fix & revision creation
  it('POST /api/reviews/accept creates revision and re-evaluates findings', async () => {
    const originalText =
      "Our software is guaranteed to double every customer's productivity. Join users today. CLICK HERE to learn more.";
    const updatedText =
      "Our software is guaranteed to double every customer's productivity. Join customers today. CLICK HERE to learn more.";

    const res = await request(app)
      .post('/api/reviews/accept')
      .send({
        draftId: 'draft-1',
        findingId: 'f_r7_73',
        ruleId: 'R-7',
        replacement: 'customers',
        newText: updatedText,
        nextVersion: 'v3',
      });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe('v3');
    expect(res.body.draft.currentText).toBe(updatedText);

    // R-7 finding should now be resolved
    const remainingR7 = res.body.findings.find((f) => f.ruleId === 'R-7');
    expect(remainingR7).toBeUndefined();
  });

  // 7. Submission blocking for active high findings
  it('POST /api/reviews/submit blocks submission when high-severity finding is active', async () => {
    const res = await request(app)
      .post('/api/reviews/submit')
      .send({ draftId: 'draft-1', actor: 'Alex Rivera (Creator)' });

    // Since R-1 is active, should return 400
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Submission blocked');
  });

  // 8. Reviewer decision requires mandatory comment
  it('POST /api/reviews/decision requires a comment', async () => {
    const res = await request(app)
      .post('/api/reviews/decision')
      .send({
        draftId: 'draft-1',
        decision: 'Changes requested',
        comment: '',
      });
    expect(res.status).toBe(400);

    const validRes = await request(app)
      .post('/api/reviews/decision')
      .send({
        draftId: 'draft-1',
        decision: 'Changes requested',
        comment: 'Please substantiate 2x claim before approval.',
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.decision).toBe('Changes requested');
  });

  // 9. Queue & Audit Trail retrieval
  it('GET /api/queue and GET /api/audit return populated lists', async () => {
    const queueRes = await request(app).get('/api/queue');
    expect(queueRes.status).toBe(200);
    expect(Array.isArray(queueRes.body)).toBe(true);

    const auditRes = await request(app).get('/api/audit');
    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.body)).toBe(true);
    expect(auditRes.body.length).toBeGreaterThanOrEqual(1);
  });
});
