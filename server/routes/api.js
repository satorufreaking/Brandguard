import express from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { executeReviewPipeline, runDeterministicChecks } from '../services/reviewEngine.js';
import { parseDocumentBuffer } from '../services/documentParser.js';
import { getLLMConfig } from '../services/llmAdapter.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

export const router = express.Router();

// Health Check & DB mode
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: db.getMode(),
    timestamp: new Date().toISOString(),
  });
});

// --- RULES API ---
// Retrieve all rules (optional category filter)
router.get('/rules', async (req, res) => {
  try {
    const { category } = req.query;
    const rules = await db.getRules(category);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch brand rules', message: err.message });
  }
});

// Update a rule (e.g. toggle active, edit text/severity)
router.put('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await db.updateRule(id, updates);
    if (!updated) {
      return res.status(404).json({ error: `Rule ${id} not found` });
    }

    // Record audit event for rule alteration
    await db.addAuditEvent({
      id: `audit_rule_${Date.now()}`,
      actor: 'Marcus Brody (Admin)',
      action: 'Updated rule',
      from: `${id} ${updated.version || 'v1.0'}`,
      to: `${id} ${updated.version || 'v1.0'} (Active: ${updated.active})`,
      comment: `Rule configuration modified via admin workspace API.`,
      time: 'Just now',
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update rule', message: err.message });
  }
});

// --- APPROVED FACTS API ---
router.get('/facts', async (req, res) => {
  try {
    const facts = await db.getFacts();
    res.json(facts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch approved facts', message: err.message });
  }
});

router.post('/facts', async (req, res) => {
  try {
    const { subject, value, source, validUntil } = req.body;
    if (!subject || !value || !source || !validUntil) {
      return res.status(400).json({ error: 'All fact fields (subject, value, source, validUntil) are required.' });
    }

    const id = `fact-${Date.now()}`;
    const newFact = await db.createFact({ id, subject, value, source, validUntil });

    await db.addAuditEvent({
      id: `audit_fact_${Date.now()}`,
      actor: 'Compliance Officer',
      action: 'Added approved fact',
      from: 'Unverified',
      to: 'Approved',
      comment: `Added factual empirical reference: ${subject}`,
      time: 'Just now',
    });

    res.status(201).json(newFact);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create approved fact', message: err.message });
  }
});

// --- REVIEWS & DRAFTS API ---
// Retrieve active draft & its current findings
router.get('/reviews/current', async (req, res) => {
  try {
    const draftId = req.query.draftId || 'draft-1';
    let draft = await db.getDraft(draftId);

    if (!draft) {
      draft = await db.getDraft('draft-1');
    }

    const activeRules = await db.getRules();
    const existingFindings = await db.getFindings(draft.id, draft.currentVersion);

    // Re-evaluate review findings against draft text and active rules
    const reviewResult = await executeReviewPipeline(draft.currentText, activeRules);

    // Preserve any existing dismissals and justifications for matching findings
    const dismissedMap = new Map(
      (existingFindings || [])
        .filter((f) => f.status === 'dismissed')
        .map((f) => [`${f.ruleId}:${f.quoted_text}`, f.dismissReason])
    );

    const mergedFindings = reviewResult.findings.map((f) => {
      const key = `${f.ruleId}:${f.quoted_text}`;
      if (dismissedMap.has(key)) {
        return {
          ...f,
          status: 'dismissed',
          dismissReason: dismissedMap.get(key),
        };
      }
      return f;
    });

    const findings = await db.saveFindings(draft.id, draft.currentVersion, mergedFindings);

    res.json({
      draft,
      findings,
      rules: activeRules,
      meta: reviewResult.meta,
      summaryLine: reviewResult.summaryLine,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load review workspace', message: err.message });
  }
});

// Run a review check on given text
router.post('/reviews/run', async (req, res) => {
  try {
    const { draftId = 'draft-1', text, version = 'v2' } = req.body;
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'Draft text must be a string' });
    }

    const activeRules = await db.getRules();
    const result = await executeReviewPipeline(text, activeRules);

    // Save evaluated findings to database
    const saved = await db.saveFindings(draftId, version, result.findings);

    res.json({
      draftText: text,
      findings: saved,
      meta: result.meta,
      summaryLine: result.summaryLine,
    });
  } catch (err) {
    res.status(500).json({ error: 'Review pipeline failure', message: err.message });
  }
});

