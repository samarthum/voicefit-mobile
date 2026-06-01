import { beforeEach, describe, expect, test } from "bun:test";
import type { InterpretEntryResponse, MealIngredient } from "@voicefit/contracts/types";
import {
  createCommandCenterController,
  type CommandCenterVoiceRecording,
  type CommandCenterPorts,
} from "../controller";
import type { CommandErrorSubtype, CommandState, PhotoAttachment, ReviewDraft, SaveAction, ScreenContext } from "../types";

const fixedNow = new Date("2026-05-19T10:15:00.000Z");

function mealInterpretation(): Extract<InterpretEntryResponse, { intent: "meal" }> {
  return {
    intent: "meal",
    payload: {
      mealType: "lunch",
      description: "Chicken rice bowl",
      totalGrams: 350,
      ingredients: [
        { name: "Chicken", grams: 150, calories: 240, proteinG: 45, carbsG: 0, fatG: 5 },
        { name: "Rice", grams: 200, calories: 260, proteinG: 5, carbsG: 58, fatG: 1 },
      ],
      calories: 500,
      proteinG: 50,
      carbsG: 58,
      fatG: 6,
    },
  };
}

function workoutInterpretation(): Extract<InterpretEntryResponse, { intent: "workout_set" }> {
  return {
    intent: "workout_set",
    payload: {
      exerciseName: "Bench Press",
      exerciseType: "resistance",
      reps: 8,
      weightKg: 80,
      durationMinutes: null,
      notes: null,
      confidence: 0.96,
      assumptions: [],
    },
  };
}

function stepsInterpretation(): Extract<InterpretEntryResponse, { intent: "steps" }> {
  return {
    intent: "steps",
    payload: { value: 12345.4, confidence: 0.98, assumptions: [], unit: "steps" },
  };
}

function weightInterpretation(): Extract<InterpretEntryResponse, { intent: "weight" }> {
  return {
    intent: "weight",
    payload: { value: 72.4, confidence: 0.97, assumptions: [], unit: "kg" },
  };
}

function questionInterpretation(): Extract<InterpretEntryResponse, { intent: "question" }> {
  return {
    intent: "question",
    payload: { answer: "You are trending on target." },
  };
}

function photoAttachment(): PhotoAttachment {
  return {
    uri: "file:///meal.jpg",
    name: "meal.jpg",
    type: "image/jpeg",
    width: 1200,
    height: 900,
  };
}

function voiceRecording(options: { uri?: string | null; durationMillis?: number } = {}): CommandCenterVoiceRecording {
  return {
    clearDurationUpdates: () => undefined,
    stopAndUnload: async () => undefined,
    getDurationMillis: async () => options.durationMillis ?? 1800,
    getUri: () => options.uri ?? "file:///voice.m4a",
  };
}

function workoutReviewDraft(): Extract<ReviewDraft, { kind: "workout" }> {
  return {
    kind: "workout",
    interpreted: workoutInterpretation(),
    transcript: "bench press 80kg for 8 reps and 70kg for 10 reps",
    source: "text",
    confidence: 0.96,
    exerciseTypeLabel: "BARBELL",
    sessionLabel: "New Session",
    sets: [
      { id: "set-1", setNumber: 1, weightKg: "80", reps: "8", notes: "" },
      { id: "set-2", setNumber: 2, weightKg: "70", reps: "10", notes: "backoff" },
    ],
  };
}

function mealReviewDraft(): Extract<ReviewDraft, { kind: "meal" }> {
  const interpreted = mealInterpretation();
  return {
    kind: "meal",
    interpreted,
    transcript: "chicken rice bowl",
    source: "text",
    eatenAtLabel: "10:15 AM",
    totalGrams: 350,
    ingredients: [
      { id: "ing-1", name: "Chicken", grams: 150, calories: 240, proteinG: 45, carbsG: 0, fatG: 5 },
      { id: "ing-2", name: "Rice", grams: 200, calories: 260, proteinG: 5, carbsG: 58, fatG: 1 },
    ],
    macros: { protein: 50, carbs: 58, fat: 6 },
  };
}

