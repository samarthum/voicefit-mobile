import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ConversationEvent, ConversationEventKind, InterpretEntryResponse } from "@voicefit/contracts/types";
import { apiRequest } from "../../lib/api-client";

interface ConversationResponse {
  events: ConversationEvent[];
  total: number;
  limit: number;
  offset: number;
  nextBefore: string | null;
}

interface WorkoutSessionListItem {
  id: string;
  endedAt: string | null;
}

interface WorkoutSessionsResponse {
  sessions: WorkoutSessionListItem[];
}

const PAGE_SIZE = 30;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const kinds: Array<ConversationEventKind | "all"> = [
  "all",
  "meal",
  "workout_set",
  "weight",
  "steps",
  "question",
  "system",
];

const todayDate = () => new Date().toISOString().slice(0, 10);

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong. Please try again.";
}

function kindLabel(kind: ConversationEventKind) {
  switch (kind) {
    case "meal":
      return "Meal";
    case "workout_set":
      return "Workout";
    case "weight":
      return "Weight";
    case "steps":
      return "Steps";
    case "question":
      return "Question";
    case "system":
      return "System";
    default:
      return kind;
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
    if (payload.durationMinutes !== null && payload.durationMinutes !== undefined) {
      details.push(`${payload.durationMinutes} min`);
    }
  } else {
    if (payload.reps !== null && payload.reps !== undefined) {
      details.push(`${payload.reps} reps`);
    }
    if (payload.weightKg !== null && payload.weightKg !== undefined) {
      details.push(`${payload.weightKg} kg`);
    }
  }
  return `Logged ${payload.exerciseName}${details.length ? ` · ${details.join(" · ")}` : ""}`;
}

async function ensureQuickSession(token: string) {
  const date = todayDate();
  const list = await apiRequest<WorkoutSessionsResponse>(
    `/api/workout-sessions?date=${date}&limit=5`,
    { token }
  );
  const active = list.sessions.find((session) => !session.endedAt);
  if (active) return active.id;

  const created = await apiRequest<{ id: string }>("/api/workout-sessions", {
    method: "POST",
    token,
    body: JSON.stringify({ title: "Quick Log" }),
  });
  return created.id;
}

