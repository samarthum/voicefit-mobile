# VoiceFit Mobile — Audit Continuation Handoff

## Context (read first)
You are continuing a mobile-correctness audit of **voicefit-mobile** (Expo SDK 54, React Native 0.81.5, New Architecture enabled, Android edge-to-edge, package manager = bun).
- Repo root: `/Users/samarth/Desktop/Work/voicefit-all`
- Mobile app: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile`
- Full project context: `/Users/samarth/Desktop/Work/voicefit-all/CLAUDE.md`

A prior session already audited the app and fixed the keyboard / safe-area / error-state items. **Do NOT redo these.** Already shipped:
- sign-up form keyboard avoidance; IngredientEditor Android keyboard lift; meals + workouts query error states.
- Migrated screen keyboard handling to `react-native-keyboard-controller` and the command-center bottom sheet to `@gorhom/bottom-sheet`.

These native deps are **already installed** — do NOT reinstall or rewire: `react-native-keyboard-controller`, `@gorhom/bottom-sheet`, `react-native-reanimated` (v4), `react-native-gesture-handler`, `react-native-worklets`. `babel.config.js` exists (worklets plugin). Root providers in `app/_layout.tsx` are: `GestureHandlerRootView → KeyboardProvider → ClerkProvider → QueryClientProvider → SafeAreaProvider → BottomSheetModalProvider`.

Caveats:
- The keyboard/bottom-sheet changes are type-checked but **NOT device-tested** (a fresh dev-client / EAS build is still pending). Don't treat them as verified on-device.
- `bunx tsc --noEmit` is currently **clean (exit 0)**. (The 9 former `app/(tabs)/trends.tsx` errors from the stale vendored `@voicefit/contracts` were fixed via local type augmentation in `mockDashboard()` — same convention dashboard.tsx uses. No contracts rebuild was needed.)

## Mobile rules to apply (same standard as before)
> You are working on a React Native + Expo app.
> Use React Native primitives, not web DOM elements. Be careful with mobile layout, safe areas, keyboard behavior, and platform differences between iOS and Android.
> For screens, use safe-area-aware layout. For forms, ensure TextInputs remain visible when the keyboard opens. Do not use fragile manual keyboard offsets unless necessary. Avoid double-handling keyboard movement with both KeyboardAvoidingView and custom Keyboard listeners.
> For modal-like UI, distinguish between Modal, bottom sheet, backdrop, handle, snap points, and inner scrollable content. If implementing a bottom sheet, do not translate the entire sheet off-screen when the keyboard opens. Keep the input visible and make secondary content scroll, shrink, or hide.
> Use FlatList for long lists, ScrollView for small content, Pressable for touch interactions, and clear loading/error/empty states for async data.
> Before making changes, explain which mobile concept is involved: navigation, layout, safe area, keyboard handling, bottom sheet behavior, storage, API state, permissions, or performance.

## Working agreement
- React Native primitives only; match the surrounding code's style and design tokens.
- Prefer one subagent per file/task to keep the main context clean.
- State which mobile concept is involved before each change.
- Verify with `cd voicefit-mobile && bunx tsc --noEmit`; your changes must add **zero new errors** (ignore the 9 trends.tsx errors if still present).
- Line numbers below are approximate (files were edited last pass) — locate by symbol/testID.

## Tasks remaining

### TASK A (primary) — #4: Virtualize the workouts list
Concept: **performance / lists.** File: `app/(tabs)/workouts.tsx`.
Problem: it drives an `useInfiniteQuery` (`sessionsQuery`) but renders all loaded sessions via `sessionCards.map(...)` inside a `<ScrollView>`, with hand-rolled pagination in the ScrollView's `onScroll` (`scrollEventThrottle={200}` + manual offset math calling `fetchNextPage`). No virtualization — every row stays mounted.
Fix: convert to `FlatList` (or `LegendList` from `@legendapp/list`, already a dep and used in coach):
- `data={sessionCards}`, `keyExtractor`, `renderItem` = the existing session-card JSX.
- Move the header (page title, stats strip, week bars) into `ListHeaderComponent`.
- Replace the manual `onScroll` pagination with `onEndReached` + `onEndReachedThreshold`, calling `sessionsQuery.fetchNextPage()` guarded by `hasNextPage && !isFetchingNextPage`.
- `ListEmptyComponent` covers loading / error (the error+Retry state added last pass) / empty — reuse the existing branch logic.
- `ListFooterComponent` = the `isFetchingNextPage` spinner.
- Keep the `RefreshControl` (refreshControl prop) and the `FloatingCommandBar`; add bottom `contentContainerStyle` padding so the last row clears the floating bar + tab bar.
- Reference pattern: `app/(tabs)/feed.tsx` is the established FlatList in this repo (ListHeaderComponent / ListEmptyComponent / ListFooterComponent).

### TASK B — LOW / polish items
1. **feed.tsx safe area** (concept: safe area). `app/(tabs)/feed.tsx` returns a root `<FlatList>` with no `SafeAreaView` / top inset, so the title renders under the status bar. Wrap in `<SafeAreaView edges={["top"]}>` (from `react-native-safe-area-context`) or add `insets.top` to the `ListHeaderComponent`.
2. **FloatingCommandBar insets** (concept: safe area). `components/FloatingCommandBar.tsx` uses `bottom: bottomOffset` (default 8) and ignores `insets.bottom`. Currently only used on tab screens where the tab bar provides clearance (low risk), but make it safe-area aware (`useSafeAreaInsets`, fold `insets.bottom` into the offset) so it's correct if reused on a full-bleed screen. Verify it doesn't double-space above the tab bar on meals/workouts.
3. **SavedToast dead "Undo"** (concept: API state / UX). In `components/command-center/CommandCenterOverlay.tsx`, the saved-toast Undo is `onPress={() => undefined}` (search testID `cc-saved-undo`). Either wire it to actually undo the last save (needs the created entry id + a delete dispatch in the command-center controller/reducer) or remove the button — a dead control is worse than none. If undo isn't quick, remove it.
4. **Accessibility** (concept: layout/a11y). Icon-only `Pressable`s (close / back / mic / chevron / menu) across screens lack `accessibilityLabel` / `accessibilityRole="button"`. Add them; `components/coach/*` are the in-repo examples.

## Definition of done
- `bunx tsc --noEmit` clean (modulo the pre-existing trends.tsx 9 if not yet fixed elsewhere).
- Call out anything that needs on-device QA (TASK A pagination/scroll behavior; FloatingCommandBar spacing).
- Note: the previously-shipped keyboard/bottom-sheet work still needs a dev-client/EAS build + device QA — separate from these tasks.
