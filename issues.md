# VoiceFit Mobile — Issue Tracker

Audit date: 2026-03-30

## Critical

- [x] **C1** `dashboard.tsx:689-691` — CalorieRing progress is inverted. Ring empties as user eats (progress = left/goal). Should fill as calories are consumed.
- [x] **C2** `dashboard.tsx:1559-1581` — Only first workout set saved. Review UI allows multiple sets but `saveReviewedEntry` only sends the first filled set. All others silently discarded.
- [x] **C3** `workouts.tsx:168-210` — Fabricated exercise data on real sessions. `buildExercisePreview` shows hardcoded "Bench Press 80kg" based on session title keywords, not actual logged data.
- [x] **C4** `exercise-picker.tsx:115-194` — Exercise picker filter is broken. Only "Recent" and "Chest" sections ever render. Selecting other filters shows empty results.
- [x] **C5** `app.json:15-17` — Missing `ios.bundleIdentifier`. iOS EAS builds will fail.
- [x] **C6** `app.json:plugins` — No microphone permission declared. No `NSMicrophoneUsageDescription` or Android `RECORD_AUDIO`. Voice feature will crash on production builds.

## High

- [x] **H1** `dashboard.tsx:1111-1117` — `closeCommandCenter` doesn't stop active recording. Pressing X while recording leaves mic live.
- [x] **H2** `dashboard.tsx:1038-1040` — `metricCurrentValues` not memoized, defeats all downstream memos. New array ref every render cascades recomputes.
- [x] **H3** `workouts.tsx:221-228,274` — "This Week" stats not filtered by week. Fetches last 20 sessions (any time range), labels them "This Week".
- [x] **H4** `workouts.tsx:274-285` — Fabricated exercise count. `Math.max(1, Math.round(totalSets / 4))` has no connection to real data.
- [x] **H5** `workout-session/[id].tsx:583-592` — `createSetMutation` in useEffect deps causes re-run every render.
- [x] **H6** `workout-session/[id].tsx:461-464` — Sequential awaits in mutation `onSuccess` block UI. Should be `Promise.all`.
- [x] **H7** `exercise-picker.tsx:151-153` — "Create" exercise button is dead. `Pressable` with no `onPress`.
- [x] **H8** `coach.tsx:159-161` — Coach chat history lost on navigation. Messages stored in `useState`, wiped when leaving tab.
- [x] **H9** `meals.tsx:185-200` — Delete meal mutation silently swallows errors. No `onError` handler.
- [x] **H10** `settings.tsx:49-53,275` — `formatGoal` on TextInput causes cursor jumping. Locale commas conflict with digit stripping.
- [x] **H11** `settings.tsx:173-176` — Settings useEffect overwrites in-progress edits on refetch.
- [x] **H12** `FloatingCommandBar.tsx:58-68` — Nested Pressable: mic button inside bar Pressable. On Android, tapping mic fires both handlers.
- [x] **H13** `app/_layout.tsx` — No ErrorBoundary in root layout. Unhandled exceptions = white screen in production.
- [x] **H14** `oauth-native-callback.tsx:6-9` — OAuth callback always redirects to `/sign-in`, ignores auth state.
- [x] **H15** `api-client.ts:58-64` — No fetch timeout on API calls. Requests hang indefinitely on flaky networks.
- [x] **H16** `FakeTabBar.tsx:53` — Hardcoded 83px height. Real tab bar calculates per-device; this is wrong on most devices.
- [x] **H17** `workout-session/[id].tsx:373-375` — Duration never ticks for active sessions. Computed once on data fetch.

## Medium

