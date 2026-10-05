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
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { DashboardData, TopMealsResponse } from "@voicefit/contracts/types";
import Svg, { Line } from "react-native-svg";
import { apiRequest } from "@/lib/api-client";
import { FloatingCommandBar } from "@/components/FloatingCommandBar";
import { useCommandCenter, toLocalDateString } from "@/components/command-center";
import { color as token, font, radius as r } from "@/lib/tokens";
import { isWebPreviewMode } from "@/lib/web-preview-mode";
import { haptic } from "@/lib/haptics";

const CHART_HEIGHT = 150;

function lastSevenDays(): { date: string; label: string }[] {
  // Chronological, ending today.
  const out: { date: string; label: string }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ date: toLocalDateString(d), label: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }) })
  }
  return out;
}

type MealAggregate = { key: string; name: string; count: number; kcal: number };

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}


function mockTopMeals(): TopMealsResponse {
  return {
    windowDays: 7,
    meals: [
      { key: "chicken caesar", description: "Chicken caesar", count: 3, totalCalories: 1560, averageCalories: 520 },
      { key: "oats, blueberries, whey", description: "Oats, blueberries, whey", count: 2, totalCalories: 840, averageCalories: 420 },
      { key: "protein bar", description: "Protein bar", count: 3, totalCalories: 660, averageCalories: 220 },
      { key: "greek yogurt", description: "Greek yogurt", count: 1, totalCalories: 170, averageCalories: 170 },
    ],
  };
}

type MockDashboardData = Omit<DashboardData, "today" | "recentMeals"> & {
  today: DashboardData["today"] & { proteinGoal?: number };
  recentMeals: (DashboardData["recentMeals"][number] & { interpretationStatus?: string })[];
};

