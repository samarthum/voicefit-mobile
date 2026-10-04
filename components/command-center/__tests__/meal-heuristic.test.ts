import { describe, expect, test } from "bun:test";
import { isLikelyMealEntry } from "@/components/command-center/helpers";

// The heuristic decides which entries skip the synchronous classifier and go
// straight to the async "estimating" meal path. Misses are slow but correct;
// false positives log a non-meal as a meal, so those cases matter most.
describe("isLikelyMealEntry", () => {
  const meals = [
    "masala chai and two marie biscuits",
    "Two idlis with sambar and coconut chutney",
    "2 rotis with dal and a bowl of curd",
    "paneer tikka",
    "a bowl of greek yogurt with honey",
    "chicken biryani for dinner",
    "black coffee",
    "handful of almonds",
    "peanut butter toast",
    "a slice of chocolate cake",
    "I had a banana",
    "ice cream",
  ];
  for (const text of meals) {
    test(`meal: ${text}`, () => {
      expect(isLikelyMealEntry(text)).toBe(true);
    });
  }

  const notMeals = [
    "bench press 80kg for 8 reps",
    "3 sets of pull-ups",
    "went for a 5 km run",
    "had a long walk after dinner",
    "30 minutes on the elliptical",
    "yoga class",
    "12345 steps",
    "weight 72.4 kg",
    "Is 2000 calories enough?",
    "how much protein did I eat today",
    "What should I eat for dinner",
    "slept 7 hours",
    "",
  ];
  for (const text of notMeals) {
    test(`not a meal: ${text || "(empty)"}`, () => {
      expect(isLikelyMealEntry(text)).toBe(false);
    });
  }
});
