# Android release phone test

This is a signed release APK built with the `phone-test` profile. It runs without Expo Go or Metro. It uses the existing backend and Clerk development instance so existing account records remain available. It is not a Google Play production release.

## Install and test

1. Open the APK download link on the Android phone and install it. If Android asks, permit this download source to install this APK.
2. Open VoiceFit and sign in using the same Google account. Confirm existing history is present.
3. Close the app completely, reopen, and visit You → Load timings. Capture the initial results before another restart (timings are memory-only).
4. Return to Today several times and compare those warm loads with the first launch. Repeat after leaving the app idle for a few minutes to exercise token refresh.
5. Try Meals history, a workout, Coach, keyboard opening/closing, and scrolling. Real saves still affect your account.
6. Test microphone and camera permissions and actual capture. Test Health Connect separately if supported/installed on the phone.

## Timing interpretation

- `auth-ready`: JavaScript timing-module initialization until Clerk reports loaded. This can be signed out; it is not a successful sign-in measurement.
- `auth-token /screens/dashboard`: startup token warm-up.
- `auth-token /api/dashboard`: token wait immediately before a dashboard request; includes cached retrieval or refresh as needed.
- `api /api/dashboard`: request through response parsing, excluding the preceding token wait.
- `startup-ready`: module initialization until dashboard data becomes available in React. A cached result counts. The first dashboard mount after login includes time spent signing in; use a signed-in relaunch for comparison. Revisited mounts can emit a cumulative sample, so use the first startup-ready sample per app process.
- `screen-ready`: screen focus until data-ready, including cache hits.

These are not native process-start, first-paint or frame-rate measurements. They should not be added together because some stages overlap. Diagnostics retain at most 200 redacted records in memory, never tokens, query strings, request/response payloads or error messages. Release diagnostics do not log to the console or upload measurements. The ordinary production profile does not enable the diagnostic flag.

Build ID: 25693dc3-249e-43a2-8be3-6c9ba57586f1. The exact build result and artifact link are recorded when the cloud build completes.
