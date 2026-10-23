<<<<<<< HEAD
# BrandGuard AI — Pre-Publication Brand Review & Compliance Engine

BrandGuard AI is an automated brand governance and compliance review platform. It protects brand integrity, enforces legal claim substantiation, prevents non-inclusive or forbidden terminology, and ensures digital accessibility standards before content is published.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Frontend                       │
│    React 19 + Vite 6 + Tailwind CSS + Radix UI Primitives   │
│  [Review Screen]   [Rules Screen]   [Queue]   [Audit Log]   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST (src/api.js)
┌──────────────────────────────▼──────────────────────────────┐
│                    Express.js Backend API                   │
│                       (server/index.js)                     │
├─────────────────────────────────────────────────────────────┤
│ • Deterministic Rule Matching Engine (character offsets)   │
│ • Submission Blocker (enforces high-severity policy gates)  │
│ • Revisions & Audit Event Append-Only Logger                │
│ • Optional External LLM Adapter (OpenAI / Gemini / Claude)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   [MongoDB Atlas / Mongoose]            [Embedded JSON Store]
 (When MONGODB_URI is provided)         (server/data/brandguard_store.json)
                                         (Seamless offline fallback)
```

---

## 2. Getting Started & Local Setup

### Prerequisites
- Node.js v18.0.0+
- npm v9.0.0+

### Step 1: Install Dependencies
```bash
# In the project root (installs React frontend dependencies)
npm install

# In the server folder (installs Express & Mongoose backend dependencies)
cd server
npm install
cd ..
```

### Step 2: Environment Configuration
Create a `.env` file in the `server/` directory (see `server/.env.example`):

```env
PORT=5000

# Optional: MongoDB Atlas Connection URI
# If left empty, the server automatically runs in persistent embedded mode
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/brandguard?retryWrites=true&w=majority

# Optional: Semantic Review LLM Provider Keys
# OPENAI_API_KEY=
# GEMINI_API_KEY=
# ANTHROPIC_API_KEY=
```

### Step 3: Run Development Servers
```bash
# Terminal 1: Start Express API server (port 5000)
npm run server:start

# Terminal 2: Start Vite Frontend (port 3000)
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 3. Automated Test Suite & Production Build

```bash
# Run backend API & integration tests (10 tests)
npm run test:server

# Run frontend React & audit tests (4 tests)
npm run test:ui

# Run full project test suite (30 tests across all modules)
npm test

# Run Vite production build (validates chunking, bundle size, and minification)
npm run build
```

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns service status and active storage mode (`mongodb` or `embedded`). |
| `GET` | `/api/rules` | Retrieves active brand rules, category, and severity rankings. |
| `PUT` | `/api/rules/:id` | Toggles or updates brand rule attributes (creates audit log entry). |
| `GET` | `/api/facts` | Retrieves official approved facts and verification sources. |
| `POST` | `/api/facts` | Adds a new approved empirical claim or fact. |
| `GET` | `/api/reviews/current` | Loads active draft, current revision, and active findings. |
| `POST` | `/api/reviews/run` | Scans text and returns findings with inclusive `start` and exclusive `end` character offsets. |
| `POST` | `/api/reviews/accept` | Applies suggested replacement, generates next revision (`v2` → `v3`), and recalculates findings. |
| `POST` | `/api/reviews/dismiss` | Dismisses a finding. **Requires a non-empty justification reason**. |
| `POST` | `/api/reviews/submit` | Submits draft for review. **Fails (400) if unresolved high-severity findings exist**. |
| `POST` | `/api/reviews/decision` | Records reviewer decision (`Approved`, `Changes requested`, `Rejected`) with mandatory comment. |
| `GET` | `/api/queue` | Returns submissions in the review queue with active severity counts. |
| `GET` | `/api/audit` | Chronological, append-only history of every scan, dismissal, submission, and reviewer action. |

---

## 5. Security & Safety Practices

