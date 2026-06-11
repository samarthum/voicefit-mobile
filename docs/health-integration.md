# Device health integration (Apple Health / Health Connect)

VoiceFit reads the daily step count from the platform health store and shows
it on the Home dashboard. iOS uses Apple Health (HealthKit) via
`@kingstinct/react-native-healthkit`; Android uses Health Connect via
`react-native-health-connect`.

## How it works

```
lib/health/
  shared.ts          pure helpers: day ranges, sync/merge rules (unit tested)
  steps.ts           web / fallback implementation (no-op)
  steps.ios.ts       HealthKit implementation
  steps.android.ts   Health Connect implementation
hooks/use-health-steps.ts
  useHealthSteps(date)       react-query read of the device step count
  useHealthStepsSync(...)    pushes device steps to POST /api/daily-metrics
```

Metro's platform extensions pick the right `steps.*.ts` file per platform.
Both native implementations lazy-load their module inside `import()` +
try/catch, so the app still boots in Expo Go or web where the native modules
don't exist — everything just resolves to "unavailable".

Behavior on the dashboard (`app/(tabs)/dashboard.tsx`):

- On first load the app asks for read permission **once per install**
  (flag stored in SecureStore). If the user declines, we never auto-prompt
  again; steps silently fall back to server data.
- The steps card shows `max(device steps, server steps)` for the selected
  day. Device counts only grow during a day, so the larger value is fresher;
  taking the max also avoids clobbering a manually voice-logged count.
- When the device count is ahead of the server, it is synced to
  `POST /api/daily-metrics { date, steps }` (same endpoint the voice flow
  uses), then the dashboard query is invalidated. That keeps weekly trends
  and the coach in agreement with the dashboard.
- Counts refresh when the app returns to the foreground.

HealthKit nuance: Apple never reveals whether *read* permission was granted.
`getRequestStatusForAuthorization` only tells us whether the permission sheet
still needs showing. If the user denied access, queries simply return no
data — that is expected, not a bug.

## Build requirements

These are native modules — **a new dev client / EAS build is required**
(`eas build --profile development`). They will not work in Expo Go.

Config lives in `app.json`:

- `expo-build-properties` bumps Android `minSdkVersion` to 26
  (Health Connect's minimum; Expo's default is 24).
- `react-native-health-connect` plugin adds the permission-rationale
  intent-filter; the local plugin
  `plugins/with-health-connect-permission-usage.js` adds the Android 14+
  `VIEW_PERMISSION_USAGE` activity-alias.
- `android.permissions` includes `android.permission.health.READ_STEPS`.
- The `@kingstinct/react-native-healthkit` plugin adds the HealthKit
  entitlement and `NSHealthShareUsageDescription`. Background delivery and
  write access are disabled for now (read-only steps).
- `react-native-nitro-modules` is a required peer of the HealthKit library.

iOS note: the HealthKit entitlement must be enabled on the App ID; EAS
manages this automatically when it regenerates provisioning profiles.

Play Store note: apps using `android.permission.health.*` must complete the
Health Connect declaration form in the Play Console before release.

## Adding more metrics later

The per-platform files are intentionally thin wrappers; to add a metric
(weight, sleep, workouts, active energy…):

1. Add a getter to each `steps.*.ts` (or rename the module to something like
   `metrics.*.ts`) — e.g. HealthKit `HKQuantityTypeIdentifierBodyMass` /
   Health Connect `Weight` record.
2. Extend the permission sets: `toRead` array on iOS, the
   `requestPermission` list + `android.permission.health.READ_*` entries on
   Android.
3. Reuse the `useHealthSteps`/`useHealthStepsSync` pattern; weight can sync
   through the same `/api/daily-metrics` endpoint (`weightKg`), while sleep
   and workouts will need new backend endpoints.
