import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import { apiRequest } from "../../lib/api-client";

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
}

interface SetDraft {
  exerciseName: string;
  exerciseType: ExerciseType;
  reps: string;
  weightKg: string;
  durationMinutes: string;
  notes: string;
}

const defaultSetDraft: SetDraft = {
  exerciseName: "",
  exerciseType: "resistance",
  reps: "",
  weightKg: "",
  durationMinutes: "",
  notes: "",
};

function parseOptionalInt(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseOptionalNumber(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function WorkoutSessionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { getToken, isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [editSessionTitle, setEditSessionTitle] = useState("");
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [setDraft, setSetDraft] = useState<SetDraft>(defaultSetDraft);
  const [setError, setSetError] = useState<string | null>(null);
  const [setMessage, setSetMessage] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  const sessionSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss session success message
  useEffect(() => {
    if (!sessionMessage) return;
    sessionSuccessTimerRef.current = setTimeout(() => setSessionMessage(null), 3000);
    return () => { if (sessionSuccessTimerRef.current) clearTimeout(sessionSuccessTimerRef.current); };
  }, [sessionMessage]);

  // Auto-dismiss set success message
  useEffect(() => {
    if (!setMessage) return;
    setSuccessTimerRef.current = setTimeout(() => setSetMessage(null), 3000);
    return () => { if (setSuccessTimerRef.current) clearTimeout(setSuccessTimerRef.current); };
  }, [setMessage]);

  const sessionQuery = useQuery({
    queryKey: ["workout-session-detail", sessionId],
    enabled: !!sessionId && isSignedIn,
    queryFn: async () => {
      if (!sessionId) throw new Error("Invalid session id");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSessionDetail>(`/api/workout-sessions/${sessionId}`, { token });
    },
  });

  useEffect(() => {
    if (!sessionQuery.data) return;
    setEditSessionTitle(sessionQuery.data.title);
  }, [sessionQuery.data]);

  const updateSessionMutation = useMutation({
    mutationFn: async (payload: { title?: string; endedAt?: string }) => {
      if (!sessionId) throw new Error("Invalid session id");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<WorkoutSessionDetail>(`/api/workout-sessions/${sessionId}`, {
        method: "PUT",
        token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setSessionError(null);
      setSessionMessage("Session updated.");
      Keyboard.dismiss();
      await sessionQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      setSessionMessage(null);
      setSessionError(error instanceof Error ? error.message : "Failed to update session");
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
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.replace("/(tabs)/workouts");
    },
  });

  const createSetMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Invalid session id");
      const exerciseName = setDraft.exerciseName.trim();
      if (!exerciseName) throw new Error("Exercise name is required.");
      const reps = parseOptionalInt(setDraft.reps);
      const durationMinutes = parseOptionalInt(setDraft.durationMinutes);
      const weightKg = parseOptionalNumber(setDraft.weightKg);
      if (reps === null || durationMinutes === null || weightKg === null) {
        throw new Error("Reps, duration, and weight must be non-negative numbers.");
      }
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const payload: Record<string, unknown> = {
        sessionId,
        exerciseName,
        exerciseType: setDraft.exerciseType,
      };
      if (reps !== undefined) payload.reps = reps;
      if (durationMinutes !== undefined) payload.durationMinutes = durationMinutes;
      if (weightKg !== undefined) payload.weightKg = weightKg;
      if (setDraft.notes.trim()) payload.notes = setDraft.notes.trim();

      return apiRequest<WorkoutSet>("/api/workout-sets", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setSetError(null);
      setSetMessage("Set added.");
      setSetDraft(defaultSetDraft);
      setEditingSetId(null);
      Keyboard.dismiss();
      await sessionQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      setSetMessage(null);
      setSetError(error instanceof Error ? error.message : "Failed to create set");
    },
  });

  const updateSetMutation = useMutation({
    mutationFn: async () => {
      if (!editingSetId) throw new Error("No set selected");
      const exerciseName = setDraft.exerciseName.trim();
      if (!exerciseName) throw new Error("Exercise name is required.");
      const reps = parseOptionalInt(setDraft.reps);
      const durationMinutes = parseOptionalInt(setDraft.durationMinutes);
      const weightKg = parseOptionalNumber(setDraft.weightKg);
      if (reps === null || durationMinutes === null || weightKg === null) {
        throw new Error("Reps, duration, and weight must be non-negative numbers.");
      }
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      return apiRequest<WorkoutSet>(`/api/workout-sets/${editingSetId}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          exerciseName,
          exerciseType: setDraft.exerciseType,
          reps: reps ?? null,
          durationMinutes: durationMinutes ?? null,
          weightKg: weightKg ?? null,
          notes: setDraft.notes.trim() || null,
        }),
      });
    },
    onSuccess: async () => {
      setSetError(null);
      setSetMessage("Set updated.");
      setEditingSetId(null);
      setSetDraft(defaultSetDraft);
      Keyboard.dismiss();
      await sessionQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      setSetMessage(null);
      setSetError(error instanceof Error ? error.message : "Failed to update set");
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
    onSuccess: async () => {
      await sessionQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (!isLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  const detail = sessionQuery.data;

  const handleEditSet = (set: WorkoutSet) => {
    setEditingSetId(set.id);
    setSetDraft({
      exerciseName: set.exerciseName,
      exerciseType: set.exerciseType,
      reps: set.reps === null ? "" : String(set.reps),
      weightKg: set.weightKg === null ? "" : String(set.weightKg),
      durationMinutes: set.durationMinutes === null ? "" : String(set.durationMinutes),
      notes: set.notes ?? "",
    });
    setSetError(null);
    setSetMessage(null);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Pressable
        style={styles.backButton}
        onPress={() => router.replace("/(tabs)/workouts")}
      >
        <Text style={styles.backButtonText}>Back to Workouts</Text>
      </Pressable>

      {sessionQuery.isLoading ? (
        <ActivityIndicator />
      ) : sessionQuery.error ? (
        <Text style={styles.error}>
          {sessionQuery.error instanceof Error ? sessionQuery.error.message : "Failed to load session"}
        </Text>
      ) : detail ? (
        <>
          <Text style={styles.title}>{detail.title}</Text>
          <Text style={styles.helperText}>Started: {formatDateTime(detail.startedAt)}</Text>
          <Text style={styles.helperText}>
            {detail.endedAt ? `Ended: ${formatDateTime(detail.endedAt)}` : "Active session"}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Session title</Text>
            <TextInput
              style={styles.input}
              value={editSessionTitle}
              onChangeText={setEditSessionTitle}
            />
            {sessionError ? <Text style={styles.error}>{sessionError}</Text> : null}
            {sessionMessage ? <Text style={styles.success}>{sessionMessage}</Text> : null}
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.buttonPrimary,
                  updateSessionMutation.isPending ? styles.disabledButton : null,
                ]}
                onPress={() => updateSessionMutation.mutate({ title: editSessionTitle.trim() })}
                disabled={updateSessionMutation.isPending}
              >
                <Text style={styles.buttonPrimaryText}>Save Session</Text>
              </Pressable>
              {!detail.endedAt ? (
                <Pressable
                  style={styles.buttonSecondary}
                  onPress={() => updateSessionMutation.mutate({ endedAt: new Date().toISOString() })}
                >
                  <Text style={styles.buttonSecondaryText}>End Session</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.buttonDanger}
                onPress={() =>
                  Alert.alert("Delete session", "Delete this session and all sets?", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => deleteSessionMutation.mutate(),
                    },
                  ])
                }
              >
                <Text style={styles.buttonDangerText}>Delete</Text>
              </Pressable>
            </View>
          </View>

          {!detail.endedAt ? (
            <View style={styles.card}>
              <Text style={styles.detailTitle}>{editingSetId ? "Edit Set" : "Add Set"}</Text>
              <TextInput
                style={styles.input}
                value={setDraft.exerciseName}
                onChangeText={(value) => setSetDraft((prev) => ({ ...prev, exerciseName: value }))}
                placeholder="Exercise name"
              />
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.buttonSecondary,
                    setDraft.exerciseType === "resistance" ? styles.typeActive : null,
                  ]}
                  onPress={() => setSetDraft((prev) => ({ ...prev, exerciseType: "resistance" }))}
                >
                  <Text style={styles.buttonSecondaryText}>Resistance</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.buttonSecondary,
                    setDraft.exerciseType === "cardio" ? styles.typeActive : null,
                  ]}
                  onPress={() => setSetDraft((prev) => ({ ...prev, exerciseType: "cardio" }))}
                >
                  <Text style={styles.buttonSecondaryText}>Cardio</Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.input}
                value={setDraft.reps}
                onChangeText={(value) => setSetDraft((prev) => ({ ...prev, reps: value }))}
                keyboardType="number-pad"
                placeholder="Reps (optional)"
              />
              <TextInput
                style={styles.input}
                value={setDraft.weightKg}
                onChangeText={(value) => setSetDraft((prev) => ({ ...prev, weightKg: value }))}
                keyboardType="decimal-pad"
                placeholder="Weight kg (optional)"
              />
              <TextInput
                style={styles.input}
                value={setDraft.durationMinutes}
                onChangeText={(value) =>
                  setSetDraft((prev) => ({ ...prev, durationMinutes: value }))
                }
                keyboardType="number-pad"
                placeholder="Duration minutes (optional)"
              />
              <TextInput
                style={styles.input}
                value={setDraft.notes}
                onChangeText={(value) => setSetDraft((prev) => ({ ...prev, notes: value }))}
                placeholder="Notes (optional)"
              />

              {setError ? <Text style={styles.error}>{setError}</Text> : null}
              {setMessage ? <Text style={styles.success}>{setMessage}</Text> : null}

              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.buttonPrimary,
                    (createSetMutation.isPending || updateSetMutation.isPending) &&
                    styles.disabledButton,
                  ]}
                  onPress={() => {
                    if (editingSetId) {
                      updateSetMutation.mutate();
                      return;
                    }
                    createSetMutation.mutate();
                  }}
                  disabled={createSetMutation.isPending || updateSetMutation.isPending}
                >
                  <Text style={styles.buttonPrimaryText}>
                    {editingSetId ? "Save Set Changes" : "Add Set"}
                  </Text>
                </Pressable>
                {editingSetId ? (
                  <Pressable
                    style={styles.buttonSecondary}
                    onPress={() => {
                      setEditingSetId(null);
                      setSetDraft(defaultSetDraft);
                    }}
                  >
                    <Text style={styles.buttonSecondaryText}>Cancel Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.detailTitle}>Sets</Text>
            {detail.sets.length === 0 ? (
              <Text style={styles.helperText}>No sets yet.</Text>
            ) : (
              detail.sets.map((set) => (
                <View key={set.id} style={styles.setCard}>
                  <Text style={styles.setTitle}>
                    {set.exerciseName} ({set.exerciseType})
                  </Text>
                  <Text style={styles.helperText}>
                    reps: {set.reps ?? "-"} · weight: {set.weightKg ?? "-"} kg · duration:{" "}
                    {set.durationMinutes ?? "-"} min
                  </Text>
                  <Text style={styles.helperText}>at {formatDateTime(set.performedAt)}</Text>
                  {set.notes ? <Text style={styles.helperText}>notes: {set.notes}</Text> : null}
                  {!detail.endedAt ? (
                    <View style={styles.row}>
                      <Pressable style={styles.buttonSecondary} onPress={() => handleEditSet(set)}>
                        <Text style={styles.buttonSecondaryText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={styles.buttonDanger}
                        onPress={() =>
                          Alert.alert("Delete set", "Delete this set?", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => deleteSetMutation.mutate(set.id),
                            },
                          ])
                        }
                      >
                        <Text style={styles.buttonDangerText}>Delete</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButtonText: {
    color: "#111827",
    fontWeight: "600",
    fontSize: 13,
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
  detailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
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
    flexWrap: "wrap",
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
  typeActive: {
    borderWidth: 1,
    borderColor: "#111827",
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
  setCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: "#FFFFFF",
  },
  setTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
});
