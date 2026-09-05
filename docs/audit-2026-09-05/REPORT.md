# VoiceFit mobile audit — 5 September 2026

**Current status:** See [CURRENT-STATUS.md](./CURRENT-STATUS.md) for pushed commits and the latest verification. Details below record their original audit pass.

**Update:** [Second improvement pass](./PHASE-2.md) documents the implemented reliability fixes, current tests, and deployment/device limitations. The backlog below records the first-pass state and is superseded where noted there.

Scope: `voicefit-mobile` (Expo 54 / React Native). The retired web interface was excluded. Existing backend routes were read where necessary to verify mobile API behavior. First-pass application changes were in the mobile repository. The second pass also adds a mobile-facing batch API in the shared backend.

## Assessment

The app has a useful core: a short route from a sentence to a saved meal, shared visual tokens, native navigation, and a modular logging controller. The signed-in experience nevertheless has correctness problems that visual polish alone cannot solve. I reproduced an error on entering the signed-in dashboard and a crash opening meal review, alongside misleading personal-data displays and an obstructed meal list.

The visual direction is worth keeping. The next iteration should emphasize legible content, reliable feedback, and a straightforward daily log. Adding more animation is less valuable than removing the interruptions and false states documented below.

**This is a completed code-audit pass and a partial simulator audit, not an all-flows device certification.** Simulator automation became unreliable: coordinate actions repeatedly returned `noWindowsAvailable`, while many accessibility taps stopped activating controls. Reconnecting, resetting the automation session, and cold-launching the app did not reliably resolve this. The remaining device checks are listed explicitly.

## Changes made locally

| Finding | Change | Evidence / verification |
| --- | --- | --- |
| Signed-in dashboard imports unavailable NitroModules in Expo Go | Check Expo execution environment before importing Apple Health | Error reproduced in simulator; dashboard subsequently rendered without it. HealthKit remains a native-build feature. |
| Opening meal review crashes with “Maximum update depth exceeded” | Stabilize meal header callbacks/options; address the same inline callback pattern in workout, exercise picker, and email headers | Meal crash reproduced; meal detail rendered after the fix. Other affected routes still need device regression testing. |
| Logging sheet hides its form and controls from the accessibility tree | Stop grouping the whole bottom sheet as one accessible element; apply the same change to ingredient sheet | Input, close, photo, mic, and submit controls became individually discoverable in simulator. |
| “HOLD TO SPEAK” contradicts tap-to-start behavior | Correct instruction to “TAP TO SPEAK”; correct meal empty-state copy | Verified in the logging sheet. |
| Empty history offers fabricated “Frequent” meals | Remove sample fallback; fetch actual recent meals from the existing recent-meals endpoint; label them “Recent meals” | Sample suggestions were visible on the live account. Empty-history behavior now has a regression test. |
| Hard-coded weight sparkline implies measurements where none exist | Plot supplied measurements, preserve gaps, and show an empty-state message | Verified empty-state appearance; tests cover insufficient data, gaps, and constant/decreasing values. |
| Historical days say “Today,” and opening meals drops the date | Date-aware headings and meals navigation parameter | Code checked; complete date-navigation device test pending. |
| Today’s cache key can display yesterday’s totals as today | Scope the home dashboard cache by selected date | Code checked. Overnight foreground behavior still needs the separate follow-up below. |
| Meal history is limited to latest 50 entries and seven displayed days | Query the selected local day using UTC date bounds; add pagination and earlier/later weeks; validate date parameters | Type checked; date-validation tests pass. Large-history/timezone UI tests pending. |
| Trends use fixed goals of 2,100 kcal / 10,000 steps / 70 kg | Read calorie/step goals from dashboard and weight goal from user settings | Code checked against existing API fields. |
| Missing trend measurements are carried forward or padded with zero | Preserve missing values and break the line at gaps | Code checked. No measurements are generated to fill the chart. |
| Failed trend requests resemble an empty account | Add loading and retry states, including top-meals failures | Code checked; network-failure device test pending. |
| Saving waits for unrelated query refreshes, then dims the whole screen | Start refreshes in background after successful writes; show a nonmodal confirmation; scope its dismissal timer to the saved state | Code checked; rapid repeat logging and save-failure device checks pending. |
| The floating command bar covers meal rows | Give the bar its own layout space on tab screens; reduce redundant scroll padding | Dashboard screenshot verified after scrolling: the meal row is clear of the bar. Train/You still need verification. |
| Standalone launchers can sit on the home indicator | Apply bottom-safe-area handling to standalone log/trend/meal launchers | Code checked. |
| Small text and button text have insufficient contrast | Darken muted text and sage accent; enlarge several touch targets; label date buttons | Muted text contrast increased from 2.52:1 to 4.67:1 on the canvas. White-on-accent increased from 3.81:1 to 5.33:1. Automated token checks pass. This does not certify every combination or opacity in the app. |
| Settings can save preview defaults if the live settings request fails | Prevent saving until real settings exist; acknowledge successful goal writes without waiting for dashboard refresh | Code checked. |

