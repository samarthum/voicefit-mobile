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
  ScreenContext,
  WorkoutReviewSet,
} from "./types";
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
} from "./helpers";

export type PhotoPickerMode = "camera" | "library";

export interface CommandCenterVoiceRecording {
  clearDurationUpdates: () => void;
  stopAndUnload: () => Promise<void>;
  getDurationMillis: () => Promise<number>;
  getUri: () => string | null;
}

type MealSaveInput = {
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

export interface CommandCenterBackendPort {
  interpretEntry: (transcript: string, source: EntrySource) => Promise<InterpretEntryResponse>;
  createPendingMealFromText: (transcript: string, source: EntrySource) => Promise<void>;
  createPendingMealFromPhoto: (photo: PhotoAttachment, context: string) => Promise<void>;
  transcribeAudio: (audio: { uri: string; name: string; type: string }) => Promise<string>;
  createMeal: (input: MealSaveInput) => Promise<void>;
  ensureQuickSession: () => Promise<string>;
  createWorkoutSet: (input: WorkoutSetSaveInput) => Promise<void>;
  upsertDailyMetrics: (input: DailyMetricsSaveInput) => Promise<void>;
  createConversation: (input: ConversationSaveInput) => Promise<void>;
  fetchInterpretedIngredient: (name: string, grams?: number) => Promise<MealIngredient>;
}

export interface CommandCenterAuthPort {
  getToken: () => Promise<string>;
}

export interface CommandCenterCachePort {
  refreshAfterSave: () => Promise<void>;
  computeKcalLeftAfterMeal: (justSavedKcal: number) => number | null;
}

export interface CommandCenterClockPort {
  now: () => Date;
}

export interface CommandCenterPreviewPort {
  isEnabled: () => boolean;
  hasFlag: (flag: string) => boolean;
  delay: (ms: number) => Promise<void>;
}

export interface CommandCenterFeedbackPort {
  finishWithSaved: (toast: string, kcalLeft?: number | null) => void;
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

function quickAddToMealInput(item: QuickAddItem, now: Date): MealSaveInput {
  return {
    eatenAt: now.toISOString(),
    mealType: item.mealType,
    description: item.description,
    calories: item.calories,
    transcriptRaw: `quick_add:${item.description}`,
  };
}

export function createCommandCenterController(ports: CommandCenterPorts): CommandCenterController {
  const openCommandCenter = () => {
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
    ports.state.closeCommandCenter();
  };

  const handleCommandInputChange = (text: string) => {
    ports.state.setCommandText(text);
    const state = ports.state.getCommandState();
    if (state === "cc_expanded_empty" && text.trim()) ports.state.setCommandState("cc_expanded_typing");
    if (state === "cc_expanded_typing" && !text.trim()) ports.state.setCommandState("cc_expanded_empty");
  };

  const updateWorkoutSet = (
    setIndex: number,
    patch: Partial<Pick<WorkoutReviewSet, "weightKg" | "reps" | "notes">>,
  ) => {
    const reviewDraft = ports.state.getReviewDraft();
    if (!reviewDraft || reviewDraft.kind !== "workout") return;
    const sets = reviewDraft.sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set));
    ports.state.setReviewDraft({ ...reviewDraft, sets });
  };

  const addWorkoutSet = () => {
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

  const runSaveAction = async (action: SaveAction) => {
    ports.state.setPendingSaveAction(action);
    ports.state.clearCommandError();
    ports.state.setCommandState(action.kind === "quick_add" ? "cc_quick_add_saving" : "cc_saving");

    const kcalLeftAfterSave = isMealSave(action)
      ? ports.cache.computeKcalLeftAfterMeal(savedMealCalories(action))
      : null;

    try {
      if (ports.preview.isEnabled()) {
        if (action.kind === "entry" && ports.preview.hasFlag("save_fail")) {
          throw new Error("Mock auto-save failure.");
        }
        if (action.kind === "quick_add" && ports.preview.hasFlag("quick_add_fail")) {
          throw new Error("Mock quick-add save failure.");
        }
        await ports.preview.delay(550);
        await ports.cache.refreshAfterSave();
        ports.feedback.finishWithSaved("Saved", kcalLeftAfterSave);
        return;
      }

      const now = ports.clock.now();

      if (action.kind === "quick_add") {
        await ports.backend.createMeal(quickAddToMealInput(action.item, now));
      } else {
        const { interpreted, transcript, source } = action;

        if (interpreted.intent === "meal") {
          await ports.backend.createMeal({
            eatenAt: now.toISOString(),
            mealType: interpreted.payload.mealType,
            description: interpreted.payload.description,
            calories: interpreted.payload.calories,
            proteinG: interpreted.payload.proteinG,
            carbsG: interpreted.payload.carbsG,
            fatG: interpreted.payload.fatG,
            ingredients: interpreted.payload.ingredients,
            transcriptRaw: transcript,
          });
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
          ports.feedback.finishWithSaved(interpreted.payload.answer);
          return;
        }
      }

      await ports.cache.refreshAfterSave();
      ports.feedback.finishWithSaved("Saved", kcalLeftAfterSave);
    } catch (error) {
      ports.state.setCommandError(
        action.kind === "quick_add" ? "quick_add_failure" : "auto_save_failure",
        getErrorMessage(error),
      );
    }
  };

  const routeInterpretedEntry = async (
    interpreted: InterpretEntryResponse,
    transcript: string,
    source: EntrySource,
  ) => {
    if (interpreted.intent === "meal") {
      await ports.backend.createPendingMealFromText(transcript, source);
    } else if (interpreted.intent === "workout_set") {
      ports.state.setReviewDraft(buildWorkoutReviewDraft(interpreted, transcript, source));
      ports.state.setCommandState("cc_review_workout");
    } else {
      await runSaveAction({ kind: "entry", interpreted, transcript, source });
    }
  };

  const submitTypedText = async () => {
    const trimmed = ports.state.getCommandText().trim();
    if (!trimmed) return;

    ports.state.setCommandState("cc_submitting_typed");
    ports.state.clearCommandError();

    try {
      if (isLikelyMealEntry(trimmed)) {
        await ports.backend.createPendingMealFromText(trimmed, "text");
        return;
      }

      const interpreted = await ports.backend.interpretEntry(trimmed, "text");
      await routeInterpretedEntry(interpreted, trimmed, "text");
    } catch (error) {
      ports.state.setCommandError("typed_interpret_failure", getErrorMessage(error));
    }
  };

  const interpretVoiceTranscript = async (text: string) => {
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
        await ports.backend.createPendingMealFromText(transcript, "voice");
        return;
      }

      const interpreted = await ports.backend.interpretEntry(transcript, "voice");
      await routeInterpretedEntry(interpreted, transcript, "voice");
    } catch (error) {
      ports.state.setCommandError("voice_interpret_failure", getErrorMessage(error));
    } finally {
      ports.state.setIsInterpretingVoice(false);
    }
  };

  const startRecording = async () => {
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
      if (!permissionGranted) {
        ports.state.setCommandError("mic_permission_denied");
        return;
      }

      const recording = await ports.media.startVoiceRecording(ports.state.setRecordingSeconds);
      ports.state.setActiveRecording(recording);
      ports.state.setRecordingSeconds(0);
      ports.state.setCommandState("cc_recording");
    } catch (error) {
      ports.state.setCommandError("voice_interpret_failure", getErrorMessage(error));
    }
  };

  const stopRecording = async () => {
    if (ports.preview.isEnabled()) {
      const previewTranscript = "I had a chicken salad with rice for lunch, about 500 calories";
      ports.state.setCommandState("cc_transcribing_voice");
      if (ports.preview.hasFlag("hold_transcribing")) return;
      await ports.preview.delay(700);
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

      const transcript = await ports.backend.transcribeAudio({
        uri,
        name: `voicefit-${ports.clock.now().getTime()}.m4a`,
        type: "audio/m4a",
      });
      const cleaned = transcript.trim();
      if (!cleaned) throw new Error("Transcript was empty. Please try again.");
      ports.state.setVoiceTranscript(cleaned);
      await interpretVoiceTranscript(cleaned);
    } catch (error) {
      ports.state.setCommandError("voice_interpret_failure", getErrorMessage(error));
    }
  };

  const launchPhotoPicker = async (mode: PhotoPickerMode) => {
    ports.state.clearCommandError();

    try {
      const permissionGranted = await ports.media.requestPhotoPermission(mode);
      if (!permissionGranted) {
        ports.state.setCommandError("photo_permission_denied");
        return;
      }

      const photo = await ports.media.pickMealPhoto(mode);
      if (!photo) return;

      ports.state.setSelectedMealPhoto(photo);
      ports.state.setCommandText("");
      ports.state.setCommandState("cc_photo_context");
    } catch (error) {
      ports.state.setCommandError("photo_interpret_failure", getErrorMessage(error));
    }
  };

  const openPhotoMenu = async () => {
    if (ports.platform.isWeb()) {
      await launchPhotoPicker("library");
      return;
    }

    const mode = await ports.platform.selectPhotoSource();
    if (mode) await launchPhotoPicker(mode);
  };

  const submitPhotoMeal = async () => {
    const photo = ports.state.getSelectedMealPhoto();
    if (!photo) return;

    ports.state.setCommandState("cc_submitting_photo");
    ports.state.clearCommandError();

    try {
      await ports.backend.createPendingMealFromPhoto(photo, ports.state.getCommandText());
    } catch (error) {
      ports.state.setCommandError("photo_interpret_failure", getErrorMessage(error));
    }
  };

  const saveReviewedEntry = async () => {
    const reviewDraft = ports.state.getReviewDraft();
    if (!reviewDraft) return;

    if (reviewDraft.kind === "workout") {
      const filledSets = reviewDraft.sets.filter((set) =>
        set.weightKg.trim() || set.reps.trim() || set.notes.trim(),
      );
      const setsToSave = filledSets.length > 0 ? filledSets : [reviewDraft.sets[0]];
      ports.state.setCommandState("cc_saving");
      ports.state.clearCommandError();

      try {
        if (ports.preview.isEnabled()) {
          await ports.preview.delay(550);
          await ports.cache.refreshAfterSave();
          ports.state.setCommandToast("Saved");
          ports.state.closeCommandCenter();
          return;
        }

        const sessionId = ports.state.getScreenContext().sessionId ?? await ports.backend.ensureQuickSession();
        const now = ports.clock.now();
        await Promise.all(
          setsToSave.map((set) =>
            ports.backend.createWorkoutSet({
              sessionId,
              exerciseName: reviewDraft.interpreted.payload.exerciseName,
              exerciseType: reviewDraft.interpreted.payload.exerciseType,
              reps: parsePositiveNumber(set.reps),
              weightKg: parsePositiveNumber(set.weightKg),
              durationMinutes: null,
              notes: set.notes.trim() || reviewDraft.interpreted.payload.notes,
              performedAt: now.toISOString(),
              transcriptRaw: reviewDraft.transcript,
            }),
          ),
        );
        await ports.cache.refreshAfterSave();
        ports.state.setCommandToast(`Saved ${setsToSave.length} set${setsToSave.length > 1 ? "s" : ""}`);
        ports.state.closeCommandCenter();
      } catch (error) {
        ports.state.setCommandError("auto_save_failure", getErrorMessage(error));
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

    const pendingSave = ports.state.getPendingSaveAction();
    if ((subtype === "auto_save_failure" || subtype === "quick_add_failure") && pendingSave) {
      await runSaveAction(pendingSave);
    }
  };

  const handleErrorSecondary = () => {
    const subtype = ports.state.getCommandErrorSubtype();
    if (!subtype) return;

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
      },
      error: {
        subtype: errorSubtype,
        detail: ports.state.getCommandErrorDetail(),
        copy: errorSubtype ? ERROR_COPY[errorSubtype] : null,
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
