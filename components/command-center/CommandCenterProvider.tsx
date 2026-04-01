import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Linking, Platform } from "react-native";
import { Audio } from "expo-av";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import type { InterpretEntryResponse } from "@voicefit/contracts/types";
import { apiFormRequest, apiRequest } from "../../lib/api-client";
import type {
  CommandErrorSubtype,
  CommandState,
  EntrySource,
  QuickAddItem,
  RecentMeal,
  ReviewDraft,
  SaveAction,
  ScreenContext,
  WorkoutReviewSet,
} from "./types";
import {
  buildMealReviewDraft,
  buildQuickAddItems,
  buildWorkoutReviewDraft,
  ensureQuickSession,
  ERROR_COPY,
  getErrorMessage,
  hasWebPreviewFlag,
  inferCalories,
  inferMealDescription,
  inferMealType,
  MIN_RECORDING_DURATION_MS,
  parsePositiveNumber,
  toLocalDateString,
} from "./helpers";

// ---------------------------------------------------------------------------
// Public context — what screens see via useCommandCenter()
// ---------------------------------------------------------------------------

interface CommandCenterPublicValue {
  commandState: CommandState;
  isOpen: boolean;
  commandToast: string | null;
  open: () => void;
  startRecording: () => Promise<void>;
  close: () => void;
  setScreenContext: (ctx: ScreenContext) => void;
  clearScreenContext: () => void;
}

const CommandCenterPublicContext = createContext<CommandCenterPublicValue | null>(null);

