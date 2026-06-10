import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from "react-native-keyboard-controller";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { FloatingCommandBar } from "@/components/FloatingCommandBar";
import { Icon } from "@/components/Icon";
import { UndoToast } from "@/components/pulse";
import { useCommandCenter } from "@/components/command-center";
import {
  SessionStatsStrip,
  WorkoutExerciseCard,
  type ExerciseCardData,
  type ExerciseType,
  type RenderRow,
  type SetDraft,
  type WorkoutSet,
} from "@/components/workout";
import { getExerciseCatalogItem } from "@/lib/exercise-catalog";
import { apiRequest } from "@/lib/api-client";
import { haptic } from "@/lib/haptics";
import { color as token, font, radius as rad } from "@/lib/tokens";
import { isWebPreviewMode } from "@/lib/web-preview-mode";

const COLORS = {
  bg: token.bg,
  surface: token.surface,
  surface2: token.surface2,
  border: token.line,
  textPrimary: token.text,
  textSecondary: token.textSoft,
  textTertiary: token.textMute,
  green: token.accent,
  error: token.negative,
  accent: token.accent,
  accentInk: token.accentInk,
  positive: token.positive,
};

interface WorkoutSessionDetail {
  id: string;
  userId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sets: WorkoutSet[];
  exerciseNotes?: Record<string, string> | null;
  previousSets?: Record<string, Array<{ weightKg: number | null; reps: number | null; durationMinutes: number | null }>>;
}

type SessionViewModel = {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  volume: string;
  sets: string;
  finished: boolean;
  empty: boolean;
  exerciseCards: ExerciseCardData[];
};

const PREVIEW_ACTIVE: SessionViewModel = {
  id: "preview-active",
  title: "Morning Push",
  subtitle: "Today · 10:15 AM",
  duration: "32:14",
  volume: "2,480 kg",
  sets: "8",
  finished: false,
  empty: false,
  exerciseCards: [
    {
      name: "Bench Press",
      meta: "Barbell · Chest",
      exerciseType: "resistance",
      rows: [
        { id: "w1", setLabel: "W", previous: "40 × 10", isWarmup: true, checked: true, displayWeight: "40", displayReps: "10" },
        { id: "1", setLabel: "1", previous: "80 × 8", isWarmup: false, checked: true, displayWeight: "80", displayReps: "8" },
        { id: "2", setLabel: "2", previous: "80 × 8", isWarmup: false, checked: true, displayWeight: "80", displayReps: "8" },
        { id: "3", setLabel: "3", previous: "80 × 7", isWarmup: false, checked: false, displayWeight: "80", displayReps: "8" },
      ],
    },
    {
      name: "Overhead Press",
      meta: "Dumbbell · Shoulders",
      exerciseType: "resistance",
      rows: [
        { id: "4", setLabel: "1", previous: "24 × 10", isWarmup: false, checked: true, displayWeight: "24", displayReps: "10" },
        { id: "5", setLabel: "2", previous: "24 × 10", isWarmup: false, checked: true, displayWeight: "24", displayReps: "10" },
        { id: "6", setLabel: "3", previous: "24 × 8", isWarmup: false, checked: false, displayWeight: "24", displayReps: "10" },
      ],
    },
  ],
};

const PREVIEW_LEG_DAY: SessionViewModel = {
  id: "preview-leg-day",
  title: "Leg Day",
  subtitle: "Yesterday · 6:30 PM",
  duration: "41:08",
  volume: "3,520 kg",
  sets: "7",
  finished: true,
  empty: false,
  exerciseCards: [
    {
      name: "Barbell Squat",
      meta: "Barbell · Legs",
      exerciseType: "resistance",
      rows: [
        { id: "1", setLabel: "1", previous: "100 × 6", isWarmup: false, checked: true, displayWeight: "100", displayReps: "6" },
        { id: "2", setLabel: "2", previous: "100 × 6", isWarmup: false, checked: true, displayWeight: "100", displayReps: "6" },
        { id: "3", setLabel: "3", previous: "100 × 6", isWarmup: false, checked: true, displayWeight: "100", displayReps: "6" },
      ],
    },
    {
      name: "Romanian Deadlift",
      meta: "Barbell · Legs",
      exerciseType: "resistance",
      rows: [
        { id: "4", setLabel: "1", previous: "80 × 10", isWarmup: false, checked: true, displayWeight: "80", displayReps: "10" },
        { id: "5", setLabel: "2", previous: "80 × 10", isWarmup: false, checked: true, displayWeight: "80", displayReps: "10" },
        { id: "6", setLabel: "3", previous: "80 × 10", isWarmup: false, checked: true, displayWeight: "80", displayReps: "10" },
      ],
    },
  ],
};

