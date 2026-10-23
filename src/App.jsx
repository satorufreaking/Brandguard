import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import ReviewPage from './pages/ReviewPage';
import QueuePage from './pages/QueuePage';
import RulesPage from './pages/RulesPage';
import AuditPage from './pages/AuditPage';
import { Shield } from 'lucide-react';

function TopNav() {
  const navLinkClass = ({ isActive }) =>
    `px-4 py-2.5 text-xs font-semibold transition border-b-2 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
      isActive
        ? 'border-blue-600 text-blue-700 bg-blue-50/40'
        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }`;

  return (
    <nav className="bg-white border-b border-slate-200 px-6 sticky top-0 z-40" aria-label="Main Navigation">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2 py-3">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">BrandGuard</span>
          </div>

          {/* Nav Links: Review | Queue | Rules | Audit */}
          <div className="flex items-center gap-1">
            <NavLink to="/review" className={navLinkClass}>
              Review
            </NavLink>
            <NavLink to="/queue" className={navLinkClass}>
              Queue
            </NavLink>
            <NavLink to="/rules" className={navLinkClass}>
              Rules
            </NavLink>
            <NavLink to="/audit" className={navLinkClass}>
              Audit
            </NavLink>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>Acme Fintech</span>
          <span className="text-slate-300">/</span>
          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Governance Active
          </span>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
        <TopNav />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/review" replace />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
