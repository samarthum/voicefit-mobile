import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type {
  ConversationEvent,
  DashboardData,
  InterpretEntryResponse,
} from "@voicefit/contracts/types";
import { apiRequest } from "../../lib/api-client";

type TrendTab = "calories" | "steps" | "weight" | "workouts";

interface ConversationResponse {
  events: ConversationEvent[];
  total: number;
  limit: number;
  offset: number;
}

interface WorkoutSessionListItem {
  id: string;
  endedAt: string | null;
}

interface WorkoutSessionsResponse {
  sessions: WorkoutSessionListItem[];
}

const todayDate = () => new Date().toISOString().slice(0, 10);

function parseIsoDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateLabel(date: string) {
  const target = parseIsoDate(date);
  const today = parseIsoDate(todayDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";

  return target.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function toWeekday(date: string) {
  return parseIsoDate(date).toLocaleDateString("en-US", { weekday: "short" });
}

function progressPercent(current: number, goal: number) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(100, (current / goal) * 100));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong.";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function kindLabel(kind: string) {
  switch (kind) {
    case "meal": return "Meal";
    case "workout_set": return "Workout";
    case "weight": return "Weight";
    case "steps": return "Steps";
    case "question": return "Question";
    case "system": return "System";
    default: return kind;
  }
}

function buildWorkoutSystemText(payload: {
  exerciseName: string;
  exerciseType: "resistance" | "cardio";
  reps: number | null;
  weightKg: number | null;
  durationMinutes: number | null;
}) {
  const details: string[] = [];
  if (payload.exerciseType === "cardio") {
    if (payload.durationMinutes != null) details.push(`${payload.durationMinutes} min`);
  } else {
    if (payload.reps != null) details.push(`${payload.reps} reps`);
    if (payload.weightKg != null) details.push(`${payload.weightKg} kg`);
  }
  return `Logged ${payload.exerciseName}${details.length ? ` · ${details.join(" · ")}` : ""}`;
}

async function ensureQuickSession(token: string) {
  const date = todayDate();
  const list = await apiRequest<WorkoutSessionsResponse>(
    `/api/workout-sessions?date=${date}&limit=5`,
    { token }
  );
  const active = list.sessions.find((s) => !s.endedAt);
  if (active) return active.id;

  const created = await apiRequest<{ id: string }>("/api/workout-sessions", {
    method: "POST",
    token,
    body: JSON.stringify({ title: "Quick Log" }),
  });
  return created.id;
}

