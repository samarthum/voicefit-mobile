import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { VoiceRing } from "@/components/pulse/VoiceRing";
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
  const entering = reducedMotion ? undefined : FadeIn.duration(220);
  const exiting = reducedMotion ? undefined : FadeOut.duration(120);

  return (
    <SheetShell title={null} onClose={() => dispatch({ type: "close" })} showCloseButton={false}>
      <View style={styles.body} testID="cc-voice-progress" accessibilityLiveRegion="polite">
        <VoiceRing state={isDone ? "saved" : "interpreting"} size={84} reducedMotion={reducedMotion} />

        <View style={styles.labelSlot}>
          <Animated.Text key={label} entering={entering} exiting={exiting} style={styles.label}>
            {label}
          </Animated.Text>
        </View>

        <View style={styles.transcriptSlot}>
          {transcript ? (
            <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(260)}>
              <Text style={styles.transcript} numberOfLines={4} selectable>
                “{transcript}”
              </Text>
            </Animated.View>
          ) : null}
        </View>

        {cancellable ? (
          <Pressable
            onPress={() => dispatch({ type: "close" })}
            hitSlop={10}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="cc-interpreting-discard"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        ) : (
          <View style={styles.cancel} />
        )}
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 28, paddingTop: 18, alignItems: "center" },
  labelSlot: { height: 30, marginTop: 22, justifyContent: "center" },
  label: {
    fontFamily: font.sans[600],
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: t.text,
    textAlign: "center",
  },
  transcriptSlot: { minHeight: 92, marginTop: 10, justifyContent: "flex-start" },
  transcript: {
    fontFamily: font.sans[400],
    fontSize: 16,
    lineHeight: 23,
    color: t.textSoft,
    textAlign: "center",
  },
  cancel: { height: 40, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", marginTop: 4 },
  cancelText: { fontFamily: font.sans[600], fontSize: 14, color: t.textMute },
  pressed: { opacity: 0.6 },
});
