export type AsyncMealStatus = "interpreting" | "needs_review" | "failed" | "reviewed";

export function normalizeMealStatus(
  interpretationStatus: unknown,
  calories?: number | null,
): AsyncMealStatus {
  if (interpretationStatus === "interpreting" || interpretationStatus === "pending") return "interpreting";
  if (interpretationStatus === "needs_review") return "needs_review";
  if (interpretationStatus === "failed" || interpretationStatus === "error") return "failed";
  if (interpretationStatus === "reviewed") return "reviewed";
  return calories == null ? "interpreting" : "reviewed";
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatNullableCalories(value: number | null | undefined) {
  return isFiniteNumber(value) ? Math.round(value).toLocaleString() : null;
}

export function roundNullable(value: number | null | undefined) {
  return isFiniteNumber(value) ? Math.round(value) : null;
}
