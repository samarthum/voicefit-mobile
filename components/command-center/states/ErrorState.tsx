import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { SheetShell } from "@/components/command-center/states/SheetShell";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { formatRecordingDuration } from "@/components/command-center/helpers";
import { color as t, font } from "@/lib/tokens";

export function ErrorState({ onClose }: { onClose: () => void }) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const { error, input } = snapshot;
  if (!error.copy) return null;

  const isMicError = error.subtype === "mic_permission_denied";
  const isVoiceError = error.subtype === "voice_interpret_failure";
  const tone = isMicError ? t.warn : t.negative;
  const toneTintBg = isMicError ? "rgba(255,179,71,0.12)" : "rgba(255,107,107,0.12)";
  const toneTintBorder = isMicError ? "rgba(255,179,71,0.35)" : "rgba(255,107,107,0.35)";
  const recBars = [4, 6, 3, 5, 4, 6, 5, 3, 4, 5, 4, 3];

  return (
    <SheetShell
      title={null}
      onClose={onClose}
      showCloseButton={false}
    >
      <View style={styles.errorBody}>
        <View
          style={[
            styles.errorIconTile,
            { backgroundColor: toneTintBg, borderColor: toneTintBorder },
          ]}
        >
          <Svg width={22} height={22} viewBox="0 0 22 22">
            <Path
              d="M11 2L20 19H2L11 2Z"
              stroke={tone}
              strokeWidth={1.8}
              strokeLinejoin="round"
              fill="none"
            />
            <Path d="M11 9V13" stroke={tone} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M11 16L11 16.01" stroke={tone} strokeWidth={2.4} strokeLinecap="round" />
          </Svg>
        </View>

        <Text style={styles.errorHeading} selectable>{error.copy.title}</Text>
        <Text style={styles.errorMessage} selectable>{error.copy.body}</Text>
        {error.detail ? (
          <Text style={[styles.errorDetailLine, { color: tone }]} selectable>
            {error.detail}
          </Text>
        ) : null}

        {isVoiceError ? (
          <View style={styles.errorRecStrip} testID="cc-error-rec-strip">
            <Text style={styles.errorRecLabel}>REC</Text>
            <View style={styles.errorRecBars}>
              {recBars.map((h, i) => (
                <View key={i} style={[styles.errorRecBar, { height: h }]} />
              ))}
            </View>
            <Text style={[styles.errorRecDuration, { color: tone }]}>
              {formatRecordingDuration(input.recordingSeconds)}
            </Text>
          </View>
        ) : null}

        <View style={styles.errorActions}>
          <Pressable
            style={styles.errorPrimaryButton}
            onPress={() => void dispatch({ type: "error.primary" })}
            testID="cc-error-primary"
          >
            <Svg width={14} height={14} viewBox="0 0 14 14">
              <Path
                d="M3 3V1L0 4L3 7V5C6 5 8 7 8 10H10C10 6 7 3 3 3Z"
                fill={t.accentInk}
              />
              <Path
                d="M11 11V13L14 10L11 7V9C8 9 6 7 6 4H4C4 8 7 11 11 11Z"
                fill={t.accentInk}
              />
            </Svg>
            <Text style={styles.errorPrimaryText}>{error.copy.primary}</Text>
          </Pressable>
          {error.copy.secondary ? (
            <Pressable
              style={styles.errorSecondaryButton}
              onPress={() => dispatch({ type: "error.secondary" })}
              testID="cc-error-secondary"
            >
              <Svg width={14} height={14} viewBox="0 0 14 14">
                <Path
                  d="M2 10L10 2L13 5L5 13H2V10Z"
                  stroke={t.text}
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
              <Text style={styles.errorSecondaryText}>{error.copy.secondary}</Text>
            </Pressable>
          ) : null}
          {error.copy.tertiary ? (
            <Pressable
              style={styles.errorTertiaryButton}
              onPress={onClose}
              testID="cc-error-tertiary"
            >
              <Text style={styles.errorTertiaryText}>{error.copy.tertiary}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  errorBody: { paddingHorizontal: 22, paddingBottom: 8 },
  errorIconTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  errorHeading: {
    fontFamily: font.sans[600],
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.44,
    color: t.text,
    lineHeight: 26,
  },
  errorMessage: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: t.textSoft,
    marginTop: 8,
    lineHeight: 21,
  },
  errorDetailLine: {
    fontFamily: font.sans[600],
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 10,
  },
  errorActions: {
    marginTop: 20,
    flexDirection: "column",
    gap: 8,
  },
  errorPrimaryButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: t.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorPrimaryText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.28,
    color: t.accentInk,
  },
  errorSecondaryButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorRecStrip: {
    marginTop: 16,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  errorRecLabel: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
  },
  errorRecBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  errorRecBar: {
    width: 3,
    borderRadius: 2,
    borderCurve: "continuous",
    backgroundColor: t.textMute,
  },
  errorRecDuration: {
    fontFamily: font.mono[600],
    fontSize: 11,
    fontWeight: "600",
  },
  errorSecondaryText: {
    fontFamily: font.sans[600],
    fontSize: 14,
    fontWeight: "600",
    color: t.text,
  },
  errorTertiaryButton: {
    width: "100%",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTertiaryText: {
    fontFamily: font.sans[600],
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: 0.135,
    color: t.textMute,
  },
});