function createHarness(options: {
  text: string;
  commandState?: CommandState;
  interpreted?: InterpretEntryResponse;
  screenContext?: ScreenContext;
  kcalLeft?: number | null;
  voiceTranscript?: string;
  reviewDraft?: ReviewDraft | null;
  errorSubtype?: CommandErrorSubtype;
  pendingSaveAction?: SaveAction | null;
  selectedPhoto?: PhotoAttachment | null;
  activeRecording?: CommandCenterVoiceRecording | null;
  microphonePermission?: boolean;
  photoPermission?: boolean;
  pickedPhoto?: PhotoAttachment | null;
  selectedPhotoSource?: "camera" | "library" | null;
  transcribedText?: string;
  openSettingsReject?: boolean;
  interpretedIngredient?: MealIngredient;
  previewEnabled?: boolean;
}) {
  let currentCommandState = options.commandState ?? "cc_expanded_empty";
  let commandText = options.text;
  let voiceTranscript = options.voiceTranscript ?? "";
  let recordingSeconds = 0;
  let isInterpretingVoice = false;
  let selectedPhoto = options.selectedPhoto ?? null;
  let activeRecording = options.activeRecording ?? null;
  let reviewDraft = options.reviewDraft ?? null;
  let pendingSaveAction = options.pendingSaveAction ?? null;
  let commandToast: string | null = null;
  let lastSavedKcalLeft: number | null = null;
  let commandErrorSubtype = options.errorSubtype ?? null;
  let commandErrorDetail: string | null = null;

  const calls = {
    interpreted: [] as Array<{ transcript: string; source: string }>,
    pendingMeals: [] as Array<{ transcript: string; source: string }>,
    pendingPhotoMeals: [] as Array<{ photo: PhotoAttachment; context: string }>,
    transcribedAudio: [] as unknown[],
    meals: [] as unknown[],
    workoutSets: [] as unknown[],
    dailyMetrics: [] as unknown[],
    conversations: [] as unknown[],
    refreshed: 0,
    finished: [] as Array<{ toast: string; kcalLeft: number | null | undefined }>,
    states: [] as CommandState[],
    errors: [] as unknown[],
    reviewDrafts: [] as unknown[],
    pendingActions: [] as unknown[],
    fetchedIngredients: [] as Array<{ name: string; grams?: number }>,
    selectedPhotos: [] as Array<PhotoAttachment | null>,
    commandTexts: [] as string[],
    voiceTranscripts: [] as string[],
    errorDetails: [] as Array<string | null>,
    commandToasts: [] as string[],
    closes: 0,
    recordingSeconds: [] as number[],
    activeRecordings: [] as Array<CommandCenterVoiceRecording | null>,
    interpretingVoice: [] as boolean[],
    microphonePermissions: 0,
    startedVoiceRecordings: 0,
    photoPermissions: [] as string[],
    pickedPhotoModes: [] as string[],
    selectedPhotoSources: 0,
    openedSettings: 0,
    delays: [] as number[],
    ensuredSessions: 0,
  };

  const ports: CommandCenterPorts = {
    state: {
      getCommandState: () => currentCommandState,
      getCommandText: () => commandText,
      getVoiceTranscript: () => voiceTranscript,
      getRecordingSeconds: () => recordingSeconds,
      getIsInterpretingVoice: () => isInterpretingVoice,
      getScreenContext: () => options.screenContext ?? {},
      getSelectedMealPhoto: () => selectedPhoto,
      getActiveRecording: () => activeRecording,
      getReviewDraft: () => reviewDraft,
      getCommandToast: () => commandToast,
      getLastSavedKcalLeft: () => lastSavedKcalLeft,
      getCommandErrorSubtype: () => commandErrorSubtype,
      getCommandErrorDetail: () => commandErrorDetail,
      getQuickAddItems: () => [],
      getIsWebPreview: () => options.previewEnabled ?? false,
      getPendingSaveAction: () => pendingSaveAction,
      setCommandState: (state) => {
        currentCommandState = state;
        calls.states.push(state);
      },
      setCommandError: (subtype, detail) => {
        commandErrorSubtype = subtype;
        commandErrorDetail = detail ?? null;
        currentCommandState = "cc_error";
        calls.errors.push({ subtype, detail });
      },
      setCommandErrorDetail: (detail) => {
        commandErrorDetail = detail;
        calls.errorDetails.push(detail);
      },
      setReviewDraft: (draft) => {
        reviewDraft = draft;
        calls.reviewDrafts.push(draft);
      },
      setPendingSaveAction: (action) => {
        pendingSaveAction = action;
        calls.pendingActions.push(action);
      },
      setSelectedMealPhoto: (photo) => {
        selectedPhoto = photo;
        calls.selectedPhotos.push(photo);
      },
      setCommandText: (text) => {
        commandText = text;
        calls.commandTexts.push(text);
      },
      setVoiceTranscript: (text) => {
        voiceTranscript = text;
        calls.voiceTranscripts.push(text);
      },
      setRecordingSeconds: (seconds) => {
        recordingSeconds = seconds;
        calls.recordingSeconds.push(seconds);
      },
      setActiveRecording: (recording) => {
        activeRecording = recording;
        calls.activeRecordings.push(recording);
      },
      setIsInterpretingVoice: (value) => {
        isInterpretingVoice = value;
        calls.interpretingVoice.push(value);
      },
      setCommandToast: (toast) => {
        commandToast = toast;
        calls.commandToasts.push(toast);
      },
      closeCommandCenter: () => {
        calls.closes += 1;
      },
      clearCommandError: () => {
        commandErrorSubtype = null;
        commandErrorDetail = null;
        calls.errors.push("cleared");
      },
    },
    auth: {
      getToken: async () => "test-token",
    },
    backend: {
      interpretEntry: async (transcript, source) => {
        calls.interpreted.push({ transcript, source });
        if (!options.interpreted) throw new Error("No interpretation configured");
        return options.interpreted;
      },
      createPendingMealFromText: async (transcript, source) => {
        calls.pendingMeals.push({ transcript, source });
      },
      createPendingMealFromPhoto: async (photo, context) => {
        calls.pendingPhotoMeals.push({ photo, context });
      },
      transcribeAudio: async (audio) => {
        calls.transcribedAudio.push(audio);
        return options.transcribedText ?? "I had chicken rice for lunch";
      },
      createMeal: async (input) => {
        calls.meals.push(input);
      },
      ensureQuickSession: async () => {
        calls.ensuredSessions += 1;
        return "quick-session-1";
      },
      createWorkoutSet: async (input) => {
        calls.workoutSets.push(input);
      },
      upsertDailyMetrics: async (input) => {
        calls.dailyMetrics.push(input);
      },
      createConversation: async (input) => {
        calls.conversations.push(input);
      },
      fetchInterpretedIngredient: async (name, grams) => {
        calls.fetchedIngredients.push({ name, grams });
        return options.interpretedIngredient ?? {
          name,
          grams: grams ?? 100,
          calories: 150,
          proteinG: 10,
          carbsG: 12,
          fatG: 4,
        };
      },
    },
    cache: {
      refreshAfterSave: async () => {
        calls.refreshed += 1;
      },
      computeKcalLeftAfterMeal: () => options.kcalLeft ?? null,
    },
    clock: {
      now: () => fixedNow,
    },
    preview: {
      isEnabled: () => options.previewEnabled ?? false,
      hasFlag: () => false,
      delay: async (ms) => {
        calls.delays.push(ms);
      },
    },
    feedback: {
      finishWithSaved: (toast, kcalLeft) => calls.finished.push({ toast, kcalLeft }),
    },
    media: {
      requestMicrophonePermission: async () => {
        calls.microphonePermissions += 1;
        return options.microphonePermission ?? true;
      },
      startVoiceRecording: async () => {
        calls.startedVoiceRecordings += 1;
        return voiceRecording();
      },
      requestPhotoPermission: async (mode) => {
        calls.photoPermissions.push(mode);
        return options.photoPermission ?? true;
      },
      pickMealPhoto: async (mode) => {
        calls.pickedPhotoModes.push(mode);
        return options.pickedPhoto === undefined ? photoAttachment() : options.pickedPhoto;
      },
    },
    platform: {
      isWeb: () => false,
      openSettings: async () => {
        calls.openedSettings += 1;
        if (options.openSettingsReject) throw new Error("Settings unavailable");
      },
      selectPhotoSource: async () => {
        calls.selectedPhotoSources += 1;
        return options.selectedPhotoSource ?? "library";
      },
    },
  };

  return {
    calls,
    controller: createCommandCenterController(ports),
  };
}

