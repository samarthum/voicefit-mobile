import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { FakeTabBar } from "../../components/FakeTabBar";
import { FloatingCommandBar } from "../../components/FloatingCommandBar";
import { getExerciseCatalogItem } from "../../lib/exercise-catalog";
import { apiRequest } from "../../lib/api-client";

const COLORS = {
  bg: "#FFFFFF",
  surface: "#F8F8F8",
  border: "#E8E8E8",
  textPrimary: "#1A1A1A",
  textSecondary: "#8E8E93",
  textTertiary: "#AEAEB2",
  green: "#34C759",
  error: "#FF3B30",
};

type ExerciseType = "resistance" | "cardio";

interface WorkoutSet {
  id: string;
  sessionId: string;
  performedAt: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  reps: number | null;
  weightKg: number | null;
  durationMinutes: number | null;
  notes: string | null;
  transcriptRaw: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkoutSessionDetail {
  id: string;
  userId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sets: WorkoutSet[];
  previousBests?: Record<string, { weightKg: number | null; reps: number | null; durationMinutes: number | null }>;
}

type SetDraft = {
  reps: string;
  weightKg: string;
  durationMinutes: string;
};

type RenderRow = {
  id: string;
  setLabel: string;
  previous: string;
  isWarmup: boolean;
  checked: boolean;
  live?: WorkoutSet;
  displayWeight?: string;
  displayReps?: string;
};

type ExerciseCard = {
  name: string;
  meta: string;
  exerciseType: ExerciseType;
  rows: RenderRow[];
};

type SessionViewModel = {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  volume: string;
  sets: string;
  finished: boolean;
  empty: boolean;
  exerciseCards: ExerciseCard[];
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

function BackGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5L8 12L15 19" stroke={COLORS.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function DotsGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M8 3.5A1 1 0 108 1.5A1 1 0 008 3.5Z" fill={COLORS.textTertiary} />
      <Path d="M8 9A1 1 0 108 7A1 1 0 008 9Z" fill={COLORS.textTertiary} />
      <Path d="M8 14.5A1 1 0 108 12.5A1 1 0 008 14.5Z" fill={COLORS.textTertiary} />
    </Svg>
  );
}

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

function MicGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5C10.067 3.5 8.5 5.067 8.5 7V12C8.5 13.933 10.067 15.5 12 15.5C13.933 15.5 15.5 13.933 15.5 12V7C15.5 5.067 13.933 3.5 12 3.5Z" stroke="#FFFFFF" strokeWidth={2} />
      <Path d="M5.5 11.5C5.5 15.09 8.41 18 12 18C15.59 18 18.5 15.09 18.5 11.5" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 18V21" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
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

