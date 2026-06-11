import type { HealthStepsAccess } from "./shared";

/**
 * Fallback implementation for platforms without a device health store
 * (web, and any runtime where the native modules are unavailable).
 * Metro picks steps.ios.ts / steps.android.ts on native builds.
 */

export const healthSourceName: string | null = null;

export async function checkHealthStepsAccess(): Promise<HealthStepsAccess> {
  return "unavailable";
}

export async function requestHealthStepsPermission(): Promise<boolean> {
  return false;
}

export async function getHealthStepsForDate(_date: string): Promise<number | null> {
  return null;
}
