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
const STORE_FILE = path.join(DATA_DIR, 'brandguard_store.json');

let dbMode = 'uninitialized'; // 'mongodb' | 'embedded'

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
    try {
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
    } catch (err) {
      console.warn('[EmbeddedStore] Using in-memory fallback:', err.message);
    }
  }

  save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[EmbeddedStore] Save error:', err.message);
    }
  }
}

const embeddedStore = new EmbeddedStore();

/**
 * Initializes database connection.
 * Connects to MongoDB Atlas if MONGODB_URI is provided.
 * Gracefully falls back to persistent embedded store if offline/unconfigured.
 */
export async function initDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri && typeof mongoUri === 'string' && mongoUri.trim().length > 0) {
    try {
      console.log('[BrandGuard DB] Attempting connection to MongoDB Atlas...');
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 4000,
      });
      dbMode = 'mongodb';
      console.log('[BrandGuard DB] Connected successfully to MongoDB Atlas.');

      // Seed Atlas database if collections are empty
      await seedAtlasIfEmpty();
      return { status: 'connected', mode: 'mongodb' };
    } catch (err) {
      console.warn(`[BrandGuard DB] MongoDB Atlas connection failed (${err.message}). Using persistent embedded storage.`);
      dbMode = 'embedded';
      return { status: 'fallback', mode: 'embedded', error: err.message };
    }
  } else {
    console.log('[BrandGuard DB] No MONGODB_URI configured in server/.env. Running embedded storage mode.');
    dbMode = 'embedded';
    return { status: 'fallback', mode: 'embedded' };
  }
}

async function seedAtlasIfEmpty() {
  try {
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
  } catch (err) {
    console.error('[BrandGuard DB] Atlas seed error:', err.message);
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

  async addRevision(id, revision) {
    if (dbMode === 'mongodb') {
      return await Draft.findOneAndUpdate(
        { id },
        {
          $push: { revisions: revision },
          $set: { currentVersion: revision.version, currentText: revision.text },
        },
        { new: true }
      ).lean();
    }
    const draft = embeddedStore.data.drafts.find((d) => d.id === id);
    if (draft) {
      if (!draft.revisions) draft.revisions = [];
      draft.revisions.push(revision);
      draft.currentVersion = revision.version;
      draft.currentText = revision.text;
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

  async updateFinding(draftId, findingId, updates) {
    if (dbMode === 'mongodb') {
      await ReviewFinding.updateMany({ draftId, id: findingId }, { $set: updates });
      return await ReviewFinding.findOne({ draftId, id: findingId }).lean();
    }
    const matches = embeddedStore.data.findings.filter((x) => x.draftId === draftId && x.id === findingId);
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
      const drafts = await Draft.find().lean();
      const rules = await BrandRule.find({ active: { $ne: false } }).lean();
      return await Promise.all(
        drafts.map(async (d) => {
          let highCount = await ReviewFinding.countDocuments({
            draftId: d.id,
            status: 'active',
            severity: 'high',
          });
          if (highCount === 0 && d.status !== 'Approved') {
            const checks = runDeterministicChecks(d.currentText, rules);
            highCount = checks.filter((f) => f.status === 'active' && f.severity === 'high').length;
          }
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
    return embeddedStore.data.drafts.map((d) => {
      const draftFindings = d.status === 'Approved' ? [] : runDeterministicChecks(d.currentText, rules);
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
