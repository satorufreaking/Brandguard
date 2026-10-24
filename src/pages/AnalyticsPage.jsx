import React, { useEffect, useState } from 'react';
import { fetchGovernanceAnalyticsAPI, fetchLLMStatusAPI } from '../api';
import {
  BarChart3,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RefreshCw,
  Cpu,
  Layers,
  Award,
} from 'lucide-react';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [llmStatus, setLlmStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [analyticsRes, llmRes] = await Promise.all([
        fetchGovernanceAnalyticsAPI(),
        fetchLLMStatusAPI(),
      ]);
      setData(analyticsRes);
      setLlmStatus(llmRes);
    } catch (err) {
      setError(err.message || 'Failed to load governance analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const severityBadgeClass = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-[calc(100vh-57px)] bg-slate-50 py-8 px-6 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Governance Analytics</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Data
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Violations, rule compliance rates, and frequency metrics calculated from actual persisted reviews.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {llmStatus && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border bg-white border-slate-300 text-slate-700">
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                {llmStatus.mode}
              </span>
            )}
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading && !data && (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Calculating governance metrics from review store...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    Total Drafts
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">
                    {data.totalDrafts}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Managed in review queue</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    Compliance Rate
                  </span>
                  <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                    {data.complianceRate}%
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Drafts cleared or approved</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    Total Violations
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">
                    {data.totalViolations}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Flagged across reviews</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    High Risk Issues
                  </span>
                  <span className="text-2xl font-bold text-rose-600 mt-1 block">
                    {data.severityBreakdown?.high || 0}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Approval-blocking items</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Most Frequently Violated Brand Rules */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Most Frequently Violated Brand Rules</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ranked by occurrence count and percentage of total review violations.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-500">
                  {data.mostViolatedRules?.length || 0} Active Violations
                </span>
              </div>

              {data.mostViolatedRules?.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  All drafts are compliant! No rule violations detected.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {data.mostViolatedRules.map((rule, index) => (
                    <div key={rule.ruleId} className="p-5 hover:bg-slate-50/60 transition">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                            #{index + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {rule.code || rule.ruleId}
                              </span>
                              <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${severityBadgeClass(rule.severity)}`}>
                                {rule.severity}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 capitalize">
                                {rule.category?.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-900 mt-1">{rule.text}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{rule.summary}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0 md:min-w-[220px] justify-between md:justify-end">
                          <div className="w-32 bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200 hidden sm:block">
                            <div
                              className={`h-full rounded-full ${
                                rule.severity === 'high'
                                  ? 'bg-rose-500'
                                  : rule.severity === 'medium'
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.max(rule.percentage, 8)}%` }}
                            />
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-900 block font-mono">
                              {rule.count} {rule.count === 1 ? 'violation' : 'violations'}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 font-mono">
                              {rule.percentage}% of total
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Severity Breakdown & Category Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Severity Breakdown Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                  Severity Risk Distribution
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-rose-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        High Severity (Blocker)
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {data.severityBreakdown?.high || 0} ({data.totalViolations > 0 ? Math.round(((data.severityBreakdown?.high || 0) / data.totalViolations) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-rose-500 h-2 rounded-full"
                        style={{
                          width: `${data.totalViolations > 0 ? ((data.severityBreakdown?.high || 0) / data.totalViolations) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-amber-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Medium Severity (Terminology & Voice)
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {data.severityBreakdown?.medium || 0} ({data.totalViolations > 0 ? Math.round(((data.severityBreakdown?.medium || 0) / data.totalViolations) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{
                          width: `${data.totalViolations > 0 ? ((data.severityBreakdown?.medium || 0) / data.totalViolations) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-blue-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Low Severity (Accessibility & Formatting)
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {data.severityBreakdown?.low || 0} ({data.totalViolations > 0 ? Math.round(((data.severityBreakdown?.low || 0) / data.totalViolations) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${data.totalViolations > 0 ? ((data.severityBreakdown?.low || 0) / data.totalViolations) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Policy Category Distribution */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                  Violations by Category
                </h3>
                <div className="space-y-2">
                  {Object.entries(data.categoryBreakdown || {}).map(([cat, count]) => {
                    const pct = data.totalViolations > 0 ? Math.round((count / data.totalViolations) * 100) : 0;
                    return (
                      <div key={cat} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                        <span className="text-xs font-medium text-slate-700 capitalize flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          {cat.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-900">{count}</span>
                          <span className="text-[11px] font-mono text-slate-400">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
