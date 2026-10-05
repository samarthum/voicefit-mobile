import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { Icon } from "@/components/Icon";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { color as t, font } from "@/lib/tokens";

/**
 * Voice hand-off. Once the user taps Done there is nothing left for them to
 * do: the transcript is trusted and goes straight to the backend. This view is
 * a short, read-only progress beat (transcribing → taking a look → logging →
 * done) rather than an editor; corrections happen on the logged entry itself.
 */
function phaseLabel(state: string, isWorkout: boolean) {
  switch (state) {
    case "cc_transcribing_voice":
      return "Transcribing…";
    case "cc_interpreting_voice":
      return "Taking a look…";
    case "cc_saved":
      return "Got it";
    default:
      return isWorkout ? "Adding to your workout…" : "Logging it…";
  }
}

// Bell-shaped peaks so the middle bars lead, like the recording waveform
// settling into a calm "thinking" ripple.
const BAR_PEAKS = [0.45, 0.7, 0.9, 1, 0.9, 0.7, 0.45];
const BAR_HEIGHT = 34;

function ThinkingBar({ index, peak, reducedMotion }: { index: number; peak: number; reducedMotion: boolean }) {
  const level = useSharedValue(0.3);
  useEffect(() => {
    if (reducedMotion) {
      level.value = peak * 0.6;
      return;
    }
    level.value = withDelay(
      index * 90,
      withRepeat(
        withSequence(
          withTiming(peak, { duration: 420, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.25, { duration: 420, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [index, level, peak, reducedMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: level.value }] }));
  return <Animated.View style={[styles.bar, style]} />;
}

export function InterpretingState() {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const reducedMotion = useReducedMotion();
  const { state, input } = snapshot;
  const transcript = input.voiceTranscript.trim();
  const isDone = state === "cc_saved";
  // Reads can be cancelled; once a write is in flight, closing would only
  // hide it, so the escape hatch disappears.
  const cancellable = state === "cc_transcribing_voice" || state === "cc_interpreting_voice";
  const label = phaseLabel(state, snapshot.screenContext.screen === "workout");
  const fade = reducedMotion ? undefined : FadeIn.duration(220);

  return (
    <SheetShell title={null} onClose={() => dispatch({ type: "close" })} showCloseButton={false}>
      <View style={styles.body} testID="cc-voice-progress" accessibilityLiveRegion="polite">
        <View style={styles.visual}>
          {isDone ? (
            <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(12)} style={styles.doneBadge}>
              <Icon name="check" size={28} color={t.accentInk} />
            </Animated.View>
          ) : (
            <Animated.View exiting={reducedMotion ? undefined : FadeOut.duration(120)} style={styles.bars}>
              {BAR_PEAKS.map((peak, i) => (
                <ThinkingBar key={i} index={i} peak={peak} reducedMotion={reducedMotion} />
              ))}
            </Animated.View>
          )}
        </View>

        <Animated.Text key={label} entering={fade} style={styles.label}>
          {label}
        </Animated.Text>

        <View style={styles.transcriptSlot}>
          {transcript ? (
            <Animated.Text
              entering={reducedMotion ? undefined : FadeInDown.duration(260)}
              style={styles.transcript}
              numberOfLines={3}
            >
              “{transcript}”
            </Animated.Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          {cancellable ? (
            <Pressable
              onPress={() => dispatch({ type: "close" })}
              hitSlop={12}
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              testID="cc-interpreting-discard"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 28, paddingTop: 12, alignItems: "center" },
  visual: { height: 56, alignItems: "center", justifyContent: "center" },
  bars: { flexDirection: "row", alignItems: "center", gap: 5, height: BAR_HEIGHT },
  bar: { width: 4, height: BAR_HEIGHT, borderRadius: 2, backgroundColor: t.accent },
  doneBadge: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 18,
    fontFamily: font.sans[600],
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: t.text,
    textAlign: "center",
  },
  transcriptSlot: { minHeight: 66, marginTop: 8, alignSelf: "stretch" },
  transcript: {
    fontFamily: font.sans[400],
    fontSize: 15,
    lineHeight: 22,
    color: t.textSoft,
    textAlign: "center",
  },
  footer: { height: 36, alignItems: "center", justifyContent: "center" },
  cancel: { paddingHorizontal: 16, paddingVertical: 6 },
  cancelText: { fontFamily: font.sans[500], fontSize: 14, color: t.textMute },
  pressed: { opacity: 0.6 },
});
