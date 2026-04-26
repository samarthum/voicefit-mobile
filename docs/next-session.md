# VoiceFit Mobile — Next Session Handoff

Status as of **2026-04-26**, end of the design-parity & Command Center redesign session.

## Read first

- `CLAUDE.md` at the monorepo root — project structure, API endpoints, DB schema, patterns.
- This file — current state and next actions.

## What this session set out to do

Bring the mobile app to parity with the Pulse design prototypes (canonical source: `/tmp/voicefit-handoff/voicefit-mobile/project/lib/screens-c.jsx` + `screens-c-extra.jsx`). The Pulse foundation (tokens, primitives, most screens) was in place at session start; the Command Center overlay had not been redesigned at all, and several other screens had remaining gaps.

## What was done

Pushed to `origin/main`. Nine commits ahead of session start. Latest: `aba07dd`.

1. **Per-screen Pulse parity audit** across Home, Workouts, Settings, Coach, Trends, Sign-in, Exercise picker, Workout session, Meals.

2. **Settings polish** — added Voice feedback / Weekly summary / Notifications rows under Coach + General groups.

3. **Workouts list** — replaced "SESSIONS" eyebrow with `Week NN · MMM` (ISO week + month), swapped stats to Sessions / Volume / PRs (PRs accent lime), added Week-at-a-glance bar chart, switched session cards from the Strong/Hevy expanded layout to the prototype's compact stat-summary cards with LIVE / Done badges.

4. **Trends** — `All meals` text was static; wired to `router.push("/meals")`.

5. **Coach** — redesigned header to match prototype: back button (left), centered lime sparkle orb + "Coach" title + "● Online" status, overflow menu (right).

6. **Dashboard fixes**
   - `Today's log` was leaking past-day meals into today's view; added a `selectedDate` filter.
   - `Steps` and `Weight` cards now navigate to `/trends?metric=steps|weight` with the right tab pre-selected. The hero calorie card already navigated to `/trends`.

7. **Meals screen** — full Pulse rewrite. Replaced raw `YYYY-MM-DD` text input + Apply/Clear with a 7-day pill row. Default day = today if today has meals, else most recent day with meals in the 7-day window. Stats compute on the visible-day subset.

8. **Removed god-awful meal glyphs** — the three colored SVGs (salad / oats / salmon) used in the Command Center quick-add and dead copies in `dashboard.tsx`. Deleted `components/MealGlyph.tsx` and `getMealVisualKind` helper.

9. **Command Center — full Pulse redesign across all states** (largest single piece, ~1700 lines):
   - **Bottom-sheet shell** with grab handle, faded peek of home behind, optional title row + close circle (replaces full-screen modal).
   - **Idle** — "Log anything" title, suggestion-card text input, three-button row (keyboard / 84px lime mic with halo glow / sparkle send), "Hold to speak · or type" caption, FREQUENT list.
   - **Listening** — lime dot + timer / centered "Listening" / × close, big sentence transcript with blinking lime cursor, 20-bar static waveform with lime/textSoft split + glow + opacity fade, lime stop button 76×76 with triple halo.
   - **Interpreting** (typed + voice transcribing + voice interpreting unified) — YOU SAID + EDIT, transcript hero, status pill with cycling lime dots + elapsed time, skeleton card, Retry / Edit text / Discard buttons.
   - **Review meal** — compact YOU SAID + EDIT, soft transcript, big lime card with mealtype·time eyebrow, name + kcal hero, INGREDIENTS + ADD link, ingredient rows, 4-segment confidence bar + "high confidence" + assumption, DISCARD + Save meal lime button.
   - **Review workout** — same Pulse pattern as meal review with a SETS table (SET / KG / REPS / NOTES) instead of ingredients.
   - **Saved toast** — separate Modal (not Sheet) — small toast near bottom with lime check + LOGGED eyebrow + "{meal} — {kcal} kcal added to {mealType}" + ENTRY SAVED + Undo link.
   - **Error** — tinted-tone icon tile (warn for `mic_permission_denied`, negative for the rest) + heading + body + tinted detail + stacked Retry / Edit / Discard buttons.
   - Mic glyph fixed to slim pill capsule per prototype (was rendering as a wide rectangle).