function mockDashboard(date: string): MockDashboardData {
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
      macros: { protein: 105, carbs: 180, fat: 58 },
      proteinGoal: 140,
      steps: { count: 7420, goal: 10000 },
      weight: 72.4,
      workoutSessions: 0,
      workoutSets: 0,
    },
    weeklyTrends: trends,
    recentMeals: [
      { id: "1", description: "Oats, blueberries, whey", calories: 420, mealType: "breakfast", interpretationStatus: "reviewed", eatenAt: date },
      { id: "2", description: "Chicken caesar", calories: 520, mealType: "lunch", interpretationStatus: "reviewed", eatenAt: date },
      { id: "3", description: "Protein bar", calories: 220, mealType: "snack", interpretationStatus: "reviewed", eatenAt: date },
      { id: "4", description: "Greek yogurt", calories: 170, mealType: "snack", interpretationStatus: "reviewed", eatenAt: date },
      { id: "5", description: "Oats, blueberries, whey", calories: 420, mealType: "breakfast", interpretationStatus: "reviewed", eatenAt: date },
      { id: "6", description: "Chicken caesar", calories: 520, mealType: "lunch", interpretationStatus: "reviewed", eatenAt: date },
      { id: "7", description: "Protein bar", calories: 220, mealType: "snack", interpretationStatus: "reviewed", eatenAt: date },
      { id: "8", description: "Protein bar", calories: 220, mealType: "snack", interpretationStatus: "reviewed", eatenAt: date },
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

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ["dashboard", "full", timezone, today],
    queryFn: async () => {
      if (isWebPreview) return mockDashboard(today);
      const t = await getToken();
      if (!t) throw new Error("Not signed in");
      return apiRequest<DashboardData>(
        `/api/dashboard?${new URLSearchParams({ timezone, date: today, scope: "full" })}`,
        { token: t }
      );
    },
  });

  const TOP_MEALS_DAYS = 7;
  const TOP_MEALS_LIMIT = 5;
  const topMealsQuery = useQuery<TopMealsResponse>({
    queryKey: ["top-meals", TOP_MEALS_DAYS, TOP_MEALS_LIMIT],
    queryFn: async () => {
      if (isWebPreview) return mockTopMeals();
      const t = await getToken();
      if (!t) throw new Error("Not signed in");
      return apiRequest<TopMealsResponse>(
        `/api/meals/top?${new URLSearchParams({ days: String(TOP_MEALS_DAYS), limit: String(TOP_MEALS_LIMIT) })}`,
        { token: t }
      );
    },
  });

  const dashboard = dashboardQuery.data;
  const goal = dashboard?.today.calories.goal ?? null;
  const days = useMemo(() => lastSevenDays(), []);

  // The API reports 0 kcal for days with nothing logged. Those are gaps, not
  // fasting days, so they're left out of the averages and drawn as stubs.
  const { series, avgCurrent, loggedDays, change } = useMemo(() => {
    const byDate = new Map((dashboard?.weeklyTrends ?? []).map((p) => [p.date, p.calories]));
    const logged = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
    const values = days.map((d) => byDate.get(d.date));
    const current = values.filter(logged);
    const prior = (dashboard?.weeklyTrends ?? []).slice(-14, -7).map((p) => p.calories).filter(logged);
    const avg = average(current);
    const avgPrior = average(prior);
    return {
      series: values.map((v) => (logged(v) ? v : null)),
      avgCurrent: avg,
      loggedDays: current.length,
      change: avg != null && avgPrior != null && avgPrior > 0 ? ((avg - avgPrior) / avgPrior) * 100 : null,
    };
  }, [dashboard, days]);

  const scaleMax = Math.max(...series.map((v) => v ?? 0), goal ?? 0, 1) * 1.12;
  const goalBottom = goal != null ? (goal / scaleMax) * CHART_HEIGHT : null;

  const topMeals = useMemo<MealAggregate[]>(
    () =>
      (topMealsQuery.data?.meals ?? []).map((item) => ({
        key: item.key,
        name: item.description,
        count: item.count,
        kcal: item.totalCalories,
      })),
    [topMealsQuery.data]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Calories" }} />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {!dashboard ? (
          <View style={[styles.bigCard, styles.centered]}>
            {dashboardQuery.isError ? (
              <>
                <Text style={styles.emptyText}>Couldn’t load your calories. Your data hasn’t changed.</Text>
                <Pressable accessibilityRole="button" style={{ padding: 12 }} onPress={() => void dashboardQuery.refetch()}>
                  <Text style={styles.sectionLink}>Try again</Text>
                </Pressable>
              </>
            ) : <ActivityIndicator color={token.accent} accessibilityLabel="Loading calories" />}
          </View>
        ) : (
          <View style={styles.bigCard} testID="trends-calories-card">
            <Text style={styles.smallLabel}>Daily average · last 7 days</Text>
            <View style={styles.avgRow}>
              <Text selectable style={styles.avgNum}>{avgCurrent == null ? "—" : Math.round(avgCurrent).toLocaleString()}</Text>
              <Text style={styles.avgUnit}>kcal</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {loggedDays === 0 ? "No meals logged this week" : `Across ${loggedDays} logged ${loggedDays === 1 ? "day" : "days"}`}
              </Text>
              {change != null && Math.round(change) !== 0 ? (
                <View style={styles.changeChip}>
                  <Text style={styles.changeText}>{change > 0 ? "↑" : "↓"} {Math.abs(Math.round(change))}% vs prior week</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.chart} accessible accessibilityLabel={days.map((d, i) => `${d.label}: ${series[i] == null ? "nothing logged" : `${Math.round(series[i]!)} kcal`}`).join(", ")}>
              {goalBottom != null ? (
                <View pointerEvents="none" style={[styles.goalLayer, { bottom: goalBottom }]}>
                  <Svg width="100%" height={2}>
                    <Line x1="0" y1="1" x2="100%" y2="1" stroke={token.accent} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 4" />
                  </Svg>
                  <Text style={styles.goalTag}>Goal {goal!.toLocaleString()}</Text>
                </View>
              ) : null}
              {series.map((value, i) => {
                const isToday = i === series.length - 1;
                const over = value != null && goal != null && value > goal;
                return (
                  <View key={days[i].date} style={styles.barCol}>
                    {value == null ? (
                      <View style={styles.barEmpty} />
                    ) : (
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(6, (value / scaleMax) * CHART_HEIGHT) },
                          over && styles.barOver,
                          !isToday && styles.barPast,
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.dayRow}>
              {days.map((d, i) => (
                <Text key={d.date} style={[styles.dayLabel, i === days.length - 1 && styles.dayLabelToday]}>{d.label}</Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Top meals this week</Text>
          <Pressable onPress={() => router.push("/meals")} hitSlop={8} accessibilityRole="link">
            <Text style={styles.sectionLink}>All meals</Text>
          </Pressable>
        </View>

        <View style={styles.topMealsCard}>
          {topMealsQuery.isError ? (
            <Pressable accessibilityRole="button" onPress={() => void topMealsQuery.refetch()}><Text style={styles.emptyText}>Couldn’t load top meals. Tap to retry.</Text></Pressable>
          ) : topMealsQuery.isLoading ? <ActivityIndicator style={{ padding: 18 }} color={token.accent} /> : topMeals.length === 0 ? (
            <Text style={styles.emptyText}>Log a few meals and your most-eaten ones will show up here.</Text>
          ) : (
            topMeals.map((meal, i) => (
              <View key={meal.key} style={[styles.mealRow, i > 0 && styles.mealRowDivider]}>
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={styles.mealCopy}>
                  <Text style={styles.mealName} numberOfLines={2}>{meal.name}</Text>
                  <Text style={styles.mealMeta}>
                    {meal.count === 1 ? "Once" : `${meal.count} times`}
                    {meal.count > 1 ? ` · ${Math.round(meal.kcal / meal.count).toLocaleString()} kcal each` : ""}
                  </Text>
                </View>
                <View style={styles.mealKcalCol}>
                  <Text selectable style={styles.mealKcal}>{Math.round(meal.kcal).toLocaleString()}</Text>
                  <Text style={styles.mealKcalUnit}>kcal</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <FloatingCommandBar
        safeAreaBottom
        hint="Log a meal…"
        onPress={() => cc.open()}
        onMicPress={() => cc.startRecording()}
        onPhotoPress={() => void cc.openPhoto()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: token.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 146 },
  centered: { alignItems: "center", justifyContent: "center", minHeight: 200 },
  bigCard: {
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.lg,
    borderCurve: "continuous",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  smallLabel: { fontFamily: font.sans[500], fontSize: 13, color: token.textMute },
  avgRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6 },
  avgNum: {
    fontFamily: font.mono[500],
    fontSize: 40,
    fontWeight: "500",
    letterSpacing: -1.6,
    color: token.text,
    lineHeight: 44,
  },
  avgUnit: { fontFamily: font.sans[500], fontSize: 15, color: token.textMute },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 },
  metaText: { fontFamily: font.sans[400], fontSize: 13, color: token.textSoft },
  changeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: r.pill,
    backgroundColor: token.surface2,
  },
  changeText: { fontFamily: font.sans[600], fontSize: 12, fontWeight: "600", color: token.textSoft },
  chart: {
    marginTop: 24,
    height: CHART_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: token.line2,
  },
  goalLayer: { position: "absolute", left: 0, right: 0, height: 2, zIndex: 1 },
  goalTag: {
    position: "absolute",
    right: 0,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: token.surface,
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    color: token.accent,
  },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: 22, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: token.accent },
  barPast: { opacity: 0.45 },
  barOver: { backgroundColor: token.warn },
  barEmpty: { width: 22, height: 3, borderRadius: 2, backgroundColor: token.line2, marginBottom: 2 },
  dayRow: { flexDirection: "row", marginTop: 8 },
  dayLabel: { flex: 1, textAlign: "center", fontFamily: font.sans[400], fontSize: 11, color: token.textMute },
  dayLabelToday: { fontFamily: font.sans[600], fontWeight: "600", color: token.text },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: { fontFamily: font.sans[700], fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: token.text },
  sectionLink: { fontFamily: font.sans[600], fontSize: 14, fontWeight: "600", color: token.accent },
  topMealsCard: {
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: r.md,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  mealRowDivider: { borderTopWidth: 1, borderTopColor: token.line },
  rank: { width: 16, fontFamily: font.mono[500], fontSize: 13, color: token.textMute, textAlign: "center" },
  mealCopy: { flex: 1, minWidth: 0 },
  mealName: { fontFamily: font.sans[500], fontSize: 15, lineHeight: 20, fontWeight: "500", color: token.text },
  mealMeta: { marginTop: 2, fontFamily: font.sans[400], fontSize: 12.5, color: token.textMute },
  mealKcalCol: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  mealKcal: { fontFamily: font.mono[500], fontSize: 15, fontWeight: "500", color: token.text },
  mealKcalUnit: { fontFamily: font.sans[400], fontSize: 11, color: token.textMute },
  emptyText: {
    fontFamily: font.sans[400],
    fontSize: 14,
    lineHeight: 20,
    color: token.textSoft,
    padding: 18,
    textAlign: "center",
  },
});
