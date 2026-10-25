import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrandRule } from './models/BrandRule.js';
import { ApprovedFact } from './models/ApprovedFact.js';
import { Draft } from './models/Draft.js';
import { ReviewFinding } from './models/ReviewFinding.js';
import { ApprovalDecision } from './models/ApprovalDecision.js';
import { AuditEvent } from './models/AuditEvent.js';
import {
  SEED_RULES,
  SEED_FACTS,
  SEED_DRAFTS,
  SEED_AUDIT_LOGS,
} from './seeds/defaultData.js';
import { runDeterministicChecks } from './services/reviewEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = process.env.BRANDGUARD_STORE_FILE || path.join(DATA_DIR, 'brandguard_store.json');

let dbMode = 'uninitialized'; // 'mongodb' | 'embedded'
let embeddedStore = null;

export function isMongoRequired() {
  return process.env.NODE_ENV === 'production' || process.env.REQUIRE_MONGODB === 'true';
}

// Embedded file-backed persistence store for offline / local demo fallback
class EmbeddedStore {
  constructor() {
    this.data = {
      rules: [...SEED_RULES],
      facts: [...SEED_FACTS],
      drafts: [...SEED_DRAFTS],
      findings: [],
      decisions: [],
      audit: [...SEED_AUDIT_LOGS],
    };
    this.load();
  }

  load() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      this.data = { ...this.data, ...parsed };
    } else {
      this.save();
    }
  }

  save() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }
}

if (process.env.NODE_ENV !== 'production') {
  embeddedStore = new EmbeddedStore();
}

/**
 * Initializes database connection.
 * Production environments require MongoDB; embedded storage is for local development only.
 */
export async function initDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri && typeof mongoUri === 'string' && mongoUri.trim().length > 0) {
    try {
      console.log('[BrandGuard DB] Attempting connection to MongoDB Atlas...');
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
      });
      await seedAtlasIfEmpty();
      dbMode = 'mongodb';
      console.log('[BrandGuard DB] Connected successfully to MongoDB Atlas.');
      return { status: 'connected', mode: 'mongodb' };
    } catch (err) {
      await mongoose.disconnect();
      if (isMongoRequired()) {
        dbMode = 'uninitialized';
        throw new Error('MongoDB is required but the configured database could not be reached or initialized.');
      }
      console.warn(`[BrandGuard DB] MongoDB connection failed (${err.message}). Using local embedded storage.`);
    }
  } else if (isMongoRequired()) {
    dbMode = 'uninitialized';
    throw new Error('MongoDB is required, but MONGODB_URI is not configured.');
  }

  console.log('[BrandGuard DB] MongoDB is not required; using local embedded storage.');
  if (!embeddedStore) embeddedStore = new EmbeddedStore();
  dbMode = 'embedded';
  return { status: 'fallback', mode: 'embedded' };
}

async function seedAtlasIfEmpty() {
  const rulesCount = await BrandRule.countDocuments();
  if (rulesCount === 0) {
    await BrandRule.insertMany(SEED_RULES);
    console.log(`[BrandGuard DB] Seeded ${SEED_RULES.length} brand rules into MongoDB.`);
  }

  const factsCount = await ApprovedFact.countDocuments();
  if (factsCount === 0) {
    await ApprovedFact.insertMany(SEED_FACTS);
    console.log(`[BrandGuard DB] Seeded ${SEED_FACTS.length} approved facts into MongoDB.`);
  }

  const draftsCount = await Draft.countDocuments();
  if (draftsCount === 0) {
    await Draft.insertMany(SEED_DRAFTS);
    console.log(`[BrandGuard DB] Seeded ${SEED_DRAFTS.length} drafts into MongoDB.`);
  }

  const auditCount = await AuditEvent.countDocuments();
  if (auditCount === 0) {
    await AuditEvent.insertMany(SEED_AUDIT_LOGS);
    console.log(`[BrandGuard DB] Seeded ${SEED_AUDIT_LOGS.length} audit logs into MongoDB.`);
  }
}

