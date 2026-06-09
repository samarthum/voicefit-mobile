import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Icon } from "@/components/Icon";
import { haptic } from "@/lib/haptics";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { formatRecordingDuration } from "@/components/command-center/helpers";
import { LoadingBlock } from "@/components/pulse/LoadingSkeleton";
import { color as t, font } from "@/lib/tokens";

type InterpretingCopy = { label: string; elapsed: string };

function getInterpretingCopy(
  state: "cc_submitting_typed" | "cc_submitting_photo" | "cc_transcribing_voice" | "cc_interpreting_voice",
  recordingSeconds: number,
): InterpretingCopy {
  if (state === "cc_submitting_photo") {
    return { label: "Saving your photo…", elapsed: "0.7s" };
  }
  if (state === "cc_submitting_typed") {
    return { label: "Processing your entry…", elapsed: "0.7s" };
  }
  if (state === "cc_transcribing_voice") {
    return {
      label: "Converting speech to text…",
      elapsed: recordingSeconds > 0 ? formatRecordingDuration(recordingSeconds) : "—",
    };
  }
  return {
    label: "Analyzing your entry…",
    elapsed: recordingSeconds > 0 ? formatRecordingDuration(recordingSeconds) : "—",
  };
}

function InterpretingDots() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % 3), 350);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.interpretingDotsRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.interpretingDot,
            i === active ? styles.interpretingDotActive : styles.interpretingDotIdle,
          ]}
        />
      ))}
    </View>
  );
}

