import type { DashboardData } from "@voicefit/contracts/types";
import { COLORS } from "../components/command-center";

export type TrendMetric = "calories" | "steps" | "weight";

export const TREND_TABS: TrendMetric[] = ["calories", "steps", "weight"];

export function safeNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function metricValueFromPoint(
  point: DashboardData["weeklyTrends"][number],
  metric: TrendMetric
): number | null {
  if (metric === "calories") return point.calories;
  if (metric === "steps") return point.steps;
  return point.weight;
}

export function metricColor(metric: TrendMetric): string {
  if (metric === "calories") return COLORS.calories;
  if (metric === "steps") return COLORS.steps;
  return COLORS.weight;
}

export type ChartPoint = { x: number; y: number; value: number };

export type LinePathsResult = {
  points: ChartPoint[];
  line: string;
  area: string;
  innerBottom: number;
  goalY: number | null;
  width: number;
};

export function buildLinePaths(
  values: number[],
  width: number,
  height: number,
  metric: TrendMetric,
  calorieGoal = 2000
): LinePathsResult {
  const innerLeft = 10;
  const innerRight = width - 10;
  const innerTop = 12;
  const innerBottom = height - 30;

  const nonEmpty = values.length > 0;
  const min = nonEmpty ? Math.min(...values) : 0;
  const max = nonEmpty ? Math.max(...values) : 1;
  const range = max - min || 1;

  const points: ChartPoint[] = values.map((value, index) => {
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

// ISO 8601 week number — used for the "WEEK NN" eyebrow.
export function getISOWeek(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}
