# BrandGuard AI — Public Deployment Checklist

Use this checklist only after an authorized maintainer creates the Vercel, Render, and Atlas resources. Do not mark deployment or public-workflow items complete from a successful frontend build alone.

## Pre-deployment configuration

- [ ] `vercel.json` specifies Vite, `npm ci`, `npm run build`, `dist`, and SPA fallback.
- [ ] Vercel project root is the repository root.
- [ ] Vercel production environment has `VITE_API_URL` set to the Render API origin only (no `/api` suffix).
- [ ] Render uses `server/` as root, `npm ci`, `npm start`, and `/api/health`.
- [ ] Render is on a free plan or a paid plan has explicit owner approval.
- [ ] Render has `NODE_ENV=production` and `REQUIRE_MONGODB=true`.
- [ ] Render has the private `MONGODB_URI` from Atlas and its value is not logged or shared.
- [ ] Atlas has a dedicated database user restricted to `readWrite` on `brandguard`.
- [ ] Atlas network access permits the Render service; any `0.0.0.0/0` rule is understood, temporary where practical, and protected by a unique strong database credential.
- [ ] Render `CORS_ORIGINS` exactly matches the Vercel production site origin(s), without paths, wildcard, or trailing slash.
- [ ] No API/database/LLM secret is in Vercel or a `VITE_` variable.
- [ ] LLM provider remains deterministic unless separately approved.

## Health and backend connectivity

- [ ] Record Render API URL: `________________________________________`
- [ ] Record Vercel production URL: `___________________________________`
- [ ] `GET <Render API URL>/api/health` responds HTTP `200`.
- [ ] Health response reports `status: "ok"` and `database: "mongodb"`.
- [ ] Render logs show successful Atlas connection and do not show embedded fallback.
- [ ] A missing or unavailable Atlas connection causes a failed/503 health state, not a working embedded-storage server.
- [ ] Vercel browser requests target the recorded Render API URL (inspect Network tab).
- [ ] Browser console and Network tab show no CORS rejection, HTML response in place of API JSON, or failed API calls.
- [ ] A request from an unlisted Origin is rejected by CORS.

## Public workflow smoke test

Use non-confidential, clearly identified test content. Keep a record of the test draft ID/title; do not delete or modify unrelated records.

- [ ] Set UI to **Creator** and create a uniquely titled test draft.
- [ ] Add harmless text such as `Our service is guaranteed to improve your workflow. Join users today.`.
- [ ] Run review; verify configured rule findings and severity display.
- [ ] Accept one suggested correction and confirm only the intended text span changes.
- [ ] Save and verify a new revision is shown.
- [ ] Refresh the Vercel page and reopen the draft; confirm text and revision are still present.
- [ ] Submit a clean test draft successfully.
- [ ] Confirm an unresolved high-risk test draft is prevented from submission.
- [ ] Set UI to **Reviewer**, open the submitted item from Queue, and verify correct title and current revision.
- [ ] Record **Request Changes** with a reviewer comment.
- [ ] Set UI to **Creator**, edit/save a new revision, rescan, and resubmit.
- [ ] Set UI to **Reviewer** and approve with a non-empty comment.
- [ ] Confirm approved status and reviewer decision persist after refresh.
- [ ] Open Audit and verify scan, saved revision, submit, request-changes, resubmit, and approval events.
- [ ] Open Analytics and verify the latest persisted review appears in totals.

## Upload and persistence smoke test

- [ ] Upload a harmless supported PDF, DOCX, or TXT file smaller than 10 MiB.
- [ ] Verify extracted text appears in the editor; the uploaded binary itself is not retained by this implementation.
- [ ] Save extracted content as a draft and verify it after browser refresh.
- [ ] Verify an unsupported type or MIME mismatch is rejected with a clear client error.
- [ ] Verify a file over 10 MiB is rejected with HTTP 413 / clear UI feedback.
- [ ] Restart or redeploy the Render service.
- [ ] After the service is healthy again, reopen the saved draft and verify its text/revision, decision, and audit history remain available from Atlas.

## Role and prototype caveats

- [ ] Confirm the UI labels the Creator/Reviewer/Admin selector as demo-only.
- [ ] Confirm demo roles are not presented as real user authentication or identity security.
- [ ] Do not use personal, regulated, or confidential content in this public prototype.
- [ ] Explain that deterministic rules are limited and R-9 is a human-review heuristic, not a legal/compliance guarantee.

## Test execution record

| Check | Actual result / evidence | Status (PASS / FAIL / BLOCKED / NOT TESTED) |
|---|---|---|
| Vercel build and SPA navigation | No public deployment yet | NOT TESTED |
| Render health and Atlas connection | No public deployment yet | NOT TESTED |
| Frontend-to-API CORS/connectivity | No public deployment yet | NOT TESTED |
| Create/save/refresh draft | No public deployment yet | NOT TESTED |
| Scan/correct/resubmit | No public deployment yet | NOT TESTED |
| Reviewer request-changes and approval | No public deployment yet | NOT TESTED |
| Audit persistence | No public deployment yet | NOT TESTED |
| Upload/extraction/save | No public deployment yet | NOT TESTED |
| Persistence after backend restart | No public deployment yet | NOT TESTED |

**Public submission readiness:** UNVERIFIED until all required health/connectivity and workflow smoke checks above pass against the final URLs.
