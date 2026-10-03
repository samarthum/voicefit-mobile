# Full-screen ingredient editor regressions

The actual `IngredientEditorModal` implementation remains in `IngredientEditorSheet.tsx`, with a compatibility export for existing callers. It renders a keyed React Native Modal with `animationType="none"` and `presentationStyle="fullScreen"`; no Gorhom input/scroll/lifecycle code runs in its body.

Run with the external matching React 19.1 renderer (do not install into the app):

```sh
MEAL_UI_TEST_DEPS=/home/hermes/.hermes/cache/scratch/meal-ui-test-deps \
EXPO_PUBLIC_API_BASE_URL=https://example.invalid \
/home/hermes/.hermes/tools/node-26.7.0-linux-x64/bin/node --test --test-reporter=tap \
components/command-center/__tests__/ingredient-modal.cjs \
components/command-center/__tests__/ingredient-modal-callers.cjs \
components/command-center/__tests__/ingredient-modal-keyboard.cjs
```

## Evidence boundaries

- The harness executes actual host/form, actual command-center provider/controller/overlay/review row callbacks, actual saved-meal route/list callbacks, and the installed RN 0.81.5 Modal JavaScript wrapper down to its `RCTModalHostView` prop boundary.
- RCTModalHostView, native inputs, geometry, keyboard visibility, HTTP/auth/cache/navigation and the unrelated parent Gorhom sheet are module-local seams. These tests are not device, gesture, native window, real IME, deployed HTTP, or persistence evidence.
- The caller matrix invokes Cancel, header Cancel, native `onRequestClose`, grams Save, rename Save and Add Save, then immediately reopens the same row, another row, or Add without layout/onShow/onDismiss. It drains obsolete callbacks after the new modal is mounted. Late lookup resolution/rejection is exercised across both callers, same/different/Add replacement, caller teardown and retry.
- IME-visible `onRequestClose` only dismisses the keyboard; a visibility change alone must not close the editor. A later Back while hidden closes it. No scoped BackHandler is required or registered.
- Android and iOS installed Modal wrappers are both exercised for stale native dismissal/request-close callbacks; each session has a new native modal identifier.
- Installed keyboard-controller 1.18.5 aware-scroll worklets are executed for matching scroll ownership, name/decimal-grams refocus, hidden/open IME and a taller text input. These are explicit fixture geometry calculations, not native measurements.
- `INGREDIENT_MODAL_SOURCE_ROOT` is a test-only opt-in for loading the two frozen old editor modules; ordinary gates leave it unset. It permits hash-verifiable old-host RED replay without modifying production source.

## Keyboard ownership

The unchanged app root already supplies KeyboardProvider. In the installed 1.18.5 Android `ModalAttachedWatcher`, the dialog decor root receives its own KeyboardAnimationCallback, while `eventPropagationView = view` forwards keyboard and focused-input events to the existing provider. The watcher applies dialog `SOFT_INPUT_ADJUST_NOTHING`. The shipped same-version official Modal example consumes the existing keyboard context inside Modal, without nesting a second KeyboardProvider. Thus the new form uses the installed KeyboardAwareScrollView with plain RN TextInput, not RN resize assumptions or hand-written keyboard-height arithmetic. A modal-local SafeAreaProvider/SafeAreaView measures this window's safe area independently of the parent screen.

Native-device verification is still required for actual OS Back/IME event order, autofocus, keyboard heights and decimal-pad/manual-refocus behavior on supported Android devices. Browser text scaling is only a layout allowance, not native accessibility fontScale.

## Archived evidence

Eight untracked old Gorhom regression/harness/doc files were copied byte-for-byte into `../qa/ingredient-native-2026-10-03/fullscreen-2026-10-03/archived-sheet-tests/` before removal from this source tree. All original QA reports, failed runs, frozen diffs/manifests and independent reviewer scripts remain untouched. Those tests target the retired animation/portal architecture; they are not shipped as a deliberately failing CI suite, and are not relabeled as passing the new host. Swipe/backdrop dismissal is intentionally absent from the full-screen UX.