// Accept a suggested fix
router.post('/reviews/accept', async (req, res) => {
  try {
    const { draftId = 'draft-1', findingId, ruleId, replacement, newText, nextVersion } = req.body;

    if (!newText || typeof newText !== 'string') {
      return res.status(400).json({ error: 'newText string is required' });
    }

    const draft = await db.getDraft(draftId);
    const oldVersion = draft ? draft.currentVersion : 'v2';
    const computedNextVer = nextVersion || `v${parseInt(oldVersion.replace('v', '') || '2', 10) + 1}`;

    // Add revision to database
    const updatedDraft = await db.addRevision(draftId, {
      version: computedNextVer,
      text: newText,
      note: `Applied suggested correction for rule ${ruleId || 'N/A'}`,
      fixedRule: ruleId,
      createdAt: new Date(),
    });

    // Re-run review checks on the new text and update findings in DB
    const activeRules = await db.getRules();
    const reviewResult = await executeReviewPipeline(newText, activeRules);

    // Preserve dismissals for unchanged findings
    const prevFindings = await db.getFindings(draftId, oldVersion);
    const dismissedMap = new Map(
      (prevFindings || [])
        .filter((f) => f.status === 'dismissed')
        .map((f) => [`${f.ruleId}:${f.quoted_text}`, f.dismissReason])
    );

    const mergedFindings = reviewResult.findings.map((f) => {
      const key = `${f.ruleId}:${f.quoted_text}`;
      if (dismissedMap.has(key)) {
        return {
          ...f,
          status: 'dismissed',
          dismissReason: dismissedMap.get(key),
        };
      }
      return f;
    });

    const savedFindings = await db.saveFindings(draftId, computedNextVer, mergedFindings);

    // Record audit event
    await db.addAuditEvent({
      id: `audit_accept_${Date.now()}`,
      draftId,
      actor: 'Alex Rivera (Creator)',
      action: 'Saved revision',
      from: oldVersion,
      to: computedNextVer,
      comment: `Applied suggested fix for rule ${ruleId}: '${replacement}'`,
      time: 'Just now',
    });

    res.json({
      draft: updatedDraft,
      findings: savedFindings,
      version: computedNextVer,
      meta: reviewResult.meta,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept correction', message: err.message });
  }
});

// Dismiss a finding with mandatory justification reason
router.post('/reviews/dismiss', async (req, res) => {
  try {
    const { draftId = 'draft-1', findingId, reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Mandatory justification reason is required to dismiss a brand finding.',
      });
    }

    const updated = await db.updateFinding(draftId, findingId, {
      status: 'dismissed',
      dismissReason: reason.trim(),
    });

    // Record audit event
    await db.addAuditEvent({
      id: `audit_dismiss_${Date.now()}`,
      draftId,
      actor: 'Alex Rivera (Creator)',
      action: 'Dismissed finding',
      from: 'active',
      to: 'dismissed',
      comment: `Finding ${findingId} bypassed on ${draftId} with justification: "${reason.trim()}"`,
      time: 'Just now',
    });

    res.json({
      success: true,
      findingId,
      dismissReason: reason.trim(),
      updated,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss finding', message: err.message });
  }
});

// Submit draft for approval
router.post('/reviews/submit', async (req, res) => {
  try {
    const { draftId = 'draft-1', actor = 'Alex Rivera (Creator)' } = req.body;

    const draft = await db.getDraft(draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });

    // Enforce business rule: cannot submit if high-severity findings are active
    const findings = await db.getFindings(draftId, draft.currentVersion);
    const activeHighCount = findings.filter((f) => f.status === 'active' && f.severity === 'high').length;

    if (activeHighCount > 0) {
      return res.status(400).json({
        error: `Submission blocked: ${activeHighCount} unresolved high-severity finding(s) must be accepted or dismissed before submission.`,
      });
    }

    const updated = await db.updateDraft(draftId, { status: 'In review' });

    await db.addAuditEvent({
      id: `audit_submit_${Date.now()}`,
      draftId,
      actor,
      action: 'Submitted draft',
      from: draft.status,
      to: 'In review',
      comment: `Submitted revision ${draft.currentVersion} for compliance approval.`,
      time: 'Just now',
    });

    res.json({
      success: true,
      status: 'In review',
      draft: updated,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit draft', message: err.message });
  }
});

// Record reviewer decision (Approve / Request changes / Reject)
router.post('/reviews/decision', async (req, res) => {
  try {
    const { draftId = 'draft-1', decision, comment, reviewer = 'Sarah Chen (Reviewer)' } = req.body;

    if (!decision || !['Approved', 'Changes requested', 'Rejected'].includes(decision)) {
      return res.status(400).json({ error: "Decision must be one of 'Approved', 'Changes requested', 'Rejected'" });
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ error: 'A reviewer comment is mandatory for all compliance decisions.' });
    }

    const draft = await db.getDraft(draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });

    // If approving, high severity findings must not be active
    if (decision === 'Approved') {
      const findings = await db.getFindings(draftId, draft.currentVersion);
      const activeHigh = findings.filter((f) => f.status === 'active' && f.severity === 'high').length;
      if (activeHigh > 0) {
        return res.status(400).json({
          error: `Cannot approve draft with ${activeHigh} active high-severity policy violation(s).`,
        });
      }
    }

    // Save decision
    await db.recordDecision({
      id: `dec_${Date.now()}`,
      draftId,
      reviewer,
      decision,
      comment: comment.trim(),
      version: draft.currentVersion,
    });

    // Update draft status
    const updatedDraft = await db.updateDraft(draftId, { status: decision });

    // Append to immutable audit log
    await db.addAuditEvent({
      id: `audit_decision_${Date.now()}`,
      draftId,
      actor: reviewer,
      action: `Recorded decision (${decision})`,
      from: draft.status,
      to: decision,
      comment: comment.trim(),
      time: 'Just now',
    });

    res.json({
      success: true,
      decision,
      comment: comment.trim(),
      draft: updatedDraft,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record decision', message: err.message });
  }
});

// --- QUEUE API ---
router.get('/queue', async (req, res) => {
  try {
    const queue = await db.getQueue();
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch review queue', message: err.message });
  }
});

// --- AUDIT TRAIL API ---
router.get('/audit', async (req, res) => {
  try {
    const events = await db.getAuditEvents();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit events', message: err.message });
  }
});

// --- DOCUMENT PARSING & UPLOAD API ---
router.post('/documents/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded. Please upload a PDF (.pdf), Word document (.docx), or Text file (.txt).',
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    const parsed = await parseDocumentBuffer(buffer, originalname, mimetype);

    // Record audit event for document ingestion
    await db.addAuditEvent({
      id: `audit_upload_${Date.now()}`,
      draftId: req.body.draftId || 'new-upload',
      actor: req.body.actor || 'Alex Rivera (Creator)',
      action: 'Uploaded document draft',
      from: 'Local file',
      to: `${originalname} (${(size / 1024).toFixed(1)} KB)`,
      comment: `Extracted ${parsed.wordCount} words (${parsed.charCount} chars) from ${originalname}`,
      time: 'Just now',
    });

    let reviewResult = null;
    if (req.body.runReview === 'true') {
      const activeRules = await db.getRules();
      reviewResult = await executeReviewPipeline(parsed.text, activeRules);
    }

    res.json({
      success: true,
      text: parsed.text,
      filename: parsed.filename,
      charCount: parsed.charCount,
      wordCount: parsed.wordCount,
      findings: reviewResult ? reviewResult.findings : null,
      summaryLine: reviewResult ? reviewResult.summaryLine : null,
      meta: reviewResult ? reviewResult.meta : null,
    });
  } catch (err) {
    console.warn('[BrandGuard Document Upload Error]:', err.message);
    res.status(400).json({
      error: err.message || 'Failed to process and extract text from uploaded document.',
    });
  }
});

