import type { MealReviewIngredient } from "./types";

/** Saved nutrition may be unknown; never turn null into a reported zero. */
export type EditableIngredient = Omit<MealReviewIngredient, "grams" | "calories" | "proteinG" | "carbsG" | "fatG"> & {
  grams: number | null; calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null;
};

/** Keep full precision in drafts. Round only presentation, never persisted rows. */
export function scaleEditedIngredient<T extends EditableIngredient>(ingredient: T, grams: number): T {
  if (!Number.isFinite(grams) || grams <= 0 || typeof ingredient.grams !== "number" || !Number.isFinite(ingredient.grams) || ingredient.grams <= 0) {
    throw new Error("A positive original and new portion are required to scale nutrition.");
  }
  const ratio = grams / ingredient.grams;
  const scale = (value: number | null) => value === null ? null : value * ratio;
  return { ...ingredient, grams, calories: scale(ingredient.calories),
    proteinG: scale(ingredient.proteinG), carbsG: scale(ingredient.carbsG), fatG: scale(ingredient.fatG) };
}