// Unified Repository API
export const db = {
  getMode: () => dbMode,

  // Rules
  async getRules(categoryFilter) {
    if (dbMode === 'mongodb') {
      const query = categoryFilter && categoryFilter !== 'all' ? { category: categoryFilter } : {};
      return await BrandRule.find(query).lean();
    }
    let list = embeddedStore.data.rules;
    if (categoryFilter && categoryFilter !== 'all') {
      list = list.filter((r) => r.category === categoryFilter);
    }
    return list;
  },

  async updateRule(id, updates) {
    if (dbMode === 'mongodb') {
      return await BrandRule.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
    }
    const idx = embeddedStore.data.rules.findIndex((r) => r.id === id);
    if (idx !== -1) {
      embeddedStore.data.rules[idx] = { ...embeddedStore.data.rules[idx], ...updates };
      embeddedStore.save();
      return embeddedStore.data.rules[idx];
    }
    return null;
  },

  // Facts
  async getFacts() {
    if (dbMode === 'mongodb') {
      return await ApprovedFact.find().lean();
    }
    return embeddedStore.data.facts;
  },

  async createFact(factData) {
    if (dbMode === 'mongodb') {
      const fact = new ApprovedFact(factData);
      return (await fact.save()).toObject();
    }
    embeddedStore.data.facts.push(factData);
    embeddedStore.save();
    return factData;
  },

  async updateFact(id, updates) {
    if (dbMode === 'mongodb') {
      return await ApprovedFact.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
    }
    const fact = embeddedStore.data.facts.find((item) => item.id === id);
    if (!fact) return null;
    Object.assign(fact, updates);
    embeddedStore.save();
    return fact;
  },

  async deleteFact(id) {
    if (dbMode === 'mongodb') {
      return await ApprovedFact.findOneAndDelete({ id }).lean();
    }
    const index = embeddedStore.data.facts.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [deleted] = embeddedStore.data.facts.splice(index, 1);
    embeddedStore.save();
    return deleted;
  },

  // Drafts
  async getDraft(id = 'draft-1') {
    if (dbMode === 'mongodb') {
      return await Draft.findOne({ id }).lean();
    }
    const found = embeddedStore.data.drafts.find((d) => d.id === id);
    if (found) return found;
    if (id === 'draft-1') return embeddedStore.data.drafts[0];
    return null;
  },

  async updateDraft(id, updates) {
    if (dbMode === 'mongodb') {
      return await Draft.findOneAndUpdate({ id }, { $set: updates }, { new: true, upsert: true }).lean();
    }
    const idx = embeddedStore.data.drafts.findIndex((d) => d.id === id);
    if (idx !== -1) {
      embeddedStore.data.drafts[idx] = { ...embeddedStore.data.drafts[idx], ...updates };
      embeddedStore.save();
      return embeddedStore.data.drafts[idx];
    }
    const newDraft = { id, ...updates };
    embeddedStore.data.drafts.push(newDraft);
    embeddedStore.save();
    return newDraft;
  },

  async createDraft(draft) {
    if (dbMode === 'mongodb') {
      try {
        return (await Draft.create(draft)).toObject();
      } catch (err) {
        if (err.code === 11000) return null;
        throw err;
      }
    }
    if (embeddedStore.data.drafts.some((item) => item.id === draft.id)) return null;
    embeddedStore.data.drafts.push(draft);
    embeddedStore.save();
    return draft;
  },

  async saveDraftRevision(id, expectedVersion, revision, title) {
    if (dbMode === 'mongodb') {
      const current = await Draft.findOne({ id, currentVersion: expectedVersion }).lean();
      if (!current || !['Draft', 'Changes requested', 'Approved', 'Rejected'].includes(current.status)) return null;
      const updates = {
        title: title || current.title,
        status: revision ? 'Draft' : current.status,
      };
      if (revision) {
        updates.currentVersion = revision.version;
        updates.currentText = revision.text;
        return await Draft.findOneAndUpdate(
          { id, currentVersion: expectedVersion, status: current.status },
          { $set: updates, $push: { revisions: revision } },
          { new: true }
        ).lean();
      }
      return await Draft.findOneAndUpdate(
        { id, currentVersion: expectedVersion, status: current.status },
        { $set: updates },
        { new: true }
      ).lean();
    }
    const draft = embeddedStore.data.drafts.find((item) => item.id === id);
    if (!draft || draft.currentVersion !== expectedVersion) return null;
    if (!['Draft', 'Changes requested', 'Approved', 'Rejected'].includes(draft.status)) return null;
    if (title) draft.title = title;
    if (revision) {
      if (!draft.revisions) draft.revisions = [];
      if (draft.revisions.some((item) => item.version === revision.version)) return null;
      draft.revisions.push(revision);
      draft.currentVersion = revision.version;
      draft.currentText = revision.text;
      draft.status = 'Draft';
    }
    embeddedStore.save();
    return draft;
  },

  async transitionDraft(id, expectedStatus, updates) {
    const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (dbMode === 'mongodb') {
      return await Draft.findOneAndUpdate(
        { id, status: { $in: statuses } },
        { $set: updates },
        { new: true }
      ).lean();
    }
    const draft = embeddedStore.data.drafts.find((item) => item.id === id);
    if (!draft || !statuses.includes(draft.status)) return null;
    Object.assign(draft, updates);
    embeddedStore.save();
    return draft;
  },

  async addRevision(id, revision, expectedVersion, allowedStatuses = ['Draft', 'Changes requested', 'Approved', 'Rejected']) {
    if (dbMode === 'mongodb') {
      return await Draft.findOneAndUpdate(
        { id, currentVersion: expectedVersion, status: { $in: allowedStatuses } },
        {
          $push: { revisions: revision },
          $set: { currentVersion: revision.version, currentText: revision.text, status: 'Draft' },
        },
        { new: true }
      ).lean();
    }
    const draft = embeddedStore.data.drafts.find((d) => d.id === id);
    if (draft && draft.currentVersion === expectedVersion && allowedStatuses.includes(draft.status)) {
      if (!draft.revisions) draft.revisions = [];
      if (draft.revisions.some((item) => item.version === revision.version)) return null;
      draft.revisions.push(revision);
      draft.currentVersion = revision.version;
      draft.currentText = revision.text;
      draft.status = 'Draft';
      embeddedStore.save();
      return draft;
    }
    return null;
  },

  // Findings
  async getFindings(draftId = 'draft-1', version) {
    if (dbMode === 'mongodb') {
      const query = { draftId };
      if (version) query.version = version;
      return await ReviewFinding.find(query).lean();
    }
    return embeddedStore.data.findings.filter(
      (f) => f.draftId === draftId && (!version || f.version === version)
    );
  },

  async saveFindings(draftId, version, findings) {
    if (dbMode === 'mongodb') {
      await ReviewFinding.deleteMany({ draftId, version });
      const docs = findings.map((f) => ({ ...f, draftId, version }));
      return await ReviewFinding.insertMany(docs);
    }
    embeddedStore.data.findings = embeddedStore.data.findings.filter(
      (f) => !(f.draftId === draftId && f.version === version)
    );
    const stamped = findings.map((f) => ({ ...f, draftId, version }));
    embeddedStore.data.findings.push(...stamped);
    embeddedStore.save();
    return stamped;
  },

  async updateFinding(draftId, findingId, version, updates) {
    if (dbMode === 'mongodb') {
      return await ReviewFinding.findOneAndUpdate(
        { draftId, id: findingId, version },
        { $set: updates },
        { new: true }
      ).lean();
    }
    const matches = embeddedStore.data.findings.filter(
      (x) => x.draftId === draftId && x.id === findingId && x.version === version
    );
    if (matches.length > 0) {
      matches.forEach((f) => Object.assign(f, updates));
      embeddedStore.save();
      return matches[matches.length - 1];
    }
    return null;
  },

  // Decisions
  async recordDecision(decisionData) {
    if (dbMode === 'mongodb') {
      const decision = new ApprovalDecision(decisionData);
      return (await decision.save()).toObject();
    }
    embeddedStore.data.decisions.push(decisionData);
    embeddedStore.save();
    return decisionData;
  },

  // Audit Events
  async getAuditEvents() {
    if (dbMode === 'mongodb') {
      return await AuditEvent.find().sort({ createdAt: -1 }).lean();
    }
    return [...embeddedStore.data.audit].reverse();
  },

  async addAuditEvent(event) {
    if (dbMode === 'mongodb') {
      const audit = new AuditEvent(event);
      return (await audit.save()).toObject();
    }
    embeddedStore.data.audit.push(event);
    embeddedStore.save();
    return event;
  },

  // Queue
  async getQueue() {
    if (dbMode === 'mongodb') {
      const drafts = await Draft.find({ status: 'In review' }).lean();
      const rules = await BrandRule.find({ active: { $ne: false } }).lean();
      return await Promise.all(
        drafts.map(async (d) => {
          const checks = runDeterministicChecks(d.currentText, rules);
          const stored = await ReviewFinding.find({ draftId: d.id, version: d.currentVersion }).lean();
          const priorByKey = new Map(stored.map((f) => [`${f.ruleId}:${f.start}:${f.end}:${f.quoted_text}`, f]));
          const findings = checks.map((finding) => {
            const previous = priorByKey.get(`${finding.ruleId}:${finding.start}:${finding.end}:${finding.quoted_text}`);
            return previous ? { ...finding, status: previous.status, dismissReason: previous.dismissReason } : finding;
          });
          const highCount = findings.filter((f) => f.status === 'active' && f.severity === 'high').length;
          return {
            id: d.id,
            title: d.title,
            submitter: d.submitter,
            highFindingsCount: highCount,
            time: 'Recently updated',
            status: d.status,
            version: d.currentVersion,
            draft: d.currentText,
          };
        })
      );
    }
    const rules = embeddedStore.data.rules.filter((r) => r.active !== false);
    return embeddedStore.data.drafts.filter((d) => d.status === 'In review').map((d) => {
      const checks = runDeterministicChecks(d.currentText, rules);
      const stored = embeddedStore.data.findings.filter(
        (f) => f.draftId === d.id && f.version === d.currentVersion
      );
      const priorByKey = new Map(stored.map((f) => [`${f.ruleId}:${f.start}:${f.end}:${f.quoted_text}`, f]));
      const draftFindings = checks.map((finding) => {
        const previous = priorByKey.get(`${finding.ruleId}:${finding.start}:${finding.end}:${finding.quoted_text}`);
        return previous ? { ...finding, status: previous.status, dismissReason: previous.dismissReason } : finding;
      });
      const highCount = draftFindings.filter(
        (f) => f.status === 'active' && f.severity === 'high'
      ).length;
      return {
        id: d.id,
        title: d.title,
        submitter: d.submitter,
        highFindingsCount: highCount,
        time: 'Recently updated',
        status: d.status,
        version: d.currentVersion,
        draft: d.currentText,
      };
    });
  },

  // Governance Analytics
  async getGovernanceAnalytics() {
    const rules = dbMode === 'mongodb'
      ? await BrandRule.find().lean()
      : embeddedStore.data.rules;
    const drafts = dbMode === 'mongodb'
      ? await Draft.find().lean()
      : embeddedStore.data.drafts;
    const activeRules = rules.filter((r) => r.active !== false);
    const ruleMap = new Map(rules.map((r) => [r.id, r]));

    // Evaluate findings across all drafts
    let allFindings = [];
    for (const d of drafts) {
      let draftFindings = [];
      if (dbMode === 'mongodb') {
        draftFindings = await ReviewFinding.find({ draftId: d.id, version: d.currentVersion }).lean();
      } else {
        draftFindings = embeddedStore.data.findings.filter(
          (f) => f.draftId === d.id && (!d.currentVersion || f.version === d.currentVersion)
        );
      }
      if (draftFindings.length === 0 && d.status !== 'Approved') {
        draftFindings = runDeterministicChecks(d.currentText, activeRules);
      }
      allFindings.push(...draftFindings);
    }

    const totalViolations = allFindings.length;
    const ruleCountMap = {};
    const severityBreakdown = { high: 0, medium: 0, low: 0 };
    const categoryBreakdown = {};

    for (const f of allFindings) {
      if (f.severity) {
        severityBreakdown[f.severity] = (severityBreakdown[f.severity] || 0) + 1;
      }
      if (f.category) {
        categoryBreakdown[f.category] = (categoryBreakdown[f.category] || 0) + 1;
      }
      ruleCountMap[f.ruleId] = (ruleCountMap[f.ruleId] || 0) + 1;
    }

    const mostViolatedRules = Object.entries(ruleCountMap)
      .map(([ruleId, count]) => {
        const rule = ruleMap.get(ruleId) || { id: ruleId, text: 'Custom rule', severity: 'medium', category: 'general' };
        const percentage = totalViolations > 0 ? Math.round((count / totalViolations) * 100) : 0;
        return {
          ruleId,
          code: rule.code || ruleId,
          text: rule.text,
          summary: rule.summary || rule.text,
          severity: rule.severity,
          category: rule.category,
          count,
          percentage,
        };
      })
      .sort((a, b) => b.count - a.count);

    let compliantDrafts = 0;
    for (const d of drafts) {
      if (d.status === 'Approved') {
        compliantDrafts++;
      } else {
        const dFindings = runDeterministicChecks(d.currentText, activeRules);
        const highCount = dFindings.filter((f) => f.severity === 'high').length;
        if (highCount === 0) compliantDrafts++;
      }
    }

    const complianceRate = drafts.length > 0
      ? Math.round((compliantDrafts / drafts.length) * 100)
      : 100;

    const audits = dbMode === 'mongodb'
      ? await AuditEvent.find().sort({ createdAt: -1 }).limit(10).lean()
      : embeddedStore.data.audit.slice(-10).reverse();

    return {
      totalDrafts: drafts.length,
      totalViolations,
      activeRulesCount: activeRules.length,
      complianceRate,
      severityBreakdown,
      categoryBreakdown,
      mostViolatedRules,
      recentAudits: audits,
      timestamp: new Date().toISOString(),
    };
  },
};