export function useCommandCenter() {
  const ctx = useContext(CommandCenterPublicContext);
  if (!ctx) throw new Error("useCommandCenter must be used within CommandCenterProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Internal context — what CommandCenterOverlay sees
// ---------------------------------------------------------------------------

export interface CommandCenterInternalValue {
  commandState: CommandState;
  commandText: string;
  voiceTranscript: string;
  recordingSeconds: number;
  isInterpretingVoice: boolean;
  reviewDraft: ReviewDraft | null;
  commandToast: string | null;
  commandErrorSubtype: CommandErrorSubtype;
  commandErrorDetail: string | null;
  activeErrorCopy: (typeof ERROR_COPY)[Exclude<CommandErrorSubtype, null>] | null;
  quickAddItems: QuickAddItem[];
  screenContext: ScreenContext;
  isWebPreview: boolean;

  closeCommandCenter: () => void;
  openCommandCenter: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  sendTyped: () => Promise<void>;
  handleCommandInputChange: (text: string) => void;
  handleErrorPrimary: () => Promise<void>;
  handleErrorSecondary: () => void;
  saveReviewedEntry: () => Promise<void>;
  editReviewTranscript: () => void;
  updateWorkoutSet: (idx: number, patch: Partial<Pick<WorkoutReviewSet, "weightKg" | "reps" | "notes">>) => void;
  addWorkoutSet: () => void;
  runSaveAction: (action: SaveAction) => Promise<void>;
  setVoiceTranscript: (text: string) => void;
  setCommandState: (state: CommandState) => void;
  setCommandText: (text: string) => void;
}

export const CommandCenterInternalContext = createContext<CommandCenterInternalValue | null>(null);

export function useCommandCenterInternal() {
  const ctx = useContext(CommandCenterInternalContext);
  if (!ctx) throw new Error("useCommandCenterInternal must be used within CommandCenterProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CommandCenterProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const isWebPreview = __DEV__ && Platform.OS === "web";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // ---- State ----
  const [commandState, setCommandState] = useState<CommandState>("cc_collapsed");
  const [commandText, setCommandText] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isInterpretingVoice, setIsInterpretingVoice] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [commandToast, setCommandToast] = useState<string | null>(null);
  const [commandErrorSubtype, setCommandErrorSubtype] = useState<CommandErrorSubtype>(null);
  const [commandErrorDetail, setCommandErrorDetail] = useState<string | null>(null);
  const [screenContext, setScreenContextState] = useState<ScreenContext>({});

  const pendingSaveRef = useRef<SaveAction | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Quick add items from React Query cache ----
  const quickAddItems = useMemo(() => {
    const dashboardKey = queryClient.getQueryCache().findAll({ queryKey: ["dashboard"] })[0]?.queryKey ?? ["dashboard"];
    const cached = queryClient.getQueryData<{ recentMeals?: RecentMeal[] }>(dashboardKey);
    return buildQuickAddItems(cached?.recentMeals);
  }, [queryClient, commandState]); // re-derive when CC opens

  // ---- Effects ----
  useEffect(() => {
    if (!commandToast) return;
    toastTimerRef.current = setTimeout(() => setCommandToast(null), 2200);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [commandToast]);

  useEffect(() => {
    return () => {
      if (recording) recording.stopAndUnloadAsync().catch(() => undefined);
    };
  }, [recording]);

  // Web preview: tick recording seconds
  useEffect(() => {
    if (commandState !== "cc_recording" || !isWebPreview) return;
    const timer = setInterval(() => setRecordingSeconds((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [commandState, isWebPreview]);

  // Web preview: simulate live transcript
  useEffect(() => {
    if (commandState !== "cc_recording" || !isWebPreview) return;
    const timer = setTimeout(() => {
      setVoiceTranscript("I had a chicken salad with rice for lunch, about 500 calories");
    }, 900);
    return () => clearTimeout(timer);
  }, [commandState, isWebPreview]);

  // ---- Core functions ----

  const setCommandError = useCallback((subtype: Exclude<CommandErrorSubtype, null>, detail?: string) => {
    setCommandErrorSubtype(subtype);
    setCommandErrorDetail(detail ?? null);
    setCommandState("cc_error");
  }, []);

  const refreshAfterSave = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["workout-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["workout-session-detail"] }),
      queryClient.invalidateQueries({ queryKey: ["meals"] }),
      queryClient.invalidateQueries({ queryKey: ["daily-metrics"] }),
      queryClient.invalidateQueries({ queryKey: ["conversation"] }),
    ]);
  }, [queryClient]);

  const closeCommandCenter = useCallback(() => {
    if (recording) {
      recording.stopAndUnloadAsync().catch(() => undefined);
      setRecording(null);
    }
    Keyboard.dismiss();
    setCommandState("cc_collapsed");
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    setIsInterpretingVoice(false);
    setReviewDraft(null);
  }, [recording]);

  const openCommandCenter = useCallback(() => {
    setCommandText("");
    setVoiceTranscript("");
    setRecordingSeconds(0);
    setIsInterpretingVoice(false);
    setReviewDraft(null);
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    setCommandState("cc_expanded_empty");
  }, []);

  const interpretEntry = useCallback(async (transcript: string, source: EntrySource): Promise<InterpretEntryResponse> => {
    if (isWebPreview) {
      if (hasWebPreviewFlag("typed_fail") && source === "text") throw new Error("Mock typed interpret failure.");
      if (hasWebPreviewFlag("voice_fail") && source === "voice") throw new Error("Mock voice interpret failure.");
      if (hasWebPreviewFlag("hold_typed_submit")) {
        await new Promise((resolve) => setTimeout(resolve, 99_999));
      }
      await new Promise((resolve) => setTimeout(resolve, 650));
      const text = transcript.toLowerCase();
      if (text.includes("squat") || text.includes("bench") || text.includes("curl") || text.includes("set") || text.includes("rep")) {
        return {
          intent: "workout_set",
          payload: {
            exerciseName: text.includes("squat") ? "Barbell Squat" : text.includes("bench") ? "Bench Press" : "Bicep Curl",
            exerciseType: "resistance",
            reps: 10,
            weightKg: 60,
            durationMinutes: null,
            notes: null,
            confidence: 0.95,
            assumptions: [],
          },
        } as InterpretEntryResponse;
      }
      if (text.includes("step")) {
        return { intent: "steps", payload: { value: 6800, confidence: 0.97, assumptions: [], unit: "steps" } } as InterpretEntryResponse;
      }
      if (text.includes("weight")) {
        return { intent: "weight", payload: { value: 72.4, confidence: 0.97, assumptions: [], unit: "kg" } } as InterpretEntryResponse;
      }
      return {
        intent: "meal",
        payload: {
          mealType: inferMealType(transcript),
          description: inferMealDescription(transcript),
          calories: inferCalories(transcript),
          confidence: 0.96,
          assumptions: [],
        },
      } as InterpretEntryResponse;
    }

    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    return apiRequest<InterpretEntryResponse>("/api/interpret/entry", {
      method: "POST",
      token,
      body: JSON.stringify({ transcript, source, timezone }),
    });
  }, [isWebPreview, getToken, timezone]);

  const runSaveAction = useCallback(async (action: SaveAction) => {
    pendingSaveRef.current = action;
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    setCommandState(action.kind === "quick_add" ? "cc_quick_add_saving" : "cc_saving");

    try {
      if (isWebPreview) {
        if (action.kind === "entry" && hasWebPreviewFlag("save_fail")) throw new Error("Mock auto-save failure.");
        if (action.kind === "quick_add" && hasWebPreviewFlag("quick_add_fail")) throw new Error("Mock quick-add save failure.");
        await new Promise((resolve) => setTimeout(resolve, 550));
        await refreshAfterSave();
        setCommandToast("Saved");
        closeCommandCenter();
        return;
      }

      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      if (action.kind === "quick_add") {
        await apiRequest("/api/meals", {
          method: "POST",
          token,
          body: JSON.stringify({
            eatenAt: new Date().toISOString(),
            mealType: action.item.mealType,
            description: action.item.description,
            calories: action.item.calories,
            transcriptRaw: `quick_add:${action.item.description}`,
          }),
        });
      } else {
        const { interpreted, transcript, source } = action;

        if (interpreted.intent === "meal") {
          await apiRequest("/api/meals", {
            method: "POST",
            token,
            body: JSON.stringify({
              eatenAt: new Date().toISOString(),
              mealType: interpreted.payload.mealType,
              description: interpreted.payload.description,
              calories: interpreted.payload.calories,
              transcriptRaw: transcript,
            }),
          });
        } else if (interpreted.intent === "workout_set") {
          const sessionId = screenContext.sessionId ?? await ensureQuickSession(token);
          await apiRequest("/api/workout-sets", {
            method: "POST",
            token,
            body: JSON.stringify({
              sessionId,
              exerciseName: interpreted.payload.exerciseName,
              exerciseType: interpreted.payload.exerciseType,
              reps: interpreted.payload.reps,
              weightKg: interpreted.payload.weightKg,
              durationMinutes: interpreted.payload.durationMinutes,
              notes: interpreted.payload.notes,
              performedAt: new Date().toISOString(),
              transcriptRaw: transcript,
            }),
          });
        } else if (interpreted.intent === "steps") {
          await apiRequest("/api/daily-metrics", {
            method: "POST",
            token,
            body: JSON.stringify({ date: toLocalDateString(new Date()), steps: Math.round(interpreted.payload.value) }),
          });
        } else if (interpreted.intent === "weight") {
          await apiRequest("/api/daily-metrics", {
            method: "POST",
            token,
            body: JSON.stringify({ date: toLocalDateString(new Date()), weightKg: interpreted.payload.value }),
          });
        } else {
          await apiRequest("/api/conversation", {
            method: "POST",
            token,
            body: JSON.stringify({
              kind: "question",
              userText: transcript,
              systemText: interpreted.payload.answer,
              source,
              referenceType: null,
              referenceId: null,
              metadata: { answer: interpreted.payload.answer },
            }),
          });
          await refreshAfterSave();
          setCommandToast(interpreted.payload.answer);
          closeCommandCenter();
          return;
        }
      }

      await refreshAfterSave();
      setCommandToast("Saved");
      closeCommandCenter();
    } catch (error) {
      setCommandError(
        action.kind === "quick_add" ? "quick_add_failure" : "auto_save_failure",
        getErrorMessage(error),
      );
    }
  }, [isWebPreview, getToken, refreshAfterSave, closeCommandCenter, setCommandError, screenContext.sessionId]);

  const routeInterpretedEntry = useCallback(async (interpreted: InterpretEntryResponse, transcript: string, source: EntrySource) => {
    if (interpreted.intent === "meal") {
      setReviewDraft(buildMealReviewDraft(interpreted, transcript, source));
      setCommandState("cc_review_meal");
    } else if (interpreted.intent === "workout_set") {
      setReviewDraft(buildWorkoutReviewDraft(interpreted, transcript, source));
      setCommandState("cc_review_workout");
    } else {
      await runSaveAction({ kind: "entry", interpreted, transcript, source });
    }
  }, [runSaveAction]);

  const sendTyped = useCallback(async () => {
    const trimmed = commandText.trim();
    if (!trimmed) return;
    setCommandState("cc_submitting_typed");
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    try {
      const interpreted = await interpretEntry(trimmed, "text");
      await routeInterpretedEntry(interpreted, trimmed, "text");
    } catch (error) {
      setCommandError("typed_interpret_failure", getErrorMessage(error));
    }
  }, [commandText, interpretEntry, routeInterpretedEntry, setCommandError]);

  const interpretVoiceTranscript = useCallback(async (text: string) => {
    const transcript = text.trim();
    if (!transcript) {
      setCommandError("voice_interpret_failure", "Transcript cannot be empty.");
      return;
    }
    setIsInterpretingVoice(true);
    setCommandState("cc_interpreting_voice");
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    try {
      const interpreted = await interpretEntry(transcript, "voice");
      await routeInterpretedEntry(interpreted, transcript, "voice");
    } catch (error) {
      setCommandError("voice_interpret_failure", getErrorMessage(error));
    } finally {
      setIsInterpretingVoice(false);
    }
  }, [interpretEntry, routeInterpretedEntry, setCommandError]);

  const startRecording = useCallback(async () => {
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    setVoiceTranscript("");
    try {
      if (isWebPreview) {
        if (hasWebPreviewFlag("mic_denied")) {
          setCommandError("mic_permission_denied");
          return;
        }
        setRecordingSeconds(0);
        setCommandState("cc_recording");
        return;
      }
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setCommandError("mic_permission_denied");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      nextRecording.setOnRecordingStatusUpdate((status) => {
        setRecordingSeconds(Math.floor((status.durationMillis ?? 0) / 1000));
      });
      await nextRecording.startAsync();
      setRecording(nextRecording);
      setRecordingSeconds(0);
      setCommandState("cc_recording");
    } catch (error) {
      setCommandError("voice_interpret_failure", getErrorMessage(error));
    }
  }, [isWebPreview, setCommandError]);

  const stopRecording = useCallback(async () => {
    if (isWebPreview) {
      const previewTranscript = "I had a chicken salad with rice for lunch, about 500 calories";
      setCommandState("cc_transcribing_voice");
      if (hasWebPreviewFlag("hold_transcribing")) return;
      await new Promise((resolve) => setTimeout(resolve, 700));
      setVoiceTranscript(previewTranscript);
      if (hasWebPreviewFlag("hold_interpreting")) {
        setCommandState("cc_interpreting_voice");
        setIsInterpretingVoice(true);
        return;
      }
      await interpretVoiceTranscript(previewTranscript);
      return;
    }
    if (!recording) return;
    setCommandState("cc_transcribing_voice");
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    const activeRecording = recording;
    setRecording(null);
    try {
      activeRecording.setOnRecordingStatusUpdate(null);
      await activeRecording.stopAndUnloadAsync();
      const status = await activeRecording.getStatusAsync();
      const durationMillis = status.durationMillis ?? 0;
      const uri = activeRecording.getURI();
      if (!uri || durationMillis < MIN_RECORDING_DURATION_MS) {
        throw new Error("Recording is too short. Please record at least 1 second.");
      }
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const formData = new FormData();
      formData.append("audio", { uri, name: `voicefit-${Date.now()}.m4a`, type: "audio/m4a" } as unknown as Blob);
      const { transcript } = await apiFormRequest<{ transcript: string }>("/api/transcribe", formData, { token });
      const cleaned = transcript.trim();
      if (!cleaned) throw new Error("Transcript was empty. Please try again.");
      setVoiceTranscript(cleaned);
      await interpretVoiceTranscript(cleaned);
    } catch (error) {
      setCommandError("voice_interpret_failure", getErrorMessage(error));
    }
  }, [isWebPreview, recording, getToken, interpretVoiceTranscript, setCommandError]);

  // ---- Review/edit helpers ----

  const updateWorkoutSet = useCallback((setIndex: number, patch: Partial<Pick<WorkoutReviewSet, "weightKg" | "reps" | "notes">>) => {
    setReviewDraft((prev) => {
      if (!prev || prev.kind !== "workout") return prev;
      const nextSets = prev.sets.map((set, i) => (i === setIndex ? { ...set, ...patch } : set));
      return { ...prev, sets: nextSets };
    });
  }, []);

  const addWorkoutSet = useCallback(() => {
    setReviewDraft((prev) => {
      if (!prev || prev.kind !== "workout") return prev;
      const n = prev.sets.length + 1;
      return { ...prev, sets: [...prev.sets, { id: `set-${n}`, setNumber: n, weightKg: "", reps: "", notes: "" }] };
    });
  }, []);

  const saveReviewedEntry = useCallback(async () => {
    if (!reviewDraft) return;
    if (reviewDraft.kind === "workout") {
      const filledSets = reviewDraft.sets.filter((s) => s.weightKg.trim() || s.reps.trim() || s.notes.trim());
      const setsToSave = filledSets.length > 0 ? filledSets : [reviewDraft.sets[0]];
      setCommandState("cc_saving");
      setCommandErrorSubtype(null);
      setCommandErrorDetail(null);
      try {
        if (isWebPreview) {
          await new Promise((resolve) => setTimeout(resolve, 550));
          await refreshAfterSave();
          setCommandToast("Saved");
          closeCommandCenter();
          return;
        }
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        const sessionId = screenContext.sessionId ?? await ensureQuickSession(token);
        await Promise.all(
          setsToSave.map((set) =>
            apiRequest("/api/workout-sets", {
              method: "POST",
              token,
              body: JSON.stringify({
                sessionId,
                exerciseName: reviewDraft.interpreted.payload.exerciseName,
                exerciseType: reviewDraft.interpreted.payload.exerciseType,
                reps: parsePositiveNumber(set.reps),
                weightKg: parsePositiveNumber(set.weightKg),
                durationMinutes: null,
                notes: set.notes.trim() || reviewDraft.interpreted.payload.notes,
                performedAt: new Date().toISOString(),
                transcriptRaw: reviewDraft.transcript,
              }),
            }),
          ),
        );
        await refreshAfterSave();
        setCommandToast(`Saved ${setsToSave.length} set${setsToSave.length > 1 ? "s" : ""}`);
        closeCommandCenter();
      } catch (error) {
        setCommandError("auto_save_failure", getErrorMessage(error));
      }
      return;
    }
    await runSaveAction({ kind: "entry", interpreted: reviewDraft.interpreted, transcript: reviewDraft.transcript, source: reviewDraft.source });
  }, [reviewDraft, isWebPreview, getToken, refreshAfterSave, closeCommandCenter, setCommandError, screenContext.sessionId, runSaveAction]);

  const editReviewTranscript = useCallback(() => {
    if (!reviewDraft) return;
    setCommandText(reviewDraft.transcript);
    setVoiceTranscript(reviewDraft.transcript);
    setReviewDraft(null);
    setCommandState(reviewDraft.transcript.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
  }, [reviewDraft]);

  const handleErrorPrimary = useCallback(async () => {
    if (!commandErrorSubtype) return;
    if (commandErrorSubtype === "typed_interpret_failure") { await sendTyped(); return; }
    if (commandErrorSubtype === "voice_interpret_failure") { await startRecording(); return; }
    if (commandErrorSubtype === "mic_permission_denied") {
      try { await Linking.openSettings(); } catch { setCommandErrorDetail("Open your device settings and enable microphone access."); }
      return;
    }
    if ((commandErrorSubtype === "auto_save_failure" || commandErrorSubtype === "quick_add_failure") && pendingSaveRef.current) {
      await runSaveAction(pendingSaveRef.current);
    }
  }, [commandErrorSubtype, sendTyped, startRecording, runSaveAction]);

  const handleErrorSecondary = useCallback(() => {
    if (!commandErrorSubtype) return;
    if (commandErrorSubtype === "typed_interpret_failure") {
      setCommandState(commandText.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }
    if (commandErrorSubtype === "voice_interpret_failure") {
      if (voiceTranscript.trim()) setCommandText(voiceTranscript.trim());
      setCommandState(voiceTranscript.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }
    if (commandErrorSubtype === "mic_permission_denied") {
      setCommandState(commandText.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }
    closeCommandCenter();
  }, [commandErrorSubtype, commandText, voiceTranscript, closeCommandCenter]);

  const handleCommandInputChange = useCallback((text: string) => {
    setCommandText(text);
    if (commandState === "cc_expanded_empty" && text.trim()) setCommandState("cc_expanded_typing");
    if (commandState === "cc_expanded_typing" && !text.trim()) setCommandState("cc_expanded_empty");
  }, [commandState]);

  // ---- Screen context ----
  const setScreenContext = useCallback((ctx: ScreenContext) => setScreenContextState(ctx), []);
  const clearScreenContext = useCallback(() => setScreenContextState({}), []);

  // ---- Derived ----
  const activeErrorCopy = commandErrorSubtype ? ERROR_COPY[commandErrorSubtype] : null;

  // ---- Context values ----
  const publicValue = useMemo<CommandCenterPublicValue>(() => ({
    commandState,
    isOpen: commandState !== "cc_collapsed",
    commandToast,
    open: openCommandCenter,
    startRecording,
    close: closeCommandCenter,
    setScreenContext,
    clearScreenContext,
  }), [commandState, commandToast, openCommandCenter, startRecording, closeCommandCenter, setScreenContext, clearScreenContext]);

  const internalValue = useMemo<CommandCenterInternalValue>(() => ({
    commandState,
    commandText,
    voiceTranscript,
    recordingSeconds,
    isInterpretingVoice,
    reviewDraft,
    commandToast,
    commandErrorSubtype,
    commandErrorDetail,
    activeErrorCopy,
    quickAddItems,
    screenContext,
    isWebPreview,
    closeCommandCenter,
    openCommandCenter,
    startRecording,
    stopRecording,
    sendTyped,
    handleCommandInputChange,
    handleErrorPrimary,
    handleErrorSecondary,
    saveReviewedEntry,
    editReviewTranscript,
    updateWorkoutSet,
    addWorkoutSet,
    runSaveAction,
    setVoiceTranscript,
    setCommandState,
    setCommandText,
  }), [
    commandState, commandText, voiceTranscript, recordingSeconds, isInterpretingVoice,
    reviewDraft, commandToast, commandErrorSubtype, commandErrorDetail, activeErrorCopy,
    quickAddItems, screenContext, isWebPreview,
    closeCommandCenter, openCommandCenter, startRecording, stopRecording, sendTyped,
    handleCommandInputChange, handleErrorPrimary, handleErrorSecondary,
    saveReviewedEntry, editReviewTranscript, updateWorkoutSet, addWorkoutSet, runSaveAction,
  ]);

  return (
    <CommandCenterPublicContext.Provider value={publicValue}>
      <CommandCenterInternalContext.Provider value={internalValue}>
        {children}
      </CommandCenterInternalContext.Provider>
    </CommandCenterPublicContext.Provider>
  );
}
