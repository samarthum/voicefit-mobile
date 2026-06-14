/**
 * Platform-agnostic helpers for the device health integration
 * (Apple Health on iOS, Health Connect on Android).
 */

/** Whether the user can read steps from the device health store. */
export type HealthStepsAccess = "granted" | "prompt" | "unavailable";

/**
 * Converts a local date key ("YYYY-MM-DD") into the [start, end) Date range
 * covering that calendar day in the device's timezone.
 */
export function localDayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid date key: ${date}`);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Decides whether a device step count should be pushed to the backend.
 * Device steps only grow during a day, so a device value above the server
 * value is fresher data; a lower one would clobber a manual log.
 */
export function shouldSyncSteps(
  deviceSteps: number | null | undefined,
  serverSteps: number | null | undefined
): deviceSteps is number {
  if (deviceSteps == null || deviceSteps <= 0) return false;
  if (serverSteps == null) return true;
  return deviceSteps > serverSteps;
}

/** Picks the step count to display when both device and server values exist. */
export function mergeSteps(
  deviceSteps: number | null | undefined,
  serverSteps: number | null | undefined
): number | null {
  if (deviceSteps == null) return serverSteps ?? null;
  if (serverSteps == null) return deviceSteps;
  return Math.max(deviceSteps, serverSteps);
}
