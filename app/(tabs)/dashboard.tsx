import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import Svg, {
  Circle as SvgCircle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { apiRequest } from "../../lib/api-client";
import { FloatingCommandBar } from "../../components/FloatingCommandBar";
import { useCommandCenter, COLORS, toLocalDateString } from "../../components/command-center";
import { getErrorMessage } from "../../components/command-center/helpers";
import { color as token, font, radius as r } from "../../lib/tokens";
import { isWebPreviewMode } from "../../lib/web-preview-mode";
import { Wordmark, LoadingBlock, OfflineBanner } from "../../components/pulse";
import NetInfo from "@react-native-community/netinfo";
import {
  type AsyncMealStatus,
  formatNullableCalories,
  normalizeMealStatus,
} from "../../lib/meal-status";
import {
  type TrendMetric,
  TREND_TABS,
  safeNumber,
  buildLinePaths,
  metricValueFromPoint,
} from "../../lib/trends";

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

function CoachBadge() {
  return (
    <View style={styles.coachBadge}>
      <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <SvgCircle cx={20} cy={20} r={20} fill={token.accent} />
        <Path
          d="M20 9L23.5 17L31 19L23.5 21L20 30L16.5 21L9 19L16.5 17L20 9Z"
          fill={token.accentInk}
        />
      </Svg>
    </View>
  );
}

function StepsTrendIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M4 11V7M4 7L7 4L10 7M10 7V11"
        stroke={token.accent}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 150;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = progressPercent(consumed, goal);

  return (
    <View style={[styles.heroRingWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="limeRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={token.accent} />
            <Stop offset="1" stopColor={token.accentDim} />
          </LinearGradient>
        </Defs>
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={token.accentRingTrack}
          strokeWidth={stroke}
          fill="none"
        />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#limeRing)"
          strokeWidth={stroke}
          strokeDasharray={`${circumference * progress} ${circumference}`}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.heroRingCenter}>
        <Text style={styles.heroRingNumber}>{consumed.toLocaleString()}</Text>
        <Text style={styles.heroRingLabel}>kcal in</Text>
      </View>
    </View>
  );
}

type MacroBarProps = { label: string; current: number | null; goal: number; tone?: "accent" | "soft" };
function MacroBar({ label, current, goal, tone = "soft" }: MacroBarProps) {
  const percent = current != null && goal > 0 ? Math.max(0, Math.min(1, current / goal)) : 0;
  const fillColor = tone === "accent" ? token.accent : token.textSoft;
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {current != null ? Math.round(current) : "—"}
          <Text style={styles.macroValueGoal}>/{goal}g</Text>
        </Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${percent * 100}%`, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

function MiniStepsRing({ current, goal }: { current: number; goal: number }) {
  const size = 40;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = progressPercent(current, goal);

  return (
    <Svg width={size} height={size}>
      <SvgCircle cx={size / 2} cy={size / 2} r={radius} stroke={COLORS.ringTrack} strokeWidth={stroke} fill="none" />
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={COLORS.steps}
        strokeWidth={stroke}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - progress)}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function WeightSparkline() {
  return (
    <Svg width="100%" height={18} viewBox="0 0 120 18" preserveAspectRatio="none">
      <Path
        d="M0 8 L20 10 L40 6 L60 9 L80 7 L100 11 L120 14"
        stroke={token.accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// LoadingBlock is now imported from components/pulse — see top of file.

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
        styles.mealStatusBadge,
        status === "failed" ? styles.mealStatusBadgeFailed : null,
      ]}
    >
      {status === "interpreting" ? (
        <ActivityIndicator size="small" color={token.textMute} style={styles.mealStatusSpinner} />
      ) : null}
      <Text
        style={[
          styles.mealStatusText,
          status === "failed" ? styles.mealStatusTextFailed : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
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
  const todayCarbsGoal = 210;
  const todayFatGoal = 70;

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
    if (trendTab === "steps") return `${Math.round(metricAverage).toLocaleString()} steps/day`;
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
          <Pressable style={styles.addButton} onPress={() => cc.open()} testID="home-add-button">
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>

        {isOffline ? (
          <View style={styles.offlineBannerWrap}>
            <OfflineBanner />
          </View>
        ) : null}

        <View style={styles.dayPickerRow}>
          {dayOptions.map((day) => {
            const active = day.date === selectedDate;
            const hasData = loggedDates.has(day.date);
            const faded = !active && !hasData;

            return (
              <Pressable
                key={day.date}
                style={[styles.dayItem, active && styles.dayItemActive]}
                testID={`home-day-${day.date}`}
                onPress={() => {
                  setSelectedDate(day.date);
                }}
              >
                <Text style={[styles.dayLabel, active && styles.dayLabelActive, faded && styles.dayLabelFaded]}>
                  {day.dayLabel}
                </Text>
                <Text style={[styles.dayNum, active && styles.dayNumActive, faded && styles.dayNumFaded]}>
                  {day.dayNum}
                </Text>
                <View
                  style={[
                    styles.dayDot,
                    active && styles.dayDotActive,
                    !active && !hasData && styles.dayDotEmpty,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        {homeBlockingError ? (
          <View style={styles.blockingErrorCard}>
            <Text style={styles.blockingErrorTitle}>Could not load Home</Text>
            <Text style={styles.blockingErrorBody}>{getErrorMessage(dashboardQuery.error)}</Text>
            <Pressable style={styles.primaryActionButton} onPress={() => void dashboardQuery.refetch()}>
              <Text style={styles.primaryActionText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              style={styles.heroCard}
              onPress={() => router.push("/(tabs)/trends")}
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
                      <Text style={styles.heroSummaryAccent}>
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
                      <MacroBar label="Carbs" current={todayCarbs} goal={todayCarbsGoal} />
                      <MacroBar label="Fat" current={todayFat} goal={todayFatGoal} />
                    </View>
                  )}
                </View>
              </View>
            </Pressable>

            <View style={styles.metricsRow}>
              <Pressable
                style={styles.metricCard}
                onPress={() => router.push({ pathname: "/(tabs)/trends", params: { metric: "steps" } })}
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
                    <Text style={styles.metricMainValue}>{todaySteps.toLocaleString()}</Text>
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
                onPress={() => router.push({ pathname: "/(tabs)/trends", params: { metric: "weight" } })}
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
                    <Text style={styles.metricMainValue}>
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

            <Pressable style={styles.coachCard} onPress={() => router.push("/(tabs)/coach")} testID="home-ask-coach">
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
              <Text style={styles.coachChevron}>›</Text>
            </Pressable>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Today's log</Text>
              <Pressable onPress={() => router.push("/(tabs)/meals")} testID="home-recent-meals-see-all">
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
                            <Text style={styles.mealKcalNum}>{calories}</Text>
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
    paddingBottom: 146,
    backgroundColor: COLORS.bg,
  },
  headerRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  appName: {
    fontFamily: font.sans[700],
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.66,
    color: token.text,
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
  addButtonText: {
    fontFamily: font.sans[300],
    fontSize: 18,
    lineHeight: 20,
    color: token.text,
    fontWeight: "300",
  },
  offlineBannerWrap: {
    marginTop: 6,
    marginBottom: 4,
  },
  dayPickerRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    marginBottom: 20,
  },
  dayItem: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 0,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: token.line,
    backgroundColor: "transparent",
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
    color: token.text,
    opacity: 0.75,
  },
  dayLabelActive: {
    color: token.accentInk,
    opacity: 0.75,
  },
  dayLabelFaded: {
    color: token.textMute,
  },
  dayNum: {
    fontFamily: font.mono[500],
    fontSize: 18,
    fontWeight: "500",
    color: token.text,
    lineHeight: 18,
    marginTop: 3,
  },
  dayNumActive: {
    color: token.accentInk,
  },
  dayNumFaded: {
    color: token.textMute,
    fontWeight: "500",
  },
  dayDot: {
    width: 3,
    height: 3,
    borderRadius: 3,
    marginTop: 5,
    backgroundColor: token.accent,
  },
  dayDotActive: {
    backgroundColor: token.accentInk,
  },
  dayDotEmpty: {
    backgroundColor: "transparent",
  },
  heroCard: {
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: 24,
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
  heroRingWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroRingCenter: {
    position: "absolute",
    alignItems: "center",
  },
  heroRingNumber: {
    fontFamily: font.mono[500],
    fontSize: 38,
    fontWeight: "500",
    color: token.text,
    letterSpacing: -1.52,
    lineHeight: 38,
  },
  heroRingLabel: {
    marginTop: 4,
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.84,
    textTransform: "uppercase",
    color: token.textMute,
  },
  macroStack: {
    gap: 10,
  },
  macroLoadingStack: {
    gap: 10,
  },
  macroRow: {},
  macroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  macroLabel: {
    fontFamily: font.sans[400],
    fontSize: 11,
    color: token.textSoft,
    letterSpacing: 0.44,
  },
  macroValue: {
    fontFamily: font.mono[500],
    fontSize: 11,
    color: token.text,
  },
  macroValueGoal: {
    color: token.textMute,
  },
  macroTrack: {
    height: 4,
    backgroundColor: token.line,
    borderRadius: 2,
    overflow: "hidden",
  },
  macroFill: {
    height: "100%",
    borderRadius: 2,
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
    overflow: "hidden",
  },
  metricThinFill: {
    height: "100%",
    backgroundColor: token.accent,
    borderRadius: 2,
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
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coachBadge: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
  coachChevron: {
    color: token.textMute,
    fontSize: 16,
    fontWeight: "500",
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
  mealStatusBadge: {
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
  mealStatusBadgeFailed: {
    borderColor: token.negative,
  },
  mealStatusSpinner: {
    transform: [{ scale: 0.65 }],
    marginHorizontal: -3,
  },
  mealStatusText: {
    fontFamily: font.sans[600],
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.35,
    color: token.textMute,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  mealStatusTextFailed: {
    color: token.negative,
  },
  mealCalories: {
    fontFamily: font.mono[500],
    fontSize: 15,
    fontWeight: "500",
    color: token.text,
  },
  emptyText: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: token.textSoft,
    padding: 16,
  },
  loadingBlock: {
    backgroundColor: token.surface2,
  },
  blockingErrorCard: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.md,
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