## Simulator coverage

Device: iPhone 17 Pro, iOS 26.2, Expo Go 54.0.6. Google account sign-in was completed by the user after the normal sign-in flow reached Google.

| Flow | What actually happened |
| --- | --- |
| Launch / Google authentication | Sign-in screen inspected; Google flow opened; user completed authentication. |
| Signed-in dashboard | Read live data; reproduced and fixed Expo Go health import error. |
| Cold start | Restarted Expo Go; signed-in session restored. No release-build startup timing claim. |
| Open logging sheet | Opened sheet and inspected its original sample suggestions and instructions. |
| Keyboard / typed meal | Entered `Audit test: one medium banana`; input stayed above keyboard; submitted successfully. |
| Async estimate | Meal appeared as `one medium banana`, 105 kcal, requiring review. |
| Meal review | Reproduced render-loop crash. After the fix the detail view displayed meal type, macros, ingredient, and review/delete actions. Ingredient interaction and final confirmation were not verified. |
| Dashboard readability / scroll clearance | Inspected updated dashboard and meal row clear of the docked bar. |
| Workout creation / exercise selection / set editing / finish | Code reviewed; controller unit coverage exists. Not successfully exercised end to end in simulator. |
| Voice recording / transcription | Controller tests cover denial, short recordings, and transcript routing. Actual microphone recording/transcription remains unverified. |
| Photo capture / library / estimation | Controller tests cover permission denial, selection, and submission. Actual device picker/upload remains unverified. |
| Weight / steps logging | Controller tests cover intent routing. No real weight or step values were changed for testing. |
| Trends / historical meals | Code reviewed and improved. Full date/filter/pagination interaction remains unverified. |
| Settings / coach profile / goal saving | Code reviewed. Existing account goals were not changed for testing. |
| Coach send / stream / history / clear | Code reviewed. No test conversation was sent or existing chat cleared. |
| Apple Health | Unavailable in Expo Go. Requires a dedicated native build; permission/read/sync testing remains open. |
| Apple sign-in / email verification / sign-out | Code reviewed where relevant. Not device-tested; the Google session was preserved. |
| Offline / timeout / retry | Controller error paths have unit tests. No complete device network-transition test. |
| Large text / small iPhone / tablet | Not device-tested. |

Test data cleanup: the single synthetic meal was removed using its exact ID plus a guard requiring the exact audit transcript and description. Its related test conversation event was removed too. A database count confirmed that the test meal no longer exists. This cleanup is **not** evidence that the app’s delete UI works. No genuine meals, workouts, metrics, goals, or coach history were removed.

## Remaining priority findings

These are code-traced risks, not additional simulator reproductions. They should be handled before declaring the app reliable.

### P1 — Cancellation does not cancel the operation

`components/command-center/states/InterpretingState.tsx` offers Edit and Discard during processing, but the controller’s asynchronous operations continue. `lib/api-client.ts` also replaces an incoming signal with its timeout controller. A late completion can save the original text or change a newly opened sheet after the user has moved on.

Fix: distinguish cancellation of interpretation from an already accepted save. Use operation IDs to ignore stale completions, compose caller cancellation with timeout signals, and avoid offering “Discard” as if it could undo a committed write. Test delayed completion after close, edit, reopen, and resubmit.

### P1 — Multi-set workout saves can partially succeed

`components/command-center/controller.ts`, `saveReviewedEntry`, creates sets using `Promise.all` of independent writes. One request can fail after others commit. A generic retry cannot reliably know which sets already exist.

Fix: a batch endpoint with a transaction and idempotency key, or explicit per-set success tracking and retry of failed sets. The existing all-success tests do not cover partial server success. This requires coordination with the shared backend.

### P1 — Editing an older meal without ingredients can erase its nutrition

`app/meal-edit/[id].tsx` always submits the ingredient list during a dirty save. A legacy meal may have scalar calories/macros but no ingredient rows. Changing only its meal type can submit an empty ingredient list; the backend ingredient endpoint computes totals by summing that list, yielding zero.

Fix: track ingredient edits separately from meal metadata. Preserve scalar totals for metadata-only edits; intentionally removing all ingredients should be an explicit case. Add a regression fixture for a scalar-only historical meal.

### P1 — Coach history can reopen stale

