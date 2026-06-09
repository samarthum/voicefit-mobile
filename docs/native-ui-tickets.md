# VoiceFit Mobile — Native UI Improvement Tickets

> **Handoff doc for a fresh Claude Code session.** Each ticket is self-contained: it lists the files, the problem, a concrete implementation, platform caveats, and acceptance criteria. Do them in any order **unless a ticket says `Depends on`**. Source analysis: [`docs/native-ui-audit.md`](./native-ui-audit.md).

---

## 0. Orientation (read first)

**What this is:** `voicefit-mobile` is the Expo (SDK 54, expo-router 6, React Native 0.81, **New Architecture on**) client for VoiceFit, a voice-first health tracker. The web app + API live in the sibling `voicefit/` package; this repo is UI only and talks to the backend over REST (`lib/api-client.ts`).

**Where things live:**
- `app/` — expo-router routes only (`_layout.tsx`, screens). Root layout: `app/_layout.tsx`. Tabs: `app/(tabs)/_layout.tsx`.
- `components/` — `pulse/` (design-system primitives), `command-center/` (the floating input overlay, uses gorhom bottom sheet), `coach/`.
- `lib/tokens.ts` — **the single source of truth for all visual styling** (color, space, radius, type, elevation, motion). Prefer changing tokens over per-screen styles.
- `lib/motion.ts` — animation helpers (currently wrap the legacy RN `Animated` API).

