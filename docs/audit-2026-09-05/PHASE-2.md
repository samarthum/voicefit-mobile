# VoiceFit mobile — second improvement pass

**Latest transition work:** DASHBOARD-TRANSITION.md documents the meal-to-dashboard changes and native checks.

**Workout follow-up:** WORKOUT-FOLLOWUP.md records the successful production batch save, restart verification, parser correction, timings and synthetic data cleanup.

## Implemented locally

- **Logging cancellation:** shared operation generations survive React renders. Closing or editing cancels interpretation/transcription requests and ignores late results, including a backend that ignores abort. A write already being submitted shows Saving and blocks duplicate submissions; the UI no longer offers to discard that write. Voice transcript editing returns to editable text instead of editing a copy while the original request continues.
- **Workout review saves:** all reviewed sets go through the new `/api/workout-sets/batch` endpoint. It validates the complete batch, checks session ownership, locks the session, and commits sets plus a retry receipt in one transaction. A repeated request ID returns the original outcome; a changed payload using that ID is rejected. The mobile retry retains the exact payload, timestamp, session and request ID after an uncertain response. Cardio duration is preserved.
- **Legacy meal nutrition:** metadata-only edits preserve stored nutrition, even with no ingredient rows. Explicit ingredient removal still updates nutrition. The meal is marked reviewed only after its ingredient update succeeds. Mutation errors no longer create unhandled promises in the button handlers.
- **Coach continuity:** the signed-in account owns the chat session, so leaving and reopening the screen reuses an ongoing reply. Initial server history must load successfully before the first send. History failures and clear failures show retry feedback. Streaming/completed messages update the history cache, and clearing is blocked while a reply is running.
- **Account isolation:** each account gets a separate QueryClient and disk cache key. Session expiry/account changes remount the data boundary, rather than relying only on the explicit Sign Out button. Late results from the old account cannot populate the new account's client.
- **Navigation context:** logging context follows route focus, avoiding an old workout session leaking into another screen's log.
- **Day rollover:** Today refreshes on foreground and at midnight. It follows the new day when the previous selection was today and preserves deliberate historical selections. Saved-calorie feedback reads today's dashboard cache rather than the first cached historical day.
- **Accessibility and preview compatibility:** sheet content is no longer assigned a slider role that hides its form controls; workout inputs have specific labels and review actions have button roles. Meal-history dates expose their date and selection. A web-specific text input avoids the sheet library's native-only keyboard API; native builds retain the native sheet input.
- **Startup:** font-loading failures reach the error boundary. Direct font imports remove unused weights: exported font assets decreased from 28 files / 6,670,428 bytes to 10 files / 2,442,280 bytes, including the icon font. This is a measured 4,228,148-byte reduction in uncompressed assets, not a measured startup-time or frame-rate improvement.

The retired web UI was not edited. The shared backend repository has one new mobile-facing route plus its route tests.

## Verification

- Mobile: 67 tests passed, including timing redaction and unchanged coach stream delivery. New coverage includes delayed interpretation after close/reopen, cancellation across controller recreation, duplicate taps, uncertain workout retries, caller cancellation versus timeouts (including response-body parsing), account isolation, scalar-only meal edits, ingredient-save failures, and continuation of a streamed coach reply using the real chat SDK with a synthetic stream.
- Backend: four route tests passed against a transactional in-memory test store. They cover repeated/concurrent delivery, rollback after an injected failure, changed-payload conflicts, invalid sets, ended sessions and another account's session. These tests do **not** replace integration testing against PostgreSQL.
- Type checks passed in both repositories. iOS Hermes export passed. Whitespace checks passed.
- React Native web preview: workout text entry → review → add second set → edit weight/repetitions → Saving was exercised. The browser session was interrupted before final dismissal was observed, so this is not recorded as a completed save flow. Earlier-day headings, date-preserving meal navigation, earlier-week navigation, Train navigation and opening active workout detail were also observed.
- The preview uses the app's existing development fixtures and mock saves. It is not evidence of authenticated backend persistence or native behavior.

## Deployment and device checks still required

