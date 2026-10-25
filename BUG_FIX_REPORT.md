# BrandGuard AI — Bug Fix Report

## Summary

The reported B-01–B-18 issues were addressed for the local college-prototype scope. The selectable Creator/Reviewer/Admin roles remain demo controls, not authentication. Deterministic scanning is explicitly limited to documented rule IDs; unsupported active rules are surfaced and block submission/approval. R-9 remains a heuristic requiring human review.

The original `QA_REPORT.md` and `TEST_CASES.md` were preserved unchanged. No commit, deployment, dependency change, or production-data change was made.

## Fixes

| Bug ID | Original Issue | Files Changed | Fix Implemented | Regression Test | Final Status |
|---|---|---|---|---|---|
| B-01 | Demo role selection was not enforced by API handlers. | `server/routes/api.js`, `src/App.jsx`, `src/api.js`, `README.md` | Added backend role guards for Creator, Reviewer, and Admin operations; kept and labeled the selectable demo-role switcher and documented that it is not identity security. | Backend permission-denial and role-workflow tests; full suite passed. | Addressed for demo-role prototype; not secure authentication. |
| B-02 | Approved text could change without losing Approved status; invalid finding IDs were accepted. | `server/routes/api.js`, `server/db.js`, `server/workflow-regression.test.js` | Validated finding/draft/version and transitions; editing approved text creates a new Draft revision; queue risk is derived from current content. | Approved-edit, invalid-ID, and queue/workflow regression tests. | Fixed. |
| B-03 | Deterministic scanner missed bare `100%`, R-4 and R-9, and could imply unsupported rules passed. | `server/services/reviewEngine.js`, `server/routes/api.js`, `server/reviewEngine-regression.test.js` | Added R-1 percentage, R-4 capitalization, and limited R-9 promotional disclosure checks; configured severity and active state are honored; unsupported active rules are reported and block workflow completion. | Positive, negative, edge, severity, enablement, and unsupported-rule regression tests. | Fixed within disclosed deterministic scope; R-9 is heuristic, not legal advice. |
| B-04 | Frontend API URL default bypassed deployment rewrites. | `src/api.js`, `vite.config.js`, `render.yaml`, `vercel.json`, `README.md` | Uses same-origin `/api` by default in local development and supports `VITE_API_URL` for separately hosted frontends without exposing server secrets. | Production build and local frontend/API checks passed; deployment configuration inspected. | Configuration fixed; deployed connectivity not tested. |
| B-05 | Rescanning reactivated dismissed findings and lost justifications. | `server/routes/api.js`, `server/db.js`, `src/pages/ReviewPage.jsx`, `server/workflow-regression.test.js` | Matching dismissals and reasons persist on unchanged content; changed revisions invalidate stale dismissals; restoration is supported and audited. | Rescan, changed-revision, restore, and justification regression tests. | Fixed. |
| B-06 | No persistent create/save workflow for ordinary edits. | `server/db.js`, `server/routes/api.js`, `src/api.js`, `src/pages/ReviewPage.jsx`, `src/components/DraftPanel.jsx`, `server/workflow-regression.test.js` | Added draft creation and version-checked saving, local unsaved-change recovery, revision history, and saved-draft routing. | Backend workflow tests; browser created a draft, saved v2, refreshed, and reloaded the saved text. | Fixed. |
| B-07 | Failed persistence could appear successful. | `src/api.js`, `src/pages/ReviewPage.jsx`, `src/components/FindingCard.jsx` | Removed success-shaped API fallbacks; failures remain actionable, preserve unsaved text, and allow retry. | Browser stopped the backend, observed the failure message and retained editor text, restarted the backend, retried, then reloaded the persisted revision. | Fixed. |
| B-08 | Oversized direct uploads produced HTTP 500. | `server/index.js`, `server/routes/api.js`, `server/server.test.js`, `server/step6-edge-cases.test.js` | Maps upload size errors to a safe client error (413) rather than an internal-server response. | Oversized upload API regression test. | Fixed. |
| B-09 | Upload MIME header was not checked against supported type/content. | `server/services/documentParser.js`, `server/server.test.js`, `server/step6-edge-cases.test.js` | Validates extension, MIME consistency, and file signatures for supported formats; rejects malformed and mismatched uploads. | Valid format, mismatched MIME/signature, unsupported, empty, and malformed-file regression tests. | Fixed. |
| B-10 | Missing drafts/findings could return success-shaped responses. | `server/routes/api.js`, `server/workflow-regression.test.js`, `server/step6-edge-cases.test.js` | Removed fallback behavior and return not-found errors before mutation or audit writes. | Missing-resource API regression tests. | Fixed. |
| B-11 | Concurrent submissions and stale saves could duplicate transitions/revisions. | `server/db.js`, `server/routes/api.js`, `server/workflow-regression.test.js` | Added optimistic version checks and state validation so stale/conflicting operations fail rather than create duplicate revisions or decisions. | Duplicate submission, stale revision, and conflicting-save regression tests. | Fixed. |
| B-12 | Scanner severity and rule detail status could disagree with configuration. | `server/services/reviewEngine.js`, `src/components/RuleDrawer.jsx`, `src/pages/RulesPage.jsx`, `server/reviewEngine-regression.test.js` | Reads configured active/severity values in scans and displays the current stored rule state. | Configured severity and enabled/disabled scanning regression tests. | Fixed. |
| B-13 | Facts accepted invalid/duplicate data and had no management UI. | `server/routes/api.js`, `src/pages/RulesPage.jsx`, `server/server.test.js` | Added validated create/update/delete controls, duplicate checks, date/length validation, and audit events. | Fact validation/API tests; browser created a temporary fact through the UI. | Fixed. |
| B-14 | Wildcard CORS and host-published MongoDB were unsafe defaults. | `server/index.js`, `server/.env.example`, `docker-compose.yml`, `render.yaml`, `README.md` | Restricts CORS to configured origins (with local development support) and removes the unnecessary MongoDB host-port publication. | Configuration inspected; test suites and build passed. | Fixed for local prototype configuration; production infrastructure not tested. |
| B-15 | Mobile layout overflowed at 390 px. | `src/App.jsx`, `src/pages/QueuePage.jsx` | Adjusted responsive navigation and page layout to fit narrow viewports. | Browser check at 390 px reported no horizontal overflow. | Fixed for the tested viewport. |
| B-16 | Dismiss dialog lacked Escape-key handling. | `src/components/DismissDialog.jsx` | Added Escape handling, keyboard navigation, and focus restoration behavior. | Synthetic Escape event closed the dialog; integrated browser's physical Escape input did not reliably trigger it. | Implemented; physical-key behavior needs manual confirmation. |
| B-17 | Malformed JSON returned 500 and parser details. | `server/index.js`, `server/server.test.js`, `server/step6-edge-cases.test.js` | Maps malformed JSON to a stable 400 response without exposing parser internals. | Malformed JSON API regression test. | Fixed. |
| B-18 | README referenced a missing `.env.production.example`. | `README.md` | Changed setup instructions to reference the existing `server/.env.example`. | Documentation reference inspected. | Fixed. |

## Validation

- `npm test` — **66 passed**, 7 test files.
- `npm run test:server` — **62 passed**, 6 test files.
- `npm run test:ui` — **4 passed**, 1 test file.
- `npm run build` — passed.
- Browser checks covered all five pages, draft create/save/refresh, backend-unavailable save/retry, an approved-fact creation, and browser loading after backend restart.
- Embedded persistence was verified across backend restart. The original `server/data/brandguard_store.json` remained unchanged; browser and test writes used isolated temporary storage, which was removed afterward.

## Remaining caveats

- Demo roles are selectable and therefore are not secure authentication.
- Only R-1, R-7, A-2, R-4, and limited heuristic R-9 checks are deterministic. R-9 needs human review; no LLM provider was configured or tested.
- Cloud deployment, live MongoDB, full accessibility, and dedicated XSS/injection testing were not performed.
- The integrated browser did not reliably send a physical Escape keystroke to the dismissal dialog; verify that interaction manually before relying on it.
