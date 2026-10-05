import { beforeEach, describe, expect, test } from "bun:test";
import type { InterpretEntryResponse } from "@voicefit/contracts/types";
import {
  createCommandCenterController,
  type CommandCenterVoiceRecording,
  type CommandCenterPorts,
} from "@/components/command-center/controller";
import type { CommandErrorSubtype, CommandState, PhotoAttachment, ReviewDraft, SaveAction, ScreenContext } from "@/components/command-center/types";

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


function createHarness(options: {
  text: string;
  commandState?: CommandState;
  interpreted?: InterpretEntryResponse;
  screenContext?: ScreenContext;
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
  let commandErrorSubtype = options.errorSubtype ?? null;
  let commandErrorDetail: string | null = null;

  const calls = {
    interpreted: [] as Array<{ transcript: string; source: string }>,
    pendingMeals: [] as Array<{ transcript: string; source: string }>,
    pendingPhotoMeals: [] as Array<{ photo: PhotoAttachment; context: string }>,
    transcribedAudio: [] as unknown[],
    workoutSets: [] as unknown[],
    dailyMetrics: [] as unknown[],
    coach: [] as string[],
    refreshed: 0,
    finished: [] as Array<{ toast: string; kind?: string }>,
    states: [] as CommandState[],
    errors: [] as unknown[],
    reviewDrafts: [] as unknown[],
    pendingActions: [] as unknown[],
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
      ensureQuickSession: async () => {
        calls.ensuredSessions += 1;
        return "quick-session-1";
      },
      createWorkoutBatch: async (input) => { calls.workoutSets.push(...input.sets); },
      createWorkoutSet: async (input) => {
        calls.workoutSets.push(input);
      },
      upsertDailyMetrics: async (input) => {
        calls.dailyMetrics.push(input);
      },
    },
    cache: {
      refreshAfterSave: async () => {
        calls.refreshed += 1;
      },
    },
    clock: {
      now: () => fixedNow,
      createRequestId: () => "d1262a00-1122-4333-8444-555566667777",
    },
    preview: {
      isEnabled: () => options.previewEnabled ?? false,
      hasFlag: () => false,
      delay: async (ms) => {
        calls.delays.push(ms);
      },
    },
    feedback: {
      finishWithSaved: (toast, kind) => calls.finished.push({ toast, kind }),
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
      isWeb: () => false, openCoach: (prompt: string) => { calls.coach.push(prompt); },
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
    ports,
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
    expect(snapshot.error.copy?.primary).toBe("Try again");
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

    expect(calls.states).toEqual(["cc_submitting_typed", "cc_saving"]);
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
    expect(calls.finished).toEqual([{ toast: "Saved" }]);
  });

  test("steps intent saves local-date daily metrics", async () => {
    const { controller, calls } = createHarness({
      text: "12345 steps",
      interpreted: stepsInterpretation(),
    });

    await controller.submitTypedText();

    expect(calls.dailyMetrics).toEqual([{ date: "2026-05-19", steps: 12345 }]);
    expect(calls.refreshed).toBe(1);
    expect(calls.finished).toEqual([{ toast: "Saved" }]);
  });

  test("weight intent saves local-date daily metrics", async () => {
    const { controller, calls } = createHarness({
      text: "weight 72.4 kg",
      interpreted: weightInterpretation(),
    });

    await controller.submitTypedText();

    expect(calls.dailyMetrics).toEqual([{ date: "2026-05-19", weightKg: 72.4 }]);
    expect(calls.refreshed).toBe(1);
    expect(calls.finished).toEqual([{ toast: "Saved" }]);
  });

  test("questions open Coach pre-filled without calling the server", async () => {
    const { controller, calls } = createHarness({
      text: "How am I doing this week?",
      interpreted: questionInterpretation(),
    });

    await controller.submitTypedText();

    expect(calls.interpreted).toEqual([]);
    expect(calls.coach).toEqual(["How am I doing this week?"]);
    expect(calls.closes).toBe(1);
    expect(calls.finished).toEqual([]);
  });

  test("a question only the classifier recognises still opens Coach", async () => {
    const { controller, calls } = createHarness({
      text: "remaining calories for today",
      interpreted: questionInterpretation(),
    });

    await controller.submitTypedText();

    expect(calls.interpreted).toEqual([{ transcript: "remaining calories for today", source: "text" }]);
    expect(calls.coach).toEqual(["remaining calories for today"]);
    expect(calls.pendingMeals).toEqual([]);
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

    expect(calls.states).toContain("cc_saving");
    expect(calls.pendingPhotoMeals).toEqual([{ photo, context: "late dinner" }]);
  });
});

