import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { color as token, font, radius as r } from "@/lib/tokens";
import type { AsyncMealStatus } from "@/lib/meal-status";

type Props = { status: AsyncMealStatus };

export function MealStatusBadge({ status }: Props) {
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

const styles = StyleSheet.create({
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
});
