# VoiceFit Mobile — Native UI Audit

> Audited against the **Expo `building-native-ui` skill** (Expo SDK 54, expo-router 6, React Native 0.81, New Architecture).
> Date: 2026-06-07. Scope: `voicefit-mobile/app`, `components`, `lib`, `hooks` (56 source files, ~20k LOC).

The app is in good shape on fundamentals — New Arch is on, the design-token system is excellent, React Query is configured well, accessibility labels are present, and the command center already uses a modern gorhom bottom sheet. The gap is that the app is built almost entirely from **generic React Native primitives**, bypassing the native iOS surfaces (stack navigator, native tab bar, SF Symbols, continuous corners, Reanimated, haptics) that the skill exists to push you toward. Closing that gap is mostly mechanical and would make the app feel materially more "Apple-native."

---

## Scorecard

| Area | Status | Evidence |
|------|--------|----------|
| New Architecture enabled | ✅ Good | `app.json: newArchEnabled: true` |
| Design tokens / typography | ✅ Excellent | `lib/tokens.ts` |
| Data layer (React Query, focus refetch, timeouts) | ✅ Good | `app/_layout.tsx`, `lib/api-client.ts` |
| Safe-area library choice | ✅ Good | uses `react-native-safe-area-context`, never RN `SafeAreaView` |
| Command center sheet | ✅ Good | gorhom `BottomSheetModal` |
| **Navigation: native Stack** | ❌ **Missing** | root = `<Slot/>`; **0** Stack navigators app-wide |
| **Native tab bar** | ❌ JS `<Tabs>` | `app/(tabs)/_layout.tsx` + manual height math + duplicate `FakeTabBar` |
| **Shadows** | ❌ Legacy | 21 `shadowColor` + 6 `elevation`, **0** `boxShadow` |
| **Continuous corners** | ❌ Missing | 179 `borderRadius`, **0** `borderCurve` |
| **Animations** | ❌ Legacy | Reanimated installed but **0** app usage; all animation via RN `Animated` |
| **Haptics** | ❌ None | **0** `expo-haptics` calls in a voice-first app |
| Safe-area technique | ⚠️ Sub-optimal | `<SafeAreaView edges={["top"]}>` on 12 screens; `contentInsetAdjustmentBehavior` in **1** file |
| Audio library | ⚠️ Deprecated | `expo-av` in 3 files (skill: `expo-audio`) |
| Icons | ⚠️ Mixed | custom SVG glyphs in 19 files; **0** `expo-symbols` |
| Image component | ⚠️ | RN `Image` for meal photo (skill: `expo-image`) |
| Selectable text | ⚠️ | **0** `selectable` props |
| Keyboard handling | ⚠️ Mixed | 16 RN `KeyboardAvoidingView` despite `keyboard-controller` installed |
| Module size | ⚠️ | 4 files >1k LOC (overlay 2315, workout-session 1986, dashboard 1401, meal-edit 1067) |
| Path aliases | ⚠️ | none; 86 `../../` imports |
| `+not-found` route | ⚠️ | missing |

---

## P0 — Architecture (highest leverage)

### 1. Root layout uses `<Slot/>` — there is no native stack anywhere

`app/_layout.tsx:127` renders `<Slot />`, and there are **zero** `<Stack>` navigators in the entire app (only `<Slot>` at root and `<Tabs>` in `(tabs)`). Detail/edit routes are pushed imperatively:

```
app/(tabs)/dashboard.tsx:498  router.push({ pathname: "/meal-edit/[id]", params: { id } })
app/workout-session/[id].tsx:1183  router.push({ pathname: "/exercise-picker", ... })
```

Because there's no stack navigator, these screens get **no native push animation, no swipe-to-go-back gesture, no native header, and no modal/sheet presentation**. Every screen has had to hand-roll a header (a `<SafeAreaView edges={["top"]}>` + a custom title `<Text>` + a custom SVG close/back glyph wired to `router.back()`), e.g. `app/meal-edit/[id].tsx:475-489`.