export default function FeedScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entryMessage, setEntryMessage] = useState<string | null>(null);

  const entrySuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dateInput, setDateInput] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [selectedKind, setSelectedKind] = useState<ConversationEventKind | "all">("all");
  const [filterError, setFilterError] = useState<string | null>(null);

  // Auto-dismiss entry success message
  useEffect(() => {
    if (!entryMessage) return;
    entrySuccessTimerRef.current = setTimeout(() => setEntryMessage(null), 3000);
    return () => { if (entrySuccessTimerRef.current) clearTimeout(entrySuccessTimerRef.current); };
  }, [entryMessage]);

  const conversationQuery = useInfiniteQuery({
    queryKey: ["conversation", appliedDate, selectedKind],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const offset = pageParam as number;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const query = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        timezone,
      });
      if (appliedDate) query.set("date", appliedDate);
      if (selectedKind !== "all") query.set("kind", selectedKind);

      return apiRequest<ConversationResponse>(`/api/conversation?${query.toString()}`, { token });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.events.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const entryMutation = useMutation({
    mutationFn: async () => {
      const transcript = input.trim();
      if (!transcript) throw new Error("Entry text is required.");

      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const interpreted = await apiRequest<InterpretEntryResponse>("/api/interpret/entry", {
        method: "POST",
        token,
        body: JSON.stringify({
          transcript,
          source: "text",
          timezone,
        }),
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
          body: JSON.stringify({
            date: todayDate(),
            steps: Math.round(interpreted.payload.value),
            transcriptRaw: transcript,
          }),
        });
        return { message: `Saved ${Math.round(interpreted.payload.value).toLocaleString()} steps.` };
      }

      if (interpreted.intent === "weight") {
        await apiRequest("/api/daily-metrics", {
          method: "POST",
          token,
          body: JSON.stringify({
            date: todayDate(),
            weightKg: interpreted.payload.value,
            transcriptRaw: transcript,
          }),
        });
        return { message: `Saved weight ${interpreted.payload.value} kg.` };
      }

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
      return { message: "Question saved to feed." };
    },
    onSuccess: async (result) => {
      setEntryError(null);
      setEntryMessage(result.message);
      setInput("");
      Keyboard.dismiss();
      await queryClient.invalidateQueries({ queryKey: ["conversation"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["daily-metrics"] });
    },
    onError: (error) => {
      setEntryMessage(null);
      setEntryError(getErrorMessage(error));
    },
  });

  const events = useMemo(
    () => conversationQuery.data?.pages.flatMap((page) => page.events) ?? [],
    [conversationQuery.data]
  );
  const total = conversationQuery.data?.pages[0]?.total ?? 0;

  const applyDateFilter = () => {
    const value = dateInput.trim();
    if (value && !dateRegex.test(value)) {
      setFilterError("Date must be YYYY-MM-DD.");
      return;
    }
    setFilterError(null);
    setAppliedDate(value);
  };

  const clearFilters = () => {
    setDateInput("");
    setAppliedDate("");
    setSelectedKind("all");
    setFilterError(null);
  };

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={conversationQuery.isRefetching && !conversationQuery.isFetchingNextPage}
          onRefresh={() => conversationQuery.refetch()}
        />
      }
      ListHeaderComponent={
        <View style={styles.container}>
          <Text style={styles.title}>Conversation Feed</Text>
          <Text style={styles.subtitle}>Quick text logging + timeline of saved events.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Quick log entry</Text>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="e.g. Lunch was chicken salad and avocado"
              multiline
            />
            {entryError ? <Text style={styles.error}>{entryError}</Text> : null}
            {entryMessage ? <Text style={styles.success}>{entryMessage}</Text> : null}
            <Pressable
              style={[styles.buttonPrimary, entryMutation.isPending ? styles.disabledButton : null]}
              onPress={() => entryMutation.mutate()}
              disabled={entryMutation.isPending}
            >
              <Text style={styles.buttonPrimaryText}>
                {entryMutation.isPending ? "Processing..." : "Interpret and Save"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Filters</Text>
            <TextInput
              style={styles.input}
              value={dateInput}
              onChangeText={setDateInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Date YYYY-MM-DD (optional)"
            />
            {filterError ? <Text style={styles.error}>{filterError}</Text> : null}
            <View style={styles.kindRow}>
              {kinds.map((kind) => (
                <Pressable
                  key={kind}
                  style={[
                    styles.kindChip,
                    selectedKind === kind ? styles.kindChipActive : null,
                  ]}
                  onPress={() => setSelectedKind(kind)}
                >
                  <Text
                    style={[
                      styles.kindChipText,
                      selectedKind === kind ? styles.kindChipTextActive : null,
                    ]}
                  >
                    {kind === "all" ? "All" : kindLabel(kind)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable style={styles.buttonPrimary} onPress={applyDateFilter}>
                <Text style={styles.buttonPrimaryText}>Apply</Text>
              </Pressable>
              <Pressable style={styles.buttonSecondary} onPress={clearFilters}>
                <Text style={styles.buttonSecondaryText}>Clear</Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>
              Loaded {events.length} of {total}
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        conversationQuery.isLoading ? (
          <ActivityIndicator />
        ) : conversationQuery.error ? (
          <Text style={styles.error}>{getErrorMessage(conversationQuery.error)}</Text>
        ) : (
          <Text style={styles.emptyText}>No conversation events yet.</Text>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <Text style={styles.badge}>{kindLabel(item.kind)}</Text>
            <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
          </View>
          <Text style={styles.userText}>{item.userText}</Text>
          {item.systemText ? <Text style={styles.systemText}>{item.systemText}</Text> : null}
          <Text style={styles.metaText}>Source: {item.source}</Text>
        </View>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {conversationQuery.hasNextPage ? (
            <Pressable
              style={[
                styles.buttonPrimary,
                conversationQuery.isFetchingNextPage ? styles.disabledButton : null,
              ]}
              onPress={() => conversationQuery.fetchNextPage()}
              disabled={conversationQuery.isFetchingNextPage}
            >
              <Text style={styles.buttonPrimaryText}>
                {conversationQuery.isFetchingNextPage ? "Loading..." : "Load More"}
              </Text>
            </Pressable>
          ) : events.length > 0 ? (
            <Text style={styles.helperText}>All events loaded.</Text>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 24,
  },
  container: {
    padding: 20,
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
  },
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
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
  row: {
    flexDirection: "row",
    gap: 10,
  },
  kindRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kindChip: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  kindChipActive: {
    backgroundColor: "#111827",
  },
  kindChipText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
  },
  kindChipTextActive: {
    color: "#FFFFFF",
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
  buttonSecondary: {
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondaryText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
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
  emptyText: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: "#4B5563",
    fontSize: 14,
  },
  eventCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    gap: 6,
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
    paddingVertical: 4,
    borderRadius: 999,
  },
  timestamp: {
    fontSize: 11,
    color: "#6B7280",
  },
  userText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  systemText: {
    fontSize: 13,
    color: "#374151",
  },
  metaText: {
    fontSize: 11,
    color: "#6B7280",
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: "center",
  },
});
