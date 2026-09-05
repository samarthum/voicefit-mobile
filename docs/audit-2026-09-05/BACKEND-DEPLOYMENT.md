# Backend deployment — 2026-09-05

**Current status:** See [CURRENT-STATUS.md](./CURRENT-STATUS.md) for pushed commits and the latest verification. Details below record their original audit pass.

Status: production deployed and promoted successfully.

- Mobile backend: https://voicefit-zeta.vercel.app
- Deployment: https://voicefit-e3f4gxiun-samarthums-projects.vercel.app
- Deployment ID: dpl_HUwaerkF1ZBeJ9aKCYJKXT698RWB
- Previous release / rollback target: https://voicefit-oxg49ra5a-samarthums-projects.vercel.app
- Base source: ce33890537b7404f1f809f41610d6447be790120 (exact previous production revision).
- Source additions: app/api/workout-sets/batch/route.ts and deployment-only vercel.json build command `prisma generate && next build`.
- Build source snapshot: /tmp/voicefit-backend-release-20260905

The local backend checkout was older than production. The release was prepared from the exact live Git revision plus the new endpoint, preserving newer coach/interpretation changes. No retired web UI source was changed. Vercel necessarily builds the shared Next application. No migrations ran and no production test workouts were created.

Validation: four endpoint tests passed; backend TypeScript passed; Vercel production compilation, TypeScript and route generation passed. An additional integration test exercised the actual endpoint with Prisma's PostgreSQL adapter against isolated local PostgreSQL 14: ten concurrent retries saved one batch; a database trigger injected a receipt failure and all set writes rolled back; retry then succeeded; changed payload, other-account ownership and ended-session checks behaved correctly. The local test database was stopped afterward. This test used the pg adapter, not the production Neon adapter.

The staged and promoted batch POST returned HTTP 401 with the expected Unauthorized JSON for an unauthenticated request. The existing dashboard API also returned its expected 401. After promotion the signed-in simulator fetched a different day's meal history successfully. These smoke tests do not constitute a production end-to-end workout save test.

Deployment was made directly from the prepared source snapshot. No Git commit or push was made. The endpoint and route tests remain uncommitted in the original backend checkout; integrate them with current origin/master before a future Git deployment so the new route is preserved. No local secrets or environment files were included in the deployment source.

Follow-up: production workout batch save and restart persistence are now verified in WORKOUT-FOLLOWUP.md. Synthetic test data was removed with exact guards.
