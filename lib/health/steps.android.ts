import { localDayRange, type HealthStepsAccess } from "./shared";

/**
 * Android Health Connect implementation, read-only step counts via
 * react-native-health-connect. The module is loaded lazily so the app
 * still boots in runtimes without the native module (e.g. Expo Go).
 */

export const healthSourceName: string | null = "Health Connect";

type HealthConnectModule = typeof import("react-native-health-connect");

let modulePromise: Promise<HealthConnectModule | null> | null = null;
let initializePromise: Promise<boolean> | null = null;

function getHealthConnect(): Promise<HealthConnectModule | null> {
  if (!modulePromise) {
    modulePromise = import("react-native-health-connect").catch(() => null);
  }
  return modulePromise;
}

function ensureInitialized(hc: HealthConnectModule): Promise<boolean> {
  if (!initializePromise) {
    initializePromise = (async () => {
      const status = await hc.getSdkStatus();
      if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
      return hc.initialize();
    })().catch(() => {
      initializePromise = null;
      return false;
    });
  }
  return initializePromise;
}

export async function checkHealthStepsAccess(): Promise<HealthStepsAccess> {
  const hc = await getHealthConnect();
  if (!hc) return "unavailable";
  try {
    if (!(await ensureInitialized(hc))) return "unavailable";
    const granted = await hc.getGrantedPermissions();
    const hasSteps = granted.some(
      (permission) =>
        permission.recordType === "Steps" && permission.accessType === "read"
    );
    return hasSteps ? "granted" : "prompt";
  } catch {
    return "unavailable";
  }
}

export async function requestHealthStepsPermission(): Promise<boolean> {
  const hc = await getHealthConnect();
  if (!hc) return false;
  try {
    if (!(await ensureInitialized(hc))) return false;
    const granted = await hc.requestPermission([
      { accessType: "read", recordType: "Steps" },
    ]);
    return granted.some(
      (permission) =>
        permission.recordType === "Steps" && permission.accessType === "read"
    );
  } catch {
    return false;
  }
}

export async function getHealthStepsForDate(date: string): Promise<number | null> {
  const hc = await getHealthConnect();
  if (!hc) return null;
  try {
    if (!(await ensureInitialized(hc))) return null;
    const { start, end } = localDayRange(date);
    const result = await hc.aggregateRecord({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    const total = result.COUNT_TOTAL;
    return typeof total === "number" ? Math.round(total) : null;
  } catch {
    return null;
  }
}

export async function openHealthSettings(): Promise<boolean> {
  const hc = await getHealthConnect();
  if (!hc) return false;
  try {
    hc.openHealthConnectSettings();
    return true;
  } catch {
    return false;
  }
}
