import type { MealIngredient } from "@voicefit/contracts/types";
import { apiRequest } from "../api-client";

/**
 * Resolves a (name, grams) pair into authoritative macros via the
 * /api/interpret/ingredient endpoint. The route runs an LLM with extended
 * thinking + tools, so wall time is 5-15s — we extend the api-client timeout
 * to 30s.
 *
 * Shared by the command-center review sheet (pre-save) and the meals tab
 * post-save edit screen. Caller is responsible for providing a valid Clerk
 * Bearer token (resolve via `useAuth().getToken()` or equivalent before
 * calling).
 */
export async function fetchInterpretedIngredient(
  token: string | null,
  name: string,
  grams?: number,
): Promise<MealIngredient> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Name is required");
  if (!token) throw new Error("Not signed in");

  return apiRequest<MealIngredient>("/api/interpret/ingredient", {
    method: "POST",
    token,
    timeoutMs: 30_000,
    body: JSON.stringify({
      name: trimmedName,
      ...(grams != null ? { grams } : {}),
    }),
  });
}
