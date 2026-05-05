import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CoachProfileForm,
  type CoachProfileData,
} from "../../components/CoachProfileForm";
import { useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { FloatingCommandBar } from "../../components/FloatingCommandBar";
import { useCommandCenter } from "../../components/command-center";
import { apiRequest } from "../../lib/api-client";
import { color as token, font, radius as r } from "../../lib/tokens";
import { isWebPreviewMode } from "../../lib/web-preview-mode";

const COLORS = {
  bg: token.bg,
  surface: token.surface,
  surface2: token.surface2,
  border: token.line,
  textPrimary: token.text,
  textSecondary: token.textSoft,
  textTertiary: token.textMute,
  error: token.negative,
  blue: token.accent,
  orange: token.accent,
  green: token.positive,
  healthRed: token.negative,
  accent: token.accent,
  accentInk: token.accentInk,
};

import type { DashboardData, UserSettings } from "@voicefit/contracts/types";

const PREVIEW_SETTINGS: UserSettings = {
  calorieGoal: 2000,
  stepGoal: 10000,
  proteinGoal: 140,
  weightGoalKg: null,
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong. Please try again.";
}

// Display raw digits in the TextInput to avoid cursor-jumping from locale formatting.
function formatGoal(value: string) {
  return value;
}

function initialsFor(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase() || "VF";
}

function RowChevron() {
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

function UnitsGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M8 3V13M3 8H13" stroke={COLORS.blue} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function TimeGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={8} r={6} stroke={COLORS.orange} strokeWidth={1.8} />
      <Path d="M8 5.5V8.5L10 9.5" stroke={COLORS.orange} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function HeartGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 13.5C8 13.5 2 10.1 2 5.8C2 3.4 4.9 1.8 8 4.5C11.1 1.8 14 3.4 14 5.8C14 10.1 8 13.5 8 13.5Z"
        stroke={COLORS.healthRed}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HealthConnectGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M4 3H12C12.55 3 13 3.45 13 4V12C13 12.55 12.55 13 12 13H4C3.45 13 3 12.55 3 12V4C3 3.45 3.45 3 4 3Z"
        stroke={COLORS.green}
        strokeWidth={1.8}
      />
      <Path d="M5.5 8L7.2 9.7L10.8 6.2" stroke={COLORS.green} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function PlayGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M4 10V4L11 7L4 10Z" fill={token.accent} />
    </Svg>
  );
}

function CalendarGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M2 3H12V11.5C12 11.78 11.78 12 11.5 12H2.5C2.22 12 2 11.78 2 11.5V3Z"
        stroke={token.accent}
        strokeWidth={1.4}
      />
      <Path d="M2 5H12" stroke={token.accent} strokeWidth={1.4} />
      <Path d="M5 2V4M9 2V4" stroke={token.accent} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function BellGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M3.5 10H10.5L9.5 8.5V6.5C9.5 4.84 8.16 3.5 6.5 3.5C4.84 3.5 3.5 4.84 3.5 6.5V8.5L2.5 10H4.5"
        stroke={token.accent}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.5 11C5.5 11.55 5.95 12 6.5 12C7.05 12 7.5 11.55 7.5 11"
        stroke={token.accent}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SettingsRow({
  iconBackground,
  icon,
  label,
  value,
  showChevron,
}: {
  iconBackground: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  showChevron?: boolean;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: iconBackground }]}>{icon}</View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.settingRight}>
        <Text style={styles.settingValue}>{value}</Text>
        {showChevron ? <RowChevron /> : null}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const cc = useCommandCenter();
  const router = useRouter();
  const { signOut, getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const isWebPreview = isWebPreviewMode();
  const [calorieGoal, setCalorieGoal] = useState(String(PREVIEW_SETTINGS.calorieGoal));
  const [stepGoal, setStepGoal] = useState(String(PREVIEW_SETTINGS.stepGoal));
  const [proteinGoal, setProteinGoal] = useState(String(PREVIEW_SETTINGS.proteinGoal));
  const [weightGoal, setWeightGoal] = useState(
    PREVIEW_SETTINGS.weightGoalKg != null ? String(PREVIEW_SETTINGS.weightGoalKg) : "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEditedRef = useRef(false);
  const [showCoachProfile, setShowCoachProfile] = useState(false);
  const [coachProfileSaving, setCoachProfileSaving] = useState(false);

  const { data: coachProfile } = useQuery<CoachProfileData | null>({
    queryKey: ["coach-profile"],
    enabled: !isWebPreview && !!isSignedIn,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<CoachProfileData | null>("/api/coach/profile", { token });
    },
  });

  const handleCoachProfileSave = async (data: CoachProfileData) => {
    setCoachProfileSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const updated = await apiRequest<CoachProfileData>("/api/coach/profile", {
        method: "PUT",
        token,
        body: JSON.stringify(data),
      });
      queryClient.setQueryData(["coach-profile"], updated);
      setShowCoachProfile(false);
    } finally {
      setCoachProfileSaving(false);
    }
  };

  const { data, isLoading, error } = useQuery<UserSettings>({
    queryKey: ["user-settings"],
    enabled: !isWebPreview && !!isSignedIn,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<UserSettings>("/api/user/settings", { token });
    },
  });

  const effectiveData = data ?? PREVIEW_SETTINGS;

  useEffect(() => {
    if (hasEditedRef.current) return;
    setCalorieGoal(String(effectiveData.calorieGoal));
    setStepGoal(String(effectiveData.stepGoal));
    setProteinGoal(String(effectiveData.proteinGoal));
    setWeightGoal(
      effectiveData.weightGoalKg != null ? String(effectiveData.weightGoalKg) : "",
    );
  }, [
    effectiveData.calorieGoal,
    effectiveData.stepGoal,
    effectiveData.proteinGoal,
    effectiveData.weightGoalKg,
  ]);

  useEffect(() => {
    if (!saveSuccess) return;
    saveSuccessTimerRef.current = setTimeout(() => setSaveSuccess(null), 2200);
    return () => {
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
    };
  }, [saveSuccess]);

  const profile = useMemo(() => {
    const name =
      user?.fullName?.trim() ||
      user?.firstName?.trim() ||
      (isWebPreview ? "Samarth" : "VoiceFit User");
    const email = user?.primaryEmailAddress?.emailAddress || "samarth@example.com";
    return {
      name,
      email,
      initials: initialsFor(name, email),
    };
  }, [isWebPreview, user]);

  const saveSettings = async () => {
    const nextCalorieGoal = Number(calorieGoal.replace(/,/g, "").trim());
    const nextStepGoal = Number(stepGoal.replace(/,/g, "").trim());
    const nextProteinGoal = Number(proteinGoal.replace(/,/g, "").trim());
    const trimmedWeight = weightGoal.replace(/,/g, "").trim();
    const nextWeightGoalKg = trimmedWeight === "" ? null : Number(trimmedWeight);

    if (!Number.isInteger(nextCalorieGoal) || nextCalorieGoal < 500 || nextCalorieGoal > 10000) {
      setSaveError("Calorie goal must be an integer between 500 and 10000.");
      return;
    }
    if (!Number.isInteger(nextStepGoal) || nextStepGoal < 1000 || nextStepGoal > 100000) {
      setSaveError("Step goal must be an integer between 1000 and 100000.");
      return;
    }
    if (!Number.isInteger(nextProteinGoal) || nextProteinGoal < 20 || nextProteinGoal > 500) {
      setSaveError("Protein goal must be an integer between 20 and 500.");
      return;
    }
    if (
      nextWeightGoalKg !== null &&
      (Number.isNaN(nextWeightGoalKg) || nextWeightGoalKg < 20 || nextWeightGoalKg > 300)
    ) {
      setSaveError("Weight goal must be between 20 and 300 kg, or empty.");
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    setIsSaving(true);

    try {
      if (isWebPreview) {
        setSaveSuccess("Goals updated.");
        return;
      }

      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const updated = await apiRequest<UserSettings>("/api/user/settings", {
        method: "PUT",
        token,
        body: JSON.stringify({
          calorieGoal: nextCalorieGoal,
          stepGoal: nextStepGoal,
          proteinGoal: nextProteinGoal,
          weightGoalKg: nextWeightGoalKg,
        }),
      });

      queryClient.setQueryData(["user-settings"], updated);
      queryClient.setQueriesData<DashboardData>({ queryKey: ["dashboard"] }, (existing) =>
        existing
          ? {
              ...existing,
              today: {
                ...existing.today,
                calories: {
                  ...existing.today.calories,
                  goal: updated.calorieGoal,
                },
                proteinGoal: updated.proteinGoal,
                steps: {
                  ...existing.today.steps,
                  goal: updated.stepGoal,
                },
              },
            }
          : existing,
      );
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      hasEditedRef.current = false;
      setSaveSuccess("Goals updated.");
    } catch (saveErr) {
      setSaveError(getErrorMessage(saveErr));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageEyebrow}>Profile</Text>
        <Text style={styles.pageTitle}>You</Text>

        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.initials}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileEmail}>{profile.email}</Text>
          </View>
        </View>

        <Text style={styles.groupLabel}>Daily Goals</Text>
        <View style={styles.groupCard}>
          {isLoading && !isWebPreview ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
            </View>
          ) : (
            <>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Calorie Goal</Text>
                <TextInput
                  style={styles.goalInput}
                  value={formatGoal(calorieGoal)}
                  onChangeText={(value) => {
                    hasEditedRef.current = true;
                    setCalorieGoal(value.replace(/[^\d]/g, ""));
                  }}
                  keyboardType="number-pad"
                  editable={!isSaving}
                />
                <Text style={styles.inputUnit}>kcal</Text>
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Step Goal</Text>
                <TextInput
                  style={styles.goalInput}
                  value={formatGoal(stepGoal)}
                  onChangeText={(value) => {
                    hasEditedRef.current = true;
                    setStepGoal(value.replace(/[^\d]/g, ""));
                  }}
                  keyboardType="number-pad"
                  editable={!isSaving}
                />
                <Text style={styles.inputUnit}>steps</Text>
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Protein Goal</Text>
                <TextInput
                  style={styles.goalInput}
                  value={formatGoal(proteinGoal)}
                  onChangeText={(value) => {
                    hasEditedRef.current = true;
                    setProteinGoal(value.replace(/[^\d]/g, ""));
                  }}
                  keyboardType="number-pad"
                  editable={!isSaving}
                />
                <Text style={styles.inputUnit}>g</Text>
              </View>
              <View style={[styles.inputRow, styles.inputRowLast]}>
                <Text style={styles.inputLabel}>Weight Goal</Text>
                <TextInput
                  style={styles.goalInput}
                  value={weightGoal}
                  onChangeText={(value) => {
                    hasEditedRef.current = true;
                    setWeightGoal(value.replace(/[^\d.]/g, ""));
                  }}
                  keyboardType="decimal-pad"
                  editable={!isSaving}
                  placeholder="—"
                  placeholderTextColor={token.textMute}
                />
                <Text style={styles.inputUnit}>kg</Text>
              </View>
            </>
          )}
        </View>

        {error && !isWebPreview ? <Text style={styles.inlineError}>{getErrorMessage(error)}</Text> : null}
        {saveError ? <Text style={styles.inlineError}>{saveError}</Text> : null}
        {saveSuccess ? <Text style={styles.inlineSuccess}>{saveSuccess}</Text> : null}

        <Pressable
          style={[styles.saveButton, isSaving ? styles.buttonDisabled : null]}
          onPress={() => void saveSettings()}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save Goals"}</Text>
        </Pressable>

        <Text style={styles.groupLabel}>Coach</Text>
        <View style={styles.groupCard}>
          <Pressable
            style={styles.settingRow}
            onPress={() => setShowCoachProfile(true)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: token.surface2 }]}>
                <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                  <Path
                    d="M7 1L8.5 5.5L13 7L8.5 8.5L7 13L5.5 8.5L1 7L5.5 5.5L7 1Z"
                    fill={token.accent}
                  />
                </Svg>
              </View>
              <Text style={styles.settingLabel}>Coach Profile</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {coachProfile ? "Edit" : "Set up"}
              </Text>
              <RowChevron />
            </View>
          </Pressable>
          <SettingsRow
            iconBackground={token.surface2}
            icon={<PlayGlyph />}
            label="Voice feedback"
            value="Coming soon"
          />
          <SettingsRow
            iconBackground={token.surface2}
            icon={<CalendarGlyph />}
            label="Weekly summary"
            value="Coming soon"
          />
        </View>

        <Modal
          visible={showCoachProfile}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowCoachProfile(false)}
        >
          <CoachProfileForm
            initialData={coachProfile}
            onSave={handleCoachProfileSave}
            onSkip={() => setShowCoachProfile(false)}
            isSaving={coachProfileSaving}
          />
        </Modal>

        <Text style={styles.groupLabel}>General</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            iconBackground={token.surface2}
            icon={<UnitsGlyph />}
            label="Units"
            value="Metric"
          />
          <SettingsRow
            iconBackground={token.surface2}
            icon={<TimeGlyph />}
            label="Timezone"
            value="Auto"
          />
          <SettingsRow
            iconBackground={token.surface2}
            icon={<BellGlyph />}
            label="Notifications"
            value="Coming soon"
          />
        </View>

        <Text style={styles.groupLabel}>Health Integration</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            iconBackground={token.surface2}
            icon={<HeartGlyph />}
            label="Apple Health"
            value="Coming Soon"
          />
          <SettingsRow
            iconBackground={token.surface2}
            icon={<HealthConnectGlyph />}
            label="Health Connect"
            value="Coming Soon"
          />
        </View>

        <Pressable style={styles.dangerButton} onPress={() => {
          Alert.alert("Sign Out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: "destructive", onPress: () => void signOut() },
          ]);
        }}>
          <Text style={styles.dangerButtonText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.version}>VoiceFit Mobile · v0.1</Text>
      </ScrollView>

      <FloatingCommandBar
        hint="Log a meal, lift, or weight…"
        onPress={() => cc.open()}
        onMicPress={() => cc.startRecording()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: token.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 96,
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
    marginTop: 2,
    paddingBottom: 24,
    fontFamily: font.sans[600],
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.65,
    color: token.text,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    marginBottom: 22,
    borderRadius: r.md,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: r.pill,
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: font.sans[700],
    fontSize: 18,
    fontWeight: "700",
    color: token.accentInk,
    letterSpacing: -0.18,
  },
  profileName: {
    fontFamily: font.sans[600],
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: token.text,
  },
  profileEmail: {
    marginTop: 3,
    fontFamily: font.sans[400],
    fontSize: 12,
    color: token.textMute,
  },
  groupLabel: {
    paddingBottom: 10,
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.text,
  },
  groupCard: {
    overflow: "hidden",
    borderRadius: r.sm,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    marginBottom: 22,
  },
  loadingRow: {
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: token.line,
  },
  inputRowLast: {
    borderBottomWidth: 0,
  },
  inputLabel: {
    flex: 1,
    fontFamily: font.sans[500],
    fontSize: 14,
    fontWeight: "500",
    color: token.text,
  },
  goalInput: {
    width: 120,
    paddingVertical: 4,
    fontFamily: font.mono[500],
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: -0.34,
    textAlign: "right",
    color: token.text,
  },
  inputUnit: {
    width: 44,
    fontFamily: font.sans[400],
    fontSize: 11,
    color: token.textMute,
    textAlign: "left",
  },
  inlineError: {
    marginTop: -12,
    marginBottom: 12,
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: token.negative,
  },
  inlineSuccess: {
    marginTop: -12,
    marginBottom: 12,
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: token.positive,
  },
  saveButton: {
    width: "100%",
    marginBottom: 22,
    borderRadius: r.sm,
    backgroundColor: token.accent,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.28,
    color: token.accentInk,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: token.line,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: token.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    fontFamily: font.sans[500],
    fontSize: 14,
    fontWeight: "500",
    color: token.text,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingValue: {
    fontFamily: font.sans[400],
    fontSize: 13,
    color: token.textMute,
  },
  dangerButton: {
    width: "100%",
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButtonText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: token.negative,
  },
  version: {
    paddingTop: 8,
    textAlign: "center",
    fontFamily: font.mono[400],
    fontSize: 10,
    color: token.textMute,
  },
});
