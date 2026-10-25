# BrandGuard AI — QA Test Cases

Local audit only. These statuses describe execution in this cloned workspace; they do not imply production or cloud validation.

| Test ID | Feature | Test Scenario | Expected | Actual | Status | Severity |
|---|---|---|---|---|---|---|
| ENV-01 | Runtime | Check installed Node.js and npm against README minimums | Node >=18 and npm >=9 | Node v24.16.0 and npm v11.13.0 | PASS | Low |
| ENV-02 | Dependencies | Run tests with backend dependencies absent, then install from existing server lockfile and retry | Dependencies install reproducibly; tests run | Initial backend test load was blocked; `npm ci --prefix .\server` resolved it without manifest changes | PASS | Medium |
| ENV-03 | Automated tests | Run root `npm test` | All automated tests pass | 49 tests passed; README's documented count of 43 is stale | PASS | Low |
| ENV-04 | UI tests | Run `npm run test:ui` | Focused UI tests pass | 4 tests passed | PASS | Low |
| ENV-05 | Production build | Run `npm run build` | Vite production build completes | Build completed successfully | PASS | Low |
| ENV-06 | Frontend startup | Detect the existing frontend before startup | Reuse existing server; avoid duplicate instance | Existing Vite server on port 3000 was used; no duplicate started | PASS | Low |
| ENV-07 | Backend health | Start local API and request `/api/health` | Healthy response with storage mode | Health returned OK with embedded storage mode | PASS | Medium |
| ENV-08 | API connectivity | Use browser UI against local backend | API requests work from frontend | Local browser/API flows worked | PASS | Medium |
| ENV-09 | CORS | Request API with arbitrary Origin | Only configured origins should be allowed | Response included `Access-Control-Allow-Origin: *` | FAIL | Medium |
| ENV-10 | Mongo configuration | Start without Mongo URI and with invalid local Mongo URI | Clearly documented fallback or actionable failure | Both cases fell back to embedded storage; health remained available | PASS | Medium |
| ENV-11 | Persistence | Restart backend in embedded mode and reload tested draft/facts | Saved state remains | Draft revision/status and fact rows persisted through restart | PASS | Medium |
| ENV-12 | Deployment | Verify Render frontend talks to Render API | Deployed UI calls configured API | No deployment performed; inspected config lacks `VITE_API_URL` while client defaults to localhost | NOT TESTED | High |
| ENV-13 | Setup documentation | Follow the README reference to `.env.production.example` | Referenced template exists or docs omit it | File is absent; `server/.env.example` exists | FAIL | Low |
| REV-01 | Content scan | Scan ordinary marketing copy | No false findings for clean text | Clean sample returned no findings | PASS | Medium |
| REV-02 | Content scan | Scan `guaranteed`, `best`, and `#1` examples | Configured absolute-claim patterns found with explanations/suggestions | R-1 high-severity findings and spans were shown | PASS | High |
| REV-03 | Content scan | Scan bare `100%` absolute claim | Percentage claim detected or explicitly unsupported | Bare `100%` produced no finding; `100% guaranteed` only matched `guaranteed` | FAIL | High |
| REV-04 | Content scan | Scan examples for R-4 trademark and R-9 APR/disclosure rules in deterministic mode | Enabled applicable rules are evaluated | No R-4 or R-9 findings were returned | FAIL | High |
| REV-05 | Content scan | Scan terminology `users` and accessibility phrase `CLICK HERE` | Matching rules highlight expected spans | R-7 and A-2 findings appeared with expected categories/severity | PASS | Medium |
| REV-06 | Content scan | Scan multiline, Unicode, emoji, and special-character input | Scanner handles text and offsets without crash/corruption | Requests completed; supported patterns were found in mixed text | PASS | Medium |
| REV-07 | Content scan | Scan 48,000-character input | Request handled without unhandled failure | API accepted the long text and returned a result | PASS | Medium |
| REV-08 | Content scan | Scan empty text | Empty input handled without server crash | API returned successfully with no findings; no empty-input business rule was specified | PASS | Low |
| REV-09 | Rescan | Change text and rescan | Findings are recalculated from current text | Updated results reflected current text | PASS | Medium |
| FIND-01 | Suggested fixes | Accept an in-span suggested correction | Only the quoted span changes; unaffected text remains | Replacement applied and surrounding text remained unchanged | PASS | Medium |
| FIND-02 | Revision history | Accept correction and refresh/restart | Revision appears and persists | New version/history persisted across refresh and backend restart | PASS | Medium |
| FIND-03 | Dismissal | Dismiss finding without a reason | Request should be rejected | UI/API required a non-empty reason | PASS | Medium |
| FIND-04 | Dismissal | Dismiss finding with a reason, then rescan unchanged text | Dismissed state and justification remain | Finding reappeared active after scan | FAIL | Medium |
| FIND-05 | Draft editing | Type a new edit without accepting a finding, then refresh | Save/create behavior persists the edit | Original persisted draft returned; no draft-save endpoint exists | FAIL | Medium |
| FIND-06 | Offline handling | Stop backend, accept suggestion, refresh | Save failure is reported; no false persistence message | UI said “Saved revision”; refresh reverted the change | FAIL | Medium |
| RULE-01 | Rules | List, filter, inspect, and toggle rules | Rules render and toggles affect scanning | List/filter/drawer/toggle worked; toggled active state affected scan | PASS | Medium |
| RULE-02 | Rules | Update R-1 severity to low and rescan | Finding uses configured severity | Finding remained hardcoded high | FAIL | Medium |
| RULE-03 | Rules | Disable a rule, then inspect its drawer | Drawer reflects disabled state | Drawer still displayed “Enabled” | FAIL | Low |
| RULE-04 | Facts | Add a valid approved fact and reload list | Fact is created and persists | Fact was accepted and persisted in embedded store | PASS | Medium |
| RULE-05 | Facts | Add duplicate fact and invalid date | Invalid/duplicate data rejected | Duplicate and invalid date were accepted | FAIL | Medium |
| RULE-06 | Facts | Update or delete fact through UI | Supported controls exist when feature is claimed | Facts tab is read-only; no update/delete controls | FAIL | Medium |
| UP-01 | Upload | Upload TXT and Markdown files | Text is extracted accurately | TXT and Markdown extraction succeeded | PASS | Medium |
| UP-02 | Upload | Upload valid PDF and DOCX | Text is extracted accurately | PDF and DOCX extraction succeeded; DOCX also exercised in browser | PASS | Medium |
| UP-03 | Upload | Upload unsupported extension | Clear client error; no parsing | Unsupported extension rejected | PASS | Medium |
| UP-04 | Upload | Upload empty file | Clear validation error | Empty file was rejected | PASS | Medium |
| UP-05 | Upload | Upload malformed DOCX | Clear extraction error; no unhandled exception | Malformed DOCX was rejected with an extraction error | PASS | Medium |
| UP-06 | Upload | Upload file larger than 10 MiB through browser | Browser blocks upload with size message | Browser-side size validation rejected it | PASS | Medium |
| UP-07 | Upload/API | Send file larger than 10 MiB directly to API | Stable 4xx size error | Request returned HTTP 500 | FAIL | Medium |
| UP-08 | Upload/API | Upload `.txt` with `application/pdf` MIME header | Mismatched MIME rejected | File was accepted and parsed by extension | FAIL | Medium |
| FLOW-01 | Submission gate | Submit draft containing active high-severity finding | Submission is blocked | API/UI blocked submission with active high findings | PASS | High |
| FLOW-02 | Reviewer gate | Approve draft with active high-severity finding | Approval is blocked | API/UI blocked approval | PASS | High |
| FLOW-03 | Reviewer decision | Record Request Changes or Reject with comment | Decision and comment persist | Request Changes and Reject paths were exercised and recorded | PASS | Medium |
| FLOW-04 | Reviewer validation | Attempt decision without comment | Decision is rejected | Blank reviewer comment was blocked | PASS | Medium |
| FLOW-05 | Existing-draft workflow | Correct → rescan → submit → approve an existing draft | Status and text progress through expected flow | Existing-draft correction, rescan, submission, and approval path worked | PASS | High |
| FLOW-06 | New draft | Create a new draft through UI/API | New draft is created and persisted | No create-draft UI/API route exists | FAIL | High |
| FLOW-07 | Approval integrity | Edit content of an Approved draft through accept API | Approval revoked or edit rejected; risk remains visible | API accepted edit, retained Approved status, and queue showed zero high findings | FAIL | High |
| FLOW-08 | Role enforcement | Use creator role to invoke admin/reviewer APIs directly | Unauthorized action denied | Direct role-marked rule update and review decision succeeded | FAIL | High |
| FLOW-09 | Concurrency | Submit same draft twice concurrently | Idempotent result; no duplicate events | Both requests returned 200 and wrote events | FAIL | Medium |
| FLOW-10 | Concurrency | Accept simultaneous changes using same revision version | Unique ordered revision or conflict response | Duplicate version revisions were created | FAIL | Medium |
| API-01 | Resource validation | Request current review with nonexistent draft ID | 404 not found | Endpoint fell back to `draft-1` | FAIL | Medium |
| API-02 | Resource validation | Dismiss nonexistent finding | 404 not found; no success audit | 200 returned with `updated: null` | FAIL | Medium |
| API-03 | Resource validation | Accept finding on nonexistent draft | 404 not found | 200 returned with `draft: null` | FAIL | Medium |
| API-04 | Request validation | Submit blank dismissal reason / reviewer comment | 400-class validation response | Both required fields were enforced | PASS | Medium |
| API-05 | Error handling | Send malformed JSON | 400 response with stable message | 500 response included parser error details | FAIL | Low |
| API-06 | XSS | Dedicated harmless script/string execution test | User content remains inert in browser | Dedicated execution test not performed | NOT TESTED | Medium |
| API-07 | Injection | Dedicated injection-resistance test | Inputs handled as data and do not alter queries | Dedicated injection test not performed | NOT TESTED | Medium |
| API-08 | Secrets | Verify no API credentials are exposed in responses | No sensitive values disclosed | No credentials were configured; exhaustive response-secret test not performed | NOT TESTED | Medium |
| UI-01 | Navigation | Open Review, Queue, Rules, Audit, Analytics | All available pages load | All five pages opened in the local browser | PASS | Medium |
| UI-02 | Offline UI | Stop backend and inspect failure behavior | User sees clear unavailable/save failure state | Mock fallback rendered; accept action gave false saved indication | FAIL | Medium |
| UI-03 | Responsive | Check 390 px, 768 px, and 1440 px viewports | No unintended horizontal overflow | 390 px page had scrollWidth 526 px; no equivalent overflow observed at 768/1440 | FAIL | Low |
| UI-04 | Keyboard accessibility | Press Escape in Dismiss dialog and Rule Drawer | Both dialogs close and restore focus | Rule Drawer closed; Dismiss dialog stayed open | FAIL | Low |
| UI-05 | Accessibility audit | Run automated accessibility/axe or screen-reader review | Baseline accessibility issues identified | No automated accessibility audit run | NOT TESTED | Low |
| UI-06 | Browser console | Inspect logs during online and offline use | No unexpected application errors | `ERR_CONNECTION_REFUSED` appeared during intentional backend-offline test; no production browser checked | PASS | Low |
| UI-07 | Demo controls | Exercise Default Draft, Overlapping Spans Demo, Simulate Loading, and Simulate Error State | Demo fixtures load and their states resolve as labeled | Controls were inventoried but not individually exercised | NOT TESTED | Low |
| UI-08 | Analytics | Click Analytics Refresh and verify updated values | Metrics reload from current review store | Analytics page loaded; Refresh control was not individually exercised | NOT TESTED | Low |
| PERSIST-01 | Data cleanup | Restore test-mutated embedded store after QA | Original data is restored; fixtures removed | Store SHA-256 matched pre-test backup; named temporary fixtures removed | PASS | Medium |
