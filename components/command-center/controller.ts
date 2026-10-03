import type { InterpretEntryResponse, MealIngredient } from "@voicefit/contracts/types";
import type {
  CommandErrorSubtype,
  CommandCenterEvent,
  CommandCenterSnapshot,
  CommandState,
  EntrySource,
  MealReviewIngredient,
  PhotoAttachment,
  QuickAddItem,
  ReviewDraft,
  SaveAction,
  SavedFeedbackKind,
  ScreenContext,
  WorkoutReviewSet,
} from "@/components/command-center/types";
import {
  buildWorkoutReviewDraft,
  ERROR_COPY,
  generateIngredientId,
  getErrorMessage,
  isLikelyMealEntry,
  MIN_RECORDING_DURATION_MS,
  parsePositiveNumber,
  recalculateMealTotals,
  scaleIngredientByGrams,
  toLocalDateString,
} from "@/components/command-center/helpers";

import { assertSingleWorkoutExercise } from "@/lib/workout-transcript";

export type PhotoPickerMode = "camera" | "library";

export interface CommandCenterVoiceRecording {
  clearDurationUpdates: () => void;
  stopAndUnload: () => Promise<void>;
  getDurationMillis: () => Promise<number>;
  getUri: () => string | null;
}

type MealSaveInput = {
  requestId: string;
  eatenAt: string;
  mealType: string;
  description: string;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  ingredients?: Extract<InterpretEntryResponse, { intent: "meal" }>["payload"]["ingredients"];
  transcriptRaw: string;
};

type WorkoutSetSaveInput = {
  sessionId: string;
  exerciseName: string;
  exerciseType: "resistance" | "cardio";
  reps: number | null;
  weightKg: number | null;
  durationMinutes: number | null;
  notes: string | null;
  performedAt: string;
  transcriptRaw: string;
};

type DailyMetricsSaveInput = {
  date: string;
  steps?: number;
  weightKg?: number;
};

type ConversationSaveInput = {
  kind: "question";
  userText: string;
  systemText: string;
  source: EntrySource;
  referenceType: null;
  referenceId: null;
  metadata: { answer: string };
};

export interface CommandCenterStatePort {
  getCommandState: () => CommandState;
  getCommandText: () => string;
  getVoiceTranscript: () => string;
  getRecordingSeconds: () => number;
  getIsInterpretingVoice: () => boolean;
  getScreenContext: () => ScreenContext;
  getSelectedMealPhoto: () => PhotoAttachment | null;
  getActiveRecording: () => CommandCenterVoiceRecording | null;
  getReviewDraft: () => ReviewDraft | null;
  getCommandToast: () => string | null;
  getSavedFeedbackKind?: () => SavedFeedbackKind;
  getSavedFeedbackReady?: () => boolean;
  getLastSavedKcalLeft: () => number | null;
  getCommandErrorSubtype: () => CommandErrorSubtype;
  getCommandErrorDetail: () => string | null;
  getQuickAddItems: () => QuickAddItem[];
  getIsWebPreview: () => boolean;
  getPendingSaveAction: () => SaveAction | null;
  setCommandState: (state: CommandState) => void;
  setCommandError: (subtype: Exclude<CommandErrorSubtype, null>, detail?: string) => void;
  setCommandErrorDetail: (detail: string | null) => void;
  setReviewDraft: (draft: ReviewDraft | null) => void;
  setPendingSaveAction: (action: SaveAction) => void;
  setSelectedMealPhoto: (photo: PhotoAttachment | null) => void;
  setCommandText: (text: string) => void;
  setVoiceTranscript: (text: string) => void;
  setRecordingSeconds: (seconds: number) => void;
  setActiveRecording: (recording: CommandCenterVoiceRecording | null) => void;
  setIsInterpretingVoice: (value: boolean) => void;
  setCommandToast: (toast: string) => void;
  closeCommandCenter: () => void;
  clearCommandError: () => void;
}

export type MealCaptureIdentity = { requestId: string; eatenAt: string; timezone: string };

export interface CommandCenterBackendPort {
  interpretEntry: (transcript: string, source: EntrySource, signal?: AbortSignal) => Promise<InterpretEntryResponse>;
  createPendingMealFromText: (transcript: string, source: EntrySource, identity: MealCaptureIdentity) => Promise<void>;
  createPendingMealFromPhoto: (photo: PhotoAttachment, context: string, identity: MealCaptureIdentity) => Promise<void>;
  transcribeAudio: (audio: { uri: string; name: string; type: string }, signal?: AbortSignal) => Promise<string>;
  createMeal: (input: MealSaveInput) => Promise<void>;
  /** Opens full-source repeat confirmation; summaries must never create meals. */
  selectRepeatedMeal?: (sourceMealId: string) => void;
  ensureQuickSession: () => Promise<string>;
  createWorkoutSet: (input: WorkoutSetSaveInput) => Promise<void>;
  createWorkoutBatch: (input: { requestId: string; sets: WorkoutSetSaveInput[] }) => Promise<void>;
  upsertDailyMetrics: (input: DailyMetricsSaveInput) => Promise<void>;
  createConversation: (input: ConversationSaveInput) => Promise<void>;
  fetchInterpretedIngredient: (name: string, grams?: number) => Promise<MealIngredient>;
}

export interface CommandCenterAuthPort {
  getToken: () => Promise<string>;
}

export interface CommandCenterCachePort {
  refreshAfterSave: () => Promise<void>;
  refreshAfterMealSave?: () => Promise<void>;
  computeKcalLeftAfterMeal: (justSavedKcal: number) => number | null;
}

export interface CommandCenterClockPort {
  now: () => Date;
  createRequestId: () => string;
  getTimezone?: () => string;
}

