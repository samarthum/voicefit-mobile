# VoiceFit Mobile UI Source of Truth

- Last updated: 2026-03-10
- Owner: Product + Design + Eng handoff doc for all agents
- Rule: This document is the canonical UI index. Every locked screen must link prototype, design decisions, assets, and interaction spec here.

## Canonical links
- Design decisions log: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md`
- Prototype folder: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes`
- Asset inventories root: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets`
- Implementation checklists root: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/implementation-checklists`
- Handoff notes root: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/handoffs`
- Home handoff snapshot (2026-02-14): `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/handoffs/home-handoff-2026-02-14.md`
- Home implementation checklist: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/implementation-checklists/home-screen-implementation-checklist.md`
- Home asset inventory (doc): `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/asset-inventory.md`
- Home asset inventory (json): `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/asset-inventory.json`
- Home implementation screenshots (web): `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/`
- Home vs prototype comparison screenshots: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/compare/`
- Interaction diagram registry: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/README.md`

## Current implementation status (2026-03-10)
- Home: implemented in mobile codebase with parity pass for layout, spacing, safe-area behavior, premium meal visuals, and command-center-driven Home flows against the locked prototype set.
- Command Center on Home: implemented for expanded/typing/recording/interpreting/review meal/review workout/saving/error states with locked CTA contracts and refreshed web-preview captures.
- Coach Chat: scaffold replaced with prototype-style chat UI, starter chips, composer, sample web-preview conversation, and live/mocked send behavior.
- Workouts: scaffold replaced with prototype-style stats row, session cards, and persistent command bar; web preview routes into session prototypes.
- Workout Session: preview-capable active and empty session screens now exist at `/workout-session/preview-active` and `/workout-session/preview-empty`, with fake tab-bar parity and exercise-picker routing.
- Exercise Picker: prototype-style list screen now exists at `/exercise-picker`, and picker selection now returns usable payloads back into preview/live workout-session routes.
- Settings: scaffold replaced with prototype-style grouped settings layout, profile block, goals card, integrations, and persistent command bar.
- Meals: locked standalone prototype now exists at `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/meals.html`, and `/meals` now opens in prototype-like selected-row/edit-card state during preview.
- Auth: sign-in and sign-up-email screens now implement the locked prototype shell, including social/email entry points and email-auth mode toggle.
- Latest pushed baseline commit on `main`: `417380f` (`Implement command center review-state parity on Home`).
- Local working tree delta includes:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/dashboard.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/coach.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/workouts.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/settings.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/meals.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/workout-session/[id].tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/exercise-picker.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/components/FloatingCommandBar.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/components/FakeTabBar.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/components/MealGlyph.tsx`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/scripts/capture-home-states.mjs`
- New in this pass:
  - Home recent-meal rows and Command Center quick-add rows now use premium meal glyphs instead of generic placeholder icons.
  - Web preview recording now simulates the prototype transcript/timer state more accurately for parity captures.
  - Home capture script now reads `HOME_CAPTURE_BASE_URL` and defaults to `http://localhost:8081/dashboard`.
- New in the cross-screen parity pass:
  - Hidden Home-linked routes (`/coach`, `/workouts`, `/settings`) now visually match their locked prototypes much more closely.
  - Workouts flow no longer dead-ends in web preview; `New Session`, sample session cards, and `Add Exercise` now route to preview screens.
  - Dashboard accepts `cc=expanded` and `cc=recording` route params so command-bar entry from non-Home screens can reuse the existing Home command center implementation.
- Pending on Home: analytics instrumentation, iOS device QA pass, and strict asset-source parity (`coach-badge-premium.svg` + extracted inventory files in app runtime).
- Remaining open parity gaps after this pass:
  - Workout session live-data CRUD is now closer to prototype behavior, but final native-device QA is still needed for live set editing and finish flows.
  - Web parity checks still differ from prototype captures where the prototype includes a mocked status bar/home-indicator that the Expo app intentionally leaves to the host OS/runtime.
  - Analytics and production data QA remain open after the parity pass.

## Handoff quick start (for next agent)
1. Review source docs in this order:
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/handoffs/home-handoff-2026-02-14.md`
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md`
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md`
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/implementation-checklists/home-screen-implementation-checklist.md`
2. Validate locally:
   - `cd /Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile`
   - `npx tsc --noEmit`
   - `node /Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/scripts/capture-home-states.mjs`
3. Compare states using:
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/`
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/home.html`
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/log.html`
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/voice-recording.html`
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/voice-review-meal.html`
   - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/voice-review-workout.html`

## Locked premium constraints (global)
- Meal thumbnails must not use emoji glyphs.
- Home and future screens should prefer dedicated SVG assets (or high-quality generated art) over generic emoji/clipart.
- Coach entry points must use branded coach illustration assets.

## Screen registry

| Screen | Locked design section | Prototype | Asset links | Interaction/state spec |
|---|---|---|---|---|
| Home | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Home Screen + Ask Coach + Premium Asset Policy) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/home.html` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/asset-inventory.md`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/icons`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/illustrations`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/implementation-checklists/home-screen-implementation-checklist.md`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/compare/` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md` |
| Workouts | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (3-tab layout + Command Center) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/workouts.html` | Prototype screenshots under `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/parity/` and implementation in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/workouts.tsx` | Implementation aligned to prototype shell; dedicated interaction spec still optional |
| Workout Session | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Workout Session Detail) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/workout-session.html`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/workout-session-empty.html` | Implementation in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/workout-session/[id].tsx`, parity captures in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/parity/` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/workout-session-interaction-spec.md` |
| Exercise Picker | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Exercise Picker) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/exercise-picker.html` | Implementation in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/exercise-picker.tsx`, captures in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/parity/` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/exercise-picker-interaction-spec.md` |
| Command Center | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Command Center + Voice Flow States) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/log.html` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/README.md` (diagram image paths) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md` |
| Settings | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (3-tab layout + Command Center) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/settings.html` | Implementation in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/settings.tsx`, captures in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/parity/` | Implementation aligned to prototype shell; dedicated interaction spec still optional |
| Coach Chat | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Ask Coach + 3-tab layout) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/coach.html` | Implementation in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/coach.tsx`, captures in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/parity/` | Implementation aligned to prototype shell; dedicated interaction spec still optional |
| Meals | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Meals list/edit shell) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/meals.html` | Implementation in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/meals.tsx`, captures in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/parity/` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/meals-interaction-spec.md` |
| Auth (Sign In/Up) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Auth shell) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/sign-in.html`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/sign-up-email.html` | Implementations in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/sign-in.tsx` and `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/sign-up-email.tsx`, captures in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/parity/` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/auth-interaction-spec.md` |
| Voice Flow (Recording/Review) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Voice Flow States) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/voice-recording.html`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/voice-review-meal.html`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/voice-review-workout.html` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md` |

## Update protocol
1. Lock UI in prototype + design decisions first.
2. Add or update per-screen asset inventory in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/<screen>/`.
3. Update this index row (prototype, assets, interaction spec status).
4. Only then start implementation for that screen.
