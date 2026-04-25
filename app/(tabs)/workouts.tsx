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
import { useCommandCenter } from "../../components/command-center";
import { apiRequest } from "../../lib/api-client";
import { color as token, font, radius as r } from "../../lib/tokens";

const COLORS = {
  bg: token.bg,
  surface: token.surface,
  surface2: token.surface2,
  border: token.line,
  textPrimary: token.text,
  textSecondary: token.textSoft,
  textTertiary: token.textMute,
  workouts: token.accent,
  steps: token.positive,
  accent: token.accent,
  accentInk: token.accentInk,
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
  setsLabel: string;
  prCount: number;
  navigable: boolean;
};

type StatsPreview = {
  sessions: string;
  volume: string;
  prs: string;
};

const SAMPLE_STATS: StatsPreview = {
  sessions: "3",
  volume: "12,480",
  prs: "2",
};

const SAMPLE_SESSIONS: SessionPreview[] = [
  {
    id: "preview-active",
    title: "Pull day",
    subtitle: "Today · 7:32 AM",
    status: "active",
    setsLabel: "8 / 12",
    prCount: 1,
    navigable: true,
  },
  {
    id: "preview-done",
    title: "Push day",
    subtitle: "Monday, Apr 20",
    status: "done",
    setsLabel: "9",
    prCount: 1,
    navigable: true,
  },
  {
    id: "preview-legs",
    title: "Legs",
    subtitle: "Friday, Apr 17",
    status: "done",
    setsLabel: "12",
    prCount: 0,
    navigable: false,
  },
];

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatWeekEyebrow(now: Date): string {
  const month = now.toLocaleString("en-US", { month: "short" });
  return `Week ${getISOWeek(now)} · ${month}`;
}

