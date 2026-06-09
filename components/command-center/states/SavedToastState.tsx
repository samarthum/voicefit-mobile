import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { formatMealTypeLabel } from "@/components/command-center/helpers";
import { color as t, font } from "@/lib/tokens";

export function SavedToastState() {
  const { snapshot } = useCommandCenterOverlay();
  const insets = useSafeAreaInsets();
  const draft = snapshot.review;

  let titleNode: ReactNode;
  const footerLabel = snapshot.toast.lastSavedKcalLeft != null
    ? `${snapshot.toast.lastSavedKcalLeft.toLocaleString()} KCAL LEFT TODAY`
    : "ENTRY SAVED";

  if (draft?.kind === "meal") {
    const { description, calories, mealType } = draft.interpreted.payload;
    const mealLabel = formatMealTypeLabel(mealType).toLowerCase();
    titleNode = (
      <Text style={styles.savedToastBody}>
        {description} — <Text style={styles.savedToastBodyAccent}>{calories} kcal</Text> added to {mealLabel}.
      </Text>
    );
  } else if (draft?.kind === "workout") {
    const { exerciseName } = draft.interpreted.payload;
    const setsCount = draft.sets.length;
    const setsLabel = setsCount === 1 ? "set" : "sets";
    titleNode = (
      <Text style={styles.savedToastBody}>
        {exerciseName} — <Text style={styles.savedToastBodyAccent}>{setsCount} {setsLabel}</Text> saved.
      </Text>
    );
  } else if (snapshot.toast.message) {
    titleNode = <Text style={styles.savedToastBody}>{snapshot.toast.message}</Text>;
  } else {
    titleNode = <Text style={styles.savedToastBody}>Entry saved.</Text>;
  }

  return (
    <View style={styles.savedToastRoot} pointerEvents="box-none">
      <View style={styles.savedToastDim} pointerEvents="none" />
      <View
        style={[styles.savedToastCard, { bottom: insets.bottom + 120 }]}
        testID="cc-saved-toast"
      >
        <View style={styles.savedToastTopRow}>
          <View style={styles.savedToastCheckCircle}>
            <Icon name="check" size={13} color={t.accentInk} />
          </View>
          <Text style={styles.savedToastEyebrow}>LOGGED</Text>
        </View>
        {titleNode}
        <View style={styles.savedToastFooter}>
          <Text style={styles.savedToastFooterLabel}>{footerLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  savedToastRoot: { ...StyleSheet.absoluteFillObject },
  savedToastDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  savedToastCard: {
    position: "absolute",
    left: 18,
    right: 18,
    backgroundColor: t.surface2,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  savedToastTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  savedToastCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  savedToastEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  savedToastBody: {
    fontFamily: font.sans[600],
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.17,
    lineHeight: 22,
    color: t.text,
  },
  savedToastBodyAccent: {
    color: t.accent,
  },
  savedToastFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  savedToastFooterLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.05,
    textTransform: "uppercase",
    color: t.textMute,
  },
});
