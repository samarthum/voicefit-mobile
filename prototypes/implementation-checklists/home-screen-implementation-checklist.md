# Home Screen Implementation Checklist

- Last updated: 2026-02-10
- Scope: Home screen + embedded Command Center behavior on Home
- Status: In execution (Home implementation in progress for v2 review-state parity; analytics + iOS QA + asset-source parity pending)
- Canonical references:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/asset-inventory.md`

## 0) Implementation gates

- [ ] Confirm feature flag and environment variables for Home data APIs and command-center interpretation/save APIs.
- [x] Confirm timezone source for day picker and 7-day trend windows.
- [ ] Confirm telemetry sink exists for all events listed in section 9.

## 1) Home data model + queries

- [x] Implement Home query keyed by `selectedDate`.
- [x] Ensure response includes calories summary, steps, weight, trends (rolling 7), recent meals (max 3), and goals.
- [x] Implement states: `home_loading`, `home_ready`, `home_refreshing`, `home_error_blocking`.
- [x] Implement `pull_to_refresh` that preserves stale content while fetching.
- [x] Implement selected-day reload from day picker tap.
- [x] Implement trend metric switching (`calories`, `steps`, `weight`) without leaving `home_ready`.
- [x] Preserve scroll position on refresh success and refresh failure.

## 2) Home layout and component assembly

- [x] Implement header with `VoiceFit` + add button.
- [x] Implement 7-day picker ending at today (no future dates).
- [x] Implement hero calorie ring and center text.
- [x] Implement steps and weight metric cards per design decisions.
- [x] Implement Ask Coach card entry point.
- [x] Implement Weekly Trends card + metric tabs + line chart.
- [x] Implement Recent Meals list with `See All` navigation.
- [x] Keep command center collapsed bar visible above tab bar.
- [x] Keep tab bar behavior: `Home`, `Workouts`, `Settings`.

## 3) Premium asset integration (Home)

- [x] Replace any remaining emoji/placeholder meal thumbnails with non-emoji vector visuals.
- [ ] Use `coach-badge-premium.svg` for Ask Coach entry.
- [ ] Source icons and illustrations from:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/icons`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/illustrations`
- [x] Verify sizing and padding match locked prototype spacing.

## 4) Command Center panel states on Home

- [x] Implement state container for `cc_collapsed`, `cc_expanded_empty`, `cc_expanded_typing`.
- [x] Wire entry points: `tap_command_bar`, `tap_add_button` -> `cc_expanded_empty`.
- [x] Wire close behavior: expanded states -> `cc_collapsed`.
- [x] Enforce send disabled for empty/whitespace input.
- [x] Persist typed draft while in expanded states and across typed-interpret failure.

## 5) Typed flow (interpret -> review -> save)

- [x] `tap_send_typed` transitions `cc_expanded_typing` -> `cc_submitting_typed`.
- [x] Call typed interpretation service from `cc_submitting_typed`.
- [x] On meal/workout interpret success, transition to `cc_review_meal`/`cc_review_workout`.
- [x] Keep explicit user confirmation before save from review states.
- [x] On interpret failure, transition to `cc_error` with `typed_interpret_failure` subtype.
- [x] Preserve typed text for `Retry typed` and `Edit text` actions.

## 6) Voice flow (record -> interpret-with-edit -> review -> save)

- [x] Wire mic entry from collapsed and expanded states to `cc_recording`.
- [x] On first voice use, request mic permission; denied path goes to `cc_error` subtype `mic_permission_denied`.
- [x] `stop_recording` transitions to `cc_interpreting_voice` with transcript shown.
- [x] While interpreting, support `Edit text` that restarts interpretation.
- [x] While interpreting, support `Retry voice` to return to fresh recording.
- [x] While interpreting, support `Discard` to close command center.
- [x] On meal/workout interpret success, transition to `cc_review_meal`/`cc_review_workout`.
- [x] `tap_save_review` transitions review states to `cc_saving`.
- [x] On voice interpret failure, transition to `cc_error` subtype `voice_interpret_failure`.

## 7) Save + quick add + refresh behavior

- [x] Implement `cc_quick_add_saving` from quick-add row taps.
- [ ] Successful `cc_saving` and `cc_quick_add_saving` both:
  - [x] close overlays to `cc_collapsed`
  - [x] trigger Home data refresh
  - [x] show success toast
- [x] Save failures route to `cc_error` with subtype `auto_save_failure` or `quick_add_failure`.
- [x] `Retry save` replays the correct save request by subtype.

## 8) Locked error copy and CTA behavior

- [x] Implement exact subtype copy + CTAs:
  - [x] `typed_interpret_failure`
    - Title: `Couldn't understand that entry`
    - Body: `Edit your text and try again.`
    - CTAs: `Retry typed`, `Edit text`, `Discard`
  - [x] `voice_interpret_failure`
    - Title: `Couldn't understand your recording`
    - Body: `Retry voice or edit the transcript.`
    - CTAs: `Retry voice`, `Edit text`, `Discard`
  - [x] `mic_permission_denied`
    - Title: `Microphone access is off`
    - Body: `Enable microphone in Settings to log by voice.`
    - CTAs: `Open Settings`, `Use typing instead`, `Discard`
  - [x] `auto_save_failure`
    - Title: `Couldn't save right now`
    - Body: `We kept your entry. Try saving again.`
    - CTAs: `Retry save`, `Discard`
  - [x] `quick_add_failure`
    - Title: `Couldn't add that item`
    - Body: `Please try again.`
    - CTAs: `Retry save`, `Discard`
