import express from 'express';
import multer from 'multer';
import { db, isMongoRequired } from '../db.js';
import { executeReviewPipeline, getUnverifiedRuleIds } from '../services/reviewEngine.js';
import { parseDocumentBuffer } from '../services/documentParser.js';
import { getLLMConfig } from '../services/llmAdapter.js';
import { randomUUID } from 'crypto';

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
    permissions: ['review:approve', 'review:request_changes', 'review:reject', 'audit:view'],
  },
  admin: {
    id: 'user-admin',
    name: 'Marcus Brody',
    email: 'admin@brandguard.internal',
    role: 'admin',
    department: 'Legal & Risk Policy',
    permissions: ['rules:edit', 'facts:manage', 'governance:view'],
  },
};

const EDITABLE_STATUSES = ['Draft', 'Changes requested', 'Approved', 'Rejected'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const router = express.Router();

router.use((req, res, next) => {
  const role = req.get('x-brandguard-role') || req.query.role || 'creator';
  if (!Object.hasOwn(USER_PROFILES, role)) {
    return res.status(400).json({ error: 'Invalid demo role. Allowed roles: creator, reviewer, admin.' });
  }
  req.demoRole = role;
  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.demoRole)) {
      return res.status(403).json({
        error: `This operation requires the ${roles.join(' or ')} demo role.`,
        role: req.demoRole,
      });
    }
    next();
  };
}

function actorFor(role) {
  return USER_PROFILES[role].name + (role === 'creator' ? ' (Creator)' : role === 'reviewer' ? ' (Reviewer)' : ' (Admin)');
}

function nextVersion(version) {
  const current = Number.parseInt(String(version || 'v0').replace(/^v/, ''), 10);
  return `v${(Number.isFinite(current) ? current : 0) + 1}`;
}

function findingKey(finding) {
  return `${finding.ruleId}:${finding.start}:${finding.end}:${finding.quoted_text}`;
}

function preserveDismissals(findings, existingFindings) {
  const dismissed = new Map(
    existingFindings
      .filter((finding) => finding.status === 'dismissed')
      .map((finding) => [findingKey(finding), finding.dismissReason])
  );
  return findings.map((finding) => dismissed.has(findingKey(finding))
    ? { ...finding, status: 'dismissed', dismissReason: dismissed.get(findingKey(finding)) }
    : finding);
}

function hasUnverifiedRules(rules) {
  return getUnverifiedRuleIds(rules);
}