**Why it matters:** This is the root cause of findings #6 (custom headers), #7 (safe-area technique), and half the icon glyphs. The skill: *"ALWAYS use `_layout.tsx` files to define stacks"* and *"the header and title should be set in a Stack."*

**Fix:** Convert the root to a `<Stack>` and present detail screens natively.

```tsx
// app/_layout.tsx — replace <Slot /> with:
import { Stack } from "expo-router/stack";

<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="meal-edit/[id]" options={{ presentation: "formSheet", sheetGrabberVisible: true, sheetAllowedDetents: [0.6, 1] }} />
  <Stack.Screen name="exercise-picker" options={{ presentation: "modal" }} />
  <Stack.Screen name="workout-session/[id]" options={{ headerShown: true, title: "Workout" }} />
  <Stack.Screen name="sign-in" options={{ headerShown: false }} />
</Stack>
```

You get swipe-back, native transitions, and can delete the hand-rolled headers + back glyphs in `meal-edit`, `exercise-picker`, `workout-session`, and the sign-in/up screens. `exercise-picker` and `meal-edit` are textbook modal/`formSheet` candidates.

### 2. JS `<Tabs>` instead of `NativeTabs`

`app/(tabs)/_layout.tsx` uses `<Tabs>` from `expo-router` with ~25 lines of manual `tabBarHeight`/`paddingBottom` math branched on `Platform.OS`, custom SVG tab icons, and a hidden-tab juggle (`href: null`). There's also a **second, duplicate** tab bar — `components/FakeTabBar.tsx` — re-implementing the same three tabs for full-bleed screens.

**Why it matters:** The skill: *"Always prefer NativeTabs from `expo-router/unstable-native-tabs` for the best iOS experience."* NativeTabs gives the iOS 26 liquid-glass bar, Material 3 on Android, and removes all the inset math (*"Tab bar height: cannot be measured programmatically"* — so stop measuring it).

**Fix:**

```tsx
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

<NativeTabs>
  <NativeTabs.Trigger name="dashboard"><Icon sf="house.fill" /><Label>Today</Label></NativeTabs.Trigger>
  <NativeTabs.Trigger name="workouts"><Icon sf="figure.strengthtraining.traditional" /><Label>Train</Label></NativeTabs.Trigger>
  <NativeTabs.Trigger name="settings"><Icon sf="person.fill" /><Label>You</Label></NativeTabs.Trigger>
</NativeTabs>
```

