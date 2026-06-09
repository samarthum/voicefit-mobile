import { describe, expect, test } from "bun:test";
import {
  getCoachToolLabel,
  getToolLineState,
} from "@/components/coach/coach-tool-line";

describe("getCoachToolLabel", () => {
  test("uses the label field from tool args when present", () => {
    expect(
      getCoachToolLabel("query_meals", { label: "Looking at your meals" })
    ).toBe("Looking at your meals");
  });

  test("falls back to a humanized tool name when label is missing", () => {
    expect(getCoachToolLabel("query_workout_sessions", {})).toBe(
      "query workout sessions"
    );
  });

  test("falls back when args are not an object (partial stream)", () => {
    expect(getCoachToolLabel("daily_summary", undefined)).toBe("daily summary");
    expect(getCoachToolLabel("daily_summary", null)).toBe("daily summary");
    expect(getCoachToolLabel("daily_summary", "oops")).toBe("daily summary");
  });

  test("ignores non-string or blank labels", () => {
    expect(getCoachToolLabel("compare_periods", { label: 42 })).toBe(
      "compare periods"
    );
    expect(getCoachToolLabel("compare_periods", { label: "   " })).toBe(
      "compare periods"
    );
  });
});

describe("getToolLineState", () => {
  test("maps assistant-ui part statuses onto the three line states", () => {
    expect(getToolLineState("running")).toBe("running");
    expect(getToolLineState("complete")).toBe("done");
    expect(getToolLineState("incomplete")).toBe("pending");
    expect(getToolLineState("requires-action")).toBe("pending");
  });
});
