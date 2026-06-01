import type { DashboardData, InterpretEntryResponse, MealIngredient } from "@voicefit/contracts/types";

export type CommandState =
  | "cc_collapsed"
  | "cc_expanded_empty"
  | "cc_expanded_typing"
  | "cc_photo_context"
  | "cc_submitting_typed"
  | "cc_submitting_photo"
  | "cc_recording"
  | "cc_transcribing_voice"
  | "cc_interpreting_voice"
  | "cc_review_meal"
  | "cc_review_workout"
  | "cc_saving"
  | "cc_auto_saving"
  | "cc_quick_add_saving"
  | "cc_saved"
  | "cc_error";

export type CommandErrorSubtype =
  | "typed_interpret_failure"
  | "voice_interpret_failure"
  | "photo_interpret_failure"
  | "mic_permission_denied"
  | "photo_permission_denied"
  | "auto_save_failure"
  | "quick_add_failure"
  | null;

export type EntrySource = "text" | "voice";

export interface PhotoAttachment {
  uri: string;
  name: string;
  type: string;
  width: number | null;
  height: number | null;
}

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
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealReviewDraft {
  kind: "meal";
  interpreted: Extract<InterpretEntryResponse, { intent: "meal" }>;
  transcript: string;
  source: EntrySource;
  eatenAtLabel: string;
  totalGrams: number;
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
  /** Current screen context — determines quick-add suggestions */
  screen?: "workout" | "default";
}

export type CommandCenterContext = ScreenContext;

export interface CommandCenterLauncherProps {
  onPress: () => void;
  onMicPress: () => Promise<void>;
}

export interface CommandCenterHandle {
  isOpen: boolean;
  toast: string | null;
  open: () => void;
  record: () => Promise<void>;
  close: () => void;
  launcherProps: CommandCenterLauncherProps;
}

export interface CommandCenterErrorCopy {
  title: string;
  body: string;
  primary: string;
  secondary: string | null;
  tertiary: string | null;
}

export interface CommandCenterSnapshot {
  state: CommandState;
  isOpen: boolean;
  input: {
    text: string;
    voiceTranscript: string;
    recordingSeconds: number;
    isInterpretingVoice: boolean;
    selectedMealPhoto: PhotoAttachment | null;
  };
  review: ReviewDraft | null;
  toast: {
    message: string | null;
    lastSavedKcalLeft: number | null;
  };
  error: {
    subtype: CommandErrorSubtype;
    detail: string | null;
    copy: CommandCenterErrorCopy | null;
  };
  quickAddItems: QuickAddItem[];
  screenContext: ScreenContext;
  isWebPreview: boolean;
}

export type CommandCenterEvent =
  | { type: "open" }
  | { type: "close" }
  | { type: "text.change"; text: string }
  | { type: "text.set"; text: string }
  | { type: "text.edit" }
  | { type: "text.submit" }
  | { type: "voice.start" }
  | { type: "voice.stop" }
  | { type: "voice.transcript.change"; text: string }
  | { type: "photo.menu.open" }
  | { type: "photo.context.edit" }
  | { type: "photo.submit" }
  | { type: "quick-add.save"; item: QuickAddItem }
  | { type: "review.save" }
  | { type: "review.transcript.edit" }
  | {
      type: "workout-set.update";
      index: number;
      patch: Partial<Pick<WorkoutReviewSet, "weightKg" | "reps" | "notes">>;
    }
  | { type: "workout-set.add" }
  | { type: "ingredient.edit-grams"; id: string; grams: number }
  | { type: "ingredient.replace"; id: string; replacement: MealIngredient }
  | { type: "ingredient.add"; ingredient: MealIngredient }
  | { type: "ingredient.remove"; id: string }
  | { type: "ingredient.lookup"; name: string; grams?: number }
  | { type: "error.primary" }
  | { type: "error.secondary" };
