import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert, Keyboard, Linking } from "react-native";
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import type { DashboardData, InterpretEntryResponse, MealIngredient } from "@voicefit/contracts/types";
import { apiFormRequest, apiRequest } from "@/lib/api-client";
import { isWebPreviewMode } from "@/lib/web-preview-mode";
import { fetchInterpretedIngredient as fetchInterpretedIngredientApi } from "@/lib/api/ingredient";
import type {
  CommandErrorSubtype,
  CommandCenterContext,
  CommandCenterEvent,
  CommandCenterHandle,
  CommandCenterLauncherProps,
  CommandCenterSnapshot,
  CommandState,
  EntrySource,
  PhotoAttachment,
  RecentMeal,
  ReviewDraft,
  SaveAction,
  ScreenContext,
} from "@/components/command-center/types";
import {
  createCommandCenterController,
  type CommandCenterVoiceRecording,
  type PhotoPickerMode,
} from "@/components/command-center/controller";
import {
  buildQuickAddItems,
  ensureQuickSession,
  hasWebPreviewFlag,
  inferCalories,
  inferMealDescription,
  inferMealType,
} from "@/components/command-center/helpers";

// ---------------------------------------------------------------------------
// Public context — what screens see via useCommandCenter()
// ---------------------------------------------------------------------------

interface CommandCenterLegacyHandle {
  commandState: CommandState;
  commandToast: string | null;
  startRecording: () => Promise<void>;
  setScreenContext: (ctx: ScreenContext) => void;
  clearScreenContext: () => void;
}

type CommandCenterPublicValue = CommandCenterHandle & CommandCenterLegacyHandle;

const CommandCenterPublicContext = createContext<CommandCenterPublicValue | null>(null);

