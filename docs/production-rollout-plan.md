# Voicefit Mobile Production Rollout Plan (P4-T2)

## Goal
Ship Android internal beta with repeatable build/release commands, explicit environment management, and a baseline crash/incident workflow.

## 1) Build Profiles
`eas.json` is now committed with three profiles:
- `development`: dev client build for local debugging.
- `preview`: internal APK build for QA distribution.
- `production`: Android App Bundle with auto-incremented version code.

Primary commands:

```bash
cd /Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
```

Optional submission (internal testing track):

```bash
cd /Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile
npx eas submit --platform android --profile production
```

## 2) Environment Management
Required public env vars:
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_BASE_URL`

Baseline:
- Keep local template in `.env.example`.
- Keep local machine secrets in `.env` only.
- Store release secrets in EAS project secrets and avoid hardcoding in `app.json`.

Recommended EAS setup:

```bash
cd /Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile
npx eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value "<value>"
npx eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value "https://voicefit-zeta.vercel.app"
```

## 3) Crash Logging Baseline
Current baseline for beta:
- Expo runtime logs + Metro logs for repro.
- Manual issue logging with: app version, device, OS, screen, API route, timestamp.

Recommended next hardening (before broad rollout):
- Add Sentry Expo SDK for crash + breadcrumb capture.
- Add release identifiers (`app version`, `build profile`) to all crash reports.

## 4) Internal Beta Gate
Before cutting a beta build:
1. `bunx tsc --noEmit` passes in `voicefit-mobile`.
2. `bun run build` passes in `voicefit`.
3. Android regression checklist from `/Users/samarth/Desktop/Work/voicefit-all/voicefit/qa/mobile-regression-matrix.md` passes.
4. API smoke checks run (`qa:mobile-api-smoke`) against local backend.
5. Build profile used and artifact link recorded in release note.

## 5) Rollout Sequence
1. Create `preview` Android build and distribute to internal QA.
2. Triage critical bugs only (auth, logging, crash, data loss, API failures).
3. Promote to `production` build and submit to Play internal track.
4. Collect 48 hours of internal telemetry + bug reports before wider rollout.

