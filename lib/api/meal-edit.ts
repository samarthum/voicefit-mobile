import type { MealIngredient } from "@voicefit/contracts/types";
import { apiRequest } from "@/lib/api-client";

export async function saveMealEdits(
  id: string,
  token: string,
  edits: { ingredients?: MealIngredient[]; mealType?: string },
) {
  // Undefined means unchanged. An explicit empty array means the user removed
  // every ingredient, and must still be sent to the nutrition endpoint.
  if (edits.ingredients !== undefined) {
    await apiRequest(`/api/meals/${id}/ingredients`, {
      method: "PUT", token, body: JSON.stringify({ ingredients: edits.ingredients }),
    });
  }
  // Mark reviewed only after the ingredient update succeeds.
  await apiRequest(`/api/meals/${id}`, {
    method: "PUT", token,
    body: JSON.stringify({ interpretationStatus: "reviewed", mealType: edits.mealType }),
  });
}
