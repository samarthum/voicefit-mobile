import type { SavedMealIngredient } from "@/lib/api/meal-repeat";
import { apiRequest } from "@/lib/api-client";

/** One transaction: composition, classification and review status commit together.
 * Undefined preserves legacy scalar nutrition; [] explicitly removes all rows.
 * Totals are calculated by the server, never sent by the editor.
 */
export async function saveMealEdits<T = { id: string }>(
  id: string,
  token: string,
  edits: { ingredients?: SavedMealIngredient[]; mealType?: string; expectedUpdatedAt?: string },
): Promise<T> {
  return apiRequest<T>(`/api/meals/${encodeURIComponent(id)}`, {
    method: "PUT", token,
    body: JSON.stringify({ ...edits, interpretationStatus: "reviewed" }),
  });
}