1. **Batch API deployed on 2026-09-05.** Real PostgreSQL concurrent-retry and rollback integration checks passed before deployment. No schema migration ran. See BACKEND-DEPLOYMENT.md for the release, smoke tests, source-control status and rollback target. A production end-to-end workout save remains to be exercised.
2. Complete the remaining signed-in native flow matrix from the first report. Simulator control recovered after restarting, although occasional `noWindowsAvailable` failures remain. The native follow-up below supersedes the earlier blocked status.
3. Test Apple Health, microphone permissions, photo/camera, OAuth/deep links, keyboard/safe areas, accessibility text sizes, offline transitions and physical-device performance in a dedicated native build. Expo Go and RN web do not cover these equivalently.
4. Complete native coach history failure and clear-failure tests. Successful real history loading, sending, leaving during a reply, reopening, and persistence after terminating/restarting Expo Go are now verified.

## Remaining product work

- Authoritative weekly workout summaries independent of the loaded history page.
- Clearer Apple Health setup and read-availability copy.
- Persistent pending-save recovery across app termination. Workout retry IDs currently survive screen renders/retries, not a process restart. Other create paths (meal/quick-add and direct single-set entry) still need server idempotency for ambiguous timeout retries.
- Simplify Today further after checking a small iPhone and larger text: reduce visual dominance of the nutrition ring, prioritize the meal log, and increase small-label readability. Preserve the current visual direction while verifying actual layout and scrolling performance.

All changes remain local and uncommitted. See REPORT.md for first-pass observations and the original native coverage matrix; the resolved items above supersede its first-pass backlog.

## Native follow-up and response timings

The signed-in iOS simulator successfully exercised dashboard date selection, date-preserving meal history, earlier weeks, the Train list and existing completed workout detail. Typed workout interpretation returned the expected bench-press review; it was not saved because the batch API still requires deployment. The explicitly approved labelled coach test received “Test received”, remained visible after leaving/reopening, and survived terminating/restarting Expo Go. The labelled test and reply remain in the account history. No real meal or workout was changed during this follow-up.

Keyboard testing exposed the logging sheet title overlapping the iOS status bar. Both logging and ingredient sheets now respect the top safe-area inset; the logging sheet was visually checked with the keyboard open. Native header back buttons no longer show the internal `(tabs)` route label. Coach back navigation now falls back to Today when opened as the initial deep-linked screen. Both the fallback navigation and the accessible Back label were verified in the simulator.

Development-only instrumentation captures up to 200 recent records in memory and Metro logs, with a `/diagnostics` screen. All shared API-client requests capture total duration, header arrival, body consumption, HTTP status and success/error/timeout/cancellation. Coach captures first text and completion. Dashboard, meals, workout list/detail, settings and coach capture focus-to-data-ready. Logs omit bodies, query strings, tokens, IDs, message text and error contents; the coach stream wrapper is bypassed in production.

Observed real-service samples, in milliseconds:

| Measurement | Observed samples |
| --- | --- |
| Dashboard API | 407, 274 |
| Settings API | 461, 222 |
| Workout list API | 463, 323 |
| Coach history API | 248, 330 |
| Meals API | 262 |
| Coach first text | 3,673 |
| Coach completion | 3,745 |
| Coach focus to data ready after restart | 414 |
| Meals focus to data ready | 300 |
| Dashboard focus to cached data ready | 0 |

Raw observations are in `native-timings.json`. These are individual samples from Expo Go on an iPhone 17 Pro / iOS 26.2 simulator, not averages, p95, or release-device benchmarks. API timers begin after caller authentication; coach timers include authentication. Header arrival combines network and server wait; body duration combines transfer, parsing and JS scheduling. Screen readiness does not measure native paint, animation completion, or frame rate. A zero cache-hit value means data was already available at focus, not an instantaneous rendered transition.

The reads sampled here spend most of their time before headers arrive. The longer wait in the short coach test was before the first text, not the subsequent stream. More repeated samples and server-side tracing are needed before attributing that wait to a particular backend stage. Voice transcription, image upload, save latency, offline/retry timing, release cold launch and dropped frames still need dedicated measurements; instrumentation coverage is not evidence that every flow was exercised.
