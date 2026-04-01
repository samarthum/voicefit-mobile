import { useMemo, useState } from "react";
import {
  Platform,
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
  Ellipse,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest } from "../../lib/api-client";
import { FloatingCommandBar } from "../../components/FloatingCommandBar";
import { useCommandCenter, COLORS, toLocalDateString, getMealVisualKind } from "../../components/command-center";
import { getErrorMessage } from "../../components/command-center/helpers";

type TrendMetric = "calories" | "steps" | "weight";
type RecentMeal = DashboardData["recentMeals"][number];

const TREND_TABS: TrendMetric[] = ["calories", "steps", "weight"];
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

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}



function progressPercent(current: number, goal: number) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(1, current / goal));
}

function CoachBadge() {
  return (
    <View style={styles.coachBadge}>
      <Svg width={44} height={44} viewBox="0 0 44 44" fill="none">
        <SvgCircle cx={22} cy={22} r={22} fill="#1A1A1A" />
        <SvgCircle cx={22} cy={22} r={14} stroke="url(#coachGlow)" strokeOpacity={0.35} />
        <Path
          d="M22 10L24 17.2L31 15.7L25.4 21L31 26.3L24 24.8L22 32L20 24.8L13 26.3L18.6 21L13 15.7L20 17.2L22 10Z"
          fill="white"
        />
        <Defs>
          <LinearGradient id="coachGlow" x1={12} y1={10} x2={34} y2={34} gradientUnits="userSpaceOnUse">
            <Stop stopColor="#FFFFFF" />
            <Stop offset={1} stopColor="#8E8E93" />
          </LinearGradient>
        </Defs>
      </Svg>
    </View>
  );
}

