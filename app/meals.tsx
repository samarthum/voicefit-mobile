import { useScreenTiming } from "@/hooks/use-screen-timing";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,

  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { FloatingCommandBar } from "@/components/FloatingCommandBar";
import { useCommandCenter, toLocalDateString } from "@/components/command-center";
import { initialMealDate } from "@/lib/meal-history";
import { apiRequest } from "@/lib/api-client";
import { isWebPreviewMode } from "@/lib/web-preview-mode";
import {
  type AsyncMealStatus,
  formatNullableCalories,
  isFiniteNumber,
  normalizeMealStatus,
} from "@/lib/meal-status";
import { color as token, font, radius as r } from "@/lib/tokens";
import { haptic } from "@/lib/haptics";
import { Icon } from "@/components/Icon";
import { MealStatusBadge } from "@/components/dashboard/MealStatusBadge";
import { useAppPrompt } from "@/components/AppPrompt";

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

function getLastSevenDaysEndingToday(endDate: string) {
  const today = new Date(`${endDate}T12:00:00`);
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


function formatMealTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const MEAL_TYPE_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

// Header pair: "Today" / "Yesterday" / weekday over "October 5".
function formatDateTitle(date: string) {
  const relative = formatHeaderDate(date);
  if (relative === "Today" || relative === "Yesterday") return relative;
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
}

function formatMonthDay(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
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
  const params = useLocalSearchParams<{ date?: string }>();
  const [selectedDate, setSelectedDate] = useState(
    initialMealDate(params.date, today),
  );
  const [weekEnd, setWeekEnd] = useState(today);
  const dayOptions = useMemo(() => getLastSevenDaysEndingToday(weekEnd), [weekEnd]);
  const moveWeek = (direction: number) => {
    const date = new Date(`${weekEnd}T12:00:00`);
    date.setDate(date.getDate() + direction * 7);
    const end = toLocalDateString(date);
    setWeekEnd(end);
    setSelectedDate(end);
  };

  const mealsQuery = useInfiniteQuery({
    queryKey: ["meals", "by-day", selectedDate],
    initialPageParam: 0,
    enabled: !isWebPreview && !!isSignedIn,
    queryFn: async ({ pageParam }) => {
      const t = await getToken();
      if (!t) throw new Error("Not signed in");
      // The API filters UTC calendar dates. Fetch the UTC dates surrounding
      // this local day, then apply the exact local-day filter below.
      const start = new Date(`${selectedDate}T00:00:00`);
      const end = new Date(`${selectedDate}T23:59:59.999`);
      const query = new URLSearchParams({ limit: "50", offset: String(pageParam), startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) });
      return apiRequest<MealsListResponse>(`/api/meals?${query}`, { token: t });
    },
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.meals.length, 0);
      return lastPage.meals.length > 0 && loaded < lastPage.total ? loaded : undefined;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPending = data?.pages.some((page) => page.meals.some(
        (m) => m.interpretationStatus === "interpreting",
      ));
      return hasPending ? 2000 : false;
    },
  });

  const allMeals = isWebPreview ? SAMPLE_MEALS : mealsQuery.data?.pages.flatMap((page) => page.meals) ?? [];
  const prompt = useAppPrompt([selectedDate, isSignedIn, allMeals.map(meal => meal.id).join("\n")]);

  useScreenTiming("meals", !!mealsQuery.data, mealsQuery.isError);

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
  });

  const effectiveDate = selectedDate;

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
  const totals = meals.reduce(
    (acc, m) => ({
      protein: acc.protein + (isFiniteNumber(m.proteinG) ? m.proteinG : 0),
      carbs: acc.carbs + (isFiniteNumber(m.carbsG) ? m.carbsG : 0),
      fat: acc.fat + (isFiniteNumber(m.fatG) ? m.fatG : 0),
    }),
    { protein: 0, carbs: 0, fat: 0 },
  );

  const handleOpenMeal = (mealId: string) => {
    if (isWebPreview) return;
    haptic.tap();
    router.push({ pathname: "/meal-edit/[id]", params: { id: mealId } });
  };

  const handleDeleteMeal = (mealId: string) => {
    if (isWebPreview || deleteMutation.isPending) return;
    haptic.warning();
    prompt.alert("Delete meal?", "It will be removed from your log.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete meal", style: "destructive", onPress: () => deleteMutation.mutateAsync(mealId) },
    ]);
  };

  return (
    <View style={styles.root}>
      {prompt.dialog}
      <Stack.Screen options={{ headerShown: true, title: "Meals" }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.dateHeader}>
          <View style={styles.dateCopy}>
            <Text style={styles.dateTitle} accessibilityRole="header">{formatDateTitle(effectiveDate)}</Text>
            <Text style={styles.dateSub}>{formatMonthDay(effectiveDate)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous week" hitSlop={6} onPress={() => moveWeek(-1)} style={({ pressed }) => [styles.weekButton, pressed && styles.pressed]}>
            <Icon name="chevronLeft" size={16} color={token.textSoft} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next week" accessibilityState={{ disabled: weekEnd >= today }} disabled={weekEnd >= today} hitSlop={6} onPress={() => moveWeek(1)} style={({ pressed }) => [styles.weekButton, weekEnd >= today ? styles.disabled : pressed && styles.pressed]}>
            <Icon name="chevronRight" size={16} color={token.textSoft} />
          </Pressable>
        </View>
        <View style={styles.filterRow}>
          {dayOptions.map((day) => {
            const active = effectiveDate === day.date;
            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                accessibilityState={{ selected: active }}
                style={[styles.dayItem, active && styles.dayItemActive]}
                onPress={() => { if (!active) haptic.selection(); setSelectedDate(day.date); }}
              >
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day.dayLabel}</Text>
                <Text style={[styles.dayNum, active && styles.dayNumActive]}>{day.dayNum}</Text>
              </Pressable>
            );
          })}
        </View>

        {meals.length > 0 ? (
          <View style={styles.summaryCard} testID="meals-day-summary">
            <View style={styles.summaryTop}>
              <View style={styles.summaryKcal}>
                <Text style={styles.summaryValue} selectable>{totalCalories.toLocaleString()}</Text>
                <Text style={styles.summaryUnit}>kcal</Text>
              </View>
              <Text style={styles.summaryCount}>{meals.length} {meals.length === 1 ? "meal" : "meals"}</Text>
            </View>
            <View style={styles.macroRow}>
              {([["Protein", totals.protein], ["Carbs", totals.carbs], ["Fat", totals.fat]] as const).map(([label, grams]) => (
                <View key={label} style={styles.macroCell}>
                  <Text style={styles.macroLabel}>{label}</Text>
                  <Text style={styles.macroValue}>{Math.round(grams)}<Text style={styles.macroUnit}>g</Text></Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {mealsQuery.isLoading && !isWebPreview ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={token.accent} />
          </View>
        ) : null}

        {mealsQuery.isError && !isWebPreview ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Couldn’t load meals</Text>
            <Text style={styles.errorBody} selectable>
              {mealsQuery.error instanceof Error ? mealsQuery.error.message : "Please try again."}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => void mealsQuery.refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!meals.length && !mealsQuery.isLoading && !mealsQuery.isError && !mealsQuery.hasNextPage ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon name="restaurant" size={20} color={token.accent} />
            </View>
            <Text style={styles.emptyTitle}>{effectiveDate === today ? "Nothing logged yet" : "No meals this day"}</Text>
            <Text style={styles.emptyBody}>
              {effectiveDate === today ? "Say, type or snap a meal with the bar below." : "Meals you log for this day will show up here."}
            </Text>
          </View>
        ) : null}

        {grouped.map(([date, items]) => (
          <View key={date} style={styles.daySection}>
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
                    <View style={styles.mealCopy}>
                      <Text style={styles.mealName} numberOfLines={2}>{meal.description}</Text>
                      <View style={styles.mealMetaRow}>
                        {status !== "interpreting" ? (
                          <Text style={styles.mealMeta} numberOfLines={1}>
                            {MEAL_TYPE_LABEL[meal.mealType] ?? meal.mealType} · {formatMealTime(meal.eatenAt)}
                          </Text>
                        ) : null}
                        <View style={styles.mealBadge}>
                          <MealStatusBadge status={status} />
                        </View>
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
                            <Text style={styles.mealKcalPending} selectable>--</Text>
                          ) : (
                            <>
                              <Text style={styles.mealKcalNum} selectable>{calories}</Text>
                              <Text style={styles.mealKcalUnit}>kcal</Text>
                            </>
                          )}
                        </View>
                      )}
                      <View style={styles.mealChevron}>
                        <Icon name="chevronRight" size={14} color={token.textMute} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {!mealsQuery.isLoading ? (
          <Pressable
            testID="meals-repeat-open"
            accessibilityRole="button"
            accessibilityLabel="Repeat a meal"
            accessibilityHint="Re-log a saved meal without a new estimate"
            style={({ pressed }) => [styles.repeatCard, pressed && styles.pressed]}
            onPress={() => { haptic.tap(); router.push({ pathname: "/meal-repeat" }); }}
          >
            <View style={styles.repeatIcon}>
              <Icon name="repeat" size={18} color={token.accent} />
            </View>
            <View style={styles.repeatCopy}>
              <Text style={styles.repeatTitle}>Repeat a meal</Text>
              <Text style={styles.repeatBody}>Re-log something you've had before</Text>
            </View>
            <Icon name="chevronRight" size={16} color={token.textMute} />
          </Pressable>
        ) : null}

        {mealsQuery.hasNextPage ? (
          <Pressable accessibilityRole="button" disabled={mealsQuery.isFetchingNextPage} style={styles.retryButton} onPress={() => void mealsQuery.fetchNextPage()}>
            <Text style={styles.retryButtonText}>{mealsQuery.isFetchingNextPage ? "Loading…" : "Load more meals"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <FloatingCommandBar
        hint='Log a meal for today…'
        safeAreaBottom
        onPress={() => cc.open()}
        onMicPress={() => cc.startRecording()}
        onPhotoPress={() => void cc.openPhoto()}
      />
    </View>
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
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.35 },
  dateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  dateCopy: { flex: 1, minWidth: 0 },
  dateTitle: { fontFamily: font.sans[700], fontSize: 24, fontWeight: "700", letterSpacing: -0.5, color: token.text },
  dateSub: { marginTop: 1, fontFamily: font.sans[400], fontSize: 13, color: token.textMute },
  weekButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: r.pill,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
  },
  summaryCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: r.md,
    borderCurve: "continuous",
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
  },
  summaryTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  summaryKcal: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  summaryValue: { fontFamily: font.mono[500], fontSize: 30, fontWeight: "500", letterSpacing: -1, color: token.text },
  summaryUnit: { fontFamily: font.sans[500], fontSize: 14, color: token.textMute },
  summaryCount: { fontFamily: font.sans[500], fontSize: 13, color: token.textSoft },
  macroRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: token.line,
    flexDirection: "row",
  },
  macroCell: { flex: 1 },
  macroLabel: { fontFamily: font.sans[500], fontSize: 12, color: token.textMute },
  macroValue: { marginTop: 2, fontFamily: font.mono[500], fontSize: 16, fontWeight: "500", color: token.text },
  macroUnit: { fontFamily: font.sans[400], fontSize: 12, color: token.textMute },
  repeatCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: r.md,
    borderCurve: "continuous",
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
  },
  repeatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: token.accentTintBg,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatCopy: { flex: 1, minWidth: 0 },
  repeatTitle: { fontFamily: font.sans[600], fontSize: 15, fontWeight: "600", color: token.text },
  repeatBody: { marginTop: 1, fontFamily: font.sans[400], fontSize: 13, color: token.textMute },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: token.accentTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
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
    borderCurve: "continuous",
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
    marginBottom: 12,
  },
  mealsCard: {
    backgroundColor: token.surface,
    borderRadius: r.md,
    borderCurve: "continuous",
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
  mealCopy: {
    flex: 1,
    minWidth: 0,
  },
  mealName: {
    fontFamily: font.sans[500],
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: token.text,
  },
  mealBadge: { flexShrink: 0 },
  mealMetaRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  mealMeta: {
    fontFamily: font.sans[400],
    fontSize: 12.5,
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
    borderCurve: "continuous",
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 6,
    marginBottom: 12,
    alignItems: "center",
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
    textAlign: "center",
  },
  errorCard: {
    borderRadius: r.md,
    borderCurve: "continuous",
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    padding: 18,
    gap: 8,
    marginBottom: 18,
    alignItems: "center",
  },
  errorTitle: {
    fontFamily: font.sans[600],
    fontSize: 16,
    fontWeight: "600",
    color: token.text,
    letterSpacing: -0.16,
  },
  errorBody: {
    fontFamily: font.sans[400],
    fontSize: 13,
    lineHeight: 19,
    color: token.textSoft,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: token.accent,
  },
  retryButtonText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: token.accentInk,
  },
});