**Commands:**
- Typecheck: `bun run typecheck` (`tsc --noEmit`) — **must pass after every ticket.**
- Unit tests: `bun test` (there's a controller test under `components/command-center/__tests__`).
- Run: this project depends on native modules not in Expo Go (`react-native-keyboard-controller`, `@gorhom/bottom-sheet`, reanimated worklets), so **use a dev client / EAS build, not Expo Go.** `bun start` then a dev build, or `npx eas build --profile preview --platform android`.

**⚠️ Platform reality — READ THIS: BOTH iOS AND ANDROID ARE FIRST-CLASS.** Every ticket must look and feel great on **both** platforms — verify each on an iOS *and* an Android build before calling it done. The Expo `building-native-ui` skill is iOS-centric, so embrace its iOS-native surfaces, but **always provide an Android-equivalent** (never let an iOS-only API leave Android broken or bare).

> **Build-pipeline gap:** `eas.json` currently has **Android-only** profiles (preview APK, production app-bundle → Google Play internal). iOS is configured in `app.json` (`bundleIdentifier`, `infoPlist`) but has **no EAS build/submit profiles yet** — see **NUI-0** to close this before shipping iOS.

| API | iOS | Android | What to do |
|-----|-----|---------|------------|
| `boxShadow` (style prop) | ✅ | ✅ (New Arch on) | Use everywhere |
| `borderCurve: 'continuous'` | ✅ | no-op (harmless) | Use everywhere (iOS gets the benefit) |
| Haptics (`expo-haptics`) | ✅ | ✅ | Use everywhere |
| Reanimated v4 | ✅ | ✅ | Use everywhere |
| `expo-audio` / `expo-image` / keyboard-controller | ✅ | ✅ | Use everywhere |
| `NativeTabs` | liquid glass | Material 3 | Use it — but ship Android icons too (drawable/VectorIcon), see NUI-4 |
| `expo-symbols` (SF Symbols) | ✅ | ❌ none | Use **via a cross-platform `<Icon>` wrapper** with an Android fallback (NUI-11) — **not** deferred |

**Conventions already in place (keep them):** design tokens, accessibility labels/roles on every `Pressable`, `keyboardDismissMode="on-drag"` on scrollables, auto-dismiss of success states, `react-native-safe-area-context` (never RN `SafeAreaView`).

---

## Dependency map

```
Track 0 (cross-platform infra):          NUI-0                  ── do early, unblocks iOS testing
Track A (visual, do first, zero-risk):   NUI-1  NUI-2          ── all independent
Track B (navigation restructure):        NUI-3 → NUI-4 → NUI-5  ── sequential
Track C (motion & feel):                 NUI-6  NUI-7          ── independent
Track D (library swaps):                 NUI-8  NUI-9  NUI-10  NUI-11  ── independent
Track E (hygiene):                       NUI-12 NUI-13 NUI-14 NUI-15 NUI-16 NUI-17 ── independent
```
Recommended order: **NUI-0 → A → B → C → D → E**. Tracks A, C, D, E can be parallelized across sessions; only Track B is internally sequential. **Every ticket is verified on both iOS and Android** (NUI-0 gets the iOS build going so you can actually do that).

---

# Track 0 — Cross-platform infrastructure

## NUI-0 · Add iOS to the EAS build/submit pipeline
**Priority:** P0 (blocks iOS verification of every other ticket) · **Effort:** S–M · **Independent**

**Problem:** Both platforms must ship, but `eas.json` only has Android build profiles and an Android submit config. iOS is set up in `app.json` (`ios.bundleIdentifier`, usage strings) but there's no way to produce or submit an iOS build, so you can't actually verify the rest of these tickets on iOS.

**Files:** `eas.json`, `app.json` (iOS section), App Store Connect / Apple Developer setup.

**Implementation:**
- Add iOS to each EAS profile (development client for local dev, simulator or device for preview, store build for production):
  ```jsonc
  // eas.json
  "preview":    { "distribution": "internal", "android": { "buildType": "apk" },
                  "ios": { "simulator": true } },
  "production": { "autoIncrement": true, "android": { "buildType": "app-bundle" },
                  "ios": {} },
  ```
- Add an iOS submit config (`submit.production.ios` with `ascAppId` / Apple team) once App Store Connect is set up.
- Set up signing (`eas credentials` or let EAS manage it). Confirm `ios.buildNumber` auto-increment.
- Smoke-build: `npx eas build --profile preview --platform ios` (simulator build is enough to start QA).
- The `expo-deployment` skill covers the App Store side end-to-end if you need it.

**Acceptance:** `npx eas build --platform ios --profile preview` produces a runnable build; the app launches and signs in on an iOS simulator/device. From here, every later ticket can be checked on both platforms.

---

# Track A — Visual foundation

## NUI-1 · Replace legacy shadows with `boxShadow`
**Priority:** P1 · **Effort:** S · **Independent**

**Problem:** 21 `shadowColor/shadowOpacity/shadowRadius` + 6 `elevation:` declarations, **0** `boxShadow`. Skill rule: *"Use CSS `boxShadow`. NEVER use legacy React Native shadow or elevation styles."*

**Files:** `lib/tokens.ts:108-134` (the `elevation` object — fixes most of the app) + any per-file stragglers (`grep -rn "shadowColor\|elevation:" app components`).

**Implementation** — rewrite the `elevation` tokens:
```ts
export const elevation = {
  flat: { borderColor: color.line, borderWidth: 1 },
  sheet: { borderColor: color.line, borderWidth: 1, boxShadow: "0 12px 24px rgba(15,20,25,0.08)" },
  primaryCTA: { boxShadow: "0 4px 12px rgba(15,20,25,0.10)" },
  accentGlow: { boxShadow: "0 0 16px rgba(94,140,122,0.18)" },
} as const;
```
Then grep for remaining inline `shadowColor`/`elevation:` in screens/components and convert each to a single `boxShadow` string.

**Acceptance:**
- `grep -rn "shadowColor\|shadowOpacity\|shadowRadius\|elevation:" app components lib` returns **0**.
- `bun run typecheck` passes; shadows still render on a build (visually unchanged or better).

---

## NUI-2 · Add `borderCurve: 'continuous'` to rounded corners
**Priority:** P1 · **Effort:** S–M · **Independent**

**Problem:** 179 `borderRadius` declarations, **0** `borderCurve: 'continuous'`. This is the biggest "looks slightly off on iOS" tell. Skill: *"Use `{ borderCurve: 'continuous' }` for rounded corners unless creating a capsule shape."* (No-op on Android, so safe.)

**Files:** all of `components/`, `app/`. Skip capsule shapes (`radius.pill` / `borderRadius: 9999`).

**Implementation:** add a helper to `lib/tokens.ts` and use it, or do a careful find-and-apply.
```ts
// lib/tokens.ts
export const rounded = (r: number) => ({ borderRadius: r, borderCurve: "continuous" as const });
```
Apply to cards, buttons, inputs, sheets, chips (everything except `radius.pill`). The token-derived styles (`radius.sm/md/lg/sheet`) are the high-traffic ones.

**Acceptance:**
- Every non-capsule `borderRadius` has a sibling `borderCurve: "continuous"` (or goes through `rounded()`).
- `bun run typecheck` passes.

---

# Track B — Navigation restructure (sequential)

## NUI-3 · Convert root `<Slot>` → `<Stack>` and present detail screens natively
**Priority:** P0 · **Effort:** M · **Independent (start of Track B)**

**Problem:** `app/_layout.tsx:127` renders `<Slot />`; there are **0** `<Stack>` navigators in the whole app. Detail/edit routes (`meal-edit/[id]`, `exercise-picker`, `workout-session/[id]`) are reached via `router.push` but get **no native push transition, no swipe-back, no header, no modal/sheet presentation**. This is the root cause of NUI-5 (hand-rolled headers).

**Files:** `app/_layout.tsx`. Routes affected: `app/meal-edit/[id].tsx`, `app/exercise-picker.tsx`, `app/workout-session/[id].tsx`, `app/sign-in.tsx`, `app/sign-up-email.tsx`, `app/oauth-native-callback.tsx`.

**Implementation:** replace `<Slot />` with a `<Stack>`. Keep `headerShown: false` globally for now (NUI-5 turns headers on per-screen) so this ticket is behavior-preserving except for gaining native transitions + swipe-back.
```tsx
// app/_layout.tsx — inside the providers, replace <Slot />
import { Stack } from "expo-router/stack";

<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen
    name="meal-edit/[id]"
    options={{ presentation: "formSheet", sheetGrabberVisible: true, sheetAllowedDetents: [0.7, 1] }}
  />
  <Stack.Screen name="exercise-picker" options={{ presentation: "modal" }} />
  <Stack.Screen name="workout-session/[id]" />
  <Stack.Screen name="sign-in" />
  <Stack.Screen name="sign-up-email" options={{ presentation: "modal" }} />
  <Stack.Screen name="oauth-native-callback" />
</Stack>
```

**Notes:**
- `<CommandCenterOverlay />` currently sits as a sibling of `<Slot/>`. Keep it as a sibling of `<Stack/>` (it's a global gorhom overlay) — verify it still renders above all routes.
- After this, `meal-edit` and `exercise-picker` open as a sheet/modal with swipe-down to dismiss. Their existing custom close buttons (`router.back()`) still work; NUI-5 removes them.

**Acceptance:**
- Pushing to a meal/workout detail shows a native transition + swipe-back.
- `meal-edit` presents as a form sheet, `exercise-picker` as a modal.
- Command center overlay still works from every screen. `bun run typecheck` passes.

---

## NUI-4 · Adopt `NativeTabs`; relocate hidden `href:null` routes; delete `FakeTabBar`
**Priority:** P0 · **Effort:** M–L · **Depends on:** NUI-3

**Problem:** `app/(tabs)/_layout.tsx` uses the JS `<Tabs>` with ~25 lines of manual `tabBarHeight`/`paddingBottom` math branched on `Platform.OS`, custom SVG tab icons, and **five hidden tabs** (`log`, `feed`, `coach`, `meals`, `trends` with `href: null`). There's also a duplicate `components/FakeTabBar.tsx`. Skill: *"Always prefer NativeTabs."*

**⚠️ The complication:** `NativeTabs` has no clean `href: null` equivalent. The 5 hidden routes shouldn't be tab siblings at all — they're secondary screens. **Relocate them before/while migrating:**
- Move `meals`, `trends`, `coach`, `feed`, `log` out of `(tabs)/` and register them as `<Stack.Screen>`s in the root stack (NUI-3), or nest a `<Stack>` inside the relevant tab group. (`meals`/`trends` are pushed from `dashboard`; `coach` from a button; check `router.push` call sites first: `grep -rn "router.push" app | grep -E "meals|trends|coach|feed|log"`.)
- Keep only the 3 real tabs (`dashboard`, `workouts`, `settings`) in `(tabs)/`.

**Implementation (after relocating):**
```tsx
// app/(tabs)/_layout.tsx
import { NativeTabs, Icon, Label, VectorIcon } from "expo-router/unstable-native-tabs";
// Android has no SF Symbols → provide a drawable or use VectorIcon. Simplest cross-platform path:
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

<NativeTabs>
  <NativeTabs.Trigger name="dashboard">
    <Icon sf="house.fill" drawable="ic_home" /><Label>Today</Label>
  </NativeTabs.Trigger>
  <NativeTabs.Trigger name="workouts">
    <Icon sf="figure.strengthtraining.traditional" drawable="ic_workout" /><Label>Train</Label>
  </NativeTabs.Trigger>
  <NativeTabs.Trigger name="settings">
    <Icon sf="person.fill" drawable="ic_person" /><Label>You</Label>
  </NativeTabs.Trigger>
</NativeTabs>
```
- Keep the auth gate (`useAuth` → `<Redirect href="/sign-in">`) — move it to a parent layout or an index guard, since NativeTabs children should be triggers only.
- **Android icons:** SF Symbols don't exist on Android. Either ship drawables (`drawable="..."`), use `<VectorIcon vector={MaterialIcons} name="home" />`, or `<Icon src={require(...)} />`. Test on an Android build.
- Delete `components/FakeTabBar.tsx` and its imports.
- Delete the manual `tabBarHeight`/`tabBarPaddingBottom` math.

**Acceptance:**
- Tab bar renders natively (liquid glass on iOS 26 / Material 3 on Android) with working, correct icons on **both** platforms — verify on an iOS build *and* an Android build.
- No more `href: null`; secondary screens reachable via the root stack.
- `FakeTabBar.tsx` deleted; no manual tab-height math remains. `bun run typecheck` passes.

---

## NUI-5 · Replace hand-rolled headers with native Stack titles + `contentInsetAdjustmentBehavior`
**Priority:** P1 · **Effort:** M · **Depends on:** NUI-3, NUI-4

**Problem:** Every screen hand-rolls a header — `<SafeAreaView edges={["top"]}>` + a custom title `<Text>` + a custom SVG back/close glyph wired to `router.back()` (e.g. `app/meal-edit/[id].tsx:475-489`, `app/(tabs)/dashboard.tsx:521`). 12 screens use `SafeAreaView edges={["top"]}` (top-only); only `coach-message-list.tsx` uses `contentInsetAdjustmentBehavior`. Skill: *"ALWAYS use a navigation stack title"* and *"Use `contentInsetAdjustmentBehavior="automatic"` instead of `<SafeAreaView>`."*

**Files:** `meal-edit/[id].tsx`, `exercise-picker.tsx`, `workout-session/[id].tsx`, `(tabs)/dashboard.tsx`, `workouts.tsx`, `settings.tsx`, `meals.tsx`, `trends.tsx`, `feed.tsx`, `coach.tsx`, `sign-in.tsx`, `sign-up-email.tsx`.

**Implementation (per screen):**
1. Turn on the native header for the screen and set the title:
   ```tsx
   <Stack.Screen options={{ headerShown: true, title: "Edit meal", headerLargeTitle: true }} />
   ```
   For sheet/modal screens, use a `headerRight` "Done" or rely on the grabber.
2. Delete the custom header row + SVG close/back glyph (the native header provides back/close).
3. Drop the `<SafeAreaView edges={["top"]}>` wrapper; make the screen root a `ScrollView`/`FlatList` with `contentInsetAdjustmentBehavior="automatic"` and move padding to `contentContainerStyle`.
4. Ensure **both** top and bottom insets are covered (native header handles top; `contentInsetAdjustmentBehavior` + tab bar handle bottom).

**Acceptance:**
- No screen renders a custom title `<Text>` as its header; titles come from `Stack.Screen options.title`.
- Custom back/close SVG glyphs removed where the native header replaces them.
- Root scrollables use `contentInsetAdjustmentBehavior="automatic"`; content isn't clipped under the notch/home indicator on a build. `bun run typecheck` passes.

---

# Track C — Motion & feel

## NUI-6 · Add haptics
**Priority:** P1 · **Effort:** S · **Independent**

**Problem:** **0** `expo-haptics` usage in a voice-first app. Skill: *"Use expo-haptics conditionally on iOS to make more delightful experiences."* (Works on Android too — gate on `process.env.EXPO_OS !== 'web'`.)

**Setup:** `bunx expo install expo-haptics`.

**High-value call sites:**
- Mic press — `components/FloatingCommandBar.tsx` (`micButton` onPress).
- Recording start/stop — `app/(tabs)/log.tsx`, `hooks/use-coach-voice-input.ts`, `components/command-center/CommandCenterProvider.tsx`.
- Meal/set save success, swipe-delete confirm — `meal-edit/[id].tsx`, `workouts.tsx`, `meals.tsx`.
- Set-complete checkmark — `app/workout-session/[id].tsx`.

**Implementation:**
```ts
import * as Haptics from "expo-haptics";
const haptic = {
  tap: () => process.env.EXPO_OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  press: () => process.env.EXPO_OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => process.env.EXPO_OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};
```
(Consider putting this helper in `lib/`.)

**Acceptance:** mic press, record start/stop, and save/delete fire haptics on a device. `bun run typecheck` passes.

---

## NUI-7 · Migrate animations to Reanimated v4 + add entering/exiting/layout
**Priority:** P1 · **Effort:** M · **Independent**

**Problem:** `react-native-reanimated@4.1.1` is installed (via gorhom) but **app code uses it nowhere** — all animation is the legacy RN `Animated` API (`lib/motion.ts`, `components/pulse/{VoiceRing,Waveform,LoadingSkeleton,UndoToast}.tsx`). No `entering`/`exiting`/`layout` animations on state changes. Skill: *"Use Reanimated v4. Avoid React Native's built-in Animated API"* + *"Add entering and exiting animations for state changes."*

**Files:** `components/pulse/VoiceRing.tsx`, `Waveform.tsx`, `LoadingSkeleton.tsx`, `UndoToast.tsx`, `lib/motion.ts`; plus state-change sites (offline banner, day picker, meal rows, badges).

**Implementation:**
- Rewrite the `pulse` animation primitives with `useSharedValue` + `withTiming`/`withRepeat`/`withSpring` + `useAnimatedStyle`.
- Wrap items that mount/unmount in `Animated.View entering={FadeInUp} exiting={FadeOut} layout={LinearTransition}` (lists, `OfflineBanner`, `UndoToast`).
- Keep animations <300ms; prefer transforms over layout props. **Don't pass `PlatformColor` to reanimated styles** — use static token colors.
- `lib/motion.ts` can be retired or re-pointed at Reanimated helpers once callers migrate.

**Acceptance:** `grep -rn 'from "react-native"' components lib | xargs grep -l "Animated"` returns nothing meaningful (no legacy `Animated` left in app code). Animations run on the UI thread (Reanimated). `bun run typecheck` passes.

---

# Track D — Library swaps

## NUI-8 · `expo-av` → `expo-audio`
**Priority:** P2 · **Effort:** M · **Independent** (requires a native rebuild)

**Problem:** `expo-av` (deprecated, removed in a future SDK) used for recording in `app/(tabs)/log.tsx` (`Audio.Recording`, `Audio.requestPermissionsAsync`, `Audio.setAudioModeAsync`, `RecordingOptionsPresets.HIGH_QUALITY`), `components/command-center/CommandCenterProvider.tsx`, and `hooks/use-coach-voice-input.ts`. Skill: *"`expo-audio` not `expo-av`."*

**Setup:** `bunx expo install expo-audio` then remove `expo-av` from `package.json`.

**Implementation (API differs — recorder is hook/object based):**
```ts
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
await AudioModule.requestRecordingPermissionsAsync();
await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
await recorder.prepareToRecordAsync();
recorder.record();
// stop:
await recorder.stop();
const uri = recorder.uri; // upload this
```
**Restructure note:** the old code uses imperative `new Audio.Recording()` inside async functions and inside `CommandCenterProvider` (not a plain component). `useAudioRecorder` is a hook — you may need to lift the recorder to component/provider top level and drive it via state, or use the non-hook recorder object. Plan this before editing.

**Acceptance:** recording → transcribe flow works on a device build for both the log screen and the command center. No `expo-av` import remains. `bun run typecheck` passes.

---

## NUI-9 · RN `Image` → `expo-image`
**Priority:** P2 · **Effort:** XS · **Independent**

**Problem:** `components/command-center/CommandCenterOverlay.tsx:491` renders the meal photo with React Native's `Image`. Skill: *"`expo-image` Image component."* (It's the only raster image in the app.)

**Setup:** `bunx expo install expo-image`.

**Implementation:**
```tsx
import { Image } from "expo-image";
<Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" transition={150} testID="cc-photo-preview" />
```
(`resizeMode="cover"` → `contentFit="cover"`.)

**Acceptance:** meal photo preview renders via `expo-image`; no RN `Image` import remains. `bun run typecheck` passes.

---

## NUI-10 · Consolidate keyboard handling on `react-native-keyboard-controller`
**Priority:** P2 · **Effort:** M · **Independent**

**Problem:** `react-native-keyboard-controller` is installed and `KeyboardProvider` wraps the app (`app/_layout.tsx:114`), yet **16** screens still use RN's `KeyboardAvoidingView` and only `workout-session` uses the keyboard-controller variant. Inconsistent + janky.

**Files:** every file with `KeyboardAvoidingView` (`grep -rn "KeyboardAvoidingView" app components`).

**Implementation:** replace RN `KeyboardAvoidingView`/`ScrollView`+keyboard logic with `KeyboardAwareScrollView` / `KeyboardAvoidingView` from `react-native-keyboard-controller`. Keep existing `keyboardDismissMode="on-drag"`.

**Acceptance:** all keyboard avoidance goes through `react-native-keyboard-controller`; inputs stay visible above the keyboard on a device. `bun run typecheck` passes.

---

## NUI-11 · One cross-platform `<Icon>`: SF Symbols on iOS, equivalent on Android
**Priority:** P2 · **Effort:** M · **Independent**

**Problem:** 19 files use `react-native-svg`. Two kinds of use:
- **Data viz** (`CalorieRing`, `WeightSparkline`, `VoiceRing`, `Waveform`, `Wordmark`) — **keep as SVG.** SF Symbols can't draw these, and SVG is already cross-platform.
- **Standard glyphs** — chevrons, plus, close, bell, calendar, clock, heart, person, mic (`settings.tsx:75-172` alone has 8), re-implemented inline per file.

Skill: *"Use SF Symbols for native feel."* SF Symbols are iOS-only, so the goal is **one `<Icon>` component that gives iOS its native symbols AND gives Android a first-class equivalent** — never a blank icon on Android. This also de-duplicates the inline glyphs.

**Implementation:** create `components/Icon.tsx` mapping a semantic name to an SF Symbol (iOS) and a matching Material/`@expo/vector-icons` glyph (Android). Both branches must render a real icon.
```tsx
import { SymbolView } from "expo-symbols";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// semantic name → per-platform glyph; add entries as you migrate
const MAP = {
  chevron:  { sf: "chevron.right",   md: "chevron-right" },
  close:    { sf: "xmark",           md: "close" },
  add:      { sf: "plus",            md: "add" },
  bell:     { sf: "bell",            md: "notifications-none" },
  calendar: { sf: "calendar",        md: "calendar-today" },
  person:   { sf: "person",          md: "person-outline" },
  // ...
} as const;

export function Icon({ name, size = 20, color }: { name: keyof typeof MAP; size?: number; color?: string }) {
  const g = MAP[name];
  if (process.env.EXPO_OS === "ios") return <SymbolView name={g.sf} size={size} tintColor={color} />;
  return <MaterialIcons name={g.md} size={size} color={color} />;
}
```
Install the Android dep if not present: `bunx expo install @expo/vector-icons`. Migrate the inline standard glyphs across `settings.tsx`, `meals.tsx`, `workouts.tsx`, `meal-edit`, `FloatingCommandBar`, etc. to `<Icon name=... />`. Leave charts/rings as SVG.

**Acceptance:** standard glyphs render correctly on **both** iOS (SF Symbols) and Android (Material) — confirm on builds for each. Inline duplicate glyph components removed. Charts/rings untouched. `bun run typecheck` passes.

---

# Track E — Hygiene & cleanup

## NUI-12 · Add tsconfig path aliases
**Priority:** P2 · **Effort:** S · **Independent**

**Problem:** `tsconfig.json` has no `paths`; **86** `../../` imports. Skill: *"Configure tsconfig.json with path aliases, and prefer aliases over relative imports."*

**Implementation:**
```jsonc
// tsconfig.json
"compilerOptions": {
  "strict": true,
  "types": ["expo-router/types"],
  "baseUrl": ".",
  "paths": { "@/*": ["./*"] }
}
```
Then codemod deep relative imports to `@/` (e.g. `../../lib/tokens` → `@/lib/tokens`). expo-router + Metro support this out of the box on SDK 54.

**Acceptance:** `@/` imports resolve; `bun run typecheck` passes; app boots on a build.

---

## NUI-13 · Add `+not-found.tsx`
**Priority:** P3 · **Effort:** XS · **Independent**

**Problem:** no `app/+not-found.tsx` — unmatched routes can blank out.

**Implementation:**
```tsx
// app/+not-found.tsx
import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";
import { color, type } from "@/lib/tokens"; // or relative if NUI-12 not done
export default function NotFound() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: color.bg }}>
      <Stack.Screen options={{ title: "Not found" }} />
      <Text style={type.titleS} selectable>This screen doesn't exist.</Text>
      <Link href="/"><Text style={{ color: color.accent }}>Go home</Text></Link>
    </View>
  );
}
```

**Acceptance:** navigating to a bad route shows this screen. `bun run typecheck` passes.

---

## NUI-14 · Add `selectable` to data & error text
**Priority:** P2 · **Effort:** S · **Independent**

**Problem:** **0** `selectable` props. Skill: *"Add the `selectable` prop to every `<Text/>` displaying important data or error messages."*

**Targets:** numerals/totals (calories, weight, steps), transcripts, coach messages, and **all** error strings — including the `ErrorBoundary` message (`app/_layout.tsx:70`) and `meal-edit` error body (`app/meal-edit/[id].tsx:500`).

**Note:** numeral *alignment* is already handled (numerals use Geist Mono, a monospaced font), so `tabular-nums` is not needed — this ticket is only about `selectable`.

**Acceptance:** key data + every error `<Text>` is `selectable`. `bun run typecheck` passes.

---

## NUI-15 · `Platform.OS` → `process.env.EXPO_OS`; `useContext` → `React.use`
**Priority:** P3 · **Effort:** XS · **Independent**

**Problem:** 8 `Platform.OS` across 6 files (skill: *"`process.env.EXPO_OS` not `Platform.OS`"* — statically replaced, tree-shakes per platform). `components/command-center/CommandCenterProvider.tsx:57,91` use `useContext` (skill: *"`React.use` not `React.useContext`"*).

**Implementation:** swap `Platform.OS === "ios"` → `process.env.EXPO_OS === "ios"` (remove now-unused `Platform` imports). Swap `useContext(Ctx)` → `use(Ctx)` (`import { use } from "react"`).

**Acceptance:** `grep -rn "Platform.OS" app components` → 0; no `useContext` in app code. `bun run typecheck` passes.

---

## NUI-16 · Break up god components
**Priority:** P2 · **Effort:** L · **Independent**

**Problem:** 4 files mix routing, data fetching, business logic, and many inline sub-components: `components/command-center/CommandCenterOverlay.tsx` (2315), `app/workout-session/[id].tsx` (1986), `app/(tabs)/dashboard.tsx` (1401), `app/meal-edit/[id].tsx` (1067). Skill: route files in `app/` should be thin; *"NEVER co-locate components/types/utilities in the app directory."*

**Implementation:**
- `dashboard.tsx`: extract `CalorieRing`, `MiniStepsRing`, `WeightSparkline`, `StepsTrendIcon`, `CoachBadge`, day-picker, and card bodies into `components/dashboard/`.
- `workout-session/[id].tsx`: extract the set-table row, header, and per-exercise card into `components/workout/`.
- `CommandCenterOverlay.tsx`: extract each per-state sheet body (`photo`, `review`, `clarify`, etc.) into `components/command-center/states/`.
- Keep route files focused on data + composition. Do this **incrementally**, typechecking between extractions.

**Acceptance:** each of the 4 route/overlay files is materially smaller; extracted UI lives under `components/`. `bun run typecheck` and `bun test` pass.

---

## NUI-17 · *(Optional polish)* Link previews/context menus + large-number formatting
**Priority:** P3 · **Effort:** M · **Independent**

**Problem:** app navigates entirely via `router.push` (0 `<Link>`), so no iOS long-press previews/menus. Skill: *"Add context menus and previews frequently."* Also steps/weekly-volume render raw via `toLocaleString()` (`dashboard.tsx:647`, `workouts.tsx:348`) — skill: *"format large numbers like 1.4M or 38k."*

**Implementation:**
- Wrap meal/workout cards in `<Link href=... asChild>` with `<Link.Preview />` + `<Link.Menu>` (Edit / Duplicate / Delete). iOS-only affordance; degrades to a normal tap on Android.
- Add a `formatCompact(n)` helper (`1400 → "1.4k"`) in `lib/` for large counters.

**Acceptance:** cards offer long-press preview/menu on iOS; large counters are abbreviated. `bun run typecheck` passes.

---

## Definition of done (every ticket)
1. `bun run typecheck` passes.
2. `bun test` passes (if the ticket touches command-center).
3. Verified on a **dev/preview build** (not Expo Go) on **both iOS and Android** — both platforms are first-class. (NUI-0 sets up the iOS build so this is possible.)
4. No new legacy-API usage introduced (no RN `Animated`, RN `SafeAreaView`, legacy shadows, `expo-av`).
5. No iOS-only API left an Android surface blank or broken (and vice-versa) — every platform-specific path has an equivalent on the other.
