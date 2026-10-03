import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import type { ReviewDraft } from "@/components/command-center/types";
import { color as t, space, type } from "@/lib/tokens";

export function SavingState({
  onClose,
  kind,
}: {
  onClose: () => void;
  kind?: ReviewDraft["kind"];
}) {
  const title = `Saving your ${kind ?? "entry"}…`;
  const helper = "Adding it to your log.";

  return (
    <SheetShell title={null} onClose={onClose} showCloseButton={false} scrollable>
      <View
        style={styles.status}
        testID="cc-saving-status"
        accessible
        accessibilityLabel={`${title} ${helper}`}
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy: true }}
        aria-busy
      >
        <ActivityIndicator size="small" color={t.accent} accessible={false} style={styles.loader} />
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.helper}>{helper}</Text>
        </View>
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.base,
    paddingHorizontal: space.xl,
    paddingTop: space.xl2,
    paddingBottom: space.xl2,
  },
  loader: { marginTop: space.xs, flexShrink: 0 },
  copy: { flex: 1, gap: space.sm },
  title: { ...type.titleS, color: t.text },
  helper: { ...type.body, color: t.textSoft },
});
