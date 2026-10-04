import type { InterpretEntryResponse } from "@voicefit/contracts/types";
import { apiRequest } from "@/lib/api-client";
import { assertSingleWorkoutExercise, workoutEquipmentLabel } from "@/lib/workout-transcript";
import { color as token } from "@/lib/tokens";
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
} from "@/components/command-center/types";

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

// Words that only show up when describing food or drink. Anything matched
// here skips the synchronous classifier and becomes a pending meal right away
// (the "taking a look" path), so keep it specific: a false positive logs a
// non-meal as a meal, while a miss only costs a slower round trip.
const FOOD_WORDS = [
  // proteins
  "chicken", "beef", "pork", "lamb", "mutton", "goat", "fish", "salmon", "tuna", "prawn", "shrimp", "egg",
  "omelette", "omelet", "tofu", "paneer", "turkey", "bacon", "sausage", "ham", "steak", "keema", "kebab",
  "kabab", "tikka",
  // grains, breads & mains
  "rice", "pasta", "noodle", "bread", "toast", "roti", "chapati", "chapatti", "phulka", "naan", "paratha",
  "parotta", "poori", "puri", "dosa", "idli", "idly", "upma", "poha", "uttapam", "vada", "khichdi", "biryani",
  "pulao", "oats", "oatmeal", "porridge", "cereal", "granola", "muesli", "quinoa", "potato", "fries", "bagel",
  "croissant", "muffin", "pancake", "waffle", "tortilla", "wrap", "sandwich", "burger", "pizza", "sushi",
  "taco", "burrito", "bowl", "salad", "soup", "curry", "dal", "daal", "dhal", "sambar", "rasam", "chole",
  "chana", "rajma", "sabzi", "sabji", "thali", "momo", "dumpling", "ramen", "pho",
  // dairy
  "yogurt", "yoghurt", "curd", "dahi", "raita", "cheese", "milk", "ghee", "lassi", "buttermilk", "chaas",
  // fruit & veg
  "apple", "banana", "orange", "mango", "grape", "berry", "berries", "strawberry", "blueberry", "watermelon", "papaya",
  "pineapple", "avocado", "dates", "fruit", "vegetable", "veggie", "broccoli", "spinach",
  // snacks & sweets
  "biscuit", "cookie", "cracker", "nut", "almond", "cashew", "peanut", "chocolate", "cake", "brownie",
  "ice cream", "ladoo", "laddu", "halwa", "jamun", "samosa", "pakora", "bhaji", "dhokla", "chaat", "bhel",
  "popcorn", "chips",
  // drinks
  "smoothie", "shake", "coffee", "latte", "cappuccino", "espresso", "tea", "chai", "juice", "coke", "soda",
  "beer", "wine", "kombucha",
];
const FOOD_PATTERN = new RegExp(`\\b(${FOOD_WORDS.join("|")})(s|es)?\\b`);

/** Questions go to Coach (pre-filled), never through the logger. */
export function isLikelyQuestion(text: string) {
  const raw = text.trim();
  if (!raw) return false;
  if (raw.endsWith("?")) return true;
  const value = raw.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  return /^(what|when|how|why|did|do|does|can|could|should|would|is|am|are|was|were|which|who|where|tell me|show me|give me|explain|compare|remind me)\b/.test(value);
}

export function isLikelyMealEntry(text: string) {
  const raw = text.trim();
  const value = raw.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!value) return false;

  // Anything that might be a workout or a metric goes to the classifier.
  // Erring broad here is cheap: it only means a slower, still-correct path.
  const workoutOrMetricPatterns = [
    /\b(bench|squat|deadlift|curl|press|row|rowing|pull[-\s]?ups?|push[-\s]?ups?|chin[-\s]?ups?|plank|lunges?|dips|crunch(es)?|burpees?|sit[-\s]?ups?)\b/,
    /\b(run|ran|running|jog|jogged|jogging|walk|walked|walking|hike|hiked|hiking|swim|swam|swimming|cycle|cycled|cycling|bike|biked|spin|yoga|pilates|elliptical|treadmill|stretch(ed|ing)?|hiit|zumba|gym|cardio|workout|exercise|trained|training)\b/,
    /\b(rep|reps|set|sets|kg|kgs|lb|lbs|km|kms|miles?|mins?|minutes?)\b/,
    /\b(steps?|weigh(ed)?|weight|bodyweight|slept|sleep)\b/,
  ];
  if (workoutOrMetricPatterns.some((pattern) => pattern.test(value))) return false;

  if (isLikelyQuestion(raw)) return false;

  const mealPatterns = [
    /\b(ate|eaten|eat|had|having|drank|drink|drinking)\b/,
    /\b(breakfast|brunch|lunch|dinner|supper|snack|meal|dessert)\b/,
    // Macro words alone ("calories left today") are not a meal; let the
    // (fast) classifier decide those.
    FOOD_PATTERN,
  ];

  return mealPatterns.some((pattern) => pattern.test(value));
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