1. **Secret Isolation:** `.env` and `server/.env` are strictly excluded in `.gitignore`. No credentials, tokens, or database connection strings are exposed in client-side bundles.
2. **Input Validation:** Strict validation is enforced on all endpoints:
   - Dismissals reject empty or whitespace-only reasons (`400 Bad Request`).
   - Decisions require a non-empty comment and an allowed decision status (`400 Bad Request`).
   - Unknown rule IDs return `404 Not Found`.
3. **No Hallucinated Evidence:** The review engine runs strictly deterministic checks when external AI credentials are not provided. It never generates fabricated findings or false evidence.
4. **Demo Role Switcher Disclosure:** The role switcher is a client-side convenience for reviewing both Creator and Reviewer experiences during demos. It does not provide cryptographic authentication, JWT verification, or session-based access control.

---

## 6. Known Limitations

- **Authentication:** Currently uses a demo role switcher rather than enterprise SSO / OAuth / RBAC.
- **LLM Semantic Review:** Operates deterministically out of the box. Semantic and context-aware claim analysis is activated when valid LLM provider keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.) are configured.
- **Storage Mode:** Defaults to persistent disk storage (`server/data/brandguard_store.json`) when `MONGODB_URI` is not configured. When connected to Atlas, all data persists directly into MongoDB collections.

---

## 7. 2–3 Minute Live Demo Script (Using Sample Data)

### Scene 1: The Creator Experience (0:00 – 1:00)
1. **Navigate to Review Screen:** Open `http://localhost:3000/review`.
2. **Observe the Draft:** The marketing draft contains:
   > *"Our software is guaranteed to double every customer's productivity. Join users today. CLICK HERE to learn more."*
3. **Traceability in 30 Seconds:**
   - Click the red underline on `"guaranteed to double"`: card **R-1 (Claim Substantiation)** is highlighted.
   - Click the amber underline on `"users"`: card **R-7 (Terminology)** is highlighted.
   - Click the blue underline on `"CLICK HERE"`: card **A-2 (Accessibility)** is highlighted.
4. **Attempt Early Submission:** Notice the **"Submit for approval"** button is disabled due to the active high-severity violation (`R-1`).

### Scene 2: Resolving Findings & Branching Revisions (1:00 – 1:45)
1. **Accept Fix on R-7:** Click **"Accept fix"** on card R-7.
   - Notice the text instantly updates `"users"` → `"customers"`.
   - The version updates from `v1` to `v2`.
   - The finding list recalculates and R-7 is resolved.
2. **Dismiss with Mandatory Justification on R-1:**
   - Click **"Dismiss"** on R-1. Try clicking Confirm without typing anything (validation error prevents dismissal).
   - Enter: `"Legal and Risk Committee pre-approved this claim for pilot customers."`
   - Click **"Confirm Dismissal"**. The finding is marked Dismissed with reason recorded.
3. **Submit Draft:** With high-severity blockers resolved, click **"Submit for approval"**. Status updates to **"In review"**.

### Scene 3: The Reviewer Governance & Audit Trail (1:45 – 2:30)
1. **Switch to Reviewer Role:** Click **"Reviewer"** on the header switcher.
2. **Reviewer Decision Bar:** The Reviewer action bar appears at the bottom.
3. **Approve Draft:**
   - Enter comment: `"All compliance exceptions substantiated by Legal. Approved for release."`
   - Click **"Approve"**. Status pill turns green (**"Approved"**).
4. **Inspect Audit History:** Navigate to `http://localhost:3000/audit`.
   - View the chronological timeline showing rule updates, dismissal justifications, revisions, submissions, and reviewer decisions.
5. **Verify Persistence:** Press `F5` / Refresh. All decisions, audit records, and revisions remain completely intact.
=======
# Brandguard
Automated pre-publication brand governance &amp; compliance engine. Detects forbidden terms, validates legal claims, checks accessibility, and enforces approval workflows before content goes live.
>>>>>>> 77394af1a7863b8bd8a05a3552de1e6454fc4313
