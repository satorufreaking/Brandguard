# BrandGuard AI — Vercel, Render, and MongoDB Atlas Deployment

This guide deploys the Vite frontend to Vercel, the Express API to Render, and persistent application data to MongoDB Atlas. It does not deploy anything, create paid resources, or require LLM credentials.

## Deployment architecture

```text
Judge's browser
  ├─ Vercel static React/Vite app
  │    └─ VITE_API_URL → Render API /api
  └─ Render Node/Express service
       ├─ CORS_ORIGINS allows the Vercel site origin
       ├─ MongoDB Atlas stores drafts, revisions, findings, decisions, rules, facts, and audit events
       └─ Uploaded documents are parsed in memory; extracted text is returned to the UI
```

The backend is configured to fail startup when Atlas is missing or unreachable in production. It must not serve the public demo using the local JSON store. `/api/health` returns `200` only when the production MongoDB connection is ready; otherwise it returns `503`.

## Before starting

- Ensure the application changes and deployment files are pushed to the intended GitHub repository by an authorized maintainer. This guide does not commit or push.
- Use free tiers only unless the project owner explicitly authorizes spending. Vercel Hobby, Render Free (if available for the account/region), and Atlas M0 are suitable for a small hackathon demonstration but have cold-start, quota, and capacity limits.
- Do not paste secrets into source files, frontend variables, issues, or public reports.
- Do not enable a paid LLM provider for the demo unless separately approved. The scanner runs in deterministic mode by default.

## 1. Create MongoDB Atlas database

1. Sign in to MongoDB Atlas and create a free M0 cluster in a nearby region.
2. Create a **database user** dedicated to BrandGuard. Grant `readWrite` on the `brandguard` database; do not use the Atlas account owner credentials.
3. In **Network Access**, allow the Render service to reach the cluster. Prefer the Render service's documented outbound IP range if it is stable and available. If the chosen Render plan uses dynamic outbound IPs, Atlas may require `0.0.0.0/0`; this permits network-level access from any address, so use a unique strong database password, restrict the database user to `readWrite` on the application database, and remove the broad rule when no longer needed.
4. Copy the Atlas **Drivers** connection URI and substitute the database user's credentials. URL-encode reserved characters in the username/password. Select the `brandguard` database in the URI, for example:

   ```text
   mongodb+srv://<database-user>:<url-encoded-password>@<cluster-host>/brandguard?retryWrites=true&w=majority
   ```

5. Keep the completed URI private. Enter it only in Render's secret environment variable field as `MONGODB_URI`.

Atlas free clusters may pause or have limited capacity. Wait for the cluster to be available before deploying the API.

## 2. Deploy the backend to Render

1. In Render, create a **Blueprint** from the repository containing `render.yaml`, or create a Web Service manually with:
   - Runtime: Node
   - Root directory: `server`
   - Build command: `npm ci`
   - Start command: `npm start`
   - Health check path: `/api/health`
   - Instance plan: Free, if offered; do not select a paid plan without authorization.
2. The blueprint configures production mode, requires MongoDB, and uses deterministic scanning. Render injects the `PORT` value; do not replace it with a hardcoded port.
3. Set the prompted environment values in the Render dashboard:
   - `MONGODB_URI`: the private Atlas URI.
   - `CORS_ORIGINS`: temporarily set `http://localhost:3000` for the initial API deployment. After Vercel is deployed, replace this with the exact Vercel production origin, with no trailing slash. Include a custom domain as a comma-separated additional origin if used.
   - Keep `NODE_ENV=production`, `REQUIRE_MONGODB=true`, and `LLM_PROVIDER=deterministic` as configured by `render.yaml`.
4. Deploy and wait for the health check to pass. Copy the service's HTTPS origin, for example `https://brandguard-api.onrender.com` (do not add `/api`).
5. Verify the backend health endpoint:

   ```text
   https://<render-service>.onrender.com/api/health
   ```

   Expected: HTTP `200`, JSON `status: "ok"` and `database: "mongodb"`. A `503`, an embedded database mode, a failed deployment, or a failed health check means the public demo is **not ready**. Check Render logs and Atlas network/database credentials; do not weaken the production MongoDB requirement.

Render Free services can sleep and take time to wake. The first request after inactivity may be slow; wait and retry the health check before proceeding.

## 3. Deploy the frontend to Vercel

1. Import the repository into Vercel. Set the project root directory to the repository root (not `server/`).
2. Confirm the project build settings:
   - Framework preset: Vite
   - Install command: `npm ci`
   - Build command: `npm run build`
   - Output directory: `dist`
   - `vercel.json` contains the SPA rewrite to `/index.html`.
