# Workout Session Interaction + State Spec

- Last updated: 2026-03-10
- Screen: Workout Session
- Status: Locked for current prototype parity pass

## Source links
- UI source-of-truth index: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/spec-ui-source-of-truth.md`
- Active prototype: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/workout-session.html`
- Empty prototype: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/workout-session-empty.html`
- Implementation: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/workout-session/[id].tsx`
- Exercise picker: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/exercise-picker.tsx`

## States
- `session_loading`
- `session_active`
- `session_empty`
- `session_finished`
- `set_saving`
- `session_error`

## Locked interactions
- `tap_back` returns to `/workouts`.
- `tap_finish` finishes the session in live mode; in preview it locks the finish button state.
- `tap_add_set` appends a new editable row for the chosen exercise.
- `tap_add_exercise` routes to `/exercise-picker?sessionId=<id>`.
- `picker_add_exercise(name,type)` returns to the session and inserts a starter row for that exercise.
- `tap_save_set` persists the edited set row in live mode.
- floating command bar routes into Home command center (`cc=expanded` or `cc=recording`).

## Preview parity rules
- `preview-empty` must match the locked empty-state prototype shell.
- `preview-active` must match the locked active-state prototype shell.
- Picker handoff must work for preview ids; it cannot dead-end.
- Active preview includes inline `+ Add Set`, a dashed `+ Add Exercise` button, and the voice prompt helper below cards.