- [x] **M1** `dashboard.tsx:1988` — "+ Add Item" on meal review is non-functional. Styled as link, plain `<Text>`.
- [x] **M2** `dashboard.tsx:2005-2011` — "Eaten at" row looks tappable (chevron) but isn't.
- [x] **M3** `dashboard.tsx:2125-2131,375-376` — "Add to session" row non-interactive, label hardcoded to "Morning Push".
- [x] **M4** `dashboard.tsx:3186-3207` — Confidence pill always green even for "Low confidence".
- [x] **M5** `dashboard.tsx:1902-1909` — "Edit text" button re-interprets instead of letting user edit first.
- [x] **M6** `dashboard.tsx:926` — `dayOptions` memo has `[]` deps — stale after midnight.
- [ ] **M7** `dashboard.tsx:751-758` — WeightSparkline is fully hardcoded SVG, doesn't reflect real data. (Deferred — needs data pipeline)
- [x] **M8** `dashboard.tsx:802` — Trend goal line hardcoded to 2000 cal, ignores user's actual goal.
- [x] **M9** `dashboard.tsx:1233-1247` — "question" intent auto-saves without showing the answer to the user.
- [x] **M10** `dashboard.tsx:301` — `getMealVisualKind` classifies all "rice" meals as salmon icon.
- [x] **M11** `dashboard.tsx:1926,2034` — Missing `keyboardDismissMode` on review ScrollViews.
- [x] **M12** Multiple files — No `Keyboard.dismiss()` after saves across multiple screens.
- [ ] **M13** `workout-session/[id].tsx:353-359` — "Previous" column shows prior set in same session, not historical data from prior sessions. (Deferred — needs API changes)
- [x] **M14** `workout-session/[id].tsx:767-768` — KG/Reps headers shown for cardio exercises. Should show Duration.
- [x] **M15** `workout-session/[id].tsx:675` — `router.replace` for back navigation loses history.
- [x] **M16** `workouts.tsx:218,243` — Toast timer not cleaned up on unmount.
- [ ] **M17** `workouts.tsx:221-228` — No pagination, only first 20 sessions shown. (Deferred — needs infinite scroll UI)
- [x] **M18** `meals.tsx:172-178` — Edit panel doesn't auto-close after save.
- [x] **M19** `meals.tsx:148-155` — Stale error/success persists when switching meals.
- [x] **M20** `settings.tsx:341` — Sign out has no confirmation dialog.
- [x] **M21** `settings.tsx:310-339` — Settings rows look tappable (chevron) but aren't.
- [ ] **M22** `coach.tsx:372-379` — Coach mic button navigates away to dashboard instead of recording in-context. (Deferred — voice flow is centralized in dashboard)
- [x] **M23** `app/_layout.tsx` — No StatusBar component. Text may be invisible in dark mode with white bg.
- [x] **M24** `feed.tsx:47` vs `dashboard.tsx:164` — Two different "today" utilities (UTC vs local) produce different dates near midnight.
- [ ] **M25** All files — COLORS duplicated 11 times across files. (Deferred — refactoring task)
- [ ] **M26** `dashboard.tsx` + `feed.tsx` — `ensureQuickSession` duplicated. (Deferred — refactoring task)
- [ ] **M27** `components/MealGlyph.tsx` vs `dashboard.tsx` — Divergent MealGlyph implementations with different matching logic. (Deferred — refactoring task)
- [x] **M28** `coach.tsx:258` — No safe area on coach composer bottom, overlaps home indicator.
- [x] **M29** `sign-in.tsx:125,136` — OAuth buttons not disabled during submission. Can trigger both flows simultaneously.

## Low

- [ ] **L1** `dashboard.tsx:405` — `buildWorkoutSystemText` defined but never called.
- [ ] **L2** `dashboard.tsx` — `inferMealDescription`, `inferMealType`, `inferCalories` only used in web preview mock.
- [ ] **L3** `dashboard.tsx:342` — `parseWorkoutSetsFromTranscript` regex misses common spoken patterns.
- [ ] **L4** `workout-session/[id].tsx:288` — No-op assignment: `if (volume === "0 kg") { volume = "0 kg"; }`.
- [ ] **L5** `exercise-picker.tsx:134` — Exercise type always "resistance" in both ternary branches.
- [ ] **L6** `package.json` — `react-hook-form` declared, never imported.
- [ ] **L7** `package.json` — `playwright` in devDependencies of mobile app.
- [ ] **L8** `package.json` — `expo-linking` declared but `Linking` imported from `react-native`.
- [ ] **L9** `sign-in.tsx` — Terms of Service / Privacy Policy links non-functional.
- [ ] **L10** `sign-up-email.tsx:103` — No email verification flow implemented.
- [ ] **L11** All API callers — Token management pattern repeated ~30 times.
- [ ] **L12** `dashboard.tsx` — 3832-line file should be split into multiple modules.
