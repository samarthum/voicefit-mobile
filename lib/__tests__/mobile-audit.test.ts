import { initialMealDate } from "../meal-history";
import { describe, expect, test } from "bun:test";
import { buildSparklinePath } from "../sparkline";
import { buildQuickAddItems } from "../../components/command-center/helpers";
import { color } from "../tokens";

describe("weight chart truthfulness", () => {
  test("does not invent a trend without two measurements", () => {
    expect(buildSparklinePath([])).toBe("");
    expect(buildSparklinePath([null, 72, null])).toBe("");
    expect(buildSparklinePath([NaN, Infinity])).toBe("");
  });
  test("preserves missing-day gaps", () => {
    const path = buildSparklinePath([72, null, 71]);
    expect(path.match(/M/g)?.length).toBe(2);
    expect(path).not.toContain("L");
  });
  test("constant weight is flat and a decrease retains the measured direction", () => {
    expect(buildSparklinePath([72, 72])).toBe("M2.00 9.00 L118.00 9.00");
    expect(buildSparklinePath([72, 71])).toBe("M2.00 2.00 L118.00 16.00");
  });
});

describe("recent meals", () => {
  test("empty history never becomes fabricated personal suggestions", () => {
    expect(buildQuickAddItems(undefined)).toEqual([]);
    expect(buildQuickAddItems([])).toEqual([]);
  });
});

function luminance(hex: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const aa = luminance(a), bb = luminance(b);
  return (Math.max(aa, bb) + 0.05) / (Math.min(aa, bb) + 0.05);
}
test("small secondary labels and primary button text have readable contrast", () => {
  expect(contrast(color.textMute, color.bg) >= 4.5).toBe(true);
  expect(contrast(color.accentInk, color.accent) >= 4.5).toBe(true);
});

 test("meal deep links accept real dates and reject impossible or future days", () => {
  const today = "2026-09-05";
  expect(initialMealDate("2026-09-04", today)).toBe("2026-09-04");
  expect(initialMealDate("2026-02-30", today)).toBe(today);
  expect(initialMealDate("2026-09-06", today)).toBe(today);
  expect(initialMealDate("garbage", today)).toBe(today);
  expect(initialMealDate(["2026-09-04"], today)).toBe(today);
});
