import { useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { DashboardData } from "@voicefit/contracts/types";
import Svg, {
  Circle as SvgCircle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polyline,
  Stop,
} from "react-native-svg";
import { apiRequest } from "../../lib/api-client";
import { FloatingCommandBar } from "../../components/FloatingCommandBar";
import { useCommandCenter, toLocalDateString } from "../../components/command-center";
import { Wordmark } from "../../components/pulse";
import { color as token, font, radius as r } from "../../lib/tokens";
import { type TrendMetric, getISOWeek, safeNumber, metricValueFromPoint } from "../../lib/trends";

const TAB_LABELS: Record<TrendMetric, string> = {
  calories: "Calories",
  steps: "Steps",
  weight: "Weight",
};
const TABS: TrendMetric[] = ["calories", "steps", "weight"];

const METRIC_GOALS: Record<TrendMetric, number | null> = {
  calories: 2100,
  steps: 10000,
  weight: 70,
};

const CHART_HEIGHT = 140;
const GRID_LINES = [0, 35, 70, 105, 140] as const;

function formatAverage(metric: TrendMetric, avg: number | null): { num: string; unit: string } {
  if (avg == null) return { num: "—", unit: unitFor(metric) };
  if (metric === "calories") return { num: Math.round(avg).toLocaleString(), unit: "kcal/day" };
  if (metric === "steps") return { num: Math.round(avg).toLocaleString(), unit: "steps/day" };
  return { num: avg.toFixed(1), unit: "kg avg" };
}

function unitFor(metric: TrendMetric) {
  if (metric === "calories") return "kcal/day";
  if (metric === "steps") return "steps/day";
  return "kg avg";
}

function lastSevenDayLabels(): string[] {
  // Returns short weekday names in chronological order ending today.
  const out: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toLocaleDateString("en-US", { weekday: "short" }));
  }
  return out;
}

type MealAggregate = { key: string; name: string; count: number; kcal: number };