describe("CommandCenterController review and retry boundary", () => {
  test("workout direct-save entry cannot bypass identity safeguards or silently drop repeated sets", async () => {
    const unsafe = createHarness({ text: 'bench press 8 reps and squats 8 reps' });
    await unsafe.controller.runSaveAction({ kind: 'entry', interpreted: workoutInterpretation(), transcript: 'bench press 8 reps and squats 8 reps', source: 'text' });
    expect(unsafe.calls.workoutSets).toEqual([]);
    expect(unsafe.calls.ensuredSessions).toBe(0);
    expect(unsafe.calls.finished).toEqual([]);
    const repeated = createHarness({ text: '' });
    await repeated.controller.runSaveAction({ kind: 'entry', interpreted: workoutInterpretation(), transcript: 'bench press 3 sets of 8 at 80 kg', source: 'text' });
    expect(repeated.calls.workoutSets).toEqual([]);
    expect(repeated.ports.state.getCommandState()).toBe('cc_review_workout');
    expect(repeated.ports.state.getReviewDraft()?.kind).toBe('workout');
    expect(repeated.calls.finished).toEqual([]);
  });
  test("workout save rejects a stale multi-exercise review and offers correction without dropping text", async () => {
    const draft = { ...workoutReviewDraft(), transcript: 'bench press 8 reps at 80 kg then squats 8 reps at 100 kg' };
    const { controller, calls, ports } = createHarness({ text: '', reviewDraft: draft });
    await controller.saveReviewedEntry();
    expect(calls.workoutSets).toEqual([]);
    expect(calls.ensuredSessions).toBe(0);
    expect(ports.state.getCommandErrorDetail()).toContain('one exercise');
    expect(controller.getSnapshot().error.copy?.secondary).toBe('Edit entry');
    controller.handleErrorSecondary();
    expect(ports.state.getCommandText()).toBe(draft.transcript);
    expect(ports.state.getCommandState()).toBe('cc_expanded_typing');
    expect(calls.closes).toBe(0);
  });

  for (const entry of [
    { transcript: "bench press 3x8 at 80 kg, donkey kicks 3x12", name: "Bench Press" },
    { transcript: "donkey kicks 3x12 then fire hydrants 3x15", name: "Donkey Kick" },
  ]) {
    test(`unknown exercise clauses are rejected at interpretation, direct save and reviewed save: ${entry.name}`, async () => {
      const response = { ...workoutInterpretation(), payload: { ...workoutInterpretation().payload, exerciseName: entry.name } };
      const typed = createHarness({ text: entry.transcript, interpreted: response });
      await typed.controller.submitTypedText();
      expect(typed.ports.state.getReviewDraft()).toBeNull();
      expect(typed.ports.state.getCommandErrorDetail()).toContain("one exercise");
      const direct = createHarness({ text: entry.transcript });
      await direct.controller.runSaveAction({ kind: "entry", interpreted: response, transcript: entry.transcript, source: "text" });
      expect(direct.ports.state.getCommandErrorDetail()).toContain("one exercise");
      const reviewed = createHarness({ text: "", reviewDraft: { ...workoutReviewDraft(), interpreted: response, transcript: entry.transcript } });
      await reviewed.controller.dispatch({ type: "review.save" });
      expect(reviewed.controller.getSnapshot().error.copy?.secondary).toBe("Edit entry");
      reviewed.controller.handleErrorSecondary();
      expect(reviewed.ports.state.getCommandText()).toBe(entry.transcript);
      expect(reviewed.ports.state.getCommandState()).toBe("cc_expanded_typing");
      for (const harness of [typed, direct, reviewed]) {
        expect(harness.calls.workoutSets).toEqual([]);
        expect(harness.calls.ensuredSessions).toBe(0);
        expect(harness.calls.commandToasts).toEqual([]);
      }
    });
  }

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
    expect(calls.finished).toEqual([{ toast: "Sets added", kind: "workout" }]);
    expect(calls.closes).toBe(0); // ACK initiates feedback dismissal, not a review reset.
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
    const { controller, calls, ports } = createHarness({
      text: "",
      errorSubtype: "quick_add_failure",
      pendingSaveAction,
    });
    const selected: string[] = [];
    Object.assign(ports.backend, { selectRepeatedMeal: (id: string) => { selected.push(id); } });

    await controller.handleErrorPrimary();

    expect(selected).toEqual(["recent-1"]);
    expect(calls.finished).toEqual([]);
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

});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("logging races and safe retries", () => {
  test("closing and reopening ignores an old interpretation even if the backend ignores abort", async () => {
    const { ports, controller, calls } = createHarness({ text: "bench press" });
    const pending = deferred<InterpretEntryResponse>();
    let signal: AbortSignal | undefined;
    ports.backend.interpretEntry = async (_text, _source, requestSignal) => { signal = requestSignal; return pending.promise; };
    const submit = controller.submitTypedText();
    controller.closeCommandCenter();
    controller.openCommandCenter();
    controller.handleCommandInputChange("new entry");
    pending.resolve(workoutInterpretation());
    await submit;
    expect(signal?.aborted).toBe(true);
    expect(calls.states.includes("cc_review_workout")).toBe(false);
    expect(ports.state.getCommandText()).toBe("new entry");
  });

  test("edit invalidates old results across provider controller recreation", async () => {
    const { ports, calls } = createHarness({ text: "bench press" });
    const operation = { generation: 0, saving: false };
    const first = createCommandCenterController(ports, operation);
    const pending = deferred<InterpretEntryResponse>();
    ports.backend.interpretEntry = () => pending.promise;
    const submit = first.submitTypedText();
    const afterRender = createCommandCenterController(ports, operation);
    afterRender.dispatch({ type: "text.edit" });
    pending.reject(new Error("Old request failed"));
    await submit;
    expect(calls.errors).toEqual(["cleared"]);
    expect(ports.state.getCommandState()).toBe("cc_expanded_typing");
  });

  test("a pending meal write blocks duplicate submit and cannot be labelled discarded", async () => {
    const { ports, controller, calls } = createHarness({ text: "I had a banana" });
    const pending = deferred<void>();
    let writes = 0;
    ports.backend.createPendingMealFromText = async () => { writes++; await pending.promise; };
    const submit = controller.submitTypedText();
    controller.closeCommandCenter();
    controller.dispatch({ type: "text.edit" });
    await controller.submitTypedText();
    expect(writes).toBe(1);
    expect(calls.closes).toBe(0);
    expect(ports.state.getCommandState()).toBe("cc_saving");
    pending.resolve();
    await submit;
    expect(calls.finished.length).toBe(1);
  });

  test("uncertain batch blocks Edit entry so Squat cannot masquerade as the frozen Bench Press retry", async () => {
    const { ports, controller, calls } = createHarness({ text: "", reviewDraft: workoutReviewDraft() });
    const batches: Parameters<CommandCenterPorts["backend"]["createWorkoutBatch"]>[0][] = [];
    ports.backend.createWorkoutBatch = async (batch) => {
      batches.push(structuredClone(batch));
      if (batches.length === 1) throw new Error("Request timed out");
    };
    await controller.dispatch({ type: "review.save" });
    await controller.dispatch({ type: "error.secondary" });
    expect(ports.state.getReviewDraft()?.kind).toBe("workout");
    expect(ports.state.getCommandState()).toBe("cc_error");
    expect(controller.getSnapshot().error.copy?.primary).toBe("Retry original");
    expect(controller.getSnapshot().error.copy?.secondary).toBeNull();
    expect(ports.state.getCommandErrorDetail()).toContain("may already be saved");

    ports.backend.interpretEntry = async () => ({ ...workoutInterpretation(), payload: { ...workoutInterpretation().payload, exerciseName: "Squat", reps: 6, weightKg: 100 } });
    controller.handleCommandInputChange("squat 3x6 at 100 kg");
    await controller.submitTypedText();
    expect(ports.state.getReviewDraft()).toEqual(workoutReviewDraft());
    expect(calls.interpreted).toEqual([]);
    await controller.saveReviewedEntry();
    expect(batches).toHaveLength(2);
    expect(batches[1]).toEqual(batches[0]);
    expect(calls.finished).toEqual([{ toast: "Sets added", kind: "workout" }]);
  });

  test("save-time guard retains a changed review until explicit original-batch reconciliation", async () => {
    const { ports, controller, calls } = createHarness({ text: "", reviewDraft: workoutReviewDraft() });
    const batches: Parameters<CommandCenterPorts["backend"]["createWorkoutBatch"]>[0][] = [];
    const committed = new Map<string, typeof batches[number]>();
    ports.backend.createWorkoutBatch = async (batch) => {
      batches.push(structuredClone(batch));
      if (!committed.has(batch.requestId)) committed.set(batch.requestId, structuredClone(batch));
      if (batches.length === 1) throw new Error("Committed, but response lost");
    };
    await controller.dispatch({ type: "review.save" });
    // A stale provider/draft replacement must also fail closed at the write boundary.
    const changed = { ...workoutReviewDraft(), transcript: "squat 3x6 at 100 kg", interpreted: { ...workoutInterpretation(), payload: { ...workoutInterpretation().payload, exerciseName: "Squat", weightKg: 100, reps: 6 } }, sets: Array.from({ length: 3 }, (_, index) => ({ id: `set-${index + 1}`, setNumber: index + 1, weightKg: "100", reps: "6", notes: "" })) };
    ports.state.setReviewDraft(changed);
    await controller.dispatch({ type: "review.save" });
    expect(batches).toHaveLength(1);
    expect(ports.state.getReviewDraft()).toEqual(changed);
    expect(calls.commandToasts).toEqual([]);
    expect(calls.closes).toBe(0);
    expect(ports.state.getCommandErrorDetail()).toContain("changed entry");
    expect(controller.getSnapshot().error.copy?.primary).toBe("Retry original");
    await controller.dispatch({ type: "error.primary" });
    expect(batches).toHaveLength(2);
    expect(batches[1]).toEqual(batches[0]);
    expect(committed.size).toBe(1);
    expect(ports.state.getReviewDraft()).toEqual(changed);
    expect(calls.closes).toBe(0);
    expect(calls.commandToasts).toEqual(["Original Bench Press saved: 2 sets. Changed entry not saved."]);
    expect(controller.getSnapshot().error.copy?.primary).toBe("Close");
    await controller.dispatch({ type: "review.save" });
    expect(batches).toHaveLength(2);
    expect(ports.state.getReviewDraft()).toEqual(changed);
    await controller.dispatch({ type: "error.primary" });
    expect(calls.closes).toBe(1);
  });

  test("unconfirmed workout cannot be abandoned or mutated across controller recreation", async () => {
    const { ports, calls } = createHarness({ text: "", reviewDraft: workoutReviewDraft() });
    const operation = { generation: 0, saving: false };
    const first = createCommandCenterController(ports, operation);
    const batches: Parameters<CommandCenterPorts["backend"]["createWorkoutBatch"]>[0][] = [];
    let requestIds = 0;
    ports.clock.createRequestId = () => { requestIds++; return "d1262a00-1122-4333-8444-555566667777"; };
    ports.backend.createWorkoutBatch = async (batch) => {
      batches.push(structuredClone(batch));
      if (batches.length === 1) throw new Error("Response lost");
    };
    await first.dispatch({ type: "review.save" });
    const recreated = createCommandCenterController(ports, operation);
    recreated.closeCommandCenter();
    expect(calls.closes).toBe(0);
    recreated.openCommandCenter();
    expect(ports.state.getReviewDraft()).toEqual(workoutReviewDraft());
    expect(ports.state.getCommandState()).toBe("cc_error");
    recreated.updateWorkoutSet(0, { weightKg: "100" });
    recreated.addWorkoutSet();
    recreated.dispatch({ type: "text.edit" });
    await recreated.interpretVoiceTranscript("squat 3x6 at 100 kg");
    await recreated.routeInterpretedEntry(workoutInterpretation(), "bench press 3x12 at 90 kg", "text");
    await recreated.runSaveAction({ kind: "entry", interpreted: workoutInterpretation(), transcript: "bench press 8 reps at 90 kg", source: "text" });
    expect(ports.state.getReviewDraft()).toEqual(workoutReviewDraft());
    expect(calls.workoutSets).toEqual([]);
    expect(calls.interpreted).toEqual([]);
    await recreated.dispatch({ type: "error.primary" });
    expect(batches).toHaveLength(2);
    expect(batches[1]).toEqual(batches[0]);
    expect(requestIds).toBe(1);
    expect(calls.ensuredSessions).toBe(1);
    expect(calls.finished).toEqual([{ toast: "Sets added", kind: "workout" }]);
  });

  test("retry submits the exact workout batch and request ID after an uncertain response", async () => {
    const { ports, controller } = createHarness({ text: "", reviewDraft: workoutReviewDraft() });
    const batches: unknown[] = [];
    ports.backend.createWorkoutBatch = async (batch) => {
      batches.push(structuredClone(batch));
      if (batches.length === 1) throw new Error("Request timed out");
    };
    await controller.saveReviewedEntry();
    expect(ports.state.getCommandErrorSubtype()).toBe("auto_save_failure");
    await controller.handleErrorPrimary();
    expect(batches.length).toBe(2);
    expect(batches[1]).toEqual(batches[0]);
  });

  test("double tapping workout save submits only one batch", async () => {
    const { ports, controller } = createHarness({ text: "", reviewDraft: workoutReviewDraft() });
    const pending = deferred<void>();
    let writes = 0;
    ports.backend.createWorkoutBatch = async () => { writes++; await pending.promise; };
    const first = controller.saveReviewedEntry();
    await controller.saveReviewedEntry();
    pending.resolve();
    await first;
    expect(writes).toBe(1);
  });
});

