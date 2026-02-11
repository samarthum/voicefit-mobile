# VoiceFit Mobile UI Source of Truth

- Last updated: 2026-02-11
- Owner: Product + Design + Eng handoff doc for all agents
- Rule: This document is the canonical UI index. Every locked screen must link prototype, design decisions, assets, and interaction spec here.

## Canonical links
- Design decisions log: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md`
- Prototype folder: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes`
- Asset inventories root: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets`
- Implementation checklists root: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/implementation-checklists`
- Home implementation checklist: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/implementation-checklists/home-screen-implementation-checklist.md`
- Home asset inventory (doc): `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/asset-inventory.md`
- Home asset inventory (json): `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/asset-inventory.json`
- Home implementation screenshots (web): `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/`
- Home vs prototype comparison screenshots: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/compare/`
- Interaction diagram registry: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/README.md`

## Current implementation status (2026-02-11)
- Home: implemented in mobile codebase (UI + command center state flows + error subtype handling), with visual comparison pass complete against prototype.
- Command Center on Home: implemented with typed/voice review flows, quick-add save flow, and recoverable error paths.
- Pending on Home: analytics instrumentation, iOS device QA pass, and strict asset-source parity (`coach-badge-premium.svg` + extracted inventory files in app runtime).

## Locked premium constraints (global)
- Meal thumbnails must not use emoji glyphs.
- Home and future screens should prefer dedicated SVG assets (or high-quality generated art) over generic emoji/clipart.
- Coach entry points must use branded coach illustration assets.

## Screen registry

| Screen | Locked design section | Prototype | Asset links | Interaction/state spec |
|---|---|---|---|---|
| Home | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Home Screen + Ask Coach + Premium Asset Policy) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/home.html` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/asset-inventory.md`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/icons`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/illustrations`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/implementation-checklists/home-screen-implementation-checklist.md`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/compare/` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md` |
| Workouts | Pending lock | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/workouts.html` | Pending | Pending |
| Workout Session | Pending lock | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/workout-session.html` | Pending | Pending |
| Exercise Picker | Pending lock | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/exercise-picker.html` | Pending | Pending |
| Command Center | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Command Center + Voice Flow States) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/log.html` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/README.md` (diagram image paths) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md` |
| Settings | Pending lock | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/settings.html` | Pending | Pending |
| Coach Chat | Pending lock | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/coach.html` | Pending | Pending |
| Auth (Sign In/Up) | Pending lock | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/sign-in.html`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/sign-up-email.html` | Pending | Pending |
| Voice Flow (Recording/Review) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md` (Voice Flow States) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/voice-recording.html`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/voice-review-meal.html`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/voice-review-workout.html` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md` |

## Update protocol
1. Lock UI in prototype + design decisions first.
2. Add or update per-screen asset inventory in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/<screen>/`.
3. Update this index row (prototype, assets, interaction spec status).
4. Only then start implementation for that screen.
