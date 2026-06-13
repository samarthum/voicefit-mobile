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
} from "@/components/CoachProfileForm";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FloatingCommandBar } from "@/components/FloatingCommandBar";
import { useCommandCenter } from "@/components/command-center";
import { apiRequest } from "@/lib/api-client";
import { asyncStoragePersister } from "@/lib/query-client";
import { color as token, font, radius as r } from "@/lib/tokens";
import { isWebPreviewMode } from "@/lib/web-preview-mode";
import { Icon } from "@/components/Icon";
import { haptic } from "@/lib/haptics";

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
  return <Icon name="chevronRight" size={14} color={COLORS.textTertiary} />;
}

function UnitsGlyph() {
  return <Icon name="units" size={16} color={COLORS.blue} />;
}

function TimeGlyph() {
  return <Icon name="clock" size={16} color={COLORS.orange} />;
}

function HeartGlyph() {
  return <Icon name="heart" size={16} color={COLORS.healthRed} />;
}

function HealthConnectGlyph() {
  return <Icon name="checkCircle" size={16} color={COLORS.green} />;
}

function PlayGlyph() {
  return <Icon name="play" size={14} color={token.accent} />;
}

function CalendarGlyph() {
  return <Icon name="calendar" size={14} color={token.accent} />;
}

function BellGlyph() {
  return <Icon name="bell" size={14} color={token.accent} />;
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
        <Text style={styles.settingValue} selectable>{value}</Text>
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
        haptic.success();
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
      haptic.success();
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
            <Text style={styles.profileName} selectable>{profile.name}</Text>
            <Text style={styles.profileEmail} selectable>{profile.email}</Text>
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

        {error && !isWebPreview ? <Text style={styles.inlineError} selectable>{getErrorMessage(error)}</Text> : null}
        {saveError ? <Text style={styles.inlineError} selectable>{saveError}</Text> : null}
        {saveSuccess ? <Text style={styles.inlineSuccess} selectable>{saveSuccess}</Text> : null}

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
            onPress={() => { haptic.tap(); setShowCoachProfile(true); }}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: token.surface2 }]}>
                <Icon name="sparkle" size={14} color={token.accent} />
              </View>
              <Text style={styles.settingLabel}>Coach Profile</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue} selectable>
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
          haptic.press();
          Alert.alert("Sign Out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign Out",
              style: "destructive",
              onPress: () => {
                // Drop both the in-memory and persisted caches so the next
                // account signed in on this device never sees the previous
                // user's rehydrated dashboard.
                queryClient.clear();
                void asyncStoragePersister.removeClient();
                void signOut();
              },
            },
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
        overTabBar
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
    // Clear the floating command bar docked above the native tab bar.
    paddingBottom: 210,
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