const PREVIEW_EMPTY: SessionViewModel = {
  id: "preview-empty",
  title: "Evening Session",
  subtitle: "Today · 6:30 PM",
  duration: "0:00",
  volume: "0 kg",
  sets: "0",
  finished: true,
  empty: true,
  exerciseCards: [],
};

function EmptyStateGlyph() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
      <Path d="M10 8.5H26C27.1046 8.5 28 9.39543 28 10.5V25.5C28 26.6046 27.1046 27.5 26 27.5H10C8.89543 27.5 8 26.6046 8 25.5V10.5C8 9.39543 8.89543 8.5 10 8.5Z" stroke={COLORS.textTertiary} strokeWidth={1.8} />
      <Path d="M14 15H22" stroke={COLORS.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M14 12H18" stroke={COLORS.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M14 18H21" stroke={COLORS.textTertiary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function cloneSessionViewModel(session: SessionViewModel): SessionViewModel {
  return {
    ...session,
    exerciseCards: session.exerciseCards.map((card) => ({
      ...card,
      rows: card.rows.map((row) => ({ ...row })),
    })),
  };
}

function getPreviewSession(sessionId: string | undefined): SessionViewModel | null {
  if (sessionId === "preview-active") return cloneSessionViewModel(PREVIEW_ACTIVE);
  if (sessionId === "preview-leg-day") return cloneSessionViewModel(PREVIEW_LEG_DAY);
  if (sessionId === "preview-empty") return cloneSessionViewModel(PREVIEW_EMPTY);
  return null;
}

function makePreviewExerciseCard(exerciseName: string, exerciseType: ExerciseType): ExerciseCardData {
  const catalog = getExerciseCatalogItem(exerciseName);
  const meta = catalog
    ? `${catalog.equipment} · ${catalog.group}`
    : `${exerciseType === "cardio" ? "Cardio" : "Barbell"} · ${exerciseType === "cardio" ? "Conditioning" : "Resistance"}`;

  return {
    name: exerciseName,
    meta,
    exerciseType,
    rows: [
      {
        id: `preview-${exerciseName}-1`,
        setLabel: "1",
        previous: "—",
        isWarmup: false,
        checked: false,
        displayWeight: exerciseType === "cardio" ? "" : "",
        displayReps: "",
      },
    ],
  };
}

function appendPreviewExercise(
  current: SessionViewModel | null,
  sessionId: string | undefined,
  exerciseName: string,
  exerciseType: ExerciseType
): SessionViewModel | null {
  const base = current ? cloneSessionViewModel(current) : getPreviewSession(sessionId);
  if (!base) return null;

  const existingIndex = base.exerciseCards.findIndex((card) => card.name === exerciseName);
  if (existingIndex >= 0) {
    const existingCard = base.exerciseCards[existingIndex];
    const nextIndex = existingCard.rows.length + 1;
    existingCard.rows.push({
      id: `preview-${exerciseName}-${nextIndex}`,
      setLabel: String(nextIndex),
      previous: existingCard.rows[existingCard.rows.length - 1]?.displayWeight
        ? `${existingCard.rows[existingCard.rows.length - 1]?.displayWeight} × ${existingCard.rows[existingCard.rows.length - 1]?.displayReps ?? "0"}`
        : "—",
      isWarmup: false,
      checked: false,
      displayWeight: existingCard.exerciseType === "cardio" ? "" : "",
      displayReps: "",
    });
  } else {
    base.exerciseCards.push(makePreviewExerciseCard(exerciseName, exerciseType));
  }

  base.empty = false;
  base.finished = false;
  base.sets = String(base.exerciseCards.reduce((sum, card) => sum + card.rows.length, 0));
  return base;
}

function formatClock(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseOptionalInt(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parseOptionalNumber(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function isSetComplete(set: WorkoutSet) {
  if (set.exerciseType === "cardio") {
    return (set.durationMinutes ?? 0) > 0;
  }
  return (set.reps ?? 0) > 0 && ((set.weightKg ?? 0) > 0 || set.weightKg === 0);
}

function buildLiveSession(session: WorkoutSessionDetail, currentTime: number = Date.now()): SessionViewModel {
  const groups = new Map<string, WorkoutSet[]>();
  for (const set of session.sets) {
    const next = groups.get(set.exerciseName) ?? [];
    next.push(set);
    groups.set(set.exerciseName, next);
  }

  const cards = Array.from(groups.entries()).map(([exerciseName, sets]) => {
    const catalog = getExerciseCatalogItem(exerciseName);
    const meta = catalog
      ? `${catalog.equipment} · ${catalog.group}`
      : `${sets[0]?.exerciseType === "cardio" ? "Cardio" : "Barbell"} · ${
          sets[0]?.exerciseType === "cardio" ? "Conditioning" : "Resistance"
        }`;

    // Show data from most recent prior session for this exercise, matched by set index
    const prevSets = session.previousSets?.[exerciseName] ?? [];

    return {
      name: exerciseName,
      meta,
      exerciseType: sets[0]?.exerciseType ?? "resistance",
      rows: sets.map((set, index) => {
        const prevSet = prevSets[index];
        const previous =
          prevSet == null
            ? "—"
            : sets[0]?.exerciseType === "cardio"
              ? `${prevSet.durationMinutes ?? 0} min`
              : `${prevSet.weightKg ?? 0} × ${prevSet.reps ?? 0}`;

        return {
          id: set.id,
          setLabel: String(index + 1),
          previous,
          isWarmup: false,
          checked: isSetComplete(set),
          live: set,
        };
      }),
    };
  });

  const startedAt = new Date(session.startedAt).getTime();
  const endedAt = session.endedAt ? new Date(session.endedAt).getTime() : currentTime;
  const duration = formatClock(endedAt - startedAt);
  const totalVolume = session.sets.reduce(
    (sum, set) => sum + (set.exerciseType === "cardio" ? 0 : (set.weightKg ?? 0) * (set.reps ?? 0)),
    0
  );

  return {
    id: session.id,
    title: session.title,
    subtitle: new Date(session.startedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    duration,
    volume: `${Math.round(totalVolume).toLocaleString("en-US")} kg`,
    sets: String(session.sets.length),
    finished: !!session.endedAt,
    empty: session.sets.length === 0,
    exerciseCards: cards,
  };
}

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    id?: string | string[];
    addExerciseName?: string | string[];
    addExerciseType?: string | string[];
    addExerciseNonce?: string | string[];
  }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const addExerciseName = Array.isArray(params.addExerciseName) ? params.addExerciseName[0] : params.addExerciseName;
  const addExerciseType = Array.isArray(params.addExerciseType) ? params.addExerciseType[0] : params.addExerciseType;
  const addExerciseNonce = Array.isArray(params.addExerciseNonce) ? params.addExerciseNonce[0] : params.addExerciseNonce;

  const { getToken, isLoaded, isSignedIn } = useAuth();
  const isWebPreview = isWebPreviewMode();
  const isPreviewId =
    sessionId === "preview-active" || sessionId === "preview-leg-day" || sessionId === "preview-empty";
  const cc = useCommandCenter(
    sessionId && !isPreviewId ? { sessionId, screen: "workout" } : undefined,
  );

  const [previewFinished, setPreviewFinished] = useState(false);
  const [previewSession, setPreviewSession] = useState<SessionViewModel | null>(() => getPreviewSession(sessionId));
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>({});
  const [liveError, setLiveError] = useState<string | null>(null);
  const [pendingDeleteSet, setPendingDeleteSet] = useState<{ setId: string; previous: WorkoutSessionDetail | undefined } | null>(null);
  const [now, setNow] = useState(Date.now());
  const handledPickerNonceRef = useRef<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [exerciseNoteEditing, setExerciseNoteEditing] = useState<string | null>(null);
  const [exerciseNoteText, setExerciseNoteText] = useState("");

  useEffect(() => {
    if (!isPreviewId) return;
    setPreviewSession(getPreviewSession(sessionId));
    setPreviewFinished(false);
  }, [isPreviewId, sessionId]);

  const sessionQuery = useQuery({
    queryKey: ["workout-session-detail", sessionId],
    enabled: !!sessionId && !isPreviewId && !isWebPreview && !!isSignedIn,
    queryFn: async () => {
      if (!sessionId) throw new Error("Invalid session id");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSessionDetail>(`/api/workout-sessions/${sessionId}`, { token });
    },
  });

  // Tick every second for active session duration display
  useEffect(() => {
    const sessionData = sessionQuery.data;
    const isActive = sessionData && !sessionData.endedAt && !isPreviewId;
    if (!isActive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sessionQuery.data, isPreviewId]);

  const createSetMutation = useMutation({
    mutationFn: async (payload: {
      exerciseName: string;
      exerciseType: ExerciseType;
      reps?: number;
      weightKg?: number;
      durationMinutes?: number;
    }) => {
      if (!sessionId) throw new Error("Invalid session id");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSet>("/api/workout-sets", {
        method: "POST",
        token,
        body: JSON.stringify({
          sessionId,
          ...payload,
        }),
      });
    },
    onMutate: async (payload) => {
      if (!sessionId) return undefined;
      const queryKey = ["workout-session-detail", sessionId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkoutSessionDetail>(queryKey);
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const nowIso = new Date().toISOString();
      const optimisticSet: WorkoutSet = {
        id: tempId,
        sessionId,
        performedAt: nowIso,
        exerciseName: payload.exerciseName,
        exerciseType: payload.exerciseType,
        reps: payload.reps ?? null,
        weightKg: payload.weightKg ?? null,
        durationMinutes: payload.durationMinutes ?? null,
        notes: null,
        transcriptRaw: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      if (previous) {
        queryClient.setQueryData<WorkoutSessionDetail>(queryKey, {
          ...previous,
          sets: [...previous.sets, optimisticSet],
        });
      }
      return { previous, tempId };
    },
    onError: (error, _vars, context) => {
      if (sessionId && context?.previous) {
        queryClient.setQueryData(["workout-session-detail", sessionId], context.previous);
      }
      setLiveError(error instanceof Error ? error.message : "Failed to add set.");
    },
    onSuccess: (newSet, _vars, context) => {
      if (!sessionId || !context) return;
      const queryKey = ["workout-session-detail", sessionId];
      // Replace the optimistic temp set with the real one from the server.
      queryClient.setQueryData<WorkoutSessionDetail>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          sets: old.sets.map((s) => (s.id === context.tempId ? newSet : s)),
        };
      });
      // Migrate any draft the user already started typing under the temp id.
      setDrafts((prev) => {
        if (!prev[context.tempId]) return prev;
        const { [context.tempId]: tempDraft, ...rest } = prev;
        return { ...rest, [newSet.id]: tempDraft };
      });
    },
    onSettled: () => {
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ["workout-session-detail", sessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const updateSetMutation = useMutation({
    mutationFn: async ({
      setId,
      exerciseName,
      exerciseType,
      reps,
      weightKg,
      durationMinutes,
      notes,
    }: {
      setId: string;
      exerciseName: string;
      exerciseType: ExerciseType;
      reps: number | null;
      weightKg: number | null;
      durationMinutes: number | null;
      notes?: string | null;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSet>(`/api/workout-sets/${setId}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          exerciseName,
          exerciseType,
          reps,
          weightKg,
          durationMinutes,
          notes: notes ?? null,
        }),
      });
    },
    onMutate: async (vars) => {
      if (!sessionId) return undefined;
      const queryKey = ["workout-session-detail", sessionId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkoutSessionDetail>(queryKey);
      if (previous) {
        queryClient.setQueryData<WorkoutSessionDetail>(queryKey, {
          ...previous,
          sets: previous.sets.map((s) =>
            s.id === vars.setId
              ? {
                  ...s,
                  exerciseName: vars.exerciseName,
                  exerciseType: vars.exerciseType,
                  reps: vars.reps,
                  weightKg: vars.weightKg,
                  durationMinutes: vars.durationMinutes,
                  notes: vars.notes ?? s.notes,
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        });
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (sessionId && context?.previous) {
        queryClient.setQueryData(["workout-session-detail", sessionId], context.previous);
      }
      setLiveError(error instanceof Error ? error.message : "Failed to update set.");
    },
    onSuccess: (updatedSet) => {
      if (!sessionId) return;
      const queryKey = ["workout-session-detail", sessionId];
      queryClient.setQueryData<WorkoutSessionDetail>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          sets: old.sets.map((s) => (s.id === updatedSet.id ? updatedSet : s)),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const deleteSetMutation = useMutation({
    mutationFn: async (setId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<{ deleted: boolean }>(`/api/workout-sets/${setId}`, {
        method: "DELETE",
        token,
      });
    },
    onMutate: async (setId: string) => {
      if (!sessionId) return undefined;
      const queryKey = ["workout-session-detail", sessionId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkoutSessionDetail>(queryKey);
      if (previous) {
        queryClient.setQueryData<WorkoutSessionDetail>(queryKey, {
          ...previous,
          sets: previous.sets.filter((s) => s.id !== setId),
        });
      }
      // Drop the draft entry for the deleted set so it doesn't linger.
      setDrafts((prev) => {
        if (!prev[setId]) return prev;
        const next = { ...prev };
        delete next[setId];
        return next;
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (sessionId && context?.previous) {
        queryClient.setQueryData(["workout-session-detail", sessionId], context.previous);
      }
      setLiveError(error instanceof Error ? error.message : "Failed to delete set.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Invalid session id");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSessionDetail>(`/api/workout-sessions/${sessionId}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ endedAt: new Date().toISOString() }),
      });
    },
    onSuccess: async () => {
      haptic.success();
      await Promise.all([
        sessionQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["workout-sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => {
      setLiveError(error instanceof Error ? error.message : "Failed to finish session.");
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Invalid session id");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<{ deleted: boolean }>(`/api/workout-sessions/${sessionId}`, {
        method: "DELETE",
        token,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workout-sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/workouts");
    },
    onError: (error) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to delete session.");
    },
  });

  const renameSessionMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!sessionId) throw new Error("Invalid session id");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSessionDetail>(`/api/workout-sessions/${sessionId}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ title }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        sessionQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["workout-sessions"] }),
      ]);
    },
    onError: (error) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to rename session.");
    },
  });

  const editExerciseNotesMutation = useMutation({
    mutationFn: async (vars: { exerciseName: string; note: string }) => {
      if (!sessionId) throw new Error("Invalid session id");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      // Build the full notes map from the current cache so we send a complete object.
      const current = queryClient.getQueryData<WorkoutSessionDetail>([
        "workout-session-detail",
        sessionId,
      ]);
      const nextNotes: Record<string, string> = { ...(current?.exerciseNotes ?? {}) };
      const trimmed = vars.note.trim();
      if (trimmed) {
        nextNotes[vars.exerciseName] = trimmed;
      } else {
        delete nextNotes[vars.exerciseName];
      }
      return apiRequest<WorkoutSessionDetail>(`/api/workout-sessions/${sessionId}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ exerciseNotes: nextNotes }),
      });
    },
    onMutate: async (vars) => {
      if (!sessionId) return undefined;
      const queryKey = ["workout-session-detail", sessionId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkoutSessionDetail>(queryKey);
      if (previous) {
        const nextNotes: Record<string, string> = { ...(previous.exerciseNotes ?? {}) };
        const trimmed = vars.note.trim();
        if (trimmed) {
          nextNotes[vars.exerciseName] = trimmed;
        } else {
          delete nextNotes[vars.exerciseName];
        }
        queryClient.setQueryData<WorkoutSessionDetail>(queryKey, {
          ...previous,
          exerciseNotes: nextNotes,
        });
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (sessionId && context?.previous) {
        queryClient.setQueryData(["workout-session-detail", sessionId], context.previous);
      }
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save note.");
    },
    onSuccess: (updated) => {
      if (!sessionId) return;
      // Reconcile with what the server actually saved (preserves other fields too).
      queryClient.setQueryData<WorkoutSessionDetail>(
        ["workout-session-detail", sessionId],
        (old) => (old ? { ...old, exerciseNotes: updated.exerciseNotes ?? null } : old)
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
    },
  });

  const handleSessionMenu = () => {
    if (isPreviewId || isWebPreview) return;
    Keyboard.dismiss();
    Alert.alert(
      session?.title ?? "Session",
      undefined,
      [
        {
          text: "Rename",
          onPress: () => {
            setRenameText(session?.title ?? "");
            setRenameModalVisible(true);
          },
        },
        {
          text: "Delete Session",
          style: "destructive",
          onPress: () => {
            haptic.warning();
            Alert.alert(
              "Delete this session?",
              "This will remove the session and all its sets. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => void deleteSessionMutation.mutateAsync(),
                },
              ]
            );
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleExerciseMenu = (exerciseName: string) => {
    if (isPreviewId || isWebPreview) return;
    Keyboard.dismiss();
    Alert.alert(
      exerciseName,
      undefined,
      [
        {
          text: "Delete exercise",
          style: "destructive",
          onPress: () => {
            haptic.warning();
            Alert.alert(
              `Delete "${exerciseName}"?`,
              "All sets for this exercise will be removed from the session.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => void handleDeleteExercise(exerciseName),
                },
              ]
            );
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleDeleteExercise = async (exerciseName: string) => {
    if (!sessionQuery.data || !sessionId) return;
    const setIds = sessionQuery.data.sets
      .filter((s) => s.exerciseName === exerciseName && !s.id.startsWith("temp-"))
      .map((s) => s.id);
    if (!setIds.length) return;
    try {
      await Promise.all(setIds.map((id) => deleteSetMutation.mutateAsync(id)));
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "Failed to delete exercise.");
    }
  };

  const handleRenameConfirm = () => {
    const trimmed = renameText.trim();
    if (!trimmed) return;
    setRenameModalVisible(false);
    Keyboard.dismiss();
    void renameSessionMutation.mutateAsync(trimmed);
  };

  const openExerciseNoteEditor = (exerciseName: string) => {
    if (isPreviewId || isWebPreview) return;
    if (session?.finished) return;
    const existing = sessionQuery.data?.exerciseNotes?.[exerciseName] ?? "";
    setExerciseNoteEditing(exerciseName);
    setExerciseNoteText(existing);
  };

  const handleExerciseNoteSave = () => {
    if (!exerciseNoteEditing) return;
    const exerciseName = exerciseNoteEditing;
    const note = exerciseNoteText;
    setExerciseNoteEditing(null);
    setExerciseNoteText("");
    Keyboard.dismiss();
    void editExerciseNotesMutation.mutateAsync({ exerciseName, note });
  };

  const handleExerciseNoteCancel = () => {
    setExerciseNoteEditing(null);
    setExerciseNoteText("");
    Keyboard.dismiss();
  };

  useEffect(() => {
    if (!sessionQuery.data) return;
    setDrafts((prev) => {
      // Only seed drafts for sets we haven't seen before. Overwriting existing
      // drafts on every cache update would clobber what the user is typing in
      // another row when an unrelated mutation lands.
      let changed = false;
      const next = { ...prev };
      for (const set of sessionQuery.data.sets) {
        if (next[set.id]) continue;
        next[set.id] = {
          reps: set.reps == null ? "" : String(set.reps),
          weightKg: set.weightKg == null ? "" : String(set.weightKg),
          durationMinutes: set.durationMinutes == null ? "" : String(set.durationMinutes),
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [sessionQuery.data]);

  useEffect(() => {
    if (!sessionId || !addExerciseName || !addExerciseNonce) return;
    if (handledPickerNonceRef.current === addExerciseNonce) return;

    handledPickerNonceRef.current = addExerciseNonce;
    setLiveError(null);

    if (isPreviewId || isWebPreview) {
      setPreviewSession((current) =>
        appendPreviewExercise(
          current,
          sessionId,
          addExerciseName,
          addExerciseType === "cardio" ? "cardio" : "resistance"
        )
      );
      router.setParams({
        addExerciseName: undefined,
        addExerciseType: undefined,
        addExerciseNonce: undefined,
      });
      return;
    }

    void createSetMutation.mutateAsync({
      exerciseName: addExerciseName,
      exerciseType: addExerciseType === "cardio" ? "cardio" : "resistance",
    });
    router.setParams({
      addExerciseName: undefined,
      addExerciseType: undefined,
      addExerciseNonce: undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- createSetMutation is stable via nonce guard
  }, [
    addExerciseName,
    addExerciseNonce,
    addExerciseType,
    isPreviewId,
    isWebPreview,
    router,
    sessionId,
  ]);

  if (!isLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn && !isWebPreview) {
    return <Redirect href="/sign-in" />;
  }

  const session: SessionViewModel | null = (() => {
    if (!sessionId) return null;
    if (isPreviewId) return previewSession ? { ...previewSession, finished: previewFinished || previewSession.finished } : null;
    return sessionQuery.data ? buildLiveSession(sessionQuery.data, now) : null;
  })();

  const handleFinish = async () => {
    if (isPreviewId || isWebPreview) {
      setPreviewFinished(true);
      return;
    }
    await finishMutation.mutateAsync();
  };

  const handleAddSet = async (card: ExerciseCardData) => {
    if (isPreviewId || isWebPreview) {
      setPreviewSession((current) => {
        if (!current) return current;
        const next = cloneSessionViewModel(current);
        const target = next.exerciseCards.find((exerciseCard) => exerciseCard.name === card.name);
        if (!target) return next;
        const lastRow = target.rows[target.rows.length - 1];
        const nextIndex = target.rows.length + 1;
        target.rows.push({
          id: `preview-${card.name}-${nextIndex}`,
          setLabel: String(nextIndex),
          previous: lastRow?.displayWeight ? `${lastRow.displayWeight} × ${lastRow.displayReps ?? "0"}` : "—",
          isWarmup: false,
          checked: false,
          displayWeight: card.exerciseType === "cardio" ? "" : "",
          displayReps: "",
        });
        next.sets = String(next.exerciseCards.reduce((sum, exerciseCard) => sum + exerciseCard.rows.length, 0));
        return next;
      });
      return;
    }
    setLiveError(null);
    await createSetMutation.mutateAsync({
      exerciseName: card.name,
      exerciseType: card.exerciseType,
    });
  };

  const handleDeleteSet = (set: WorkoutSet) => {
    if (isPreviewId || isWebPreview) return;
    if (session?.finished) return;
    if (set.id.startsWith("temp-")) {
      Alert.alert("Still saving", "Hang on a moment, then try again.");
      return;
    }
    if (!sessionId) return;
    // If a previous undo is still in flight, finalize it first so we don't
    // stack two snapshots.
    if (pendingDeleteSet) {
      void deleteSetMutation.mutateAsync(pendingDeleteSet.setId);
    }
    const queryKey = ["workout-session-detail", sessionId];
    const previous = queryClient.getQueryData<WorkoutSessionDetail>(queryKey);
    queryClient.setQueryData<WorkoutSessionDetail>(queryKey, (data) =>
      data ? { ...data, sets: data.sets.filter((s) => s.id !== set.id) } : data,
    );
    setPendingDeleteSet({ setId: set.id, previous });
  };

  const handleUndoDelete = () => {
    if (!pendingDeleteSet || !sessionId) return;
    const queryKey = ["workout-session-detail", sessionId];
    if (pendingDeleteSet.previous) {
      queryClient.setQueryData(queryKey, pendingDeleteSet.previous);
    }
    setPendingDeleteSet(null);
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteSet) return;
    const setId = pendingDeleteSet.setId;
    setPendingDeleteSet(null);
    void deleteSetMutation.mutateAsync(setId);
  };

  const handleSaveLiveSet = async (set: WorkoutSet) => {
    const draft = drafts[set.id] ?? { reps: "", weightKg: "", durationMinutes: "" };
    const reps = parseOptionalInt(draft.reps);
    const weightKg = parseOptionalNumber(draft.weightKg);
    const durationMinutes = parseOptionalInt(draft.durationMinutes);
    if (reps === null || weightKg === null || durationMinutes === null) {
      setLiveError("Reps, weight, and duration must be non-negative numbers.");
      return;
    }
    setLiveError(null);
    await updateSetMutation.mutateAsync({
      setId: set.id,
      exerciseName: set.exerciseName,
      exerciseType: set.exerciseType,
      reps: reps ?? null,
      weightKg: weightKg ?? null,
      durationMinutes: durationMinutes ?? null,
      notes: set.notes,
    });
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: session?.title ?? "Workout",
          headerRight: () => (
            <View style={styles.headerActions}>
              {!isPreviewId && !isWebPreview && session ? (
                <Pressable
                  style={styles.iconButton}
                  onPress={handleSessionMenu}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Session options"
                >
                  <Icon name="ellipsisVertical" size={18} color={token.textMute} />
                </Pressable>
              ) : null}
              {!session?.finished ? (
                <Pressable
                  style={[styles.finishButton, styles.finishButtonActive]}
                  onPress={() => void handleFinish()}
                  disabled={finishMutation.isPending}
                >
                  <Text style={styles.finishButtonText}>Finish</Text>
                </Pressable>
              ) : null}
            </View>
          ),
        }}
      />
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >

        <SessionStatsStrip
          duration={session?.duration ?? "0:00"}
          volume={session?.volume ?? "0 kg"}
          sets={session?.sets ?? "0"}
        />

        {liveError ? <Text selectable style={styles.errorBanner}>{liveError}</Text> : null}

        {sessionQuery.isLoading && !session ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
          </View>
        ) : null}

        {session?.empty ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <EmptyStateGlyph />
            </View>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptyBody}>
              Add your first exercise to get started, or just speak into the mic below.
            </Text>
            {!session?.finished && (
              <>
                <Pressable
                  style={styles.addExerciseButton}
                  onPress={() => router.push({ pathname: "/exercise-picker", params: { sessionId } })}
                >
                  <Text style={styles.addExerciseText}>＋ Add Exercise</Text>
                </Pressable>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>Or</Text>
                  <View style={styles.orLine} />
                </View>
                <Pressable
                  style={styles.voicePrompt}
                  onPress={cc.record}
                >
                  <View style={styles.voicePromptMic}>
                    <Icon name="mic" size={18} color={token.accentInk} />
                  </View>
                  <Text style={styles.voicePromptText}>"Bench press 3 sets of 10 at 80 kg"</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : session ? (
          <View style={styles.cardsWrap}>
            {session.exerciseCards.map((card) => (
              <WorkoutExerciseCard
                key={card.name}
                card={card}
                sessionFinished={session.finished}
                isPreview={isPreviewId || isWebPreview}
                drafts={drafts}
                noteText={sessionQuery.data?.exerciseNotes?.[card.name] ?? ""}
                onExerciseMenu={handleExerciseMenu}
                onOpenNoteEditor={openExerciseNoteEditor}
                onChangeDraft={(setId, patch) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [setId]: { ...(prev[setId] ?? { reps: "", weightKg: "", durationMinutes: "" }), ...patch },
                  }))
                }
                onToggleComplete={(row) => {
                  if (row.live) { haptic.success(); void handleSaveLiveSet(row.live); }
                }}
                onLongPressChip={(row) => {
                  if (row.live) handleDeleteSet(row.live);
                }}
                onAddSet={handleAddSet}
              />
            ))}

            {!session.finished && (
              <Pressable
                style={styles.addExerciseGhostButton}
                onPress={() => router.push({ pathname: "/exercise-picker", params: { sessionId } })}
              >
                <Text style={styles.addExerciseGhostText}>＋ Add Exercise</Text>
              </Pressable>
            )}

            {!session.finished && (
              <View style={styles.activeVoicePrompt}>
                <Text style={styles.activeVoicePromptText}>
                  Or say <Text style={styles.activeVoicePromptTextStrong}>"lat pulldown 3x12"</Text>
                </Text>
              </View>
            )}
          </View>
        ) : sessionQuery.error ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Couldn’t load session</Text>
            <Text selectable style={styles.emptyBody}>
              {sessionQuery.error instanceof Error ? sessionQuery.error.message : "Please try again."}
            </Text>
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      {!session?.finished && (
        <FloatingCommandBar
          hint={session?.empty ? "Did 3 sets of squats at 100kg…" : "80 kilos for 10 reps…"}
          {...cc.launcherProps}
          bottomOffset={12}
          safeAreaBottom
        />
      )}
      <UndoToast
        visible={!!pendingDeleteSet}
        message="Set deleted"
        onUndo={handleUndoDelete}
        onDismiss={handleConfirmDelete}
      />
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setRenameModalVisible(false)}
          />
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Rename Session</Text>
            <TextInput
              style={styles.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Session name"
              placeholderTextColor={COLORS.textTertiary}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleRenameConfirm}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButtonCancel}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButtonConfirm,
                  !renameText.trim() && styles.modalButtonDisabled,
                ]}
                onPress={handleRenameConfirm}
                disabled={!renameText.trim() || renameSessionMutation.isPending}
              >
                <Text style={styles.modalButtonConfirmText}>
                  {renameSessionMutation.isPending ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={exerciseNoteEditing != null}
        transparent
        animationType="fade"
        onRequestClose={handleExerciseNoteCancel}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleExerciseNoteCancel}
          />
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {exerciseNoteEditing ? `Note · ${exerciseNoteEditing}` : "Note"}
            </Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMultiline]}
              value={exerciseNoteText}
              onChangeText={setExerciseNoteText}
              placeholder="e.g. Felt heavy today, focus on form"
              placeholderTextColor={COLORS.textTertiary}
              autoFocus
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalButtonCancel} onPress={handleExerciseNoteCancel}>
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalButtonConfirm}
                onPress={handleExerciseNoteSave}
                disabled={editExerciseNotesMutation.isPending}
              >
                <Text style={styles.modalButtonConfirmText}>
                  {editExerciseNotesMutation.isPending ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: token.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: token.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: 178 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  finishButton: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: rad.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  finishButtonActive: { backgroundColor: token.accent },
  finishButtonDisabled: { backgroundColor: token.surface, borderWidth: 1, borderColor: token.line },
  finishButtonText: {
    fontFamily: font.sans[700],
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.48,
    color: token.accentInk,
  },
  finishButtonTextDisabled: { color: token.textMute },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    fontFamily: font.sans[600],
    color: token.negative,
    fontSize: 13,
    fontWeight: "600",
  },
  loadingWrap: { paddingVertical: 48, alignItems: "center" },
  cardsWrap: { paddingHorizontal: 20, paddingTop: 4, gap: 24 },
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: rad.pill,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: font.sans[600],
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.27,
    color: token.text,
  },
  emptyBody: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: font.sans[400],
    fontSize: 14,
    lineHeight: 22,
    color: token.textSoft,
  },
  addExerciseButton: {
    width: "100%",
    marginTop: 24,
    height: 56,
    borderRadius: rad.sm,
    borderCurve: "continuous",
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addExerciseText: {
    fontFamily: font.sans[700],
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: token.accentInk,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    marginVertical: 18,
  },
  orLine: { flex: 1, height: 1, backgroundColor: token.line },
  orText: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.textMute,
  },
  voicePrompt: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: rad.sm,
    borderCurve: "continuous",
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  voicePromptMic: {
    width: 32,
    height: 32,
    borderRadius: rad.pill,
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  voicePromptText: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 14,
    color: token.textSoft,
  },
  addExerciseGhostButton: {
    marginTop: 4,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: token.line2,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addExerciseGhostText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: token.textSoft,
  },
  activeVoicePrompt: {
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 4,
  },
  activeVoicePromptText: {
    fontFamily: font.sans[400],
    fontSize: 12,
    color: token.textMute,
  },
  activeVoicePromptTextStrong: {
    fontFamily: font.sans[600],
    color: token.textSoft,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line2,
    borderRadius: rad.md,
    borderCurve: "continuous",
    padding: 24,
  },
  modalTitle: {
    fontFamily: font.sans[600],
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.27,
    color: token.text,
    marginBottom: 16,
  },
  modalInput: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: token.line,
    backgroundColor: token.surface2,
    fontFamily: font.sans[400],
    fontSize: 15,
    fontWeight: "400",
    color: token.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  modalInputMultiline: {
    minHeight: 96,
    paddingTop: 12,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalButtonCancel: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderCurve: "continuous",
  },
  modalButtonCancelText: {
    fontFamily: font.sans[600],
    fontSize: 14,
    fontWeight: "600",
    color: token.textSoft,
  },
  modalButtonConfirm: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: token.accent,
  },
  modalButtonDisabled: {
    opacity: 0.4,
  },
  modalButtonConfirmText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    color: token.accentInk,
  },
});
