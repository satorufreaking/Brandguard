# BrandGuard AI — Independent QA Audit

## Executive summary

**Verdict: NOT READY for final submission as a functioning brand-compliance approval system.**

The local application installs, starts, builds, and passes its existing automated suite. The principal screens and several end-to-end paths work in a local browser. However, the audit found release-blocking security and workflow-integrity defects:

1. **There is no real authentication or server-side role enforcement.** A caller without credentials can obtain a profile marked authenticated, change policy rules, and record review decisions.
2. **Approved content can be changed while retaining the Approved status.** The review queue then reports zero high-risk findings for that approved item.
3. **The default deterministic scanner does not implement all configured policy rules and misses bare `100%` claims.**
4. **The Render frontend configuration does not set the API base URL, while the frontend defaults to `http://localhost:5000`; the documented Render deployment is therefore not wired to its deployed API by default.**

Additional correctness issues affect dismissal persistence, draft saving, offline behavior, upload validation, resource validation, and concurrent operations. These findings were reported, not fixed. **No application source was modified.** QA changes were confined to the requested reports. The original embedded data store was restored and its SHA-256 matched the pre-test backup; the backend was stopped and named temporary QA fixtures were removed.

## Project overview

The README describes BrandGuard AI as a pre-publication review tool for marketing and compliance teams. A creator reviews content against brand rules, resolves or dismisses findings, and submits a draft; a reviewer can approve, request changes, or reject it. Admin-like policy management, approved facts, analytics, and an audit timeline are also presented.

The implementation is a React/Vite frontend and Express API. It stores data in MongoDB when configured, otherwise in a local JSON-backed embedded store. The review engine combines hardcoded deterministic checks with optional OpenAI, Gemini, or Anthropic semantic review. No LLM credentials or MongoDB service were configured during this audit, so testing used deterministic mode and embedded storage only. The role selector is a demo identity mechanism, not authentication.

### Intended users and user workflow

- **Creator:** edits text in the review screen, uploads a document for extraction, scans content, accepts suggestions or dismisses findings with a justification, and submits for review.
- **Reviewer:** opens an item from the queue and records Approve, Request Changes, or Reject with a required comment.
- **Policy administrator:** enables/disables rules and can update rule data through the API. The UI does not provide full rule CRUD.
- **Compliance/leadership user:** views the audit timeline and governance analytics.

The implemented local flow for an existing draft is: open Review or Queue → load a draft → edit/scan → accept a suggestion (which creates a revision) or dismiss with a reason → submit when no active high-severity findings remain → reviewer decision with a comment. The tested existing-draft correction/submission/approval path worked, subject to the defects listed below. A complete create-new-draft workflow is not implemented: there is no draft-creation endpoint or draft-save endpoint.

## Feature inventory

| Surface | Implemented behavior observed | Limitations / status |
|---|---|---|
| `/review` | Review workspace; text editing; run review; finding highlights; suggested fixes; mandatory dismissal justification; upload/extract; revision display; submit and reviewer decisions | Text edits are local until a suggestion is accepted; no create/save-draft action. Demo role is not an authorization boundary. |
| `/queue` | Lists drafts, status, version, risk counts, and routes to a selected review item | Approved items are excluded from high-risk calculation, including after their text is changed. |
| `/rules` | Rules list, category filtering, rule details, active toggles; facts list | Toggle is supported. No UI to create/delete rules or create/update/delete facts; rule detail uses mock data and can show a stale enabled state. |
| `/audit` | Displays persisted audit events | Events are generated for several operations; duplicate concurrent requests can create duplicate entries. |
| `/analytics` | Displays governance statistics and risk summaries | Local screen loaded; calculations were not independently reconciled against a production-like dataset. |
| Review engine | Deterministic checks for R-1 absolute claims, R-7 terminology, and A-2 accessibility link text; optional LLM adapter | Deterministic mode does not cover all seeded rules. Live LLM providers were unavailable and not tested. |
| Document extraction | PDF, DOCX, TXT, and Markdown extraction; optional scan during upload; 10 MiB limit | Extension is validated, but MIME is not. Oversized direct API upload returns HTTP 500. Upload extracts text; it does not create a persisted draft by itself. |
| Persistence | Embedded JSON store; MongoDB/Mongoose path when configured; revisions, rules, findings, decisions, facts, and audit data | Embedded storage survived a local backend restart. MongoDB was not configured. Cloud persistence was not tested. |
| Authentication / roles | Hardcoded creator, reviewer, and admin profiles; frontend role switch | **Demo-only.** No credentials, authenticated session, or server-side role enforcement. |

