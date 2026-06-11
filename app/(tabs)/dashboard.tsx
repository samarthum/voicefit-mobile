import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { DashboardData } from "@voicefit/contracts/types";
import { apiRequest } from "@/lib/api-client";
import { FloatingCommandBar } from "@/components/FloatingCommandBar";
import { useCommandCenter, COLORS, toLocalDateString } from "@/components/command-center";
import { getErrorMessage } from "@/components/command-center/helpers";
import { color as token, font, radius as r } from "@/lib/tokens";
import { isWebPreviewMode } from "@/lib/web-preview-mode";
import { Wordmark, LoadingBlock, OfflineBanner } from "@/components/pulse";
import NetInfo from "@react-native-community/netinfo";
import {
  type AsyncMealStatus,
  formatNullableCalories,
  normalizeMealStatus,
} from "@/lib/meal-status";
import {
  type TrendMetric,
  safeNumber,
  buildLinePaths,
  metricValueFromPoint,
} from "@/lib/trends";
import { haptic } from "@/lib/haptics";
import { Icon } from "@/components/Icon";
import { formatCompact } from "@/lib/format";
import {
  CalorieRing,
  WeightSparkline,
  StepsTrendIcon,
  CoachBadge,
  MacroBar,
  MealStatusBadge,
  DayPicker,
} from "@/components/dashboard";

type RecentMeal = Omit<DashboardData["recentMeals"][number], "calories"> & {
  calories: number | null;
  interpretationStatus?: AsyncMealStatus | "pending" | "error" | null;
  errorMessage?: string | null;
};
type DashboardToday = DashboardData["today"] & { proteinGoal?: number };
type DashboardHomeData = Omit<DashboardData, "recentMeals" | "today"> & {
  today: DashboardToday;
  recentMeals: RecentMeal[];
};

const DEFAULT_WEIGHT_GOAL = 70;

function parseDateKey(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getLastSevenDaysEndingToday() {
  const today = new Date();
  const items: { date: string; dayNum: string; dayLabel: string }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayLabel = d
      .toLocaleDateString("en-US", { weekday: "short" })
      .slice(0, 1)
      .toUpperCase();
    items.push({
      date: toLocalDateString(d),
      dayNum: String(d.getDate()),
      dayLabel,
    });
  }
  return items;
}

function formatTrendDay(date: string) {
  return parseDateKey(date).toLocaleDateString("en-US", { weekday: "short" });
}

function progressPercent(current: number, goal: number) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(1, current / goal));
}

function mockDashboardData(selectedDate: string): DashboardHomeData {
  const base = parseDateKey(selectedDate);
  const trends = Array.from({ length: 14 }, (_, idx) => {
    const d = new Date(base);
    d.setDate(base.getDate() - (13 - idx));
    const date = toLocalDateString(d);
    const calories = [1760, 1680, 1840, 1710, 1520, 1805, 1560, 1690, 1620, 1750, 1670, 1490, 1780, 1560][idx];
    const steps = [8400, 7100, 9100, 8020, 6900, 9500, 6842, 7001, 7320, 8120, 7900, 6400, 8700, 7420][idx];
    const weight = [73.4, 73.3, 73.2, 73.1, 73.0, 72.9, 72.8, 73.2, 73.0, 72.9, 72.8, 72.6, 72.5, 72.4][idx];
    return { date, calories, steps, weight, workouts: idx % 3 === 0 ? 1 : 0 };
  });

  return {
    today: {
      calories: { consumed: 495, goal: 2000 },
      macros: { protein: 38, carbs: 62, fat: 18 },
      proteinGoal: 140,
      steps: { count: 6842, goal: 10000 },
      weight: 72.4,
      workoutSessions: 1,
      workoutSets: 8,
    },
    weeklyTrends: trends,
    recentMeals: [
      {
        id: "meal-4",
        description: "Voice meal still being estimated",
        calories: null,
        mealType: "snack",
        interpretationStatus: "interpreting",
        eatenAt: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 15, 45).toISOString(),
      },
      {
        id: "meal-1",
        description: "Chicken Salad",
        calories: 450,
        mealType: "lunch",
        interpretationStatus: "reviewed",
        eatenAt: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 30).toISOString(),
      },
      {
        id: "meal-2",
        description: "Overnight Oats",
        calories: 320,
        mealType: "breakfast",
        interpretationStatus: "needs_review",
        eatenAt: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 8, 15).toISOString(),
      },
      {
        id: "meal-3",
        description: "Grilled Salmon & Rice",
        calories: 620,
        mealType: "dinner",
        interpretationStatus: "reviewed",
        eatenAt: new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, 19, 5).toISOString(),
      },
    ],
    recentExercises: ["Bench Press", "Deadlift", "Squat"],
  };
}

