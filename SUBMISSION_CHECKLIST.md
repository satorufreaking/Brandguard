# BrandGuard AI — Prototype Submission Checklist

## Readiness verdict

**READY WITH MINOR ISSUES for a local college-project demonstration only.**

The core prototype workflow, persistence, API permission checks for the selectable demo roles, scanner behavior, upload validation, and frontend/backend integration passed the implemented regression suites. This verdict is not a claim of production readiness, legal compliance certification, secure authentication, or verified cloud deployment.

## Working features

- Create, edit, save, reload, and resubmit versioned drafts through the backend.
- Scan text using documented deterministic checks for R-1, R-7, A-2, R-4, and limited heuristic R-9.
- Display finding severity from configured rules; accept corrections and dismiss findings with required justification.
- Preserve valid dismissals across unchanged rescans and audit revisions/resolutions.
- Block submission/approval for active high-severity findings and unverified enabled rules.
- Submit drafts, request changes, reject, or approve with required reviewer comments.
- Enforce Creator, Reviewer, and Admin action boundaries in backend handlers for the demo role selected by the UI.
- Upload and extract supported PDF, DOCX, TXT, and Markdown files with size/type checks.
- Manage rules and approved facts; validate facts and write audit events.
- View review queue, governance analytics, and audit history.
- Configure same-origin local API use or a deployed frontend API origin.

## Remaining limitations and cautions

- The Creator/Reviewer/Admin selector is **demo-only**, selectable by users, and not secure authentication or identity verification.
- R-9 is a narrow deterministic disclosure heuristic and requires human review. The scanner does not certify compliance or provide legal advice.
- No LLM credentials were configured; live semantic review was not tested. No live MongoDB or cloud deployment was tested.
- The Dismiss dialog Escape handler was exercised with a synthetic keyboard event, but physical Escape input could not be reliably verified by the integrated browser.
- Full accessibility, dedicated XSS/injection testing, and production network/security testing were not performed.
- Local embedded JSON storage is suitable for an isolated demo, not shared multi-user or production hosting.

## Environment setup

Requirements: Node.js 18+ and npm 9+. No paid service or LLM key is required for the local deterministic demo.

From the project root, install the dependencies:

```powershell
npm ci
npm ci --prefix server
```

Optional local backend settings can be placed in `server/.env`, using `server/.env.example` as the reference. Do not overwrite an existing `.env` or add secrets to the frontend. With no MongoDB URI, the backend uses the local embedded store.

Open two terminals in the project root:

```powershell
# Terminal 1 — backend API
npm run server:start
```

```powershell
# Terminal 2 — frontend
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api` to the local backend on port 5000. For a separately hosted frontend, set `VITE_API_URL` at frontend build time to the backend origin (without an `/api` suffix) and set backend `CORS_ORIGINS` to the exact frontend origin. Keep database and LLM credentials on the server only.

## Final verification commands

Run from the project root:

```powershell
npm test
npm run test:server
npm run test:ui
npm run build
```

Results from this audit:

- `npm test`: 66 passed across 7 files.
- `npm run test:server`: 62 passed across 6 files.
- `npm run test:ui`: 4 passed.
- `npm run build`: passed.

## Five-minute demonstration workflow

1. Start both services and open `http://localhost:3000`; leave the role set to **Creator**.
2. Create a draft and enter short sample copy containing `100% guaranteed` and `users`.
3. Save, refresh, and confirm the saved revision and text reload.
4. Run review; inspect R-1/R-7 findings, accept a correction, and dismiss a remaining finding with a justification.
5. Submit only after active high-severity findings are resolved. Open the Queue and switch to the **Reviewer** demo role.
6. Enter a reviewer comment and record the decision. Show the Audit and Analytics pages, then optionally inspect rule toggles and approved facts as **Admin**.
7. Explain that role selection is not authentication, R-9 is heuristic, and no real compliance certification is implied.

## Files and data handling

The original `QA_REPORT.md` and `TEST_CASES.md` remain preserved as initial audit evidence. Automated tests and browser QA used temporary storage; the original `server/data/brandguard_store.json` was verified unchanged. No commit, push, deployment, or dependency change was made.
