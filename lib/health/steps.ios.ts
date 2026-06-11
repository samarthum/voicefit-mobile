import { localDayRange, type HealthStepsAccess } from "./shared";

/**
 * Apple Health (HealthKit) implementation, read-only step counts via
 * @kingstinct/react-native-healthkit. The module is loaded lazily so the
 * app still boots in runtimes without the native module (e.g. Expo Go).
 */

export const healthSourceName: string | null = "Apple Health";

const STEP_COUNT = "HKQuantityTypeIdentifierStepCount" as const;

type HealthKitModule = typeof import("@kingstinct/react-native-healthkit");

let modulePromise: Promise<HealthKitModule | null> | null = null;

function getHealthKit(): Promise<HealthKitModule | null> {
  if (!modulePromise) {
    modulePromise = import("@kingstinct/react-native-healthkit").catch(() => null);
  }
  return modulePromise;
}

export async function checkHealthStepsAccess(): Promise<HealthStepsAccess> {
  const hk = await getHealthKit();
  if (!hk) return "unavailable";
  try {
    if (!hk.isHealthDataAvailable()) return "unavailable";
    const status = await hk.getRequestStatusForAuthorization({ toRead: [STEP_COUNT] });
    // "unnecessary" means the user has already answered the permission sheet.
    // HealthKit never reveals whether read access was granted; denied reads
    // simply return no data.
    return status === hk.AuthorizationRequestStatus.unnecessary ? "granted" : "prompt";
  } catch {
    return "unavailable";
  }
}

export async function requestHealthStepsPermission(): Promise<boolean> {
  const hk = await getHealthKit();
  if (!hk) return false;
  try {
    return await hk.requestAuthorization({ toRead: [STEP_COUNT] });
  } catch {
    return false;
  }
}

export async function getHealthStepsForDate(date: string): Promise<number | null> {
  const hk = await getHealthKit();
  if (!hk) return null;
  try {
    const { start, end } = localDayRange(date);
    const stats = await hk.queryStatisticsForQuantity(STEP_COUNT, ["cumulativeSum"], {
      filter: { date: { startDate: start, endDate: end } },
      unit: "count",
    });
    const total = stats.sumQuantity?.quantity;
    return typeof total === "number" ? Math.round(total) : null;
  } catch {
    return null;
  }
}
