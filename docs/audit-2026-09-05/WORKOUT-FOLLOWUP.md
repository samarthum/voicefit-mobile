# Native workout follow-up — 2026-09-05

**Current status:** See [CURRENT-STATUS.md](./CURRENT-STATUS.md) for pushed commits and the latest verification. Details below record their original audit pass.

## Verified against production

Created one new session in the signed-in iOS simulator, entered the labelled synthetic sentence “UI audit test: bench press 2 sets of 8 reps at 10 kg”, reviewed and saved through the deployed batch API. The UI showed two saved sets and 160 kg volume. Terminated/restarted Expo Go and reopened the exact session: both rows remained. A scoped database read independently confirmed two rows, each 10 kg × 8 reps.

The original review incorrectly showed three rows: one at 10 kg and two without weights. The mobile parser matched both the full set-count phrase and its nested rep/weight phrase; it also failed to consume “reps” before the weight. Fixed by matching full multi-set phrases first, ignoring overlapping matches, and preserving phrase order. Both reviewed rows then correctly showed 10 kg × 8. Three regression tests cover this exact reproduction, mixed single/repeated sets, decimals, missing weights, and nine-set input (previously truncated to eight). The batch ceiling remains 100.

## Timings

- Create session: 543 ms.
- Subsequent list refresh that previously blocked navigation: 730 ms.
- Interpretation: 7,430 ms and 7,527 ms in two attempts.
- Batch save: 616 ms (HTTP 201).
- Detail refresh after save: 409 ms.

These are development simulator samples, not averages or release benchmarks. The interpretation wait dominates this flow; backend/model stages have not yet been individually traced. No claim is made that the parser fix accelerates the remote interpretation call.

## Additional local improvements

- New session navigation no longer awaits history-list refresh.
- Finish uses the server-returned completion timestamp immediately while refreshing summaries in the background.
- Rename updates the cached title from the successful response. The modal stays open during a failed save, keeping the name available for retry. Submit is guarded while pending.
- Finish, rename and session-delete button callbacks no longer leave rejected mutateAsync promises unhandled.
- Workout volume keeps the number separate from the unit label and uses a single line; stat labels are slightly larger with less letter spacing.

## Cleanup and remaining coverage

Removed only the newly created synthetic session, its two exact labelled sets and its one associated batch event, within a guarded transaction. The guard required the exact session ID, title, two rows, transcript and numeric values. Post-cleanup counts were zero. No real workout, meal, or coach history was removed. This backend cleanup is not evidence of the UI deletion flow.

The session header was visible in screenshots but not exposed in the simulator accessibility tree, and coordinate taps returned noWindowsAvailable. Header-menu rename/finish interactions still require native verification; the code changes above should not be represented as completed UI tests. Further work: instrument interpretation stages, test voice/photo and offline recovery, verify native permissions and large text, and complete authoritative weekly summaries.

Validation: 70 mobile tests pass, TypeScript passes, whitespace checks pass, and iOS Hermes export succeeds at /tmp/voicefit-mobile-audit-ios-workout-followup. The backend batch route remains the already deployed version; this follow-up changes mobile code only. Changes remain local and uncommitted.
