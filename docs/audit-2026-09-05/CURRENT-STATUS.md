# Current audit and verification status

This file supersedes historical statements about uncommitted changes and outstanding deployment in the earlier audit reports.

## Git and production

- Backend fixes committed and pushed to `samarthum/voicefit`, `master`: `8b50995`.
- Initial mobile audit fixes committed and pushed to `samarthum/voicefit-mobile`, `main`: `4d5ce95`.
- This follow-up includes SDK patch alignment, native dependency deduplication, the larger-text nutrition layout, and four additional media regression tests.
- The backend push automatically produced a Ready production deployment at https://voicefit-m2jykqx4j-samarthums-projects.vercel.app. The public batch endpoint returned the expected HTTP 401 for an unauthenticated request afterward.
- `vercel.json` preserves the migration-free build used for the prior direct deployment. Future schema migrations must be applied explicitly; ordinary Vercel builds now generate Prisma and build Next without migrating the database.

## Checks completed in this pass

| Check | Result |
| --- | --- |
| Mobile automated tests | 77 pass, 0 fail |
| Mobile TypeScript | Pass |
| Backend endpoint tests | 4 pass, 0 fail |
| Backend TypeScript after syncing production source | Pass |
| Expo Doctor | 18/18 pass after fixes |
| iOS and Android Hermes export | Pass |
| React Native web export | Pass; does not test the retired web app |
| Native config introspection | Pass; HealthKit entitlement and microphone/camera/photo/Health read explanations present |
| Native signed-in launch after dependency updates | Dashboard loads successfully |
| Accessibility-medium text size | Reproduced nutrition heading/goal overlap; fixed with wrapping and stacked content, visually verified |
| Logging sheet at accessibility text size | Title, input, photo, microphone and submit controls visible |
| Native photo source menu and library | Both open; no image selected or uploaded |
| Photo-picker cancellation via automation | Not verified: native AX controls absent and coordinate action returned noWindowsAvailable |
| Delayed photo/transcription callbacks after close | Automated regression tests pass; no stale reopening or accidental save |
| Cancelled picker and failed transcription | Automated regression tests pass; no save and appropriate failure state |

The simulator's text-size setting was restored to its original `large` category. No new meal, workout or coach records were created in this pass.

## Dependency changes

Stayed on Expo SDK 54. Updated the six patches reported by Expo's compatibility checker. A single expo-constants version is enforced to avoid duplicate native modules. Clean installation and Metro restart completed. The old ignored npm lockfile was backed up outside the project; Bun's tracked lockfile remains authoritative. Expo's installer added the expo-asset and expo-web-browser config plugins.

## Still open

- Physical iPhone release performance: cold launch, scrolling/frame timing, keyboard and interruption behavior.
- Actual Apple Health permission/read/sync behavior and real microphone/camera capture.
- Full native offline/reconnect/slow-network flows; cancellation and timeouts have automated coverage, but that does not certify native network transitions.
- Small iPhone and the largest accessibility sizes across every screen. The default simulator and accessibility-medium dashboard/logging checks are partial coverage.
- Native session-header menu interactions: visible but not consistently accessible to simulator automation.
- Production interpretation stage timing and the roughly 7.5-second workout interpretation wait.
- Authoritative weekly workout summaries and process-restart recovery for uncertain saves.

Local launch files, generated output and the account screenshot were deliberately excluded from commits. No claim is made that every flow or release-device behavior is certified.

## UI polish follow-up

See [UI-POLISH.md](./UI-POLISH.md) for the mobile spacing, header and empty-state pass. TypeScript and 77 tests pass. The completed-session menu icon now renders; native menu interaction still needs verification.

Second UI pass covers logging, Meals date navigation, Coach controls and Settings fields. See UI-POLISH.md for details and pending native checks. iOS export, TypeScript and all 77 tests pass.
