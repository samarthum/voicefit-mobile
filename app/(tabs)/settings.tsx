import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
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
  error: "#FF3B30",
  blue: "#007AFF",
  orange: "#FF9500",
  green: "#34C759",
  healthRed: "#FF6B6B",
};

interface UserSettingsResponse {
  calorieGoal: number;
  stepGoal: number;
}

const PREVIEW_SETTINGS: UserSettingsResponse = {
  calorieGoal: 2000,
  stepGoal: 10000,
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

function SettingsRow({
  iconBackground,
  icon,
  label,
  value,
}: {
  iconBackground: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: iconBackground }]}>{icon}</View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut, getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const isWebPreview = __DEV__ && Platform.OS === "web";
  const [calorieGoal, setCalorieGoal] = useState(String(PREVIEW_SETTINGS.calorieGoal));
  const [stepGoal, setStepGoal] = useState(String(PREVIEW_SETTINGS.stepGoal));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEditedRef = useRef(false);

  const { data, isLoading, error } = useQuery<UserSettingsResponse>({
    queryKey: ["user-settings"],
    enabled: !isWebPreview && !!isSignedIn,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<UserSettingsResponse>("/api/user/settings", { token });
    },
  });

  const effectiveData = data ?? PREVIEW_SETTINGS;

  useEffect(() => {
    if (hasEditedRef.current) return;
    setCalorieGoal(String(effectiveData.calorieGoal));
    setStepGoal(String(effectiveData.stepGoal));
  }, [effectiveData.calorieGoal, effectiveData.stepGoal]);

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
      if (isWebPreview) {
        setSaveSuccess("Goals updated.");
        return;
      }

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
        <Text style={styles.pageTitle}>Settings</Text>

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
              <View style={[styles.inputRow, styles.inputRowLast]}>
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

        <Text style={styles.groupLabel}>General</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            iconBackground="rgba(0,122,255,0.12)"
            icon={<UnitsGlyph />}
            label="Units"
            value="Metric"
          />
          <SettingsRow
            iconBackground="rgba(255,149,0,0.12)"
            icon={<TimeGlyph />}
            label="Timezone"
            value="Auto"
          />
        </View>

        <Text style={styles.groupLabel}>Health Integration</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            iconBackground="rgba(255,107,107,0.12)"
            icon={<HeartGlyph />}
            label="Apple Health"
            value="Coming Soon"
          />
          <SettingsRow
            iconBackground="rgba(52,199,89,0.12)"
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
        hint='"Had pasta for lunch..."'
        onPress={() => router.push({ pathname: "/(tabs)/dashboard", params: { cc: "expanded" } })}
        onMicPress={() => router.push({ pathname: "/(tabs)/dashboard", params: { cc: "recording" } })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 96,
    backgroundColor: COLORS.surface,
  },
  pageTitle: {
    paddingBottom: 24,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: COLORS.textPrimary,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  profileEmail: {
    marginTop: 2,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  groupLabel: {
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: COLORS.textSecondary,
  },
  groupCard: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: COLORS.bg,
    marginBottom: 24,
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  inputRowLast: {
    borderBottomWidth: 0,
  },
  inputLabel: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  goalInput: {
    width: 120,
    paddingVertical: 4,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
    color: COLORS.textPrimary,
  },
  inputUnit: {
    width: 44,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "left",
  },
  inlineError: {
    marginTop: -12,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.error,
  },
  inlineSuccess: {
    marginTop: -12,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "600",
    color: "#047857",
  },
  saveButton: {
    width: "100%",
    marginBottom: 24,
    borderRadius: 12,
    backgroundColor: COLORS.textPrimary,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingValue: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  dangerButton: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.error,
  },
  version: {
    paddingTop: 24,
    textAlign: "center",
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});