const UNIT_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS_WORDS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const UNIT_RE = Object.keys(UNIT_WORDS).join("|");
const ONE_TO_NINE_RE = "one|two|three|four|five|six|seven|eight|nine";
const SMALL_NUMBER_RE = `(?:(?:${Object.keys(TENS_WORDS).join("|")})(?:[\\s-]+(?:${ONE_TO_NINE_RE}))?|${UNIT_RE})`;
// Deliberately narrow grammar ("sixty-five", "a hundred and ten") so adjacent
// quantities such as "ten and two sets" are never merged into one number.
const SPOKEN_NUMBER = new RegExp(
  `\\b(?:(?:${ONE_TO_NINE_RE}|a)\\s+hundred(?:\\s+(?:and\\s+)?${SMALL_NUMBER_RE})?|${SMALL_NUMBER_RE})\\b`,
  "gi",
);

/** Transcription often spells quantities out; the set parser reads digits. */
export function spokenNumbersToDigits(text: string) {
  return text.replace(SPOKEN_NUMBER, (phrase) => {
    let value = 0;
    for (const word of phrase.toLowerCase().split(/[\s-]+/)) {
      if (word === "and") continue;
      if (word === "a") value = 1;
      else if (word === "hundred") value = (value || 1) * 100;
      else value += TENS_WORDS[word] ?? UNIT_WORDS[word] ?? 0;
    }
    return String(value);
  });
}

