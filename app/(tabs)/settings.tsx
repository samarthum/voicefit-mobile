import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Keyboard, ScrollView } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api-client";

interface UserSettingsResponse {
  calorieGoal: number;
  stepGoal: number;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong. Please try again.";
}

export default function SettingsScreen() {
  const { signOut, getToken } = useAuth();
  const queryClient = useQueryClient();
  const [calorieGoal, setCalorieGoal] = useState("");
  const [stepGoal, setStepGoal] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss success message
  useEffect(() => {
    if (!saveSuccess) return;
    saveSuccessTimerRef.current = setTimeout(() => setSaveSuccess(null), 3000);
    return () => { if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current); };
  }, [saveSuccess]);

  const { data, isLoading, error } = useQuery<UserSettingsResponse>({
    queryKey: ["user-settings"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<UserSettingsResponse>("/api/user/settings", { token });
    },
  });

  useEffect(() => {
    if (!data) return;
    setCalorieGoal(String(data.calorieGoal));
    setStepGoal(String(data.stepGoal));
  }, [data]);

  const saveSettings = async () => {
    const nextCalorieGoal = Number(calorieGoal.trim());
    const nextStepGoal = Number(stepGoal.trim());

    if (!Number.isInteger(nextCalorieGoal) || nextCalorieGoal < 500 || nextCalorieGoal > 10000) {
      setSaveError("Calorie goal must be an integer between 500 and 10000.");
      return;
    }

    if (!Number.isInteger(nextStepGoal) || nextStepGoal < 1000 || nextStepGoal > 100000) {
      setSaveError("Step goal must be an integer between 1000 and 100000.");
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    setIsSaving(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const updated = await apiRequest<UserSettingsResponse>("/api/user/settings", {
        method: "PUT",
        token,
        body: JSON.stringify({
          calorieGoal: nextCalorieGoal,
          stepGoal: nextStepGoal,
        }),
      });

      queryClient.setQueryData(["user-settings"], updated);
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSaveSuccess("Goals updated.");
      Keyboard.dismiss();
    } catch (saveErr) {
      setSaveError(getErrorMessage(saveErr));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Settings</Text>

      {isLoading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>{getErrorMessage(error)}</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Goals</Text>

          <Text style={styles.label}>Calorie Goal</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={calorieGoal}
            onChangeText={setCalorieGoal}
            editable={!isSaving}
            placeholder="2000"
          />

          <Text style={styles.label}>Step Goal</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={stepGoal}
            onChangeText={setStepGoal}
            editable={!isSaving}
            placeholder="10000"
          />

          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          {saveSuccess ? <Text style={styles.success}>{saveSuccess}</Text> : null}

          <Pressable
            style={[styles.saveButton, isSaving ? styles.disabledButton : null]}
            onPress={saveSettings}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save Goals"}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Integration</Text>
        <Text style={styles.body}>
          Fitbit API is deprecated for mobile direction. Planned integration path is:
        </Text>
        <Text style={styles.helperItem}>1. Apple HealthKit (iOS)</Text>
        <Text style={styles.helperItem}>2. Health Connect (Android)</Text>
        <Text style={styles.body}>
          This will replace Fitbit-specific connect/sync flows for mobile.
        </Text>
      </View>

      <Pressable style={styles.signOutButton} onPress={() => signOut()} disabled={isSaving}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  body: {
    fontSize: 13,
    color: "#4B5563",
  },
  card: {
    width: "100%",
    marginTop: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 4,
    marginBottom: 6,
  },
  helperItem: {
    fontSize: 13,
    color: "#111827",
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
  },
  saveButton: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  disabledButton: {
    opacity: 0.6,
  },
  error: {
    color: "#B91C1C",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  success: {
    color: "#047857",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  signOutButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignSelf: "flex-start",
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
});
