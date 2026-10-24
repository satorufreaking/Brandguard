import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { router } from './routes/api.js';
import { parseDocumentBuffer } from './services/documentParser.js';
import { getLLMConfig } from './services/llmAdapter.js';

const app = express();
app.use(express.json());
app.use('/api', router);

describe('Step 7: Final BrandGuard AI Requirements Test Suite', () => {
  describe('1. PDF/DOCX Document Upload & Parsing', () => {
    it('successfully extracts text from a plain text buffer', async () => {
      const sampleText = 'Best card guaranteed rewards with zero fees for all customers.';
      const buffer = Buffer.from(sampleText, 'utf-8');
      const result = await parseDocumentBuffer(buffer, 'promo.txt', 'text/plain');

      expect(result.text).toBe(sampleText);
      expect(result.charCount).toBe(sampleText.length);
      expect(result.wordCount).toBe(10);
      expect(result.filename).toBe('promo.txt');
    });

    it('successfully extracts text from a PDF buffer', async () => {
      const pdfString = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>endobj
4 0 obj<</Length 68>>stream
BT
/F1 12 Tf
72 712 Td
(Acme Fintech has the best card in the market.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000192 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
310
%%EOF`;
      const buffer = Buffer.from(pdfString, 'binary');
      const result = await parseDocumentBuffer(buffer, 'test-card.pdf', 'application/pdf');
      expect(result.text).toContain('best card');
      expect(result.filename).toBe('test-card.pdf');
    });

    it('rejects empty uploaded files with descriptive error', async () => {
      const buffer = Buffer.from('');
      await expect(parseDocumentBuffer(buffer, 'empty.txt', 'text/plain')).rejects.toThrow(
        'The uploaded file is empty'
      );
    });

    it('rejects unsupported file extensions safely', async () => {
      const buffer = Buffer.from('console.log("malicious");');
      await expect(parseDocumentBuffer(buffer, 'script.exe', 'application/x-msdownload')).rejects.toThrow(
        'Unsupported file format ".exe"'
      );
    });

    it('rejects files exceeding 10MB limit', async () => {
      const oversizeBuffer = Buffer.alloc(11 * 1024 * 1024, 'a');
      await expect(parseDocumentBuffer(oversizeBuffer, 'huge.pdf', 'application/pdf')).rejects.toThrow(
        'exceeds maximum limit of 10MB'
      );
    });

    it('POST /api/documents/extract uploads document and auto-runs review engine', async () => {
      const sampleContent = 'Our software is guaranteed to double every customer productivity. Join users today. CLICK HERE to learn more.';
      const res = await request(app)
        .post('/api/documents/extract')
        .field('runReview', 'true')
        .field('draftId', 'draft-upload-test')
        .attach('file', Buffer.from(sampleContent, 'utf-8'), 'sample_draft.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.text).toBe(sampleContent);
      expect(res.body.filename).toBe('sample_draft.txt');
      expect(Array.isArray(res.body.findings)).toBe(true);
      expect(res.body.findings.length).toBeGreaterThan(0);
      expect(res.body.summaryLine).toBeDefined();
    });

    it('POST /api/documents/extract uploads PDF document and returns findings', async () => {
      const pdfString = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>endobj
4 0 obj<</Length 110>>stream
BT
/F1 12 Tf
72 712 Td
(Acme Fintech has the best card. Our rewards are guaranteed to double. Join users today. CLICK HERE.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000192 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
350
%%EOF`;
      const res = await request(app)
        .post('/api/documents/extract')
        .field('runReview', 'true')
        .field('draftId', 'draft-pdf-upload-test')
        .attach('file', Buffer.from(pdfString, 'binary'), 'rewards_promo.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.text).toContain('best card');
      expect(res.body.filename).toBe('rewards_promo.pdf');
      expect(Array.isArray(res.body.findings)).toBe(true);
      expect(res.body.findings.length).toBeGreaterThan(0);
    });

    it('POST /api/documents/extract returns 400 when no file is attached', async () => {
      const res = await request(app).post('/api/documents/extract');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No file uploaded');
    });
  });

  describe('2. Live LLM Adapter & Status', () => {
    it('returns honest deterministic mode status when no LLM provider is explicitly enabled', async () => {
      const config = getLLMConfig();
      expect(typeof config.configured).toBe('boolean');
      expect(config.timeoutMs).toBe(12000);

      const res = await request(app).get('/api/llm/status');
      expect(res.status).toBe(200);
      expect(res.body.mode).toBeDefined();
      if (!config.configured) {
        expect(res.body.configured).toBe(false);
        expect(res.body.mode).toContain('Deterministic Mode');
      }
    });
  });

  describe('3. Governance Analytics Calculation', () => {
    it('GET /api/analytics/governance returns calculated metrics from actual persisted reviews', async () => {
      const res = await request(app).get('/api/analytics/governance');
      expect(res.status).toBe(200);

      const data = res.body;
      expect(typeof data.totalDrafts).toBe('number');
      expect(data.totalDrafts).toBeGreaterThanOrEqual(1);
      expect(typeof data.totalViolations).toBe('number');
      expect(typeof data.complianceRate).toBe('number');
      expect(data.complianceRate).toBeGreaterThanOrEqual(0);
      expect(data.complianceRate).toBeLessThanOrEqual(100);

      // Verify severity breakdown
      expect(data.severityBreakdown).toBeDefined();
      expect(typeof data.severityBreakdown.high).toBe('number');
      expect(typeof data.severityBreakdown.medium).toBe('number');
      expect(typeof data.severityBreakdown.low).toBe('number');

      // Verify mostViolatedRules array with calculated percentages
      expect(Array.isArray(data.mostViolatedRules)).toBe(true);
      if (data.mostViolatedRules.length > 0) {
        const topRule = data.mostViolatedRules[0];
        expect(topRule.ruleId).toBeDefined();
        expect(typeof topRule.count).toBe('number');
        expect(typeof topRule.percentage).toBe('number');
        expect(topRule.percentage).toBeGreaterThanOrEqual(0);
        expect(topRule.percentage).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('4. Authentication & Role Permissions', () => {
    it('GET /api/auth/me returns Creator profile with creator permissions by default', async () => {
      const res = await request(app).get('/api/auth/me?role=creator');
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('creator');
      expect(res.body.user.permissions).toContain('draft:submit');
      expect(res.body.user.permissions).toContain('document:upload');
    });

    it('GET /api/auth/me returns Reviewer profile with reviewer permissions', async () => {
      const res = await request(app).get('/api/auth/me?role=reviewer');
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('reviewer');
      expect(res.body.user.permissions).toContain('review:approve');
      expect(res.body.user.permissions).toContain('review:reject');
    });

    it('POST /api/auth/switch-role validates requested role and switches user', async () => {
      const resValid = await request(app)
        .post('/api/auth/switch-role')
        .send({ role: 'reviewer' });
      expect(resValid.status).toBe(200);
      expect(resValid.body.success).toBe(true);
      expect(resValid.body.user.role).toBe('reviewer');

      const resInvalid = await request(app)
        .post('/api/auth/switch-role')
        .send({ role: 'superhacker' });
      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.error).toContain('Invalid role');
    });
  });
});
