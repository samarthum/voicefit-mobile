import { StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";
import { Icon } from "@/components/Icon";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { color as t, font } from "@/lib/tokens";

/** Normal layout sibling above the logging bar, never an absolute success card. */
export function SavedToastState() {
  const { snapshot } = useCommandCenterOverlay();
  const reducedMotion = useReducedMotion();
  if (snapshot.state !== "cc_saved" || !snapshot.toast.ready || !snapshot.toast.message) return null;
  // "processing" = a meal row now exists and the estimate is on its way.
  const processing = snapshot.toast.kind === "processing";
  const message = snapshot.toast.kind === "answer" ? "Answer saved" : snapshot.toast.message;
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(240)}
      exiting={reducedMotion ? undefined : FadeOut.duration(180)}
      style={styles.snackbar}
      pointerEvents="none"
      testID="cc-saved-toast"
      accessibilityLiveRegion="polite"
    >
      <Icon name={processing ? "sparkle" : "checkCircle"} size={16} color={t.accent} />
      <Text style={styles.copy}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    alignSelf: "center",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.accentTintBorder,
    boxShadow: "0 6px 16px rgba(15,20,25,0.08)",
  },
  copy: { flexShrink: 1, fontFamily: font.sans[600], fontSize: 13, lineHeight: 18, color: t.text },
});