export interface CommandCenterPreviewPort {
  isEnabled: () => boolean;
  hasFlag: (flag: string) => boolean;
  delay: (ms: number) => Promise<void>;
}

export interface CommandCenterFeedbackPort {
  finishWithSaved: (toast: string, kcalLeft?: number | null, kind?: SavedFeedbackKind) => void;
}

export interface CommandCenterMediaPort {
  requestMicrophonePermission: () => Promise<boolean>;
  startVoiceRecording: (onDurationSeconds: (seconds: number) => void) => Promise<CommandCenterVoiceRecording>;
  requestPhotoPermission: (mode: PhotoPickerMode) => Promise<boolean>;
  pickMealPhoto: (mode: PhotoPickerMode) => Promise<PhotoAttachment | null>;
}

export interface CommandCenterPlatformPort {
  isWeb: () => boolean;
  openSettings: () => Promise<void>;
  selectPhotoSource: () => Promise<PhotoPickerMode | null>;
}

export interface CommandCenterPorts {
  state: CommandCenterStatePort;
  auth: CommandCenterAuthPort;
  backend: CommandCenterBackendPort;
  cache: CommandCenterCachePort;
  clock: CommandCenterClockPort;
  preview: CommandCenterPreviewPort;
  feedback: CommandCenterFeedbackPort;
  media: CommandCenterMediaPort;
  platform: CommandCenterPlatformPort;
}

export interface CommandCenterController {
  getSnapshot: () => CommandCenterSnapshot;
  subscribe: (listener: () => void) => () => void;
  dispatch: (event: CommandCenterEvent) => void | Promise<void> | Promise<MealIngredient>;
  openCommandCenter: () => void;
  closeCommandCenter: () => void;
  handleCommandInputChange: (text: string) => void;
  updateWorkoutSet: (idx: number, patch: Partial<Pick<WorkoutReviewSet, "weightKg" | "reps" | "notes">>) => void;
  addWorkoutSet: () => void;
  editIngredientGrams: (id: string, grams: number) => void;
  replaceIngredient: (id: string, replacement: MealIngredient) => void;
  addIngredient: (ingredient: MealIngredient) => void;
  removeIngredient: (id: string) => void;
  fetchInterpretedIngredient: (name: string, grams?: number) => Promise<MealIngredient>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  interpretVoiceTranscript: (text: string) => Promise<void>;
  openPhotoMenu: () => Promise<void>;
  launchPhotoPicker: (mode: PhotoPickerMode) => Promise<void>;
  submitPhotoMeal: () => Promise<void>;
  saveReviewedEntry: () => Promise<void>;
  editReviewTranscript: () => void;
  handleErrorPrimary: () => Promise<void>;
  handleErrorSecondary: () => void;
  submitTypedText: () => Promise<void>;
  routeInterpretedEntry: (
    interpreted: InterpretEntryResponse,
    transcript: string,
    source: EntrySource,
  ) => Promise<void>;
  runSaveAction: (action: SaveAction) => Promise<void>;
}

function isMealSave(action: SaveAction) {
  return action.kind === "quick_add" ||
    (action.kind === "entry" && action.interpreted.intent === "meal");
}

function savedMealCalories(action: SaveAction) {
  if (action.kind === "quick_add") return action.item.calories;
  if (action.interpreted.intent === "meal") return action.interpreted.payload.calories;
  return 0;
}

export interface CommandCenterOperationState {
  generation: number;
  saving: boolean;
  abort?: AbortController;
  /** Memory only: retained across renders, not process restart/offline storage. */
  mealCapture?: ({ kind: "text"; transcript: string; source: EntrySource } | { kind: "photo"; photo: PhotoAttachment; context: string }) & { identity: MealCaptureIdentity };
  mealSave?: { input: MealSaveInput; kcalLeft: number | null; acknowledged?: boolean };
  /** Consumes trailing save taps until open starts a new logical draft. */
  mealAcknowledged?: boolean;
  workoutBatch?: { requestId: string; sets: WorkoutSetSaveInput[] };
  /** Confirmed original awaiting dismissal when a different review was retained. */
  workoutBatchAcknowledged?: boolean;
}

