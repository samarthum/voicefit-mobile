import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useRouter } from "expo-router";
import { apiRequest } from "../../lib/api-client";

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

const PAGE_SIZE = 20;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function WorkoutsScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [dateInput, setDateInput] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);

  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Auto-dismiss success message
  const sessionSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!sessionMessage) return;
    sessionSuccessTimerRef.current = setTimeout(() => setSessionMessage(null), 3000);
    return () => { if (sessionSuccessTimerRef.current) clearTimeout(sessionSuccessTimerRef.current); };
  }, [sessionMessage]);

  const sessionsQuery = useInfiniteQuery({
    queryKey: ["workout-sessions", appliedDate],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const offset = pageParam as number;
      const query = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (appliedDate) {
        query.set("date", appliedDate);
      }
      return apiRequest<WorkoutSessionsResponse>(`/api/workout-sessions?${query.toString()}`, { token });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.sessions.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const title = newSessionTitle.trim();
      if (!title) throw new Error("Session title is required.");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSessionListItem>("/api/workout-sessions", {
        method: "POST",
        token,
        body: JSON.stringify({ title }),
      });
    },
    onSuccess: async (session) => {
      setSessionError(null);
      setSessionMessage("Workout session created.");
      setNewSessionTitle("");
      Keyboard.dismiss();
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      router.push({
        pathname: "/workout-session/[id]",
        params: { id: session.id },
      });
    },
    onError: (error) => {
      setSessionMessage(null);
      setSessionError(error instanceof Error ? error.message : "Failed to create session");
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<{ deleted: boolean }>(`/api/workout-sessions/${id}`, {
        method: "DELETE",
        token,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
    },
  });

  const sessions = useMemo(
    () => sessionsQuery.data?.pages.flatMap((page) => page.sessions) ?? [],
    [sessionsQuery.data]
  );
  const total = sessionsQuery.data?.pages[0]?.total ?? 0;

  const applyDateFilter = () => {
    const value = dateInput.trim();
    if (value && !dateRegex.test(value)) {
      setFilterError("Date must be YYYY-MM-DD.");
      return;
    }
    setFilterError(null);
    setAppliedDate(value);
  };

  const clearDateFilter = () => {
    setDateInput("");
    setAppliedDate("");
    setFilterError(null);
  };

  const handleDeleteSession = (id: string) => {
    Alert.alert("Delete session", "Delete this workout session and all sets?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteSessionMutation.mutate(id),
      },
    ]);
  };

  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={sessionsQuery.isRefetching && !sessionsQuery.isFetchingNextPage}
          onRefresh={() => sessionsQuery.refetch()}
        />
      }
      ListHeaderComponent={
        <View style={styles.container}>
          <Text style={styles.title}>Workouts</Text>
          <Text style={styles.subtitle}>Sessions list with filters and quick actions.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Date filter (optional)</Text>
            <TextInput
              style={styles.input}
              value={dateInput}
              onChangeText={setDateInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="YYYY-MM-DD"
            />
            {filterError ? <Text style={styles.error}>{filterError}</Text> : null}
            <View style={styles.row}>
              <Pressable style={styles.buttonPrimary} onPress={applyDateFilter}>
                <Text style={styles.buttonPrimaryText}>Apply</Text>
              </Pressable>
              <Pressable style={styles.buttonSecondary} onPress={clearDateFilter}>
                <Text style={styles.buttonSecondaryText}>Clear</Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>
              Loaded {sessions.length} of {total}{appliedDate ? ` for ${appliedDate}` : ""}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Create session</Text>
            <TextInput
              style={styles.input}
              value={newSessionTitle}
              onChangeText={setNewSessionTitle}
              placeholder="e.g. Push day"
            />
            {sessionError ? <Text style={styles.error}>{sessionError}</Text> : null}
            {sessionMessage ? <Text style={styles.success}>{sessionMessage}</Text> : null}
            <Pressable
              style={[
                styles.buttonPrimary,
                createSessionMutation.isPending ? styles.disabledButton : null,
              ]}
              onPress={() => createSessionMutation.mutate()}
              disabled={createSessionMutation.isPending}
            >
              <Text style={styles.buttonPrimaryText}>
                {createSessionMutation.isPending ? "Creating..." : "Create Session"}
              </Text>
            </Pressable>
          </View>
        </View>
      }
      ListEmptyComponent={
        sessionsQuery.isLoading ? (
          <ActivityIndicator />
        ) : sessionsQuery.error ? (
          <Text style={styles.error}>
            {sessionsQuery.error instanceof Error
              ? sessionsQuery.error.message
              : "Failed to load sessions"}
          </Text>
        ) : (
          <Text style={styles.emptyText}>No workout sessions yet.</Text>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.sessionCard}>
          <Text style={styles.sessionTitle}>{item.title}</Text>
          <Text style={styles.helperText}>
            {formatDateTime(item.startedAt)} · {item.setCount} sets ·{" "}
            {item.endedAt ? "Ended" : "Active"}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={styles.buttonSecondary}
              onPress={() =>
                router.push({
                  pathname: "/workout-session/[id]",
                  params: { id: item.id },
                })
              }
            >
              <Text style={styles.buttonSecondaryText}>Open Session</Text>
            </Pressable>
            <Pressable style={styles.buttonDanger} onPress={() => handleDeleteSession(item.id)}>
              <Text style={styles.buttonDangerText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          {sessionsQuery.hasNextPage ? (
            <Pressable
              style={[
                styles.buttonPrimary,
                sessionsQuery.isFetchingNextPage ? styles.disabledButton : null,
              ]}
              onPress={() => sessionsQuery.fetchNextPage()}
              disabled={sessionsQuery.isFetchingNextPage}
            >
              <Text style={styles.buttonPrimaryText}>
                {sessionsQuery.isFetchingNextPage ? "Loading..." : "Load More Sessions"}
              </Text>
            </Pressable>
          ) : sessions.length > 0 ? (
            <Text style={styles.helperText}>All sessions loaded.</Text>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
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
  },
  row: {
    flexDirection: "row",
    gap: 10,
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
  buttonDanger: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDangerText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "700",
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
  sessionCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 24,
  },
});