export function parseWorkoutSetsFromTranscript(rawTranscript: string) {
  const transcript = spokenNumbersToDigits(rawTranscript);
  // Whole groups take precedence over nested rep/weight phrases. Unit
  // normalization happens ONLY here, on raw explicitly-unit-labelled weights;
  // interpreted.payload.weightKg is already normalized and is never converted.
  const groups: Array<{ start: number; end: number; count: number; weightKg: string; reps: string; notes: string }> = [];
  const unit = "(kgs?|kilograms?|kilos?|lbs?|pounds?)";
  const patterns = [
    { regex: new RegExp(`(\\d+)\\s*sets?\\s*(?:of|x|×)\\s*(?:[a-z][a-z\\s-]*,\\s*)?(\\d+)\\s*(?:reps?\\b\\s*)?(?:(?:at|@)\\s*(\\d+(?:\\.\\d+)?)\\s*${unit}?)?`, "gi"), count: 1, reps: 2, weight: 3, unit: 4 },
    { regex: /(\d+)\s*[x×]\s*(\d+)\b(?:\s*(?:at|@)\s*(\d+(?:\.\d+)?)\s*(kgs?|kilograms?|kilos?|lbs?|pounds?))?/gi, count: 1, reps: 2, weight: 3, unit: 4 },
    { regex: new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}\\s*(?:for|x|×)\\s*(\\d+)`, "gi"), count: 0, reps: 3, weight: 1, unit: 2 },
    { regex: new RegExp(`(\\d+)\\s*(?:reps?)?\\s*(?:at|@)\\s*(\\d+(?:\\.\\d+)?)\\s*${unit}?`, "gi"), count: 0, reps: 1, weight: 2, unit: 3 },
  ];
  for (const pattern of patterns) {
    for (const match of transcript.matchAll(pattern.regex)) {
      const start = match.index!;
      const end = start + match[0].length;
      if (groups.some((group) => start < group.end && end > group.start)) continue;
      const weight = match[pattern.weight] ?? "";
      const originalUnit = match[pattern.unit] ?? "";
      const pounds = /^(lb|pound)/i.test(originalUnit);
      const weightKg = !originalUnit ? "" : pounds ? String(Number((Number(weight) * 0.45359237).toPrecision(15))) : weight;
      groups.push({ start, end, count: pattern.count ? Number(match[pattern.count]) : 1, reps: match[pattern.reps], weightKg, notes: pounds ? `Original: ${weight} ${originalUnit}` : "" });
    }
  }
  if (groups.some((group) => group.count < 1 || !Number.isSafeInteger(group.count)) || groups.reduce((sum, group) => sum + group.count, 0) > 100) {
    throw new Error("Log between 1 and 100 sets at a time. Split this entry and try again.");
  }
  const results = groups.sort((a, b) => a.start - b.start).flatMap((group) =>
    Array.from({ length: group.count }, () => group),
  );

  return results.map((r, index) => ({
    id: `set-${index + 1}`,
    setNumber: index + 1,
    weightKg: r.weightKg,
    reps: r.reps,
    notes: r.notes,
  }));
}

export function buildWorkoutReviewDraft(
  interpreted: Extract<InterpretEntryResponse, { intent: "workout_set" }>,
  transcript: string,
  source: EntrySource,
): WorkoutReviewDraft {
  assertSingleWorkoutExercise(transcript, interpreted.payload.exerciseName);
  const parsedSets = parseWorkoutSetsFromTranscript(transcript);
  const fallbackSet: WorkoutReviewSet = {
    id: "set-1",
    setNumber: 1,
    weightKg: interpreted.payload.weightKg == null ? "" : String(interpreted.payload.weightKg),
    reps: interpreted.payload.reps == null ? "" : String(interpreted.payload.reps),
    notes: interpreted.payload.notes ?? "",
  };
  // Homogeneous raw groups share the interpreted, already-normalized weight.
  // Heterogeneous explicitly labelled groups need their individual raw values.
  const normalizedWeight = interpreted.payload.weightKg;
  if (normalizedWeight != null && parsedSets.length && parsedSets.every((set) => set.weightKg !== "" && set.weightKg === parsedSets[0].weightKg)) {
    for (const set of parsedSets) set.weightKg = String(normalizedWeight);
  }
  const sets = parsedSets.length ? parsedSets : [fallbackSet];

  return {
    kind: "workout",
    interpreted,
    transcript,
    source,
    confidence: interpreted.payload.confidence,
    exerciseTypeLabel: workoutEquipmentLabel(interpreted.payload.exerciseName, interpreted.payload.exerciseType),
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
  if (!recentMeals?.length) return [];
  const items = recentMeals
    .filter((meal) => meal.calories != null)
    .slice(0, 5)
    .map((meal) => ({
      id: meal.id,
      description: meal.description,
      calories: meal.calories ?? 0,
      mealType: meal.mealType,
    }));
  return items;
}

// ---------------------------------------------------------------------------
// Error copy
// ---------------------------------------------------------------------------

export const ERROR_COPY: Record<
  Exclude<CommandErrorSubtype, null>,
  { title: string; body: string; primary: string; secondary: string | null; tertiary: string | null }
> = {
  typed_interpret_failure: {
    title: "Couldn't log that",
    body: "Check the wording and try again.",
    primary: "Try again",
    secondary: "Edit text",
    tertiary: "Discard",
  },
  voice_interpret_failure: {
    title: "Didn't quite catch that",
    body: "Try again, or edit what we heard.",
    primary: "Try again",
    secondary: "Edit text",
    tertiary: "Discard",
  },
  photo_interpret_failure: {
    title: "Couldn't submit that photo",
    body: "Keep the photo and try again, or choose a different entry method.",
    primary: "Try again",
    secondary: "Type instead",
    tertiary: "Discard",
  },
  mic_permission_denied: {
    title: "Microphone is off",
    body: "Turn on microphone access in Settings to log by voice.",
    primary: "Open Settings",
    secondary: "Type instead",
    tertiary: "Discard",
  },
  photo_permission_denied: {
    title: "Photo access is off",
    body: "Turn on camera or photo access in Settings to log meals by photo.",
    primary: "Open Settings",
    secondary: "Type instead",
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