export function createCommandCenterController(
  ports: CommandCenterPorts,
  operation: CommandCenterOperationState = { generation: 0, saving: false },
): CommandCenterController {
  // Shared across provider renders. Cancellation stops reads, never claims to
  // undo a write that the server may already have accepted.
  const cancelInterpretation = () => {
    operation.generation += 1;
    operation.abort?.abort();
    operation.abort = undefined;
  };
  const beginInterpretation = () => {
    cancelInterpretation();
    operation.abort = new AbortController();
    return { generation: operation.generation, signal: operation.abort.signal };
  };
  const isCurrent = (generation: number) => generation === operation.generation;
  const workoutSetsForSave = (draft: Extract<ReviewDraft, { kind: "workout" }>) => {
    const filled = draft.sets.filter((set) => set.weightKg.trim() || set.reps.trim() || set.notes.trim());
    return filled.length > 0 ? filled : [draft.sets[0]];
  };
  const workoutReviewMatchesBatch = (draft: ReviewDraft | null) => {
    const batch = operation.workoutBatch;
    if (!batch || draft?.kind !== "workout") return false;
    const sets = workoutSetsForSave(draft);
    const sessionId = ports.state.getScreenContext().sessionId;
    return sets.length === batch.sets.length && sets.every((set, index) => {
      const frozen = batch.sets[index];
      return set && (!sessionId || sessionId === frozen.sessionId) &&
        draft.transcript === frozen.transcriptRaw &&
        draft.interpreted.payload.exerciseName === frozen.exerciseName &&
        draft.interpreted.payload.exerciseType === frozen.exerciseType &&
        draft.interpreted.payload.durationMinutes === frozen.durationMinutes &&
        parsePositiveNumber(set.reps) === frozen.reps &&
        parsePositiveNumber(set.weightKg) === frozen.weightKg &&
        (set.notes.trim() || draft.interpreted.payload.notes) === frozen.notes;
    });
  };
  const originalWorkoutSavedMessage = () => {
    const batch = operation.workoutBatch!;
    return `Original ${batch.sets[0].exerciseName} saved: ${batch.sets.length} set${batch.sets.length > 1 ? "s" : ""}. Changed entry not saved.`;
  };
  const blockFrozenWorkoutEdit = () => {
    if (!operation.workoutBatch) return false;
    ports.state.setCommandError("auto_save_failure", operation.workoutBatchAcknowledged
      ? `${originalWorkoutSavedMessage()} Your changed entry is retained here; close and correct the saved sets in your workout.`
      : "The original workout batch may already be saved. The changed entry cannot be saved as its retry. Retry original to confirm its outcome before editing saved sets in your workout.");
    return true;
  };
  const blockFrozenMealEdit = () => {
    if (!operation.mealCapture && !operation.mealSave) return false;
    ports.state.setCommandError("auto_save_failure", "The original meal may already be saved. Retry original to confirm its outcome before starting another meal. This retry is kept in memory only; closing the app loses it.");
    return true;
  };
  const retryPendingMeal = async () => {
    if (operation.saving || !operation.mealCapture) return;
    const capture = operation.mealCapture;
    operation.saving = true;
    ports.state.clearCommandError();
    ports.state.setCommandState("cc_saving");
    try {
      if (capture.kind === "text") {
        await ports.backend.createPendingMealFromText(capture.transcript, capture.source, capture.identity);
      } else {
        await ports.backend.createPendingMealFromPhoto(capture.photo, capture.context, capture.identity);
      }
      operation.mealAcknowledged = true;
      operation.mealCapture = undefined;
      ports.feedback.finishWithSaved(capture.kind === "photo" ? "Photo added" : "Meal received", null, "processing");
    } catch (error) {
      ports.state.setCommandError("auto_save_failure", getErrorMessage(error));
    } finally {
      operation.saving = false;
    }
  };
  const savePendingMeal = async (transcript: string, source: EntrySource) => {
    if (operation.saving || blockFrozenMealEdit()) return;
    operation.mealCapture = {
      kind: "text", transcript, source,
      identity: { requestId: ports.clock.createRequestId(), eatenAt: ports.clock.now().toISOString(),
        timezone: ports.clock.getTimezone?.() ?? Intl.DateTimeFormat().resolvedOptions().timeZone },
    };
    await retryPendingMeal();
  };
  const openCommandCenter = () => {
    if (operation.saving || blockFrozenMealEdit()) return;
    operation.mealAcknowledged = undefined;
    if (operation.workoutBatch && !operation.workoutBatchAcknowledged && blockFrozenWorkoutEdit()) return;
    cancelInterpretation();
    operation.workoutBatch = undefined;
    operation.workoutBatchAcknowledged = undefined;
    ports.state.setCommandText("");
    ports.state.setVoiceTranscript("");
    ports.state.setRecordingSeconds(0);
    ports.state.setIsInterpretingVoice(false);
    ports.state.setReviewDraft(null);
    ports.state.setSelectedMealPhoto(null);
    ports.state.clearCommandError();
    ports.state.setCommandState("cc_expanded_empty");
  };

  const closeCommandCenter = () => {
    if (operation.saving || blockFrozenMealEdit()) return;
    if (operation.workoutBatch && !operation.workoutBatchAcknowledged && blockFrozenWorkoutEdit()) return;
    cancelInterpretation();
    ports.state.closeCommandCenter();
  };

  const handleCommandInputChange = (text: string) => {
    if (operation.saving || blockFrozenMealEdit() || blockFrozenWorkoutEdit()) return;
    ports.state.setCommandText(text);
    const state = ports.state.getCommandState();
    if (state === "cc_expanded_empty" && text.trim()) ports.state.setCommandState("cc_expanded_typing");
    if (state === "cc_expanded_typing" && !text.trim()) ports.state.setCommandState("cc_expanded_empty");
  };

  const updateWorkoutSet = (
    setIndex: number,
    patch: Partial<Pick<WorkoutReviewSet, "weightKg" | "reps" | "notes">>,
  ) => {
    if (operation.saving || blockFrozenWorkoutEdit()) return;
    const reviewDraft = ports.state.getReviewDraft();
    if (!reviewDraft || reviewDraft.kind !== "workout") return;
    const sets = reviewDraft.sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set));
    ports.state.setReviewDraft({ ...reviewDraft, sets });
  };

  const addWorkoutSet = () => {
    if (operation.saving || blockFrozenWorkoutEdit()) return;
    const reviewDraft = ports.state.getReviewDraft();
    if (!reviewDraft || reviewDraft.kind !== "workout") return;
    const n = reviewDraft.sets.length + 1;
    ports.state.setReviewDraft({
      ...reviewDraft,
      sets: [...reviewDraft.sets, { id: `set-${n}`, setNumber: n, weightKg: "", reps: "", notes: "" }],
    });
  };

  const editIngredientGrams = (id: string, grams: number) => {
    const reviewDraft = ports.state.getReviewDraft();
    if (!reviewDraft || reviewDraft.kind !== "meal") return;
    const ingredients = reviewDraft.ingredients.map((ingredient) =>
      ingredient.id === id ? scaleIngredientByGrams(ingredient, grams) : ingredient,
    );
    ports.state.setReviewDraft(recalculateMealTotals({ ...reviewDraft, ingredients }));
  };

  const replaceIngredient = (id: string, replacement: MealIngredient) => {
    const reviewDraft = ports.state.getReviewDraft();
    if (!reviewDraft || reviewDraft.kind !== "meal") return;
    const ingredients = reviewDraft.ingredients.map<MealReviewIngredient>((ingredient) =>
      ingredient.id === id
        ? {
            id: ingredient.id,
            name: replacement.name,
            grams: replacement.grams,
            calories: replacement.calories,
            proteinG: replacement.proteinG,
            carbsG: replacement.carbsG,
            fatG: replacement.fatG,
          }
        : ingredient,
    );
    ports.state.setReviewDraft(recalculateMealTotals({ ...reviewDraft, ingredients }));
  };

  const addIngredient = (ingredient: MealIngredient) => {
    const reviewDraft = ports.state.getReviewDraft();
    if (!reviewDraft || reviewDraft.kind !== "meal") return;
    const next: MealReviewIngredient = {
      id: generateIngredientId(),
      name: ingredient.name,
      grams: ingredient.grams,
      calories: ingredient.calories,
      proteinG: ingredient.proteinG,
      carbsG: ingredient.carbsG,
      fatG: ingredient.fatG,
    };
    ports.state.setReviewDraft(recalculateMealTotals({ ...reviewDraft, ingredients: [...reviewDraft.ingredients, next] }));
  };

  const removeIngredient = (id: string) => {
    const reviewDraft = ports.state.getReviewDraft();
    if (!reviewDraft || reviewDraft.kind !== "meal") return;
    const ingredients = reviewDraft.ingredients.filter((ingredient) => ingredient.id !== id);
    ports.state.setReviewDraft(recalculateMealTotals({ ...reviewDraft, ingredients }));
  };

  const fetchInterpretedIngredient = async (name: string, grams?: number): Promise<MealIngredient> => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Name is required");

    if (ports.preview.isEnabled()) {
      await ports.preview.delay(700);
      const g = grams && Number.isFinite(grams) && grams > 0 ? Math.round(grams) : 100;
      const calories = Math.round((g / 100) * 150);
      return {
        name: trimmedName,
        grams: g,
        calories,
        proteinG: Math.round(calories * 0.06),
        carbsG: Math.round(calories * 0.04),
        fatG: Math.round(calories * 0.02),
      };
    }

    return ports.backend.fetchInterpretedIngredient(trimmedName, grams);
  };

  const retryLegacyMeal = async () => {
    if (operation.saving || !operation.mealSave) return;
    const frozen = operation.mealSave;
    operation.saving = true;
    ports.state.clearCommandError();
    ports.state.setCommandState("cc_saving");
    try {
      if (!frozen.acknowledged) {
        if (ports.preview.isEnabled()) {
          if (ports.preview.hasFlag("save_fail")) throw new Error("Mock auto-save failure.");
          await ports.preview.delay(550);
        } else {
          await ports.backend.createMeal(frozen.input);
        }
        frozen.acknowledged = true;
      }
      try { await (ports.cache.refreshAfterMealSave ?? ports.cache.refreshAfterSave)(); } catch { /* Acknowledged, never create again. */ }
      operation.mealAcknowledged = true;
      operation.mealSave = undefined;
      ports.feedback.finishWithSaved("Meal added", frozen.kcalLeft, "meal");
    } catch (error) {
      ports.state.setCommandError("auto_save_failure", getErrorMessage(error));
    } finally {
      operation.saving = false;
    }
  };
  const runSaveAction = async (action: SaveAction) => {
    if (operation.mealAcknowledged || operation.saving || blockFrozenMealEdit()) return;
    if (action.kind === "entry" && action.interpreted.intent === "meal") {
      const { payload } = action.interpreted;
      operation.mealSave = {
        input: {
          requestId: ports.clock.createRequestId(), eatenAt: ports.clock.now().toISOString(),
          mealType: payload.mealType, description: payload.description, calories: payload.calories,
          proteinG: payload.proteinG, carbsG: payload.carbsG, fatG: payload.fatG,
          ingredients: payload.ingredients?.map((ingredient) => ({ ...ingredient })), transcriptRaw: action.transcript,
        },
        kcalLeft: ports.cache.computeKcalLeftAfterMeal(payload.calories),
      };
      ports.state.setPendingSaveAction(action);
      await retryLegacyMeal();
      return;
    }
    if (action.kind === "entry" && action.interpreted.intent === "workout_set") {
      if (blockFrozenWorkoutEdit()) return;
      try {
        const draft = buildWorkoutReviewDraft(action.interpreted, action.transcript, action.source);
        if (draft.sets.length > 1) {
          ports.state.setReviewDraft(draft);
          ports.state.setCommandState("cc_review_workout");
          return;
        }
      } catch (error) {
        ports.state.setCommandText(action.transcript);
        ports.state.setCommandError("typed_interpret_failure", getErrorMessage(error));
        return;
      }
    }
    if (action.kind === "quick_add") {
      ports.state.clearCommandError();
      if (!ports.backend.selectRepeatedMeal) {
        ports.state.setCommandError("quick_add_failure", "Open Meals to choose and repeat a saved meal.");
        return;
      }
      ports.state.closeCommandCenter();
      ports.backend.selectRepeatedMeal(action.item.id);
      return;
    }
    operation.saving = true;
    ports.state.setPendingSaveAction(action);
    ports.state.clearCommandError();
    ports.state.setCommandState("cc_saving");

    const kcalLeftAfterSave = isMealSave(action)
      ? ports.cache.computeKcalLeftAfterMeal(savedMealCalories(action))
      : null;

    try {
      if (ports.preview.isEnabled()) {
        if (action.kind === "entry" && ports.preview.hasFlag("save_fail")) {
          throw new Error("Mock auto-save failure.");
        }
        await ports.preview.delay(550);
        await ports.cache.refreshAfterSave();
        ports.feedback.finishWithSaved("Saved", kcalLeftAfterSave);
        return;
      }

      const now = ports.clock.now();

      {
        const { interpreted, transcript, source } = action;

        if (interpreted.intent === "meal") {
          await retryLegacyMeal();
          return;
        } else if (interpreted.intent === "workout_set") {
          const sessionId = ports.state.getScreenContext().sessionId ?? await ports.backend.ensureQuickSession();
          await ports.backend.createWorkoutSet({
            sessionId,
            exerciseName: interpreted.payload.exerciseName,
            exerciseType: interpreted.payload.exerciseType,
            reps: interpreted.payload.reps,
            weightKg: interpreted.payload.weightKg,
            durationMinutes: interpreted.payload.durationMinutes,
            notes: interpreted.payload.notes,
            performedAt: now.toISOString(),
            transcriptRaw: transcript,
          });
        } else if (interpreted.intent === "steps") {
          await ports.backend.upsertDailyMetrics({
            date: toLocalDateString(now),
            steps: Math.round(interpreted.payload.value),
          });
        } else if (interpreted.intent === "weight") {
          await ports.backend.upsertDailyMetrics({
            date: toLocalDateString(now),
            weightKg: interpreted.payload.value,
          });
        } else {
          await ports.backend.createConversation({
            kind: "question",
            userText: transcript,
            systemText: interpreted.payload.answer,
            source,
            referenceType: null,
            referenceId: null,
            metadata: { answer: interpreted.payload.answer },
          });
          await ports.cache.refreshAfterSave();
          ports.feedback.finishWithSaved(interpreted.payload.answer, undefined, "answer");
          return;
        }
      }

      await ports.cache.refreshAfterSave();
      ports.feedback.finishWithSaved("Saved", kcalLeftAfterSave);
    } catch (error) {
      ports.state.setCommandError(
        "auto_save_failure",
        getErrorMessage(error),
      );
    } finally {
      operation.saving = false;
    }
  };

  const routeInterpretedEntry = async (
    interpreted: InterpretEntryResponse,
    transcript: string,
    source: EntrySource,
  ) => {
    if (operation.saving || blockFrozenMealEdit()) return;
    if (interpreted.intent === "workout_set" && blockFrozenWorkoutEdit()) return;
    if (interpreted.intent === "meal") {
      await savePendingMeal(transcript, source);
    } else if (interpreted.intent === "workout_set") {
      ports.state.setReviewDraft(buildWorkoutReviewDraft(interpreted, transcript, source));
      ports.state.setCommandState("cc_review_workout");
    } else {
      await runSaveAction({ kind: "entry", interpreted, transcript, source });
    }
  };

  const submitTypedText = async () => {
    if (operation.mealAcknowledged || operation.saving || blockFrozenMealEdit()) return;
    if (blockFrozenWorkoutEdit()) return;
    const { generation, signal } = beginInterpretation();
    const trimmed = ports.state.getCommandText().trim();
    if (!trimmed) return;

    ports.state.setCommandState("cc_submitting_typed");
    ports.state.clearCommandError();

    try {
      if (isLikelyMealEntry(trimmed)) {
        await savePendingMeal(trimmed, "text");
        return;
      }

      const interpreted = await ports.backend.interpretEntry(trimmed, "text", signal);
      if (!isCurrent(generation)) return;
      await routeInterpretedEntry(interpreted, trimmed, "text");
    } catch (error) {
      if (!isCurrent(generation)) return;
      ports.state.setCommandError("typed_interpret_failure", getErrorMessage(error));
    }
  };

  const interpretVoiceTranscript = async (text: string) => {
    if (operation.mealAcknowledged || operation.saving || blockFrozenMealEdit()) return;
    if (blockFrozenWorkoutEdit()) return;
    const { generation, signal } = beginInterpretation();
    const transcript = text.trim();
    if (!transcript) {
      ports.state.setCommandError("voice_interpret_failure", "Transcript cannot be empty.");
      return;
    }

    ports.state.setIsInterpretingVoice(true);
    ports.state.setCommandState("cc_interpreting_voice");
    ports.state.clearCommandError();

    try {
      if (isLikelyMealEntry(transcript)) {
        await savePendingMeal(transcript, "voice");
        return;
      }

      const interpreted = await ports.backend.interpretEntry(transcript, "voice", signal);
      if (!isCurrent(generation)) return;
      await routeInterpretedEntry(interpreted, transcript, "voice");
    } catch (error) {
      if (!isCurrent(generation)) return;
      ports.state.setCommandError("voice_interpret_failure", getErrorMessage(error));
    } finally {
      if (isCurrent(generation)) ports.state.setIsInterpretingVoice(false);
    }
  };

  const startRecording = async () => {
    if (operation.saving || blockFrozenMealEdit()) return;
    operation.mealAcknowledged = undefined;
    // A new recording is a new draft, just like explicitly opening the logger.
    if (!operation.workoutBatch) operation.workoutBatchAcknowledged = undefined;
    const { generation, signal } = beginInterpretation();
    ports.state.clearCommandError();
    ports.state.setVoiceTranscript("");

    try {
      if (ports.preview.isEnabled()) {
        if (ports.preview.hasFlag("mic_denied")) {
          ports.state.setCommandError("mic_permission_denied");
          return;
        }
        ports.state.setRecordingSeconds(0);
        ports.state.setCommandState("cc_recording");
        return;
      }

      const permissionGranted = await ports.media.requestMicrophonePermission();
      if (!isCurrent(generation)) return;
      if (!permissionGranted) {
        ports.state.setCommandError("mic_permission_denied");
        return;
      }

      const recording = await ports.media.startVoiceRecording(ports.state.setRecordingSeconds);
      if (!isCurrent(generation)) {
        recording.clearDurationUpdates();
        await recording.stopAndUnload();
        return;
      }
      ports.state.setActiveRecording(recording);
      ports.state.setRecordingSeconds(0);
      ports.state.setCommandState("cc_recording");
    } catch (error) {
      if (!isCurrent(generation)) return;
      ports.state.setCommandError("voice_interpret_failure", getErrorMessage(error));
    }
  };

  const stopRecording = async () => {
    if (operation.saving || blockFrozenMealEdit()) return;
    const { generation, signal } = beginInterpretation();
    if (ports.preview.isEnabled()) {
      const previewTranscript = "I had a chicken salad with rice for lunch, about 500 calories";
      ports.state.setCommandState("cc_transcribing_voice");
      if (ports.preview.hasFlag("hold_transcribing")) return;
      await ports.preview.delay(700);
      if (!isCurrent(generation)) return;
      ports.state.setVoiceTranscript(previewTranscript);
      if (ports.preview.hasFlag("hold_interpreting")) {
        ports.state.setCommandState("cc_interpreting_voice");
        ports.state.setIsInterpretingVoice(true);
        return;
      }
      await interpretVoiceTranscript(previewTranscript);
      return;
    }

    const recording = ports.state.getActiveRecording();
    if (!recording) return;

    ports.state.setCommandState("cc_transcribing_voice");
    ports.state.clearCommandError();
    ports.state.setActiveRecording(null);

    try {
      recording.clearDurationUpdates();
      await recording.stopAndUnload();
      const durationMillis = await recording.getDurationMillis();
      const uri = recording.getUri();
      if (!uri || durationMillis < MIN_RECORDING_DURATION_MS) {
        throw new Error("Recording is too short. Please record at least 1 second.");
      }

      if (!isCurrent(generation)) return;
      const transcript = await ports.backend.transcribeAudio({
        uri,
        name: `voicefit-${ports.clock.now().getTime()}.m4a`,
        type: "audio/m4a",
      }, signal);
      if (!isCurrent(generation)) return;
      const cleaned = transcript.trim();
      if (!cleaned) throw new Error("Transcript was empty. Please try again.");
      ports.state.setVoiceTranscript(cleaned);
      await interpretVoiceTranscript(cleaned);
    } catch (error) {
      if (!isCurrent(generation)) return;
      ports.state.setCommandError("voice_interpret_failure", getErrorMessage(error));
    }
  };

  const launchPhotoPicker = async (mode: PhotoPickerMode) => {
    if (operation.saving || blockFrozenMealEdit()) return;
    operation.mealAcknowledged = undefined;
    const { generation, signal } = beginInterpretation();
    ports.state.clearCommandError();

    try {
      const permissionGranted = await ports.media.requestPhotoPermission(mode);
      if (!isCurrent(generation)) return;
      if (!permissionGranted) {
        ports.state.setCommandError("photo_permission_denied");
        return;
      }

      const photo = await ports.media.pickMealPhoto(mode);
      if (!isCurrent(generation) || !photo) return;

      ports.state.setSelectedMealPhoto(photo);
      ports.state.setCommandText("");
      ports.state.setCommandState("cc_photo_context");
    } catch (error) {
      if (!isCurrent(generation)) return;
      ports.state.setCommandError("photo_interpret_failure", getErrorMessage(error));
    }
  };

  const openPhotoMenu = async () => {
    if (operation.saving || blockFrozenMealEdit()) return;
    if (ports.platform.isWeb()) {
      await launchPhotoPicker("library");
      return;
    }

    const mode = await ports.platform.selectPhotoSource();
    if (mode) await launchPhotoPicker(mode);
  };

  const submitPhotoMeal = async () => {
    if (operation.mealAcknowledged || operation.saving || blockFrozenMealEdit()) return;
    const photo = ports.state.getSelectedMealPhoto();
    if (!photo) return;
    operation.mealCapture = {
      kind: "photo", photo: { ...photo }, context: ports.state.getCommandText().trim(),
      identity: { requestId: ports.clock.createRequestId(), eatenAt: ports.clock.now().toISOString(),
        timezone: ports.clock.getTimezone?.() ?? Intl.DateTimeFormat().resolvedOptions().timeZone },
    };
    await retryPendingMeal();
  };

  const saveReviewedEntry = async () => {
    // Shared operation state also consumes callbacks from obsolete provider renders.
    if (operation.workoutBatchAcknowledged && !operation.workoutBatch) return;
    if (ports.state.getCommandState() === "cc_saved") return;
    if (operation.saving || blockFrozenMealEdit()) return;
    const reviewDraft = ports.state.getReviewDraft();
    // Never send an old frozen payload as though it were the visible correction.
    if (operation.workoutBatch && (operation.workoutBatchAcknowledged || !workoutReviewMatchesBatch(reviewDraft))) {
      blockFrozenWorkoutEdit();
      return;
    }
    if (!reviewDraft) return;

    if (reviewDraft.kind === "workout") {
      try {
        assertSingleWorkoutExercise(reviewDraft.transcript, reviewDraft.interpreted.payload.exerciseName);
      } catch (error) {
        ports.state.setCommandError("auto_save_failure", getErrorMessage(error));
        return;
      }
      operation.saving = true;
      const setsToSave = workoutSetsForSave(reviewDraft);
      ports.state.setCommandState("cc_saving");
      ports.state.clearCommandError();

      try {
        if (ports.preview.isEnabled()) {
          await ports.preview.delay(550);
          try { await ports.cache.refreshAfterSave(); } catch { /* Acknowledged preview. */ }
          operation.workoutBatchAcknowledged = true;
          ports.feedback.finishWithSaved("Sets added", null, "workout");
          return;
        }

        if (!operation.workoutBatch) {
          const sessionId = ports.state.getScreenContext().sessionId ?? await ports.backend.ensureQuickSession();
          const now = ports.clock.now();
          operation.workoutBatch = {
            requestId: ports.clock.createRequestId(),
            sets: setsToSave.map((set) => ({
              sessionId,
              exerciseName: reviewDraft.interpreted.payload.exerciseName,
              exerciseType: reviewDraft.interpreted.payload.exerciseType,
              reps: parsePositiveNumber(set.reps),
              weightKg: parsePositiveNumber(set.weightKg),
              durationMinutes: reviewDraft.interpreted.payload.durationMinutes,
              notes: set.notes.trim() || reviewDraft.interpreted.payload.notes,
              performedAt: now.toISOString(),
              transcriptRaw: reviewDraft.transcript,
            })),
          };
        }
        await ports.backend.createWorkoutBatch(operation.workoutBatch);
        operation.workoutBatchAcknowledged = true;
        operation.workoutBatch = undefined;
        try { await ports.cache.refreshAfterSave(); } catch { /* Acknowledged: never retry a write for a cache failure. */ }
        ports.feedback.finishWithSaved("Sets added", null, "workout");
      } catch (error) {
        ports.state.setCommandError("auto_save_failure", getErrorMessage(error));
      } finally {
        operation.saving = false;
      }
      return;
    }

    await runSaveAction({
      kind: "entry",
      interpreted: reviewDraft.interpreted,
      transcript: reviewDraft.transcript,
      source: reviewDraft.source,
    });
  };

  const editReviewTranscript = () => {
    if (operation.saving || blockFrozenMealEdit() || blockFrozenWorkoutEdit()) return;
    const reviewDraft = ports.state.getReviewDraft();
    if (!reviewDraft) return;

    ports.state.setCommandText(reviewDraft.transcript);
    ports.state.setVoiceTranscript(reviewDraft.transcript);
    ports.state.setReviewDraft(null);
    ports.state.setCommandState(reviewDraft.transcript.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
  };

  const handleErrorPrimary = async () => {
    const subtype = ports.state.getCommandErrorSubtype();
    if (!subtype) return;
    if (operation.mealCapture) {
      await retryPendingMeal();
      return;
    }
    if (operation.mealSave) {
      await retryLegacyMeal();
      return;
    }

    if (subtype === "auto_save_failure" && operation.workoutBatch) {
      if (operation.saving) return;
      if (operation.workoutBatchAcknowledged) {
        ports.state.closeCommandCenter();
      } else if (workoutReviewMatchesBatch(ports.state.getReviewDraft())) {
        await saveReviewedEntry();
      } else {
        // This is explicit reconciliation of the original, not a corrected save.
        operation.saving = true;
        ports.state.setCommandState("cc_saving");
        try {
          await ports.backend.createWorkoutBatch(operation.workoutBatch);
          operation.workoutBatchAcknowledged = true;
          ports.state.setCommandToast(originalWorkoutSavedMessage());
          await ports.cache.refreshAfterSave();
        } catch (error) {
          if (!operation.workoutBatchAcknowledged) ports.state.setCommandErrorDetail(getErrorMessage(error));
        } finally {
          operation.saving = false;
          blockFrozenWorkoutEdit();
        }
      }
      return;
    }

    if (subtype === "typed_interpret_failure") {
      await submitTypedText();
      return;
    }
    if (subtype === "voice_interpret_failure") {
      await startRecording();
      return;
    }
    if (subtype === "photo_interpret_failure") {
      await submitPhotoMeal();
      return;
    }
    if (subtype === "mic_permission_denied") {
      try {
        await ports.platform.openSettings();
      } catch {
        ports.state.setCommandErrorDetail("Open your device settings and enable microphone access.");
      }
      return;
    }
    if (subtype === "photo_permission_denied") {
      try {
        await ports.platform.openSettings();
      } catch {
        ports.state.setCommandErrorDetail("Open your device settings and enable camera or photo access.");
      }
      return;
    }

    if (subtype === "auto_save_failure" && ports.state.getReviewDraft()?.kind === "workout") {
      await saveReviewedEntry();
      return;
    }
    const pendingSave = ports.state.getPendingSaveAction();
    if ((subtype === "auto_save_failure" || subtype === "quick_add_failure") && pendingSave) {
      await runSaveAction(pendingSave);
    }
  };

  const handleErrorSecondary = () => {
    if (operation.saving || blockFrozenMealEdit()) return;
    const subtype = ports.state.getCommandErrorSubtype();
    if (!subtype) return;

    if (subtype === "auto_save_failure" && ports.state.getReviewDraft()?.kind === "workout") {
      editReviewTranscript();
      return;
    }
    const commandText = ports.state.getCommandText();
    if (subtype === "typed_interpret_failure") {
      ports.state.setCommandState(commandText.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }

    const voiceTranscript = ports.state.getVoiceTranscript();
    if (subtype === "voice_interpret_failure") {
      if (voiceTranscript.trim()) ports.state.setCommandText(voiceTranscript.trim());
      ports.state.setCommandState(voiceTranscript.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }

    if (subtype === "photo_interpret_failure" || subtype === "photo_permission_denied") {
      ports.state.setSelectedMealPhoto(null);
      ports.state.setCommandState(commandText.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }

    if (subtype === "mic_permission_denied") {
      ports.state.setCommandState(commandText.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }

    ports.state.closeCommandCenter();
  };

  const listeners = new Set<() => void>();
  let snapshotCache: CommandCenterSnapshot | null = null;

  const notify = () => {
    snapshotCache = null;
    listeners.forEach((listener) => listener());
  };

  const getSnapshot = (): CommandCenterSnapshot => {
    if (snapshotCache) return snapshotCache;

    const state = ports.state.getCommandState();
    const errorSubtype = ports.state.getCommandErrorSubtype();
    snapshotCache = {
      state,
      isOpen: state !== "cc_collapsed",
      input: {
        text: ports.state.getCommandText(),
        voiceTranscript: ports.state.getVoiceTranscript(),
        recordingSeconds: ports.state.getRecordingSeconds(),
        isInterpretingVoice: ports.state.getIsInterpretingVoice(),
        selectedMealPhoto: ports.state.getSelectedMealPhoto(),
      },
      review: ports.state.getReviewDraft(),
      toast: {
        message: ports.state.getCommandToast(),
        lastSavedKcalLeft: ports.state.getLastSavedKcalLeft(),
        kind: ports.state.getSavedFeedbackKind?.(),
        ready: ports.state.getSavedFeedbackReady?.(),
      },
      error: {
        subtype: errorSubtype,
        detail: ports.state.getCommandErrorDetail(),
        copy: errorSubtype && (operation.mealCapture || operation.mealSave)
          ? { ...ERROR_COPY[errorSubtype], title: "Meal save not confirmed", body: "The original meal may already be saved. Retry original before starting another meal. This retry is kept in memory only; closing the app loses it.", primary: "Retry original", secondary: null }
          : errorSubtype === "auto_save_failure" && operation.workoutBatchAcknowledged
          ? { ...ERROR_COPY[errorSubtype], title: "Original workout saved", body: "Your changed entry was not saved. Close and correct the saved sets in your workout.", primary: "Close", secondary: null }
          : errorSubtype === "auto_save_failure" && operation.workoutBatch
          ? { ...ERROR_COPY[errorSubtype], title: "Workout save not confirmed", body: "The original batch may already be saved. Retry that same batch before editing saved sets in your workout.", primary: "Retry original", secondary: null }
          : errorSubtype === "auto_save_failure" && ports.state.getReviewDraft()?.kind === "workout"
          ? { ...ERROR_COPY[errorSubtype], secondary: "Edit entry" }
          : errorSubtype ? ERROR_COPY[errorSubtype] : null,
      },
      quickAddItems: ports.state.getQuickAddItems(),
      screenContext: ports.state.getScreenContext(),
      isWebPreview: ports.state.getIsWebPreview(),
    };
    return snapshotCache;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const runDispatchedEvent = (event: CommandCenterEvent) => {
    if (operation.saving) return;
    if ((operation.mealCapture || operation.mealSave) && event.type !== "error.primary") {
      if (!operation.saving) blockFrozenMealEdit();
      return;
    }
    switch (event.type) {
      case "open":
        return openCommandCenter();
      case "close":
        return closeCommandCenter();
      case "text.change":
        return handleCommandInputChange(event.text);
      case "text.set":
        return ports.state.setCommandText(event.text);
      case "text.edit":
        if (operation.saving || blockFrozenWorkoutEdit()) return;
        cancelInterpretation();
        return ports.state.setCommandState("cc_expanded_typing");
      case "text.submit":
        return submitTypedText();
      case "voice.start":
        return startRecording();
      case "voice.stop":
        return stopRecording();
      case "voice.transcript.change":
        return ports.state.setVoiceTranscript(event.text);
      case "photo.menu.open":
        return openPhotoMenu();
      case "photo.context.edit":
        if (operation.saving) return;
        cancelInterpretation();
        return ports.state.setCommandState("cc_photo_context");
      case "photo.submit":
        return submitPhotoMeal();
      case "quick-add.save":
        return runSaveAction({ kind: "quick_add", item: event.item });
      case "review.save":
        return saveReviewedEntry();
      case "review.transcript.edit":
        return editReviewTranscript();
      case "workout-set.update":
        return updateWorkoutSet(event.index, event.patch);
      case "workout-set.add":
        return addWorkoutSet();
      case "ingredient.edit-grams":
        return editIngredientGrams(event.id, event.grams);
      case "ingredient.replace":
        return replaceIngredient(event.id, event.replacement);
      case "ingredient.add":
        return addIngredient(event.ingredient);
      case "ingredient.remove":
        return removeIngredient(event.id);
      case "ingredient.lookup":
        return fetchInterpretedIngredient(event.name, event.grams);
      case "error.primary":
        return handleErrorPrimary();
      case "error.secondary":
        return handleErrorSecondary();
    }
  };

  const dispatch = (event: CommandCenterEvent) => {
    const result = runDispatchedEvent(event);
    if (result instanceof Promise) {
      return result.finally(notify);
    }
    notify();
    return result;
  };

  return {
    getSnapshot,
    subscribe,
    dispatch,
    openCommandCenter,
    closeCommandCenter,
    handleCommandInputChange,
    updateWorkoutSet,
    addWorkoutSet,
    editIngredientGrams,
    replaceIngredient,
    addIngredient,
    removeIngredient,
    fetchInterpretedIngredient,
    startRecording,
    stopRecording,
    interpretVoiceTranscript,
    openPhotoMenu,
    launchPhotoPicker,
    submitPhotoMeal,
    saveReviewedEntry,
    editReviewTranscript,
    handleErrorPrimary,
    handleErrorSecondary,
    submitTypedText,
    routeInterpretedEntry,
    runSaveAction,
  };
}