function aggregateTopMeals(recentMeals: DashboardData["recentMeals"]): MealAggregate[] {
  const map = new Map<string, MealAggregate>();
  for (const meal of recentMeals) {
    const key = meal.description.trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.kcal += meal.calories || 0;
    } else {
      map.set(key, { key, name: meal.description, count: 1, kcal: meal.calories || 0 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.kcal - a.kcal).slice(0, 4);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function isWebPreviewMode() {
  return __DEV__ && Platform.OS === "web";
}

function mockDashboard(date: string): DashboardData {
  const base = new Date();
  const trends = Array.from({ length: 14 }, (_, idx) => {
    const d = new Date(base);
    d.setDate(base.getDate() - (13 - idx));
    const cals = [1760, 1680, 1840, 1710, 1520, 1805, 1560, 1690, 1620, 1750, 1670, 1490, 1780, 1820][idx];
    const stp = [8400, 7100, 9100, 8020, 6900, 9500, 6842, 7001, 7320, 8120, 7900, 6400, 8700, 7420][idx];
    const wt = [73.4, 73.3, 73.2, 73.1, 73.0, 72.9, 72.8, 73.2, 73.0, 72.9, 72.8, 72.6, 72.5, 72.4][idx];
    return { date: toLocalDateString(d), calories: cals, steps: stp, weight: wt, workouts: 0 };
  });
  return {
    today: {
      calories: { consumed: 1820, goal: 2100 },
      steps: { count: 7420, goal: 10000 },
      weight: 72.4,
      workoutSessions: 0,
      workoutSets: 0,
    },
    weeklyTrends: trends,
    recentMeals: [
      { id: "1", description: "Oats, blueberries, whey", calories: 420, mealType: "breakfast", eatenAt: date },
      { id: "2", description: "Chicken caesar", calories: 520, mealType: "lunch", eatenAt: date },
      { id: "3", description: "Protein bar", calories: 220, mealType: "snack", eatenAt: date },
      { id: "4", description: "Greek yogurt", calories: 170, mealType: "snack", eatenAt: date },
      { id: "5", description: "Oats, blueberries, whey", calories: 420, mealType: "breakfast", eatenAt: date },
      { id: "6", description: "Chicken caesar", calories: 520, mealType: "lunch", eatenAt: date },
      { id: "7", description: "Protein bar", calories: 220, mealType: "snack", eatenAt: date },
      { id: "8", description: "Protein bar", calories: 220, mealType: "snack", eatenAt: date },
    ],
    recentExercises: [],
  };
}

export default function TrendsScreen() {
  const { getToken } = useAuth();
  const cc = useCommandCenter();
  const router = useRouter();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = toLocalDateString(new Date());
  const isWebPreview = isWebPreviewMode();

  const params = useLocalSearchParams<{ metric?: string }>();
  const initialTab: TrendMetric =
    params.metric === "steps" || params.metric === "weight" ? params.metric : "calories";
  const [tab, setTab] = useState<TrendMetric>(initialTab);
  const [chartWidth, setChartWidth] = useState(320);

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ["dashboard", timezone, today],
    queryFn: async () => {
      if (isWebPreview) return mockDashboard(today);
      const t = await getToken();
      if (!t) throw new Error("Not signed in");
      return apiRequest<DashboardData>(
        `/api/dashboard?${new URLSearchParams({ timezone, date: today })}`,
        { token: t }
      );
    },
  });

  const dashboard = dashboardQuery.data;
  const weeklyFull = dashboard?.weeklyTrends ?? [];
  const weeklyCurrent = weeklyFull.slice(-7);
  const weeklyPrior = weeklyFull.slice(-14, -7);

  const currentValues = useMemo(
    () =>
      weeklyCurrent
        .map((p) => safeNumber(metricValueFromPoint(p, tab)))
        .filter((v): v is number => v != null),
    [weeklyCurrent, tab]
  );

  const priorValues = useMemo(
    () =>
      weeklyPrior
        .map((p) => safeNumber(metricValueFromPoint(p, tab)))
        .filter((v): v is number => v != null),
    [weeklyPrior, tab]
  );

  const avgCurrent = useMemo(() => average(currentValues), [currentValues]);
  const avgPrior = useMemo(() => average(priorValues), [priorValues]);

  const change = useMemo(() => {
    if (avgCurrent == null || avgPrior == null || avgPrior === 0) return null;
    return ((avgCurrent - avgPrior) / avgPrior) * 100;
  }, [avgCurrent, avgPrior]);

  // For calories/weight: lower vs prior is good; for steps: higher is good.
  const changeIsGood = useMemo(() => {
    if (change == null) return false;
    if (tab === "steps") return change >= 0;
    return change <= 0;
  }, [change, tab]);

  // Pad the displayed series so we always render 7 columns (zeros where missing).
  const displaySeries = useMemo(() => {
    const out: number[] = [];
    let last = 0;
    for (const point of weeklyCurrent) {
      const v = safeNumber(metricValueFromPoint(point, tab));
      if (v == null) {
        out.push(last);
      } else {
        out.push(v);
        last = v;
      }
    }
    while (out.length < 7) out.push(0);
    return out.slice(-7);
  }, [weeklyCurrent, tab]);

  const goal = METRIC_GOALS[tab];

  // SVG chart math: map series to 320×140 viewBox to match the reference design.
  const chartCoords = useMemo(() => {
    const vbW = 320;
    const vbH = CHART_HEIGHT;
    const min = Math.min(...displaySeries, goal ?? Infinity);
    const max = Math.max(...displaySeries, goal ?? -Infinity);
    const range = max - min || 1;
    const padTop = 8;
    const padBottom = 8;

    const ys = displaySeries.map((v) => {
      const norm = (v - min) / range;
      return vbH - padBottom - norm * (vbH - padTop - padBottom);
    });
    const xs = displaySeries.map((_, i) => {
      if (displaySeries.length === 1) return vbW / 2;
      return (i * vbW) / (displaySeries.length - 1);
    });

    const points = xs.map((x, i) => ({ x, y: ys[i] ?? vbH - padBottom }));
    const polyline = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const closedPath =
      points.length > 0
        ? `M${polyline.replaceAll(" ", " L")} L${vbW},${vbH} L0,${vbH} Z`
        : "";

    let goalY: number | null = null;
    if (goal != null) {
      const norm = (goal - min) / range;
      goalY = vbH - padBottom - norm * (vbH - padTop - padBottom);
    }

    return { vbW, vbH, points, polyline, closedPath, goalY };
  }, [displaySeries, goal]);

  const dayLabels = useMemo(() => lastSevenDayLabels(), []);
  const weekNumber = useMemo(() => getISOWeek(new Date()), []);

  const topMeals = useMemo(
    () => aggregateTopMeals(dashboard?.recentMeals ?? []),
    [dashboard?.recentMeals]
  );
  const topKcal = topMeals.length ? Math.max(...topMeals.map((m) => m.kcal), 1) : 1;

  const avgDisplay = formatAverage(tab, avgCurrent);

  const goalLabel = useMemo(() => {
    if (tab === "calories" && goal != null) return `Goal · ${goal.toLocaleString()} kcal`;
    if (tab === "steps" && goal != null) return `Goal · ${goal.toLocaleString()} steps`;
    return null;
  }, [tab, goal]);

  function onChartLayout(e: LayoutChangeEvent) {
    setChartWidth(e.nativeEvent.layout.width);
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.headerRow}>
        <Wordmark size={22} />
        <Text style={styles.weekEyebrow}>Week {weekNumber}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tabsRow}>
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tabPill, active && styles.tabPillActive]}
                testID={`trends-tab-${t}`}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{TAB_LABELS[t]}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.bigCard}>
          <View style={styles.bigCardTopRow}>
            <View style={styles.bigCardLeft}>
              <Text style={styles.smallLabel}>7-day average</Text>
              <View style={styles.avgRow}>
                <Text style={styles.avgNum}>{avgDisplay.num}</Text>
                <Text style={styles.avgUnit}>{avgDisplay.unit}</Text>
              </View>
            </View>
            <View style={styles.bigCardRight}>
              <Text
                style={[
                  styles.changeText,
                  { color: change == null ? token.textMute : changeIsGood ? token.accent : token.textMute },
                ]}
              >
                {change == null
                  ? "—"
                  : `${change >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(change))}%`}
              </Text>
              <Text style={styles.vsLabel}>vs last 7</Text>
            </View>
          </View>

          <View style={styles.chartWrap} onLayout={onChartLayout}>
            <Svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 ${chartCoords.vbW} ${chartCoords.vbH}`}
              preserveAspectRatio="none"
            >
              <Defs>
                <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={token.accent} stopOpacity={0.4} />
                  <Stop offset="100%" stopColor={token.accent} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {GRID_LINES.map((y) => (
                <Line
                  key={y}
                  x1={0}
                  y1={y}
                  x2={chartCoords.vbW}
                  y2={y}
                  stroke={token.line}
                  strokeDasharray="2 4"
                />
              ))}
              {chartCoords.goalY != null ? (
                <Line
                  x1={0}
                  y1={chartCoords.goalY}
                  x2={chartCoords.vbW}
                  y2={chartCoords.goalY}
                  stroke="rgba(199,251,65,0.5)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ) : null}
              {chartCoords.closedPath ? (
                <Path d={chartCoords.closedPath} fill="url(#chartFill)" />
              ) : null}
              {chartCoords.polyline ? (
                <Polyline
                  points={chartCoords.polyline}
                  fill="none"
                  stroke={token.accent}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {chartCoords.points.map((p, i) => (
                <SvgCircle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={token.bg}
                  stroke={token.accent}
                  strokeWidth={2}
                />
              ))}
            </Svg>
          </View>

          <View style={styles.dayLabelsRow}>
            {dayLabels.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.dayLabel}>{d}</Text>
            ))}
          </View>

          {goalLabel ? (
            <View style={styles.goalRow}>
              <View style={styles.goalLine} />
              <Text style={styles.goalLabel}>{goalLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Top meals this week</Text>
          <Pressable onPress={() => router.push("/meals")} hitSlop={8}>
            <Text style={styles.sectionLink}>All meals</Text>
          </Pressable>
        </View>

        <View style={styles.topMealsCard}>
          {topMeals.length === 0 ? (
            <Text style={styles.emptyText}>
              No meals this week yet — log some to see your top.
            </Text>
          ) : (
            topMeals.map((meal, i) => {
              const widthPct = Math.max(4, (meal.kcal / topKcal) * 100);
              return (
                <View key={meal.key} style={styles.mealRow}>
                  <View style={styles.mealRowTop}>
                    <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                    <Text style={styles.mealCount}>{meal.count}×</Text>
                    <Text style={styles.mealKcal}>{meal.kcal.toLocaleString()}</Text>
                  </View>
                  <View style={styles.mealTrack}>
                    <View
                      style={[
                        styles.mealFill,
                        {
                          width: `${widthPct}%`,
                          backgroundColor: i === 0 ? token.accent : token.textSoft,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
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
    backgroundColor: token.bg,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 146,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  weekEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.32,
    color: token.textMute,
    textTransform: "uppercase",
  },
  tabsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  tabPill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  tabPillActive: {
    backgroundColor: token.accent,
    borderColor: "transparent",
  },
  tabText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.24,
    color: token.textSoft,
  },
  tabTextActive: {
    color: token.accentInk,
  },
  bigCard: {
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.lg,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 18,
  },
  bigCardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  bigCardLeft: {
    flexShrink: 1,
  },
  bigCardRight: {
    alignItems: "flex-end",
  },
  smallLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.textMute,
  },
  avgRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 8,
  },
  avgNum: {
    fontFamily: font.mono[500],
    fontSize: 44,
    fontWeight: "500",
    letterSpacing: -1.76,
    color: token.text,
    lineHeight: 44,
  },
  avgUnit: {
    fontFamily: font.sans[400],
    fontSize: 13,
    color: token.textMute,
  },
  changeText: {
    fontFamily: font.sans[700],
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.47,
    textTransform: "uppercase",
  },
  vsLabel: {
    fontFamily: font.sans[400],
    fontSize: 11,
    color: token.textMute,
    marginTop: 2,
  },
  chartWrap: {
    marginTop: 22,
    height: CHART_HEIGHT,
    position: "relative",
  },
  dayLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  dayLabel: {
    fontFamily: font.sans[400],
    fontSize: 10,
    color: token.textMute,
    letterSpacing: 0.8,
  },
  goalRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  goalLine: {
    width: 16,
    height: 1,
    backgroundColor: "rgba(199,251,65,0.6)",
  },
  goalLabel: {
    fontFamily: font.sans[400],
    fontSize: 11,
    color: "rgba(199,251,65,0.6)",
    letterSpacing: 0.88,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: token.text,
  },
  sectionLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    color: token.accent,
  },
  topMealsCard: {
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.md,
    paddingVertical: 6,
  },
  mealRow: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  mealRowTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  mealName: {
    flex: 1,
    fontFamily: font.sans[500],
    fontSize: 13.5,
    fontWeight: "500",
    color: token.text,
  },
  mealCount: {
    fontFamily: font.mono[400],
    fontSize: 12,
    color: token.textMute,
    width: 60,
    textAlign: "right",
  },
  mealKcal: {
    fontFamily: font.mono[500],
    fontSize: 13,
    fontWeight: "500",
    color: token.text,
    width: 60,
    textAlign: "right",
  },
  mealTrack: {
    height: 3,
    backgroundColor: token.line,
    borderRadius: 2,
    overflow: "hidden",
  },
  mealFill: {
    height: "100%",
    borderRadius: 2,
  },
  emptyText: {
    fontFamily: font.sans[400],
    fontSize: 13,
    color: token.textSoft,
    padding: 18,
    textAlign: "center",
  },
});