This deletes the height math, the custom SVG `TodayIcon/TrainIcon/YouIcon`, and `FakeTabBar.tsx`. (Combine with #1: nest a `<Stack>` inside each tab group for per-tab headers.)

---

## P1 — Pervasive styling & interaction gaps

### 3. Legacy shadows (0 `boxShadow`)

21 × `shadowColor/shadowOpacity/shadowRadius` + 6 × `elevation:`, including the shared `elevation` tokens in `lib/tokens.ts:108-134`. Skill: *"Use CSS `boxShadow` style prop. NEVER use legacy React Native shadow or elevation styles."*

**Fix** — one change in `tokens.ts` fixes most of the app:
```ts
sheet: { borderColor: color.line, borderWidth: 1, boxShadow: "0 12px 24px rgba(15,20,25,0.08)" },
primaryCTA: { boxShadow: "0 4px 12px rgba(15,20,25,0.10)" },
accentGlow: { boxShadow: "0 0 16px rgba(94,140,122,0.18)" },
```

### 4. No continuous corners (0 `borderCurve`)

179 `borderRadius` declarations, **zero** `borderCurve: 'continuous'`. This is the single biggest "why does it look slightly off" tell on iOS. Skill: *"Use `{ borderCurve: 'continuous' }` for rounded corners unless creating a capsule shape."*

**Fix:** add `borderCurve: "continuous"` to every non-pill rounded style. Consider a tiny helper, e.g. `card(r) => ({ borderRadius: r, borderCurve: "continuous" })`, and apply across cards/buttons/inputs (skip the `radius.pill` capsules).

### 5. Reanimated installed but unused — all animation is legacy `Animated`

`react-native-reanimated@4.1.1` is a dependency (pulled in by gorhom) but **app code uses it nowhere**. Instead `lib/motion.ts`, `components/pulse/{VoiceRing,Waveform,LoadingSkeleton,UndoToast}.tsx` all build on RN's `Animated`. There are also no `entering`/`exiting`/`layout` animations on state changes (offline banner, day picker, meal rows appearing, badges). Skill: *"Use Reanimated v4. Avoid React Native's built-in Animated API"* and *"Add entering and exiting animations for state changes."*

**Fix:** migrate the `pulse` animation primitives to `useSharedValue`/`withTiming`/`withRepeat`, and wrap list/state changes in `Animated.View entering={FadeInUp} exiting={FadeOut} layout={LinearTransition}`. The UndoToast and OfflineBanner are the quickest wins.

### 6. No haptics anywhere

**Zero** `expo-haptics` usage in a voice-first app whose primary gestures are *hold-to-record*, *save*, *delete*, and *toggle*. Skill: *"Use expo-haptics conditionally on iOS to make more delightful experiences."*

**Fix:**
```ts
import * as Haptics from "expo-haptics";
if (process.env.EXPO_OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // mic press
// success: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) on save
```
Highest-value spots: mic press (`FloatingCommandBar`), recording start/stop (`log.tsx`, `use-coach-voice-input.ts`), meal/set save, swipe-delete confirm, set-complete checkmark in `workout-session`.

### 7. Safe-area via `SafeAreaView edges={["top"]}` instead of `contentInsetAdjustmentBehavior`

12 screens wrap in `<SafeAreaView edges={["top"]}>`; only `coach-message-list.tsx:98` uses `contentInsetAdjustmentBehavior="automatic"`. Skill: *"Use `<ScrollView contentInsetAdjustmentBehavior="automatic" />` instead of `<SafeAreaView>` for smarter safe area insets"* and *"Ensure both top and bottom safe area insets are accounted for"* (most screens only handle `top`).

**Fix:** once #1 lands (native Stack headers), drop the `SafeAreaView` wrappers and set `contentInsetAdjustmentBehavior="automatic"` on the root `ScrollView`/`FlatList` of each screen — the header + inset behavior then handles top and bottom automatically.

### 8. Custom headers instead of native Stack titles

Direct consequence of #1 — every screen renders a custom title `<Text>` (e.g. `dashboard` Wordmark row `:521`, `meal-edit` "Edit meal" `:487`). Skill: *"ALWAYS use a navigation stack title instead of a custom text element on the page."* Resolved by adopting #1/#2.

---

## P2 — Component & library swaps

### 9. `expo-av` → `expo-audio`

`expo-av` is used in `app/(tabs)/log.tsx`, `components/command-center/CommandCenterProvider.tsx`, `hooks/use-coach-voice-input.ts`. Skill: *"`expo-audio` not `expo-av`."* `expo-av` is deprecated and slated for removal — migrate recording to `expo-audio`'s `useAudioRecorder`.

### 10. RN `Image` → `expo-image`

`components/command-center/CommandCenterOverlay.tsx:491` renders the meal photo with React Native's `Image`. Skill: *"`expo-image` Image component."* `expo-image` adds caching, better decoding, and `contentFit`. (It's the only raster image in the app, so this is a one-line swap.)

### 11. Icons: custom SVG glyphs → `expo-symbols` (for standard glyphs only)

19 files import `react-native-svg`. Two distinct uses:
- **Data viz** (`CalorieRing`, `WeightSparkline`, `VoiceRing`, `Waveform`, `Wordmark`) — **keep as SVG**, SF Symbols can't draw these.
- **Standard UI glyphs** — chevrons, plus, close, bell, calendar, clock, heart, person, mic (`settings.tsx:75-172` alone has 8). These should be `expo-symbols` `SymbolView` for native weight-matching and dark-mode tint.

