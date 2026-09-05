# Interpretation → dashboard follow-up

## Local changes

- Entry, processing, review and saving now use one stable 92% sheet height. Removed the dynamic snap changes between these states.
- Retain the final sheet body while it animates closed instead of replacing it with a tiny empty body. Success feedback waits for the sheet dismissal callback before appearing.
- Clear the success text when resetting the logging state, keeping the overlapping toast/reset timers from exposing stale text.
- When the meal API acknowledges a real row, insert that row into the matching date's existing dashboard cache immediately. Preserve unknown calories and existing totals; let the authoritative dashboard response supply nutrition. An existing row with the same ID is never duplicated or regressed.
- Refresh Recent meals when opening the sheet so a newly finished interpretation is available as a shortcut.
- Only persist successful queries. A cancelled pending-query hydration warning was observed during development reload; the cache version was bumped to v4 to discard old persisted pending snapshots. This is a cache reset, not a user-data deletion.

## Native checks

Used the real signed-in iOS simulator and production backend. Submitted a labelled banana before the changes, then a labelled apple after them. Both completed; Today displayed one row per meal and the expected combined 200 kcal. The revised flow exposed Saving before returning to the populated dashboard; no lingering success text was present at the later inspection. Reopened logging and verified that the new apple appeared in Recent meals. Entered another draft with the keyboard open and closed it without submitting. A scoped database check confirmed zero rows for that unsaved draft.

The capture tool failed during one attempted screenshot and otherwise provides sparse snapshots. The state transitions and resulting data were checked; a frame-by-frame comparison, dropped-frame count, prolonged offline scenario, photo/voice transition and physical-device release profiling are still outstanding. Do not describe this as proof of smooth 60 fps animation. The fixed-height sheet also needs small-screen and large-text regression checks.

## Timing samples

Before: meal acknowledgement 1,744 ms, first dashboard refresh 273 ms.
After: meal acknowledgement 381 ms, first dashboard refresh 361 ms.

These are individual network samples, with no claim that the UI changes caused the request-time difference. Meal acknowledgement is HTTP 202 and is not completion of background interpretation. Raw samples are in native-timings.json.

## Verification and cleanup

73 mobile tests passed, including pending-row insertion without invented totals, deduplication without regressing a completed row, and exclusion of pending/error queries from disk persistence. TypeScript, whitespace checks and iOS Hermes export passed (/tmp/voicefit-mobile-audit-ios-transition).

Both synthetic meals, their ingredient rows and associated meal events were removed using exact-ID and transcript guards after interpretation finished. No personal meal, workout or coach history was removed. Changes remain local and uncommitted; no further backend deployment was required.