`app/coach.tsx` loads history with `staleTime: Infinity` and hydrates local chat once. The code does not update that history query on normal completed messages. Returning to the coach can hydrate the old cached history. The history query’s error is not rendered, although streaming errors are.

Fix: update/invalidate history after completed turns, show history-load failures, and prevent an initial delayed history response from replacing a newly started conversation. Test send → leave → return, slow history loads, and failed history loads.

### P1 — Account isolation relies on one explicit sign-out handler

`lib/query-client.ts` persists shared query keys without an account namespace. `app/(tabs)/settings.tsx` clears cache on its own sign-out path. An externally expired or changed Clerk session does not necessarily pass through that handler.

Fix: isolate persisted caches per Clerk user, or enforce an auth-transition boundary that cancels queries and clears both memory and disk before another account can render. Validate an account change and a forced session expiry.

### P2 — Workout context survives off-screen

`useCommandCenter` installs screen context using mount/unmount effects. A native stack can keep a workout screen mounted when another screen covers it. Logging elsewhere could retain the old workout’s session context.

Fix: set/clear context based on route focus, then test switching among workout detail, exercise picker, coach, and tabs before logging.

### P2 — Weekly workout totals depend on loaded history pages

The Train summary derives this week’s counts and volume from the currently fetched paginated list. For a week with more sessions than the first page, summary numbers can change merely by loading older rows.

Fix: fetch an authoritative week summary separately from history pagination. Test more than ten sessions in a week.

### P2 — Foreground day rollover remains incomplete

The dashboard now uses date-scoped caches, but `selectedDate` is still state initialized from the day at mount. Returning after midnight can leave yesterday selected. Several week labels also memoize the current date once.

Fix: refresh the local date on foreground; follow the new day only if the user was viewing today, while preserving intentional historical selections.

### P2 — Health setup and authorization copy need clearer states

Health access is prompted from dashboard loading, with little preceding explanation. HealthKit’s “authorization unnecessary” status does not prove read access was granted, but the settings screen labels this state “Connected.” A successful access result is also cached at module scope.

Fix: explicit setup from the You screen, explain step access before the OS prompt, and distinguish permission answered from data actually available. Recheck permission/data availability after returning from Health. Simulator step data alone is not a physical-device sync test.

### P2 — Startup and UI density need measurement

The root waits for fonts but ignores the font-loader error result, potentially leaving a perpetual spinner. The iOS export also includes many font weights beyond the nine registered by the app. Avoid assigning startup blame without release measurements; inspect font imports and failure handling, then profile cold launch and scrolling in a release native build.

## UI/UX direction for the next iteration

1. Keep Today focused on the selected day: nutrition, steps/weight, then meals. Use clear actions such as “Log meal,” “Record voice,” and “View trends.” The ring currently dominates the screen while the useful log needs scrolling.
2. Keep small labels legible. The contrast pass helps, but numerous 10–11 point labels, uppercase tracking, tightly packed macros, and small icon controls remain. Check larger text sizes before making the cards denser.
3. Treat recent meals as a real shortcut. Empty history should be an honest invitation to log, not a list of plausible sample meals. Make it clear whether tapping a shortcut saves immediately.
4. Keep feedback in context: recorded → saved → estimating → ready to review. Avoid fictitious elapsed times, blocking confirmation overlays, and “Edit” actions that cannot change a request already sent.
5. Make uncertainty visible: no weight measurements should mean no trend; a failed request should mean retry; a delayed estimate should remain distinguishable from a zero-calorie meal.
6. Keep coach optional and neutral. The original home copy assumed it was dinner time and suggested eating less after exceeding a calorie goal. The replacement directs the user to explore patterns without inventing personalized advice.

## Validation and release boundary

- Baseline: 49 tests passed; TypeScript passed.
- Current changes: 55 tests passed; TypeScript passed; `git diff --check` passed.
- Added tests cover truthful sparklines, no fabricated recent meals, date-parameter validation, and contrast thresholds. An existing markdown test was updated to use the shared color token rather than its previous literal value.
- iOS JavaScript/Hermes export succeeded at `/tmp/voicefit-mobile-audit-ios`. This checks bundling; it is not a signed native build or device release test.
- No dependencies were upgraded, no app was deployed, and no changes were committed.
- Pre-existing untracked `.claude/launch.json` and `.next/` were left alone.

Before release: finish the simulator matrix above with working controls, build a dedicated iOS client for HealthKit, verify large text/small-screen layout, and address the P1 findings. The changes are reviewable locally; they should not be represented as a complete all-flows QA pass.

## Visual evidence

`dashboard-after.png` shows the updated dashboard during this audit. The banana shown in that screenshot is the synthetic test entry described above, which was subsequently removed. Later simulator observation confirmed the meal row could scroll clear of the logging bar after the layout change.