beforeEach(() => {
  globalThis.__DEV__ = false;
});

describe("CommandCenterController lifecycle boundary", () => {
  test("open resets entry state and expands empty", () => {
    const { controller, calls } = createHarness({
      text: "stale text",
      selectedPhoto: photoAttachment(),
      reviewDraft: workoutReviewDraft(),
    });

    controller.openCommandCenter();

    expect(calls.commandTexts).toEqual([""]);
    expect(calls.voiceTranscripts).toEqual([""]);
    expect(calls.recordingSeconds).toEqual([0]);
    expect(calls.interpretingVoice).toEqual([false]);
    expect(calls.reviewDrafts).toEqual([null]);
    expect(calls.selectedPhotos).toEqual([null]);
    expect(calls.errors).toEqual(["cleared"]);
    expect(calls.states).toEqual(["cc_expanded_empty"]);
  });

  test("text change enters and exits typing state from expanded states", () => {
    const typingHarness = createHarness({
      text: "",
      commandState: "cc_expanded_empty",
    });

    typingHarness.controller.handleCommandInputChange("bench");

    expect(typingHarness.calls.commandTexts).toEqual(["bench"]);
    expect(typingHarness.calls.states).toEqual(["cc_expanded_typing"]);

    const emptyHarness = createHarness({
      text: "",
      commandState: "cc_expanded_typing",
    });

    emptyHarness.controller.handleCommandInputChange("   ");

    expect(emptyHarness.calls.commandTexts).toEqual(["   "]);
    expect(emptyHarness.calls.states).toEqual(["cc_expanded_empty"]);
  });

  test("close delegates to the platform/provider cleanup boundary", () => {
    const { controller, calls } = createHarness({ text: "" });

    controller.closeCommandCenter();

    expect(calls.closes).toBe(1);
  });

  test("snapshot exposes the overlay-facing state shape", () => {
    const photo = photoAttachment();
    const draft = workoutReviewDraft();
    const { controller } = createHarness({
      text: "bench press",
      commandState: "cc_review_workout",
      voiceTranscript: "bench press",
      selectedPhoto: photo,
      reviewDraft: draft,
      screenContext: { screen: "workout", sessionId: "active-session-1" },
      errorSubtype: "voice_interpret_failure",
    });

    const snapshot = controller.getSnapshot();

    expect(snapshot.state).toBe("cc_review_workout");
    expect(snapshot.isOpen).toBe(true);
    expect(snapshot.input.text).toBe("bench press");
    expect(snapshot.input.voiceTranscript).toBe("bench press");
    expect(snapshot.input.selectedMealPhoto).toBe(photo);
    expect(snapshot.review).toBe(draft);
    expect(snapshot.screenContext).toEqual({ screen: "workout", sessionId: "active-session-1" });
    expect(snapshot.error.copy?.primary).toBe("Retry voice");
  });

  test("dispatch routes overlay events and notifies subscribers", () => {
    const { controller, calls } = createHarness({
      text: "",
      commandState: "cc_expanded_empty",
    });
    let notificationCount = 0;
    const unsubscribe = controller.subscribe(() => {
      notificationCount += 1;
    });

    controller.dispatch({ type: "text.change", text: "bench" });
    unsubscribe();
    controller.dispatch({ type: "text.change", text: "bench press" });

    expect(calls.commandTexts).toEqual(["bench", "bench press"]);
    expect(calls.states).toEqual(["cc_expanded_typing"]);
    expect(notificationCount).toBe(1);
    expect(controller.getSnapshot().input.text).toBe("bench press");
  });
});

