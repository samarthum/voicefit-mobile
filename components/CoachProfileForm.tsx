import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const COLORS = {
  bg: "#0A0B0A",
  surface: "#141614",
  surface2: "#1C1F1C",
  border: "rgba(255,255,255,0.08)",
  textPrimary: "#F3F4F1",
  textSecondary: "rgba(243,244,241,0.68)",
  textTertiary: "rgba(243,244,241,0.42)",
  accent: "#C7FB41",
  accentInk: "#0A0B0A",
};

const GOAL_OPTIONS = ["lose", "gain", "recomp", "maintain"] as const;
const GOAL_LABELS: Record<string, string> = {
  lose: "Lose fat",
  gain: "Gain muscle",
  recomp: "Recomp",
  maintain: "Maintain",
};

const DIET_OPTIONS = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "other",
] as const;

const EXPERIENCE_OPTIONS = ["beginner", "intermediate", "advanced"] as const;
const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export type CoachProfileData = {
  goal: string | null;
  heightCm: number | null;
  weightKg: number | null;
  age: number | null;
  biologicalSex: string | null;
  dietaryStyle: string | null;
  dietaryRestrictions: string | null;
  trainingExperience: string | null;
};

type Props = {
  initialData?: CoachProfileData | null;
  onSave: (data: CoachProfileData) => Promise<void>;
  onSkip?: () => void;
  isSaving: boolean;
};

function SegmentedControl({
  options,
  labels,
  value,
  onSelect,
}: {
  options: readonly string[];
  labels?: Record<string, string>;
  value: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={segStyles.row}>
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <Pressable
            key={opt}
            style={[segStyles.chip, selected ? segStyles.chipSelected : null]}
            onPress={() => onSelect(opt)}
          >
            <Text
              style={[
                segStyles.chipText,
                selected ? segStyles.chipTextSelected : null,
              ]}
            >
              {labels ? (labels[opt] ?? opt) : opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  chipTextSelected: { color: COLORS.accentInk, fontWeight: "700" },
});

export function CoachProfileForm({
  initialData,
  onSave,
  onSkip,
  isSaving,
}: Props) {
  const [goal, setGoal] = useState<string | null>(initialData?.goal ?? null);
  const [heightCm, setHeightCm] = useState(
    initialData?.heightCm ? String(initialData.heightCm) : ""
  );
  const [weightKg, setWeightKg] = useState(
    initialData?.weightKg ? String(initialData.weightKg) : ""
  );
  const [age, setAge] = useState(
    initialData?.age ? String(initialData.age) : ""
  );
  const [biologicalSex, setBiologicalSex] = useState<string | null>(
    initialData?.biologicalSex ?? null
  );
  const [dietaryStyle, setDietaryStyle] = useState<string | null>(
    initialData?.dietaryStyle ?? null
  );
  const [dietaryRestrictions, setDietaryRestrictions] = useState(
    initialData?.dietaryRestrictions ?? ""
  );
  const [trainingExperience, setTrainingExperience] = useState<string | null>(
    initialData?.trainingExperience ?? null
  );

  const handleSave = () => {
    void onSave({
      goal,
      heightCm: heightCm ? Number(heightCm) : null,
      weightKg: weightKg ? Number(weightKg) : null,
      age: age ? Number(age) : null,
      biologicalSex,
      dietaryStyle,
      dietaryRestrictions: dietaryRestrictions || null,
      trainingExperience,
    });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>Coach Profile</Text>
      <Text style={styles.subtitle}>
        Help your coach give better advice by sharing a few details.
      </Text>

      <Text style={styles.label}>Goal</Text>
      <SegmentedControl
        options={GOAL_OPTIONS}
        labels={GOAL_LABELS}
        value={goal}
        onSelect={setGoal}
      />

      <Text style={styles.label}>Body</Text>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Height (cm)</Text>
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={(v) => setHeightCm(v.replace(/[^\d]/g, ""))}
            keyboardType="number-pad"
            placeholder="175"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={(v) => setWeightKg(v.replace(/[^\d.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="75"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>
      </View>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Age</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={(v) => setAge(v.replace(/[^\d]/g, ""))}
            keyboardType="number-pad"
            placeholder="28"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Sex</Text>
          <SegmentedControl
            options={["male", "female"]}
            value={biologicalSex}
            onSelect={setBiologicalSex}
          />
        </View>
      </View>

      <Text style={styles.label}>Dietary style</Text>
      <SegmentedControl
        options={DIET_OPTIONS}
        value={dietaryStyle}
        onSelect={setDietaryStyle}
      />

      <Text style={[styles.label, { marginTop: 12 }]}>Restrictions</Text>
      <TextInput
        style={[styles.input, { minHeight: 44 }]}
        value={dietaryRestrictions}
        onChangeText={setDietaryRestrictions}
        placeholder="e.g. no dairy, nut allergy"
        placeholderTextColor={COLORS.textTertiary}
        multiline
      />

      <Text style={styles.label}>Training experience</Text>
      <SegmentedControl
        options={EXPERIENCE_OPTIONS}
        labels={EXPERIENCE_LABELS}
        value={trainingExperience}
        onSelect={setTrainingExperience}
      />

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.saveButton, isSaving ? styles.buttonDisabled : null]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
        {onSkip != null ? (
          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  label: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: COLORS.textSecondary,
  },
  inputRow: { flexDirection: "row", gap: 12 },
  inputGroup: { flex: 1, marginBottom: 4 },
  inputLabel: {
    marginBottom: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.bg,
  },
  buttonRow: { marginTop: 28, gap: 12 },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.accentInk,
  },
  skipButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
});
