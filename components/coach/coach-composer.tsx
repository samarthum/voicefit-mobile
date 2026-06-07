import React, { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@/components/Icon";
import { haptic } from "@/lib/haptics";
import { color as token, font, radius as rad } from "@/lib/tokens";

type CoachComposerProps = {
  value: string;
  canSend: boolean;
  isStreaming: boolean;
  isRecordingMic: boolean;
  isTranscribing: boolean;
  onChangeText: (text: string) => void;
  onInputBlur?: () => void;
  onInputFocus?: () => void;
  onMicPress: () => void;
  onSendPress: () => void;
  placeholder?: string;
};

export const CoachComposer = forwardRef<TextInput, CoachComposerProps>(
  function CoachComposer(
    {
      value,
      canSend,
      isStreaming,
      isRecordingMic,
      isTranscribing,
      onChangeText,
      onInputBlur,
      onInputFocus,
      onMicPress,
      onSendPress,
      placeholder = "Ask your coach...",
    },
    ref
  ) {
    const handleMicPress = () => {
      haptic.press(); // NUI-6: medium haptic on mic press
      onMicPress();
    };

    const handleSendPress = () => {
      haptic.tap(); // NUI-6: light haptic on send
      onSendPress();
    };

    return (
      <View style={styles.composer}>
        <View style={styles.composerRow}>
          <TextInput
            ref={ref}
            style={styles.composerInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={token.textMute}
            multiline
            editable={!isStreaming}
            textAlignVertical="center"
            returnKeyType="default"
            onBlur={onInputBlur}
            onFocus={onInputFocus}
          />

          {/* NUI-11: mic glyph → <Icon name="mic" /> / <Icon name="micOff" /> */}
          <Pressable
            style={[
              styles.micButton,
              isRecordingMic ? styles.micButtonRecording : null,
            ]}
            onPress={handleMicPress}
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
          <Pressable
            style={[
              styles.sendButton,
              !canSend ? styles.sendButtonDisabled : null,
            ]}
            disabled={!canSend}
            onPress={handleSendPress}
            accessibilityRole="button"
            accessibilityLabel="Send coach message"
          >
            {isStreaming ? (
              <ActivityIndicator color={token.accentInk} size="small" />
            ) : (
              <Icon name="send" size={18} color={token.accentInk} />
            )}
          </Pressable>
        </View>
      </View>
    );
  }
);

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