function makePreviewExerciseCard(exerciseName: string, exerciseType: ExerciseType): ExerciseCard {
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

function CheckGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 12.5L10 16.5L18 8.5" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
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

    // Show data from most recent prior session for this exercise
    const prevBest = session.previousBests?.[exerciseName];
    const previous =
      prevBest == null
        ? "—"
        : sets[0]?.exerciseType === "cardio"
          ? `${prevBest.durationMinutes ?? 0} min`
          : `${prevBest.weightKg ?? 0} × ${prevBest.reps ?? 0}`;

    return {
      name: exerciseName,
      meta,
      exerciseType: sets[0]?.exerciseType ?? "resistance",
      rows: sets.map((set, index) => ({
        id: set.id,
        setLabel: String(index + 1),
        previous,
        isWarmup: false,
        checked: isSetComplete(set),
        live: set,
      })),
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
  const isWebPreview = __DEV__ && Platform.OS === "web";
  const isPreviewId =
    sessionId === "preview-active" || sessionId === "preview-leg-day" || sessionId === "preview-empty";

  const [previewFinished, setPreviewFinished] = useState(false);
  const [previewSession, setPreviewSession] = useState<SessionViewModel | null>(() => getPreviewSession(sessionId));
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>({});
  const [liveError, setLiveError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const handledPickerNonceRef = useRef<string | null>(null);

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
    onSuccess: async () => {
      await Promise.all([
        sessionQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["workout-sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => {
      setLiveError(error instanceof Error ? error.message : "Failed to add set.");
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
    onSuccess: async () => {
      await Promise.all([
        sessionQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["workout-sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => {
      setLiveError(error instanceof Error ? error.message : "Failed to update set.");
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

  useEffect(() => {
    if (!sessionQuery.data) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const set of sessionQuery.data.sets) {
        next[set.id] = {
          reps: set.reps == null ? "" : String(set.reps),
          weightKg: set.weightKg == null ? "" : String(set.weightKg),
          durationMinutes: set.durationMinutes == null ? "" : String(set.durationMinutes),
        };
      }
      return next;
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

  const handleAddSet = async (card: ExerciseCard) => {
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
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => {
            if (router.canGoBack()) { router.back(); } else { router.replace("/(tabs)/workouts"); }
          }}>
            <BackGlyph />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.sessionTitle}>{session?.title ?? "Workout Session"}</Text>
            <Text style={styles.sessionSubtitle}>{session?.subtitle ?? "Loading..."}</Text>
          </View>
          <Pressable
            style={[
              styles.finishButton,
              session?.finished ? styles.finishButtonDisabled : styles.finishButtonActive,
            ]}
            onPress={() => void handleFinish()}
            disabled={session?.finished || finishMutation.isPending}
          >
            <Text style={[styles.finishButtonText, session?.finished ? styles.finishButtonTextDisabled : null]}>
              Finish
            </Text>
          </Pressable>
        </View>

        <View style={styles.statsStrip}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{session?.duration ?? "0:00"}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{session?.volume ?? "0 kg"}</Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{session?.sets ?? "0"}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
        </View>

        {liveError ? <Text style={styles.errorBanner}>{liveError}</Text> : null}

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
              onPress={() => router.push({ pathname: "/(tabs)/dashboard", params: { cc: "recording" } })}
            >
              <View style={styles.voicePromptMic}>
                <MicGlyph />
              </View>
              <Text style={styles.voicePromptText}>"Bench press 3 sets of 10 at 80 kg"</Text>
            </Pressable>
          </View>
        ) : session ? (
          <View style={styles.cardsWrap}>
            {session.exerciseCards.map((card) => (
              <View key={card.name} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View>
                    <Text style={styles.exerciseTitle}>{card.name}</Text>
                    <View style={styles.exerciseMetaRow}>
                      <View style={styles.exerciseMetaDot} />
                      <Text style={styles.exerciseMeta}>{card.meta}</Text>
                    </View>
                  </View>
                  <DotsGlyph />
                </View>

                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderLabel, styles.colSet]}>Set</Text>
                  <Text style={[styles.tableHeaderLabel, styles.colPrevious]}>Previous</Text>
                  {card.exerciseType === "cardio" ? (
                    <>
                      <Text style={[styles.tableHeaderLabel, styles.colValue]}>Min</Text>
                      <Text style={[styles.tableHeaderLabel, styles.colValue]}>—</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.tableHeaderLabel, styles.colValue]}>KG</Text>
                      <Text style={[styles.tableHeaderLabel, styles.colValue]}>Reps</Text>
                    </>
                  )}
                  <View style={styles.colCheck} />
                </View>

                {card.rows.map((row) => {
                  if (!row.live) {
                    return (
                      <View key={row.id} style={[styles.setRow, row.checked ? styles.setRowChecked : null]}>
                        <View style={[styles.setChip, row.isWarmup ? styles.warmupChip : null]}>
                          <Text style={[styles.setChipText, row.isWarmup ? styles.warmupChipText : null]}>
                            {row.setLabel}
                          </Text>
                        </View>
                        <Text style={[styles.rowText, styles.colPrevious]}>{row.previous}</Text>
                        {row.checked ? (
                          <>
                            <Text style={[styles.rowText, styles.colValue]}>{row.displayWeight ?? "—"}</Text>
                            <Text style={[styles.rowText, styles.colValue]}>{row.displayReps ?? "—"}</Text>
                          </>
                        ) : (
                          <>
                            <View style={[styles.previewInputPill, styles.colValue]}>
                              <Text style={styles.previewInputText}>{row.displayWeight ?? ""}</Text>
                            </View>
                            <View style={[styles.previewInputPill, styles.colValue]}>
                              <Text style={styles.previewInputText}>{row.displayReps ?? ""}</Text>
                            </View>
                          </>
                        )}
                        <View style={[styles.checkCell, row.checked ? styles.checkCellFilled : null]}>
                          {row.checked ? <CheckGlyph /> : null}
                        </View>
                      </View>
                    );
                  }

                  const draft = drafts[row.live.id] ?? {
                    reps: row.live.reps == null ? "" : String(row.live.reps),
                    weightKg: row.live.weightKg == null ? "" : String(row.live.weightKg),
                    durationMinutes: row.live.durationMinutes == null ? "" : String(row.live.durationMinutes),
                  };

                  return (
                    <View key={row.id} style={[styles.setRow, row.checked ? styles.setRowChecked : null]}>
                      <View style={[styles.setChip, row.isWarmup ? styles.warmupChip : null]}>
                        <Text style={[styles.setChipText, row.isWarmup ? styles.warmupChipText : null]}>
                          {row.setLabel}
                        </Text>
                      </View>
                      <Text style={[styles.rowText, styles.colPrevious]}>{row.previous}</Text>
                      <TextInput
                        style={[styles.rowInput, styles.colValue]}
                        value={draft.weightKg}
                        onChangeText={(value) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.live!.id]: { ...draft, weightKg: value.replace(/[^\d.]/g, "") },
                          }))
                        }
                        keyboardType="decimal-pad"
                        placeholder="-"
                        placeholderTextColor={COLORS.textTertiary}
                      />
                      <TextInput
                        style={[styles.rowInput, styles.colValue]}
                        value={row.live.exerciseType === "cardio" ? draft.durationMinutes : draft.reps}
                        onChangeText={(value) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.live!.id]:
                              row.live!.exerciseType === "cardio"
                                ? { ...draft, durationMinutes: value.replace(/[^\d]/g, "") }
                                : { ...draft, reps: value.replace(/[^\d]/g, "") },
                          }))
                        }
                        keyboardType="number-pad"
                        placeholder="-"
                        placeholderTextColor={COLORS.textTertiary}
                      />
                      <Pressable
                        style={[styles.checkCell, row.checked ? styles.checkCellFilled : null]}
                        onPress={() => void handleSaveLiveSet(row.live!)}
                      >
                        {row.checked ? <CheckGlyph /> : null}
                      </Pressable>
                    </View>
                  );
                })}

                <Pressable style={styles.addSetRow} onPress={() => void handleAddSet(card)}>
                  <Text style={styles.addSetText}>＋ Add Set</Text>
                </Pressable>
              </View>
            ))}

            <Pressable
              style={styles.addExerciseGhostButton}
              onPress={() => router.push({ pathname: "/exercise-picker", params: { sessionId } })}
            >
              <Text style={styles.addExerciseGhostText}>＋ Add Exercise</Text>
            </Pressable>

            <View style={styles.activeVoicePrompt}>
              <Text style={styles.activeVoicePromptText}>
                Or say <Text style={styles.activeVoicePromptTextStrong}>"lat pulldown 3x12"</Text>
              </Text>
            </View>
          </View>
        ) : sessionQuery.error ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Couldn’t load session</Text>
            <Text style={styles.emptyBody}>
              {sessionQuery.error instanceof Error ? sessionQuery.error.message : "Please try again."}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <FloatingCommandBar
        hint={session?.empty ? '"Did 3 sets of squats at 100kg..."' : '"Add 3 sets of curls at 15kg..."'}
        onPress={() => router.push({ pathname: "/(tabs)/dashboard", params: { cc: "expanded" } })}
        onMicPress={() => router.push({ pathname: "/(tabs)/dashboard", params: { cc: "recording" } })}
        bottomOffset={91}
      />
      <FakeTabBar active="workouts" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 178 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  sessionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  sessionSubtitle: { marginTop: 2, fontSize: 12, color: COLORS.textSecondary },
  finishButton: { minWidth: 72, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center" },
  finishButtonActive: { backgroundColor: COLORS.green },
  finishButtonDisabled: { backgroundColor: COLORS.border },
  finishButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  finishButtonTextDisabled: { color: COLORS.textSecondary },
  statsStrip: { flexDirection: "row", backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statCell: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statValue: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  statLabel: { marginTop: 3, fontSize: 11, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", color: COLORS.textSecondary },
  errorBanner: { marginHorizontal: 16, marginTop: 12, color: COLORS.error, fontSize: 13, fontWeight: "600" },
  loadingWrap: { paddingVertical: 48, alignItems: "center" },
  cardsWrap: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  exerciseCard: { borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, overflow: "hidden" },
  exerciseHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  exerciseTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  exerciseMetaRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  exerciseMetaDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "#AF52DE" },
  exerciseMeta: { fontSize: 13, color: COLORS.textSecondary },
  tableHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  tableHeaderLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: COLORS.textSecondary },
  colSet: { width: 32 },
  colPrevious: { flex: 1.1 },
  colValue: { flex: 0.75, textAlign: "center" },
  colCheck: { width: 38, alignItems: "flex-end" },
  setRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  setRowChecked: { backgroundColor: "rgba(52,199,89,0.10)" },
  setChip: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", marginRight: 4 },
  warmupChip: { backgroundColor: "rgba(52,199,89,0.16)" },
  setChipText: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  warmupChipText: { color: COLORS.green },
  rowText: { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
  rowInput: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  previewInputPill: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  previewInputText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  checkCell: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  checkCellFilled: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  addSetRow: { alignItems: "center", justifyContent: "center", paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  addSetText: { fontSize: 16, fontWeight: "600", color: COLORS.textSecondary },
  emptyWrap: { alignItems: "center", paddingHorizontal: 24, paddingTop: 100 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  emptyBody: { marginTop: 8, textAlign: "center", fontSize: 14, lineHeight: 22, color: COLORS.textSecondary },
  addExerciseButton: { width: "100%", marginTop: 28, borderRadius: 16, backgroundColor: COLORS.textPrimary, paddingVertical: 16, alignItems: "center" },
  addExerciseText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", marginVertical: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", color: COLORS.textTertiary },
  voicePrompt: { width: "100%", flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, paddingHorizontal: 14, paddingVertical: 14 },
  voicePromptMic: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.textPrimary, alignItems: "center", justifyContent: "center" },
  voicePromptText: { flex: 1, fontSize: 15, fontWeight: "500", color: COLORS.textSecondary },
  addExerciseGhostButton: {
    marginTop: 2,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addExerciseGhostText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  activeVoicePrompt: {
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 4,
  },
  activeVoicePromptText: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  activeVoicePromptTextStrong: {
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
});
