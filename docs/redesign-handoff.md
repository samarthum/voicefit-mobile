# VoiceFit Mobile — Pulse Redesign Handoff

Status as of **2026-04-25**. Treat this doc as the single point of truth for picking up the redesign work in a fresh session. The previous session's context is gone — read this end to end before editing.

## What this is

The mobile app is mid-migration from a **light Cal-AI-inspired theme** to **"Pulse"** — a dark-first design with electric lime (#C7FB41) accent, Inter Tight + Geist Mono typography, and an instrument-like visual language. The design source is a bundle of HTML/JSX prototypes shipped through Claude Design.

The redesign is **mostly done.** Foundation, primitives, and most screens are at parity. A few gaps remain — see [§ Open gaps](#open-gaps).

## Where the design source lives

The design handoff bundle was downloaded from `~/Downloads/Voicefit Mobile-handoff.zip` and extracted to:

```
/tmp/voicefit-handoff/voicefit-mobile/project/
```

Important files inside that folder:

| File | What it specs |
|---|---|
| `Tokens.html` | Color, type, spacing, radius, motion tokens |
| `Motion Spec.html` | Easings, durations, voice-flow choreography |
| `Edge States.html` | 8 non-happy-path screens |
| `User Flows.html` | 6 end-to-end journeys |
| `lib/screens-c.jsx` | **Pulse direction screens — the canonical source** (Home, Voice command states, Workout, Exercise picker, Sign-in, Light variant) |
| `lib/screens-c-extra.jsx` | Pulse extras — Workouts list, Settings, Trends, Coach chat, Weight detail, Voice error, Workout empty, Onboarding |
| `lib/edge-states.jsx` | Edge state designs (LoadingSkeleton, OfflineHome, MicDenied, EmptyHistory, FirstSession, LongMealName, LowConfidence, ServerError) |
| `lib/screens-d.jsx` | Direction D ("Ember") — **retired, do not use** |

The bundle has a top-level `README.md` with overall instructions and a `Handoff.html` index page.

## Tech stack

- Expo 54.0.33, React Native 0.81.5, TypeScript 5.9
- `react-native-svg` 15.12 — used heavily for icons, rings, charts
- `expo-font` + `@expo-google-fonts/inter-tight` + `@expo-google-fonts/geist-mono` — fonts loaded at root
- `@react-native-community/netinfo` 11.4.1 — for OfflineBanner network detection
- TanStack React Query 5 — data fetching
- Clerk Expo 2 — auth (Bearer tokens to Next.js backend)
- **No Reanimated** — we use the built-in `Animated` API. Voice ring + waveform + skeleton shimmer + undo toast all run on it. Adding Reanimated is a Phase-6 nice-to-have, not required.

## Foundation: tokens + primitives

Single source of truth: **[`lib/tokens.ts`](../lib/tokens.ts)**. Imports:

```ts
import { color, font, radius, space, motion, type, elevation } from "../../lib/tokens";
```

- `color.bg / surface / surface2 / line / line2` — surfaces and dividers
- `color.text / textSoft / textMute` — three off-white tiers
- `color.accent / accentDim / accentInk / accentTintBg / accentTintBorder / accentRingTrack` — lime family
- `color.positive / warn / negative` — signal palette
- `font.sans[300..800]` and `font.mono[400..600]` — exact loaded family names
- `radius.xs / sm / md / lg / sheet / pill` (10/14/18/22/28/9999)
- `space` (xs..xl4 = 4..56)
- `motion.ease.{std, snap, emph, exit}` (bezier coords) and `motion.dur.{quick, base, expr}` (120/260/420ms)
- `type.*` — pre-baked text styles (display, titleL/M/S, body, label, numXL..numXS) with computed letter-spacing for RN

Motion helpers in **[`lib/motion.ts`](../lib/motion.ts)** wrap the bezier coords into `Easing.bezier()` and expose `timing()` / `reducedTiming()` helpers.

Trend chart helpers in **[`lib/trends.ts`](../lib/trends.ts)** — `buildLinePaths`, `metricValueFromPoint`, `metricColor`, `getISOWeek`. Shared between dashboard and trends screen.

### Pulse primitives (`components/pulse/`)

Reusable RN components — all import from `lib/tokens.ts`, none hardcode hex.

| Component | Purpose |
|---|---|
| `Card` | Surface card with hairline border |
| `Chip` | Pill with active/inactive state |
| `Button` | Primary (lime) / secondary (border) / ghost variants |
| `Label` | Uppercase letter-spaced eyebrow text |
| `Numeral` | Geist Mono numeral with size + tone variants |
| `Wordmark` | "voicefit" text + lime checkmark circle |
| `VoiceRing` | 5-state animated ring (idle/listening/interpreting/saved/error) |
| `Waveform` | 6-bar audio waveform with native-driver scaleY |
| `LoadingBlock` | Shimmer skeleton with breathing opacity |
| `OfflineBanner` | Warn-amber banner with queue indicator |
| `UndoToast` | 6-second undo toast with mutually exclusive `onUndo` / `onDismiss` |
| `EmptyState` | Dashed-bordered empty card with icon + CTA |
| `ErrorScreen` | Full-screen error pattern (negative or warn tone) |
| `ClarifyOptions` | Radio-row picker for low-confidence portion sizes |

Re-exports via `components/pulse/index.ts` barrel.

### Legacy COLORS bridge

A legacy `COLORS` constant lives in **[`components/command-center/helpers.ts`](../components/command-center/helpers.ts)**. It maps old key names (`bg`, `surface`, `textPrimary`, `calories`, etc.) onto the new Pulse tokens so existing screens cascade automatically. **Prefer importing from `lib/tokens.ts` directly in new code.**

## Screen-by-screen status

### ✅ At parity (matches design)

| Screen | File | Notes |
|---|---|---|
| Sign-in | `app/sign-in.tsx` | Lime orb + glow, "Your body. In a sentence." display title, lime Apple CTA, Google CTA, email link |
| Sign-up email | `app/sign-up-email.tsx` | Dark form with lime accent submit, tab switcher |
| OAuth callback | `app/oauth-native-callback.tsx` | Dark loading screen with lime spinner |
| Index | `app/index.tsx` | Auth redirect, dark loader |
| **Dashboard / Home** | `app/(tabs)/dashboard.tsx` | Hero card with ring + macros side-by-side, day picker, stat cards, coach card, today's log. Tappable hero card navigates to Trends. |
| **Workouts list** | `app/(tabs)/workouts.tsx` | "SESSIONS" eyebrow + "Train" title, 3-stat row, session cards with exercise rows |
| **Workout session detail** | `app/workout-session/[id].tsx` | "LIVE · SESSION" header, stats strip, exercise cards with set rows + lime checkmark, UndoToast on set delete |
| Exercise picker | `app/exercise-picker.tsx` | X-close, search, filter chips, exercise rows with metadata |
| Settings | `app/(tabs)/settings.tsx` | "PROFILE" eyebrow + "You" title, lime SA avatar, goals card, COACH/GENERAL groups, Coach Profile lime sparkle |
| Coach | `app/(tabs)/coach.tsx` | Lime sparkle + Coach header, message bubbles (lime user bubble), composer, dropdown menu |
| **Trends** | `app/(tabs)/trends.tsx` | Wordmark + WEEK NN, 3 metric tabs, 7-day average card with chart, top meals breakdown |
| Tab bar | `app/(tabs)/_layout.tsx` | Custom line-art icons (house/bars/person), lime active tint |
| FakeTabBar | `components/FakeTabBar.tsx` | Same icons used on workout-session detail |
| FloatingCommandBar | `components/FloatingCommandBar.tsx` | Surface pill with lime mic on the right |

### ✅ Restyled but partially used

| Screen | File | Notes |
|---|---|---|
| Hidden routes (log, feed, meals) | `app/(tabs)/{log,feed,meals}.tsx` | Bulk hex remap to dark tokens. **Not in the new IA's 3-tab nav** — reachable only via direct navigation. Decide whether to delete or formalize. |
| Coach profile form | `components/CoachProfileForm.tsx` | Dark theme, lime selected chips, accent CTA |
| Command Center overlay | `components/command-center/CommandCenterOverlay.tsx` | VoiceRing + Waveform wired into recording/transcribing/interpreting/saving states. cc_saved 600ms dwell shows the saved ring before close. |

## Open gaps

These are the known things still to do, ordered by impact.

### High-value follow-ups

1. **Macro aggregation on `/api/dashboard`.** The dashboard's hero card has 3 macro bars (Protein/Carbs/Fat). They currently render `—/140g` placeholders because `DashboardData.recentMeals` doesn't carry today's totals. Two-step fix:
   - Backend: add `today.macros: { protein, carbs, fat }` to the dashboard response (sum from `MealLog` rows for the date).
   - Mobile: replace the `null` constants in `app/(tabs)/dashboard.tsx` (~lines 496-501) with `dashboard?.today.macros?.*`.
   - Add the same fields to `voicefit-contracts/src/types.ts` (`DashboardData.today`).
2. **`Today's log` empty state visibility.** With no meals logged, the section header shows but the empty state text isn't visually rendering. Could be a render-condition bug or data-loading edge case. Check `recentMeals` flow in dashboard.tsx — the `recentMeals.length === 0` branch should show "No meals logged yet." but verify on sim.
3. **Iconography on the home cards.** The design's stat cards have specific icons (steps up-arrow, weight sparkline, coach sparkle) — all wired. The Coach card SUB-text is currently a calorie-aware computed string rather than a real coach insight pulled from the backend. When Coach v2's daily insight endpoint is ready, swap `coachSummary` (memoized in dashboard.tsx) to read from it.
4. **First-session welcome banner on workout-session/[id].** The design (`FirstSession` in `edge-states.jsx`) has an accent-tinted welcome banner when sets count is 0. Not yet implemented (~30 lines of JSX + a state check).
5. **OfflineBanner only on dashboard.** Should also appear on workouts/settings/coach for consistency. Wrap the same `<OfflineBanner />` + NetInfo subscription pattern there. Or better: hoist the network state into a single hook (`useOfflineState`) and render the banner from `_layout.tsx` so all tabs get it for free.

### Voice flow gaps

6. **VoiceRing animations on real device.** Wired but never visually verified end-to-end with real audio. Easings + durations come from `lib/motion.ts` and are easy to tune. Watch for:
   - Listening pulse feels right (1400ms loop, scale 1→1.18, opacity 0.5→0)
   - Interpreting spinning arc (900ms linear)
   - Saved emph-easing scale-in (420ms with 1.56 overshoot)
7. **Low-confidence clarify flow.** `ClarifyOptions` primitive exists. Needs:
   - Backend: `/api/interpret/meal` returns `confidence: number` already; threshold logic on the route (e.g. <0.7 → return a `clarification` payload with portion options).
   - Provider: add `cc_clarify_meal` state + payload to `CommandCenterProvider` and route low-confidence interpretations there before review.
   - Overlay: render the ClarifyOptions screen for that state, on submit multiply estimated calories and route to review.
8. **First-time mic permission flow.** When the user denies mic in iOS, we route to the existing `cc_error` branch with a VoiceRing in error state. This is fine. Could be polished using the new `ErrorScreen` primitive with tone="negative" and an "Open Settings" CTA that uses Linking.openSettings(). Currently the inline error JSX handles this acceptably.

### Trends screen follow-ups

9. **Top meals aggregation is client-side from `recentMeals`.** The API doesn't aggregate by description over a date window. For accurate top-N over the actual week, add `/api/dashboard` extension or a new `/api/meals/top?days=7` endpoint, then have trends.tsx read from that.
10. **Trends "vs last 7" delta** correctly shows "—" when there's no prior window data. Verify the math once enough days exist.

### Polish

11. **Calorie ring progress arc.** With `consumed=0` you only see the track + a tiny `strokeLinecap` dot at the top — that's the expected RN SVG behavior. Verify the gradient renders correctly once a real meal is logged today.
12. **Hidden routes (`log`, `feed`, `meals`).** Either delete or formalize as deep-link-only. They're not in the new 3-tab IA but exist as routes. Memory says `log` and `feed` are likely deprecated; `meals` might still be used by `home-recent-meals-see-all` testID.
13. **Reanimated v3 migration.** Built-in `Animated` works fine for everything we do. If perf needs improving on low-end Android devices, swap to Reanimated.
14. **Light mode variant.** Design has a `HomeLightC` (white bg + lime-dim accent). We shipped dark-only; light mode is a future toggle if needed.
15. **Trends "All meals" link** on the top meals section is a static text — wire to navigate to the meals screen.
16. **Tappable stat cards on home.** Steps/Weight cards could navigate to dedicated detail screens (e.g. `WeightDetailC` exists in `screens-c-extra.jsx` lines 456+ but hasn't been built).

## Quick-start: bringing up the dev environment

```bash
# 1. From the mobile package
cd /Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile

# 2. Type check
bunx tsc --noEmit

# 3. Boot a simulator (if one isn't already)
xcrun simctl list devices available | grep -E "iPhone (15|16|17) "
xcrun simctl boot <UDID>      # e.g. iPhone 17
open -a Simulator

# 4. Start Metro
bun start

# 5. Open the dev URL on the booted sim
xcrun simctl openurl booted "exp://127.0.0.1:8081"

# 6. (Optional) Web preview — bypasses auth, faster iteration
bun web                                              # runs on :8081
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --window-size=390,844 \
  --screenshot=/tmp/screen.png \
  http://localhost:8081/
```

### Common pitfalls

- **Metro stale bundle.** If the simulator shows errors referencing code that no longer exists, kill Metro (`lsof -ti:8081 | xargs kill -9`) and restart with `bun start --clear`. Then `xcrun simctl terminate booted host.exp.Exponent` and re-`openurl` to force Expo Go to re-download the bundle.
- **Apple Events flakiness.** `osascript` to drive Simulator and `mcp__computer-use__*` tools occasionally hang with `-1712` timeout. Workaround: use `xcrun simctl io booted screenshot` for captures and `xcrun simctl openurl booted "exp://..."` for navigation. Direct deep-links work better than tapping.
- **First-run welcome modal in Expo Go.** Shown once per fresh install. Tap **Continue** in the simulator manually to dismiss. After that it stays dismissed.
- **Web target has the dev auth bypass** (`bypassAuthForWebPreview = __DEV__ && Platform.OS === "web"` in `(tabs)/_layout.tsx`). iOS does not. To verify a feature without signing in every time, hit web first.

## Memory & conventions

- `CLAUDE.md` at the monorepo root has the canonical project structure, API endpoints, and patterns. Read it.
- `~/.claude/projects/-Users-samarth-Desktop-Work-voicefit-all/memory/` has user/feedback/project memories — relevant ones for this work:
  - Mobile UX patterns (auto-dismiss success, keyboardDismissMode, etc.)
  - Mobile redesign Feb 2026 (3-tab layout decision)
  - Command Center architecture (Mar 2026)
  - Coach v2 (Apr 2026) — backend M1 done, mobile M2 was pending; this redesign delivers most of M2's surface
- New code should import design values from `lib/tokens.ts`, not copy hex values.
- Don't write narrating comments. Reserve `// because X` for non-obvious choices.
- Keep `Animated` use confined to UI animations; data flow goes through TanStack React Query as established.

## Verification checklist before shipping

- [ ] `bunx tsc --noEmit` clean
- [ ] Visual walk-through on iOS sim signed in with real user
- [ ] Voice command center: tap mic → recording → transcribing → review → save → see lime "Saved" ring before close
- [ ] Toggle airplane mode → verify OfflineBanner shows on dashboard
- [ ] Delete a workout set → undo before 6s → set restores. Delete + wait → set is permanently gone.
- [ ] Tap home hero card → trends screen opens. Switch metric tabs.
- [ ] Cut a `preview` EAS build (`npx eas build --platform ios --profile preview`) for a real-device feel-check.
- [ ] Run mobile regression matrix: `voicefit/qa/mobile-regression-matrix.md`.

## Files most likely to need edits next

- `voicefit/app/api/dashboard/route.ts` (backend) — add macro aggregation
- `voicefit-contracts/src/types.ts` — add macro fields to DashboardData
- `voicefit-mobile/app/(tabs)/dashboard.tsx` — wire macros, fix today's log empty state
- `voicefit-mobile/components/command-center/CommandCenterProvider.tsx` — add `cc_clarify_meal` state when low-confidence path lands

## What's been deleted / moved

- The old "Weekly Trends" section on home was removed — that data lives on the Trends screen now (`app/(tabs)/trends.tsx`)
- `screens-d.jsx` (Ember direction) is being retired — only Pulse direction is implemented

## Last verified

2026-04-25, iPhone 17 simulator, iOS 26.2, Expo Go.

Sign-in / Dashboard / Workouts / Settings / Coach / Sign-up-email / Workout session / Exercise picker / Trends — all rendering correctly with Pulse design.