describe("CommandCenterController typed entry boundary", () => {
  test("typed meal-looking text creates a pending meal without interpretation", async () => {
    const { controller, calls } = createHarness({
      text: "I had chicken rice for lunch",
      interpreted: mealInterpretation(),
    });

    await controller.submitTypedText();

    expect(calls.states).toEqual(["cc_submitting_typed"]);
    expect(calls.interpreted).toEqual([]);
    expect(calls.pendingMeals).toEqual([
      { transcript: "I had chicken rice for lunch", source: "text" },
    ]);
  });

  test("typed workout opens workout review instead of saving immediately", async () => {
    const { controller, calls } = createHarness({
      text: "bench press 80kg for 8 reps",
      interpreted: workoutInterpretation(),
    });

    await controller.submitTypedText();

    expect(calls.interpreted).toEqual([
      { transcript: "bench press 80kg for 8 reps", source: "text" },
    ]);
    expect(calls.reviewDrafts).toHaveLength(1);
    expect(calls.states).toContain("cc_review_workout");
    expect(calls.workoutSets).toEqual([]);
  });

  test("workout save routes into the active session id", async () => {
    const { controller, calls } = createHarness({
      text: "unused",
      screenContext: { screen: "workout", sessionId: "active-session-1" },
    });

    await controller.runSaveAction({
      kind: "entry",
      interpreted: workoutInterpretation(),
      transcript: "bench press 80kg for 8 reps",
      source: "text",
    });

    expect(calls.ensuredSessions).toBe(0);
    expect(calls.workoutSets).toEqual([
      {
        sessionId: "active-session-1",
        exerciseName: "Bench Press",
        exerciseType: "resistance",
        reps: 8,
        weightKg: 80,
        durationMinutes: null,
        notes: null,
        performedAt: fixedNow.toISOString(),
        transcriptRaw: "bench press 80kg for 8 reps",
      },
    ]);
    expect(calls.refreshed).toBe(1);
    expect(calls.finished).toEqual([{ toast: "Saved", kcalLeft: null }]);
  });

  test("steps intent saves local-date daily metrics", async () => {
    const { controller, calls } = createHarness({
      text: "12345 steps",
      interpreted: stepsInterpretation(),
    });

    await controller.submitTypedText();

    expect(calls.dailyMetrics).toEqual([{ date: "2026-05-19", steps: 12345 }]);
    expect(calls.refreshed).toBe(1);
    expect(calls.finished).toEqual([{ toast: "Saved", kcalLeft: null }]);
  });

  test("weight intent saves local-date daily metrics", async () => {
    const { controller, calls } = createHarness({
      text: "weight 72.4 kg",
      interpreted: weightInterpretation(),
    });

    await controller.submitTypedText();

    expect(calls.dailyMetrics).toEqual([{ date: "2026-05-19", weightKg: 72.4 }]);
    expect(calls.refreshed).toBe(1);
    expect(calls.finished).toEqual([{ toast: "Saved", kcalLeft: null }]);
  });

  test("question intent saves a conversation event and shows the answer", async () => {
    const { controller, calls } = createHarness({
      text: "How am I doing this week?",
      interpreted: questionInterpretation(),
    });

    await controller.submitTypedText();

    expect(calls.conversations).toEqual([
      {
        kind: "question",
        userText: "How am I doing this week?",
        systemText: "You are trending on target.",
        source: "text",
        referenceType: null,
        referenceId: null,
        metadata: { answer: "You are trending on target." },
      },
    ]);
    expect(calls.refreshed).toBe(1);
    expect(calls.finished).toEqual([
      { toast: "You are trending on target.", kcalLeft: undefined },
    ]);
  });
});