- [x] Wire CTA transitions exactly as locked in command-center spec section 4.1.3.

## 9) Analytics and logging

- [ ] Track panel lifecycle events (`cc_opened`, `cc_closed`).
- [ ] Track input-mode events (`cc_typed_started`, `cc_mic_started`, `cc_stop_recording`).
- [ ] Track interpretation outcomes (`typed_interpret_success/failure`, `voice_interpret_success/failure`).
- [ ] Track save outcomes (`auto_save_success/failure`, `quick_add_success/failure`).
- [ ] Track error CTA usage (`retry_typed`, `retry_voice`, `retry_save`, `edit_text`, `use_typing_instead`, `discard`, `open_settings`).

## 10) QA acceptance runbook

- [x] Execute all acceptance criteria in web preview run:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md`
- [x] Verify rendered diagrams match implementation behavior:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/home-data-state.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-typed-quickadd-flow.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-interpret-flow.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-error-flow.png`
- [x] Confirm no screen includes emoji meal thumbnails.
- [x] Confirm meal/workout typed and voice paths enter review states before save.
- [x] Confirm Home refresh always follows successful command-center save.

## 11) Definition of done

- [x] All states/events in Home + Command Center specs are implemented.
- [x] All locked copy/CTA contracts are implemented exactly.
- [ ] Home premium assets are integrated and visually correct.
- [ ] QA checklist passes on iOS target device sizes.
- [x] Specs and checklist remain in sync after implementation PR.

## 12) Current execution snapshot (2026-02-10)

- Completed in code:
  - Home layout and major visual sections in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/dashboard.tsx`
  - Home data states (`home_loading`, `home_ready`, `home_refreshing`, blocking-error branch) and trend/day interactions
  - Command center states (`cc_collapsed`, `cc_expanded_empty`, `cc_expanded_typing`, `cc_submitting_typed`, `cc_recording`, `cc_interpreting_voice`, `cc_review_meal`, `cc_review_workout`, `cc_saving`, `cc_quick_add_saving`, `cc_error`)
  - Typed and voice meal/workout paths route through explicit review screens before save
  - Error copy/CTA mapping wired to locked subtype contract
- Captured implementation screenshots:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/01-home-collapsed.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/02-cc-expanded-empty.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/03-cc-expanded-typing.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/04-cc-submitting-typed.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/05-cc-review-state.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/05-cc-auto-saving.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/06-home-after-typed-save.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/06b-cc-review-workout.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/07-cc-quick-add-saving.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/08-home-after-quick-add.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/09-cc-recording.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/10-cc-interpreting-voice.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/11-cc-error-voice.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/12-cc-error-edit-text-fallback.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/13-cc-error-typed.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/14-cc-error-save.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/15-cc-error-mic-permission.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/16-cc-error-quick-add.png`