Skill: *"Use SF Symbols for native feel."* Migrate the standard glyphs; the line-art brand icons in the tab bar are replaced for free by NativeTabs `<Icon sf=...>` (#2).

### 12. No `selectable` text

**Zero** `selectable` props. Skill: *"Add the `selectable` prop to every `<Text/>` element displaying important data or error messages."* Add it to numerals/totals (calories, weight), transcripts, coach messages, and all error strings (e.g. the `ErrorBoundary` message, `meal-edit` error body). *(Numeral alignment itself is already handled — numerals use Geist Mono, so `tabular-nums` is largely moot.)*

### 13. Consolidate keyboard handling on `keyboard-controller`

`react-native-keyboard-controller` is installed and `KeyboardProvider` wraps the app (`_layout.tsx:114`), yet 16 screens still use RN's `KeyboardAvoidingView` and only `workout-session` uses the keyboard-controller variant. Standardize on `KeyboardAwareScrollView` / `KeyboardAvoidingView` from `react-native-keyboard-controller` (smoother, interactive, consistent across iOS/Android).

### 14. Minor primitive swaps

- **`Platform.OS` → `process.env.EXPO_OS`** — 8 occurrences across 6 files. The env form is statically replaced and tree-shakes per-platform. Skill: *"`process.env.EXPO_OS` not `Platform.OS`."*
- **`useContext` → `React.use`** — `CommandCenterProvider.tsx:57,91`. Skill: *"`React.use` not `React.useContext`."*

### 15. God components

`CommandCenterOverlay.tsx` (2315), `workout-session/[id].tsx` (1986), `dashboard.tsx` (1401), `meal-edit/[id].tsx` (1067) mix data fetching, business logic, and many inline sub-components. Skill: *"NEVER co-locate components, types, or utilities in the app directory."* The route files in `app/` should be thin; extract the per-state sheet bodies, the dashboard cards (`CalorieRing`, `MiniStepsRing`, etc.), and the set-table into `components/`.

### 16. Project hygiene

- **Path aliases:** `tsconfig.json` has none → 86 `../../` imports. Skill: *"Configure tsconfig.json with path aliases, and prefer aliases over relative imports."* Add `"paths": { "@/*": ["./*"] }` + `baseUrl`.
- **`+not-found.tsx`:** missing. Skill: add one so unmatched routes don't blank out.
- **Large-number formatting:** steps/weekly-volume render raw via `toLocaleString()` (e.g. `dashboard.tsx:647`, `workouts.tsx:348`). Skill: *"Consider formatting large numbers like 1.4M or 38k."* Low priority.

### 17. Opportunities (not violations)

- **Link previews & context menus:** the app navigates entirely via `router.push` (0 `<Link>`). Wrapping meal/workout cards in `<Link>` with `<Link.Preview>` + `<Link.Menu>` (Edit / Delete / Duplicate) would add iOS-native long-press affordances. Skill: *"Add context menus and previews frequently."*
- **Dark mode:** `app.json` locks `userInterfaceStyle: "light"`. If intentional for the brand palette, fine — but the legacy shadows/static colors are what block it, so #3 + `PlatformColor` would make it cheap later.

---

## Suggested sequencing

1. **`tokens.ts` boxShadow + `borderCurve` helper** (#3, #4) — one file, instantly lifts the whole app.
2. **Root `<Stack>` + modal/formSheet presentations** (#1) — unlocks deleting custom headers/back glyphs and fixing safe-area (#6, #7, #8).
3. **`NativeTabs`** (#2) — deletes tab math, custom tab icons, and `FakeTabBar`.
4. **Haptics + Reanimated entering/exiting** (#5, #6) — delight pass.
5. **Library swaps** (`expo-audio`, `expo-image`, `expo-symbols` glyphs, keyboard-controller) (#9–#13).
6. **Hygiene** (aliases, `+not-found`, god-component extraction) (#15, #16).

Every finding above is grounded in a `file:line` or a repo-wide count; nothing here requires a redesign — it's adopting the native surfaces the primitives are standing in for.
