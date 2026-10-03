import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { isSavingState } from "./saving-ui";
import { color as t, font } from "@/lib/tokens";

/** The same pinned action remains mounted through saving, retry and dismissal. */
export function ReviewActionsFooter() {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const insets = useSafeAreaInsets();
  const busy = isSavingState(snapshot.state) || snapshot.state === "cc_saved";
  const failure = snapshot.state === "cc_error" ? snapshot.error.copy : null;
  const discardDisabled = busy || (!!failure && !failure.secondary);
  const label = busy ? "Saving…" : failure ? failure.primary : snapshot.review?.kind === "workout" ? "Save sets" : "Looks good";

  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
      {failure ? (
        <View accessibilityLiveRegion="polite" testID="cc-review-save-error">
          <Text style={styles.errorTitle}>{failure.title}</Text>
          <Text style={styles.errorBody}>{failure.body}</Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          style={styles.discardButton}
          disabled={discardDisabled}
          accessibilityState={{ disabled: discardDisabled }}
          onPress={() => { if (!discardDisabled) dispatch({ type: failure ? "error.secondary" : "close" }); }}
          testID="cc-review-discard"
        >
          <Text style={styles.discardText}>{failure?.secondary ?? "Discard"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.saveButton}
          disabled={busy}
          accessibilityState={{ busy, disabled: busy }}
          aria-busy={busy}
          onPress={() => { if (!busy) void dispatch({ type: failure ? "error.primary" : "review.save" }); }}
          testID="cc-review-save"
        >
          <Text style={styles.saveText}>{label}</Text>
          {busy ? <ActivityIndicator size="small" color={t.accentInk} /> : <Icon name="check" size={16} color={t.accentInk} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 10, paddingHorizontal: 22, paddingTop: 12, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line },
  actions: { flexDirection: "row", gap: 10 },
  errorTitle: { fontFamily: font.sans[600], fontSize: 13, color: t.negative },
  errorBody: { fontFamily: font.sans[400], fontSize: 12, lineHeight: 17, color: t.textSoft, marginTop: 4 },
  discardButton: { width: 110, minHeight: 52, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
  discardText: { fontFamily: font.sans[600], fontSize: 13, fontWeight: "600", color: t.textSoft },
  saveButton: { flex: 1, minHeight: 52, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: t.accent, borderRadius: 14, borderCurve: "continuous", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveText: { flexShrink: 1, fontFamily: font.sans[700], fontSize: 14, fontWeight: "700", color: t.accentInk },
});