export function useCommandCenter(context?: CommandCenterContext): CommandCenterPublicValue {
  const ctx = use(CommandCenterPublicContext);
  const setScreenContext = ctx?.setScreenContext;
  const clearScreenContext = ctx?.clearScreenContext;
  const hasContext = context !== undefined;
  const sessionId = context?.sessionId;
  const screen = context?.screen;

  useEffect(() => {
    if (!hasContext || !setScreenContext || !clearScreenContext) return;

    setScreenContext({ sessionId, screen });
    return () => clearScreenContext();
  }, [clearScreenContext, hasContext, screen, sessionId, setScreenContext]);

  if (!ctx) throw new Error("useCommandCenter must be used within CommandCenterProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Overlay context — what CommandCenterOverlay sees
// ---------------------------------------------------------------------------

type CommandCenterOverlayDispatch = (
  event: CommandCenterEvent,
) => void | Promise<void> | Promise<MealIngredient>;

interface CommandCenterOverlayValue {
  snapshot: CommandCenterSnapshot;
  dispatch: CommandCenterOverlayDispatch;
}

const CommandCenterOverlayContext = createContext<CommandCenterOverlayValue | null>(null);

export function useCommandCenterOverlay() {
  const ctx = use(CommandCenterOverlayContext);
  if (!ctx) throw new Error("useCommandCenterOverlay must be used within CommandCenterProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CommandCenterProvider({ children }: { children: React.ReactNode }) {
  // Hoisted at top level — expo-audio recorder hook cannot be called inside
  // nested/async functions (rules of hooks).
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const isWebPreview = isWebPreviewMode();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // ---- State ----
  const [commandState, setCommandState] = useState<CommandState>("cc_collapsed");
  const [commandText, setCommandText] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [recording, setRecording] = useState<CommandCenterVoiceRecording | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isInterpretingVoice, setIsInterpretingVoice] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [selectedMealPhoto, setSelectedMealPhoto] = useState<PhotoAttachment | null>(null);
  const [commandToast, setCommandToast] = useState<string | null>(null);
  const [lastSavedKcalLeft, setLastSavedKcalLeft] = useState<number | null>(null);
  const [commandErrorSubtype, setCommandErrorSubtype] = useState<CommandErrorSubtype>(null);
  const [commandErrorDetail, setCommandErrorDetail] = useState<string | null>(null);
  const [screenContext, setScreenContextState] = useState<ScreenContext>({});

  const pendingSaveRef = useRef<SaveAction | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mealPollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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
      if (recording) recording.stopAndUnload().catch(() => undefined);
    };
  }, [recording]);

  useEffect(() => {
    return () => {
      mealPollTimersRef.current.forEach(clearTimeout);
    };
  }, []);

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

  const refreshAfterPendingMeal = useCallback(async () => {
    mealPollTimersRef.current.forEach(clearTimeout);
    mealPollTimersRef.current = [];
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["meals"] }),
    ]);
  }, [queryClient]);

  const closeCommandCenter = useCallback(() => {
    if (recording) {
      recording.stopAndUnload().catch(() => undefined);
      setRecording(null);
    }
    Keyboard.dismiss();
    setCommandState("cc_collapsed");
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    setIsInterpretingVoice(false);
    setReviewDraft(null);
    setSelectedMealPhoto(null);
    setLastSavedKcalLeft(null);
  }, [recording]);

  // Holds the saved toast visible for ~2.2s after a successful write so the
  // user can read the meal/kcal-left summary before the sheet closes.
  const finishWithSaved = useCallback((toast: string, kcalLeft: number | null = null) => {
    setCommandToast(toast);
    setLastSavedKcalLeft(kcalLeft);
    setCommandState("cc_saved");
    setTimeout(() => closeCommandCenter(), 2200);
  }, [closeCommandCenter]);

  // Snapshots dashboard cache to compute `kcal left today` after a meal save.
  // Reads pre-save consumed kcal so the math is stable even before the
  // invalidated dashboard query refetches.
  const computeKcalLeftAfterMeal = useCallback((justSavedKcal: number): number | null => {
    const dashboardCaches = queryClient.getQueriesData<DashboardData>({ queryKey: ["dashboard"] });
    const cached = dashboardCaches.find(([, data]) => data != null)?.[1];
    if (!cached) return null;
    return Math.max(0, cached.today.calories.goal - cached.today.calories.consumed - justSavedKcal);
  }, [queryClient]);

  const getPhotoFileName = useCallback((uri: string, fileName?: string | null) => {
    if (fileName?.trim()) return fileName.trim();
    const extension = uri.split(".").pop()?.split("?")[0] || "jpg";
    return `voicefit-meal-${Date.now()}.${extension}`;
  }, []);

  const getPhotoMimeType = useCallback((uri: string, mimeType?: string | null) => {
    const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase();
    if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
    if (extension === "gif") return "image/gif";
    if (extension === "heic" || extension === "heif") return "image/heic";
    if (mimeType?.trim()) return mimeType.trim();
    return "image/jpeg";
  }, []);

  const buildPhotoAttachment = useCallback((asset: ImagePicker.ImagePickerAsset): PhotoAttachment => ({
    uri: asset.uri,
    name: getPhotoFileName(asset.uri, asset.fileName),
    type: getPhotoMimeType(asset.uri, asset.mimeType),
    width: Number.isFinite(asset.width) ? asset.width : null,
    height: Number.isFinite(asset.height) ? asset.height : null,
  }), [getPhotoFileName, getPhotoMimeType]);

  const getAuthToken = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    return token;
  }, [getToken]);

  const createPendingMealFromText = useCallback(async (transcript: string, source: EntrySource) => {
    if (isWebPreview) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      await refreshAfterPendingMeal();
      finishWithSaved("Logging your meal…");
      return;
    }

    const token = await getAuthToken();

    await apiRequest("/api/meals/interpret", {
      method: "POST",
      token,
      body: JSON.stringify({
        transcript,
        context: transcript,
        source,
        timezone,
        eatenAt: new Date().toISOString(),
      }),
      timeoutMs: 60_000,
    });
    await refreshAfterPendingMeal();
    finishWithSaved("Logging your meal…");
  }, [isWebPreview, getAuthToken, timezone, refreshAfterPendingMeal, finishWithSaved]);

  const createPendingMealFromPhoto = useCallback(async (photo: PhotoAttachment, context: string) => {
    if (isWebPreview) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      await refreshAfterPendingMeal();
      finishWithSaved("Looking at your photo…");
      return;
    }

    const token = await getAuthToken();

    const formData = new FormData();
    formData.append("photo", { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
    formData.append("source", "photo");
    formData.append("context", context.trim());
    formData.append("timezone", timezone);
    formData.append("eatenAt", new Date().toISOString());
    if (context.trim()) {
      formData.append("transcript", context.trim());
    }

    await apiFormRequest("/api/meals/interpret", formData, {
      method: "POST",
      token,
      timeoutMs: 60_000,
    });
    await refreshAfterPendingMeal();
    finishWithSaved("Looking at your photo…");
  }, [isWebPreview, getAuthToken, timezone, refreshAfterPendingMeal, finishWithSaved]);

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
      const mealCalories = inferCalories(transcript);
      // Plausible chicken-rice-broccoli plate that sums to the inferred kcal.
      const chickenCal = Math.round(mealCalories * 0.45);
      const riceCal = Math.round(mealCalories * 0.4);
      const broccoliCal = mealCalories - chickenCal - riceCal;
      return {
        intent: "meal",
        payload: {
          mealType: inferMealType(transcript),
          description: inferMealDescription(transcript),
          totalGrams: 440,
          ingredients: [
            { name: "Grilled chicken breast", grams: 150, calories: chickenCal, proteinG: 46, carbsG: 0, fatG: 5 },
            { name: "Steamed white rice", grams: 200, calories: riceCal, proteinG: 5, carbsG: 56, fatG: 1 },
            { name: "Broccoli florets", grams: 90, calories: broccoliCal, proteinG: 3, carbsG: 6, fatG: 0 },
          ],
          calories: mealCalories,
          proteinG: 54,
          carbsG: 62,
          fatG: 6,
        },
      } as InterpretEntryResponse;
    }

    const token = await getAuthToken();
    return apiRequest<InterpretEntryResponse>("/api/interpret/entry", {
      method: "POST",
      token,
      body: JSON.stringify({ transcript, source, timezone }),
      // Meal interpretation runs the agentic Anthropic + USDA + IFCT loop
      // server-side; 15s default isn't enough.
      timeoutMs: 60_000,
    });
  }, [isWebPreview, getAuthToken, timezone]);

  const commandCenterController = useMemo(() => createCommandCenterController({
    state: {
      getCommandState: () => commandState,
      getCommandText: () => commandText,
      getVoiceTranscript: () => voiceTranscript,
      getRecordingSeconds: () => recordingSeconds,
      getIsInterpretingVoice: () => isInterpretingVoice,
      getScreenContext: () => screenContext,
      getSelectedMealPhoto: () => selectedMealPhoto,
      getActiveRecording: () => recording,
      getReviewDraft: () => reviewDraft,
      getCommandToast: () => commandToast,
      getLastSavedKcalLeft: () => lastSavedKcalLeft,
      getCommandErrorSubtype: () => commandErrorSubtype,
      getCommandErrorDetail: () => commandErrorDetail,
      getQuickAddItems: () => quickAddItems,
      getIsWebPreview: () => isWebPreview,
      getPendingSaveAction: () => pendingSaveRef.current,
      setCommandState,
      setCommandError,
      setCommandErrorDetail,
      setReviewDraft,
      setPendingSaveAction: (action) => {
        pendingSaveRef.current = action;
      },
      clearCommandError: () => {
        setCommandErrorSubtype(null);
        setCommandErrorDetail(null);
      },
      setSelectedMealPhoto,
      setCommandText,
      setVoiceTranscript,
      setRecordingSeconds,
      setActiveRecording: setRecording,
      setIsInterpretingVoice,
      setCommandToast,
      closeCommandCenter,
    },
    auth: {
      getToken: getAuthToken,
    },
    backend: {
      interpretEntry,
      createPendingMealFromText,
      createPendingMealFromPhoto,
      transcribeAudio: async (audio) => {
        const token = await getAuthToken();
        const formData = new FormData();
        formData.append("audio", audio as unknown as Blob);
        const { transcript } = await apiFormRequest<{ transcript: string }>("/api/transcribe", formData, { token });
        return transcript;
      },
      createMeal: async (input) => {
        const token = await getAuthToken();
        await apiRequest("/api/meals", {
          method: "POST",
          token,
          body: JSON.stringify(input),
        });
      },
      ensureQuickSession: async () => {
        const token = await getAuthToken();
        return ensureQuickSession(token);
      },
      createWorkoutSet: async (input) => {
        const token = await getAuthToken();
        await apiRequest("/api/workout-sets", {
          method: "POST",
          token,
          body: JSON.stringify(input),
        });
      },
      upsertDailyMetrics: async (input) => {
        const token = await getAuthToken();
        await apiRequest("/api/daily-metrics", {
          method: "POST",
          token,
          body: JSON.stringify(input),
        });
      },
      createConversation: async (input) => {
        const token = await getAuthToken();
        await apiRequest("/api/conversation", {
          method: "POST",
          token,
          body: JSON.stringify(input),
        });
      },
      fetchInterpretedIngredient: async (name, grams) => {
        const token = await getAuthToken();
        return fetchInterpretedIngredientApi(token, name, grams);
      },
    },
    cache: {
      refreshAfterSave,
      computeKcalLeftAfterMeal,
    },
    clock: {
      now: () => new Date(),
    },
    preview: {
      isEnabled: () => isWebPreview,
      hasFlag: hasWebPreviewFlag,
      delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    },
    feedback: {
      finishWithSaved,
    },
    media: {
      requestMicrophonePermission: async () => {
        const { granted } = await requestRecordingPermissionsAsync();
        return granted;
      },
      startVoiceRecording: async (onDurationSeconds) => {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await audioRecorder.prepareToRecordAsync();
        // Drive elapsed-seconds display via a setInterval; the old
        // setOnRecordingStatusUpdate callback is not available in expo-audio.
        let elapsed = 0;
        const durationInterval = setInterval(() => {
          elapsed += 1;
          onDurationSeconds(elapsed);
        }, 1000);
        audioRecorder.record();
        haptic.press(); // NUI-6: haptic feedback when recording starts
        return {
          clearDurationUpdates: () => clearInterval(durationInterval),
          stopAndUnload: async () => {
            clearInterval(durationInterval);
            haptic.tap(); // NUI-6: haptic feedback when recording stops
            await audioRecorder.stop();
          },
          getDurationMillis: async () => elapsed * 1000,
          getUri: () => audioRecorder.uri,
        };
      },
      requestPhotoPermission: async (mode) => {
        const permission = mode === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        return permission.granted;
      },
      pickMealPhoto: async (mode) => {
        const result = mode === "camera"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              exif: false,
              mediaTypes: ["images"],
              quality: 0.82,
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: false,
              exif: false,
              mediaTypes: ["images"],
              quality: 0.82,
            });
        if (result.canceled || !result.assets[0]) return null;
        return buildPhotoAttachment(result.assets[0]);
      },
    },
    platform: {
      isWeb: () => process.env.EXPO_OS === "web",
      openSettings: () => Linking.openSettings(),
      selectPhotoSource: () => new Promise<PhotoPickerMode | null>((resolve) => {
        Alert.alert("Log meal photo", "Add optional context after selecting a photo.", [
          { text: "Take photo", onPress: () => resolve("camera") },
          { text: "Choose from library", onPress: () => resolve("library") },
          { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        ]);
      }),
    },
  }), [
    commandText,
    commandState,
    voiceTranscript,
    recordingSeconds,
    isInterpretingVoice,
    screenContext,
    selectedMealPhoto,
    recording,
    reviewDraft,
    commandToast,
    lastSavedKcalLeft,
    commandErrorSubtype,
    commandErrorDetail,
    quickAddItems,
    closeCommandCenter,
    setCommandError,
    interpretEntry,
    createPendingMealFromText,
    createPendingMealFromPhoto,
    getAuthToken,
    buildPhotoAttachment,
    refreshAfterSave,
    computeKcalLeftAfterMeal,
    isWebPreview,
    finishWithSaved,
    audioRecorder,
  ]);

  const overlaySnapshot = useSyncExternalStore(
    commandCenterController.subscribe,
    commandCenterController.getSnapshot,
    commandCenterController.getSnapshot,
  );

  const openCommandCenter = useCallback(
    () => {
      void commandCenterController.dispatch({ type: "open" });
    },
    [commandCenterController],
  );

  const closeCommandCenterForConsumers = useCallback(
    () => {
      void commandCenterController.dispatch({ type: "close" });
    },
    [commandCenterController],
  );

  const startRecording = useCallback(
    async () => {
      await commandCenterController.dispatch({ type: "voice.start" });
    },
    [commandCenterController],
  );

  // ---- Screen context ----
  const setScreenContext = useCallback((ctx: ScreenContext) => setScreenContextState(ctx), []);
  const clearScreenContext = useCallback(() => setScreenContextState({}), []);

  // ---- Context values ----
  const launcherProps = useMemo<CommandCenterLauncherProps>(() => ({
    onPress: openCommandCenter,
    onMicPress: startRecording,
  }), [openCommandCenter, startRecording]);

  const publicValue = useMemo<CommandCenterPublicValue>(() => ({
    commandState,
    isOpen: commandState !== "cc_collapsed",
    toast: commandToast,
    commandToast,
    open: openCommandCenter,
    record: startRecording,
    startRecording,
    close: closeCommandCenterForConsumers,
    launcherProps,
    setScreenContext,
    clearScreenContext,
  }), [commandState, commandToast, openCommandCenter, startRecording, closeCommandCenterForConsumers, launcherProps, setScreenContext, clearScreenContext]);

  const overlayValue = useMemo<CommandCenterOverlayValue>(() => ({
    snapshot: overlaySnapshot,
    dispatch: commandCenterController.dispatch,
  }), [commandCenterController.dispatch, overlaySnapshot]);

  return (
    <CommandCenterPublicContext.Provider value={publicValue}>
      <CommandCenterOverlayContext.Provider value={overlayValue}>
        {children}
      </CommandCenterOverlayContext.Provider>
    </CommandCenterPublicContext.Provider>
  );
}