describe("CommandCenterController voice/photo boundary", () => {
  test("voice start records permission denial as a mic error", async () => {
    const { controller, calls } = createHarness({
      text: "",
      microphonePermission: false,
    });

    await controller.startRecording();

    expect(calls.microphonePermissions).toBe(1);
    expect(calls.startedVoiceRecordings).toBe(0);
    expect(calls.errors).toContainEqual({ subtype: "mic_permission_denied", detail: undefined });
  });

  test("voice stop transcribes and routes meal-looking transcript as voice", async () => {
    const { controller, calls } = createHarness({
      text: "",
      activeRecording: voiceRecording({ durationMillis: 2000 }),
      transcribedText: " I had chicken rice for lunch ",
    });

    await controller.stopRecording();

    expect(calls.states).toContain("cc_transcribing_voice");
    expect(calls.transcribedAudio).toEqual([
      { uri: "file:///voice.m4a", name: "voicefit-1779185700000.m4a", type: "audio/m4a" },
    ]);
    expect(calls.voiceTranscripts).toEqual(["I had chicken rice for lunch"]);
    expect(calls.pendingMeals).toEqual([
      { transcript: "I had chicken rice for lunch", source: "voice" },
    ]);
    expect(calls.interpretingVoice).toEqual([true, false]);
  });

  test("voice stop rejects too-short recordings", async () => {
    const { controller, calls } = createHarness({
      text: "",
      activeRecording: voiceRecording({ durationMillis: 500 }),
    });

    await controller.stopRecording();

    expect(calls.transcribedAudio).toEqual([]);
    expect(calls.errors).toContainEqual({
      subtype: "voice_interpret_failure",
      detail: "Recording is too short. Please record at least 1 second.",
    });
  });

  test("photo picker records permission denial", async () => {
    const { controller, calls } = createHarness({
      text: "",
      photoPermission: false,
    });

    await controller.launchPhotoPicker("camera");

    expect(calls.photoPermissions).toEqual(["camera"]);
    expect(calls.pickedPhotoModes).toEqual([]);
    expect(calls.errors).toContainEqual({ subtype: "photo_permission_denied", detail: undefined });
  });

  test("photo picker stores selected photo and opens context state", async () => {
    const photo = photoAttachment();
    const { controller, calls } = createHarness({
      text: "some context",
      pickedPhoto: photo,
    });

    await controller.openPhotoMenu();

    expect(calls.selectedPhotoSources).toBe(1);
    expect(calls.photoPermissions).toEqual(["library"]);
    expect(calls.pickedPhotoModes).toEqual(["library"]);
    expect(calls.selectedPhotos).toEqual([photo]);
    expect(calls.commandTexts).toEqual([""]);
    expect(calls.states).toContain("cc_photo_context");
  });

  test("photo submit creates a pending meal from selected photo and context", async () => {
    const photo = photoAttachment();
    const { controller, calls } = createHarness({
      text: "late dinner",
      selectedPhoto: photo,
    });

    await controller.submitPhotoMeal();

    expect(calls.states).toContain("cc_submitting_photo");
    expect(calls.pendingPhotoMeals).toEqual([{ photo, context: "late dinner" }]);
  });
});

