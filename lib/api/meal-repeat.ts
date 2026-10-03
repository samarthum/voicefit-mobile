import { apiRequest } from "@/lib/api-client";

export interface SavedMealIngredient {
  id?: string;
  position?: number;
  name: string;
  grams: number | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG?: number | null;
}
export interface SavedMealRecord {
  id: string;
  description: string;
  mealType: string;
  eatenAt: string;
  calories: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  totalGrams?: number | null;
  interpretationStatus?: string | null;
  ingredients: SavedMealIngredient[];
}
export interface RepeatMealInput {
  requestId: string;
  portionMultiplier: number;
  eatenAt: string;
  mealType?: string;
}
export function parsePortionMultiplier(text: string): number | null {
  const value = text.trim();
  const number = Number(value);
  return /^\d*(?:\.\d+)?$/.test(value) && value.length > 0 && Number.isFinite(number) && number > 0 && number <= 20 ? number : null;
}
function scaled<T extends number | null | undefined>(value: T, multiplier: number): T {
  return (typeof value === "number" && Number.isFinite(value) ? value * multiplier : value) as T;
}
/** A preview only: same saved food, proportional amount, never an AI estimate. */
export function previewRepeatedMeal<T extends SavedMealRecord>(source: T, multiplier: number): T {
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 20) throw new Error("Choose a portion greater than zero and at most 20.");
  const nutrition = (row: Pick<SavedMealRecord, "calories" | "proteinG" | "carbsG" | "fatG">) => ({
    calories: scaled(row.calories, multiplier), proteinG: scaled(row.proteinG, multiplier),
    carbsG: scaled(row.carbsG, multiplier), fatG: scaled(row.fatG, multiplier),
  });
  return {...source, ...nutrition(source), totalGrams: scaled(source.totalGrams, multiplier),
    ingredients: source.ingredients.map(row => ({...row, ...nutrition(row), grams: scaled(row.grams, multiplier)}))};
}
export async function getSavedMeal(id: string, token: string): Promise<SavedMealRecord> {
  return apiRequest<SavedMealRecord>(`/api/meals/${encodeURIComponent(id)}`, {token});
}
export async function repeatSavedMeal(id: string, token: string, input: RepeatMealInput): Promise<SavedMealRecord> {
  return apiRequest<SavedMealRecord>(`/api/meals/${encodeURIComponent(id)}/repeat`, {method:"POST",token,body:JSON.stringify(input)});
}
export async function retryMealEstimate(id: string, token: string): Promise<SavedMealRecord> {
  return apiRequest<SavedMealRecord>(`/api/meals/${encodeURIComponent(id)}/retry`, {method:"POST",token,body:JSON.stringify({})});
}
