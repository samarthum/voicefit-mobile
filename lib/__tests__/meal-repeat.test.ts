import { test, expect } from "bun:test";
import { previewRepeatedMeal, parsePortionMultiplier, getSavedMeal, repeatSavedMeal, retryMealEstimate } from "../api/meal-repeat";

const source = { id: "source", description: "Oats", mealType: "breakfast", eatenAt: "2026-10-01T08:00:00Z", calories: 250.5, proteinG: null, carbsG: 30.25, fatG: undefined, totalGrams: 100.25, ingredients: [{id:"row",position:0,name:"Oats",grams:100.25,calories:250.5,proteinG:null,carbsG:30.25,fatG:null}] };
test("same-food preview scales exact saved ingredients and preserves unknown macros", () => {
  const result = previewRepeatedMeal(source, 0.5);
  expect(result.calories).toBe(125.25);
  expect(result.totalGrams).toBe(50.125);
  expect(result.proteinG).toBeNull();
  expect(result.fatG).toBe(undefined);
  expect(result.ingredients[0]).toEqual({...source.ingredients[0],grams:50.125,calories:125.25,carbsG:15.125});
  expect(source.ingredients[0].grams).toBe(100.25);
});
test("custom portions reject blank, negative, nonfinite and malformed numbers", () => {
  for (const value of ["", "0", "-1", "Infinity", "1.2.3", "1e2", "20.001", "21"]) expect(parsePortionMultiplier(value)).toBeNull();
  expect(parsePortionMultiplier("1.25")).toBe(1.25);
});
test("real API wrappers use owned detail, repeat UUID payload only, and same-record estimate retry", async () => {
  const original = globalThis.fetch;
  const calls: Array<{url: string; method: string; body: unknown}> = [];
  const canonical = {...source, id:"new-id", ingredients:source.ingredients, fatG:null};
  globalThis.fetch = (async (url: unknown, options: RequestInit) => {
    calls.push({url:String(url),method:options.method ?? "GET",body:options.body ? JSON.parse(String(options.body)) : null});
    return Response.json({success:true,data:String(url).endsWith("/repeat") ? canonical : {...source,fatG:null}});
  }) as typeof fetch;
  try {
    const details = await getSavedMeal("source", "test");
    expect(details.ingredients).toEqual(source.ingredients);
    const input = {requestId:"00000000-0000-4000-8000-000000000001",portionMultiplier:0.5,eatenAt:"2026-10-02T12:00:00Z",mealType:"lunch"};
    expect(await repeatSavedMeal("source", "test", input)).toEqual(canonical);
    await retryMealEstimate("source", "test");
    expect(calls.map(c=>new URL(c.url).pathname)).toEqual(["/api/meals/source","/api/meals/source/repeat","/api/meals/source/retry"]);
    expect(calls[1].body).toEqual(input);
    expect(calls[1].method).toBe("POST");
    expect(calls[2].body).toEqual({});
  } finally { globalThis.fetch = original; }
});