function validFactFields({ subject, value, source, validUntil }) {
  if (![subject, value, source, validUntil].every((field) => typeof field === 'string' && field.trim())) {
    return 'All fact fields (subject, value, source, validUntil) are required.';
  }
  if (subject.trim().length > 120 || value.trim().length > 1000 || source.trim().length > 300) {
    return 'Fact subject, value, or source exceeds its allowed length.';
  }
  const date = new Date(`${validUntil}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== validUntil) {
    return 'validUntil must be a valid date in YYYY-MM-DD format.';
  }
  return null;
}

// Health Check & DB mode
router.get('/health', (req, res) => {
  const ready = !isMongoRequired() || db.getMode() === 'mongodb';
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'unavailable',
    database: db.getMode(),
    timestamp: new Date().toISOString(),
  });
});

// --- RULES API ---
// Retrieve all rules (optional category filter)
router.get('/rules', requireRole('creator', 'reviewer', 'admin'), async (req, res) => {
  try {
    const { category } = req.query;
    const rules = await db.getRules(category);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch brand rules', message: err.message });
  }
});

// Update a rule (e.g. toggle active, edit text/severity)
router.put('/rules/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ['active', 'severity', 'text', 'summary', 'standard'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Provide at least one supported rule field to update.' });
    }
    if ('active' in updates && typeof updates.active !== 'boolean') {
      return res.status(400).json({ error: 'Rule active must be a boolean.' });
    }
    if ('severity' in updates && !['high', 'medium', 'low'].includes(updates.severity)) {
      return res.status(400).json({ error: 'Rule severity must be high, medium, or low.' });
    }
    if (['text', 'summary', 'standard'].some((key) => key in updates && (typeof updates[key] !== 'string' || !updates[key].trim()))) {
      return res.status(400).json({ error: 'Rule text fields must be non-empty strings.' });
    }

    const updated = await db.updateRule(id, updates);
    if (!updated) {
      return res.status(404).json({ error: `Rule ${id} not found` });
    }

    // Record audit event for rule alteration
    await db.addAuditEvent({
      id: `audit_rule_${Date.now()}`,
      actor: actorFor(req.demoRole),
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
router.get('/facts', requireRole('creator', 'reviewer', 'admin'), async (req, res) => {
  try {
    const facts = await db.getFacts();
    res.json(facts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch approved facts', message: err.message });
  }
});

router.post('/facts', requireRole('admin'), async (req, res) => {
  try {
    const { subject, value, source, validUntil } = req.body;
    const validationError = validFactFields({ subject, value, source, validUntil });
    if (validationError) return res.status(400).json({ error: validationError });
    const facts = await db.getFacts();
    const duplicate = facts.some((fact) =>
      fact.subject.trim().toLowerCase() === subject.trim().toLowerCase()
      && fact.value.trim().toLowerCase() === value.trim().toLowerCase()
    );
    if (duplicate) return res.status(409).json({ error: 'An approved fact with the same subject and value already exists.' });

    const id = `fact-${randomUUID()}`;
    const newFact = await db.createFact({
      id,
      subject: subject.trim(),
      value: value.trim(),
      source: source.trim(),
      validUntil,
    });

    await db.addAuditEvent({
      id: `audit_fact_${randomUUID()}`,
      actor: actorFor(req.demoRole),
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

router.put('/facts/:id', requireRole('admin'), async (req, res) => {
  try {
    const existing = (await db.getFacts()).find((fact) => fact.id === req.params.id);
    if (!existing) return res.status(404).json({ error: 'Approved fact not found.' });
    const updates = { ...existing, ...req.body };
    const validationError = validFactFields(updates);
    if (validationError) return res.status(400).json({ error: validationError });
    const duplicate = (await db.getFacts()).some((fact) =>
      fact.id !== req.params.id
      && fact.subject.trim().toLowerCase() === updates.subject.trim().toLowerCase()
      && fact.value.trim().toLowerCase() === updates.value.trim().toLowerCase()
    );
    if (duplicate) return res.status(409).json({ error: 'An approved fact with the same subject and value already exists.' });
    const updated = await db.updateFact(req.params.id, {
      subject: updates.subject.trim(),
      value: updates.value.trim(),
      source: updates.source.trim(),
      validUntil: updates.validUntil,
    });
    await db.addAuditEvent({
      id: `audit_fact_${randomUUID()}`,
      actor: actorFor(req.demoRole),
      action: 'Updated approved fact',
      from: existing.subject,
      to: updated.subject,
      comment: `Updated approved fact: ${updated.subject}`,
      time: 'Just now',
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update approved fact', message: err.message });
  }
});

router.delete('/facts/:id', requireRole('admin'), async (req, res) => {
  try {
    const deleted = await db.deleteFact(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Approved fact not found.' });
    await db.addAuditEvent({
      id: `audit_fact_${randomUUID()}`,
      actor: actorFor(req.demoRole),
      action: 'Deleted approved fact',
      from: deleted.subject,
      to: 'Deleted',
      comment: `Deleted approved fact: ${deleted.subject}`,
      time: 'Just now',
    });
    res.json({ success: true, fact: deleted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete approved fact', message: err.message });
  }
});

// --- REVIEWS & DRAFTS API ---
router.post('/drafts', requireRole('creator'), async (req, res) => {
  try {
    const { title, text = '' } = req.body;
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Draft title is required.' });
    }
    if (typeof text !== 'string') return res.status(400).json({ error: 'Draft text must be a string.' });
    const id = `draft-${randomUUID()}`;
    const initialText = text;
    const draft = await db.createDraft({
      id,
      title: title.trim(),
      submitter: actorFor(req.demoRole),
      status: 'Draft',
      currentVersion: 'v1',
      currentText: initialText,
      revisions: [{ version: 'v1', text: initialText, note: 'Draft created', createdAt: new Date() }],
    });
    if (!draft) return res.status(409).json({ error: 'Unable to allocate a unique draft identifier.' });
    await db.addAuditEvent({
      id: `audit_${randomUUID()}`,
      draftId: id,
      actor: actorFor(req.demoRole),
      action: 'Created draft',
      from: 'Not created',
      to: 'Draft v1',
      comment: 'Created a new draft.',
      time: 'Just now',
    });
    res.status(201).json({ draft });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create draft', message: err.message });
  }
});

router.put('/drafts/:id', requireRole('creator'), async (req, res) => {
  try {
    const { title, text, expectedVersion } = req.body;
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Draft title is required.' });
    if (typeof text !== 'string') return res.status(400).json({ error: 'Draft text must be a string.' });
    if (typeof expectedVersion !== 'string' || !/^v\d+$/.test(expectedVersion)) {
      return res.status(400).json({ error: 'A valid expectedVersion is required.' });
    }
    const current = await db.getDraft(req.params.id);
    if (!current) return res.status(404).json({ error: 'Draft not found.' });
    if (current.currentVersion !== expectedVersion) {
      return res.status(409).json({ error: 'Draft changed since it was loaded. Reload before saving.' });
    }
    if (!EDITABLE_STATUSES.includes(current.status)) {
      return res.status(409).json({ error: `Draft cannot be edited while its status is "${current.status}".` });
    }
    const changed = current.currentText !== text;
    const revision = changed ? {
      version: nextVersion(current.currentVersion),
      text,
      note: 'Saved draft edits',
      createdAt: new Date(),
    } : null;
    const updated = await db.saveDraftRevision(
      current.id,
      expectedVersion,
      revision,
      title.trim()
    );
    if (!updated) return res.status(409).json({ error: 'Draft changed before the save completed. Reload and retry.' });
    if (revision) {
      await db.addAuditEvent({
        id: `audit_${randomUUID()}`,
        draftId: current.id,
        actor: actorFor(req.demoRole),
        action: 'Saved revision',
        from: expectedVersion,
        to: revision.version,
        comment: 'Saved draft edits.',
        time: 'Just now',
      });
    }
    res.json({ draft: updated, saved: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save draft', message: err.message });
  }
});

// Retrieve active draft & its current findings
router.get('/reviews/current', requireRole('creator', 'reviewer', 'admin'), async (req, res) => {
  try {
    const draftId = req.query.draftId || 'draft-1';
    const draft = await db.getDraft(draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found.' });

    const activeRules = await db.getRules();
    const existingFindings = await db.getFindings(draft.id, draft.currentVersion);

    // Re-evaluate review findings against draft text and active rules
    const reviewResult = await executeReviewPipeline(draft.currentText, activeRules);

    // Preserve any existing dismissals and justifications for matching findings
    const mergedFindings = preserveDismissals(reviewResult.findings, existingFindings || []);

    const findings = await db.saveFindings(draft.id, draft.currentVersion, mergedFindings);

    res.json({
      draft,
      findings,
      rules: activeRules,
      meta: reviewResult.meta,
      summaryLine: reviewResult.summaryLine,
      coverage: reviewResult.meta.coverage,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load review workspace', message: err.message });
  }
});

// Run a review check on given text
router.post('/reviews/run', requireRole('creator', 'reviewer', 'admin'), async (req, res) => {
  try {
    const { draftId = 'draft-1', text, version } = req.body;
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'Draft text must be a string' });
    }
    const draft = await db.getDraft(draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found.' });
    const reviewVersion = version || draft.currentVersion;
    if (reviewVersion !== draft.currentVersion || text !== draft.currentText) {
      return res.status(409).json({ error: 'Save the current draft before scanning it.' });
    }

    const activeRules = await db.getRules();
    const result = await executeReviewPipeline(text, activeRules);

    const existing = await db.getFindings(draftId, reviewVersion);
    const findings = preserveDismissals(result.findings, existing);
    const saved = await db.saveFindings(draftId, reviewVersion, findings);
    await db.addAuditEvent({
      id: `audit_scan_${randomUUID()}`,
      draftId,
      actor: 'System (Review Engine)',
      action: 'Evaluated draft',
      from: reviewVersion,
      to: `${saved.length} findings`,
      comment: result.summaryLine,
      time: 'Just now',
    });

    res.json({
      draftText: text,
      findings: saved,
      meta: result.meta,
      summaryLine: result.summaryLine,
      coverage: result.meta.coverage,
    });
  } catch (err) {
    res.status(500).json({ error: 'Review pipeline failure', message: err.message });
  }
});

router.post('/reviews/accept', requireRole('creator'), async (req, res) => {
  try {
    const { draftId = 'draft-1', findingId, expectedVersion, newText } = req.body;
    const draft = await db.getDraft(draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found.' });
    if (expectedVersion && expectedVersion !== draft.currentVersion) {
      return res.status(409).json({ error: 'Draft changed since this finding was generated. Rescan before accepting.' });
    }
    if (!EDITABLE_STATUSES.includes(draft.status)) {
      return res.status(409).json({ error: `Draft cannot be edited while its status is "${draft.status}".` });
    }
    const currentFindings = await db.getFindings(draftId, draft.currentVersion);
    const finding = currentFindings.find((item) => item.id === findingId && item.status === 'active');
    if (!finding) return res.status(404).json({ error: 'Active finding not found for the current draft revision.' });
    if (!finding.suggested_revision) {
      return res.status(400).json({ error: 'This finding requires manual review and has no suggested correction.' });
    }
    const expectedText = draft.currentText.slice(0, finding.start)
      + finding.suggested_revision
      + draft.currentText.slice(finding.end);
    if (typeof newText !== 'string' || newText !== expectedText) {
      return res.status(400).json({ error: 'Correction text does not match the verified finding replacement.' });
    }
    const oldVersion = draft.currentVersion;
    const computedNextVer = nextVersion(oldVersion);
    const updatedDraft = await db.addRevision(draftId, {
      version: computedNextVer,
      text: expectedText,
      note: `Applied suggested correction for rule ${finding.ruleId}`,
      fixedRule: finding.ruleId,
      createdAt: new Date(),
    }, oldVersion, EDITABLE_STATUSES);
    if (!updatedDraft) return res.status(409).json({ error: 'Draft changed before the correction completed. Reload and retry.' });

    const activeRules = await db.getRules();
    const reviewResult = await executeReviewPipeline(expectedText, activeRules);
    const savedFindings = await db.saveFindings(draftId, computedNextVer, reviewResult.findings);
    await db.addAuditEvent({
      id: `audit_${randomUUID()}`,
      draftId,
      actor: actorFor(req.demoRole),
      action: 'Saved revision',
      from: oldVersion,
      to: computedNextVer,
      comment: `Applied suggested fix for rule ${finding.ruleId}.`,
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

router.post('/reviews/dismiss', requireRole('creator'), async (req, res) => {
  try {
    const { draftId = 'draft-1', findingId, reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Mandatory justification reason is required to dismiss a brand finding.',
      });
    }

    const draft = await db.getDraft(draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found.' });
    if (!['Draft', 'Changes requested'].includes(draft.status)) {
      return res.status(409).json({ error: `Findings cannot be dismissed while the draft is "${draft.status}".` });
    }
    const updated = await db.updateFinding(draftId, findingId, draft.currentVersion, {
      status: 'dismissed',
      dismissReason: reason.trim(),
    });
    if (!updated) return res.status(404).json({ error: 'Finding not found for the current draft revision.' });

    await db.addAuditEvent({
      id: `audit_${randomUUID()}`,
      draftId,
      actor: actorFor(req.demoRole),
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

router.post('/reviews/restore', requireRole('creator'), async (req, res) => {
  try {
    const { draftId = 'draft-1', findingId } = req.body;
    const draft = await db.getDraft(draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found.' });
    if (!['Draft', 'Changes requested'].includes(draft.status)) {
      return res.status(409).json({ error: `Findings cannot be restored while the draft is "${draft.status}".` });
    }
    const updated = await db.updateFinding(draftId, findingId, draft.currentVersion, {
      status: 'active',
      dismissReason: '',
    });
    if (!updated) return res.status(404).json({ error: 'Dismissed finding not found for the current draft revision.' });
    await db.addAuditEvent({
      id: `audit_${randomUUID()}`,
      draftId,
      actor: actorFor(req.demoRole),
      action: 'Restored finding',
      from: 'dismissed',
      to: 'active',
      comment: `Restored finding ${findingId}.`,
      time: 'Just now',
    });
    res.json({
      success: true,
      findingId,
      updated,
      findings: await db.getFindings(draftId, draft.currentVersion),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore finding', message: err.message });
  }
});

// Submit draft for approval
router.post('/reviews/submit', requireRole('creator'), async (req, res) => {
  try {
    const { draftId = 'draft-1' } = req.body;

    const draft = await db.getDraft(draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found.' });
    if (!['Draft', 'Changes requested'].includes(draft.status)) {
      return res.status(409).json({ error: `Draft cannot be submitted while its status is "${draft.status}".` });
    }
    if (typeof draft.currentText !== 'string' || !draft.currentText.trim()) {
      return res.status(400).json({ error: 'Draft content is required before submission.' });
    }

    const rules = await db.getRules();
    const unsupported = hasUnverifiedRules(rules);
    if (unsupported.length) {
      return res.status(409).json({ error: `Cannot submit while active rules are unsupported by deterministic review: ${unsupported.join(', ')}.` });
    }
    const scan = await executeReviewPipeline(draft.currentText, rules);
    const existing = await db.getFindings(draftId, draft.currentVersion);
    const findings = preserveDismissals(scan.findings, existing);
    await db.saveFindings(draftId, draft.currentVersion, findings);
    const activeHighCount = findings.filter((f) => f.status === 'active' && f.severity === 'high').length;

    if (activeHighCount > 0) {
      return res.status(400).json({
        error: `Submission blocked: ${activeHighCount} unresolved high-severity finding(s) must be accepted or dismissed before submission.`,
      });
    }

    const updated = await db.transitionDraft(draftId, ['Draft', 'Changes requested'], { status: 'In review' });
    if (!updated) return res.status(409).json({ error: 'Draft was already submitted or changed. Reload before retrying.' });

    await db.addAuditEvent({
      id: `audit_${randomUUID()}`,
      draftId,
      actor: actorFor(req.demoRole),
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
router.post('/reviews/decision', requireRole('reviewer'), async (req, res) => {
  try {
    const { draftId = 'draft-1', decision, comment } = req.body;

    if (!decision || !['Approved', 'Changes requested', 'Rejected'].includes(decision)) {
      return res.status(400).json({ error: "Decision must be one of 'Approved', 'Changes requested', 'Rejected'" });
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ error: 'A reviewer comment is mandatory for all compliance decisions.' });
    }

    const draft = await db.getDraft(draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found.' });
    if (draft.status !== 'In review') {
      return res.status(409).json({ error: `A decision cannot be recorded while the draft is "${draft.status}".` });
    }

    if (decision === 'Approved') {
      const rules = await db.getRules();
      const unsupported = hasUnverifiedRules(rules);
      if (unsupported.length) {
        return res.status(409).json({ error: `Cannot approve while active rules are unsupported by deterministic review: ${unsupported.join(', ')}.` });
      }
      const scan = await executeReviewPipeline(draft.currentText, rules);
      const existing = await db.getFindings(draftId, draft.currentVersion);
      const findings = preserveDismissals(scan.findings, existing);
      await db.saveFindings(draftId, draft.currentVersion, findings);
      const activeHigh = findings.filter((f) => f.status === 'active' && f.severity === 'high').length;
      if (activeHigh > 0) {
        return res.status(400).json({
          error: `Cannot approve draft with ${activeHigh} active high-severity policy violation(s).`,
        });
      }
    }

    const updatedDraft = await db.transitionDraft(draftId, 'In review', { status: decision });
    if (!updatedDraft) return res.status(409).json({ error: 'Draft status changed before the decision was recorded.' });
    await db.recordDecision({
      id: `dec_${randomUUID()}`,
      draftId,
      reviewer: actorFor(req.demoRole),
      decision,
      comment: comment.trim(),
      version: draft.currentVersion,
    });

    await db.addAuditEvent({
      id: `audit_${randomUUID()}`,
      draftId,
      actor: actorFor(req.demoRole),
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
router.get('/queue', requireRole('creator', 'reviewer', 'admin'), async (req, res) => {
  try {
    const queue = await db.getQueue();
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch review queue', message: err.message });
  }
});

// --- AUDIT TRAIL API ---
router.get('/audit', requireRole('creator', 'reviewer', 'admin'), async (req, res) => {
  try {
    const events = await db.getAuditEvents();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit events', message: err.message });
  }
});

// --- DOCUMENT PARSING & UPLOAD API ---
router.post('/documents/extract', requireRole('creator'), upload.single('file'), async (req, res) => {
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
      actor: actorFor(req.demoRole),
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
router.get('/analytics/governance', requireRole('creator', 'reviewer', 'admin'), async (req, res) => {
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

// Demo roles are selectable labels, not authenticated identities.
router.get('/auth/me', (req, res) => {
  const profile = USER_PROFILES[req.demoRole];
  res.json({
    user: profile,
    authenticated: false,
    authMode: 'demo_role',
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
