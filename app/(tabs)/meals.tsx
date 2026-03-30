import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { FloatingCommandBar } from "../../components/FloatingCommandBar";
import { MealGlyph } from "../../components/MealGlyph";
import { apiRequest } from "../../lib/api-client";

const COLORS = {
  bg: "#FFFFFF",
  surface: "#F8F8F8",
  border: "#E8E8E8",
  textPrimary: "#1A1A1A",
  textSecondary: "#8E8E93",
  textTertiary: "#AEAEB2",
  calories: "#FF9500",
  error: "#FF3B30",
  blue: "#007AFF",
};

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface MealItem {
  id: string;
  userId: string;
  eatenAt: string;
  mealType: MealType;
  description: string;
  transcriptRaw: string | null;
  calories: number;
  createdAt: string;
  updatedAt: string;
}

interface MealsListResponse {
  meals: MealItem[];
  total: number;
  limit: number;
  offset: number;
}

const SAMPLE_MEALS: MealItem[] = [
  {
    id: "meal-preview-1",
    userId: "preview",
    eatenAt: new Date().toISOString(),
    mealType: "lunch",
    description: "Chicken Salad",
    transcriptRaw: "Chicken salad 450 calories",
    calories: 450,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "meal-preview-2",
    userId: "preview",
    eatenAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    mealType: "breakfast",
    description: "Overnight Oats",
    transcriptRaw: "Overnight oats 320 calories",
    calories: 320,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "meal-preview-3",
    userId: "preview",
    eatenAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    mealType: "dinner",
    description: "Grilled Salmon & Rice",
    transcriptRaw: "Grilled salmon and rice 620 calories",
    calories: 620,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function ChevronGlyph() {
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

function formatMealTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function MealsScreen() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const isWebPreview = __DEV__ && Platform.OS === "web";
  const [dateInput, setDateInput] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editCalories, setEditCalories] = useState("");
  const [editMealType, setEditMealType] = useState<MealType>("breakfast");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const mealsQuery = useQuery({
    queryKey: ["meals", appliedDate],
    enabled: !isWebPreview && !!isSignedIn,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const query = new URLSearchParams({ limit: "50", offset: "0" });
      if (appliedDate) query.set("date", appliedDate);
      return apiRequest<MealsListResponse>(`/api/meals?${query.toString()}`, { token });
    },
  });

  const meals = isWebPreview ? SAMPLE_MEALS : mealsQuery.data?.meals ?? [];

  useEffect(() => {
    if (!meals.length) return;
    if (selectedMealId) return;
    if (!isWebPreview) return;
    setSelectedMealId(meals[0].id);
  }, [isWebPreview, meals, selectedMealId]);

  useEffect(() => {
    if (!selectedMealId || !meals.length) return;
    const selected = meals.find((meal) => meal.id === selectedMealId);
    if (!selected) return;
    setEditDescription(selected.description);
    setEditCalories(String(selected.calories));
    setEditMealType(selected.mealType);
  }, [meals, selectedMealId]);

  const updateMealMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMealId) throw new Error("Select a meal first");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<MealItem>(`/api/meals/${selectedMealId}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          description: editDescription.trim(),
          calories: Number(editCalories.trim()),
          mealType: editMealType,
        }),
      });
    },
    onSuccess: async (updatedMeal) => {
      setEditError(null);
      setEditSuccess("Meal updated.");
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedMealId(updatedMeal.id);
    },
    onError: (error) => {
      setEditSuccess(null);
      setEditError(error instanceof Error ? error.message : "Failed to update meal.");
    },
  });

  const deleteMealMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMealId) throw new Error("Select a meal first");
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<{ deleted: boolean }>(`/api/meals/${selectedMealId}`, {
        method: "DELETE",
        token,
      });
    },
    onSuccess: async () => {
      setSelectedMealId(null);
      setEditError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meals"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => {
      setEditError(error instanceof Error ? error.message : "Failed to delete meal.");
    },
  });

  const selectedMeal = meals.find((meal) => meal.id === selectedMealId) ?? null;
  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const summaryDateLabel = appliedDate || "Today";

  const handleApplyDate = () => {
    setAppliedDate(dateInput.trim());
    setSelectedMealId(null);
  };

  const handleClearDate = () => {
    setDateInput("");
    setAppliedDate("");
    setSelectedMealId(null);
  };

  const handleSave = async () => {
    if (!selectedMealId) return;
    if (!editDescription.trim()) {
      setEditError("Description is required.");
      return;
    }
    if (!Number.isInteger(Number(editCalories.trim()))) {
      setEditError("Calories must be a whole number.");
      return;
    }

    if (isWebPreview) {
      setEditError(null);
      setEditSuccess("Preview updated.");
      return;
    }

    await updateMealMutation.mutateAsync();
  };

  const handleDelete = () => {
    if (isWebPreview) {
      setSelectedMealId(null);
      return;
    }
    Alert.alert("Delete meal", "This will permanently delete the meal.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteMealMutation.mutateAsync() },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Meals</Text>
          <Text style={styles.subtitle}>Review and edit your recent entries.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{summaryDateLabel}</Text>
            <Text style={styles.summaryValue}>{totalCalories.toLocaleString("en-US")}</Text>
            <Text style={styles.summaryMeta}>calories logged</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Entries</Text>
            <Text style={styles.summaryValue}>{meals.length}</Text>
            <Text style={styles.summaryMeta}>recent meals</Text>
          </View>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Date filter (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.filterInput}
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="Optional date filter"
            placeholderTextColor={COLORS.textTertiary}
            autoCapitalize="none"
          />
          <View style={styles.filterActions}>
            <Pressable style={styles.filterPrimary} onPress={handleApplyDate}>
              <Text style={styles.filterPrimaryText}>Apply</Text>
            </Pressable>
            <Pressable style={styles.filterSecondary} onPress={handleClearDate}>
              <Text style={styles.filterSecondaryText}>Clear</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Meals</Text>
            {mealsQuery.isLoading && !isWebPreview ? <ActivityIndicator size="small" /> : null}
          </View>

          {meals.map((meal) => {
            const selected = meal.id === selectedMealId;
            return (
              <Pressable
                key={meal.id}
                style={[styles.mealRow, selected ? styles.mealRowSelected : null]}
                onPress={() => setSelectedMealId(selected ? null : meal.id)}
              >
                <View style={styles.mealLeft}>
                  <MealGlyph description={meal.description} />
                  <View style={styles.mealCopy}>
                    <Text style={styles.mealTitle}>{meal.description}</Text>
                    <Text style={styles.mealMeta}>
                      {meal.mealType} · {formatMealTime(meal.eatenAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.mealRight}>
                  <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
                  <ChevronGlyph />
                </View>
              </Pressable>
            );
          })}

          {!meals.length && !mealsQuery.isLoading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No meals yet</Text>
              <Text style={styles.emptyBody}>
                Log something from Home to see it here, then come back to edit the details.
              </Text>
            </View>
          ) : null}
        </View>

        {selectedMeal ? (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Edit Meal</Text>
            <TextInput
              style={styles.detailInput}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Meal description"
              placeholderTextColor={COLORS.textTertiary}
            />
            <TextInput
              style={styles.detailInput}
              value={editCalories}
              onChangeText={(value) => setEditCalories(value.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              placeholder="Calories"
              placeholderTextColor={COLORS.textTertiary}
            />
            <View style={styles.typeRow}>
              {mealTypes.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeChip, editMealType === type ? styles.typeChipActive : null]}
                  onPress={() => setEditMealType(type)}
                >
                  <Text style={[styles.typeChipText, editMealType === type ? styles.typeChipTextActive : null]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
            {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
            {editSuccess ? <Text style={styles.successText}>{editSuccess}</Text> : null}
            <View style={styles.detailActions}>
              <Pressable style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.saveButton,
                  updateMealMutation.isPending ? styles.saveButtonDisabled : null,
                ]}
                onPress={() => void handleSave()}
                disabled={updateMealMutation.isPending}
              >
                <Text style={styles.saveButtonText}>
                  {updateMealMutation.isPending ? "Saving..." : "Save Meal"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 96,
  },
  header: {
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  summaryMeta: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  filterCard: {
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 16,
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  filterInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  filterPrimary: {
    borderRadius: 12,
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  filterSecondary: {
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  listSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  mealRowSelected: {
    borderWidth: 1,
    borderColor: COLORS.blue,
  },
  mealLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  mealCopy: {
    flex: 1,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  mealMeta: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  mealRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  mealCalories: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  detailCard: {
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    padding: 18,
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  detailInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  typeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.bg,
  },
  typeChipActive: {
    backgroundColor: COLORS.textPrimary,
    borderColor: COLORS.textPrimary,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textTransform: "capitalize",
  },
  typeChipTextActive: {
    color: "#FFFFFF",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.error,
    marginTop: 6,
  },
  successText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#047857",
    marginTop: 6,
  },
  detailActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  deleteButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.error,
  },
  saveButton: {
    flex: 1.6,
    borderRadius: 14,
    backgroundColor: COLORS.textPrimary,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyCard: {
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
});
