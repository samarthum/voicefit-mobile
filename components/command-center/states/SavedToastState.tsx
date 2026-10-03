import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { color as t, font } from "@/lib/tokens";

/** Normal layout sibling above the logging bar, never an absolute success card. */
export function SavedToastState() {
  const { snapshot } = useCommandCenterOverlay();
  if (snapshot.state !== "cc_saved" || !snapshot.toast.ready || !snapshot.toast.message) return null;
  const processing = snapshot.toast.kind === "processing";
  const message = snapshot.toast.kind === "answer" ? "Answer saved" : snapshot.toast.message;
  return (
    <View style={styles.snackbar} pointerEvents="none" testID="cc-saved-toast" accessibilityLiveRegion="polite">
      <Icon name={processing ? "sparkSend" : "check"} size={16} color={processing ? t.textMute : t.accent} />
      <Text style={styles.copy}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  snackbar: { alignSelf: "center", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line },
  copy: { flexShrink: 1, fontFamily: font.sans[600], fontSize: 13, lineHeight: 18, color: t.text },
});