describe('media cancellation and recovery', () => {
  test('a photo picker result arriving after close cannot reopen the sheet', async () => {
    const {ports,controller,calls}=createHarness({text:''});
    const pending=deferred<PhotoAttachment | null>();
    const reached=deferred<void>();
    ports.media.pickMealPhoto=()=>{reached.resolve();return pending.promise;};
    const picking=controller.launchPhotoPicker('library');
    await reached.promise;
    controller.closeCommandCenter();
    controller.openCommandCenter();
    pending.resolve(photoAttachment());
    await picking;
    expect(calls.states.includes('cc_photo_context')).toBe(false);
    expect(ports.state.getCommandState()).toBe('cc_expanded_empty');
  });
  test('late transcription after close cannot create a meal or overwrite a new draft', async () => {
    const {ports,controller,calls}=createHarness({text:'',activeRecording:voiceRecording({durationMillis:2000})});
    const pending=deferred<string>();
    const reached=deferred<void>();
    ports.backend.transcribeAudio=()=>{reached.resolve();return pending.promise;};
    const stopping=controller.stopRecording();
    await reached.promise;
    controller.closeCommandCenter();
    controller.openCommandCenter();
    controller.handleCommandInputChange('new unsaved draft');
    pending.resolve('I ate an apple');
    await stopping;
    expect(calls.pendingMeals).toEqual([]);
    expect(ports.state.getCommandText()).toBe('new unsaved draft');
  });
  test('cancelled photo selection does not create an error or save', async () => {
    const {controller,calls}=createHarness({text:'',pickedPhoto:null});
    await controller.launchPhotoPicker('library');
    expect(calls.pendingPhotoMeals).toEqual([]);
    expect(calls.states.includes('cc_photo_context')).toBe(false);
    expect(calls.errors.filter(error=>error!=='cleared')).toEqual([]);
  });
  test('failed transcription keeps an actionable error and never saves', async () => {
    const {ports,controller,calls}=createHarness({text:'',activeRecording:voiceRecording({durationMillis:2000})});
    ports.backend.transcribeAudio=async()=>{throw new Error('Network unavailable');};
    await controller.stopRecording();
    expect(calls.pendingMeals).toEqual([]);
    expect(calls.errors).toContainEqual({subtype:'voice_interpret_failure',detail:'Network unavailable'});
  });
});

