import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { FloatingCommandBar } from "../../components/FloatingCommandBar";
import { apiRequest } from "../../lib/api-client";

const COLORS = {
  bg: "#FFFFFF",
  surface: "#F8F8F8",
  border: "#E8E8E8",
  textPrimary: "#1A1A1A",
  textSecondary: "#8E8E93",
  textTertiary: "#AEAEB2",
  workouts: "#AF52DE",
  steps: "#34C759",
};

interface WorkoutSessionListItem {
  id: string;
  userId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  setCount: number;
}

interface WorkoutSessionsResponse {
  sessions: WorkoutSessionListItem[];
  total: number;
  limit: number;
  offset: number;
}

type SessionPreview = {
  id: string;
  title: string;
  subtitle: string;
  status: "active" | "done";
  exercises: Array<{
    name: string;
    detail: string;
    weight: string;
    reps: string;
  }>;
  summary: string;
  navigable: boolean;
};

type StatsPreview = {
  sessions: string;
  sets: string;
  exercises: string;
};

const SAMPLE_STATS: StatsPreview = {
  sessions: "12",
  sets: "47",
  exercises: "6",
};

const SAMPLE_SESSIONS: SessionPreview[] = [
  {
    id: "preview-active",
    title: "Morning Push",
    subtitle: "Today · 10:15 AM",
    status: "active",
    exercises: [
      {
        name: "Bench Press",
        detail: "Barbell · Resistance",
        weight: "80 kg",
        reps: "3 × 8 reps",
      },
      {
        name: "Overhead Press",
        detail: "Dumbbell · Resistance",
        weight: "24 kg",
        reps: "3 × 10 reps",
      },
    ],
    summary: "2 exercises · 6 sets",
    navigable: true,
  },
  {
    id: "preview-done",
    title: "Leg Day",
    subtitle: "Yesterday · 6:30 PM",
    status: "done",
    exercises: [
      {
        name: "Barbell Squat",
        detail: "Barbell · Resistance",
        weight: "100 kg",
        reps: "4 × 6 reps",
      },
      {
        name: "Romanian Deadlift",
        detail: "Barbell · Resistance",
        weight: "80 kg",
        reps: "3 × 10 reps",
      },
    ],
    summary: "2 exercises · 7 sets",
    navigable: true,
  },
];

function PlusGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19M5 12H19" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronGlyph() {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none">
      <Path
        d="M1 1L7 7L1 13"
        stroke={COLORS.textTertiary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function formatSessionSubtitle(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  const prefix = sameDay ? "Today" : isYesterday ? "Yesterday" : date.toLocaleDateString();
  return `${prefix} · ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

// Exercise preview data is only used for web preview / sample sessions.
// Live sessions show real set count without fabricated exercise details.

export default function WorkoutsScreen() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const isWebPreview = __DEV__ && Platform.OS === "web";
  const [refreshing, setRefreshing] = useState(false);
  const createToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (createToastTimerRef.current) clearTimeout(createToastTimerRef.current);
    };
  }, []);

  const PAGE_SIZE = 20;

  const sessionsQuery = useInfiniteQuery({
    queryKey: ["workout-sessions", "infinite-list"],
    initialPageParam: 0,
    enabled: !isWebPreview && !!isSignedIn,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSessionsResponse>(
        `/api/workout-sessions?limit=${PAGE_SIZE}&offset=${pageParam as number}`,
        { token },
      );
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.sessions.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSessionListItem>("/api/workout-sessions", {
        method: "POST",
        token,
        body: JSON.stringify({ title: "New Session" }),
      });
    },
    onSuccess: async (session) => {
      setCreateFeedback("Workout session created.");
      if (createToastTimerRef.current) clearTimeout(createToastTimerRef.current);
      createToastTimerRef.current = setTimeout(() => setCreateFeedback(null), 2200);
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      router.push({
        pathname: "/workout-session/[id]",
        params: { id: session.id },
      });
    },
    onError: (error) => {
      Alert.alert(
        "Couldn’t create session",
        error instanceof Error ? error.message : "Please try again."
      );
    },
  });

  const liveSessions = useMemo(
    () => sessionsQuery.data?.pages.flatMap((page) => page.sessions) ?? [],
    [sessionsQuery.data],
  );

  const thisWeekSessions = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return liveSessions.filter((s) => new Date(s.startedAt) >= monday);
  }, [liveSessions]);

  const sessionCards = useMemo<SessionPreview[]>(() => {
    if (isWebPreview) return SAMPLE_SESSIONS;
    if (!liveSessions.length) return [];
    return liveSessions.map((session) => ({
      id: session.id,
      title: session.title,
      subtitle: formatSessionSubtitle(session.startedAt),
      status: session.endedAt ? "done" : "active",
      exercises: [],
      summary: `${session.setCount} ${session.setCount === 1 ? "set" : "sets"}`,
      navigable: true,
    }));
  }, [isWebPreview, liveSessions]);

  const stats = useMemo<StatsPreview>(() => {
    if (isWebPreview) return SAMPLE_STATS;
    if (!thisWeekSessions.length) {
      return { sessions: "0", sets: "0", exercises: "0" };
    }
    const totalSets = thisWeekSessions.reduce((sum, session) => sum + session.setCount, 0);
    return {
      sessions: String(thisWeekSessions.length),
      sets: String(totalSets),
      exercises: "--",
    };
  }, [isWebPreview, thisWeekSessions]);

  const onRefresh = async () => {
    if (isWebPreview) return;
    setRefreshing(true);
    await sessionsQuery.refetch();
    setRefreshing(false);
  };

  const handleOpenSession = (session: SessionPreview) => {
    if (!session.navigable) return;
    if (isWebPreview) {
      router.push({
        pathname: "/workout-session/[id]",
        params: { id: session.id === "preview-active" ? "preview-active" : "preview-leg-day" },
      });
      return;
    }
    router.push({
      pathname: "/workout-session/[id]",
      params: { id: session.id },
    });
  };

  const handleCreateSession = async () => {
    if (isWebPreview) {
      router.push({
        pathname: "/workout-session/[id]",
        params: { id: "preview-empty" },
      });
      return;
    }
    await createSessionMutation.mutateAsync();
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Workouts</Text>
          <Pressable
            style={[styles.newButton, createSessionMutation.isPending ? styles.buttonDisabled : null]}
            onPress={() => void handleCreateSession()}
            disabled={createSessionMutation.isPending}
          >
            <PlusGlyph />
            <Text style={styles.newButtonText}>
              {createSessionMutation.isPending ? "Creating..." : "New Session"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={[styles.statValue, styles.statValueAccent]}>{stats.sessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{stats.sets}</Text>
            <Text style={styles.statLabel}>Sets This{"\n"}week</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{stats.exercises}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Sessions</Text>

        {sessionsQuery.isLoading && !isWebPreview ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
          </View>
        ) : null}

        {sessionCards.length ? (
          sessionCards.map((session) => (
            <Pressable
              key={session.id}
              style={styles.sessionCard}
              onPress={() => handleOpenSession(session)}
              disabled={!session.navigable}
            >
              <View style={styles.sessionTop}>
                <View>
                  <Text style={styles.sessionTitle}>{session.title}</Text>
                  <Text style={styles.sessionDate}>{session.subtitle}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    session.status === "active" ? styles.statusActive : styles.statusDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      session.status === "active"
                        ? styles.statusTextActive
                        : styles.statusTextDone,
                    ]}
                  >
                    {session.status === "active" ? "Active" : "Done"}
                  </Text>
                </View>
              </View>

              <View style={styles.exerciseList}>
                {session.exercises.map((exercise) => (
                  <View key={`${session.id}-${exercise.name}`} style={styles.exerciseRow}>
                    <View style={styles.exerciseCopy}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseDetail}>{exercise.detail}</Text>
                    </View>
                    <View style={styles.exerciseRight}>
                      <Text style={styles.exerciseWeight}>{exercise.weight}</Text>
                      <Text style={styles.exerciseReps}>{exercise.reps}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.sessionFooter}>
                <Text style={styles.sessionSummary}>{session.summary}</Text>
                <ChevronGlyph />
              </View>
            </Pressable>
          ))
        ) : !sessionsQuery.isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No workout sessions yet</Text>
            <Text style={styles.emptyBody}>
              Create a session to start logging sets, or use the Command Center to add a workout by voice.
            </Text>
          </View>
        ) : null}

        {sessionsQuery.hasNextPage ? (
          <Pressable
            style={[styles.loadMoreButton, sessionsQuery.isFetchingNextPage ? styles.buttonDisabled : null]}
            onPress={() => sessionsQuery.fetchNextPage()}
            disabled={sessionsQuery.isFetchingNextPage}
          >
            {sessionsQuery.isFetchingNextPage ? (
              <ActivityIndicator color={COLORS.textPrimary} size="small" />
            ) : (
              <Text style={styles.loadMoreText}>Load More</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      {createFeedback ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{createFeedback}</Text>
        </View>
      ) : null}

      <FloatingCommandBar
        hint='"Did 3 sets of squats..."'
        onPress={() => router.push({ pathname: "/(tabs)/dashboard", params: { cc: "expanded", returnTo: "/(tabs)/workouts" } })}
        onMicPress={() => router.push({ pathname: "/(tabs)/dashboard", params: { cc: "recording", returnTo: "/(tabs)/workouts" } })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 96,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: COLORS.textPrimary,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.textPrimary,
  },
  newButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 24,
  },
  statPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 16,
    minHeight: 78,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  statValueAccent: {
    color: COLORS.workouts,
  },
  statLabel: {
    marginTop: 2,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  sectionTitle: {
    paddingBottom: 12,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: COLORS.textPrimary,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
  sessionCard: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 16,
  },
  sessionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sessionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  sessionDate: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusActive: {
    backgroundColor: "rgba(52,199,89,0.12)",
  },
  statusDone: {
    backgroundColor: COLORS.border,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusTextActive: {
    color: COLORS.steps,
  },
  statusTextDone: {
    color: COLORS.textSecondary,
  },
  exerciseList: {
    gap: 8,
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
  },
  exerciseCopy: {
    flex: 1,
    paddingRight: 12,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  exerciseDetail: {
    marginTop: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  exerciseRight: {
    alignItems: "flex-end",
  },
  exerciseWeight: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  exerciseReps: {
    marginTop: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sessionFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionSummary: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  emptyCard: {
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
  loadMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 82,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.textPrimary,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