function SaladMealGlyph({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="saladBowl" x1="32" y1="30" x2="32" y2="57" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FFFFFF" />
          <Stop offset={1} stopColor="#EDEEF2" />
        </LinearGradient>
        <RadialGradient id="leafGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 25) rotate(90) scale(16)">
          <Stop stopColor="#8DE39D" />
          <Stop offset={1} stopColor="#34C759" />
        </RadialGradient>
      </Defs>

      <Path d="M12 36C12 48.15 20.4 56 32 56C43.6 56 52 48.15 52 36V34H12V36Z" fill="url(#saladBowl)" />
      <Path d="M12 36C12 48.15 20.4 56 32 56C43.6 56 52 48.15 52 36V34H12V36Z" stroke="#1A1A1A" strokeWidth={2.2} />
      <Path d="M17 34C17.4 26.7 23.6 21 31.2 21C39.5 21 46.3 27.8 46.3 36" fill="url(#leafGlow)" />
      <Path d="M17 34C17.4 26.7 23.6 21 31.2 21C39.5 21 46.3 27.8 46.3 36" stroke="#1A1A1A" strokeWidth={2.2} strokeLinecap="round" />
      <SvgCircle cx={23} cy={30} r={3.2} fill="#FF6B60" />
      <SvgCircle cx={39} cy={29} r={3.2} fill="#FF9500" />
      <Ellipse cx={31.5} cy={28} rx={2.8} ry={3.5} fill="#9AE7B5" />
      <Path d="M22 41H42" stroke="#D7D9DF" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function OatsMealGlyph({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="jarGlass" x1="32" y1="11" x2="32" y2="54" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FFFFFF" />
          <Stop offset={1} stopColor="#EEF0F4" />
        </LinearGradient>
        <LinearGradient id="oatFill" x1="32" y1="26" x2="32" y2="48" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F9CF86" />
          <Stop offset={1} stopColor="#E8B35D" />
        </LinearGradient>
      </Defs>

      <Rect x={17} y={10} width={30} height={44} rx={10} fill="url(#jarGlass)" stroke="#1A1A1A" strokeWidth={2.2} />
      <Rect x={22} y={22} width={20} height={24} rx={6} fill="url(#oatFill)" />
      <Path d="M22 26H42" stroke="#E0A64F" strokeWidth={2} strokeLinecap="round" />
      <Path d="M22 31H42" stroke="#E0A64F" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
      <Path d="M22 36H37" stroke="#E0A64F" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      <Rect x={20} y={15} width={24} height={4} rx={2} fill="#DADDE4" />
      <SvgCircle cx={45.5} cy={17.5} r={4.5} fill="#FF9500" />
      <Path d="M45.5 15.4V19.6M43.4 17.5H47.6" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function SalmonMealGlyph({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="plateFill" x1="32" y1="16" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FFFFFF" />
          <Stop offset={1} stopColor="#EEF0F4" />
        </LinearGradient>
        <LinearGradient id="salmonFill" x1="22" y1="25" x2="44" y2="39" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FFA45B" />
          <Stop offset={1} stopColor="#FF7E3E" />
        </LinearGradient>
      </Defs>

      <Ellipse cx={32} cy={36} rx={22} ry={16} fill="url(#plateFill)" stroke="#1A1A1A" strokeWidth={2.2} />
      <Path d="M18 36C19.8 30.8 24.6 27 30.2 27H40.8C42.6 27 44 28.4 44 30.2C44 33.1 41.7 35.4 38.8 35.4H30.5C27.2 35.4 24.8 37.7 24 41" fill="url(#salmonFill)" />
      <Path d="M18 36C19.8 30.8 24.6 27 30.2 27H40.8C42.6 27 44 28.4 44 30.2C44 33.1 41.7 35.4 38.8 35.4H30.5C27.2 35.4 24.8 37.7 24 41" stroke="#1A1A1A" strokeWidth={1.8} strokeLinecap="round" />
      <Ellipse cx={42} cy={39} rx={7} ry={5.5} fill="#FBFBFD" stroke="#DADDE4" strokeWidth={1.5} />
      <SvgCircle cx={39.7} cy={37.8} r={0.9} fill="#D2D6DE" />
      <SvgCircle cx={42.2} cy={40.3} r={0.9} fill="#D2D6DE" />
      <SvgCircle cx={44.7} cy={37.8} r={0.9} fill="#D2D6DE" />
      <SvgCircle cx={20} cy={30} r={2} fill="#34C759" />
      <Path d="M19 30.3L20 28.2L21.1 30.3" stroke="#1A1A1A" strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

function MealGlyph({ description, size = 32 }: { description: string; size?: number }) {
  const kind = getMealVisualKind(description);

  if (kind === "salad") return <SaladMealGlyph size={size} />;
  if (kind === "oats") return <OatsMealGlyph size={size} />;
  if (kind === "salmon") return <SalmonMealGlyph size={size} />;

  return <Ionicons name="restaurant-outline" size={Math.round(size * 0.7)} color="#8E8E93" />;
}

function MealThumb({ description }: { description: string }) {
  return (
    <View style={styles.mealThumb}>
      <MealGlyph description={description} size={32} />
    </View>
  );
}

function QuickMealThumb({ description }: { description: string }) {
  return <MealGlyph description={description} size={18} />;
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 180;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const left = Math.max(goal - consumed, 0);
  const progress = progressPercent(consumed, goal);
  const offset = circumference * (1 - progress);

  return (
    <View style={styles.heroRingWrap}>
      <Svg width={size} height={size}>
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.ringTrack}
          strokeWidth={stroke}
          fill="none"
        />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.calories}
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.heroRingCenter}>
        <Text style={styles.heroRingNumber}>{left.toLocaleString()}</Text>
        <Text style={styles.heroRingLabel}>calories left</Text>
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
    <Svg width={44} height={40} viewBox="0 0 44 40" fill="none">
      <Path d="M2 12L8 14L15 11L22 16L29 18L36 22L42 26" stroke={COLORS.weight} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <SvgCircle cx={42} cy={26} r={2.4} fill={COLORS.weight} />
    </Svg>
  );
}

function LoadingBlock({
  width,
  height,
  radius = 12,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}) {
  return <View style={[styles.loadingBlock, { width, height, borderRadius: radius }, style]} />;
}

function buildLinePaths(values: number[], width: number, height: number, metric: TrendMetric, calorieGoal = 2000) {
  const innerLeft = 10;
  const innerRight = width - 10;
  const innerTop = 12;
  const innerBottom = height - 30;

  const nonEmpty = values.length > 0;
  const min = nonEmpty ? Math.min(...values) : 0;
  const max = nonEmpty ? Math.max(...values) : 1;
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x =
      values.length <= 1
        ? innerLeft
        : innerLeft + (index * (innerRight - innerLeft)) / (values.length - 1);
    const normalized = (value - min) / range;
    const y = innerBottom - normalized * (innerBottom - innerTop);
    return { x, y, value };
  });

  const pointPairs = points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ");
  const line = points.length ? `M ${pointPairs}` : "";

  const area = points.length
    ? `${line} L ${points[points.length - 1]?.x.toFixed(2)} ${innerBottom.toFixed(2)} L ${points[0]?.x.toFixed(2)} ${innerBottom.toFixed(2)} Z`
    : "";

  const goalValue = metric === "calories" ? calorieGoal : null;
  const goalY =
    goalValue == null
      ? null
      : innerBottom - ((goalValue - min) / range) * (innerBottom - innerTop);

  return { points, line, area, innerBottom, goalY, width };
}

function metricValueFromPoint(point: DashboardData["weeklyTrends"][number], metric: TrendMetric) {
  if (metric === "calories") return point.calories;
  if (metric === "steps") return point.steps;
  return point.weight;
}

function metricColor(metric: TrendMetric) {
  if (metric === "calories") return COLORS.calories;
  if (metric === "steps") return COLORS.steps;
  return COLORS.weight;
}

function mockDashboardData(selectedDate: string): DashboardData {
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
      steps: { count: 6842, goal: 10000 },
      weight: 72.4,
      workoutSessions: 1,
      workoutSets: 8,
    },
    weeklyTrends: trends,
    recentMeals: [
      {
        id: "meal-1",
        description: "Chicken Salad",
        calories: 450,
        mealType: "lunch",
        eatenAt: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 30).toISOString(),
      },
      {
        id: "meal-2",
        description: "Overnight Oats",
        calories: 320,
        mealType: "breakfast",
        eatenAt: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 8, 15).toISOString(),
      },
      {
        id: "meal-3",
        description: "Grilled Salmon & Rice",
        calories: 620,
        mealType: "dinner",
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
  const isWebPreview = __DEV__ && Platform.OS === "web";

  const today = toLocalDateString(new Date());
  const dayOptions = useMemo(() => getLastSevenDaysEndingToday(), [today]);

  const [selectedDate, setSelectedDate] = useState(today);
  const [trendTab, setTrendTab] = useState<TrendMetric>("calories");
  const [chartWidth, setChartWidth] = useState(320);

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ["dashboard", timezone, selectedDate],
    queryFn: async () => {
      if (isWebPreview) {
        return mockDashboardData(selectedDate);
      }
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<DashboardData>(
        `/api/dashboard?${new URLSearchParams({ timezone, date: selectedDate })}`,
        { token }
      );
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

  const recentMeals = dashboard?.recentMeals.slice(0, 3) ?? [];

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
  const todayCaloriesGoal = dashboard?.today.calories.goal ?? 2000;

  const todaySteps = dashboard?.today.steps.count ?? 0;
  const todayStepsGoal = dashboard?.today.steps.goal ?? 10000;

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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={dashboardQuery.isRefetching}
            onRefresh={() => {
              void dashboardQuery.refetch();
            }}
          />
        }
      >
        <View style={styles.headerRowTop}>
          <Text style={styles.appName}>VoiceFit</Text>
          <Pressable style={styles.addButton} onPress={() => cc.open()} testID="home-add-button">
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>

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
                {hasData || active ? (
                  <View style={[styles.dayDot, active && styles.dayDotActive]} />
                ) : null}
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
            <View style={styles.heroSection}>
              {isDashboardInitialLoading ? (
                <View style={styles.heroLoadingWrap}>
                  <View style={styles.heroLoadingRing}>
                    <LoadingBlock width={132} height={46} radius={16} />
                    <LoadingBlock width={86} height={18} radius={9} style={styles.heroLoadingLabel} />
                  </View>
                </View>
              ) : (
                <CalorieRing consumed={todayCaloriesConsumed} goal={todayCaloriesGoal} />
              )}
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <View style={styles.metricTopRow}>
                  <Text style={styles.metricLabel}>STEPS</Text>
                  {isDashboardInitialLoading ? (
                    <LoadingBlock width={40} height={40} radius={20} />
                  ) : (
                    <MiniStepsRing current={todaySteps} goal={todayStepsGoal} />
                  )}
                </View>
                {isDashboardInitialLoading ? (
                  <>
                    <LoadingBlock width={96} height={42} radius={12} />
                    <LoadingBlock width={88} height={18} radius={9} style={styles.metricLoadingSub} />
                  </>
                ) : (
                  <>
                    <Text style={styles.metricMainValue}>{todaySteps.toLocaleString()}</Text>
                    <View style={styles.metricSubRow}>
                      <Text style={styles.metricSubValue}>of {todayStepsGoal.toLocaleString()}</Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricTopRow}>
                  <Text style={styles.metricLabel}>WEIGHT</Text>
                  {isDashboardInitialLoading ? <LoadingBlock width={44} height={40} radius={10} /> : <WeightSparkline />}
                </View>
                {isDashboardInitialLoading ? (
                  <>
                    <LoadingBlock width={92} height={42} radius={12} />
                    <LoadingBlock width={116} height={18} radius={9} style={styles.metricLoadingSub} />
                  </>
                ) : (
                  <>
                    <View style={styles.metricValueRow}>
                      <Text style={styles.metricMainValue}>
                        {recentWeight == null ? "--" : recentWeight.toFixed(1)}
                      </Text>
                      <Text style={styles.metricUnit}>kg</Text>
                    </View>
                    <View style={styles.metricSubRow}>
                      <Text style={styles.metricSubValue}>goal: {DEFAULT_WEIGHT_GOAL} kg</Text>
                      {weightDelta != null ? (
                        <Text style={[styles.weightDelta, weightDelta <= 0 ? styles.weightDeltaGood : styles.weightDeltaBad]}>
                          {weightDelta <= 0 ? "↓" : "↑"} {Math.abs(weightDelta).toFixed(1)}
                        </Text>
                      ) : null}
                    </View>
                  </>
                )}
              </View>
            </View>

            <Pressable style={styles.coachCard} onPress={() => router.push("/(tabs)/coach")} testID="home-ask-coach">
              <CoachBadge />
              <View style={styles.coachTextWrap}>
                <Text style={styles.coachTitle}>Ask Coach</Text>
                <Text style={styles.coachSub}>Get AI insights on your trends</Text>
              </View>
              <Text style={styles.coachChevron}>›</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Weekly Trends</Text>
            <View style={styles.trendTabsRow}>
              {TREND_TABS.map((tab) => {
                const active = tab === trendTab;
                const label = tab.charAt(0).toUpperCase() + tab.slice(1);
                return (
                  <Pressable
                    key={tab}
                    style={[styles.trendTab, active && styles.trendTabActive]}
                    testID={`home-trend-tab-${tab}`}
                    onPress={() => setTrendTab(tab)}
                  >
                    <Text style={[styles.trendTabText, active && styles.trendTabTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={styles.trendCard}
              onLayout={(event) => {
                setChartWidth(event.nativeEvent.layout.width - 24);
              }}
            >
              <View style={styles.trendSummaryRow}>
                <View>
                  {isDashboardInitialLoading ? (
                    <>
                      <LoadingBlock width={140} height={30} radius={10} />
                      <LoadingBlock width={92} height={16} radius={8} style={styles.trendLoadingSub} />
                    </>
                  ) : (
                    <>
                      <Text style={styles.trendSummaryMain}>{renderTrendPrimary()}</Text>
                      <Text style={styles.trendSummarySub}>Last 7 days avg</Text>
                    </>
                  )}
                </View>
                {isDashboardInitialLoading ? (
                  <LoadingBlock width={110} height={18} radius={9} />
                ) : (
                  <Text style={[styles.trendChangeText, { color: trendChangeColor }]}>{renderTrendChange()}</Text>
                )}
              </View>

              {isDashboardInitialLoading ? (
                <View style={styles.trendLoadingWrap}>
                  <LoadingBlock width={"100%"} height={120} radius={18} />
                </View>
              ) : (
                <>
                  <Svg width="100%" height={160} viewBox={`0 0 ${trendChart.width} 160`}>
                    {trendChart.goalY != null ? (
                      <Line
                        x1={12}
                        x2={trendChart.width - 12}
                        y1={trendChart.goalY}
                        y2={trendChart.goalY}
                        stroke={COLORS.calories}
                        strokeDasharray="4 4"
                        strokeOpacity={0.45}
                        strokeWidth={1}
                      />
                    ) : null}
                    <Defs>
                      <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={metricColor(trendTab)} stopOpacity={0.18} />
                        <Stop offset="1" stopColor={metricColor(trendTab)} stopOpacity={0.01} />
                      </LinearGradient>
                    </Defs>
                    {trendChart.area ? <Path d={trendChart.area} fill="url(#trendFill)" /> : null}
                    {trendChart.line ? (
                      <Path
                        d={trendChart.line}
                        stroke={metricColor(trendTab)}
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                    {trendChart.points.map((point, index) => {
                      const edge = index === 0 || index === trendChart.points.length - 1;
                      return (
                        <SvgCircle
                          key={`${point.x}-${point.y}`}
                          cx={point.x}
                          cy={point.y}
                          r={edge ? 4 : 3}
                          fill={COLORS.bg}
                          stroke={metricColor(trendTab)}
                          strokeWidth={2}
                        />
                      );
                    })}
                  </Svg>

                  <View style={styles.trendDaysRow}>
                    {weeklyCurrent.map((point) => (
                      <Text key={point.date} style={styles.trendDayLabel}>
                        {formatTrendDay(point.date)}
                      </Text>
                    ))}
                  </View>
                </>
              )}
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Meals</Text>
              <Pressable onPress={() => router.push("/(tabs)/meals")} testID="home-recent-meals-see-all">
                <Text style={styles.sectionLink}>See All</Text>
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
                recentMeals.map((meal) => (
                  <View key={meal.id} style={styles.mealRow}>
                    <MealThumb description={meal.description} />
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealTitle}>{meal.description}</Text>
                      <Text style={styles.mealMeta}>
                        {meal.mealType} ·
                        {" "}
                        {new Date(meal.eatenAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No meals logged yet.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <FloatingCommandBar
        hint='"Had pasta for lunch..."'
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
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: COLORS.textPrimary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    fontSize: 22,
    lineHeight: 24,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  dayPickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 20,
  },
  dayItem: {
    width: 44,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    gap: 5,
  },
  dayItemActive: {
    backgroundColor: COLORS.textPrimary,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textTertiary,
  },
  dayLabelActive: {
    color: "rgba(255,255,255,0.55)",
  },
  dayLabelFaded: {
    color: "#D3D3D8",
  },
  dayNum: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  dayNumActive: {
    color: COLORS.bg,
  },
  dayNumFaded: {
    color: "#C7C7CC",
    fontWeight: "500",
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: COLORS.textSecondary,
  },
  dayDotActive: {
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 24,
  },
  heroLoadingWrap: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLoadingRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLoadingLabel: {
    marginTop: 10,
  },
  heroRingWrap: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  heroRingCenter: {
    position: "absolute",
    alignItems: "center",
  },
  heroRingNumber: {
    fontSize: 42,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -1.5,
    lineHeight: 42,
  },
  heroRingLabel: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  metricLoadingSub: {
    marginTop: 2,
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 40,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
  },
  metricMainValue: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: COLORS.textPrimary,
    lineHeight: 30,
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  metricUnit: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 2,
  },
  metricSubValue: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontWeight: "500",
  },
  metricSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 20,
  },
  weightDelta: {
    fontSize: 12,
    fontWeight: "600",
  },
  weightDeltaGood: {
    color: COLORS.steps,
  },
  weightDeltaBad: {
    color: COLORS.error,
  },
  coachCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coachBadge: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  coachTextWrap: {
    flex: 1,
  },
  coachTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    lineHeight: 16,
  },
  coachSub: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  coachChevron: {
    color: COLORS.textTertiary,
    fontSize: 18,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  trendTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  trendTab: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  trendTabActive: {
    backgroundColor: COLORS.textPrimary,
  },
  trendTabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "700",
  },
  trendTabTextActive: {
    color: COLORS.bg,
  },
  trendCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
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
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  trendSummarySub: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  trendChangeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  trendDaysRow: {
    marginTop: -6,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trendDayLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontWeight: "600",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  mealsWrap: {
    marginBottom: 12,
  },
  mealsLoadingWrap: {
    gap: 12,
    marginBottom: 8,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  mealThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  mealInfo: {
    flex: 1,
    gap: 2,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  mealMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  loadingBlock: {
    backgroundColor: "#ECECEF",
  },
  blockingErrorCard: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    backgroundColor: COLORS.surface,
  },
  blockingErrorTitle: {
    fontSize: 20,
    color: COLORS.textPrimary,
    fontWeight: "700",
  },
  blockingErrorBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  primaryActionButton: {
    borderRadius: 13,
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: 18,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: COLORS.bg,
    fontSize: 14,
    fontWeight: "700",
  },
});
