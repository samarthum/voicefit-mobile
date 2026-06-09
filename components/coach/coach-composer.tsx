import React, { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  AuiIf,
  ComposerPrimitive,
  useAui,
  useAuiEvent,
  useAuiState,
} from "@assistant-ui/react-native";
import { Icon } from "@/components/Icon";
import { haptic } from "@/lib/haptics";
import { useCoachVoiceInput } from "@/hooks/use-coach-voice-input";
import { color as token, font, radius as rad } from "@/lib/tokens";

type CoachComposerProps = {
  placeholder?: string;
};

export function CoachComposer({
  placeholder = "Ask your coach...",
}: CoachComposerProps) {
  const aui = useAui();
  const inputRef = useRef<TextInput>(null);
  // ComposerPrimitive.Input doesn't forward refs (v0.1.22), and we need the
  // ref to focus the input after a voice transcript lands — so we bind our
  // own TextInput to the runtime composer with the same setText mechanism.
  const text = useAuiState((s) => s.composer.text);
  const canSend = useAuiState((s) => s.composer.canSend);

  const handleChangeText = useCallback(
    (value: string) => {
      aui.composer().setText(value);
    },
    [aui]
  );

  const handleTranscript = useCallback(
    (transcript: string) => {
      aui.composer().setText(transcript);
    },
    [aui]
  );
  const focusComposer = useCallback(() => {
    inputRef.current?.focus();
  }, []);
  const { isRecordingMic, isTranscribing, handleMicPress } = useCoachVoiceInput(
    {
      onTranscript: handleTranscript,
      onTranscriptFocus: focusComposer,
    }
  );

  // Fires for sends from the composer (button or keyboard); mirrors the old
  // handleSend side effects.
  useAuiEvent("composer.send", () => {
    haptic.tap(); // NUI-6: light haptic on send
    Keyboard.dismiss();
  });

  const onMicPress = () => {
    haptic.press(); // NUI-6: medium haptic on mic press
    void handleMicPress();
  };

  return (
    <ComposerPrimitive.Root style={styles.composer}>
      <View style={styles.composerRow}>
        <TextInput
          ref={inputRef}
          style={styles.composerInput}
          value={text}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={token.textMute}
          multiline
          textAlignVertical="center"
          returnKeyType="default"
        />

        {/* NUI-11: mic glyph → <Icon name="mic" /> / <Icon name="micOff" /> */}
        <Pressable
          style={[
            styles.micButton,
            isRecordingMic ? styles.micButtonRecording : null,
          ]}
          onPress={onMicPress}
          disabled={isTranscribing}
          accessibilityRole="button"
          accessibilityLabel={
            isRecordingMic ? "Stop voice input" : "Start voice input"
          }
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color={token.accent} />
          ) : (
            <Icon
              name={isRecordingMic ? "micOff" : "mic"}
              size={18}
              color={isRecordingMic ? token.accent : token.textSoft}
            />
          )}
        </Pressable>

        {/* NUI-11: send glyph → <Icon name="send" /> */}
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send
            style={[
              styles.sendButton,
              !canSend ? styles.sendButtonDisabled : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send coach message"
          >
            <Icon name="send" size={18} color={token.accentInk} />
          </ComposerPrimitive.Send>
        </AuiIf>
        {/* While the coach is responding, the send pill becomes a stop button. */}
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel
            style={styles.sendButton}
            accessibilityRole="button"
            accessibilityLabel="Stop coach response"
          >
            <Icon name="stop" size={18} color={token.accentInk} />
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </View>
    </ComposerPrimitive.Root>
  );
}

const styles = StyleSheet.create({
  composer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: token.bg,
    borderTopWidth: 1,
    borderTopColor: token.line,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: rad.sm,
    borderCurve: "continuous", // NUI-2
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    color: token.text,
    fontFamily: font.sans[400],
    fontSize: 14.5,
    letterSpacing: -0.07,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: rad.pill,
    // NUI-2: pill shape — skip borderCurve per spec
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonRecording: {
    backgroundColor: token.accentTintBg,
    borderColor: token.accentTintBorder,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: rad.pill,
    // NUI-2: pill shape — skip borderCurve per spec
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: token.surface2,
    opacity: 0.6,
  },
});
