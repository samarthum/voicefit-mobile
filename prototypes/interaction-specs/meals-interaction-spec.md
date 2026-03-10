# Meals Screen Interaction + State Spec

- Last updated: 2026-03-10
- Screen: Meals
- Status: Locked for current prototype parity pass

## Source links
- UI source-of-truth index: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/spec-ui-source-of-truth.md`
- Design decisions: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md`
- Meals prototype: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/meals.html`
- Implementation: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/meals.tsx`

## Purpose
Define the locked list-and-edit behavior for the standalone Meals screen reached from Home.

## State model
- `meals_loading`: initial query in progress.
- `meals_ready`: list renders with summary cards, filter card, recent meal rows, floating command bar.
- `meals_empty`: valid query result with no meals.
- `meal_selected`: a meal row is active and the edit card is visible.
- `meal_saving`: selected meal is being saved.
- `meal_deleting`: selected meal is being deleted.
- `meals_error`: blocking query failure for the screen.

## Event table

| Event | From | To | Side effects |
|---|---|---|---|
| `screen_opened` | `meals_loading` | `meals_ready` | Render meals for current filter. |
| `screen_opened` | `meals_loading` | `meals_empty` | Render empty state if list is empty. |
| `screen_opened` | `meals_loading` | `meals_error` | Show query failure copy. |
| `tap_apply_filter` | `meals_ready` | `meals_loading` | Re-query using entered `YYYY-MM-DD`. |
| `tap_clear_filter` | `meals_ready` | `meals_loading` | Clear date filter and reload. |
| `tap_meal_row(id)` | `meals_ready` | `meal_selected` | Populate edit form from chosen meal. |
| `tap_meal_row(id)` | `meal_selected` | `meals_ready` | Collapse edit card when same row tapped again. |
| `tap_save_meal` | `meal_selected` | `meal_saving` | Persist description, calories, meal type. |
| `save_success` | `meal_saving` | `meal_selected` | Keep card open, refresh meals + Home dashboard. |
| `tap_delete_meal` | `meal_selected` | `meal_deleting` | Delete row after confirmation. |
| `delete_success` | `meal_deleting` | `meals_ready` | Refresh meals + Home dashboard, clear selection. |
| `tap_command_center` | any ready state | Home Command Center | Route to `/(tabs)/dashboard?cc=expanded`. |
| `tap_command_center_mic` | any ready state | Home recording state | Route to `/(tabs)/dashboard?cc=recording`. |

## UI contract

| State | Required UI |
|---|---|
| `meals_ready` | Title, subtitle, 2 summary cards, date filter card, recent meal list, floating command bar, tab bar. |
| `meals_empty` | Same shell as ready state plus empty-state body replacing meal rows. |
| `meal_selected` | Selected row highlighted and `Edit Meal` card visible under the list. |
| `meal_saving` | Save button shows loading label and blocks duplicate submit. |
| `meal_deleting` | Delete path blocks duplicate submit until request resolves. |
| `meals_error` | Error copy visible; list/edit affordances hidden. |

## Preview-mode behavior
- Web preview auto-selects the first sample meal so the screen opens in the same visual state as `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/meals.html`.
- Preview save is non-persistent and only confirms the state contract visually.
