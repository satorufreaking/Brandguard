# BrandGuard AI — Test Cases After Fix

Statuses reflect only checks actually executed in this workspace. Browser checks used the local application and an isolated temporary embedded store. No live cloud deployment, MongoDB instance, paid LLM, or production data was used.

| Test ID | Feature | Test Scenario | Expected | Actual | Status | Severity |
|---|---|---|---|---|---|---|
| AUTO-01 | Automated suite | Run `npm test` | All automated and regression tests pass | 7 files passed; 66 tests passed. | PASS | High |
| AUTO-02 | Backend suite | Run `npm run test:server` | Backend/API regression suite passes | 6 files passed; 62 tests passed. | PASS | High |
| AUTO-03 | Frontend suite | Run `npm run test:ui` | UI logic suite passes | 1 file passed; 4 tests passed. | PASS | Medium |
| AUTO-04 | Production build | Run `npm run build` | Frontend production assets build | Vite build completed successfully. | PASS | High |
| B-01 | Demo roles | Attempt disallowed creator/admin/reviewer API actions | Backend rejects role-disallowed operations | Backend role-enforcement regression tests passed; role switch remains selectable and is not authentication. | PASS | High |
| B-02 | Approval integrity | Modify an approved draft; send stale or invalid finding references | Edit invalidates approval or is rejected; current risk remains visible | Approved edits create a new Draft revision; invalid resources and stale workflow actions are rejected by regression tests. | PASS | High |
| B-03 | Scanner coverage | Check bare `100%`, R-4/R-9, configured severity/status, clean and edge inputs | Supported checks emit correct findings; unsupported active rules are disclosed and cannot silently pass | Scanner regression tests passed. R-9 is a limited heuristic; unsupported active rules block submit/approval. | PASS | High |
| B-04 | API configuration | Inspect local default and deployment override | Local `/api` proxy works; deployed API origin is configurable without frontend secrets | Configuration and production build checked; no deployed frontend/backend was available. | PASS | High |
| B-04-DEPLOY | Deployment | Exercise browser-to-API on deployed services | Deployed requests reach the intended API | No deployment was performed. | NOT TESTED | High |
| B-05 | Dismissal persistence | Dismiss, rescan unchanged text, restore; change content and rescan | Unchanged dismissal/reason persists; new revision does not inherit stale dismissal | Backend dismissal/rescan/restoration regression tests passed. | PASS | Medium |
| B-06 | Draft workflow | Create, edit, save, refresh, and reopen a draft | Saved draft and revision persist and reload | Browser created a temporary draft, saved v2, refreshed, and confirmed text/version reloaded. Backend versioned-save tests passed. | PASS | High |
| B-07 | Save error handling | Stop backend, save edits, restore backend, retry | No false success; retain local text and provide retry | UI showed a save error, retained the edited text, then retried successfully after backend restart; v2 persisted after refresh. | PASS | Medium |
| B-08 | Upload size | POST an oversized file directly to the API | Return a clear 4xx size response | Backend oversized-upload regression test passed for the corrected client error handling. | PASS | Medium |
| B-09 | Upload validation | Check supported files, mismatched MIME/signature, malformed and empty uploads | Accept valid supported formats; reject invalid or inconsistent inputs | Parser/API regression tests passed for type, MIME, signature, and malformed-file cases. | PASS | Medium |
| B-10 | Resource errors | Request nonexistent draft/finding resources | Return not-found response without misleading success/audit | Missing-resource regression tests passed. | PASS | Medium |
| B-11 | Concurrency | Submit duplicates and save against stale versions | Reject conflicting transitions; do not create duplicate revisions | Workflow regression tests passed for duplicate/stale operations. | PASS | Medium |
| B-12 | Rule management | Change rule severity/active state and inspect displayed status | Scan severity and UI status match configuration | Backend configured-severity/enablement tests passed; Rules page loaded in browser. | PASS | Medium |
| B-13 | Approved facts | Validate duplicates, invalid entries, and UI management | Invalid data rejected; facts can be managed and audited | Backend fact tests passed; browser created a temporary valid fact and saw it in the list. | PASS | Medium |
| B-14 | Configuration safety | Inspect CORS allowlist and Docker Mongo port exposure | Avoid wildcard CORS and unnecessary public database port | Configuration was inspected; unrestricted Mongo host-port publication was removed. No production network deployment was tested. | PASS | Medium |
| B-15 | Responsive UI | Check 390 px layout for horizontal overflow | Page fits viewport | Browser measurement reported no horizontal overflow at 390 px. | PASS | Low |
| B-16 | Dialog keyboard | Press Escape in Dismiss dialog | Dialog closes and focus is restored | Synthetic Escape event closed the dialog; physical Escape input did not reliably trigger in the integrated browser. | NOT TESTED | Low |
| B-17 | API validation | Send malformed JSON | Stable 400 response without parser internals | Malformed-JSON regression test passed. | PASS | Low |
| B-18 | Documentation | Check environment-template reference | README points to an existing example | README now references `server/.env.example`; stale reference removed. | PASS | Low |
| UI-01 | Navigation | Open Review, Queue, Rules, Audit, and Analytics | Each page loads without application error | All five local pages opened; no page alert was observed. | PASS | Medium |
| UI-02 | Facts UI | Add a valid temporary fact | UI confirms the backend-created fact | Fact appeared in the list after API confirmation. It was stored only in the isolated temporary QA store. | PASS | Medium |
| PERSIST-01 | Persistence | Restart backend and reload data | Saved drafts/facts remain available | Health returned `ok`; a temporary fact survived restart. A saved draft v2 also reloaded from the backend after refresh. | PASS | High |
| PERSIST-02 | Data safety | Compare original embedded data store after tests | Existing application data remains unchanged | Original `server/data/brandguard_store.json` SHA-256 remained `D51D26C7B7FD05A6802B8A4C07E3EFAF9104C2FBFA5CFDA973055EBF178807CE`; isolated temporary store was removed. | PASS | High |
| EXT-01 | LLM review | Exercise a configured external provider | Provider responds and validates findings | No provider credentials were configured; no paid API was used. | BLOCKED | Medium |
| EXT-02 | MongoDB | Exercise persistence against live MongoDB | Data persists through configured Mongo instance | No live MongoDB instance was configured. | NOT TESTED | Medium |
| EXT-03 | Security | Dedicated XSS/injection and full accessibility audit | Inputs remain safe and accessibility issues are identified | Dedicated exploit-string execution/injection and axe/screen-reader audits were not run. | NOT TESTED | Medium |
