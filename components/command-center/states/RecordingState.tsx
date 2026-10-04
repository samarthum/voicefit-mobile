import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "@/components/Icon";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { formatRecordingDuration } from "@/components/command-center/helpers";
import { LiveWaveform, useMicLevels } from "@/components/command-center/LiveWaveform";
import { color as t, font } from "@/lib/tokens";

const BAR_COUNT = 40;

function RecordingDot() {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.recDot, style]} />;
}

export function RecordingState({ onClose }: { onClose: () => void }) {
  const { snapshot, dispatch, recorder } = useCommandCenterOverlay();
  const levels = useMicLevels(recorder, BAR_COUNT);
  const level = levels[levels.length - 1] ?? 0;
  const isWorkout = snapshot.screenContext.screen === "workout";

  // The halo behind Done breathes with the speaker's voice.
  const reducedMotion = useReducedMotion();
  const halo = useSharedValue(0);
  useEffect(() => {
    halo.value = withTiming(reducedMotion ? 0 : level, { duration: 90 });
  }, [halo, level, reducedMotion]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + halo.value * 0.3,
    transform: [{ scale: 1 + halo.value * 0.32 }],
  }));

  return (
    <SheetShell title={null} onClose={onClose} showCloseButton={false}>
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <View style={styles.timerWrap}>
              <RecordingDot />
              <Text style={styles.timer}>{formatRecordingDuration(snapshot.input.recordingSeconds)}</Text>
            </View>
          </View>
          <Text style={styles.title}>Listening</Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <Pressable
              style={({ pressed }) => [styles.closeCircle, pressed && styles.pressed]}
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Discard recording"
              testID="cc-recording-discard"
            >
              <Icon name="close" size={16} color={t.textSoft} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.prompt}>
          {isWorkout ? "Say your set" : "Say what you ate, lifted or weighed"}
        </Text>
        <Text style={styles.example}>
          {isWorkout ? "“Bench press, 3 sets of 8 at 60 kilos”" : "“Two eggs and toast for breakfast”"}
        </Text>

        <View style={styles.waveWrap}>
          <LiveWaveform levels={levels} height={72} testID="cc-recording-waveform" />
        </View>

        <View style={styles.doneWrap}>
          <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
          <Pressable
            style={({ pressed }) => [styles.doneButton, pressed && styles.donePressed]}
            onPress={() => void dispatch({ type: "voice.stop" })}
            accessibilityRole="button"
            accessibilityLabel="Done, log this"
            testID="cc-recording-stop"
          >
            <Icon name="check" size={34} color={t.accentInk} />
          </Pressable>
        </View>

        <Text style={styles.caption}>Tap when you’re done</Text>
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.65 },
  body: { paddingHorizontal: 22 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  headerSide: { width: 82, alignItems: "flex-start" },
  headerSideRight: { alignItems: "flex-end" },
  timerWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  recDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: t.negative },
  timer: { fontFamily: font.mono[400], fontSize: 13, color: t.text, fontVariant: ["tabular-nums"] },
  title: { flex: 1, textAlign: "center", fontFamily: font.sans[600], fontSize: 16, fontWeight: "600", color: t.text, letterSpacing: -0.16 },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  prompt: {
    fontFamily: font.sans[600],
    fontSize: 21,
    fontWeight: "600",
    lineHeight: 27,
    letterSpacing: -0.4,
    color: t.text,
    textAlign: "center",
  },
  example: {
    marginTop: 6,
    fontFamily: font.sans[400],
    fontSize: 14.5,
    lineHeight: 20,
    color: t.textMute,
    textAlign: "center",
  },
  waveWrap: { height: 96, alignItems: "center", justifyContent: "center", marginTop: 14, marginBottom: 10 },
  doneWrap: {
    width: 120,
    height: 120,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: t.accent,
  },
  doneButton: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 18px rgba(71,116,97,0.28)",
  },
  donePressed: { transform: [{ scale: 0.94 }] },
  caption: {
    fontFamily: font.sans[500],
    fontSize: 13,
    color: t.textMute,
    textAlign: "center",
    marginTop: 8,
  },
});