describe("CommandCenterController deferred meal classification", () => {
  const pendingRow = {
    id: "meal-pending", eatenAt: "2026-10-04T10:30:00.000Z", mealType: "snack", description: "kadhi",
    interpretationStatus: "interpreting" as const, calories: null, proteinG: null, carbsG: null, fatG: null, transcriptRaw: "kadhi",
  };

  // "kadhi" is not in the on-device food list, so it reaches the classifier.
  function deferredHarness(responses: Array<InterpretEntryResponse | Error>) {
    const { ports, calls } = createHarness({ text: "kadhi" });
    const operation = { generation: 0, saving: false };
    const controller = createCommandCenterController(ports, operation);
    const requests: Array<{ transcript: string; deferMeal?: { requestId: string; eatenAt: string } }> = [];
    let minted = 0;
    ports.clock.createRequestId = () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`;
    ports.backend.interpretEntry = async (transcript, _source, _signal, deferMeal) => {
      requests.push({ transcript, deferMeal });
      const next = responses.shift();
      if (!next) throw new Error("No response configured");
      if (next instanceof Error) throw next;
      return next;
    };
    return { controller, calls, ports, requests };
  }

  test("a meal the classifier defers is acknowledged without a second create", async () => {
    const { controller, calls, requests } = deferredHarness([{ intent: "meal_pending", payload: pendingRow }]);

    await controller.submitTypedText();

    expect(requests).toHaveLength(1);
    expect(requests[0].deferMeal?.requestId).toBe("00000000-0000-4000-8000-000000000001");
    expect(calls.pendingMeals).toEqual([]);
    expect(calls.finished).toEqual([{ toast: "Logged — estimating calories", kind: "processing" }]);
  });

  test("retrying the same text reuses its identity; edited text gets a new one", async () => {
    const { controller, requests } = deferredHarness([
      new Error("Response lost"),
      { intent: "meal_pending", payload: pendingRow },
    ]);

    await controller.submitTypedText();
    await controller.handleErrorPrimary();
    // Same request ID: the server replays the receipt instead of logging twice.
    expect(requests.map((r) => r.deferMeal?.requestId)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000001",
    ]);

    const edited = deferredHarness([new Error("Response lost"), { intent: "meal_pending", payload: pendingRow }]);
    await edited.controller.submitTypedText();
    edited.ports.state.setCommandText("kadhi with jeera");
    await edited.controller.submitTypedText();
    expect(edited.requests.map((r) => r.deferMeal?.requestId)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ]);
  });
});
