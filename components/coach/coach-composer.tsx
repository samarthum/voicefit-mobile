import React, { useCallback, useEffect, useRef } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Reanimated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
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
  const insets = useSafeAreaInsets();
  // Bottom padding is keyboard-aware: the full safe-area inset clears the
  // gesture bar / home indicator while the keyboard is closed, then collapses
  // to a slim gap as it opens (the screen's keyboard-height padding already
  // lifts the pill) — interpolating on keyboard progress keeps it in sync
  // with the slide animation instead of snapping.
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation();
  const closedPadding = Math.max(insets.bottom, 10);
  const keyboardAwarePadding = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      keyboardProgress.value,
      [0, 1],
      [closedPadding, 10]
    ),
  }));
  const inputRef = useRef<TextInput>(null);
  // ComposerPrimitive.Input doesn't forward refs (v0.1.22), and we need the
  // ref to focus the input after a voice transcript lands — so we bind our
  // own TextInput to the runtime composer with the same setText mechanism.
  const text = useAuiState((s) => s.composer.text);
  const canSend = useAuiState((s) => s.composer.canSend);

  // The input is UNCONTROLLED while typing: a controlled `value` that round-
  // trips through the composer store echoes back to the native input a frame
  // late on Android, making each typed character blink. Keystrokes flow one
  // way (native → store); store text is only written back to the native
  // input when it changed programmatically — send clearing it, a voice
  // transcript filling it — detected by comparing against the last typed
  // value.
  const lastTypedRef = useRef("");
  const handleChangeText = useCallback(
    (value: string) => {
      lastTypedRef.current = value;
      aui.composer().setText(value);
    },
    [aui]
  );
  useEffect(() => {
    if (text !== lastTypedRef.current) {
      lastTypedRef.current = text;
      inputRef.current?.setNativeProps({ text });
    }
  }, [text]);

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
    // Single floating pill: input + mic + send live inside one rounded
    // container (no full-width top border), buttons pinned to the bottom edge
    // so they stay put while the input grows.
    <ComposerPrimitive.Root style={styles.composer}>
      <Reanimated.View style={keyboardAwarePadding}>
        <View style={styles.pill}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          defaultValue={text}
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
            <Icon name="send" size={17} color={token.accentInk} />
          </ComposerPrimitive.Send>
        </AuiIf>
        {/* While the coach is responding, the send pill becomes a stop button. */}
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel
            style={styles.sendButton}
            accessibilityRole="button"
            accessibilityLabel="Stop coach response"
          >
            <Icon name="stop" size={17} color={token.accentInk} />
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </View>
      </Reanimated.View>
    </ComposerPrimitive.Root>
  );
}

const styles = StyleSheet.create({
  composer: {
    paddingHorizontal: 12,
    paddingTop: 6,
    backgroundColor: token.bg,
  },
  pill: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    paddingVertical: 6,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 26,
    borderCurve: "continuous", // NUI-2
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line2,
    boxShadow: "0 4px 12px rgba(15,20,25,0.06)",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 0,
    color: token.text,
    fontFamily: font.sans[400],
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.07,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: rad.pill,
    // NUI-2: pill shape — skip borderCurve per spec
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonRecording: {
    backgroundColor: token.accentTintBg,
  },
  sendButton: {
    width: 36,
    height: 36,
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