describe("CommandCenterController review and retry boundary", () => {
  test("reviewed workout saves filled sets into the active session and closes", async () => {
    const { controller, calls } = createHarness({
      text: "",
      reviewDraft: workoutReviewDraft(),
      screenContext: { screen: "workout", sessionId: "active-session-1" },
    });

    await controller.saveReviewedEntry();

    expect(calls.states).toContain("cc_saving");
    expect(calls.workoutSets).toEqual([
      {
        sessionId: "active-session-1",
        exerciseName: "Bench Press",
        exerciseType: "resistance",
        reps: 8,
        weightKg: 80,
        durationMinutes: null,
        notes: null,
        performedAt: fixedNow.toISOString(),
        transcriptRaw: "bench press 80kg for 8 reps and 70kg for 10 reps",
      },
      {
        sessionId: "active-session-1",
        exerciseName: "Bench Press",
        exerciseType: "resistance",
        reps: 10,
        weightKg: 70,
        durationMinutes: null,
        notes: "backoff",
        performedAt: fixedNow.toISOString(),
        transcriptRaw: "bench press 80kg for 8 reps and 70kg for 10 reps",
      },
    ]);
    expect(calls.refreshed).toBe(1);
    expect(calls.commandToasts).toEqual(["Saved 2 sets"]);
    expect(calls.closes).toBe(1);
  });

  test("edit review transcript restores text editing state", () => {
    const { controller, calls } = createHarness({
      text: "",
      reviewDraft: workoutReviewDraft(),
    });

    controller.editReviewTranscript();

    expect(calls.commandTexts).toEqual(["bench press 80kg for 8 reps and 70kg for 10 reps"]);
    expect(calls.voiceTranscripts).toEqual(["bench press 80kg for 8 reps and 70kg for 10 reps"]);
    expect(calls.reviewDrafts).toEqual([null]);
    expect(calls.states).toContain("cc_expanded_typing");
  });

  test("primary save error action retries the pending save action", async () => {
    const pendingSaveAction: SaveAction = {
      kind: "quick_add",
      item: { id: "recent-1", description: "Chicken Salad", calories: 420, mealType: "lunch" },
    };
    const { controller, calls } = createHarness({
      text: "",
      errorSubtype: "quick_add_failure",
      pendingSaveAction,
      kcalLeft: 380,
    });

    await controller.handleErrorPrimary();

    expect(calls.meals).toEqual([
      {
        eatenAt: fixedNow.toISOString(),
        mealType: "lunch",
        description: "Chicken Salad",
        calories: 420,
        transcriptRaw: "quick_add:Chicken Salad",
      },
    ]);
    expect(calls.finished).toEqual([{ toast: "Saved", kcalLeft: 380 }]);
  });

  test("primary permission action opens settings and records fallback detail on failure", async () => {
    const { controller, calls } = createHarness({
      text: "",
      errorSubtype: "photo_permission_denied",
      openSettingsReject: true,
    });

    await controller.handleErrorPrimary();

    expect(calls.openedSettings).toBe(1);
    expect(calls.errorDetails).toEqual(["Open your device settings and enable camera or photo access."]);
  });

  test("secondary voice error moves transcript back into text editing", () => {
    const { controller, calls } = createHarness({
      text: "",
      voiceTranscript: "bench press 80kg for 8 reps",
      errorSubtype: "voice_interpret_failure",
    });

    controller.handleErrorSecondary();

    expect(calls.commandTexts).toEqual(["bench press 80kg for 8 reps"]);
    expect(calls.states).toContain("cc_expanded_typing");
  });

  test("secondary photo error clears the selected photo and returns to text state", () => {
    const photo = photoAttachment();
    const { controller, calls } = createHarness({
      text: "late dinner",
      selectedPhoto: photo,
      errorSubtype: "photo_interpret_failure",
    });

    controller.handleErrorSecondary();

    expect(calls.selectedPhotos).toEqual([null]);
    expect(calls.states).toContain("cc_expanded_typing");
  });
});

