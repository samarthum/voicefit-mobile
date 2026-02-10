# Home Screen Implementation Checklist

- Last updated: 2026-02-10
- Scope: Home screen + embedded Command Center behavior on Home
- Status: In execution (Home implemented; screenshots captured)
- Canonical references:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/asset-inventory.md`

## 0) Implementation gates

- [ ] Confirm feature flag and environment variables for Home data APIs and command-center interpretation/save APIs.
- [ ] Confirm timezone source for day picker and 7-day trend windows.
- [ ] Confirm telemetry sink exists for all events listed in section 9.

## 1) Home data model + queries

- [ ] Implement Home query keyed by `selectedDate`.
- [ ] Ensure response includes calories summary, steps, weight, trends (rolling 7), recent meals (max 3), and goals.
- [ ] Implement states: `home_loading`, `home_ready`, `home_refreshing`, `home_error_blocking`.
- [ ] Implement `pull_to_refresh` that preserves stale content while fetching.
- [ ] Implement selected-day reload from day picker tap.
- [ ] Implement trend metric switching (`calories`, `steps`, `weight`) without leaving `home_ready`.
- [ ] Preserve scroll position on refresh success and refresh failure.

## 2) Home layout and component assembly

- [ ] Implement header with `VoiceFit` + add button.
- [ ] Implement 7-day picker ending at today (no future dates).
- [ ] Implement hero calorie ring and center text.
- [ ] Implement steps and weight metric cards per design decisions.
- [ ] Implement Ask Coach card entry point.
- [ ] Implement Weekly Trends card + metric tabs + line chart.
- [ ] Implement Recent Meals list with `See All` navigation.
- [ ] Keep command center collapsed bar visible above tab bar.
- [ ] Keep tab bar behavior: `Home`, `Workouts`, `Settings`.

## 3) Premium asset integration (Home)

- [ ] Replace any remaining emoji/placeholder meal thumbnails with premium SVGs from inventory.
- [ ] Use `coach-badge-premium.svg` for Ask Coach entry.
- [ ] Source icons and illustrations from:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/icons`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/illustrations`
- [ ] Verify sizing and padding match locked prototype spacing.

## 4) Command Center panel states on Home

- [ ] Implement state container for `cc_collapsed`, `cc_expanded_empty`, `cc_expanded_typing`.
- [ ] Wire entry points: `tap_command_bar`, `tap_add_button` -> `cc_expanded_empty`.
- [ ] Wire close behavior: expanded states -> `cc_collapsed`.
- [ ] Enforce send disabled for empty/whitespace input.
- [ ] Persist typed draft while in expanded states and across typed-interpret failure.

## 5) Typed flow (no review screen)

- [ ] `tap_send_typed` transitions `cc_expanded_typing` -> `cc_submitting_typed`.
- [ ] Call typed interpretation service from `cc_submitting_typed`.
- [ ] On interpret success, transition to `cc_auto_saving` directly (no review state).
- [ ] On interpret failure, transition to `cc_error` with `typed_interpret_failure` subtype.
- [ ] Preserve typed text for `Retry typed` and `Edit text` actions.

## 6) Voice flow (record -> interpret-with-edit -> autosave)

- [ ] Wire mic entry from collapsed and expanded states to `cc_recording`.
- [ ] On first voice use, request mic permission; denied path goes to `cc_error` subtype `mic_permission_denied`.
- [ ] `stop_recording` transitions to `cc_interpreting_voice` with transcript shown.
- [ ] While interpreting, support `Edit text` that restarts interpretation.
- [ ] While interpreting, support `Retry voice` to return to fresh recording.
- [ ] While interpreting, support `Discard` to close command center.
- [ ] On voice interpret success, transition to `cc_auto_saving`.
- [ ] On voice interpret failure, transition to `cc_error` subtype `voice_interpret_failure`.

## 7) Save + quick add + refresh behavior

- [ ] Implement `cc_quick_add_saving` from quick-add row taps.
- [ ] Successful `cc_auto_saving` and `cc_quick_add_saving` both:
  - [ ] close overlays to `cc_collapsed`
  - [ ] trigger Home data refresh
  - [ ] show success toast
- [ ] Save failures route to `cc_error` with subtype `auto_save_failure` or `quick_add_failure`.
- [ ] `Retry save` replays the correct save request by subtype.

## 8) Locked error copy and CTA behavior

- [ ] Implement exact subtype copy + CTAs:
  - [ ] `typed_interpret_failure`
    - Title: `Couldn't understand that entry`
    - Body: `Edit your text and try again.`
    - CTAs: `Retry typed`, `Edit text`, `Discard`
  - [ ] `voice_interpret_failure`
    - Title: `Couldn't understand your recording`
    - Body: `Retry voice or edit the transcript.`
    - CTAs: `Retry voice`, `Edit text`, `Discard`
  - [ ] `mic_permission_denied`
    - Title: `Microphone access is off`
    - Body: `Enable microphone in Settings to log by voice.`
    - CTAs: `Open Settings`, `Use typing instead`, `Discard`
  - [ ] `auto_save_failure`
    - Title: `Couldn't save right now`
    - Body: `We kept your entry. Try saving again.`
    - CTAs: `Retry save`, `Discard`
  - [ ] `quick_add_failure`
    - Title: `Couldn't add that item`
    - Body: `Please try again.`
    - CTAs: `Retry save`, `Discard`
