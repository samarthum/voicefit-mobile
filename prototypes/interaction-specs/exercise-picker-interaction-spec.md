# Exercise Picker Interaction + State Spec

- Last updated: 2026-03-10
- Screen: Exercise Picker
- Status: Locked for current prototype parity pass

## Source links
- UI source-of-truth index: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/spec-ui-source-of-truth.md`
- Prototype: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/exercise-picker.html`
- Implementation: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/exercise-picker.tsx`

## States
- `picker_ready`
- `picker_filtered`
- `picker_selecting`

## Locked interactions
- `tap_close` returns to the previous screen.
- `type_search(query)` filters the visible exercise list in place.
- `tap_filter(group)` switches the active chip and filters rows.
- `tap_add_exercise`:
  - with `sessionId`: replace back into `/workout-session/[id]` with picker payload params.
  - without `sessionId`: return to `/workouts`.
- floating command bar routes into Home command center.

## Visual contract
- Header row with close, title, and `Create`.
- Search field and horizontal chip row.
- `Recent` section followed by filtered exercise sections.
- Plus affordance on each row.
- Bottom floating command bar anchored above the viewport edge.
