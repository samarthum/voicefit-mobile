import { describe, expect, test } from "bun:test";
import { localDayRange, mergeSteps, shouldSyncSteps } from "@/lib/health/shared";

describe("localDayRange", () => {
  test("covers the full local calendar day", () => {
    const { start, end } = localDayRange("2026-06-11");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(11);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  test("handles month boundaries", () => {
    const { end } = localDayRange("2026-01-31");
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(1);
  });

  test("throws on invalid date keys", () => {
    expect(() => localDayRange("not-a-date")).toThrow();
  });
});

describe("shouldSyncSteps", () => {
  test("syncs when the server has no value", () => {
    expect(shouldSyncSteps(5000, null)).toBe(true);
    expect(shouldSyncSteps(5000, undefined)).toBe(true);
  });

  test("syncs when the device count is ahead of the server", () => {
    expect(shouldSyncSteps(5000, 4200)).toBe(true);
  });

  test("does not sync when the server is ahead or equal", () => {
    expect(shouldSyncSteps(5000, 5000)).toBe(false);
    expect(shouldSyncSteps(5000, 6000)).toBe(false);
  });

  test("does not sync empty device readings", () => {
    expect(shouldSyncSteps(null, null)).toBe(false);
    expect(shouldSyncSteps(undefined, 100)).toBe(false);
    expect(shouldSyncSteps(0, null)).toBe(false);
  });
});

describe("mergeSteps", () => {
  test("prefers the larger of device and server values", () => {
    expect(mergeSteps(5000, 4200)).toBe(5000);
    expect(mergeSteps(4200, 5000)).toBe(5000);
  });

  test("falls back to whichever side has data", () => {
    expect(mergeSteps(null, 4200)).toBe(4200);
    expect(mergeSteps(5000, null)).toBe(5000);
    expect(mergeSteps(null, null)).toBeNull();
  });
});
