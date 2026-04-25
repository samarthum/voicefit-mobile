import { useEffect, useMemo, useState } from "react";
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
import { color as token, font, radius as r } from "../../lib/tokens";
import { Wordmark, LoadingBlock, OfflineBanner } from "../../components/pulse";
import NetInfo from "@react-native-community/netinfo";
import {
  type TrendMetric,
  TREND_TABS,
  safeNumber,
  buildLinePaths,
  metricValueFromPoint,
  metricColor,
} from "../../lib/trends";

type RecentMeal = DashboardData["recentMeals"][number];

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
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((s) => {
      setIsOffline(s.isConnected === false || s.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

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

  // Macros are not yet aggregated server-side on /api/dashboard. Until that ships,
  // these stay null and render as "—" placeholders inside the macro bars.
  const todayProtein: number | null = null;
  const todayCarbs: number | null = null;
  const todayFat: number | null = null;
  const todayProteinGoal = 140;
  const todayCarbsGoal = 210;
  const todayFatGoal = 70;

  const coachSummary = useMemo(() => {
    const remaining = todayCaloriesGoal - todayCaloriesConsumed;
    if (remaining > 200) return `${remaining.toLocaleString()} kcal left — plenty of room for dinner.`;
    if (remaining > 0) return `${remaining.toLocaleString()} kcal left — a light bite tops you up.`;
    if (remaining > -200) return "You're right on goal — nice steady day.";
    return `${Math.abs(remaining).toLocaleString()} kcal over — coach can suggest a leaner day tomorrow.`;
  }, [todayCaloriesGoal, todayCaloriesConsumed]);

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
                <Text style={styles.heroGoalText}>{todayCaloriesGoal.toLocaleString()} kcal goal</Text>
              </View>
              <View style={styles.heroBody}>
                {isDashboardInitialLoading ? (
                  <LoadingBlock width={150} height={150} radius={75} />
                ) : (
                  <CalorieRing consumed={todayCaloriesConsumed} goal={todayCaloriesGoal} />
                )}
                <View style={styles.heroRight}>
                  <Text style={styles.heroSummary}>
                    <Text style={styles.heroSummaryAccent}>
                      {Math.max(todayCaloriesGoal - todayCaloriesConsumed, 0).toLocaleString()} kcal
                    </Text>{" "}
                    left to hit your goal.
                  </Text>
                  <View style={styles.macroStack}>
                    <MacroBar label="Protein" current={todayProtein} goal={todayProteinGoal} tone="accent" />
                    <MacroBar label="Carbs" current={todayCarbs} goal={todayCarbsGoal} />
                    <MacroBar label="Fat" current={todayFat} goal={todayFatGoal} />
                  </View>
                </View>
              </View>
            </Pressable>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
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
                  <View style={[styles.metricThinFill, { width: `${progressPercent(todaySteps, todayStepsGoal) * 100}%` }]} />
                </View>
              </View>

              <View style={styles.metricCard}>
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
                <View style={styles.weightSparklineWrap}>
                  <WeightSparkline />
                </View>
              </View>
            </View>

            <Pressable style={styles.coachCard} onPress={() => router.push("/(tabs)/coach")} testID="home-ask-coach">
              <CoachBadge />
              <View style={styles.coachTextWrap}>
                <Text style={styles.coachTitle}>Ask coach</Text>
                <Text style={styles.coachSub}>{coachSummary}</Text>
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
                  return (
                    <View key={meal.id} style={[styles.mealRow, index === 0 && styles.mealRowFirst]}>
                      <Text style={styles.mealTime}>{hh}:{mm}</Text>
                      <View style={styles.mealInfo}>
                        <Text style={styles.mealTitle} numberOfLines={1}>{meal.description}</Text>
                        <Text style={styles.mealMeta}>{meal.mealType}</Text>
                      </View>
                      <View style={styles.mealKcalRow}>
                        <Text style={styles.mealKcalNum}>{meal.calories}</Text>
                        <Text style={styles.mealKcalUnit}>kcal</Text>
                      </View>
                    </View>
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: token.line,
  },
  mealRowFirst: {
    borderTopWidth: 0,
  },
  mealTime: {
    width: 44,
    fontFamily: font.mono[400],
    fontSize: 11,
    color: token.textMute,
  },
  mealThumb: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: token.surface2,
    alignItems: "center",
    justifyContent: "center",
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
  mealMeta: {
    marginTop: 2,
    fontFamily: font.sans[600],
    fontSize: 10.5,
    color: token.textMute,
    letterSpacing: 0.84,
    textTransform: "uppercase",
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