export default function DashboardScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [trendTab, setTrendTab] = useState<TrendTab>("calories");

  // Quick log state
  const [quickInput, setQuickInput] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickMessage, setQuickMessage] = useState<string | null>(null);
  const quickSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!quickMessage) return;
    quickSuccessTimerRef.current = setTimeout(() => setQuickMessage(null), 3000);
    return () => { if (quickSuccessTimerRef.current) clearTimeout(quickSuccessTimerRef.current); };
  }, [quickMessage]);

  const isToday = selectedDate === todayDate();

  // Dashboard data
  const { data, isLoading, error, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["dashboard", timezone, selectedDate],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<DashboardData>(
        `/api/dashboard?${new URLSearchParams({ timezone, date: selectedDate })}`,
        { token }
      );
    },
  });

  // Recent activity (last 10 conversation events)
  const activityQuery = useQuery<ConversationResponse>({
    queryKey: ["recent-activity", timezone],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<ConversationResponse>(
        `/api/conversation?${new URLSearchParams({ limit: "10", offset: "0", timezone })}`,
        { token }
      );
    },
  });

  // Quick log mutation (from feed)
  const quickLogMutation = useMutation({
    mutationFn: async () => {
      const transcript = quickInput.trim();
      if (!transcript) throw new Error("Enter something to log.");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const interpreted = await apiRequest<InterpretEntryResponse>("/api/interpret/entry", {
        method: "POST",
        token,
        body: JSON.stringify({ transcript, source: "text", timezone }),
      });

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
        return { message: "Meal logged." };
      }

      if (interpreted.intent === "workout_set") {
        const sessionId = await ensureQuickSession(token);
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
        return { message: buildWorkoutSystemText(interpreted.payload) };
      }

      if (interpreted.intent === "steps") {
        await apiRequest("/api/daily-metrics", {
          method: "POST",
          token,
          body: JSON.stringify({ date: todayDate(), steps: Math.round(interpreted.payload.value) }),
        });
        return { message: `Saved ${Math.round(interpreted.payload.value).toLocaleString()} steps.` };
      }

      if (interpreted.intent === "weight") {
        await apiRequest("/api/daily-metrics", {
          method: "POST",
          token,
          body: JSON.stringify({ date: todayDate(), weightKg: interpreted.payload.value }),
        });
        return { message: `Saved weight ${interpreted.payload.value} kg.` };
      }

      // question intent
      await apiRequest("/api/conversation", {
        method: "POST",
        token,
        body: JSON.stringify({
          kind: "question",
          userText: transcript,
          systemText: interpreted.payload.answer,
          source: "text",
          referenceType: null,
          referenceId: null,
          metadata: { answer: interpreted.payload.answer },
        }),
      });
      return { message: "Question saved." };
    },
    onSuccess: async (result) => {
      setQuickError(null);
      setQuickMessage(result.message);
      setQuickInput("");
      Keyboard.dismiss();
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
    },
    onError: (err) => {
      setQuickMessage(null);
      setQuickError(getErrorMessage(err));
    },
  });

  const trendData = useMemo(() => data?.weeklyTrends.slice(-7) ?? [], [data?.weeklyTrends]);
  const recentEvents = activityQuery.data?.events ?? [];

  const navigateDate = (dayDelta: number) => {
    const target = parseIsoDate(selectedDate);
    target.setDate(target.getDate() + dayDelta);
    const nextDate = target.toISOString().slice(0, 10);
    if (nextDate > todayDate()) return;
    setSelectedDate(nextDate);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            refetch();
            activityQuery.refetch();
          }}
        />
      }
    >
      <Text style={styles.title}>Home</Text>

      {/* ── Quick Log ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Log</Text>
        <TextInput
          style={styles.input}
          value={quickInput}
          onChangeText={setQuickInput}
          placeholder='e.g. "chicken salad 400 cal" or "ran 5k"'
          multiline
          editable={!quickLogMutation.isPending}
        />
        {quickError ? <Text style={styles.error}>{quickError}</Text> : null}
        {quickMessage ? <Text style={styles.success}>{quickMessage}</Text> : null}
        <Pressable
          style={[styles.buttonPrimary, quickLogMutation.isPending && styles.disabledButton]}
          onPress={() => quickLogMutation.mutate()}
          disabled={quickLogMutation.isPending}
        >
          <Text style={styles.buttonPrimaryText}>
            {quickLogMutation.isPending ? "Processing..." : "Log Entry"}
          </Text>
        </Pressable>
      </View>

      {/* ── Daily Snapshot ── */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.cardTitle}>{formatDateLabel(selectedDate)}</Text>
            <Text style={styles.helperText}>Daily snapshot</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={() => navigateDate(-1)}>
              <Text style={styles.iconButtonText}>{"<"}</Text>
            </Pressable>
            <Pressable
              style={[styles.iconButton, isToday && styles.disabledButton]}
              onPress={() => navigateDate(1)}
              disabled={isToday}
            >
              <Text style={styles.iconButtonText}>{">"}</Text>
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator />
        ) : error ? (
          <Text style={styles.error}>{getErrorMessage(error)}</Text>
        ) : data ? (
          <>
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>Calories</Text>
                <Text style={styles.metricValue}>
                  {data.today.calories.consumed.toLocaleString()} /{" "}
                  {data.today.calories.goal.toLocaleString()} kcal
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent(data.today.calories.consumed, data.today.calories.goal)}%`,
                      backgroundColor: "#FB923C",
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.twoCol}>
              <View style={styles.miniCard}>
                <Text style={styles.metricLabel}>Steps</Text>
                <Text style={styles.metricValue}>
                  {(data.today.steps.count ?? 0).toLocaleString()} /{" "}
                  {data.today.steps.goal.toLocaleString()}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPercent(data.today.steps.count ?? 0, data.today.steps.goal)}%`,
                        backgroundColor: "#10B981",
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.miniCard}>
                <Text style={styles.metricLabel}>Weight</Text>
                <Text style={styles.metricValue}>
                  {data.today.weight === null ? "--" : `${data.today.weight} kg`}
                </Text>
                <Text style={styles.helperText}>Latest for this date</Text>
              </View>
            </View>

            <View style={styles.twoCol}>
              <View style={styles.miniCard}>
                <Text style={styles.metricLabel}>Workout Sessions</Text>
                <Text style={styles.metricValue}>{data.today.workoutSessions}</Text>
              </View>
              <View style={styles.miniCard}>
                <Text style={styles.metricLabel}>Workout Sets</Text>
                <Text style={styles.metricValue}>{data.today.workoutSets}</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.helperText}>No data yet.</Text>
        )}
      </View>

      {/* ── Coach ── */}
      <Pressable
        style={styles.coachCard}
        onPress={() => router.push("/(tabs)/coach")}
      >
        <View>
          <Text style={styles.cardTitle}>Ask Coach</Text>
          <Text style={styles.helperText}>Get AI insights on your trends</Text>
        </View>
        <Text style={styles.chevron}>{">"}</Text>
      </Pressable>

      {/* ── Weekly Trends ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Trends</Text>
        <View style={styles.tabRow}>
          {(["calories", "steps", "weight", "workouts"] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tabChip, trendTab === tab && styles.tabChipActive]}
              onPress={() => setTrendTab(tab)}
            >
              <Text style={[styles.tabText, trendTab === tab && styles.tabTextActive]}>
                {tab === "workouts" ? "Workouts" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator />
        ) : error ? (
          <Text style={styles.error}>{getErrorMessage(error)}</Text>
        ) : trendData.length === 0 ? (
          <Text style={styles.helperText}>No trend data yet.</Text>
        ) : trendTab === "calories" ? (
          trendData.map((day) => (
            <View key={day.date} style={styles.trendRow}>
              <Text style={styles.trendDay}>{toWeekday(day.date)}</Text>
              <View style={styles.trendBarTrack}>
                <View
                  style={[
                    styles.trendBarFill,
                    {
                      width: `${progressPercent(day.calories, data?.today.calories.goal ?? 1)}%`,
                      backgroundColor: "#FB923C",
                    },
                  ]}
                />
              </View>
              <Text style={styles.trendValue}>{day.calories.toLocaleString()} kcal</Text>
            </View>
          ))
        ) : trendTab === "steps" ? (
          trendData.map((day) => (
            <View key={day.date} style={styles.trendRow}>
              <Text style={styles.trendDay}>{toWeekday(day.date)}</Text>
              <View style={styles.trendBarTrack}>
                <View
                  style={[
                    styles.trendBarFill,
                    {
                      width: `${progressPercent(day.steps ?? 0, data?.today.steps.goal ?? 1)}%`,
                      backgroundColor: "#10B981",
                    },
                  ]}
                />
              </View>
              <Text style={styles.trendValue}>
                {day.steps === null ? "--" : day.steps.toLocaleString()}
              </Text>
            </View>
          ))
        ) : trendTab === "weight" ? (
          trendData.map((day) => (
            <View key={day.date} style={styles.trendRow}>
              <Text style={styles.trendDay}>{toWeekday(day.date)}</Text>
              <View style={styles.trendBarTrack}>
                <View
                  style={[
                    styles.trendBarFill,
                    {
                      width: day.weight === null ? "0%" : "70%",
                      backgroundColor: "#3B82F6",
                    },
                  ]}
                />
              </View>
              <Text style={styles.trendValue}>
                {day.weight === null ? "--" : `${day.weight} kg`}
              </Text>
            </View>
          ))
        ) : (
          trendData.map((day) => (
            <View key={day.date} style={styles.trendRow}>
              <Text style={styles.trendDay}>{toWeekday(day.date)}</Text>
              <View style={styles.trendBarTrack}>
                <View
                  style={[
                    styles.trendBarFill,
                    {
                      width: `${Math.min(100, day.workouts * 25)}%`,
                      backgroundColor: "#8B5CF6",
                    },
                  ]}
                />
              </View>
              <Text style={styles.trendValue}>
                {day.workouts} {day.workouts === 1 ? "session" : "sessions"}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ── Recent Meals ── */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Recent Meals</Text>
          <Pressable onPress={() => router.push("/(tabs)/meals")}>
            <Text style={styles.linkText}>View All</Text>
          </Pressable>
        </View>
        {isLoading ? (
          <ActivityIndicator />
        ) : error ? (
          <Text style={styles.error}>{getErrorMessage(error)}</Text>
        ) : data && data.recentMeals.length > 0 ? (
          data.recentMeals.map((meal) => (
            <View key={meal.id} style={styles.listRow}>
              <View style={styles.listMain}>
                <Text style={styles.listTitle}>{meal.description}</Text>
                <Text style={styles.helperText}>
                  {meal.mealType} · {new Date(meal.eatenAt).toLocaleString()}
                </Text>
              </View>
              <Text style={styles.listValue}>{meal.calories} kcal</Text>
            </View>
          ))
        ) : (
          <Text style={styles.helperText}>No meals logged yet.</Text>
        )}
      </View>

      {/* ── Recent Exercises ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Exercises</Text>
        {isLoading ? (
          <ActivityIndicator />
        ) : error ? (
          <Text style={styles.error}>{getErrorMessage(error)}</Text>
        ) : data && data.recentExercises.length > 0 ? (
          <View style={styles.chips}>
            {data.recentExercises.map((exercise) => (
              <View key={exercise} style={styles.chip}>
                <Text style={styles.chipText}>{exercise}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helperText}>No exercises logged yet.</Text>
        )}
      </View>

      {/* ── Recent Activity ── */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Recent Activity</Text>
          <Pressable onPress={() => router.push("/(tabs)/feed")}>
            <Text style={styles.linkText}>View All</Text>
          </Pressable>
        </View>
        {activityQuery.isLoading ? (
          <ActivityIndicator />
        ) : activityQuery.error ? (
          <Text style={styles.error}>{getErrorMessage(activityQuery.error)}</Text>
        ) : recentEvents.length > 0 ? (
          recentEvents.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <Text style={styles.badge}>{kindLabel(event.kind)}</Text>
                <Text style={styles.timestamp}>{formatTimestamp(event.createdAt)}</Text>
              </View>
              <Text style={styles.eventText}>{event.userText}</Text>
              {event.systemText ? (
                <Text style={styles.eventSystemText}>{event.systemText}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.helperText}>No activity yet. Use Quick Log above to get started.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
    backgroundColor: "#FFFFFF",
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  helperText: {
    fontSize: 12,
    color: "#4B5563",
  },
  error: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
  },
  success: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
  },
  buttonPrimary: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    backgroundColor: "#E5E7EB",
    borderRadius: 9,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  disabledButton: {
    opacity: 0.5,
  },
  coachCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chevron: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  metricCard: {
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    gap: 8,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  twoCol: {
    flexDirection: "row",
    gap: 8,
  },
  miniCard: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    gap: 6,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tabChip: {
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tabChipActive: {
    backgroundColor: "#111827",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendDay: {
    width: 34,
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },
  trendBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
  },
  trendValue: {
    minWidth: 74,
    textAlign: "right",
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
  },
  listMain: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "700",
  },
  listValue: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "700",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#E5E7EB",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  eventCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  timestamp: {
    fontSize: 11,
    color: "#6B7280",
  },
  eventText: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
  },
  eventSystemText: {
    fontSize: 12,
    color: "#374151",
  },
});
