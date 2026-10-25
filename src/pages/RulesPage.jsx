import React, { useState, useEffect, useRef } from 'react';
import {
  fetchRulesAPI, updateRuleAPI, fetchFactsAPI, createFactAPI, updateFactAPI,
  deleteFactAPI, getSelectedDemoRole,
} from '../api';
import RuleDrawer from '../components/RuleDrawer';
import { BookOpen, CheckCircle, Database, Filter, AlertCircle, AlertTriangle, Info, Plus, Pencil, Trash2 } from 'lucide-react';

export default function RulesPage() {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'facts'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [rules, setRules] = useState([]);
  const [facts, setFacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [role] = useState(getSelectedDemoRole);
  const [factForm, setFactForm] = useState(null);
  const [savingFact, setSavingFact] = useState(false);
  const [activeRuleId, setActiveRuleId] = useState(null);
  const triggerRefs = useRef({});

  // Load rules from backend
  useEffect(() => {
    async function loadRules() {
      setIsLoading(true);
      try {
        const data = await fetchRulesAPI(categoryFilter);
        if (Array.isArray(data)) setRules(data);
        setError('');
      } catch (err) {
        setError(`Unable to load rules from the backend: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
    loadRules();
  }, [categoryFilter]);

  const loadFacts = async () => {
    try {
      const data = await fetchFactsAPI();
      if (Array.isArray(data)) setFacts(data);
      setError('');
    } catch (err) {
      setError(`Unable to load approved facts from the backend: ${err.message}`);
    }
  };

  useEffect(() => {
    if (activeTab === 'facts') loadFacts();
  }, [activeTab]);

  const handleToggleRule = async (id) => {
    const current = rules.find((r) => r.id === id);
    const newActive = current ? !current.active : false;
    if (role !== 'admin') return;
    setError('');
    try {
      const updated = await updateRuleAPI(id, { active: newActive });
      setRules((prev) => prev.map((rule) => rule.id === id ? updated : rule));
    } catch (err) {
      setError(`Rule update failed; the saved status was not changed. ${err.message}`);
    }
  };

  const handleSaveFact = async (event) => {
    event.preventDefault();
    setSavingFact(true);
    setError('');
    try {
      if (factForm.id) {
        await updateFactAPI(factForm.id, factForm);
      } else {
        await createFactAPI(factForm);
      }
      setFactForm(null);
      await loadFacts();
    } catch (err) {
      setError(`Unable to save approved fact: ${err.message}`);
    } finally {
      setSavingFact(false);
    }
  };

  const handleDeleteFact = async (fact) => {
    if (!window.confirm(`Delete the approved fact "${fact.subject}"?`)) return;
    setError('');
    try {
      await deleteFactAPI(fact.id);
      setFacts((prev) => prev.filter((item) => item.id !== fact.id));
    } catch (err) {
      setError(`Unable to delete approved fact: ${err.message}`);
    }
  };

  const categories = ['all', 'claim_substantiation', 'terminology', 'accessibility', 'trademark', 'compliance'];

  const filteredRules = rules.filter((r) => {
    if (categoryFilter === 'all') return true;
    return r.category === categoryFilter;
  });

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Brand Policy & Knowledge Repository</h1>
          <p className="text-xs text-slate-500 mt-1">
            Governance constraints and approved empirical facts referenced during content inspection.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded border border-slate-300 bg-slate-100 p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rules'}
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
              activeTab === 'rules'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Brand Rules ({rules.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'facts'}
            onClick={() => setActiveTab('facts')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
              activeTab === 'facts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Approved Facts ({facts.length})
          </button>
        </div>
      </div>

      {error && <div role="alert" className="max-w-7xl mx-auto px-3 sm:px-6 -mt-3">
        <p className="p-3 rounded border border-rose-200 bg-rose-50 text-xs text-rose-800">{error}</p>
      </div>}

      {/* Tab 1: Rules Table */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {role !== 'admin' && <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded p-3">
            Rule changes are available only in the selectable demo Admin role. This role is not secure authentication.
          </p>}
          {/* Category Filter */}
          <div className="flex items-center justify-between gap-4 bg-white p-3 rounded border border-slate-200">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Category Filter:</span>
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                      categoryFilter === cat
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Showing {filteredRules.length} of {rules.length} rules
            </span>
          </div>

          {/* Table */}
          <div className="bg-white rounded border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Rule ID</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Rule Specification</th>
                  <th className="py-3 px-4">Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!isLoading && filteredRules.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-xs text-slate-500">No brand rules are configured.</td></tr>}
                {filteredRules.map((rule) => {
                  const isHigh = rule.severity === 'high';
                  const isMed = rule.severity === 'medium';
                  const SeverityIcon = isHigh ? AlertCircle : isMed ? AlertTriangle : Info;

                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/75 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                        {rule.id}
                      </td>
                      <td className="py-3 px-4 text-slate-700 uppercase tracking-wide text-[11px] font-semibold">
                        {rule.category.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            isHigh
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : isMed
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-blue-50 text-blue-800 border-blue-300'
                          }`}
                        >
                          <SeverityIcon className="w-3 h-3" />
                          {rule.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-normal max-w-md">
                        {rule.text}
                      </td>
                      <td className="py-3 px-4">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.active}
                            onChange={() => handleToggleRule(rule.id)}
                            disabled={role !== 'admin'}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            aria-label={`Toggle active status for rule ${rule.id}`}
                          />
                          <span className="ml-2 text-xs text-slate-600 font-medium">
                            {rule.active ? 'Active' : 'Disabled'}
                          </span>
                        </label>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          ref={(el) => (triggerRefs.current[rule.id] = el)}
                          type="button"
                          onClick={() => setActiveRuleId(rule.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Approved Facts Table */}
      {activeTab === 'facts' && (
        <div className="space-y-3">
        {role === 'admin' ? (
          <button type="button" onClick={() => setFactForm({ subject: '', value: '', source: '', validUntil: '' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" /> Add approved fact
          </button>
        ) : <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded p-3">
          Approved facts are read-only unless the selectable demo Admin role is active. This role is not secure authentication.
        </p>}
        {factForm && (
          <form onSubmit={handleSaveFact} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white rounded border border-slate-200">
            <label className="text-xs font-semibold text-slate-700">Subject
              <input required maxLength={120} value={factForm.subject} onChange={(e) => setFactForm({ ...factForm, subject: e.target.value })} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Valid until
              <input required type="date" value={factForm.validUntil} onChange={(e) => setFactForm({ ...factForm, validUntil: e.target.value })} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Verified fact value
              <textarea required maxLength={1000} value={factForm.value} onChange={(e) => setFactForm({ ...factForm, value: e.target.value })} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" rows={2} />
            </label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Evidence/source reference
              <input required maxLength={300} value={factForm.source} onChange={(e) => setFactForm({ ...factForm, source: e.target.value })} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5" />
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setFactForm(null)} className="px-3 py-1.5 text-xs border rounded">Cancel</button>
              <button type="submit" disabled={savingFact} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-50">{savingFact ? 'Saving...' : 'Save fact'}</button>
            </div>
          </form>
        )}
        <div className="bg-white rounded border border-slate-200 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Verified Fact Value</th>
                <th className="py-3 px-4">Source Reference</th>
                <th className="py-3 px-4">Valid Until</th>
                {role === 'admin' && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facts.map((fact) => (
                <tr key={fact.id} className="hover:bg-slate-50/75 transition">
                  <td className="py-3 px-4 font-semibold text-slate-900">{fact.subject}</td>
                  <td className="py-3 px-4 text-slate-800 font-mono text-[11.5px]">
                    {fact.value}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{fact.source}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{fact.validUntil}</td>
                  {role === 'admin' && <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button type="button" onClick={() => setFactForm({ ...fact })} aria-label={`Edit ${fact.subject}`} className="p-1.5 text-blue-700 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => handleDeleteFact(fact)} aria-label={`Delete ${fact.subject}`} className="p-1.5 text-rose-700 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>}
                </tr>
              ))}
              {!facts.length && <tr><td colSpan={role === 'admin' ? 5 : 4} className="p-6 text-center text-xs text-slate-500">No approved facts are configured.</td></tr>}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Rule Drawer */}
      <RuleDrawer
        ruleId={activeRuleId}
        rule={rules.find((item) => item.id === activeRuleId)}
        isOpen={Boolean(activeRuleId)}
        onClose={() => setActiveRuleId(null)}
        triggerRef={{ current: triggerRefs.current[activeRuleId] }}
      />
    </div>
  );
}