10. **Workout session detail** — first letter of exercise titles ("Bench Press", "Romanian Deadlift") was being clipped by an unintended `borderRadius` + `overflow:hidden` on a transparent card. Fixed. Header title was also offset left because the right slot was 72px (Finish button) and left was 32px (back button); wrapped the back button in a 72px-wide left slot.

11. **Build pipeline** — APK preview EAS build pipeline working; build #5 with all of the above shipped to https://expo.dev/accounts/samarthmamadapur/projects/voicefit-mobile/builds/a1505b18-d430-4470-bfd8-d0de48cc8d92. Removed unused `zeego` transitive dep that was causing Android Gradle build failure (`@react-native-menu/menu` referencing a removed RN API).

## What's left

Grouped by what kind of change is needed.

### Frontend-only Pulse parity polish

Visual gaps identified in the audit that were not fixed this session. All small, all Pulse JSX:

- **Saved toast auto-dismiss is 600ms** — see [`CommandCenterProvider.tsx:204`](../components/command-center/CommandCenterProvider.tsx#L204). Prototype implies ~2200ms. One-line change. Currently feels too fast to read.
- **Voice error state missing the REC strip** — prototype `CommandErrorC` has a small "REC ▮▮▮▮ 0.3s" card under the body for voice-too-short failures. Only relevant for voice errors. ~30 lines of JSX.
- **Error action buttons missing inline icons** — prototype has a refresh icon next to "Retry voice" and an edit icon next to "Type it instead". Currently text-only. SVG paths are at `screens-c-extra.jsx` lines 619 + 627. ~20 lines.
- **Saved toast dim backdrop is subtle** — the dim `View` renders at `rgba(0,0,0,0.5)` but reads as light on web preview. Verify on device; bump to 0.6 if needed.

### Backend / LLM integration (the big bucket)

Several visual gaps are blocked on backend changes.

#### Dashboard

- **Macro aggregation on `/api/dashboard`** — add `today.macros: { protein, carbs, fat }` to the response, computed from today's `MealLog` rows. Then update home macro bars (currently `—/140g` placeholders at [`dashboard.tsx:447-449`](../app/(tabs)/dashboard.tsx#L447)) to read from `dashboard.today.macros`. Also add the same fields to `voicefit-contracts/src/types.ts` (`DashboardData.today`). The macros columns already exist on `MealLog` (added by Coach v2); just needs aggregation in the dashboard route.

- **Coach v2 daily insight** — Home `Ask coach` card sub-text is currently a memoized client-side string ("X kcal left — plenty of room for dinner"). Coach v2's M1 backend is shipped (`/api/coach/...`); a daily-insight endpoint would let us surface a real insight here. See `voicefit/spec-coach-v2.md`.

#### Saved toast

- **`lastSavedSummary` / `kcalLeftToday`** — currently the toast footer says "ENTRY SAVED" because the provider has no notion of remaining kcal. Add to `CommandCenterProvider`: when `finishWithSaved` fires, compute `kcalLeftToday` from the dashboard query cache (`dashboard.today.calories.{goal-consumed}` minus the just-saved meal's kcal). Then update `SavedToast` to render `${kcalLeft} kcal left today` in the footer.

#### Meal review macros

- **Macros in `/api/interpret/meal` response** — the meal review screen has a 3-cell macros grid that's gated behind `SHOW_ESTIMATED_REVIEW_MACROS = false` (in `helpers.ts`). When the LLM starts returning estimated macros (protein/carbs/fat g) for each interpreted meal, flip the flag to true. Code is already wired to render `cc.reviewDraft.macros.{protein,carbs,fat}`.

#### Workouts list

- **Volume stat** — currently shows `—`. The list query returns `setCount` per session but not the summed volume (weight × reps). Add `volume` to `WorkoutSessionListItem` in `voicefit-contracts` and the `/api/workout-sessions` route.
- **PRs stat** — currently `0`. Not tracked at all. Whole feature: per-exercise weight ceiling tracked at set-creation time, surfaced to the API.
- **Top meals on Trends** — client-side aggregation from `dashboard.recentMeals` (last ~7 entries). Not accurate over a real week. Add `/api/meals/top?days=7` (or extend dashboard) for true server-side aggregation.

#### Settings

- **Protein goal + Weight goal in Daily Goals** — only Calories + Steps are wired. Adding the other two needs:
  - Prisma migration on `AppUser` to add columns
  - Update `/api/user/settings` GET/PUT
  - Update `voicefit-contracts/src/types.ts` for `UserSettings`
  - Update the form in `app/(tabs)/settings.tsx`
- **Voice feedback / Weekly summary / Notifications** rows are currently rendered with prototype copy as placeholders. The features themselves don't exist. Each is a separate feature when/if we want them real.

#### Profile card

- **Pro badge** — implies a subscription tier. We don't have one. Product decision; currently omitted.
- **14-day streak** — backend doesn't compute streaks. Could be derived from `MealLog`/`WorkoutSession` activity. Currently omitted.

### Voice flow polish (still open from original handoff)

- VoiceRing animations not visually verified end-to-end on a real device with real audio — only verified in the web preview state via mock recording.
- Low-confidence clarify flow — `ClarifyOptions` primitive exists in `components/pulse/`. Backend `/api/interpret/meal` returns `confidence`; threshold logic + provider state + overlay render needed (see original handoff `gap #7`).
- Mic-permission-denied first-time flow — currently routes to `cc_error` with the negative-tone error tile. Could polish with an "Open Settings" CTA that calls `Linking.openSettings()`.

### Hidden routes

`app/(tabs)/log.tsx` and `app/(tabs)/feed.tsx` are remnants of the pre-redesign 7-tab IA. They were bulk hex-remapped to dark tokens but otherwise not redesigned. They're not in the current 3-tab nav (Today / Train / You). Decide whether to delete or formalize as deep-link-only.

## Quick start (dev environment)

```bash
# Type check
cd /Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile
bunx tsc --noEmit

# iOS sim
bun start
xcrun simctl openurl booted "exp://127.0.0.1:8081"

# Web preview (faster, bypasses auth via __DEV__ + Platform.OS === "web")
bun web              # serves on :8081

# EAS preview build (Android APK)
npx eas build --platform android --profile preview --non-interactive
```

### Web preview tricks

- The provider has a localStorage flag bag at key `__vf_home_preview_flags`. Useful values:
  - `hold_typed_submit` — pauses the typed interpret call so you can screenshot the Interpreting state.
  - `hold_transcribing` / `hold_interpreting` — same for voice paths.
  - `typed_fail` / `voice_fail` — force interpret errors.
  - `save_fail` / `quick_add_fail` — force save errors.
  - `mic_denied` — simulate denied mic permission.
  - Comma-separate values: `localStorage.setItem('__vf_home_preview_flags', 'typed_fail,hold_typed_submit')`.
- Web auth bypass is in `app/(tabs)/_layout.tsx` (`bypassAuthForWebPreview = __DEV__ && Platform.OS === "web"`).

### Reach each Command Center state from Home

1. **Idle** — tap the floating bar's left text.
2. **Listening** — tap the floating bar's mic icon.
3. **Interpreting** — type + Send (with `hold_typed_submit` flag to keep it on screen).
4. **Review meal** — type a meal phrase + Send (e.g. "had a chicken caesar for lunch").
5. **Review workout** — type a workout phrase + Send (e.g. "3 sets of squat 80kg, 10 reps"). Note: from Home this triggers auto-save not review; open from a workout-session screen for the review state.
6. **Saved toast** — Save from review (use the 600ms-pause hack below to actually see it).
7. **Error** — set `typed_fail` or `voice_fail` flag, then submit.

## Key file pointers

- **CC overlay** — [`components/command-center/CommandCenterOverlay.tsx`](../components/command-center/CommandCenterOverlay.tsx) (~1700 lines, all states + `Sheet` shell + `BlinkingCursor` + `InterpretingScreen` + `SavedToast`).
- **CC provider** — [`components/command-center/CommandCenterProvider.tsx`](../components/command-center/CommandCenterProvider.tsx) (state machine, web-preview mocks).
- **CC helpers** — [`components/command-center/helpers.ts`](../components/command-center/helpers.ts) (`hasWebPreviewFlag`, `confidenceLabel`, `formatRecordingDuration`, etc.).
- **Pulse tokens** — [`lib/tokens.ts`](../lib/tokens.ts). Use `color.*`, `font.*`, `radius.*`, `space.*`. Never hardcode hex.
- **Pulse primitives** — [`components/pulse/`](../components/pulse/) (Wordmark, VoiceRing, Waveform, LoadingBlock, OfflineBanner, UndoToast, EmptyState, ErrorScreen, ClarifyOptions, etc.).
- **Trend helpers** — [`lib/trends.ts`](../lib/trends.ts) (chart math, `getISOWeek`, `metricValueFromPoint`).
- **Tabs (3 visible: Today / Train / You)** — [`app/(tabs)/_layout.tsx`](../app/(tabs)/_layout.tsx).
- **Coach** — [`app/(tabs)/coach.tsx`](../app/(tabs)/coach.tsx) (uses Vercel AI SDK + Claude Sonnet 4.6 via AI Gateway).
- **Backend** — `voicefit/app/api/`. Web app at `voicefit-zeta.vercel.app`.
- **Prototypes (Pulse, canonical)** — `/tmp/voicefit-handoff/voicefit-mobile/project/lib/screens-c.jsx` + `screens-c-extra.jsx`. **Note**: `refs/*.png` images in that bundle are from a *retired* light-theme direction, not Pulse — don't trust them, read the JSX.

## Known gotchas

- **Apple Events accessibility** — `osascript`-based clicks on Simulator hang on this machine. Web preview is the recommended verification path. To verify iOS-specific quirks, install the EAS APK on an Android device (or set up an iOS device with TestFlight).
- **EAS build queue** is on the free tier — first-time queue can be 5+ minutes.
- **`zeego` removed** — if you re-add a third-party menu lib, watch for transitive `@react-native-menu/menu` re-pull (Android Kotlin compile fails on `setHitSlopRect`).
- **600ms saved-toast dismiss** — the toast auto-closes too fast to debug. To pause it, in the web preview console:
  ```js
  window.__origSetTimeout = window.setTimeout;
  window.setTimeout = (fn, ms, ...a) => ms === 600 ? null : window.__origSetTimeout(fn, ms, ...a);
  ```
- **Web preview cwd hiccup** — when starting `bun web` via Claude Preview MCP you may see `getcwd: cannot access parent directories` warnings — harmless; the server still binds to :8081.
- **Latest known APK build** — https://expo.dev/accounts/samarthmamadapur/projects/voicefit-mobile/builds/a1505b18-d430-4470-bfd8-d0de48cc8d92.

## Recommended order to attack next

1. **Macro aggregation on `/api/dashboard`** — unblocks the home macro bars *and* the meal review macro grid in one shot. Highest-impact single change.
2. **`lastSavedSummary` + bump saved toast to ~2200ms** — small, but every save the user makes flashes through this.
3. **Settings: Protein + Weight goal** — needs DB migration; blocks "complete profile" flows.
4. **Workout volume stat on `/api/workout-sessions` list** — fills in the workouts list.
5. **Voice error REC strip + button icons** — final Pulse polish for error state.
6. PRs feature, top-meals server aggregation, Coach v2 daily insight — bigger features, likely separate sessions.

---

End of handoff. A fresh session should be able to read `CLAUDE.md` + this file and start work immediately.