### Pages, controls, and API inventory

The five application pages are Review, Queue, Rules, Audit, and Analytics. The main interactive controls tested include navigation, role switch, text editor, Run Review, upload, Accept, Dismiss/justification, Submit, reviewer decision buttons/comment, rule category filter/toggle/detail drawer, and Rules/Facts tabs. The Facts screen is read-only. No registration, sign-in, new-draft, or save-draft form is present.

The implemented control inventory also includes: Review header status/role switch and Submit/Approve action; demo controls **Default Draft (3 Rules)**, **Overlapping Spans Demo**, **Simulate Loading**, and **Simulate Error State**; draft **Upload PDF/DOCX**, **Edit text / View highlights**; findings filters (**All Active**, **High**, **Medium**, **Low**, **Dismissed**), rule-detail links, **Accept Fix**, **Dismiss**, and **Restore Finding**; Queue **Open in Reviewer Mode**; Rules/Facts tabs, category buttons, active switches, and rule-detail actions; Dismiss dialog justification field and close/confirm buttons; reviewer comment field and **Approve**, **Request changes**, **Reject**; and Analytics **Refresh**. Audit is a read-only timeline. The demo-state and analytics-refresh controls were inventoried but not individually exercised; see the BLOCKED/NOT TESTED rows in [TEST_CASES.md](TEST_CASES.md).

The backend exposes these 18 routes (all under `/api`):

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health and storage mode |
| GET | `/rules` | List rules |
| PUT | `/rules/:id` | Update a rule |
| GET | `/facts` | List approved facts |
| POST | `/facts` | Add an approved fact |
| GET | `/reviews/current` | Load draft and current findings |
| POST | `/reviews/run` | Scan text |
| POST | `/reviews/accept` | Apply fix / add revision |
| POST | `/reviews/dismiss` | Dismiss finding |
| POST | `/reviews/submit` | Submit draft |
| POST | `/reviews/decision` | Record reviewer decision |
| GET | `/queue` | Review queue |
| GET | `/audit` | Audit events |
| POST | `/documents/extract` | Extract uploaded document text |
| GET | `/analytics/governance` | Governance analytics |
| GET | `/llm/status` | LLM configuration status |
| GET | `/auth/me` | Return demo profile |
| POST | `/auth/switch-role` | Return selected demo profile |

## Technology, environment, and dependencies

- **Frontend:** React 19, Vite 6, React Router 7, Tailwind CSS 3, Vitest.
- **Backend:** Node.js ES modules, Express 4, Mongoose, Multer, Mammoth, `pdf-parse`, dotenv, CORS, Vitest, Supertest.
- **Storage:** MongoDB if available/configured; JSON embedded fallback otherwise.
- **Optional external service:** LLM provider API key (OpenAI, Gemini, or Anthropic). No provider was configured or called.
- **Authentication:** hardcoded demo profiles only; no actual authentication.
- **Runtime observed:** Node.js v24.16.0, npm v11.13.0; above README minimums (Node 18/npm 9).
- **Environment:** no actual `.env` was used. `server/.env.example` documents `PORT`, optional `MONGODB_URI`, and optional LLM keys. No secret values are included in this report.
- **Services:** frontend was already listening on port 3000 (left running); backend was started locally on port 5000 for testing and stopped afterward. MongoDB and paid/external APIs were not used.

## Environment and build validation

