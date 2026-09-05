import { test, expect } from "bun:test";
import { saveMealEdits } from "../api/meal-edit";

test("type-only legacy meal edit preserves nutrition; explicit ingredient removal is saved", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; body: unknown }> = [];
  let calories = 450;
  globalThis.fetch = (async (url: unknown, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    calls.push({ url: String(url), body });
    if (String(url).endsWith("/ingredients")) calories = 0;
    return Response.json({ success: true, data: {} });
  }) as typeof fetch;
  try {
    await saveMealEdits("legacy", "test", { mealType: "dinner" });
    expect(calories).toBe(450);
    expect(calls.length).toBe(1);
    expect(calls[0].body).toEqual({ interpretationStatus: "reviewed", mealType: "dinner" });
    await saveMealEdits("legacy", "test", { ingredients: [] });
    expect(calories).toBe(0);
    expect(calls[1].url.endsWith("/ingredients")).toBe(true);
  } finally { globalThis.fetch = original; }
});

test("failed ingredient save does not mark the meal reviewed", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return Response.json({ success: false, error: "Unavailable" }, { status: 500 });
  }) as typeof fetch;
  try {
    await saveMealEdits("meal", "test", { ingredients: [] }).catch(() => undefined);
    expect(calls).toBe(1);
  } finally { globalThis.fetch = original; }
});
