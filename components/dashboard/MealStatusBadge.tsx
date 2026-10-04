import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "@/components/Icon";
import { color as token, font, radius as r } from "@/lib/tokens";
import type { AsyncMealStatus } from "@/lib/meal-status";

type Props = { status: AsyncMealStatus };

// Shared by Home and Meals so a meal reads the same everywhere.
// Copy follows the capture toast ("estimating calories"): a pending row is
// "Estimating…", a landed estimate is quietly marked as one (tap to adjust)
// rather than nagging "Review estimate" on every meal.
const LABEL: Record<Exclude<AsyncMealStatus, "reviewed">, string> = {
  interpreting: "Estimating…",
  needs_review: "Estimate",
  failed: "Couldn't estimate",
};

function PulsingDot() {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(withTiming(0.3, { duration: 650, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function MealStatusBadge({ status }: Props) {
  if (status === "reviewed") return null;
  const failed = status === "failed";
  return (
    <View
      accessibilityLiveRegion={status === "interpreting" ? "polite" : undefined}
      style={[styles.badge, failed && styles.badgeFailed, status === "interpreting" && styles.badgePending]}
      testID={`meal-status-${status}`}
    >
      {status === "interpreting" ? <PulsingDot /> : null}
      {status === "needs_review" ? <Icon name="sparkle" size={10} color={token.accent} /> : null}
      <Text style={[styles.text, failed && styles.textFailed, status !== "failed" && styles.textAccent]} numberOfLines={1}>
        {LABEL[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    maxWidth: "100%",
    minHeight: 20,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: token.accentTintBorder,
    backgroundColor: token.accentTintBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  badgePending: {
    borderColor: token.line2,
    backgroundColor: token.surface2,
  },
  badgeFailed: {
    borderColor: "rgba(217,83,79,0.35)",
    backgroundColor: "rgba(217,83,79,0.06)",
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: token.accent },
  text: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: token.textMute,
    flexShrink: 1,
  },
  textAccent: { color: token.accentDim },
  textFailed: { color: token.negative },
});