| Check | Result | Evidence / notes |
|---|---|---|
| Node/npm compatibility | PASS | Observed Node v24.16.0 and npm v11.13.0; README requires Node >=18 and npm >=9. |
| Backend dependency installation | PASS after setup | Initial backend test discovery could not load missing server packages. Ran `npm ci --prefix .\server` from the project workspace using the existing lockfile; no package manifest changes were made. |
| Frontend dependency availability | PASS | Existing frontend dependencies supported tests and production build. |
| Full automated tests | PASS | `npm test`: **49 passed**. README still documents 43 tests, so its count is stale. |
| Focused UI tests | PASS | `npm run test:ui`: **4 passed**. |
| Production build | PASS | `npm run build` completed successfully. |
| Frontend startup | PASS | Detected the already-running Vite process on port 3000; did not start a duplicate. Browser pages loaded. |
| Backend startup and health | PASS | Started backend locally; `/api/health` returned healthy status and embedded storage mode. |
| Frontend/backend connectivity and CORS | PARTIAL / FAIL | Local browser/API calls worked. API also returned `Access-Control-Allow-Origin: *` to an arbitrary test origin (see B-13). |
| Missing/invalid Mongo configuration | PASS as fallback behavior | Missing URI and an invalid local Mongo URI resulted in embedded mode; local health was available. |
| Backend restart persistence | PASS | Local draft revision/status and facts persisted through a backend restart in embedded mode. |
| Deployment validation | NOT TESTED | No external deployment was made. Render configuration was inspected and has a likely frontend API-base blocker (B-04). |
| Dependency vulnerability scan | NOT TESTED | No dependency audit/scanner was run as part of this QA pass. |

The first test invocation was blocked by absent backend dependencies; installing the repository's locked backend dependencies resolved it. No subsequent automated test or build failure was observed.

## Functional and integration results

### Content review

- Normal marketing text, clean text, multiline text, Unicode/emoji/special characters, empty text, and a 48,000-character request were exercised locally.
- The deterministic engine found the configured examples for `guaranteed`, `best`, `#1`, `users`, and `CLICK HERE`; offsets/highlights, severities, explanations, and suggested replacements were checked in the browser.
- Accepting a suggested replacement changed the intended span and preserved surrounding text. The accepted revision appeared in revision history and survived refresh/backend restart.
- Rescanning recalculated findings, but a previously dismissed finding became active again (B-05).
- Bare `100%` was not reported. A `100% guaranteed` sample was reported only because the word `guaranteed` matched.
- In deterministic mode, configured trademark (R-4) and APR/disclosure (R-9) cases produced no findings (B-03).

### Findings, rules, and facts

- A blank dismissal reason was rejected in the UI/API; a non-empty justification was accepted and recorded.
- Rule list, category filtering, toggles, and drawer navigation were exercised. Toggling a rule affected scanning. Updating a rule's severity to `low` did not change the emitted hardcoded `high` severity for the absolute-claim finding. The drawer showed “Enabled” for a disabled rule.
- Facts could be listed and added through the API. Duplicate facts and an invalid date string were accepted. The UI provides no fact editing or deletion control.
- Revision history was checked after accepted changes and restart. Dismissals were not durable across a subsequent rescan.

### Uploads

- TXT, Markdown, PDF, and a valid DOCX file were extracted; DOCX extraction was also exercised from the browser.
- Unsupported extension, empty file, and malformed DOCX were rejected.
- Browser-side size validation rejected a file larger than 10 MiB. The same size limit exercised directly against the API resulted in HTTP 500 instead of a client error (B-08).
- A `.txt` upload with an `application/pdf` MIME header was accepted (B-09).
- Extracted content could be scanned/edited in the UI, but extraction alone did not create a persisted draft.

### Creator / reviewer workflow

- Existing-draft scan, correction, submit, and approval were exercised. Submission and approval were blocked when active high findings remained; after remediation the existing draft could be submitted and approved.
- Reviewer comments were required. Request Changes and Reject decisions were exercised.
- A full “new draft → request changes → edit → resubmit → approve” workflow was not completed because new draft creation and normal draft saving are absent.
- A direct API edit to an already Approved draft left it Approved while adding an active high finding; the queue then reported zero high findings for the approved item (B-02).
- Direct Creator-role API operations were not blocked. Two concurrent submissions both succeeded and recorded events; concurrent accepts could create duplicate revision versions (B-11).

### Persistence, API behavior, and UI

