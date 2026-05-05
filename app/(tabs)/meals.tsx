import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { FloatingCommandBar } from "../../components/FloatingCommandBar";
import { useCommandCenter, toLocalDateString } from "../../components/command-center";
import { apiRequest } from "../../lib/api-client";
import { isWebPreviewMode } from "../../lib/web-preview-mode";
import {
  type AsyncMealStatus,
  formatNullableCalories,
  isFiniteNumber,
  normalizeMealStatus,
} from "../../lib/meal-status";
import { color as token, font, radius as r } from "../../lib/tokens";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface MealItem {
  id: string;
  userId: string;
  eatenAt: string;
  mealType: MealType;
  description: string;
  transcriptRaw: string | null;
  calories: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  interpretationStatus?: AsyncMealStatus | "pending" | "error" | null;
  errorMessage?: string | null;
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
    description: "Chicken caesar",
    transcriptRaw: null,
    calories: 520,
    interpretationStatus: "reviewed",
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
    interpretationStatus: "needs_review",
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
    interpretationStatus: "reviewed",
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

function MealStatusBadge({ status }: { status: AsyncMealStatus }) {
  if (status === "reviewed") return null;
  const label =
    status === "interpreting"
      ? "Estimating"
      : status === "needs_review"
      ? "Review estimate"
      : "Failed";
  return (
    <View
      style={[
        styles.statusBadge,
        status === "failed" ? styles.statusBadgeFailed : null,
      ]}
    >
      {status === "interpreting" ? (
        <ActivityIndicator size="small" color={token.textMute} style={styles.statusSpinner} />
      ) : null}
      <Text
        style={[
          styles.statusBadgeText,
          status === "failed" ? styles.statusBadgeTextFailed : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
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
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const isWebPreview = isWebPreviewMode();

  const today = toLocalDateString(new Date());
  const dayOptions = useMemo(() => getLastSevenDaysEndingToday(), [today]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const mealsQuery = useQuery({
    queryKey: ["meals", "recent"],
    enabled: !isWebPreview && !!isSignedIn,
    queryFn: async () => {
      const t = await getToken();
      if (!t) throw new Error("Not signed in");
      return apiRequest<MealsListResponse>("/api/meals?limit=50&offset=0", { token: t });
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPending = data?.meals?.some(
        (m) => m.interpretationStatus === "interpreting",
      );
      return hasPending ? 2000 : false;
    },
  });

  const allMeals = isWebPreview ? SAMPLE_MEALS : mealsQuery.data?.meals ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (mealId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<{ deleted: boolean }>(`/api/meals/${mealId}`, {
        method: "DELETE",
        token,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meals"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => {
      Alert.alert(
        "Could not delete meal",
        error instanceof Error ? error.message : "Please try again.",
      );
    },
  });

  useEffect(() => {
    if (selectedDate !== null) return;
    if (!isWebPreview && mealsQuery.isLoading) return;
    const datesWithMeals = new Set(
      allMeals.map((m) => toLocalDateString(new Date(m.eatenAt))),
    );
    if (datesWithMeals.has(today)) {
      setSelectedDate(today);
      return;
    }
    const fallback = dayOptions
      .map((d) => d.date)
      .reverse()
      .find((d) => d !== today && datesWithMeals.has(d));
    setSelectedDate(fallback ?? today);
  }, [selectedDate, isWebPreview, mealsQuery.isLoading, allMeals, today, dayOptions]);

  const effectiveDate = selectedDate ?? today;

  const meals = useMemo(
    () => allMeals.filter((m) => toLocalDateString(new Date(m.eatenAt)) === effectiveDate),
    [allMeals, effectiveDate],
  );

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

  const totalCalories = meals.reduce((sum, m) => sum + (isFiniteNumber(m.calories) ? m.calories : 0), 0);

  const handleOpenMeal = (mealId: string) => {
    if (isWebPreview) return;
    router.push({ pathname: "/meal-edit/[id]", params: { id: mealId } });
  };

  const handleDeleteMeal = (mealId: string) => {
    if (isWebPreview || deleteMutation.isPending) return;
    Alert.alert("Delete meal", "This will permanently delete the meal.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(mealId) },
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
            <Text style={styles.statSub}>this day</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {dayOptions.map((day) => {
            const active = effectiveDate === day.date;
            return (
              <Pressable
                key={day.date}
                style={[styles.dayItem, active && styles.dayItemActive]}
                onPress={() => setSelectedDate(day.date)}
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
                const status = normalizeMealStatus(meal.interpretationStatus, meal.calories);
                const calories = formatNullableCalories(meal.calories);
                return (
                  <Pressable
                    key={meal.id}
                    onPress={() => handleOpenMeal(meal.id)}
                    style={[styles.mealRow, idx > 0 ? styles.mealRowDivider : null]}
                    testID={`meals-row-${meal.id}`}
                  >
                    <Text style={styles.mealTime}>{formatMealTime(meal.eatenAt)}</Text>
                    <View style={styles.mealCopy}>
                      <Text style={styles.mealName} numberOfLines={1}>{meal.description}</Text>
                      <View style={styles.mealMetaRow}>
                        {status !== "interpreting" ? (
                          <Text style={styles.mealMeta} numberOfLines={1}>{meal.mealType}</Text>
                        ) : null}
                        <MealStatusBadge status={status} />
                      </View>
                    </View>
                    <View style={styles.mealTrailing}>
                      {status === "failed" ? (
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            handleDeleteMeal(meal.id);
                          }}
                          hitSlop={8}
                          style={styles.failedDeleteButton}
                          testID={`meals-delete-${meal.id}`}
                        >
                          <Text style={styles.failedDeleteText}>
                            {deleteMutation.isPending ? "..." : "Delete"}
                          </Text>
                        </Pressable>
                      ) : (
                        <View style={styles.mealKcalRow}>
                          {status === "interpreting" || calories == null ? (
                            <Text style={styles.mealKcalPending}>--</Text>
                          ) : (
                            <>
                              <Text style={styles.mealKcalNum}>{calories}</Text>
                              <Text style={styles.mealKcalUnit}>kcal</Text>
                            </>
                          )}
                        </View>
                      )}
                      <View style={styles.mealChevron}>
                        <ChevronGlyph />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
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
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  mealRowDivider: {
    borderTopWidth: 1,
    borderTopColor: token.line,
  },
  mealTime: {
    width: 42,
    fontFamily: font.mono[400],
    fontSize: 11,
    color: token.textMute,
  },
  mealCopy: {
    flex: 1,
    minWidth: 0,
  },
  mealName: {
    fontFamily: font.sans[500],
    fontSize: 14,
    fontWeight: "500",
    color: token.text,
  },
  mealMetaRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  mealMeta: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.84,
    textTransform: "uppercase",
    color: token.textMute,
    flexShrink: 1,
  },
  mealTrailing: {
    width: 104,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  mealKcalRow: {
    width: 76,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "flex-end",
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
  mealKcalPending: {
    fontFamily: font.mono[500],
    fontSize: 15,
    fontWeight: "500",
    color: token.textMute,
  },
  mealChevron: {
    width: 8,
    alignItems: "center",
  },
  statusBadge: {
    maxWidth: 104,
    minHeight: 20,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: token.line,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  statusBadgeFailed: {
    borderColor: token.negative,
  },
  statusSpinner: {
    transform: [{ scale: 0.65 }],
    marginHorizontal: -3,
  },
  statusBadgeText: {
    fontFamily: font.sans[600],
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.35,
    textTransform: "uppercase",
    color: token.textMute,
    flexShrink: 1,
  },
  statusBadgeTextFailed: {
    color: token.negative,
  },
  failedDeleteButton: {
    minWidth: 54,
    minHeight: 28,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: token.negative,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  failedDeleteText: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    color: token.negative,
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
});