export default function DashboardScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const cc = useCommandCenter();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isWebPreview = isWebPreviewMode();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const today = toLocalDateString(new Date());
  const dayOptions = useMemo(() => getLastSevenDaysEndingToday(), [today]);

  const [selectedDate, setSelectedDate] = useState(today);
  const [trendTab, setTrendTab] = useState<TrendMetric>("calories");
  const [chartWidth, setChartWidth] = useState(320);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((s) => {
      setIsOffline(s.isConnected === false || s.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

  const dashboardQuery = useQuery<DashboardHomeData>({
    queryKey: ["dashboard", "home", timezone, selectedDate],
    queryFn: async () => {
      if (isWebPreview) {
        return mockDashboardData(selectedDate);
      }
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<DashboardHomeData>(
        `/api/dashboard?${new URLSearchParams({ timezone, date: selectedDate, scope: "home" })}`,
        { token }
      );
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPending = data?.recentMeals?.some(
        (m) => m.interpretationStatus === "interpreting",
      );
      return hasPending ? 2000 : false;
    },
  });

  const dashboard = dashboardQuery.data;
  const weeklyFull = dashboard?.weeklyTrends ?? [];
  const weeklyCurrent = weeklyFull.slice(-7);
  const weeklyPrior = weeklyFull.slice(-14, -7);

  const loggedDates = useMemo(() => {
    const dates = new Set<string>();
    for (const trend of weeklyFull) {
      const hasData =
        trend.calories > 0 ||
        (trend.steps ?? 0) > 0 ||
        trend.weight != null ||
        trend.workouts > 0;
      if (hasData) dates.add(trend.date);
    }
    return dates;
  }, [weeklyFull]);

  const recentMeals = useMemo(() => {
    if (!dashboard?.recentMeals) return [];
    return dashboard.recentMeals
      .filter((meal) => toLocalDateString(new Date(meal.eatenAt)) === selectedDate)
      .slice(0, 3);
  }, [dashboard?.recentMeals, selectedDate]);

  const metricCurrentValues = useMemo(
    () =>
      weeklyCurrent
        .map((point) => metricValueFromPoint(point, trendTab))
        .map((value) => safeNumber(value)),
    [weeklyCurrent, trendTab]
  );

  const normalizedTrendValues = useMemo(() => {
    let last = 0;
    return metricCurrentValues.map((value) => {
      if (value == null) return last;
      last = value;
      return value;
    });
  }, [metricCurrentValues]);

  const todayCaloriesConsumed = dashboard?.today.calories.consumed ?? 0;
  const todayCaloriesGoal = dashboard?.today.calories.goal ?? 0;

  const todaySteps = dashboard?.today.steps.count ?? 0;
  const todayStepsGoal = dashboard?.today.steps.goal ?? 0;

  const todayMacros = dashboard?.today.macros ?? null;
  const todayProtein: number | null = todayMacros?.protein ?? null;
  const todayCarbs: number | null = todayMacros?.carbs ?? null;
  const todayFat: number | null = todayMacros?.fat ?? null;
  const todayProteinGoal = dashboard?.today.proteinGoal ?? 140;

  const coachSummary = useMemo(() => {
    if (!dashboard) return "";
    const remaining = todayCaloriesGoal - todayCaloriesConsumed;
    if (remaining > 200) return `${remaining.toLocaleString()} kcal left — plenty of room for dinner.`;
    if (remaining > 0) return `${remaining.toLocaleString()} kcal left — a light bite tops you up.`;
    if (remaining > -200) return "You're right on goal — nice steady day.";
    return `${Math.abs(remaining).toLocaleString()} kcal over — coach can suggest a leaner day tomorrow.`;
  }, [dashboard, todayCaloriesGoal, todayCaloriesConsumed]);

  const trendChart = useMemo(
    () => buildLinePaths(normalizedTrendValues, chartWidth - 8, 160, trendTab, todayCaloriesGoal),
    [normalizedTrendValues, chartWidth, trendTab, todayCaloriesGoal]
  );

  const metricAverage = useMemo(() => {
    const values = metricCurrentValues.filter((value): value is number => value != null);
    if (!values.length) return null;
    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
  }, [metricCurrentValues]);

  const priorAverage = useMemo(() => {
    const values = weeklyPrior
      .map((point) => metricValueFromPoint(point, trendTab))
      .map((value) => safeNumber(value))
      .filter((value): value is number => value != null);

    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [weeklyPrior, trendTab]);

  const trendChange = useMemo(() => {
    if (metricAverage == null || priorAverage == null || priorAverage === 0) return null;
    return ((metricAverage - priorAverage) / priorAverage) * 100;
  }, [metricAverage, priorAverage]);

  const trendChangeColor = useMemo(() => {
    if (trendChange == null) return COLORS.textSecondary;
    const improving =
      trendTab === "calories" || trendTab === "weight" ? trendChange <= 0 : trendChange >= 0;
    return improving ? COLORS.steps : COLORS.error;
  }, [trendChange, trendTab]);

  const recentWeight = dashboard?.today.weight;
  const prevWeight = useMemo(() => {
    if (!weeklyCurrent.length) return null;
    const weights = weeklyCurrent
      .map((day) => day.weight)
      .filter((value): value is number => value != null);
    if (weights.length < 2) return null;
    return weights[0];
  }, [weeklyCurrent]);

  const weightDelta =
    recentWeight != null && prevWeight != null
      ? Number((recentWeight - prevWeight).toFixed(1))
      : null;

  const homeBlockingError = Boolean(dashboardQuery.error && !dashboardQuery.data);
  // Keep the hero/cards in a loading state until the first real payload exists.
  // This avoids flashing default fallback metrics during auth/query hydration.
  const isDashboardInitialLoading = !dashboard && !homeBlockingError;

  const renderTrendPrimary = () => {
    if (metricAverage == null) return "--";
    if (trendTab === "calories") return `${Math.round(metricAverage).toLocaleString()} kcal/day`;
    if (trendTab === "steps") return `${formatCompact(Math.round(metricAverage))} steps/day`;
    return `${metricAverage.toFixed(1)} kg avg`;
  };

  const renderTrendChange = () => {
    if (trendChange == null) return "No prior window";
    const rounded = Math.round(trendChange);
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded}% vs prior 7 days`;
  };

  const handleOpenMeal = (mealId: string) => {
    if (isWebPreview) return;
    router.push({ pathname: "/meal-edit/[id]", params: { id: mealId } });
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={async () => {
              setIsManualRefreshing(true);
              try {
                await dashboardQuery.refetch();
              } finally {
                setIsManualRefreshing(false);
              }
            }}
          />
        }
      >
        <View style={styles.headerRowTop}>
          <Wordmark size={22} />
          <Pressable
            style={styles.addButton}
            onPress={() => { haptic.tap(); cc.open(); }}
            testID="home-add-button"
            accessibilityRole="button"
            accessibilityLabel="Add entry"
          >
            <Icon name="plus" size={18} color={token.text} />
          </Pressable>
        </View>

        {isOffline ? (
          <View style={styles.offlineBannerWrap}>
            <OfflineBanner />
          </View>
        ) : null}

        <DayPicker
          dayOptions={dayOptions}
          selectedDate={selectedDate}
          loggedDates={loggedDates}
          onSelectDate={setSelectedDate}
        />

        {homeBlockingError ? (
          <View style={styles.blockingErrorCard}>
            <Text style={styles.blockingErrorTitle} selectable>Could not load Home</Text>
            <Text style={styles.blockingErrorBody} selectable>{getErrorMessage(dashboardQuery.error)}</Text>
            <Pressable style={styles.primaryActionButton} onPress={() => void dashboardQuery.refetch()}>
              <Text style={styles.primaryActionText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              style={styles.heroCard}
              onPress={() => { haptic.tap(); router.push("/trends"); }}
              testID="home-hero-trends"
            >
              <View style={styles.heroCardHeader}>
                <Text style={styles.heroEyebrow}>Move · today</Text>
                {isDashboardInitialLoading ? (
                  <LoadingBlock width={92} height={14} radius={6} />
                ) : (
                  <Text style={styles.heroGoalText}>{todayCaloriesGoal.toLocaleString()} kcal goal</Text>
                )}
              </View>
              <View style={styles.heroBody}>
                {isDashboardInitialLoading ? (
                  <LoadingBlock width={150} height={150} radius={75} />
                ) : (
                  <CalorieRing consumed={todayCaloriesConsumed} goal={todayCaloriesGoal} />
                )}
                <View style={styles.heroRight}>
                  {isDashboardInitialLoading ? (
                    <View style={styles.heroLoadingCopy}>
                      <LoadingBlock width={"92%"} height={18} radius={6} />
                      <LoadingBlock width={"76%"} height={18} radius={6} />
                    </View>
                  ) : (
                    <Text style={styles.heroSummary}>
                      <Text style={styles.heroSummaryAccent} selectable>
                        {Math.max(todayCaloriesGoal - todayCaloriesConsumed, 0).toLocaleString()} kcal
                      </Text>{" "}
                      left to hit your goal.
                    </Text>
                  )}
                  {isDashboardInitialLoading ? (
                    <View style={styles.macroLoadingStack}>
                      <LoadingBlock width={"100%"} height={18} radius={6} />
                      <LoadingBlock width={"100%"} height={18} radius={6} />
                      <LoadingBlock width={"100%"} height={18} radius={6} />
                    </View>
                  ) : (
                    <View style={styles.macroStack}>
                      <MacroBar label="Protein" current={todayProtein} goal={todayProteinGoal} tone="accent" />
                      <MacroBar label="Carbs" current={todayCarbs} goal={null} />
                      <MacroBar label="Fat" current={todayFat} goal={null} />
                    </View>
                  )}
                </View>
              </View>
            </Pressable>

            <View style={styles.metricsRow}>
              <Pressable
                style={styles.metricCard}
                onPress={() => { haptic.tap(); router.push({ pathname: "/trends", params: { metric: "steps" } }); }}
                testID="home-steps-card"
              >
                <View style={styles.metricTopRow}>
                  <Text style={styles.metricLabel}>Steps</Text>
                  <StepsTrendIcon />
                </View>
                {isDashboardInitialLoading ? (
                  <LoadingBlock width={96} height={26} radius={6} />
                ) : (
                  <View style={styles.metricValueRow}>
                    <Text style={styles.metricMainValue} selectable>{formatCompact(todaySteps)}</Text>
                    <Text style={styles.metricUnit}>/ {todayStepsGoal >= 1000 ? `${Math.round(todayStepsGoal / 1000)}k` : todayStepsGoal}</Text>
                  </View>
                )}
                <View style={styles.metricThinTrack}>
                  <View
                    style={[
                      styles.metricThinFill,
                      { width: isDashboardInitialLoading ? "0%" : `${progressPercent(todaySteps, todayStepsGoal) * 100}%` },
                    ]}
                  />
                </View>
              </Pressable>

              <Pressable
                style={styles.metricCard}
                onPress={() => { haptic.tap(); router.push({ pathname: "/trends", params: { metric: "weight" } }); }}
                testID="home-weight-card"
              >
                <View style={styles.metricTopRow}>
                  <Text style={styles.metricLabel}>Weight</Text>
                  {weightDelta != null && weightDelta !== 0 ? (
                    <Text style={[styles.weightDelta, weightDelta <= 0 ? styles.weightDeltaGood : styles.weightDeltaBad]}>
                      {weightDelta <= 0 ? "↓" : "↑"} {Math.abs(weightDelta).toFixed(1)}
                    </Text>
                  ) : null}
                </View>
                {isDashboardInitialLoading ? (
                  <LoadingBlock width={92} height={26} radius={6} />
                ) : (
                  <View style={styles.metricValueRow}>
                    <Text style={styles.metricMainValue} selectable>
                      {recentWeight == null ? "—" : recentWeight.toFixed(1)}
                    </Text>
                    <Text style={styles.metricUnit}>kg</Text>
                  </View>
                )}
                {isDashboardInitialLoading ? (
                  <View style={styles.weightSparklineWrap}>
                    <LoadingBlock width={"100%"} height={18} radius={6} />
                  </View>
                ) : (
                  <View style={styles.weightSparklineWrap}>
                    <WeightSparkline />
                  </View>
                )}
              </Pressable>
            </View>

            <Pressable style={styles.coachCard} onPress={() => { haptic.tap(); router.push("/coach"); }} testID="home-ask-coach">
              <CoachBadge />
              <View style={styles.coachTextWrap}>
                <Text style={styles.coachTitle}>Ask coach</Text>
                {isDashboardInitialLoading ? (
                  <View style={styles.coachLoadingSub}>
                    <LoadingBlock width={"86%"} height={16} radius={6} />
                  </View>
                ) : (
                  <Text style={styles.coachSub}>{coachSummary}</Text>
                )}
              </View>
              <Icon name="chevronRight" size={16} color={token.textMute} />
            </Pressable>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Today's log</Text>
              <Pressable onPress={() => { haptic.tap(); router.push("/meals"); }} testID="home-recent-meals-see-all">
                <Text style={styles.sectionLink}>See all</Text>
              </Pressable>
            </View>

            <View style={styles.mealsWrap}>
              {isDashboardInitialLoading ? (
                <View style={styles.mealsLoadingWrap}>
                  <LoadingBlock width={"100%"} height={68} radius={16} />
                  <LoadingBlock width={"100%"} height={68} radius={16} />
                  <LoadingBlock width={"100%"} height={68} radius={16} />
                </View>
              ) : recentMeals.length > 0 ? (
                recentMeals.map((meal, index) => {
                  const eaten = new Date(meal.eatenAt);
                  const hh = String(eaten.getHours()).padStart(2, "0");
                  const mm = String(eaten.getMinutes()).padStart(2, "0");
                  const status = normalizeMealStatus(meal.interpretationStatus, meal.calories);
                  const calories = formatNullableCalories(meal.calories);
                  return (
                    <Pressable
                      key={meal.id}
                      style={[styles.mealRow, index === 0 && styles.mealRowFirst]}
                      onPress={() => handleOpenMeal(meal.id)}
                      testID={`home-meal-row-${meal.id}`}
                    >
                      <Text style={styles.mealTime}>{hh}:{mm}</Text>
                      <View style={styles.mealInfo}>
                        <Text style={styles.mealTitle} numberOfLines={1}>{meal.description}</Text>
                        <View style={styles.mealMetaRow}>
                          {status !== "interpreting" ? (
                            <Text style={styles.mealMeta} numberOfLines={1}>{meal.mealType}</Text>
                          ) : null}
                          <MealStatusBadge status={status} />
                        </View>
                      </View>
                      <View style={styles.mealKcalRow}>
                        {status === "interpreting" || calories == null ? (
                          <Text style={styles.mealKcalPending}>--</Text>
                        ) : (
                          <>
                            <Text style={styles.mealKcalNum} selectable>{calories}</Text>
                            <Text style={styles.mealKcalUnit}>kcal</Text>
                          </>
                        )}
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No meals logged yet.</Text>
              )}
            </View>
          </>
        )}
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
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    // Clear the floating command bar, which now docks above the native tab bar
    // (tab-bar height + bar height + breathing room).
    paddingBottom: 210,
    backgroundColor: COLORS.bg,
  },
  headerRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: r.pill,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineBannerWrap: {
    marginTop: 6,
    marginBottom: 4,
  },
  heroCard: {
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 22,
    paddingBottom: 20,
    marginBottom: 10,
  },
  heroCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  heroEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.accent,
  },
  heroGoalText: {
    fontFamily: font.sans[400],
    fontSize: 11,
    color: token.textMute,
  },
  heroBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  heroRight: {
    flex: 1,
  },
  heroLoadingCopy: {
    gap: 6,
    marginBottom: 12,
  },
  heroSummary: {
    fontFamily: font.sans[400],
    fontSize: 13,
    color: token.textSoft,
    marginBottom: 12,
    lineHeight: 18,
  },
  heroSummaryAccent: {
    color: token.accent,
    fontWeight: "600",
  },
  macroStack: {
    gap: 10,
  },
  macroLoadingStack: {
    gap: 10,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.md,
    borderCurve: "continuous",
    padding: 16,
    gap: 0,
  },
  metricLoadingSub: {
    marginTop: 2,
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  metricThinTrack: {
    marginTop: 10,
    height: 3,
    backgroundColor: token.line,
    borderRadius: 2,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  metricThinFill: {
    height: "100%",
    backgroundColor: token.accent,
    borderRadius: 2,
    borderCurve: "continuous",
  },
  weightSparklineWrap: {
    marginTop: 6,
  },
  metricLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.textMute,
  },
  metricMainValue: {
    fontFamily: font.mono[500],
    fontSize: 26,
    fontWeight: "500",
    letterSpacing: -0.78,
    color: token.text,
    lineHeight: 28,
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
  },
  metricUnit: {
    fontFamily: font.sans[400],
    fontSize: 11,
    color: token.textMute,
    fontWeight: "400",
  },
  metricSubValue: {
    fontFamily: font.sans[400],
    fontSize: 11,
    color: token.textMute,
    fontWeight: "400",
  },
  metricSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 20,
  },
  weightDelta: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
  },
  weightDeltaGood: {
    color: token.positive,
  },
  weightDeltaBad: {
    color: token.warn,
  },
  coachCard: {
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.md,
    borderCurve: "continuous",
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coachTextWrap: {
    flex: 1,
  },
  coachTitle: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: token.accent,
  },
  coachSub: {
    marginTop: 3,
    fontFamily: font.sans[400],
    fontSize: 13.5,
    color: token.text,
    fontWeight: "400",
    letterSpacing: -0.07,
    lineHeight: 18,
  },
  coachLoadingSub: {
    marginTop: 5,
  },
  sectionTitle: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    color: token.text,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  trendTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  trendTab: {
    borderRadius: r.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: token.line,
  },
  trendTabActive: {
    backgroundColor: token.accent,
    borderColor: "transparent",
  },
  trendTabText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    color: token.textSoft,
    fontWeight: "600",
    letterSpacing: 0.24,
  },
  trendTabTextActive: {
    color: token.accentInk,
  },
  trendCard: {
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.lg,
    borderCurve: "continuous",
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: 24,
  },
  trendLoadingSub: {
    marginTop: 6,
  },
  trendLoadingWrap: {
    paddingTop: 4,
  },
  trendSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
    gap: 12,
  },
  trendSummaryMain: {
    fontFamily: font.mono[500],
    fontSize: 26,
    fontWeight: "500",
    color: token.text,
    letterSpacing: -0.78,
  },
  trendSummarySub: {
    marginTop: 4,
    fontFamily: font.sans[400],
    fontSize: 11,
    color: token.textMute,
    fontWeight: "400",
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  trendChangeText: {
    fontFamily: font.sans[700],
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.54,
    textTransform: "uppercase",
  },
  trendDaysRow: {
    marginTop: -6,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trendDayLabel: {
    fontFamily: font.sans[600],
    fontSize: 10,
    color: token.textMute,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    color: token.accent,
    fontWeight: "600",
  },
  mealsWrap: {
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.md,
    borderCurve: "continuous",
    overflow: "hidden",
    marginBottom: 12,
  },
  mealsLoadingWrap: {
    gap: 12,
    padding: 12,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: token.line,
    gap: 10,
  },
  mealRowFirst: {
    borderTopWidth: 0,
  },
  mealTime: {
    width: 42,
    fontFamily: font.mono[400],
    fontSize: 11,
    color: token.textMute,
  },
  mealInfo: {
    flex: 1,
    minWidth: 0,
  },
  mealTitle: {
    fontFamily: font.sans[500],
    fontSize: 14,
    fontWeight: "500",
    color: token.text,
  },
  mealMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    marginTop: 3,
  },
  mealMeta: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    color: token.textMute,
    letterSpacing: 0.84,
    textTransform: "uppercase",
    flexShrink: 1,
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
  emptyText: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: token.textSoft,
    padding: 16,
  },
  blockingErrorCard: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.md,
    borderCurve: "continuous",
    padding: 18,
    gap: 10,
    backgroundColor: token.surface,
  },
  blockingErrorTitle: {
    fontFamily: font.sans[700],
    fontSize: 20,
    color: token.text,
    fontWeight: "700",
  },
  blockingErrorBody: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: token.textSoft,
  },
  primaryActionButton: {
    borderRadius: r.sm,
    borderCurve: "continuous",
    backgroundColor: token.accent,
    paddingHorizontal: 18,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    fontFamily: font.sans[700],
    color: token.accentInk,
    fontSize: 14,
    fontWeight: "700",
  },
});
