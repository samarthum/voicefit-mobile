import type { InterpretEntryResponse } from "@voicefit/contracts/types";
import { apiRequest } from "../../lib/api-client";
import { color as token } from "../../lib/tokens";
import type {
  CommandErrorSubtype,
  EntrySource,
  MealReviewDraft,
  MealReviewIngredient,
  QuickAddItem,
  RecentMeal,
  WorkoutReviewDraft,
  WorkoutReviewSet,
  WorkoutSessionsResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Legacy color bridge — mapped onto the Pulse design tokens so every existing
// screen that imports COLORS instantly cascades to the dark theme. Prefer
// importing from `lib/tokens.ts` directly in new code.
export const COLORS = {
  bg: token.bg,
  surface: token.surface,
  border: token.line,
  textPrimary: token.text,
  textSecondary: token.textSoft,
  textTertiary: token.textMute,
  calories: token.accent,
  steps: token.positive,
  weight: token.accent,
  error: token.negative,
  ringTrack: token.accentRingTrack,
  black: token.accent,
  accent: token.accent,
  accentInk: token.accentInk,
  surface2: token.surface2,
  line: token.line,
  line2: token.line2,
};

export const MIN_RECORDING_DURATION_MS = 1000;
export const WEB_PREVIEW_FLAGS_KEY = "__vf_home_preview_flags";
export const WAVE_BAR_COUNT = 20;
export const WAVE_MIN = 8;
export const WAVE_MAX = 56;

export const DEFAULT_QUICK_ADD: QuickAddItem[] = [
  { id: "default-1", description: "Chicken Salad", calories: 420, mealType: "lunch" },
  { id: "default-2", description: "Overnight Oats", calories: 320, mealType: "breakfast" },
  { id: "default-3", description: "Grilled Salmon & Rice", calories: 580, mealType: "dinner" },
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function toLocalDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatClockTime(value: Date) {
  return value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatRecordingDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatMealTypeLabel(mealType: string) {
  if (!mealType) return "Meal";
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

export function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return { text: "High confidence", color: COLORS.steps, bg: "rgba(52,199,89,0.12)" };
  if (confidence >= 0.75) return { text: "Medium confidence", color: "#FF9500", bg: "rgba(255,149,0,0.12)" };
  return { text: "Low confidence", color: COLORS.error, bg: "rgba(255,59,48,0.12)" };
}

export function parsePositiveNumber(value: string) {
  const num = Number(value.trim());
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Meal helpers
// ---------------------------------------------------------------------------

/**
 * Stable, locally-unique ID for an ingredient row in the in-memory review
 * draft. Never serialized over the wire — only used as a React key and as a
 * lookup target for edit/delete operations. Robust under reorder/delete
 * (unlike the index-based Phase 2 IDs).
 */
export function generateIngredientId() {
  return `ing_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildMealReviewDraft(
  interpreted: Extract<InterpretEntryResponse, { intent: "meal" }>,
  transcript: string,
  source: EntrySource,
): MealReviewDraft {
  const payload = interpreted.payload;
  const ingredients: MealReviewIngredient[] = payload.ingredients.map((ing) => ({
    id: generateIngredientId(),
    name: ing.name,
    grams: ing.grams,
    calories: ing.calories,
    proteinG: ing.proteinG,
    carbsG: ing.carbsG,
    fatG: ing.fatG,
  }));

  return {
    kind: "meal",
    interpreted,
    transcript,
    source,
    eatenAtLabel: formatClockTime(new Date()),
    totalGrams: payload.totalGrams,
    ingredients,
    macros: {
      protein: payload.proteinG,
      carbs: payload.carbsG,
      fat: payload.fatG,
    },
  };
}

/**
 * Recomputes a meal review draft's totals (calories, macros, totalGrams)
 * from its current ingredient list. Pure — call this after any ingredient
 * mutation. Also keeps `interpreted.payload` in sync so the existing save
 * path (which reads from interpreted.payload) writes the user's edits to DB.
 */
export function recalculateMealTotals(draft: MealReviewDraft): MealReviewDraft {
  const totals = draft.ingredients.reduce(
    (acc, ing) => {
      acc.grams += ing.grams;
      acc.calories += ing.calories;
      acc.protein += ing.proteinG;
      acc.carbs += ing.carbsG;
      acc.fat += ing.fatG;
      return acc;
    },
    { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const totalGrams = Math.round(totals.grams);
  const calories = Math.round(totals.calories);
  const proteinG = Math.round(totals.protein);
  const carbsG = Math.round(totals.carbs);
  const fatG = Math.round(totals.fat);

  return {
    ...draft,
    totalGrams,
    macros: { protein: proteinG, carbs: carbsG, fat: fatG },
    interpreted: {
      ...draft.interpreted,
      payload: {
        ...draft.interpreted.payload,
        totalGrams,
        calories,
        proteinG,
        carbsG,
        fatG,
        ingredients: draft.ingredients.map((ing) => ({
          name: ing.name,
          grams: ing.grams,
          calories: ing.calories,
          proteinG: ing.proteinG,
          carbsG: ing.carbsG,
          fatG: ing.fatG,
        })),
      },
    },
  };
}

/**
 * Linearly scales an ingredient's macros when grams change without a name
 * change. Falls back to zeroed macros if the original grams is non-positive
 * (a defensive case — shouldn't happen for LLM-returned rows). Rounds to
 * integers for display parity with the rest of the macro UI.
 */
export function scaleIngredientByGrams(
  ingredient: MealReviewIngredient,
  newGrams: number,
): MealReviewIngredient {
  if (!Number.isFinite(newGrams) || newGrams <= 0) return ingredient;
  if (ingredient.grams <= 0) {
    return { ...ingredient, grams: newGrams, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  }
  const ratio = newGrams / ingredient.grams;
  return {
    ...ingredient,
    grams: newGrams,
    calories: Math.round(ingredient.calories * ratio),
    proteinG: Math.round(ingredient.proteinG * ratio),
    carbsG: Math.round(ingredient.carbsG * ratio),
    fatG: Math.round(ingredient.fatG * ratio),
  };
}

// ---------------------------------------------------------------------------
// Workout helpers
// ---------------------------------------------------------------------------

function parseWorkoutSetsFromTranscript(transcript: string) {
  const kgFirst = [...transcript.matchAll(/(\d+(?:\.\d+)?)\s*(?:kg|kgs?|kilograms?)\s*(?:for|x|×)\s*(\d+)/gi)];
  const repsFirst = [...transcript.matchAll(/(\d+)\s*(?:reps?)?\s*(?:at|@)\s*(\d+(?:\.\d+)?)\s*(?:kg|kgs?|kilograms?)?/gi)];
  const setsOf = [...transcript.matchAll(/(\d+)\s*(?:sets?\s*(?:of|x|×))\s*(\d+)\s*(?:(?:at|@)\s*(\d+(?:\.\d+)?))?/gi)];

  const results: Array<{ weightKg: string; reps: string }> = [];
  for (const m of kgFirst) results.push({ weightKg: m[1], reps: m[2] });
  for (const m of repsFirst) results.push({ weightKg: m[2], reps: m[1] });
  for (const m of setsOf) {
    const setCount = Number(m[1]);
    const reps = m[2];
    const weight = m[3] ?? "";
    for (let i = 0; i < Math.min(setCount, 8); i++) results.push({ weightKg: weight, reps });
  }

  if (!results.length) return [];
  return results.slice(0, 8).map((r, index) => ({
    id: `set-${index + 1}`,
    setNumber: index + 1,
    weightKg: r.weightKg,
    reps: r.reps,
    notes: "",
  }));
}

export function buildWorkoutReviewDraft(
  interpreted: Extract<InterpretEntryResponse, { intent: "workout_set" }>,
  transcript: string,
  source: EntrySource,
): WorkoutReviewDraft {
  const parsedSets = parseWorkoutSetsFromTranscript(transcript);
  const fallbackSet: WorkoutReviewSet = {
    id: "set-1",
    setNumber: 1,
    weightKg: interpreted.payload.weightKg == null ? "" : String(interpreted.payload.weightKg),
    reps: interpreted.payload.reps == null ? "" : String(interpreted.payload.reps),
    notes: interpreted.payload.notes ?? "",
  };
  const sets = parsedSets.length ? parsedSets : [fallbackSet];

  return {
    kind: "workout",
    interpreted,
    transcript,
    source,
    confidence: interpreted.payload.confidence,
    exerciseTypeLabel: interpreted.payload.exerciseType === "resistance" ? "BARBELL" : "CARDIO",
    sessionLabel: "New Session",
    sets,
  };
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export async function ensureQuickSession(token: string) {
  const date = toLocalDateString(new Date());
  const list = await apiRequest<WorkoutSessionsResponse>(
    `/api/workout-sessions?date=${date}&limit=5`,
    { token },
  );
  const active = list.sessions.find((session) => !session.endedAt);
  if (active) return active.id;

  const created = await apiRequest<{ id: string }>("/api/workout-sessions", {
    method: "POST",
    token,
    body: JSON.stringify({ title: "Quick Log" }),
  });
  return created.id;
}

// ---------------------------------------------------------------------------
// Web preview helpers
// ---------------------------------------------------------------------------

export function hasWebPreviewFlag(flag: string) {
  if (!__DEV__ || typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(WEB_PREVIEW_FLAGS_KEY) ?? "";
    return raw.split(",").map((v) => v.trim()).filter(Boolean).includes(flag);
  } catch {
    return false;
  }
}

function titleCaseWords(value: string) {
  return value.split(/\s+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export function inferMealDescription(transcript: string) {
  const text = transcript.toLowerCase();
  if (text.includes("overnight oats")) return "Overnight Oats";
  if (text.includes("protein shake") || text.includes("shake")) return "Protein Shake";
  if (text.includes("salmon") && text.includes("rice")) return "Grilled Salmon & Rice";
  if (text.includes("chicken") && text.includes("rice")) return "Chicken salad with rice";
  if (text.includes("chicken") && text.includes("salad")) return "Chicken Salad";
  if (text.includes("oat")) return "Overnight Oats";
  const words = transcript.replace(/[^a-z0-9\s]/gi, " ").trim().split(/\s+/).slice(0, 4).join(" ");
  return words ? titleCaseWords(words) : "Chicken Salad";
}

export function inferMealType(transcript: string) {
  const text = transcript.toLowerCase();
  if (text.includes("breakfast")) return "breakfast";
  if (text.includes("dinner")) return "dinner";
  if (text.includes("snack")) return "snack";
  return "lunch";
}

export function inferCalories(transcript: string) {
  const match = transcript.match(/(\d{2,4})\s*(?:k?cal|calories?)/i);
  if (!match) return 450;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 450;
  return Math.max(80, value);
}

// ---------------------------------------------------------------------------
// Quick-add items from dashboard data
// ---------------------------------------------------------------------------

export function buildQuickAddItems(recentMeals: RecentMeal[] | undefined): QuickAddItem[] {
  if (!recentMeals?.length) return DEFAULT_QUICK_ADD;
  return recentMeals.slice(0, 5).map((meal) => ({
    id: meal.id,
    description: meal.description,
    calories: meal.calories,
    mealType: meal.mealType,
  }));
}

// ---------------------------------------------------------------------------
// Error copy
// ---------------------------------------------------------------------------

export const ERROR_COPY: Record<
  Exclude<CommandErrorSubtype, null>,
  { title: string; body: string; primary: string; secondary: string | null; tertiary: string | null }
> = {
  typed_interpret_failure: {
    title: "Couldn't understand that entry",
    body: "Edit your text and try again.",
    primary: "Retry typed",
    secondary: "Edit text",
    tertiary: "Discard",
  },
  voice_interpret_failure: {
    title: "Couldn't understand your recording",
    body: "Retry voice or edit the transcript.",
    primary: "Retry voice",
    secondary: "Edit text",
    tertiary: "Discard",
  },
  mic_permission_denied: {
    title: "Microphone access is off",
    body: "Enable microphone in Settings to log by voice.",
    primary: "Open Settings",
    secondary: "Use typing instead",
    tertiary: "Discard",
  },
  auto_save_failure: {
    title: "Couldn't save right now",
    body: "We kept your entry. Try saving again.",
    primary: "Retry save",
    secondary: "Discard",
    tertiary: null,
  },
  quick_add_failure: {
    title: "Couldn't add that item",
    body: "Please try again.",
    primary: "Retry save",
    secondary: "Discard",
    tertiary: null,
  },
};
