import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { FloatingCommandBar } from "../../components/FloatingCommandBar";
import { useCommandCenter, toLocalDateString } from "../../components/command-center";
import { apiRequest } from "../../lib/api-client";
import { color as token, font, radius as r } from "../../lib/tokens";

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

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const SAMPLE_MEALS: MealItem[] = [
  {
    id: "meal-preview-1",
    userId: "preview",
    eatenAt: new Date().toISOString(),
    mealType: "lunch",
    description: "Chicken caesar",
    transcriptRaw: null,
    calories: 520,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "meal-preview-2",
    userId: "preview",
    eatenAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    mealType: "breakfast",
    description: "Oats, blueberries, whey",
    transcriptRaw: null,
    calories: 420,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "meal-preview-3",
    userId: "preview",
    eatenAt: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    mealType: "dinner",
    description: "Grilled salmon, rice",
    transcriptRaw: null,
    calories: 620,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function getLastSevenDaysEndingToday() {
  const today = new Date();
  const items: { date: string; dayNum: string; dayLabel: string }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    items.push({
      date: toLocalDateString(d),
      dayNum: String(d.getDate()),
      dayLabel: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1).toUpperCase(),
    });
  }
  return items;
}

function ChevronGlyph() {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none">
      <Path
        d="M1 1L7 7L1 13"
        stroke={token.textMute}
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
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatHeaderDate(date: string) {
  const today = toLocalDateString(new Date());
  if (date === today) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === toLocalDateString(yesterday)) return "Yesterday";
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function MealsScreen() {
  const cc = useCommandCenter();
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const isWebPreview = __DEV__ && Platform.OS === "web";

  const today = toLocalDateString(new Date());
  const dayOptions = useMemo(() => getLastSevenDaysEndingToday(), [today]);

  const [filterMode, setFilterMode] = useState<"all" | "date">("all");
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editCalories, setEditCalories] = useState("");
  const [editMealType, setEditMealType] = useState<MealType>("breakfast");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const appliedDate = filterMode === "date" ? selectedDate : "";

  const mealsQuery = useQuery({
    queryKey: ["meals", appliedDate],
    enabled: !isWebPreview && !!isSignedIn,
    queryFn: async () => {
      const t = await getToken();
      if (!t) throw new Error("Not signed in");
      const query = new URLSearchParams({ limit: "50", offset: "0" });
      if (appliedDate) query.set("date", appliedDate);
      return apiRequest<MealsListResponse>(`/api/meals?${query.toString()}`, { token: t });
    },
  });

  const meals = isWebPreview ? SAMPLE_MEALS : mealsQuery.data?.meals ?? [];

  useEffect(() => {
    setEditError(null);
    setEditSuccess(null);
    if (!selectedMealId || !meals.length) return;
    const sel = meals.find((m) => m.id === selectedMealId);
    if (!sel) return;
    setEditDescription(sel.description);
    setEditCalories(String(sel.calories));
    setEditMealType(sel.mealType);
  }, [meals, selectedMealId]);

  const updateMealMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMealId) throw new Error("Select a meal first");
      const t = await getToken();
      if (!t) throw new Error("Not signed in");
      return apiRequest<MealItem>(`/api/meals/${selectedMealId}`, {
        method: "PUT",
        token: t,
        body: JSON.stringify({
          description: editDescription.trim(),
          calories: Number(editCalories.trim()),
          mealType: editMealType,
        }),
      });
    },
    onSuccess: async () => {
      Keyboard.dismiss();
      setEditError(null);
      setEditSuccess("Meal updated.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meals"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setSelectedMealId(null);
    },
    onError: (error) => {
      setEditSuccess(null);
      setEditError(error instanceof Error ? error.message : "Failed to update meal.");
    },
  });

  const deleteMealMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMealId) throw new Error("Select a meal first");
      const t = await getToken();
      if (!t) throw new Error("Not signed in");
      return apiRequest<{ deleted: boolean }>(`/api/meals/${selectedMealId}`, {
        method: "DELETE",
        token: t,
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

  const grouped = useMemo(() => {
    const map = new Map<string, MealItem[]>();
    for (const m of meals) {
      const key = toLocalDateString(new Date(m.eatenAt));
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [meals]);

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);

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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Meals</Text>
          <Text style={styles.title}>Log</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>Calories</Text>
            <Text style={styles.statValue}>{totalCalories.toLocaleString()}</Text>
            <Text style={styles.statSub}>kcal</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>Entries</Text>
            <Text style={styles.statValue}>{meals.length}</Text>
            <Text style={styles.statSub}>{filterMode === "date" ? "this day" : "recent"}</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, filterMode === "all" && styles.filterChipActive]}
            onPress={() => {
              setFilterMode("all");
              setSelectedMealId(null);
            }}
          >
            <Text style={[styles.filterChipText, filterMode === "all" && styles.filterChipTextActive]}>
              All
            </Text>
          </Pressable>
          {dayOptions.map((day) => {
            const active = filterMode === "date" && selectedDate === day.date;
            return (
              <Pressable
                key={day.date}
                style={[styles.dayItem, active && styles.dayItemActive]}
                onPress={() => {
                  setFilterMode("date");
                  setSelectedDate(day.date);
                  setSelectedMealId(null);
                }}
              >
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day.dayLabel}</Text>
                <Text style={[styles.dayNum, active && styles.dayNumActive]}>{day.dayNum}</Text>
              </Pressable>
            );
          })}
        </View>

        {mealsQuery.isLoading && !isWebPreview ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={token.accent} />
          </View>
        ) : null}

        {!meals.length && !mealsQuery.isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No meals yet</Text>
            <Text style={styles.emptyBody}>
              Hold the mic below to log a meal. It’ll appear here so you can edit or delete it.
            </Text>
          </View>
        ) : null}

        {grouped.map(([date, items]) => (
          <View key={date} style={styles.daySection}>
            <Text style={styles.dayHeading}>{formatHeaderDate(date)}</Text>
            <View style={styles.mealsCard}>
              {items.map((meal, idx) => {
                const isSelected = meal.id === selectedMealId;
                return (
                  <Pressable
                    key={meal.id}
                    onPress={() => setSelectedMealId(isSelected ? null : meal.id)}
                    style={[
                      styles.mealRow,
                      idx > 0 ? styles.mealRowDivider : null,
                      isSelected ? styles.mealRowSelected : null,
                    ]}
                  >
                    <Text style={styles.mealTime}>{formatMealTime(meal.eatenAt)}</Text>
                    <View style={styles.mealCopy}>
                      <Text style={styles.mealName} numberOfLines={1}>{meal.description}</Text>
                      <Text style={styles.mealMeta}>{meal.mealType}</Text>
                    </View>
                    <View style={styles.mealKcalRow}>
                      <Text style={styles.mealKcalNum}>{meal.calories}</Text>
                      <Text style={styles.mealKcalUnit}>kcal</Text>
                    </View>
                    <View style={styles.mealChevron}>
                      <ChevronGlyph />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {selectedMealId ? (
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Edit meal</Text>
            <TextInput
              style={styles.editInput}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Meal description"
              placeholderTextColor={token.textMute}
            />
            <TextInput
              style={styles.editInput}
              value={editCalories}
              onChangeText={(v) => setEditCalories(v.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              placeholder="Calories"
              placeholderTextColor={token.textMute}
            />
            <View style={styles.typeRow}>
              {MEAL_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeChip, editMealType === type && styles.typeChipActive]}
                  onPress={() => setEditMealType(type)}
                >
                  <Text style={[styles.typeChipText, editMealType === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
            {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
            {editSuccess ? <Text style={styles.successText}>{editSuccess}</Text> : null}
            <View style={styles.editActions}>
              <Pressable style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, updateMealMutation.isPending && styles.saveButtonDisabled]}
                onPress={() => void handleSave()}
                disabled={updateMealMutation.isPending}
              >
                <Text style={styles.saveButtonText}>
                  {updateMealMutation.isPending ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <FloatingCommandBar
        hint='"Had pasta for lunch…"'
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
  header: {
    paddingBottom: 20,
  },
  eyebrow: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.76,
    textTransform: "uppercase",
    color: token.textMute,
  },
  title: {
    marginTop: 2,
    fontFamily: font.sans[600],
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.65,
    color: token.text,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statPill: {
    flex: 1,
    borderRadius: r.sm,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statLabel: {
    fontFamily: font.sans[600],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.52,
    textTransform: "uppercase",
    color: token.textMute,
  },
  statValue: {
    marginTop: 4,
    fontFamily: font.mono[500],
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: -0.66,
    color: token.text,
  },
  statSub: {
    marginTop: 2,
    fontFamily: font.sans[400],
    fontSize: 10.5,
    color: token.textMute,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 18,
  },
  filterChip: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: token.accent,
    borderColor: "transparent",
  },
  filterChipText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    fontWeight: "600",
    color: token.textSoft,
  },
  filterChipTextActive: {
    color: token.accentInk,
  },
  dayItem: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
  },
  dayItemActive: {
    backgroundColor: token.accent,
    borderColor: "transparent",
  },
  dayLabel: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: token.textMute,
  },
  dayLabelActive: {
    color: token.accentInk,
  },
  dayNum: {
    marginTop: 3,
    fontFamily: font.mono[500],
    fontSize: 16,
    fontWeight: "500",
    color: token.text,
  },
  dayNumActive: {
    color: token.accentInk,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
  daySection: {
    marginBottom: 18,
  },
  dayHeading: {
    paddingBottom: 10,
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.text,
  },
  mealsCard: {
    backgroundColor: token.surface,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: token.line,
    overflow: "hidden",
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  mealRowDivider: {
    borderTopWidth: 1,
    borderTopColor: token.line,
  },
  mealRowSelected: {
    backgroundColor: "rgba(199,251,65,0.06)",
  },
  mealTime: {
    width: 44,
    fontFamily: font.mono[400],
    fontSize: 11,
    color: token.textMute,
  },
  mealCopy: {
    flex: 1,
  },
  mealName: {
    fontFamily: font.sans[500],
    fontSize: 14,
    fontWeight: "500",
    color: token.text,
  },
  mealMeta: {
    marginTop: 2,
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.84,
    textTransform: "uppercase",
    color: token.textMute,
  },
  mealKcalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  mealKcalNum: {
    fontFamily: font.mono[500],
    fontSize: 15,
    fontWeight: "500",
    color: token.text,
  },
  mealKcalUnit: {
    fontFamily: font.sans[400],
    fontSize: 10,
    color: token.textMute,
  },
  mealChevron: {
    marginLeft: 6,
  },
  emptyCard: {
    borderRadius: r.md,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    padding: 18,
    gap: 6,
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: font.sans[600],
    fontSize: 16,
    fontWeight: "600",
    color: token.text,
    letterSpacing: -0.16,
  },
  emptyBody: {
    fontFamily: font.sans[400],
    fontSize: 13,
    lineHeight: 19,
    color: token.textSoft,
  },
  editCard: {
    marginTop: 4,
    borderRadius: r.md,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    padding: 16,
  },
  editTitle: {
    fontFamily: font.sans[600],
    fontSize: 15,
    fontWeight: "600",
    color: token.text,
    letterSpacing: -0.15,
    marginBottom: 12,
  },
  editInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: token.line,
    backgroundColor: token.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.sans[400],
    fontSize: 14,
    color: token.text,
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
    borderColor: token.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  typeChipActive: {
    backgroundColor: token.accent,
    borderColor: "transparent",
  },
  typeChipText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    fontWeight: "600",
    color: token.textSoft,
    textTransform: "capitalize",
  },
  typeChipTextActive: {
    color: token.accentInk,
  },
  errorText: {
    fontFamily: font.sans[600],
    fontSize: 12.5,
    fontWeight: "600",
    color: token.negative,
    marginTop: 6,
  },
  successText: {
    fontFamily: font.sans[600],
    fontSize: 12.5,
    fontWeight: "600",
    color: token.positive,
    marginTop: 6,
  },
  editActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  deleteButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: token.bg,
    borderWidth: 1,
    borderColor: token.line,
    paddingVertical: 13,
    alignItems: "center",
  },
  deleteButtonText: {
    fontFamily: font.sans[600],
    fontSize: 14,
    fontWeight: "600",
    color: token.negative,
  },
  saveButton: {
    flex: 1.6,
    borderRadius: 12,
    backgroundColor: token.accent,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    color: token.accentInk,
    letterSpacing: 0.28,
  },
});