function PlusGlyph() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M6 2V10M2 6H10" stroke={token.accentInk} strokeWidth={1.8} strokeLinecap="round" />
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
  const cc = useCommandCenter();
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
      setsLabel: String(session.setCount),
      prCount: 0,
      navigable: true,
    }));
  }, [isWebPreview, liveSessions]);

  const stats = useMemo<StatsPreview>(() => {
    if (isWebPreview) return SAMPLE_STATS;
    return {
      sessions: String(thisWeekSessions.length),
      volume: "—",
      prs: "0",
    };
  }, [isWebPreview, thisWeekSessions]);

  const weekBars = useMemo(() => {
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    if (isWebPreview) {
      return labels.map((d, i) => ({ d, v: [0, 0, 12, 8, 0, 0, 9][i], live: i === 3 }));
    }
    const now = new Date();
    const todayIdx = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - todayIdx);
    monday.setHours(0, 0, 0, 0);
    const counts = labels.map(() => 0);
    for (const session of thisWeekSessions) {
      const sessionDate = new Date(session.startedAt);
      const idx = Math.floor((sessionDate.getTime() - monday.getTime()) / 86400000);
      if (idx >= 0 && idx < 7) counts[idx] += session.setCount;
    }
    return labels.map((d, i) => ({ d, v: counts[i], live: i === todayIdx }));
  }, [isWebPreview, thisWeekSessions]);

  const weekEyebrow = useMemo(() => formatWeekEyebrow(new Date()), []);

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
          <View>
            <Text style={styles.pageEyebrow}>{weekEyebrow}</Text>
            <Text style={styles.pageTitle}>Train</Text>
          </View>
          <Pressable
            style={[styles.newButton, createSessionMutation.isPending ? styles.buttonDisabled : null]}
            onPress={() => void handleCreateSession()}
            disabled={createSessionMutation.isPending}
          >
            <PlusGlyph />
            <Text style={styles.newButtonText}>
              {createSessionMutation.isPending ? "Creating…" : "New session"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statStatLabel}>Sessions</Text>
            <Text style={styles.statValue}>{stats.sessions}</Text>
            <Text style={styles.statSubLabel}>this week</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statStatLabel}>Volume</Text>
            <Text style={styles.statValue}>{stats.volume}</Text>
            <Text style={styles.statSubLabel}>kg</Text>
          </View>
          <View style={[styles.statPill, styles.statPillAccent]}>
            <Text style={[styles.statStatLabel, styles.statStatLabelAccent]}>PRs</Text>
            <Text style={[styles.statValue, styles.statValueAccent]}>{stats.prs}</Text>
            <Text style={styles.statSubLabel}>new</Text>
          </View>
        </View>

        <View style={styles.weekCard}>
          <View style={styles.weekCardHeader}>
            <Text style={styles.weekCardLabel}>Week at a glance</Text>
            <Text style={styles.weekCardHint}>Sets per day</Text>
          </View>
          <View style={styles.weekBars}>
            {weekBars.map((bar, i) => (
              <View key={i} style={styles.weekBarColumn}>
                <View style={styles.weekBarTrack}>
                  <View
                    style={[
                      styles.weekBar,
                      {
                        height: Math.max(bar.v * 4, bar.v ? 12 : 3),
                        backgroundColor: bar.live ? token.accent : bar.v ? token.textSoft : token.line,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.weekBarLabel,
                    bar.live ? styles.weekBarLabelLive : null,
                  ]}
                >
                  {bar.d}
                </Text>
              </View>
            ))}
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
              style={[
                styles.sessionCard,
                session.status === "active" ? styles.sessionCardActive : null,
              ]}
              onPress={() => handleOpenSession(session)}
              disabled={!session.navigable}
            >
              <View style={styles.sessionTop}>
                <View style={styles.sessionTopText}>
                  <Text style={styles.sessionTitle}>{session.title}</Text>
                  <Text style={styles.sessionDate}>{session.subtitle}</Text>
                </View>
                {session.status === "active" ? (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                ) : (
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneText}>Done</Text>
                  </View>
                )}
              </View>

              <View style={styles.sessionMetrics}>
                <View style={styles.sessionMetric}>
                  <Text style={styles.sessionMetricLabel}>Sets</Text>
                  <Text style={styles.sessionMetricValue}>{session.setsLabel}</Text>
                </View>
                {session.prCount > 0 ? (
                  <View style={styles.sessionMetric}>
                    <Text style={[styles.sessionMetricLabel, styles.sessionMetricLabelAccent]}>PRs</Text>
                    <Text style={[styles.sessionMetricValue, styles.sessionMetricValueAccent]}>
                      {session.prCount}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.sessionChevron}>
                  <ChevronGlyph />
                </View>
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
        hint="80 kilos for 10 reps…"
        onPress={() => cc.open()}
        onMicPress={() => cc.startRecording()}
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
  pageEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.76,
    textTransform: "uppercase",
    color: token.textMute,
  },
  pageTitle: {
    fontFamily: font.sans[600],
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.65,
    color: token.text,
    marginTop: 2,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: r.pill,
    backgroundColor: token.accent,
  },
  newButtonText: {
    fontFamily: font.sans[700],
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.48,
    color: token.accentInk,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 18,
  },
  statPill: {
    flex: 1,
    borderRadius: r.sm,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statPillAccent: {
    borderColor: "rgba(199,251,65,0.3)",
  },
  statStatLabel: {
    fontFamily: font.sans[600],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.52,
    textTransform: "uppercase",
    color: token.textMute,
  },
  statStatLabelAccent: {
    color: token.accent,
  },
  statValue: {
    marginTop: 4,
    fontFamily: font.mono[500],
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: -0.66,
    color: token.text,
  },
  statValueAccent: {
    color: token.accent,
  },
  statSubLabel: {
    marginTop: 2,
    fontFamily: font.sans[400],
    fontSize: 10.5,
    color: token.textMute,
  },
  weekCard: {
    borderRadius: r.sm,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 22,
  },
  weekCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  weekCardLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.textMute,
  },
  weekCardHint: {
    fontFamily: font.sans[400],
    fontSize: 10.5,
    letterSpacing: 0.84,
    color: token.textMute,
  },
  weekBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 58,
  },
  weekBarColumn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  weekBarTrack: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  weekBar: {
    width: "100%",
    borderRadius: 4,
  },
  weekBarLabel: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: token.textMute,
  },
  weekBarLabelLive: {
    color: token.accent,
  },
  sectionTitle: {
    paddingBottom: 12,
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.text,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
  sessionCard: {
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  sessionCardActive: {
    borderColor: "rgba(199,251,65,0.25)",
    backgroundColor: "rgba(199,251,65,0.05)",
  },
  sessionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  sessionTopText: {
    flex: 1,
    paddingRight: 10,
  },
  sessionTitle: {
    fontFamily: font.sans[600],
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.15,
    color: token.text,
  },
  sessionDate: {
    marginTop: 3,
    fontFamily: font.sans[400],
    fontSize: 11.5,
    color: token.textMute,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: token.accent,
    borderRadius: r.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: token.accentInk,
  },
  liveText: {
    fontFamily: font.sans[700],
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.84,
    color: token.accentInk,
  },
  doneBadge: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: r.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  doneText: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: token.textMute,
  },
  sessionMetrics: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 4,
  },
  sessionMetric: {
    gap: 2,
  },
  sessionMetricLabel: {
    fontFamily: font.sans[600],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.33,
    textTransform: "uppercase",
    color: token.textMute,
  },
  sessionMetricLabelAccent: {
    color: token.accent,
  },
  sessionMetricValue: {
    fontFamily: font.mono[500],
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: -0.3,
    color: token.text,
  },
  sessionMetricValueAccent: {
    color: token.accent,
  },
  sessionChevron: {
    marginLeft: "auto",
  },
  emptyCard: {
    borderRadius: r.md,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: font.sans[600],
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.27,
    color: token.text,
  },
  emptyBody: {
    fontFamily: font.sans[400],
    fontSize: 14,
    lineHeight: 21,
    color: token.textSoft,
  },
  loadMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: r.sm,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
  },
  loadMoreText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: token.textSoft,
  },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 82,
    borderRadius: r.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: token.accent,
  },
  toastText: {
    fontFamily: font.sans[700],
    color: token.accentInk,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