describe("CommandCenterController review draft editing boundary", () => {
  test("workout set editing updates existing sets and appends a blank set", () => {
    const { controller, calls } = createHarness({
      text: "",
      reviewDraft: workoutReviewDraft(),
    });

    controller.updateWorkoutSet(0, { weightKg: "82.5", notes: "felt strong" });
    controller.addWorkoutSet();

    const updatedDraft = calls.reviewDrafts.at(-1) as Extract<ReviewDraft, { kind: "workout" }>;
    expect(updatedDraft.sets).toEqual([
      { id: "set-1", setNumber: 1, weightKg: "82.5", reps: "8", notes: "felt strong" },
      { id: "set-2", setNumber: 2, weightKg: "70", reps: "10", notes: "backoff" },
      { id: "set-3", setNumber: 3, weightKg: "", reps: "", notes: "" },
    ]);
  });

  test("meal ingredient gram edits recalculate visible totals and save payload", () => {
    const { controller, calls } = createHarness({
      text: "",
      reviewDraft: mealReviewDraft(),
    });

    controller.editIngredientGrams("ing-1", 300);

    const updatedDraft = calls.reviewDrafts.at(-1) as Extract<ReviewDraft, { kind: "meal" }>;
    expect(updatedDraft.totalGrams).toBe(500);
    expect(updatedDraft.interpreted.payload.calories).toBe(740);
    expect(updatedDraft.macros).toEqual({ protein: 95, carbs: 58, fat: 11 });
    expect(updatedDraft.interpreted.payload.ingredients[0]).toEqual({
      name: "Chicken",
      grams: 300,
      calories: 480,
      proteinG: 90,
      carbsG: 0,
      fatG: 10,
    });
  });

  test("meal ingredient replace add and remove keep totals in sync", () => {
    const { controller, calls } = createHarness({
      text: "",
      reviewDraft: mealReviewDraft(),
    });

    controller.replaceIngredient("ing-2", {
      name: "Potatoes",
      grams: 180,
      calories: 160,
      proteinG: 4,
      carbsG: 36,
      fatG: 0,
    });
    controller.addIngredient({
      name: "Olive oil",
      grams: 10,
      calories: 90,
      proteinG: 0,
      carbsG: 0,
      fatG: 10,
    });
    controller.removeIngredient("ing-1");

    const updatedDraft = calls.reviewDrafts.at(-1) as Extract<ReviewDraft, { kind: "meal" }>;
    expect(updatedDraft.ingredients.map((ingredient) => ingredient.name)).toEqual(["Potatoes", "Olive oil"]);
    expect(updatedDraft.totalGrams).toBe(190);
    expect(updatedDraft.interpreted.payload.calories).toBe(250);
    expect(updatedDraft.macros).toEqual({ protein: 4, carbs: 36, fat: 10 });
  });

  test("ingredient lookup trims names and delegates to backend outside preview", async () => {
    const { controller, calls } = createHarness({
      text: "",
      interpretedIngredient: {
        name: "Banana",
        grams: 120,
        calories: 105,
        proteinG: 1,
        carbsG: 27,
        fatG: 0,
      },
    });

    const ingredient = await controller.fetchInterpretedIngredient("  Banana  ", 120);

    expect(calls.fetchedIngredients).toEqual([{ name: "Banana", grams: 120 }]);
    expect(ingredient).toEqual({
      name: "Banana",
      grams: 120,
      calories: 105,
      proteinG: 1,
      carbsG: 27,
      fatG: 0,
    });
  });

  test("ingredient lookup uses preview defaults when preview is enabled", async () => {
    const { controller, calls } = createHarness({
      text: "",
      previewEnabled: true,
    });

    const ingredient = await controller.fetchInterpretedIngredient("  Almonds  ", 50);

    expect(calls.fetchedIngredients).toEqual([]);
    expect(calls.delays).toContain(700);
    expect(ingredient).toEqual({
      name: "Almonds",
      grams: 50,
      calories: 75,
      proteinG: 5,
      carbsG: 3,
      fatG: 2,
    });
  });
});