- [ ] Wire CTA transitions exactly as locked in command-center spec section 4.1.3.

## 9) Analytics and logging

- [ ] Track panel lifecycle events (`cc_opened`, `cc_closed`).
- [ ] Track input-mode events (`cc_typed_started`, `cc_mic_started`, `cc_stop_recording`).
- [ ] Track interpretation outcomes (`typed_interpret_success/failure`, `voice_interpret_success/failure`).
- [ ] Track save outcomes (`auto_save_success/failure`, `quick_add_success/failure`).
- [ ] Track error CTA usage (`retry_typed`, `retry_voice`, `retry_save`, `edit_text`, `use_typing_instead`, `discard`, `open_settings`).

## 10) QA acceptance runbook

- [ ] Execute all acceptance criteria in:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md`
- [ ] Verify rendered diagrams match implementation behavior:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/home-data-state.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-typed-quickadd-flow.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-interpret-flow.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-error-flow.png`
- [ ] Confirm no screen includes emoji meal thumbnails.
- [ ] Confirm no typed path enters manual review screens.
- [ ] Confirm Home refresh always follows successful command-center save.

## 11) Definition of done

- [ ] All states/events in Home + Command Center specs are implemented.
- [ ] All locked copy/CTA contracts are implemented exactly.
- [ ] Home premium assets are integrated and visually correct.
- [ ] QA checklist passes on iOS target device sizes.
- [ ] Specs and checklist remain in sync after implementation PR.

## 12) Current execution snapshot (2026-02-10)

- Completed in code:
  - Home layout and major visual sections in `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/app/(tabs)/dashboard.tsx`
  - Home data states (`home_loading`, `home_ready`, `home_refreshing`, blocking-error branch) and trend/day interactions
  - Command center states (`cc_collapsed`, `cc_expanded_empty`, `cc_expanded_typing`, `cc_submitting_typed`, `cc_recording`, `cc_interpreting_voice`, `cc_auto_saving`, `cc_quick_add_saving`, `cc_error`)
  - Typed and voice paths both save via direct auto-save (no manual review state)
  - Error copy/CTA mapping wired to locked subtype contract
- Captured implementation screenshots:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/01-home-collapsed.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/02-cc-expanded-empty.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/03-cc-expanded-typing.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/04-cc-submitting-typed.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/05-cc-auto-saving.png`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/06-home-after-typed-save.png`
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
