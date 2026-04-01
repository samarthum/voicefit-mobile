import type { DashboardData, InterpretEntryResponse } from "@voicefit/contracts/types";

export type CommandState =
  | "cc_collapsed"
  | "cc_expanded_empty"
  | "cc_expanded_typing"
  | "cc_submitting_typed"
  | "cc_recording"
  | "cc_transcribing_voice"
  | "cc_interpreting_voice"
  | "cc_review_meal"
  | "cc_review_workout"
  | "cc_saving"
  | "cc_auto_saving"
  | "cc_quick_add_saving"
  | "cc_error";

export type CommandErrorSubtype =
  | "typed_interpret_failure"
  | "voice_interpret_failure"
  | "mic_permission_denied"
  | "auto_save_failure"
  | "quick_add_failure"
  | null;

export type EntrySource = "text" | "voice";

export type RecentMeal = DashboardData["recentMeals"][number];

export interface WorkoutSessionListItem {
  id: string;
  endedAt: string | null;
}

export interface WorkoutSessionsResponse {
  sessions: WorkoutSessionListItem[];
}

export interface QuickAddItem {
  id: string;
  description: string;
  calories: number;
  mealType: string;
}

export type SaveAction =
  | {
      kind: "entry";
      interpreted: InterpretEntryResponse;
      transcript: string;
      source: EntrySource;
    }
  | {
      kind: "quick_add";
      item: QuickAddItem;
    };

export interface MealReviewIngredient {
  id: string;
  name: string;
  quantity: string;
  calories: number;
}

export interface MealReviewDraft {
  kind: "meal";
  interpreted: Extract<InterpretEntryResponse, { intent: "meal" }>;
  transcript: string;
  source: EntrySource;
  confidence: number;
  eatenAtLabel: string;
  ingredients: MealReviewIngredient[];
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface WorkoutReviewSet {
  id: string;
  setNumber: number;
  weightKg: string;
  reps: string;
  notes: string;
}

export interface WorkoutReviewDraft {
  kind: "workout";
  interpreted: Extract<InterpretEntryResponse, { intent: "workout_set" }>;
  transcript: string;
  source: EntrySource;
  confidence: number;
  exerciseTypeLabel: string;
  sessionLabel: string;
  sets: WorkoutReviewSet[];
}

export type ReviewDraft = MealReviewDraft | WorkoutReviewDraft;

export interface ScreenContext {
  /** Active workout session ID — sets get added to this session */
  sessionId?: string;
}
