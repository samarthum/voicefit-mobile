import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { haptic } from "@/lib/haptics";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { color as t, font } from "@/lib/tokens";

/**
 * Pinned action footer for the meal/workout review states. Rendered through the
 * bottom sheet's `footerComponent` (not inside the scrolling body) so DISCARD /
 * Save stay anchored above the scrolling list — and above the keyboard, for the
 * workout set inputs — and always clear the home-indicator safe area, no matter
 * how long the ingredient/set list grows.
 */
export function ReviewActionsFooter() {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const insets = useSafeAreaInsets();
  const isWorkout = snapshot.state === "cc_review_workout";

  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
      <Pressable
        style={styles.discardButton}
        onPress={() => dispatch({ type: "close" })}
        testID="cc-review-discard"
      >
        <Text style={styles.discardText}>DISCARD</Text>
      </Pressable>
      <Pressable
        style={styles.saveButton}
        onPress={() => {
          haptic.success();
          void dispatch({ type: "review.save" });
        }}
        testID="cc-review-save"
      >
        <Text style={styles.saveText}>{isWorkout ? "Save sets" : "Save meal"}</Text>
        <Icon name="check" size={16} color={t.accentInk} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: t.bg,
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  discardButton: {
    width: 110,
    height: 52,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  discardText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.52,
    textTransform: "uppercase",
    color: t.textSoft,
  },
  saveButton: {
    flex: 1,
    height: 52,
    backgroundColor: t.accent,
    borderRadius: 14,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    color: t.accentInk,
    letterSpacing: 0.28,
  },
});