3. In **Project Settings → Environment Variables**, add:
   - Name: `VITE_API_URL`
   - Value: the Render HTTPS origin from step 2, without a trailing slash or `/api`, e.g. `https://brandguard-api.onrender.com`
   - Environment: Production
4. Deploy the production Vercel site. Vite embeds `VITE_API_URL` at build time, so redeploy after changing it.
5. Copy the production site origin, for example `https://<project>.vercel.app`. Do not add a trailing slash when entering it in the next step.

`VITE_API_URL` is public frontend configuration, not a secret. Only use it for the API origin. Never prefix MongoDB or LLM credentials with `VITE_`.

The same-origin `/api` default and Vite proxy remain available for local development. For the deployed frontend, `VITE_API_URL` must point at the Render API origin.

## 4. Restrict backend CORS to the deployed site

1. In Render's `brandguard-api` environment settings, set `CORS_ORIGINS` to the exact Vercel production origin:

   ```text
   https://<project>.vercel.app
   ```

2. If a custom frontend domain is configured, include it as another comma-separated exact origin:

   ```text
   https://<project>.vercel.app,https://<custom-domain>
   ```

3. Save changes and wait for the Render service to redeploy/restart.
4. Do not use `*`, include paths, or add trailing slashes. If Vercel preview deployments need API access, add only the specific preview origins you intend to trust; do not broadly allow all previews.

## 5. Confirm Atlas persistence and document upload behavior

- Drafts and revisions, scanner findings, decisions, rule/fact changes, and audit events are saved through the backend's MongoDB repository.
- A startup database seed adds the demo rules, facts, drafts, and initial audit rows only when those respective collections are empty. Existing Atlas collections are not overwritten.
- Uploads are held in backend memory with a 10 MiB limit and supported extension/MIME/signature validation. The app extracts text; it does not persist the uploaded binary. Save the extracted text as a draft to persist it in Atlas.
- Free instances have constrained memory. Avoid simultaneous/large uploads during the demonstration. A process restart clears in-flight upload buffers, but not saved Atlas records.
- Do not point a public deployment at a personal/test database containing sensitive information.

## 6. Verify the complete deployed workflow

Use the checklist in [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) and record the actual final URLs and results there. At minimum:

1. Open the Vercel production URL and confirm no browser CORS/network errors.
2. As Creator, create a uniquely named draft, add sample text with a recognizable rule finding, scan, accept a correction, and save.
3. Refresh the browser and verify the saved revision/text is still present.
4. Submit the clean draft. Switch to Reviewer, open the correct queue entry, add a comment, and request changes.
5. Switch back to Creator, edit and save a new revision, rescan, and resubmit.
6. Switch to Reviewer and approve with a required comment.
7. Open Audit and confirm the scan, revision, submission, request-changes, resubmission, and approval events.
8. Upload a harmless PDF, DOCX, or TXT, confirm extraction, save the extracted content as a draft, and verify the new text after refresh.
9. Restart/redeploy the Render service and verify the draft and decision remain in Atlas.
10. Inspect Render logs and health response. It must report MongoDB mode, never embedded mode.

The demo role switcher is selectable by any visitor. It demonstrates a prototype workflow and backend route checks, not authenticated identities or secure access control. Do not put real confidential content in the public demo.

## Environment variables

| Platform | Variable | Required | Value / handling |
|---|---|---:|---|
| Vercel | `VITE_API_URL` | Yes | Public Render API origin only, e.g. `https://<render-service>.onrender.com`; no `/api` suffix. |
| Render | `NODE_ENV` | Yes | `production` (set in `render.yaml`). |
| Render | `REQUIRE_MONGODB` | Yes | `true` (set in `render.yaml`); prevents JSON fallback. |
| Render | `MONGODB_URI` | Yes, secret | Atlas `mongodb+srv://.../brandguard?...` URI; enter in Render dashboard only. |
| Render | `CORS_ORIGINS` | Yes | Exact Vercel production origin(s), comma-separated, no trailing slash. |
| Render | `LLM_PROVIDER` | Yes | `deterministic` by default; no provider API key is needed. |
| Render | `PORT` | Platform-provided | Render injects this value. Do not set a fixed port. |
| MongoDB Atlas | Database user | Yes | Dedicated user with `readWrite` on `brandguard`; store its URI only in Render. |

No MongoDB or LLM secret belongs in Vercel. No value is committed to this repository.

## What has and has not been verified

The repository configuration and code support this architecture, and automated tests/build validate application behavior locally. No Vercel or Render deployment was created, no live Atlas connection was attempted as part of this deployment preparation, and no public workflow has been verified yet. Until the real URLs pass the complete smoke test, public deployment readiness remains **unverified**.
