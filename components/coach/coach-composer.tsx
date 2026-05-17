import React, { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { color as token, font, radius as rad } from "../../lib/tokens";

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
              <MicGlyph color={isRecordingMic ? token.accent : token.textSoft} />
            )}
          </Pressable>

          <Pressable
            style={[
              styles.sendButton,
              !canSend ? styles.sendButtonDisabled : null,
            ]}
            disabled={!canSend}
            onPress={onSendPress}
            accessibilityRole="button"
            accessibilityLabel="Send coach message"
          >
            {isStreaming ? (
              <ActivityIndicator color={token.accentInk} size="small" />
            ) : (
              <SendGlyph color={token.accentInk} />
            )}
          </Pressable>
        </View>
      </View>
    );
  }
);

function MicGlyph({ color = token.textSoft }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5C10.067 3.5 8.5 5.067 8.5 7V12C8.5 13.933 10.067 15.5 12 15.5C13.933 15.5 15.5 13.933 15.5 12V7C15.5 5.067 13.933 3.5 12 3.5Z"
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M5.5 11.5C5.5 15.09 8.41 18 12 18C15.59 18 18.5 15.09 18.5 11.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M12 18V21"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SendGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 20L20 12L3.5 4L6.2 10.4L13 12L6.2 13.6L3.5 20Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
    backgroundColor: token.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: token.surface2,
    opacity: 0.6,
  },
});
