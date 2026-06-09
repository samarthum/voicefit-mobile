import { StyleSheet, Text, View } from "react-native";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { VoiceRing } from "@/components/pulse/VoiceRing";
import { font, color as t } from "@/lib/tokens";

export function SavingState({ onClose }: { onClose: () => void }) {
  return (
    <SheetShell title={null} onClose={onClose} showCloseButton={false}>
      <View style={styles.sheetContentCentered}>
        <VoiceRing state="interpreting" size={180} />
        <Text style={styles.savingCaption}>Saving…</Text>
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  sheetContentCentered: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 22,
  },
  savingCaption: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.04,
    textTransform: "uppercase",
    color: t.textMute,
  },
});
