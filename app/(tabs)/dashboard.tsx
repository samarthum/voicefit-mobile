import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Audio } from "expo-av";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { DashboardData, InterpretEntryResponse } from "@voicefit/contracts/types";
import Svg, {
  Circle as SvgCircle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { apiFormRequest, apiRequest } from "../../lib/api-client";

type TrendMetric = "calories" | "steps" | "weight";

type CommandState =
  | "cc_collapsed"
  | "cc_expanded_empty"
  | "cc_expanded_typing"
  | "cc_submitting_typed"
  | "cc_recording"
  | "cc_interpreting_voice"
  | "cc_review_meal"
  | "cc_review_workout"
  | "cc_saving"
  | "cc_auto_saving"
  | "cc_quick_add_saving"
  | "cc_error";

type CommandErrorSubtype =
  | "typed_interpret_failure"
  | "voice_interpret_failure"
  | "mic_permission_denied"
  | "auto_save_failure"
  | "quick_add_failure"
  | null;

type EntrySource = "text" | "voice";

type RecentMeal = DashboardData["recentMeals"][number];

interface WorkoutSessionListItem {
  id: string;
  endedAt: string | null;
}

interface WorkoutSessionsResponse {
  sessions: WorkoutSessionListItem[];
}

interface QuickAddItem {
  id: string;
  description: string;
  calories: number;
  mealType: string;
}

type SaveAction =
  | {
      kind: "entry";
      interpreted: InterpretEntryResponse;
      transcript: string;
      source: EntrySource;
    }
  | {
      kind: "quick_add";
      item: QuickAddItem;
    };

interface MealReviewIngredient {
  id: string;
  name: string;
  quantity: string;
  calories: number;
}

interface MealReviewDraft {
  kind: "meal";
  interpreted: Extract<InterpretEntryResponse, { intent: "meal" }>;
  transcript: string;
  source: EntrySource;
  confidence: number;
  eatenAtLabel: string;
  ingredients: MealReviewIngredient[];
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface WorkoutReviewSet {
  id: string;
  setNumber: number;
  weightKg: string;
  reps: string;
  notes: string;
}

interface WorkoutReviewDraft {
  kind: "workout";
  interpreted: Extract<InterpretEntryResponse, { intent: "workout_set" }>;
  transcript: string;
  source: EntrySource;
  confidence: number;
  exerciseTypeLabel: string;
  sessionLabel: string;
  sets: WorkoutReviewSet[];
}

type ReviewDraft = MealReviewDraft | WorkoutReviewDraft;

const COLORS = {
  bg: "#FFFFFF",
  surface: "#F8F8F8",
  border: "#E8E8E8",
  textPrimary: "#1A1A1A",
  textSecondary: "#8E8E93",
  textTertiary: "#AEAEB2",
  calories: "#FF9500",
  steps: "#34C759",
  weight: "#007AFF",
  error: "#FF3B30",
  ringTrack: "#F0F0F0",
  black: "#111111",
};

const TREND_TABS: TrendMetric[] = ["calories", "steps", "weight"];
const MIN_RECORDING_DURATION_MS = 1000;
const DEFAULT_WEIGHT_GOAL = 70;
const WEB_PREVIEW_FLAGS_KEY = "__vf_home_preview_flags";
const WAVE_BAR_COUNT = 20;
const WAVE_MIN = 8;
const WAVE_MAX = 56;

function toLocalDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function formatMealTypeLabel(mealType: string) {
  if (!mealType) return "Meal";
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

function formatRecordingDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatClockTime(value: Date) {
  return value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return "High confidence";
  if (confidence >= 0.75) return "Medium confidence";
  return "Low confidence";
}

function parsePositiveNumber(value: string) {
  const num = Number(value.trim());
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function mealIngredientQuantity(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("chicken")) return "150g";
  if (lower.includes("rice")) return "200g";
  if (lower.includes("salad") || lower.includes("greens")) return "90g";
  if (lower.includes("oat")) return "80g";
  if (lower.includes("salmon")) return "140g";
  return "1 serving";
}

function splitMealIngredients(description: string) {
  const cleaned = description
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned
    .split(/,| and /i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return [description.trim() || "Meal"];
  return parts.slice(0, 4);
}

function buildMealReviewDraft(
  interpreted: Extract<InterpretEntryResponse, { intent: "meal" }>,
  transcript: string,
  source: EntrySource
): MealReviewDraft {
  const totalCalories = Math.max(80, interpreted.payload.calories);
  const ingredientNames = splitMealIngredients(interpreted.payload.description);
  const ingredientCount = ingredientNames.length;
  const perIngredient = Math.max(20, Math.floor(totalCalories / ingredientCount));
  const remainder = totalCalories - perIngredient * ingredientCount;

  const ingredients: MealReviewIngredient[] = ingredientNames.map((name, index) => ({
    id: `${name}-${index}`,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    quantity: mealIngredientQuantity(name),
    calories: perIngredient + (index === ingredientCount - 1 ? remainder : 0),
  }));

  const protein = Math.round((totalCalories * 0.32) / 4);
  const carbs = Math.round((totalCalories * 0.46) / 4);
  const fat = Math.max(1, Math.round((totalCalories * 0.22) / 9));

  return {
    kind: "meal",
    interpreted,
    transcript,
    source,
    confidence: interpreted.payload.confidence,
    eatenAtLabel: formatClockTime(new Date()),
    ingredients,
    macros: { protein, carbs, fat },
  };
}

function parseWorkoutSetsFromTranscript(transcript: string) {
  const matches = [...transcript.matchAll(/(\d+(?:\.\d+)?)\s*(?:kg|kgs?|kilograms?)\s*(?:for|x)\s*(\d+)/gi)];
  return matches.slice(0, 8).map((match, index) => ({
    id: `set-${index + 1}`,
    setNumber: index + 1,
    weightKg: match[1],
    reps: match[2],
    notes: "",
  }));
}

function buildWorkoutReviewDraft(
  interpreted: Extract<InterpretEntryResponse, { intent: "workout_set" }>,
  transcript: string,
  source: EntrySource
): WorkoutReviewDraft {
  const parsedSets = parseWorkoutSetsFromTranscript(transcript);
  const fallbackSet: WorkoutReviewSet = {
    id: "set-1",
    setNumber: 1,
    weightKg: interpreted.payload.weightKg == null ? "" : String(interpreted.payload.weightKg),
    reps: interpreted.payload.reps == null ? "" : String(interpreted.payload.reps),
    notes: interpreted.payload.notes ?? "",
  };

  const sets = parsedSets.length ? parsedSets : [fallbackSet];

  return {
    kind: "workout",
    interpreted,
    transcript,
    source,
    confidence: interpreted.payload.confidence,
    exerciseTypeLabel: interpreted.payload.exerciseType === "resistance" ? "BARBELL" : "CARDIO",
    sessionLabel: interpreted.payload.exerciseType === "resistance" ? "Morning Push" : "Cardio Session",
    sets,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong. Please try again.";
}

function hasWebPreviewFlag(flag: string) {
  if (!__DEV__ || Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(WEB_PREVIEW_FLAGS_KEY) ?? "";
    const parts = raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return parts.includes(flag);
  } catch {
    return false;
  }
}

function progressPercent(current: number, goal: number) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(1, current / goal));
}

function buildWorkoutSystemText(payload: {
  exerciseName: string;
  exerciseType: "resistance" | "cardio";
  reps: number | null;
  weightKg: number | null;
  durationMinutes: number | null;
}) {
  const details: string[] = [];
  if (payload.exerciseType === "cardio") {
    if (payload.durationMinutes != null) details.push(`${payload.durationMinutes} min`);
  } else {
    if (payload.reps != null) details.push(`${payload.reps} reps`);
    if (payload.weightKg != null) details.push(`${payload.weightKg} kg`);
  }
  return `Logged ${payload.exerciseName}${details.length ? ` · ${details.join(" · ")}` : ""}`;
}

async function ensureQuickSession(token: string) {
  const date = toLocalDateString(new Date());
  const list = await apiRequest<WorkoutSessionsResponse>(
    `/api/workout-sessions?date=${date}&limit=5`,
    { token }
  );
  const active = list.sessions.find((session) => !session.endedAt);
  if (active) return active.id;

  const created = await apiRequest<{ id: string }>("/api/workout-sessions", {
    method: "POST",
    token,
    body: JSON.stringify({ title: "Quick Log" }),
  });
  return created.id;
}

function SparkleGlyph({ color = COLORS.textTertiary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
        fill={color}
      />
    </Svg>
  );
}

function MicGlyph({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15C9.79 15 8 13.21 8 11V6C8 3.79 9.79 2 12 2C14.21 2 16 3.79 16 6V11C16 13.21 14.21 15 12 15Z"
        stroke={color}
        strokeWidth={2}
      />
      <Path d="M5 10V11C5 14.87 8.13 18 12 18C15.87 18 19 14.87 19 11V10" stroke={color} strokeWidth={2} />
      <Path d="M12 18V22" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function CloseGlyph({ color = COLORS.textSecondary }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M2 2L12 12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 2L2 12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function KeyboardGlyph({ color = COLORS.textSecondary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M2 4.5H16C16.55 4.5 17 4.95 17 5.5V13.5C17 14.05 16.55 14.5 16 14.5H2C1.45 14.5 1 14.05 1 13.5V5.5C1 4.95 1.45 4.5 2 4.5Z" stroke={color} strokeWidth={1.8} />
      <Path d="M4.2 8H4.9M7.2 8H7.9M10.2 8H10.9M13.2 8H13.9M5 11H13" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function SendGlyph({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M5 12L2 17L16 9L2 1L5 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 12H9" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusGlyph({ color = COLORS.textSecondary }: { color?: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M6 1V11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 6H11" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckGlyph({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M13.2 3.8L6.2 12.2L2.8 8.8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AnimatedWaveform({ active }: { active: boolean }) {
  const anims = useRef(
    Array.from({ length: WAVE_BAR_COUNT }, () => new Animated.Value(WAVE_MIN + Math.random() * (WAVE_MAX - WAVE_MIN))),
  ).current;
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const animate = useCallback(() => {
    if (!isMounted.current) return;
    const animations = anims.map((anim) =>
      Animated.timing(anim, {
        toValue: WAVE_MIN + Math.random() * (WAVE_MAX - WAVE_MIN),
        duration: 300 + Math.random() * 200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: false,
      }),
    );
    Animated.parallel(animations).start(({ finished }) => {
      if (finished && isMounted.current) animate();
    });
  }, [anims]);

  useEffect(() => {
    if (active) {
      animate();
    } else {
      anims.forEach((anim) => anim.stopAnimation());
    }
  }, [active, animate, anims]);

  return (
    <View style={styles.waveform}>
      {anims.map((anim, index) => (
        <Animated.View
          key={`wave-${index}`}
          style={[styles.waveBar, { height: anim, opacity: index % 2 === 0 ? 0.9 : 0.55 }]}
        />
      ))}
    </View>
  );
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

function MealThumb() {
  return (
    <View style={styles.mealThumb}>
      <Ionicons name="restaurant-outline" size={22} color="#8E8E93" />
    </View>
  );
}

function QuickMealThumb() {
  return <Ionicons name="restaurant-outline" size={16} color="#8E8E93" />;
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 180;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const left = Math.max(goal - consumed, 0);
  const progress = progressPercent(left, goal);
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

function buildLinePaths(values: number[], width: number, height: number, metric: TrendMetric) {
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

  const goalValue = metric === "calories" ? 2000 : null;
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

const ERROR_COPY: Record<Exclude<CommandErrorSubtype, null>, {
  title: string;
  body: string;
  primary: string;
  secondary: string | null;
  tertiary: string | null;
}> = {
  typed_interpret_failure: {
    title: "Couldn't understand that entry",
    body: "Edit your text and try again.",
    primary: "Retry typed",
    secondary: "Edit text",
    tertiary: "Discard",
  },
  voice_interpret_failure: {
    title: "Couldn't understand your recording",
    body: "Retry voice or edit the transcript.",
    primary: "Retry voice",
    secondary: "Edit text",
    tertiary: "Discard",
  },
  mic_permission_denied: {
    title: "Microphone access is off",
    body: "Enable microphone in Settings to log by voice.",
    primary: "Open Settings",
    secondary: "Use typing instead",
    tertiary: "Discard",
  },
  auto_save_failure: {
    title: "Couldn't save right now",
    body: "We kept your entry. Try saving again.",
    primary: "Retry save",
    secondary: "Discard",
    tertiary: null,
  },
  quick_add_failure: {
    title: "Couldn't add that item",
    body: "Please try again.",
    primary: "Retry save",
    secondary: "Discard",
    tertiary: null,
  },
};

export default function DashboardScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isWebPreview = __DEV__ && Platform.OS === "web";

  const today = toLocalDateString(new Date());
  const dayOptions = useMemo(() => getLastSevenDaysEndingToday(), []);

  const [selectedDate, setSelectedDate] = useState(today);
  const [trendTab, setTrendTab] = useState<TrendMetric>("calories");
  const [chartWidth, setChartWidth] = useState(320);

  const [commandState, setCommandState] = useState<CommandState>("cc_collapsed");
  const [commandText, setCommandText] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isInterpretingVoice, setIsInterpretingVoice] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);

  const [commandToast, setCommandToast] = useState<string | null>(null);
  const [commandErrorSubtype, setCommandErrorSubtype] = useState<CommandErrorSubtype>(null);
  const [commandErrorDetail, setCommandErrorDetail] = useState<string | null>(null);

  const pendingSaveRef = useRef<SaveAction | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!commandToast) return;
    toastTimerRef.current = setTimeout(() => setCommandToast(null), 2200);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [commandToast]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  useEffect(() => {
    if (commandState !== "cc_recording") return;
    if (!isWebPreview) return;
    const timer = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [commandState, isWebPreview]);

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
  const quickAddItems: QuickAddItem[] =
    recentMeals.length > 0
      ? recentMeals.map((meal) => ({
          id: meal.id,
          description: meal.description,
          calories: meal.calories,
          mealType: meal.mealType,
        }))
      : [
          { id: "q1", description: "Chicken Salad", calories: 450, mealType: "lunch" },
          { id: "q2", description: "Overnight Oats", calories: 320, mealType: "breakfast" },
        ];
  const displayedQuickAddItems = quickAddItems.slice(0, 3);

  const metricCurrentValues = weeklyCurrent
    .map((point) => metricValueFromPoint(point, trendTab))
    .map((value) => safeNumber(value));

  const normalizedTrendValues = useMemo(() => {
    let last = 0;
    return metricCurrentValues.map((value) => {
      if (value == null) return last;
      last = value;
      return value;
    });
  }, [metricCurrentValues]);

  const trendChart = useMemo(
    () => buildLinePaths(normalizedTrendValues, chartWidth - 8, 160, trendTab),
    [normalizedTrendValues, chartWidth, trendTab]
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

  const todayCaloriesConsumed = dashboard?.today.calories.consumed ?? 0;
  const todayCaloriesGoal = dashboard?.today.calories.goal ?? 2000;

  const todaySteps = dashboard?.today.steps.count ?? 0;
  const todayStepsGoal = dashboard?.today.steps.goal ?? 10000;

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

  const closeCommandCenter = () => {
    setCommandState("cc_collapsed");
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    setIsInterpretingVoice(false);
    setReviewDraft(null);
  };

  const openCommandCenter = () => {
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    setCommandState(commandText.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
  };

  const setCommandError = (subtype: Exclude<CommandErrorSubtype, null>, detail?: string) => {
    setCommandErrorSubtype(subtype);
    setCommandErrorDetail(detail ?? null);
    setCommandState("cc_error");
  };

  const refreshAfterSave = async () => {
    if (isWebPreview) {
      await dashboardQuery.refetch();
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["workout-sessions"] });
    await queryClient.invalidateQueries({ queryKey: ["meals"] });
  };

  const runSaveAction = async (action: SaveAction) => {
    pendingSaveRef.current = action;
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);
    setCommandState(action.kind === "quick_add" ? "cc_quick_add_saving" : "cc_saving");

    try {
      if (isWebPreview) {
        if (action.kind === "entry" && hasWebPreviewFlag("save_fail")) {
          throw new Error("Mock auto-save failure.");
        }
        if (action.kind === "quick_add" && hasWebPreviewFlag("quick_add_fail")) {
          throw new Error("Mock quick-add save failure.");
        }
        await new Promise((resolve) => setTimeout(resolve, 550));
        await refreshAfterSave();
        setCommandToast("Saved");
        closeCommandCenter();
        return;
      }

      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      if (action.kind === "quick_add") {
        await apiRequest("/api/meals", {
          method: "POST",
          token,
          body: JSON.stringify({
            eatenAt: new Date().toISOString(),
            mealType: action.item.mealType,
            description: action.item.description,
            calories: action.item.calories,
            transcriptRaw: `quick_add:${action.item.description}`,
          }),
        });

        await refreshAfterSave();
        setCommandToast("Saved");
        closeCommandCenter();
        return;
      }

      const { interpreted, transcript, source } = action;

      if (interpreted.intent === "meal") {
        await apiRequest("/api/meals", {
          method: "POST",
          token,
          body: JSON.stringify({
            eatenAt: new Date().toISOString(),
            mealType: interpreted.payload.mealType,
            description: interpreted.payload.description,
            calories: interpreted.payload.calories,
            transcriptRaw: transcript,
          }),
        });
      } else if (interpreted.intent === "workout_set") {
        const sessionId = await ensureQuickSession(token);
        await apiRequest("/api/workout-sets", {
          method: "POST",
          token,
          body: JSON.stringify({
            sessionId,
            exerciseName: interpreted.payload.exerciseName,
            exerciseType: interpreted.payload.exerciseType,
            reps: interpreted.payload.reps,
            weightKg: interpreted.payload.weightKg,
            durationMinutes: interpreted.payload.durationMinutes,
            notes: interpreted.payload.notes,
            performedAt: new Date().toISOString(),
            transcriptRaw: transcript,
          }),
        });
      } else if (interpreted.intent === "steps") {
        await apiRequest("/api/daily-metrics", {
          method: "POST",
          token,
          body: JSON.stringify({
            date: toLocalDateString(new Date()),
            steps: Math.round(interpreted.payload.value),
          }),
        });
      } else if (interpreted.intent === "weight") {
        await apiRequest("/api/daily-metrics", {
          method: "POST",
          token,
          body: JSON.stringify({
            date: toLocalDateString(new Date()),
            weightKg: interpreted.payload.value,
          }),
        });
      } else {
        await apiRequest("/api/conversation", {
          method: "POST",
          token,
          body: JSON.stringify({
            kind: "question",
            userText: transcript,
            systemText: interpreted.payload.answer,
            source,
            referenceType: null,
            referenceId: null,
            metadata: { answer: interpreted.payload.answer },
          }),
        });
      }

      await refreshAfterSave();
      setCommandToast("Saved");
      closeCommandCenter();
    } catch (error) {
      setCommandError(
        action.kind === "quick_add" ? "quick_add_failure" : "auto_save_failure",
        getErrorMessage(error)
      );
    }
  };

  const routeInterpretedEntry = async (
    interpreted: InterpretEntryResponse,
    transcript: string,
    source: EntrySource
  ) => {
    if (interpreted.intent === "meal") {
      setReviewDraft(buildMealReviewDraft(interpreted, transcript, source));
      setCommandState("cc_review_meal");
      return;
    }

    if (interpreted.intent === "workout_set") {
      setReviewDraft(buildWorkoutReviewDraft(interpreted, transcript, source));
      setCommandState("cc_review_workout");
      return;
    }

    await runSaveAction({
      kind: "entry",
      interpreted,
      transcript,
      source,
    });
  };

  const interpretEntry = async (transcript: string, source: EntrySource) => {
    if (isWebPreview) {
      if (source === "text" && hasWebPreviewFlag("typed_fail")) {
        throw new Error("Mock typed interpretation failure.");
      }
      if (source === "voice" && hasWebPreviewFlag("voice_fail")) {
        throw new Error("Mock voice interpretation failure.");
      }
      const text = transcript.toLowerCase();
      if (text.includes("run") || text.includes("workout") || text.includes("bench") || text.includes("squat")) {
        return {
          intent: "workout_set",
          payload: {
            exerciseName: text.includes("run") ? "Running" : "Bench Press",
            exerciseType: text.includes("run") ? "cardio" : "resistance",
            reps: text.includes("run") ? null : 10,
            weightKg: text.includes("run") ? null : 80,
            durationMinutes: text.includes("run") ? 20 : null,
            notes: null,
            confidence: 0.94,
            assumptions: [],
          },
        } as InterpretEntryResponse;
      }
      if (text.includes("steps")) {
        return {
          intent: "steps",
          payload: { value: 6800, confidence: 0.97, assumptions: [], unit: "steps" },
        } as InterpretEntryResponse;
      }
      if (text.includes("weight")) {
        return {
          intent: "weight",
          payload: { value: 72.4, confidence: 0.97, assumptions: [], unit: "kg" },
        } as InterpretEntryResponse;
      }
      return {
        intent: "meal",
        payload: {
          mealType: "lunch",
          description: "Chicken Salad",
          calories: 450,
          confidence: 0.96,
          assumptions: [],
        },
      } as InterpretEntryResponse;
    }

    const token = await getToken();
    if (!token) throw new Error("Not signed in");
    return apiRequest<InterpretEntryResponse>("/api/interpret/entry", {
      method: "POST",
      token,
      body: JSON.stringify({ transcript, source, timezone }),
    });
  };

  const sendTyped = async () => {
    const transcript = commandText.trim();
    if (!transcript) return;

    setCommandState("cc_submitting_typed");
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);

    try {
      if (isWebPreview && hasWebPreviewFlag("hold_typed_submit")) {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      const interpreted = await interpretEntry(transcript, "text");
      await routeInterpretedEntry(interpreted, transcript, "text");
    } catch (error) {
      setCommandError("typed_interpret_failure", getErrorMessage(error));
    }
  };

  const interpretVoiceTranscript = async (text: string) => {
    const transcript = text.trim();
    if (!transcript) {
      setCommandError("voice_interpret_failure", "Transcript cannot be empty.");
      return;
    }

    setIsInterpretingVoice(true);
    setCommandState("cc_interpreting_voice");
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);

    try {
      const interpreted = await interpretEntry(transcript, "voice");
      await routeInterpretedEntry(interpreted, transcript, "voice");
    } catch (error) {
      setCommandError("voice_interpret_failure", getErrorMessage(error));
    } finally {
      setIsInterpretingVoice(false);
    }
  };

  const startRecording = async () => {
    setCommandErrorSubtype(null);
    setCommandErrorDetail(null);

    try {
      if (isWebPreview) {
        if (hasWebPreviewFlag("mic_denied")) {
          setCommandError("mic_permission_denied");
          return;
        }
        setRecordingSeconds(0);
        setCommandState("cc_recording");
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setCommandError("mic_permission_denied");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      nextRecording.setOnRecordingStatusUpdate((status) => {
        setRecordingSeconds(Math.floor((status.durationMillis ?? 0) / 1000));
      });
      await nextRecording.startAsync();
      setRecording(nextRecording);
      setRecordingSeconds(0);
      setCommandState("cc_recording");
    } catch (error) {
      setCommandError("voice_interpret_failure", getErrorMessage(error));
    }
  };

  const stopRecording = async () => {
    if (isWebPreview) {
      setVoiceTranscript("Had chicken salad for lunch, around 450 calories.");
      setCommandState("cc_interpreting_voice");
      if (hasWebPreviewFlag("hold_interpreting")) {
        return;
      }
      await interpretVoiceTranscript("Had chicken salad for lunch, around 450 calories.");
      return;
    }

    if (!recording) return;

    setCommandState("cc_interpreting_voice");
    setIsInterpretingVoice(true);

    const activeRecording = recording;
    setRecording(null);

    try {
      activeRecording.setOnRecordingStatusUpdate(null);
      await activeRecording.stopAndUnloadAsync();

      const status = await activeRecording.getStatusAsync();
      const durationMillis = status.durationMillis ?? 0;
      const uri = activeRecording.getURI();

      if (!uri || durationMillis < MIN_RECORDING_DURATION_MS) {
        throw new Error("Recording is too short. Please record at least 1 second.");
      }

      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const formData = new FormData();
      formData.append(
        "audio",
        {
          uri,
          name: `voicefit-${Date.now()}.m4a`,
          type: "audio/m4a",
        } as unknown as Blob
      );

      const { transcript } = await apiFormRequest<{ transcript: string }>(
        "/api/transcribe",
        formData,
        { token }
      );

      const cleanedTranscript = transcript.trim();
      if (!cleanedTranscript) {
        throw new Error("Transcript was empty. Please try again.");
      }

      setVoiceTranscript(cleanedTranscript);
      await interpretVoiceTranscript(cleanedTranscript);
    } catch (error) {
      setCommandError("voice_interpret_failure", getErrorMessage(error));
    } finally {
      setIsInterpretingVoice(false);
    }
  };

  const updateWorkoutSet = (
    setIndex: number,
    nextPatch: Partial<Pick<WorkoutReviewSet, "weightKg" | "reps" | "notes">>
  ) => {
    setReviewDraft((prev) => {
      if (!prev || prev.kind !== "workout") return prev;
      const nextSets = prev.sets.map((set, index) =>
        index === setIndex ? { ...set, ...nextPatch } : set
      );
      return { ...prev, sets: nextSets };
    });
  };

  const addWorkoutSet = () => {
    setReviewDraft((prev) => {
      if (!prev || prev.kind !== "workout") return prev;
      const nextIndex = prev.sets.length + 1;
      return {
        ...prev,
        sets: [
          ...prev.sets,
          {
            id: `set-${nextIndex}`,
            setNumber: nextIndex,
            weightKg: "",
            reps: "",
            notes: "",
          },
        ],
      };
    });
  };

  const saveReviewedEntry = async () => {
    if (!reviewDraft) return;

    if (reviewDraft.kind === "workout") {
      const firstFilledSet = reviewDraft.sets.find(
        (set) => set.weightKg.trim() || set.reps.trim() || set.notes.trim()
      );
      const sourceSet = firstFilledSet ?? reviewDraft.sets[0];

      const nextPayload = {
        ...reviewDraft.interpreted.payload,
        weightKg: parsePositiveNumber(sourceSet.weightKg),
        reps: parsePositiveNumber(sourceSet.reps),
        notes: sourceSet.notes.trim() || reviewDraft.interpreted.payload.notes,
      };

      await runSaveAction({
        kind: "entry",
        interpreted: {
          ...reviewDraft.interpreted,
          payload: nextPayload,
        },
        transcript: reviewDraft.transcript,
        source: reviewDraft.source,
      });
      return;
    }

    await runSaveAction({
      kind: "entry",
      interpreted: reviewDraft.interpreted,
      transcript: reviewDraft.transcript,
      source: reviewDraft.source,
    });
  };

  const editReviewTranscript = () => {
    if (!reviewDraft) return;
    setCommandText(reviewDraft.transcript);
    setVoiceTranscript(reviewDraft.transcript);
    setReviewDraft(null);
    setCommandState(reviewDraft.transcript.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
  };

  const handleErrorPrimary = async () => {
    if (!commandErrorSubtype) return;

    if (commandErrorSubtype === "typed_interpret_failure") {
      await sendTyped();
      return;
    }

    if (commandErrorSubtype === "voice_interpret_failure") {
      await startRecording();
      return;
    }

    if (commandErrorSubtype === "mic_permission_denied") {
      try {
        await Linking.openSettings();
      } catch {
        setCommandErrorDetail("Open your device settings and enable microphone access.");
      }
      return;
    }

    if (commandErrorSubtype === "auto_save_failure" || commandErrorSubtype === "quick_add_failure") {
      if (pendingSaveRef.current) {
        await runSaveAction(pendingSaveRef.current);
      }
    }
  };

  const handleErrorSecondary = () => {
    if (!commandErrorSubtype) return;

    if (commandErrorSubtype === "typed_interpret_failure") {
      setCommandState(commandText.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }

    if (commandErrorSubtype === "voice_interpret_failure") {
      if (voiceTranscript.trim()) setCommandText(voiceTranscript.trim());
      setCommandState(voiceTranscript.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }

    if (commandErrorSubtype === "mic_permission_denied") {
      setCommandState(commandText.trim() ? "cc_expanded_typing" : "cc_expanded_empty");
      return;
    }

    closeCommandCenter();
  };

  const canCloseViaBackdrop =
    commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing";
  const modalAnimationType = Platform.OS === "web" ? "none" : "fade";

  const handleCommandInputChange = (text: string) => {
    setCommandText(text);
    if (commandState === "cc_expanded_empty" && text.trim()) {
      setCommandState("cc_expanded_typing");
    }
    if (commandState === "cc_expanded_typing" && !text.trim()) {
      setCommandState("cc_expanded_empty");
    }
  };

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

  const activeErrorCopy = commandErrorSubtype ? ERROR_COPY[commandErrorSubtype] : null;

  const renderCommandContent = () => {
    if (commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing") {
      const sendDisabled = !commandText.trim();

      return (
        <View style={styles.sheetContent}>
          <View style={styles.sheetHeaderExpanded}>
            <Text style={styles.sheetTitleExpanded}>Command Center</Text>
            <Pressable style={styles.sheetCloseCircle} onPress={closeCommandCenter} testID="cc-close">
              <CloseGlyph />
            </Pressable>
          </View>

          <View style={styles.commandInputArea}>
            <TextInput
              style={styles.commandInputExpanded}
              placeholder='Try: "Had a chicken salad for lunch, about 450 calories" or "Just ran 5k in 25 minutes"'
              placeholderTextColor={COLORS.textTertiary}
              value={commandText}
              onChangeText={handleCommandInputChange}
              multiline
              testID="cc-input-text"
            />
          </View>

          <View style={styles.ccActionsRow}>
            <View style={styles.ccActionsSide}>
              <Pressable style={styles.ccActionBtn}>
                <KeyboardGlyph />
              </Pressable>
            </View>
            <Pressable style={styles.ccMicBig} onPress={() => void startRecording()} testID="cc-big-mic">
              <View pointerEvents="none" style={styles.ccMicBigPulse} />
              <MicGlyph />
            </Pressable>
            <View style={[styles.ccActionsSide, styles.ccActionsSideRight]}>
              <Pressable
                style={[styles.ccSendCircle, sendDisabled && styles.ccSendCircleDisabled]}
                disabled={sendDisabled}
                onPress={() => void sendTyped()}
                testID="cc-send"
              >
                <SendGlyph />
              </Pressable>
            </View>
          </View>

          <Text style={styles.quickAddLabelExpanded}>Quick Add</Text>
          <View style={styles.quickAddRows}>
            {displayedQuickAddItems.map((item, index) => (
              <Pressable
                key={item.id}
                style={[
                  styles.quickAddRow,
                  index === displayedQuickAddItems.length - 1 && styles.quickAddRowLast,
                ]}
                testID={`cc-quick-add-${index}`}
                onPress={() => {
                  void runSaveAction({ kind: "quick_add", item });
                }}
              >
                <View style={styles.quickAddLeft}>
                  <View style={styles.quickAddThumb}>
                    <QuickMealThumb />
                  </View>
                  <View>
                    <Text style={styles.quickAddName}>{item.description}</Text>
                    <Text style={styles.quickAddDetail}>
                      {item.calories} kcal · {formatMealTypeLabel(item.mealType)}
                    </Text>
                  </View>
                </View>
                <View style={styles.quickAddPlus}>
                  <PlusGlyph />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (commandState === "cc_submitting_typed") {
      return (
        <View style={styles.sheetContentCentered}>
          <ActivityIndicator color={COLORS.black} />
          <Text style={styles.processingTitle}>Interpreting entry...</Text>
          <Text style={styles.processingBody}>{commandText.trim()}</Text>
        </View>
      );
    }

    if (commandState === "cc_recording") {
      const liveText = voiceTranscript.trim();
      return (
        <View style={styles.recordingSheet}>
          <View style={styles.recordingHeader}>
            <View style={styles.recordingHeaderSide}>
              <View style={styles.recordingTimerWrap}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTimer}>{formatRecordingDuration(recordingSeconds)}</Text>
              </View>
            </View>
            <View style={styles.recordingHeaderCenter}>
              <Text style={styles.recordingTitle}>Listening</Text>
            </View>
            <View style={[styles.recordingHeaderSide, styles.recordingHeaderSideRight]}>
              <Pressable style={styles.sheetCloseCircle} onPress={closeCommandCenter} testID="cc-recording-discard">
                <CloseGlyph />
              </Pressable>
            </View>
          </View>

          <View style={styles.liveTranscriptWrap}>
            {liveText ? (
              <Text style={styles.liveTranscriptText}>
                {liveText}
                <Text style={styles.liveTranscriptCursor}>|</Text>
              </Text>
            ) : (
              <Text style={styles.liveTranscriptHint}>Start speaking...</Text>
            )}
          </View>

          <AnimatedWaveform active={commandState === "cc_recording"} />

          <View style={styles.recordMicArea}>
            <Pressable style={styles.recordStopButton} onPress={() => void stopRecording()} testID="cc-recording-stop">
              <View pointerEvents="none" style={styles.recordStopButtonOuter1} />
              <View pointerEvents="none" style={styles.recordStopButtonOuter2} />
              <View style={styles.recordStopSquare} />
            </Pressable>
            <Text style={styles.recordStopLabel}>Tap to stop</Text>
          </View>
        </View>
      );
    }

    if (commandState === "cc_interpreting_voice") {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.interpretingHeader}>
            <View style={styles.interpretingHeaderSide} />
            <View style={styles.interpretingTitleRow}>
              {isInterpretingVoice ? <ActivityIndicator color={COLORS.black} size="small" /> : null}
              <Text style={styles.sheetTitle}>Interpreting...</Text>
            </View>
            <Pressable style={styles.sheetCloseCircle} onPress={closeCommandCenter} testID="cc-interpreting-close">
              <CloseGlyph />
            </Pressable>
          </View>
          <View style={styles.interpretingDivider} />

          <TextInput
            style={styles.voiceTranscriptInput}
            value={voiceTranscript}
            onChangeText={setVoiceTranscript}
            multiline
            placeholder="Transcript"
            placeholderTextColor={COLORS.textTertiary}
            testID="cc-voice-transcript"
          />

          <View style={styles.interpretingActions}>
            <Pressable
              style={styles.secondaryActionButton}
              onPress={() => {
                void interpretVoiceTranscript(voiceTranscript);
              }}
              testID="cc-interpreting-edit"
            >
              <Text style={styles.secondaryActionText}>Edit text</Text>
            </Pressable>
            <Pressable style={styles.secondaryActionButton} onPress={() => void startRecording()} testID="cc-interpreting-retry-voice">
              <Text style={styles.secondaryActionText}>Retry voice</Text>
            </Pressable>
            <Pressable style={styles.primaryActionButton} onPress={closeCommandCenter} testID="cc-interpreting-discard">
              <Text style={styles.primaryActionText}>Discard</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (commandState === "cc_review_meal" && reviewDraft?.kind === "meal") {
      const meal = reviewDraft.interpreted.payload;
      const confidence = confidenceLabel(reviewDraft.confidence);
      return (
        <ScrollView
          style={styles.reviewScroll}
          contentContainerStyle={styles.reviewContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.reviewHeader}>
            <Text style={styles.sheetTitle}>Review Meal</Text>
            <Pressable style={styles.sheetCloseCircle} onPress={closeCommandCenter} testID="cc-review-close">
              <CloseGlyph />
            </Pressable>
          </View>

          <View style={styles.reviewTranscriptCard}>
            <Text style={styles.reviewTranscriptLabel}>YOU SAID</Text>
            <Text style={styles.reviewTranscriptText}>{reviewDraft.transcript}</Text>
            <Pressable
              style={styles.reviewTranscriptEditWrap}
              onPress={editReviewTranscript}
              testID="cc-review-edit-transcript"
            >
              <Text style={styles.reviewTranscriptEdit}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.reviewConfidencePill}>
            <View style={styles.reviewConfidenceDot} />
            <Text style={styles.reviewConfidenceText}>{confidence}</Text>
          </View>

          <View style={styles.mealReviewCard}>
            <View style={styles.mealReviewHeader}>
              <Text style={styles.mealReviewTitle}>{meal.description}</Text>
              <View style={styles.mealTypeBadge}>
                <Text style={styles.mealTypeBadgeText}>{meal.mealType.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.mealCaloriesHero}>
              <Text style={styles.mealCaloriesValue}>{meal.calories}</Text>
              <Text style={styles.mealCaloriesLabel}>calories</Text>
            </View>

            <View style={styles.mealMacrosRow}>
              <View style={styles.mealMacroCell}>
                <Text style={styles.mealMacroValue}>{reviewDraft.macros.protein}g</Text>
                <Text style={styles.mealMacroLabel}>PROTEIN</Text>
              </View>
              <View style={styles.mealMacroCell}>
                <Text style={styles.mealMacroValue}>{reviewDraft.macros.carbs}g</Text>
                <Text style={styles.mealMacroLabel}>CARBS</Text>
              </View>
              <View style={styles.mealMacroCell}>
                <Text style={styles.mealMacroValue}>{reviewDraft.macros.fat}g</Text>
                <Text style={styles.mealMacroLabel}>FAT</Text>
              </View>
            </View>

            <View style={styles.mealIngredientsSection}>
              <View style={styles.mealIngredientsHeader}>
                <Text style={styles.mealIngredientsTitle}>INGREDIENTS</Text>
                <Text style={styles.mealIngredientsAction}>+ Add Item</Text>
              </View>
              {reviewDraft.ingredients.map((ingredient) => (
                <View key={ingredient.id} style={styles.mealIngredientRow}>
                  <View style={styles.mealIngredientLeft}>
                    <Text style={styles.mealIngredientName}>{ingredient.name}</Text>
                    <View style={styles.mealIngredientQtyChip}>
                      <Text style={styles.mealIngredientQty}>{ingredient.quantity}</Text>
                    </View>
                  </View>
                  <View style={styles.mealIngredientRight}>
                    <Text style={styles.mealIngredientCal}>{ingredient.calories} cal</Text>
                    <Text style={styles.mealIngredientChevron}>›</Text>
                  </View>
                </View>
              ))}

              <View style={styles.mealTimeRow}>
                <Text style={styles.mealTimeLabel}>Eaten at</Text>
                <View style={styles.mealTimeValueWrap}>
                  <Text style={styles.mealTimeValue}>{reviewDraft.eatenAtLabel}</Text>
                  <Text style={styles.mealIngredientChevron}>›</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.reviewActions}>
            <Pressable style={styles.reviewSecondaryButton} onPress={closeCommandCenter} testID="cc-review-discard">
              <Text style={styles.reviewSecondaryText}>Discard</Text>
            </Pressable>
            <Pressable style={styles.reviewPrimaryButton} onPress={() => void saveReviewedEntry()} testID="cc-review-save">
              <View style={styles.reviewPrimaryContent}>
                <CheckGlyph />
                <Text style={styles.reviewPrimaryText}>Save Meal</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    if (commandState === "cc_review_workout" && reviewDraft?.kind === "workout") {
      const workout = reviewDraft.interpreted.payload;
      const confidence = confidenceLabel(reviewDraft.confidence);
      return (
        <ScrollView
          style={styles.reviewScroll}
          contentContainerStyle={styles.reviewContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.reviewHeader}>
            <Text style={styles.sheetTitle}>Review Workout</Text>
            <Pressable style={styles.sheetCloseCircle} onPress={closeCommandCenter} testID="cc-review-close">
              <CloseGlyph />
            </Pressable>
          </View>

          <View style={styles.reviewTranscriptCard}>
            <Text style={styles.reviewTranscriptLabel}>YOU SAID</Text>
            <Text style={styles.reviewTranscriptText}>{reviewDraft.transcript}</Text>
            <Pressable
              style={styles.reviewTranscriptEditWrap}
              onPress={editReviewTranscript}
              testID="cc-review-edit-transcript"
            >
              <Text style={styles.reviewTranscriptEdit}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.reviewConfidencePill}>
            <View style={styles.reviewConfidenceDot} />
            <Text style={styles.reviewConfidenceText}>{confidence}</Text>
          </View>

          <View style={styles.workoutReviewCard}>
            <View style={styles.workoutHeaderWrap}>
              <View style={styles.mealReviewHeader}>
                <Text style={styles.mealReviewTitle}>{workout.exerciseName}</Text>
                <View style={[styles.mealTypeBadge, styles.workoutTypeBadge]}>
                  <Text style={[styles.mealTypeBadgeText, styles.workoutTypeBadgeText]}>
                    {reviewDraft.exerciseTypeLabel}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.workoutSetHeaderRow}>
              <Text style={[styles.workoutSetHeaderText, styles.workoutSetHeaderSet]}>SET</Text>
              <Text style={styles.workoutSetHeaderText}>KG</Text>
              <Text style={styles.workoutSetHeaderText}>REPS</Text>
              <Text style={styles.workoutSetHeaderText}>NOTES</Text>
            </View>

            {reviewDraft.sets.map((set, index) => (
              <View key={set.id} style={styles.workoutSetRow}>
                <View style={styles.workoutSetNumBadge}>
                  <Text style={styles.workoutSetNumText}>{set.setNumber}</Text>
                </View>
                <TextInput
                  style={styles.workoutSetInput}
                  value={set.weightKg}
                  onChangeText={(value) =>
                    updateWorkoutSet(index, { weightKg: value.replace(/[^0-9.]/g, "") })
                  }
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={COLORS.textTertiary}
                  testID={`cc-review-workout-kg-${index}`}
                />
                <TextInput
                  style={styles.workoutSetInput}
                  value={set.reps}
                  onChangeText={(value) =>
                    updateWorkoutSet(index, { reps: value.replace(/[^0-9]/g, "") })
                  }
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={COLORS.textTertiary}
                  testID={`cc-review-workout-reps-${index}`}
                />
                <TextInput
                  style={styles.workoutSetInput}
                  value={set.notes}
                  onChangeText={(value) => updateWorkoutSet(index, { notes: value })}
                  placeholder="—"
                  placeholderTextColor={COLORS.textTertiary}
                  testID={`cc-review-workout-notes-${index}`}
                />
              </View>
            ))}

            <Pressable style={styles.workoutAddSetRow} onPress={addWorkoutSet} testID="cc-review-add-set">
              <Text style={styles.workoutAddSetText}>+ Add Set</Text>
            </Pressable>
          </View>

          <View style={styles.workoutSessionRow}>
            <Text style={styles.workoutSessionLabel}>Add to session</Text>
            <View style={styles.workoutSessionValueWrap}>
              <Text style={styles.workoutSessionValue}>{reviewDraft.sessionLabel}</Text>
              <Text style={styles.mealIngredientChevron}>›</Text>
            </View>
          </View>

          <View style={styles.reviewActions}>
            <Pressable style={styles.reviewSecondaryButton} onPress={closeCommandCenter} testID="cc-review-discard">
              <Text style={styles.reviewSecondaryText}>Discard</Text>
            </Pressable>
            <Pressable style={styles.reviewPrimaryButton} onPress={() => void saveReviewedEntry()} testID="cc-review-save">
              <View style={styles.reviewPrimaryContent}>
                <CheckGlyph />
                <Text style={styles.reviewPrimaryText}>Save Sets</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    if (
      commandState === "cc_saving" ||
      commandState === "cc_auto_saving" ||
      commandState === "cc_quick_add_saving"
    ) {
      return (
        <View style={styles.sheetContentCentered}>
          <ActivityIndicator color={COLORS.black} />
          <Text style={styles.processingTitle}>Saving entry...</Text>
          <Text style={styles.processingBody}>Refreshing Home data</Text>
        </View>
      );
    }

    if (commandState === "cc_error" && activeErrorCopy) {
      return (
        <View style={styles.sheetContent}>
          <Text style={styles.errorTitle}>{activeErrorCopy.title}</Text>
          <Text style={styles.errorBody}>{activeErrorCopy.body}</Text>
          {commandErrorDetail ? <Text style={styles.errorDetail}>{commandErrorDetail}</Text> : null}

          <Pressable style={styles.primaryActionButton} onPress={() => void handleErrorPrimary()} testID="cc-error-primary">
            <Text style={styles.primaryActionText}>{activeErrorCopy.primary}</Text>
          </Pressable>

          {activeErrorCopy.secondary ? (
            <Pressable style={styles.secondaryActionButton} onPress={handleErrorSecondary} testID="cc-error-secondary">
              <Text style={styles.secondaryActionText}>{activeErrorCopy.secondary}</Text>
            </Pressable>
          ) : null}

          {activeErrorCopy.tertiary ? (
            <Pressable style={styles.tertiaryActionButton} onPress={closeCommandCenter} testID="cc-error-tertiary">
              <Text style={styles.tertiaryActionText}>{activeErrorCopy.tertiary}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    return null;
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
          <Pressable style={styles.addButton} onPress={openCommandCenter} testID="home-add-button">
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
              <CalorieRing consumed={todayCaloriesConsumed} goal={todayCaloriesGoal} />
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <View style={styles.metricTopRow}>
                  <Text style={styles.metricLabel}>STEPS</Text>
                  <MiniStepsRing current={todaySteps} goal={todayStepsGoal} />
                </View>
                <Text style={styles.metricMainValue}>{todaySteps.toLocaleString()}</Text>
                <View style={styles.metricSubRow}>
                  <Text style={styles.metricSubValue}>of {todayStepsGoal.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricTopRow}>
                  <Text style={styles.metricLabel}>WEIGHT</Text>
                  <WeightSparkline />
                </View>
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
                  <Text style={styles.trendSummaryMain}>{renderTrendPrimary()}</Text>
                  <Text style={styles.trendSummarySub}>Last 7 days avg</Text>
                </View>
                <Text style={[styles.trendChangeText, { color: trendChangeColor }]}>{renderTrendChange()}</Text>
              </View>

              {dashboardQuery.isLoading && !dashboard ? (
                <ActivityIndicator color={COLORS.black} />
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
              {dashboardQuery.isLoading && !dashboard ? (
                <ActivityIndicator color={COLORS.black} />
              ) : recentMeals.length > 0 ? (
                recentMeals.map((meal) => (
                  <View key={meal.id} style={styles.mealRow}>
                    <MealThumb />
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

      {commandState === "cc_collapsed" ? (
        <View style={styles.commandCollapsedWrap}>
          <Pressable style={styles.commandCollapsed} onPress={openCommandCenter} testID="cc-collapsed-open">
            <View style={styles.commandLeft}>
              <SparkleGlyph />
              <Text style={styles.commandHint}>"Had pasta for lunch..."</Text>
            </View>
            <Pressable style={styles.commandMicButton} onPress={() => void startRecording()} testID="cc-collapsed-mic">
              <MicGlyph />
            </Pressable>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={commandState !== "cc_collapsed"}
        transparent
        animationType={modalAnimationType}
        onRequestClose={() => {
          if (canCloseViaBackdrop) closeCommandCenter();
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (canCloseViaBackdrop) closeCommandCenter();
            }}
          />
          <View style={[styles.sheetWrap, { paddingBottom: insets.bottom }]} testID={`cc-sheet-${commandState}`}>
            <View style={styles.sheetHandle} />
            {renderCommandContent()}
          </View>
        </View>
      </Modal>

      {commandToast ? (
        <View style={styles.toastWrap} testID="cc-toast">
          <Text style={styles.toastText}>{commandToast}</Text>
        </View>
      ) : null}
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
  commandCollapsedWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 8,
  },
  commandCollapsed: {
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 18,
    paddingRight: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  commandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  commandHint: {
    fontSize: 15,
    color: COLORS.textTertiary,
    fontWeight: "500",
  },
  commandMicButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetWrap: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 0,
    minHeight: 260,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 14,
  },
  sheetContent: {
    gap: 0,
  },
  sheetContentCentered: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sheetHeaderExpanded: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
  },
  sheetTitleExpanded: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  sheetCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  commandInputArea: {
    paddingBottom: 14,
  },
  commandInputExpanded: {
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  ccActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  ccActionsSide: {
    width: 64,
    alignItems: "flex-start",
  },
  ccActionsSideRight: {
    alignItems: "flex-end",
  },
  ccActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  ccMicBig: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ccMicBigPulse: {
    position: "absolute",
    inset: -5,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: "rgba(26,26,26,0.08)",
  },
  ccSendCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  ccSendCircleDisabled: {
    opacity: 0.3,
  },
  quickAddLabelExpanded: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: COLORS.textSecondary,
    paddingTop: 4,
    paddingBottom: 10,
  },
  quickAddRows: {
    gap: 0,
  },
  quickAddRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  quickAddRowLast: {
    borderBottomWidth: 0,
  },
  quickAddLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  quickAddThumb: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAddName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  quickAddDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
  quickAddPlus: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewScroll: {
    maxHeight: 700,
  },
  reviewContent: {
    paddingBottom: 8,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  reviewTranscriptCard: {
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 11,
    paddingHorizontal: 12,
    paddingBottom: 12,
    position: "relative",
    marginBottom: 12,
  },
  reviewTranscriptLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: COLORS.textTertiary,
    marginBottom: 6,
  },
  reviewTranscriptText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textPrimary,
    paddingRight: 44,
  },
  reviewTranscriptEditWrap: {
    position: "absolute",
    top: 10,
    right: 12,
  },
  reviewTranscriptEdit: {
    color: COLORS.weight,
    fontSize: 13,
    fontWeight: "600",
  },
  reviewConfidencePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(52,199,89,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  reviewConfidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.steps,
  },
  reviewConfidenceText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.steps,
  },
  mealReviewCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    padding: 14,
    marginBottom: 14,
  },
  mealReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  mealReviewTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  mealTypeBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(255,149,0,0.12)",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  mealTypeBadgeText: {
    color: COLORS.calories,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  mealCaloriesHero: {
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  mealCaloriesValue: {
    fontSize: 52,
    fontWeight: "800",
    color: COLORS.calories,
    letterSpacing: -1.8,
    lineHeight: 54,
  },
  mealCaloriesLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  mealMacrosRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  mealMacroCell: {
    flex: 1,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    paddingVertical: 9,
    alignItems: "center",
  },
  mealMacroValue: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  mealMacroLabel: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: COLORS.textTertiary,
  },
  mealIngredientsSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },
  mealIngredientsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mealIngredientsTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: COLORS.textTertiary,
  },
  mealIngredientsAction: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.weight,
  },
  mealIngredientRow: {
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mealIngredientLeft: {
    flex: 1,
    gap: 2,
    paddingRight: 10,
  },
  mealIngredientName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  mealIngredientQty: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  mealIngredientQtyChip: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
  },
  mealIngredientRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mealIngredientCal: {
    fontSize: 15,
    color: COLORS.calories,
    fontWeight: "700",
  },
  mealIngredientChevron: {
    fontSize: 18,
    color: COLORS.textTertiary,
    lineHeight: 18,
  },
  mealTimeRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mealTimeLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  mealTimeValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mealTimeValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  workoutReviewCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    overflow: "hidden",
    marginBottom: 14,
  },
  workoutHeaderWrap: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  workoutTypeBadge: {
    backgroundColor: "rgba(175,82,222,0.12)",
  },
  workoutTypeBadgeText: {
    color: "#AF52DE",
  },
  workoutSetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  workoutSetHeaderText: {
    flex: 1,
    flexBasis: 0,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: COLORS.textTertiary,
  },
  workoutSetHeaderSet: {
    flex: 0,
    width: 38,
    textAlign: "left",
  },
  workoutSetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  workoutSetNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutSetNumText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  workoutSetInput: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: COLORS.surface,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  workoutAddSetRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
    paddingVertical: 10,
    alignItems: "center",
  },
  workoutAddSetText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.weight,
  },
  workoutSessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 14,
    marginBottom: 12,
  },
  workoutSessionLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  workoutSessionValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  workoutSessionValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 12,
  },
  reviewSecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  reviewSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  reviewPrimaryButton: {
    flex: 2,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: COLORS.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPrimaryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.bg,
    letterSpacing: -0.2,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  processingBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  recordingSheet: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  recordingHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  recordingHeaderSide: {
    width: 82,
    alignItems: "flex-start",
  },
  recordingHeaderSideRight: {
    alignItems: "flex-end",
  },
  recordingHeaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingTimerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.error,
  },
  recordingTimer: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.error,
  },
  recordingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  liveTranscriptWrap: {
    width: "100%",
    minHeight: 60,
    marginBottom: 24,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  liveTranscriptText: {
    fontSize: 20,
    fontWeight: "500",
    color: COLORS.textPrimary,
    lineHeight: 30,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  liveTranscriptCursor: {
    color: COLORS.textPrimary,
  },
  liveTranscriptHint: {
    fontSize: 16,
    color: COLORS.textTertiary,
    fontStyle: "italic",
  },
  waveform: {
    width: "100%",
    height: 60,
    marginBottom: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  waveBar: {
    width: 4,
    borderRadius: 999,
    backgroundColor: COLORS.textPrimary,
  },
  recordMicArea: {
    alignItems: "center",
    gap: 16,
    marginBottom: 6,
  },
  recordStopButton: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  recordStopButtonOuter1: {
    position: "absolute",
    inset: -8,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: "rgba(255,59,48,0.15)",
  },
  recordStopButtonOuter2: {
    position: "absolute",
    inset: -18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,59,48,0.08)",
  },
  recordStopSquare: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: COLORS.bg,
  },
  recordStopLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  interpretingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  interpretingHeaderSide: {
    width: 32,
  },
  interpretingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flex: 1,
  },
  interpretingDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  voiceTranscriptInput: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 25,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  interpretingActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
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
  secondaryActionButton: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },
  secondaryActionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  tertiaryActionButton: {
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    alignSelf: "center",
  },
  tertiaryActionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  errorBody: {
    marginTop: -2,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorDetail: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: "600",
  },
  toastWrap: {
    position: "absolute",
    bottom: 136,
    alignSelf: "center",
    backgroundColor: COLORS.textPrimary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toastText: {
    fontSize: 13,
    color: COLORS.bg,
    fontWeight: "700",
  },
});
