import { randomUUID } from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from './index.js';
import { db, initDatabase } from './db.js';

const creator = (method, path) => request(app)[method](path).set('x-brandguard-role', 'creator');

async function createDraft(text = 'Clear, truthful content for review.') {
  const response = await creator('post', '/api/drafts')
    .send({ title: `Regression ${randomUUID()}`, text });
  expect(response.status).toBe(201);
  return response.body.draft;
}

describe('Draft workflow regressions', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  it('requires a fresh review after editing approved content', async () => {
    const draft = await createDraft('Approved copy is unchanged.');
    await db.updateDraft(draft.id, { status: 'Approved' });

    const response = await creator('put', `/api/drafts/${draft.id}`).send({
      title: draft.title,
      text: 'Approved copy has been edited.',
      expectedVersion: 'v1',
    });

    expect(response.status).toBe(200);
    expect(response.body.draft.status).toBe('Draft');
    expect(response.body.draft.currentVersion).toBe('v2');
    expect(response.body.draft.currentText).toBe('Approved copy has been edited.');
    expect(response.body.draft.revisions.map((revision) => revision.version)).toContain('v2');
  });

  it('preserves dismissal and justification on an unchanged rescan, then restores it', async () => {
    const text = 'Our offer is 100% effective.';
    const draft = await createDraft(text);
    const scan = await creator('post', '/api/reviews/run').send({
      draftId: draft.id, text, version: 'v1',
    });
    expect(scan.status).toBe(200);
    const finding = scan.body.findings.find((item) => item.ruleId === 'R-1');

    const dismissed = await creator('post', '/api/reviews/dismiss').send({
      draftId: draft.id, findingId: finding.id, reason: 'Evidence was reviewed for this campaign.',
    });
    expect(dismissed.status).toBe(200);

    const rescanned = await creator('post', '/api/reviews/run').send({
      draftId: draft.id, text, version: 'v1',
    });
    expect(rescanned.body.findings.find((item) => item.id === finding.id)).toMatchObject({
      status: 'dismissed',
      dismissReason: 'Evidence was reviewed for this campaign.',
    });

    const restored = await creator('post', '/api/reviews/restore').send({
      draftId: draft.id, findingId: finding.id,
    });
    expect(restored.status).toBe(200);
    expect(restored.body.findings.find((item) => item.id === finding.id).status).toBe('active');
  });

  it('invalidates a dismissal on a new content revision and rejects stale saves', async () => {
    const originalText = 'Our offer is 100% effective.';
    const draft = await createDraft(originalText);
    const scan = await creator('post', '/api/reviews/run').send({
      draftId: draft.id, text: originalText, version: 'v1',
    });
    const finding = scan.body.findings.find((item) => item.ruleId === 'R-1');
    await creator('post', '/api/reviews/dismiss').send({
      draftId: draft.id, findingId: finding.id, reason: 'Reviewed evidence.',
    });

    const editedText = `${originalText} Updated.`;
    const saved = await creator('put', `/api/drafts/${draft.id}`).send({
      title: draft.title, text: editedText, expectedVersion: 'v1',
    });
    expect(saved.status).toBe(200);
    const staleSave = await creator('put', `/api/drafts/${draft.id}`).send({
      title: draft.title, text: 'Stale edit.', expectedVersion: 'v1',
    });
    expect(staleSave.status).toBe(409);

    const rescanned = await creator('post', '/api/reviews/run').send({
      draftId: draft.id, text: editedText, version: 'v2',
    });
    expect(rescanned.body.findings.find((item) => item.ruleId === 'R-1').status).toBe('active');
  });

  it('prevents duplicate submissions and enforces Creator-only workflow mutations', async () => {
    const draft = await createDraft('Clear and accurate content.');
    const firstSubmit = await creator('post', '/api/reviews/submit').send({ draftId: draft.id });
    expect(firstSubmit.status).toBe(200);
    expect(firstSubmit.body.status).toBe('In review');

    const duplicateSubmit = await creator('post', '/api/reviews/submit').send({ draftId: draft.id });
    expect(duplicateSubmit.status).toBe(409);

    const unauthorized = await request(app)
      .post('/api/reviews/submit')
      .set('x-brandguard-role', 'reviewer')
      .send({ draftId: draft.id });
    expect(unauthorized.status).toBe(403);
  });

  it('rejects empty or whitespace-only drafts at submission', async () => {
    const draft = await createDraft('   \n\t  ');
    const response = await creator('post', '/api/reviews/submit').send({ draftId: draft.id });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Draft content is required');
  });

  it('allows only one concurrent save for a draft version', async () => {
    const draft = await createDraft('Original valid content.');
    const saves = await Promise.all([
      creator('put', `/api/drafts/${draft.id}`).send({
        title: draft.title, text: 'First competing edit.', expectedVersion: 'v1',
      }),
      creator('put', `/api/drafts/${draft.id}`).send({
        title: draft.title, text: 'Second competing edit.', expectedVersion: 'v1',
      }),
    ]);
    expect(saves.map((response) => response.status).sort()).toEqual([200, 409]);
  });

  it('allows only one concurrent submission transition', async () => {
    const draft = await createDraft('Clear content for a single review submission.');
    const submissions = await Promise.all([
      creator('post', '/api/reviews/submit').send({ draftId: draft.id }),
      creator('post', '/api/reviews/submit').send({ draftId: draft.id }),
    ]);
    expect(submissions.map((response) => response.status).sort()).toEqual([200, 409]);
  });

  it('returns 404 for missing drafts and invalid current finding IDs', async () => {
    const missingDraft = await creator('put', '/api/drafts/not-a-real-draft').send({
      title: 'Missing', text: 'No content', expectedVersion: 'v1',
    });
    expect(missingDraft.status).toBe(404);

    const draft = await createDraft('Plain content.');
    const missingFinding = await creator('post', '/api/reviews/restore').send({
      draftId: draft.id, findingId: 'not-a-finding',
    });
    expect(missingFinding.status).toBe(404);
  });
});