- Embedded data survived a local backend restart. The pre-test embedded JSON store was restored afterward; its hash matched the saved pre-test hash.
- Browser navigation covered the five pages. Existing review, queue, rule, facts, audit, analytics, upload, and decision interactions were exercised.
- With the backend stopped for an offline test, the UI announced “Saved revision” after a local fallback but the change was absent after refresh (B-07).
- Mobile width 390 px had horizontal overflow (`scrollWidth` 526 px). Tablet/desktop widths 768/1440 px were also checked; no equivalent overflow was observed there.
- The Dismiss dialog did not close on Escape. The Rule Drawer did close on Escape.
- Browser network logs included `ERR_CONNECTION_REFUSED` during the intentional backend-offline test. No production browser session or deployed UI was tested.
- A dedicated automated accessibility/axe audit was not run. Dedicated XSS execution and injection-resistance testing were not performed; inputs used in scanner testing were harmless strings.

## Security observations

### Release blockers

- **No authentication or authorization:** `/api/auth/me` reports `authenticated: true` without credentials; role is chosen by query/header. API routes accept actor/reviewer values from request bodies and do not enforce permissions. Direct unauthenticated rule updates and reviewer decisions succeeded. See B-01.
- **Approval-state bypass:** accepted arbitrary text changes on Approved content remain Approved, and queue computation hides its high findings. See B-02.
- **Open CORS:** `cors()` is unrestricted, and the API returns `Access-Control-Allow-Origin: *`. This is especially concerning in combination with unauthenticated state-changing routes. See B-13.
- **Docker Mongo exposure:** Compose publishes MongoDB on host port 27017 and configures no Mongo authentication. This was a configuration inspection finding; the Compose stack was not started. See B-13.
- **Deployment wiring:** Render's static site has an `/api/*` rewrite, but the client defaults to absolute `http://localhost:5000` and Render config does not set `VITE_API_URL`. The actual deployment was not tested. See B-04.

### API robustness and data integrity

- Malformed JSON returned 500 with parser error details instead of a client-error response.
- Oversized uploads returned 500 because the upload middleware's error reaches a global handler that always returns 500.
- Invalid draft/finding identifiers sometimes returned success-shaped responses rather than 404.
- MIME headers are not validated against the extension/content.
- Concurrent submissions/revisions were not made idempotent or serialized.
- No destructive testing, external target testing, or production testing was performed.

## Bug list