export function InterpretingState() {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const { state, input } = snapshot;
  const isTyped = state === "cc_submitting_typed";
  const isPhoto = state === "cc_submitting_photo";
  const transcript = isTyped || isPhoto ? input.text : input.voiceTranscript;
  const setTranscript = (text: string) => {
    dispatch(isTyped || isPhoto ? { type: "text.set", text } : { type: "voice.transcript.change", text });
  };
  const copy = getInterpretingCopy(
    state as "cc_submitting_typed" | "cc_submitting_photo" | "cc_transcribing_voice" | "cc_interpreting_voice",
    input.recordingSeconds,
  );
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);

  const headerCloseTestID =
    state === "cc_transcribing_voice"
      ? "cc-transcribing-close"
      : state === "cc_interpreting_voice"
      ? "cc-interpreting-close"
      : undefined;

  const onEditPress = () => {
    if (isPhoto) {
      dispatch({ type: "photo.context.edit" });
      return;
    }
    if (isTyped) {
      dispatch({ type: "text.edit" });
      return;
    }
    setIsEditingTranscript(true);
  };

  const displayText = transcript.trim() ? `"${transcript.trim()}"` : isPhoto ? "Photo selected" : "";

  return (
    <SheetShell
      title={null}
      onClose={() => dispatch({ type: "close" })}
      showCloseButton={false}
    >
      <View style={styles.statePadding}>
        <View style={styles.interpretingTopRow}>
          <Text style={styles.interpretingEyebrow}>YOU SAID</Text>
          <View style={styles.interpretingTopRowRight}>
            <Pressable onPress={onEditPress} testID="cc-interpreting-edit-link">
              <Text style={styles.interpretingEditLink}>EDIT</Text>
            </Pressable>
            {headerCloseTestID ? (
              <Pressable
                style={styles.interpretingHeaderClose}
                onPress={() => dispatch({ type: "close" })}
                accessibilityRole="button"
                accessibilityLabel="Close"
                testID={headerCloseTestID}
              >
                <Icon name="close" size={14} color={t.textSoft} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {isEditingTranscript && !isTyped ? (
          <View>
            <BottomSheetTextInput
              style={styles.interpretingTranscriptInput}
              value={transcript}
              onChangeText={setTranscript}
              multiline
              placeholder="Transcript"
              placeholderTextColor={t.textMute}
              testID="cc-voice-transcript"
              autoFocus
            />
            <Pressable
              style={styles.interpretingDoneButton}
              onPress={() => setIsEditingTranscript(false)}
            >
              <Text style={styles.interpretingDoneText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onEditPress}>
            <Text style={styles.interpretingTranscript} selectable>{displayText}</Text>
          </Pressable>
        )}

        <View style={styles.interpretingStatusPill}>
          <InterpretingDots />
          <Text style={styles.interpretingStatusLabel} selectable>{copy.label}</Text>
          <Text style={styles.interpretingStatusElapsed} selectable>{copy.elapsed}</Text>
        </View>

        <View style={styles.interpretingSkeletonCard}>
          <LoadingBlock width="55%" height={16} radius={4} style={styles.skelLine2} />
          <LoadingBlock
            width="30%"
            height={10}
            radius={4}
            style={[styles.skelLine2, styles.skelSecond]}
          />
          <View style={styles.interpretingSkeletonRow}>
            <View style={styles.skelFlex}>
              <LoadingBlock height={46} radius={10} style={styles.skelLine} />
            </View>
            <View style={styles.skelFlex}>
              <LoadingBlock height={46} radius={10} style={styles.skelLine} />
            </View>
            <View style={styles.skelFlex}>
              <LoadingBlock height={46} radius={10} style={styles.skelLine} />
            </View>
          </View>
        </View>

        <View style={styles.interpretingButtonsRow}>
          {!isTyped && !isPhoto ? (
            <Pressable
              style={styles.interpretingButton}
              onPress={() => { haptic.tap(); void dispatch({ type: "voice.start" }); }}
              testID="cc-interpreting-retry-voice"
            >
              <Text style={styles.interpretingButtonText}>Retry</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.interpretingButton}
            onPress={onEditPress}
            testID="cc-interpreting-edit"
          >
            <Text style={styles.interpretingButtonText}>{isPhoto ? "Edit context" : "Edit text"}</Text>
          </Pressable>
          <Pressable
            style={styles.interpretingButton}
            onPress={() => dispatch({ type: "close" })}
            testID="cc-interpreting-discard"
          >
            <Text style={styles.interpretingButtonTextMute}>Discard</Text>
          </Pressable>
        </View>
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  statePadding: { paddingHorizontal: 22 },
  interpretingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  interpretingTopRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  interpretingEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  interpretingEditLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: t.accent,
  },
  interpretingHeaderClose: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: t.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  interpretingTranscript: {
    fontFamily: font.sans[500],
    fontSize: 19,
    fontWeight: "500",
    lineHeight: 27,
    color: t.text,
    letterSpacing: -0.28,
  },
  interpretingTranscriptInput: {
    fontFamily: font.sans[500],
    fontSize: 19,
    fontWeight: "500",
    lineHeight: 27,
    color: t.text,
    letterSpacing: -0.28,
    minHeight: 96,
    padding: 0,
    textAlignVertical: "top",
  },
  interpretingDoneButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  interpretingDoneText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    color: t.text,
    fontWeight: "600",
  },
  interpretingStatusPill: {
    marginTop: 24,
    marginBottom: 18,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  interpretingDotsRow: { flexDirection: "row", gap: 4 },
  interpretingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderCurve: "continuous",
    backgroundColor: t.accent,
  },
  interpretingDotIdle: { opacity: 0.3 },
  interpretingDotActive: {
    opacity: 1,
  },
  interpretingStatusLabel: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 14,
    color: t.textSoft,
  },
  interpretingStatusElapsed: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
  },
  interpretingSkeletonCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  interpretingSkeletonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  skelLine: { backgroundColor: t.line },
  skelLine2: { backgroundColor: t.line2 },
  skelSecond: { marginTop: 10 },
  skelFlex: { flex: 1 },
  interpretingButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  interpretingButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  interpretingButtonText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.text,
  },
  interpretingButtonTextMute: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.textMute,
  },
});
