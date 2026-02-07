import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Audio } from "expo-av";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import type { MealInterpretation, RecordingState } from "@voicefit/contracts/types";
import { apiFormRequest, apiRequest } from "../../lib/api-client";

type MealType = MealInterpretation["mealType"];

interface MealDraft {
  mealType: MealType;
  description: string;
  calories: string;
}

interface MetricsDraft {
  date: string;
  steps: string;
  weightKg: string;
}

const MIN_RECORDING_DURATION_MS = 1000;
const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const todayDate = () => new Date().toISOString().slice(0, 10);

const defaultMealDraft: MealDraft = {
  mealType: "breakfast",
  description: "",
  calories: "",
};

const defaultMetricsDraft = (): MetricsDraft => ({
  date: todayDate(),
  steps: "",
  weightKg: "",
});

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export default function LogScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [state, setState] = useState<RecordingState>("idle");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [interpretation, setInterpretation] = useState<MealInterpretation | null>(null);
  const [mealDraft, setMealDraft] = useState<MealDraft>(defaultMealDraft);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [metricsDraft, setMetricsDraft] = useState<MetricsDraft>(defaultMetricsDraft);
  const [metricsErrorMessage, setMetricsErrorMessage] = useState<string | null>(null);
  const [metricsSuccessMessage, setMetricsSuccessMessage] = useState<string | null>(null);
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metricsSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBusy = useMemo(
    () => ["uploading", "transcribing", "interpreting", "saving"].includes(state),
    [state]
  );

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  // Auto-dismiss meal success message
  useEffect(() => {
    if (!successMessage) return;
    successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000);
    return () => { if (successTimerRef.current) clearTimeout(successTimerRef.current); };
  }, [successMessage]);

  // Auto-dismiss metrics success message
  useEffect(() => {
    if (!metricsSuccessMessage) return;
    metricsSuccessTimerRef.current = setTimeout(() => setMetricsSuccessMessage(null), 3000);
    return () => { if (metricsSuccessTimerRef.current) clearTimeout(metricsSuccessTimerRef.current); };
  }, [metricsSuccessMessage]);

  const resetFlow = () => {
    setState("idle");
    setRecordingSeconds(0);
    setTranscript("");
    setTranscriptDraft("");
    setInterpretation(null);
    setMealDraft(defaultMealDraft);
    setErrorMessage(null);
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setTranscript("");
    setTranscriptDraft("");
    setInterpretation(null);
    setMealDraft(defaultMealDraft);

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone permission is required.");
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      nextRecording.setOnRecordingStatusUpdate((status) => {
        setRecordingSeconds(Math.floor((status.durationMillis ?? 0) / 1000));
      });
      await nextRecording.startAsync();
      setRecording(nextRecording);
      setState("recording");
    } catch (error) {
      setState("error");
      setErrorMessage(getErrorMessage(error));
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setErrorMessage(null);
    setState("uploading");
    const activeRecording = recording;
    setRecording(null);

    try {
      activeRecording.setOnRecordingStatusUpdate(null);
      await activeRecording.stopAndUnloadAsync();
      const status = await activeRecording.getStatusAsync();
      const durationMillis = status.durationMillis ?? 0;
      const uri = activeRecording.getURI();

      if (!uri || durationMillis < MIN_RECORDING_DURATION_MS) {
        throw new Error("Recording is too short. Please record at least 1 second.");
      }

      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in.");
      }

      const formData = new FormData();
      formData.append(
        "audio",
        {
          uri,
          name: `meal-${Date.now()}.m4a`,
          type: "audio/m4a",
        } as unknown as Blob
      );

      setState("transcribing");
      const { transcript: rawTranscript } = await apiFormRequest<{ transcript: string }>(
        "/api/transcribe",
        formData,
        { token }
      );

      const cleanedTranscript = rawTranscript.trim();
      if (!cleanedTranscript) {
        throw new Error("Transcript was empty. Please try again.");
      }

      setTranscript(cleanedTranscript);
      setTranscriptDraft(cleanedTranscript);
      setState("editing");
    } catch (error) {
      setState("error");
      setErrorMessage(getErrorMessage(error));
    }
  };

  const interpretMeal = async () => {
    const cleanedTranscript = transcriptDraft.trim();
    if (!cleanedTranscript) {
      setErrorMessage("Transcript cannot be empty.");
      return;
    }

    setErrorMessage(null);
    setState("interpreting");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in.");
      }

      const result = await apiRequest<MealInterpretation>("/api/interpret/meal", {
        method: "POST",
        token,
        body: JSON.stringify({
          transcript: cleanedTranscript,
          eatenAt: new Date().toISOString(),
        }),
      });

      setInterpretation(result);
      setMealDraft({
        mealType: result.mealType,
        description: result.description,
        calories: String(result.calories),
      });
      setState("reviewing");
    } catch (error) {
      setState("editing");
      setErrorMessage(getErrorMessage(error));
    }
  };

  const saveMeal = async () => {
    const description = mealDraft.description.trim();
    const calories = Number(mealDraft.calories);

    if (!description) {
      setErrorMessage("Description is required.");
      return;
    }

    if (!Number.isInteger(calories) || calories < 0) {
      setErrorMessage("Calories must be a non-negative integer.");
      return;
    }

    setErrorMessage(null);
    setState("saving");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in.");
      }

      await apiRequest("/api/meals", {
        method: "POST",
        token,
        body: JSON.stringify({
          eatenAt: new Date().toISOString(),
          mealType: mealDraft.mealType,
          description,
          calories,
          transcriptRaw: transcriptDraft.trim(),
        }),
      });

      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["meals"] });

      setSuccessMessage("Meal logged successfully.");
      resetFlow();
      Keyboard.dismiss();
    } catch (error) {
      setState("reviewing");
      setErrorMessage(getErrorMessage(error));
    }
  };

  const saveMetrics = async () => {
    const date = metricsDraft.date.trim();
    const stepsInput = metricsDraft.steps.trim();
    const weightInput = metricsDraft.weightKg.trim();

    if (!dateRegex.test(date)) {
      setMetricsErrorMessage("Date must be in YYYY-MM-DD format.");
      return;
    }

    const steps = stepsInput === "" ? undefined : Number(stepsInput);
    if (steps !== undefined && (!Number.isInteger(steps) || steps < 0)) {
      setMetricsErrorMessage("Steps must be a non-negative integer.");
      return;
    }

    const weightKg = weightInput === "" ? undefined : Number(weightInput);
    if (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300)) {
      setMetricsErrorMessage("Weight must be between 20 and 300 kg.");
      return;
    }

    if (steps === undefined && weightKg === undefined) {
      setMetricsErrorMessage("Enter steps, weight, or both.");
      return;
    }

    setMetricsErrorMessage(null);
    setMetricsSuccessMessage(null);
    setIsSavingMetrics(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in.");
      }

      await apiRequest("/api/daily-metrics", {
        method: "POST",
        token,
        body: JSON.stringify({
          date,
          ...(steps !== undefined ? { steps } : {}),
          ...(weightKg !== undefined ? { weightKg } : {}),
        }),
      });

      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["daily-metrics"] });
      setMetricsSuccessMessage("Metrics saved successfully.");
      setMetricsDraft(defaultMetricsDraft());
      Keyboard.dismiss();
    } catch (error) {
      setMetricsErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingMetrics(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Log Meal by Voice</Text>
      <Text style={styles.body}>
        Record, transcribe, edit, and save a meal in one flow.
      </Text>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Record</Text>
        {state === "recording" ? (
          <>
            <Text style={styles.timerLabel}>Recording {recordingSeconds}s</Text>
            <Pressable style={styles.stopButton} onPress={stopRecording}>
              <Text style={styles.stopButtonText}>Stop Recording</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.primaryButton, isBusy ? styles.disabledButton : null]}
            onPress={startRecording}
            disabled={isBusy}
          >
            <Text style={styles.primaryButtonText}>Start Recording</Text>
          </Pressable>
        )}

        {state === "uploading" || state === "transcribing" ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>
              {state === "uploading" ? "Uploading audio..." : "Transcribing..."}
            </Text>
          </View>
        ) : null}

        <Text style={styles.helperText}>Minimum recording length: 1 second.</Text>
      </View>

      {transcript ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Edit Transcript</Text>
          <TextInput
            style={styles.multilineInput}
            multiline
            value={transcriptDraft}
            onChangeText={setTranscriptDraft}
            editable={!isBusy}
            placeholder="Transcript will appear here..."
          />
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.primaryButton, isBusy ? styles.disabledButton : null]}
              onPress={interpretMeal}
              disabled={isBusy}
            >
              <Text style={styles.primaryButtonText}>Interpret Meal</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={resetFlow} disabled={isBusy}>
              <Text style={styles.secondaryButtonText}>Start Over</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {interpretation ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Review and Save</Text>
          <Text style={styles.helperText}>Confidence: {Math.round(interpretation.confidence * 100)}%</Text>
          {interpretation.assumptions.length > 0 ? (
            <Text style={styles.assumptionsText}>
              {interpretation.assumptions.join(" | ")}
            </Text>
          ) : null}

          <Text style={styles.fieldLabel}>Meal Type</Text>
          <View style={styles.mealTypeRow}>
            {mealTypes.map((mealType) => (
              <Pressable
                key={mealType}
                style={[
                  styles.mealTypeChip,
                  mealDraft.mealType === mealType ? styles.mealTypeChipActive : null,
                ]}
                onPress={() =>
                  setMealDraft((prev) => ({
                    ...prev,
                    mealType,
                  }))
                }
                disabled={state === "saving"}
              >
                <Text
                  style={[
                    styles.mealTypeChipText,
                    mealDraft.mealType === mealType ? styles.mealTypeChipTextActive : null,
                  ]}
                >
                  {mealType}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={styles.textInput}
            value={mealDraft.description}
            onChangeText={(description) =>
              setMealDraft((prev) => ({
                ...prev,
                description,
              }))
            }
            editable={state !== "saving"}
            placeholder="Meal description"
          />

          <Text style={styles.fieldLabel}>Calories</Text>
          <TextInput
            style={styles.textInput}
            value={mealDraft.calories}
            onChangeText={(calories) =>
              setMealDraft((prev) => ({
                ...prev,
                calories,
              }))
            }
            keyboardType="number-pad"
            editable={state !== "saving"}
            placeholder="0"
          />

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.primaryButton, state === "saving" ? styles.disabledButton : null]}
              onPress={saveMeal}
              disabled={state === "saving"}
            >
              <Text style={styles.primaryButtonText}>
                {state === "saving" ? "Saving..." : "Save Meal"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={resetFlow}
              disabled={state === "saving"}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>4. Manual Metrics</Text>
        <Text style={styles.helperText}>Save steps and weight for a specific date.</Text>

        {metricsErrorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{metricsErrorMessage}</Text>
          </View>
        ) : null}

        {metricsSuccessMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{metricsSuccessMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.textInput}
          value={metricsDraft.date}
          onChangeText={(date) =>
            setMetricsDraft((prev) => ({
              ...prev,
              date,
            }))
          }
          editable={!isSavingMetrics}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="YYYY-MM-DD"
        />

        <Text style={styles.fieldLabel}>Steps (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={metricsDraft.steps}
          onChangeText={(steps) =>
            setMetricsDraft((prev) => ({
              ...prev,
              steps,
            }))
          }
          keyboardType="number-pad"
          editable={!isSavingMetrics}
          placeholder="e.g. 8500"
        />

        <Text style={styles.fieldLabel}>Weight kg (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={metricsDraft.weightKg}
          onChangeText={(weightKg) =>
            setMetricsDraft((prev) => ({
              ...prev,
              weightKg,
            }))
          }
          keyboardType="decimal-pad"
          editable={!isSavingMetrics}
          placeholder="e.g. 72.4"
        />

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.primaryButton, isSavingMetrics ? styles.disabledButton : null]}
            onPress={saveMetrics}
            disabled={isSavingMetrics}
          >
            <Text style={styles.primaryButtonText}>
              {isSavingMetrics ? "Saving..." : "Save Metrics"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setMetricsDraft(defaultMetricsDraft());
              setMetricsErrorMessage(null);
              setMetricsSuccessMessage(null);
            }}
            disabled={isSavingMetrics}
          >
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  body: {
    fontSize: 14,
    color: "#4B5563",
  },
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  timerLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#B91C1C",
  },
  helperText: {
    fontSize: 13,
    color: "#6B7280",
  },
  assumptionsText: {
    fontSize: 12,
    color: "#4B5563",
  },
  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stopButton: {
    backgroundColor: "#B91C1C",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#374151",
  },
  multilineInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  mealTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mealTypeChip: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mealTypeChipActive: {
    borderColor: "#111827",
    backgroundColor: "#111827",
  },
  mealTypeChipText: {
    fontSize: 13,
    color: "#374151",
    textTransform: "capitalize",
  },
  mealTypeChipTextActive: {
    color: "#FFFFFF",
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
  },
  successBox: {
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successText: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "600",
  },
});