| ID | Severity | Feature | File / lines | Finding |
|---|---|---|---|---|
| B-01 | High | Authentication and role permissions | [server/index.js](server/index.js#L13); [server/routes/api.js](server/routes/api.js#L481) | Demo role selection is not authentication; state-changing routes have no server-side role guard. |
| B-02 | High | Approved draft integrity | [server/routes/api.js](server/routes/api.js#L176); [server/db.js](server/db.js#L302) | Accepted text changes can alter an Approved draft without changing status; queue suppresses its high-risk count. |
| B-03 | High | Content review coverage | [server/services/reviewEngine.js](server/services/reviewEngine.js#L9) | Deterministic rules only implement R-1, R-7, A-2; bare `100%`, R-4, and R-9 cases were missed. |
| B-04 | High | Deployment / API connectivity | [src/api.js](src/api.js#L5); [render.yaml](render.yaml#L26) | Render frontend build has no API URL override; absolute localhost default bypasses the configured relative API rewrite. |
| B-05 | Medium | Finding resolution | [server/routes/api.js](server/routes/api.js#L151); [server/db.js](server/db.js#L243) | Rescanning replaces findings without preserving dismissed statuses/reasons, so dismissed findings reappear. |
| B-06 | Medium | Draft creation and saving | [src/pages/ReviewPage.jsx](src/pages/ReviewPage.jsx#L207); [src/api.js](src/api.js#L368) | Text editing updates component state only; no draft-create/save endpoint. Refresh discards unaccepted edits. |
| B-07 | Medium | Offline/error handling | [src/api.js](src/api.js#L427) | Accept-fix network failure returns a success-shaped local revision; UI announces it was saved even though refresh loses it. |
| B-08 | Medium | Upload limits / API error handling | [server/routes/api.js](server/routes/api.js#L8); [server/index.js](server/index.js#L32) | Direct oversized upload is rejected by Multer but surfaced as HTTP 500 “Internal Server Error,” not a clear 4xx response. |
| B-09 | Medium | Upload type validation | [server/services/documentParser.js](server/services/documentParser.js#L8) | MIME allowlist is declared but not applied; a `.txt` with a mismatched PDF MIME header was accepted. |
| B-10 | Medium | API resource validation | [server/routes/api.js](server/routes/api.js#L102); [server/routes/api.js](server/routes/api.js#L247) | Unknown current draft falls back to `draft-1`; dismissing an unknown finding returns 200 with `updated: null`; accepting an unknown draft returns 200 with `draft: null`. |
| B-11 | Medium | Concurrency and audit integrity | [server/routes/api.js](server/routes/api.js#L286); [server/db.js](server/db.js#L208) | Concurrent submit requests both succeeded and wrote duplicate events; concurrent accepts could create duplicate revision versions. |
| B-12 | Medium | Rule administration | [server/services/reviewEngine.js](server/services/reviewEngine.js#L18); [src/components/RuleDrawer.jsx](src/components/RuleDrawer.jsx#L7) | Rule severity updates do not affect hardcoded finding severity; drawer reads mock rules and always labels the rule Enabled. |
| B-13 | Medium | Facts management | [server/routes/api.js](server/routes/api.js#L74); [src/pages/RulesPage.jsx](src/pages/RulesPage.jsx#L33) | Duplicate facts and invalid dates are accepted; UI has no fact create/update/delete workflow. |
| B-14 | Medium | Deployment hardening | [server/index.js](server/index.js#L13); [docker-compose.yml](docker-compose.yml#L24) | Wildcard CORS and an unauthenticated Mongo service exposed on host port 27017 are unsafe defaults for deployment. |
| B-15 | Low | Responsive UI | [src/App.jsx](src/App.jsx#L19) | At 390 px viewport width, document scroll width reached 526 px, requiring horizontal scrolling. |
| B-16 | Low | Dialog accessibility | [src/components/DismissDialog.jsx](src/components/DismissDialog.jsx#L8) | Dismiss dialog does not respond to Escape; Rule Drawer does. |
| B-17 | Low | API validation errors | [server/index.js](server/index.js#L32) | Malformed JSON returns 500 and includes parser error text rather than a client validation response. |
| B-18 | Low | Setup documentation | [README.md](README.md#L68) | README refers to `.env.production.example`, which is absent from the repository. |

### Detailed reproduction and remediation notes

#### B-01 — Missing authentication and role enforcement (High)

- **Reproduction:** Start the local API. Request `GET /api/auth/me` without a cookie or credential; it returns `authenticated: true`. Send an API request as a creator (including `x-brandguard-role: creator`) to update a rule or submit a reviewer decision. The tested direct role-marked rule change and decision were accepted.
- **Expected:** Unauthenticated requests are denied; server derives the principal and role from a verified session/token and checks the required permission for each operation.
- **Actual:** Role is supplied by request query/header/body and routes process state changes without permission middleware.
- **Root cause:** Hardcoded demo profiles and no auth/authorization middleware.
- **Suggested fix:** Implement server-validated sessions/identity and per-route permission checks; never trust role/actor/reviewer fields supplied by clients.

#### B-02 — Approved text can be changed without revoking approval (High)

- **Reproduction:** Approve a local draft; call `POST /api/reviews/accept` for that draft with arbitrary `newText` containing a high-severity R-1 phrase and a nonexistent finding ID. The API returned 200, the draft remained Approved, and the queue reported zero high findings.
- **Expected:** Approved content is immutable, or a new revision invalidates approval and enters the appropriate review state. Queue risk must reflect the current approved content.
- **Actual:** Arbitrary content is appended as a revision; no status transition/authorization check occurs, while queue calculation explicitly excludes Approved drafts.
- **Root cause:** Accept route does not validate finding identity or draft status; queue filters Approved content without rescanning it for risks.
- **Suggested fix:** Enforce allowed state transitions and revision ownership, verify the finding belongs to the current draft/version, invalidate approval on content change, and calculate risk from authoritative current content.

#### B-03 — Deterministic policy coverage is incomplete (High)

- **Reproduction:** With no LLM credentials, scan a bare `100%` statement and examples for seeded R-4 trademark and R-9 APR/disclosure rules. The deterministic response contained no corresponding findings. `guaranteed`, `best`, and `#1` did trigger R-1.
- **Expected:** All enabled rules represented as supported by the product are evaluated, or unsupported coverage is explicitly disclosed and cannot produce a clean approval.
- **Actual:** The deterministic implementation contains only R-1, R-7, and A-2 checks; no bare percentage or R-4/R-9 finding was emitted.
- **Root cause:** Rule checks are hardcoded for three rule IDs and do not consume complete rule semantics or approved facts.
- **Suggested fix:** Implement and test the remaining policy checks and evidence rules; clearly mark unimplemented policies and prevent “all rules passed” from implying coverage that is absent.

#### B-04 — Render frontend API URL is not configured (High; deployment review)

- **Reproduction:** Inspect the Render blueprint and client build configuration. `render.yaml` configures a rewrite for `/api/*`, but does not set `VITE_API_URL`; `src/api.js` defaults to absolute `http://localhost:5000`. No Render deployment was performed.
- **Expected:** The deployed browser requests the deployed API through the rewrite or an explicitly configured backend URL.
- **Actual:** The absolute localhost request bypasses the Render static-site rewrite and targets the visitor's own machine.
- **Root cause:** Frontend API base defaults to local development URL and Render build config does not override it.
- **Suggested fix:** Use a deployment-aware relative `/api` base or define the correct backend URL at build time; validate the deployed frontend's network requests.

#### B-05 — Rescan reactivates dismissed findings (Medium)

- **Reproduction:** Scan text containing a finding; dismiss it with a non-empty reason; run the review again without changing the text. The finding reappeared as active.
- **Expected:** A dismissal and its justification remain associated with a matching finding/version until content changes or the user restores it.
- **Actual:** `POST /reviews/run` saves freshly generated findings and replaces prior records; unlike the current-review and accept paths, it does not merge previous dismissals.
- **Root cause:** Finding replacement on rescan discards status metadata.
- **Suggested fix:** Merge matching dismissal state/reason on rescan, with a defined key including the relevant draft, version, rule, and quoted span.

#### B-06 — New draft and ordinary text edits are not persisted (Medium)

- **Reproduction:** Enter/edit draft text in the Review editor without accepting a suggestion, then refresh. The original persisted content returns. There is no draft-create/save endpoint in the API inventory.
- **Expected:** Creator can create a draft and save changes explicitly or through a reliable autosave state.
- **Actual:** Text change handler updates React state only; acceptance is the only tested path that persists modified text as a revision.
- **Root cause:** Missing create/update draft API and no save operation wired to the editor.
- **Suggested fix:** Add draft creation and explicit save/update with revision semantics, validation, and visible save confirmation.

#### B-07 — Offline accept reports a false save (Medium)

- **Reproduction:** Stop the local backend, accept a suggestion in the browser, observe “Saved revision,” then refresh. The accepted text is gone.
- **Expected:** Report a failed save and preserve a retryable unsaved state, or explicitly mark an offline/local-only mode.
- **Actual:** `acceptFindingAPI` catches network failure and returns a local success-shaped draft/revision; the UI reports it as saved.
- **Root cause:** API wrapper silently converts server failure into a successful fallback response.
- **Suggested fix:** Surface persistence errors; do not announce a saved revision unless the backend confirms it.

#### B-08 — Oversized API upload yields server error (Medium)

- **Reproduction:** POST a harmless file larger than 10 MiB directly to `/api/documents/extract`. Browser-side size validation is bypassed; Multer rejects the request.
- **Expected:** A documented 4xx response identifying the size limit, without an internal-server error.
- **Actual:** The upload middleware fails before the route handler's try/catch; the global handler returns 500.
- **Root cause:** Global error handler maps parser/upload errors to 500.
- **Suggested fix:** Handle Multer file-size errors and return a stable 413/400 response with a safe user-facing message.

#### B-09 — MIME type is not validated (Medium)

- **Reproduction:** Upload a harmless `.txt` file with an `application/pdf` MIME header. The endpoint accepts and parses it based on extension.
- **Expected:** Enforce the documented MIME/extension policy (and appropriate content validation).
- **Actual:** `ALLOWED_MIME_TYPES` is defined but not checked by `parseDocumentBuffer`.
- **Root cause:** Parser dispatches on extension only.
- **Suggested fix:** Validate MIME against extension and inspect format signatures where appropriate; reject mismatches clearly.

#### B-10 — Invalid resources can be reported as successful (Medium)

- **Reproduction:** Request current review with an unknown draft ID (returns the default `draft-1`); dismiss an unknown finding ID (200, `updated: null`); accept against a nonexistent draft with a valid `newText` (200, `draft: null`).
- **Expected:** Return 404 for nonexistent resources and avoid recording misleading success/audit records.
- **Actual:** Fallback or success-shaped responses mask invalid resource identifiers.
- **Root cause:** Current-review fallback and missing null checks on mutation results.
- **Suggested fix:** Validate resource existence before mutation and return consistent 404 responses.

#### B-11 — Concurrent changes are not protected (Medium)

- **Reproduction:** Submit the same draft twice concurrently: both requests returned 200 and created audit events. Submit concurrent accept operations using the same requested next version: duplicate revisions were created.
- **Expected:** Idempotent submit semantics and unique, ordered revisions under concurrent requests.
- **Actual:** Both operations independently write status/audit or revision data.
- **Root cause:** No idempotency key, optimistic concurrency check, or atomic revision-number allocation.
- **Suggested fix:** Use version preconditions/transactions and idempotency keys; reject stale or duplicate submissions.

#### B-12 — Rule configuration is inconsistent (Medium)

- **Reproduction:** Change an R-1 rule's severity to `low`; scan an R-1 phrase. Finding still reports `high`. Disable a rule and open its detail drawer; it still says “Enabled.”
- **Expected:** Active/severity values in the UI and scanner reflect persisted rule configuration.
- **Actual:** Finding severity is hardcoded; drawer reads mock rules and hardcodes Enabled.
- **Root cause:** Scanner and drawer do not consistently use the live rule record.
- **Suggested fix:** Drive scan severity and detail display from the authoritative rule data; add integration tests for rule updates.

#### B-13 — Fact validation and management are incomplete (Medium)

- **Reproduction:** POST duplicate facts and an invalid date string; both were accepted. Open the Facts tab; no create/update/delete controls are available.
- **Expected:** Reject invalid dates and duplicate policy facts, and expose supported management operations.
- **Actual:** Fact route checks only that fields are nonempty; UI presents facts read-only.
- **Root cause:** Missing semantic validation, uniqueness policy, and management UI/API.
- **Suggested fix:** Define fact schema/uniqueness, validate dates, and implement the intended CRUD controls or document the read-only scope.

#### B-14 — Deployment hardening (Medium)

- **Reproduction:** Send an API request with an arbitrary Origin; CORS response includes `Access-Control-Allow-Origin: *`. Inspect Compose: Mongo port 27017 is published and no database authentication is configured.
- **Expected:** Restrict browser origins and avoid exposing an unauthenticated database outside an isolated local environment.
- **Actual:** Wildcard CORS and a host-published unauthenticated Mongo container are configured.
- **Root cause:** Development-oriented defaults are used in deployment configuration.
- **Suggested fix:** Allowlist production origins; secure MongoDB credentials/network exposure and bind its port only when local access is explicitly required.

#### B-15 — Mobile horizontal overflow (Low)

- **Reproduction:** Open the app at a 390 px viewport width and measure the document. `scrollWidth` was 526 px.
- **Expected:** Main page content fits the viewport without horizontal scrolling.
- **Actual:** Horizontal overflow of 136 px was measured.
- **Root cause:** One or more page/navigation elements exceed the small viewport.
- **Suggested fix:** Identify the overflowing element and add responsive wrapping/sizing; recheck all five routes.

#### B-16 — Dismiss dialog Escape key (Low)

- **Reproduction:** Open Dismiss, press Escape. The dialog remained open. The Rule Drawer closed when Escape was pressed.
- **Expected:** Modal dialog closes on Escape and returns focus to its trigger.
- **Actual:** Dismiss dialog does not register Escape handling.
- **Root cause:** Dialog has focus setup but no keydown handler.
- **Suggested fix:** Add Escape dismissal and verify keyboard focus trapping/restoration.

#### B-17 — Malformed JSON returns 500 (Low)

- **Reproduction:** Send malformed JSON to an API endpoint with JSON content type.
- **Expected:** A 400-class validation response with a stable, non-sensitive error body.
- **Actual:** The global handler returned 500 and included parser error text.
- **Root cause:** Global handler does not distinguish body-parser syntax errors.
- **Suggested fix:** Map malformed JSON to 400 and avoid exposing internal parser details to clients.

#### B-18 — Missing referenced environment example (Low)

- **Reproduction:** Follow the README environment setup reference to `.env.production.example`; the file is not present in the repository. `server/.env.example` is present.
- **Expected:** Every documented environment template exists, or the README points only to available templates.
- **Actual:** One of the two named templates is absent.
- **Root cause:** Documentation reference is stale or the production example was omitted.
- **Suggested fix:** Remove the stale reference or add a safe, secret-free production template.

## Unverified and blocked functionality

- **Live LLM review:** BLOCKED / NOT TESTED. No provider credentials were configured; no paid API was used. `/api/llm/status` reported deterministic mode.
- **MongoDB persistence:** NOT TESTED against a live MongoDB instance. Missing and invalid local URI fallback behavior was tested; embedded persistence across restart passed.
- **Cloud deployment:** NOT TESTED. No deployment was created. Render wiring defect is based on configuration/code inspection.
- **Complete accessibility audit:** NOT TESTED. No axe or automated screen-reader audit was run; only basic dialog keyboard behavior and responsive sizing were checked.
- **Dedicated XSS and injection testing:** NOT TESTED. Harmless special-character and Unicode content were exercised, but no dedicated browser execution/injection suite was run.
- **Creator/reviewer permission matrix:** FAIL. Direct API operations confirmed role restrictions are not enforced.
- **Full new-draft workflow and full request-changes/resubmit workflow:** BLOCKED / NOT TESTED due to missing draft create/save behavior; individual decision/comment paths were exercised.
- **Production database restart, backups, and cloud durability:** NOT TESTED.

## Submission blockers

1. Implement real authentication and server-side role/permission enforcement before presenting this as a multi-user approval system.
2. Prevent content changes to approved drafts from silently retaining Approved status; make queue risk reflect the current content.
3. Implement or explicitly scope/disable unsupported compliance rules, including the advertised policy coverage, and avoid false “all rules passed” conclusions.
4. Fix Render API URL configuration and verify an actual deployed browser-to-API request before claiming deployment readiness.
5. Add persistent draft creation/saving and truthful offline/error states.
6. Fix dismissed-finding persistence, upload error/type validation, API resource validation, and concurrency integrity.
7. Secure CORS and database deployment defaults.

## Recommended improvements

- Add API contract/integration tests for authentication, permission-denied cases, status transitions, approved-content immutability, invalid IDs, error codes, and duplicate concurrent requests.
- Add deterministic tests for every seeded rule, including rule enablement/severity changes, percentage/financial claims, citations, and false-positive handling.
- Add explicit draft create/save and autosave/error states, plus end-to-end request-changes/resubmission coverage.
- Add regression tests for MIME mismatch, oversized uploads, malformed documents, and parser error responses.
- Add mobile viewport tests across all five pages and a keyboard/accessibility test suite.
- Update README test counts and deployment/security claims to match the actual product.
- Before submission, run a final clean install/build/test on the intended deployment environment and document any external services still unavailable.

## Final verdict

# NOT READY

The project is a functioning local prototype and its existing automated tests/build pass, but it is **not ready to submit as a secure, reliable compliance approval application**. The unauthenticated state-changing API and ability to alter already-approved content without invalidating approval are the most serious blockers. The scanner coverage and deployment wiring also undermine the central compliance and submission claims. All findings above are reported only; no application fixes were applied.
