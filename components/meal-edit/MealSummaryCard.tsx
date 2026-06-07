/**
 * MealSummaryCard
 *
 * Presentational card at the top of the meal-edit screen. Renders the meal
 * name / time, calorie display, meal-type selector, and macros grid.
 *
 * All data and callbacks come from the route file — this component is
 * intentionally stateless.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { color as t, font, radius as r } from "@/lib/tokens";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface MacroTotals {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface MealSummaryCardProps {
  /** Display name / description of the meal */
  description: string;
  /** ISO timestamp string for the meal's eaten-at time */
  eatenAt: string;
  /** Current meal type (potentially edited by the user) */
  mealType: MealType;
  /** Human-readable calorie string (already formatted, null when pending) */
  displayCalories: string | null;
  /** Whether the nutrition estimate is still in-flight */
  isPendingEstimate: boolean;
  /** Current macro totals (protein / carbs / fat), null values while pending */
  macros: MacroTotals;
  /** Called when the user taps a meal-type pill */
  onSelectMealType: (type: MealType) => void;
}

function formatMealTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function MealSummaryCard({
  description,
  eatenAt,
  mealType,
  displayCalories,
  isPendingEstimate,
  macros,
  onSelectMealType,
}: MealSummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      {/* Header row: name + calories */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryLeft}>
          <Text style={styles.eyebrow}>{mealType.toUpperCase()}</Text>
          <Text style={styles.mealName} numberOfLines={2}>{description}</Text>
          <Text style={styles.mealTime}>{formatMealTime(eatenAt)}</Text>
        </View>
        <View style={styles.summaryRight}>
          {isPendingEstimate || displayCalories == null ? (
            <>
              <Text style={styles.kcalPending} selectable>--</Text>
              <Text style={styles.kcalUnit}>KCAL</Text>
            </>
          ) : (
            <>
              <Text style={styles.kcalNum} selectable>{displayCalories}</Text>
              <Text style={styles.kcalUnit}>KCAL</Text>
            </>
          )}
        </View>
      </View>

      {/* Meal type selector */}
      <View style={styles.mealTypeRow}>
        {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => {
          const selected = mealType === type;
          return (
            <Pressable
              key={type}
              onPress={() => onSelectMealType(type)}
              style={[styles.mealTypePill, selected && styles.mealTypePillSelected]}
            >
              <Text
                style={[
                  styles.mealTypePillText,
                  selected && styles.mealTypePillTextSelected,
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Macros grid */}
      <View style={styles.macrosGrid}>
        <View style={styles.macroCell}>
          <Text style={styles.macroLabel}>PROTEIN</Text>
          <View style={styles.macroValueRow}>
            <Text style={[styles.macroValue, styles.macroValueAccent]} selectable>
              {macros.protein ?? "--"}
            </Text>
            <Text style={styles.macroUnit}>g</Text>
          </View>
        </View>
        <View style={styles.macroCell}>
          <Text style={styles.macroLabel}>CARBS</Text>
          <View style={styles.macroValueRow}>
            <Text style={[styles.macroValue, styles.macroValueSoft]} selectable>
              {macros.carbs ?? "--"}
            </Text>
            <Text style={styles.macroUnit}>g</Text>
          </View>
        </View>
        <View style={styles.macroCell}>
          <Text style={styles.macroLabel}>FAT</Text>
          <View style={styles.macroValueRow}>
            <Text style={[styles.macroValue, styles.macroValueSoft]} selectable>
              {macros.fat ?? "--"}
            </Text>
            <Text style={styles.macroUnit}>g</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: t.surface,
    borderRadius: r.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: t.line,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  summaryLeft: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  summaryRight: {
    alignItems: "flex-end",
    width: 96,
  },
  eyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    color: t.textMute,
  },
  mealName: {
    fontFamily: font.sans[600],
    fontSize: 18,
    fontWeight: "600",
    color: t.text,
    letterSpacing: -0.36,
  },
  mealTime: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
    marginTop: 2,
  },
  kcalNum: {
    fontFamily: font.mono[500],
    fontSize: 28,
    fontWeight: "500",
    letterSpacing: -0.84,
    color: t.text,
  },
  kcalPending: {
    fontFamily: font.mono[500],
    fontSize: 28,
    fontWeight: "500",
    letterSpacing: -0.84,
    color: t.textMute,
  },
  kcalUnit: {
    fontFamily: font.sans[600],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.52,
    color: t.textMute,
    marginTop: 2,
  },
  mealTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  mealTypePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
  },
  mealTypePillSelected: {
    backgroundColor: t.accent,
    borderColor: t.accent,
  },
  mealTypePillText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    fontWeight: "600",
    color: t.textSoft,
    letterSpacing: 0.4,
  },
  mealTypePillTextSelected: {
    color: t.accentInk,
  },
  macrosGrid: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
  },
  macroCell: {
    flex: 1,
  },
  macroLabel: {
    fontFamily: font.sans[600],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.52,
    color: t.textMute,
  },
  macroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
  },
  macroValue: {
    fontFamily: font.mono[500],
    fontSize: 18,
    letterSpacing: -0.36,
  },
  macroValueAccent: { color: t.accent },
  macroValueSoft: { color: t.textSoft },
  macroUnit: {
    fontFamily: font.sans[400],
    fontSize: 10,
    color: t.textMute,
    marginLeft: 2,
  },
});