// --- GOVERNANCE ANALYTICS API ---
router.get('/analytics/governance', async (req, res) => {
  try {
    const analytics = await db.getGovernanceAnalytics();
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate governance analytics', message: err.message });
  }
});

// --- LLM PROVIDER STATUS API ---
router.get('/llm/status', (req, res) => {
  const config = getLLMConfig();
  res.json({
    configured: config.configured,
    provider: config.provider,
    model: config.model,
    apiKeyMasked: config.apiKeyMasked,
    mode: config.configured ? `Live Semantic (${config.provider})` : 'Deterministic Mode (No LLM API key configured)',
  });
});

// --- AUTHENTICATION & DEMO ROLES API ---
const USER_PROFILES = {
  creator: {
    id: 'user-creator',
    name: 'Alex Rivera',
    email: 'alex@brandguard.internal',
    role: 'creator',
    department: 'Marketing & Brand Content',
    permissions: ['draft:create', 'draft:edit', 'draft:submit', 'document:upload'],
  },
  reviewer: {
    id: 'user-reviewer',
    name: 'Sarah Chen',
    email: 'sarah@brandguard.internal',
    role: 'reviewer',
    department: 'Brand Compliance & Regulatory',
    permissions: ['review:approve', 'review:reject', 'review:request_changes', 'audit:view'],
  },
  admin: {
    id: 'user-admin',
    name: 'Marcus Brody',
    email: 'admin@brandguard.internal',
    role: 'admin',
    department: 'Legal & Risk Policy',
    permissions: ['rules:edit', 'facts:add', 'governance:manage', 'all'],
  },
};

router.get('/auth/me', (req, res) => {
  const role = req.query.role || req.headers['x-brandguard-role'] || 'creator';
  const profile = USER_PROFILES[role] || USER_PROFILES.creator;
  res.json({
    user: profile,
    authenticated: true,
    authMode: 'demo_session',
  });
});

router.post('/auth/switch-role', (req, res) => {
  const { role } = req.body;
  if (!USER_PROFILES[role]) {
    return res.status(400).json({ error: `Invalid role "${role}". Allowed roles: creator, reviewer, admin.` });
  }
  res.json({
    success: true,
    user: USER_PROFILES[role],
    message: `Switched demo active role to ${role}.`,
  });
});
