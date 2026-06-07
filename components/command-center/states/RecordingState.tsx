import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { formatRecordingDuration } from "@/components/command-center/helpers";
import { color as t, font } from "@/lib/tokens";

const LISTENING_BAR_HEIGHTS = [6, 14, 22, 10, 28, 36, 20, 40, 32, 26, 38, 24, 14, 30, 18, 10, 22, 14, 8, 4];

function BlinkingCursor() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, []);
  return <View style={[styles.listeningCursor, !visible && styles.listeningCursorHidden]} />;
}

export function RecordingState({ onClose }: { onClose: () => void }) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const liveText = snapshot.input.voiceTranscript.trim();

  return (
    <SheetShell title={null} onClose={onClose} showCloseButton={false}>
      <View style={styles.listeningBody}>
        <View style={styles.listeningHeader}>
          <View style={styles.listeningHeaderSide}>
            <View style={styles.listeningTimerWrap}>
              <View style={styles.listeningDot} />
              <Text style={styles.listeningTimer}>{formatRecordingDuration(snapshot.input.recordingSeconds)}</Text>
            </View>
          </View>
          <View style={styles.listeningHeaderCenter}>
            <Text style={styles.listeningTitle}>Listening</Text>
          </View>
          <View style={[styles.listeningHeaderSide, styles.listeningHeaderSideRight]}>
            <Pressable
              style={styles.sheetCloseCircle}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Discard recording"
              testID="cc-recording-discard"
            >
              <Icon name="close" size={14} color={t.textSoft} />
            </Pressable>
          </View>
        </View>

        <View style={styles.listeningTranscriptWrap}>
          <Text style={styles.listeningTranscriptText}>
            {liveText ? liveText : <Text style={styles.listeningTranscriptPlaceholder}>Start speaking…</Text>}
          </Text>
          <BlinkingCursor />
        </View>

        <View style={styles.listeningWaveformRow}>
          {LISTENING_BAR_HEIGHTS.map((h, i) => (
            <View
              key={i}
              style={[
                styles.listeningBar,
                {
                  height: h * 1.4,
                  backgroundColor: i > 9 ? t.accent : t.textSoft,
                  opacity: i > 15 ? 0.3 : 1,
                },
                i > 9 && styles.listeningBarGlow,
              ]}
            />
          ))}
        </View>

        <View style={styles.listeningStopWrap}>
          <View pointerEvents="none" style={styles.listeningStopHaloOuter} />
          <View pointerEvents="none" style={styles.listeningStopHaloMid} />
          <Pressable
            style={styles.listeningStopCore}
            onPress={() => void dispatch({ type: "voice.stop" })}
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
            testID="cc-recording-stop"
          >
            <View style={styles.listeningStopSquare} />
          </Pressable>
        </View>

        <Text style={styles.listeningCaption}>TAP TO STOP</Text>
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  // Reused from SheetShell visually, but RecordingState renders a plain circle
  // that matches the SheetShell close-circle style directly.
  sheetCloseCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: t.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  listeningBody: { paddingHorizontal: 22 },
  listeningHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 26 },
  listeningHeaderSide: { width: 82, alignItems: "flex-start" },
  listeningHeaderSideRight: { alignItems: "flex-end" },
  listeningHeaderCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  listeningTimerWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: t.accent,
  },
  listeningTimer: { fontFamily: font.mono[400], fontSize: 13, color: t.text },
  listeningTitle: { fontFamily: font.sans[600], fontSize: 16, fontWeight: "600", color: t.text, letterSpacing: -0.16 },
  listeningTranscriptWrap: {
    minHeight: 80,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  listeningTranscriptText: {
    fontFamily: font.sans[500],
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 30,
    color: t.text,
    letterSpacing: -0.33,
    textAlign: "center",
  },
  listeningTranscriptPlaceholder: {
    color: t.textSoft,
  },
  listeningCursor: {
    width: 2,
    height: 22,
    backgroundColor: t.accent,
    marginLeft: 3,
    marginBottom: 4,
  },
  listeningCursorHidden: { opacity: 0 },
  listeningWaveformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 70,
    paddingTop: 30,
    paddingBottom: 26,
  },
  listeningBar: {
    width: 4,
    borderRadius: 2,
    borderCurve: "continuous",
  },
  listeningBarGlow: {},
  listeningStopWrap: {
    width: 116,
    height: 116,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  listeningStopHaloOuter: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  listeningStopHaloMid: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  listeningStopCore: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 14px rgba(15,20,25,0.12)",
  },
  listeningStopSquare: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderCurve: "continuous",
    backgroundColor: t.accentInk,
  },
  listeningCaption: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    color: t.textMute,
    letterSpacing: 1.76,
    textAlign: "center",
    marginTop: 14,
  },
});
