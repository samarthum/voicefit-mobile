import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { color, font } from "../../lib/tokens";

export type ErrorScreenTone = "negative" | "warn";

export type ErrorScreenAction = {
  label: string;
  onPress: () => void;
};

export type ErrorScreenProps = {
  tone?: ErrorScreenTone;
  icon: ReactNode;
  title: string;
  body?: string;
  errorRef?: string;
  primary: ErrorScreenAction;
  secondary?: ErrorScreenAction;
  onClose?: () => void;
};

const toneTints = {
  negative: { bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.3)" },
  warn: { bg: "rgba(255,179,71,0.06)", border: "rgba(255,179,71,0.3)" },
} as const;

export function ErrorScreen({
  tone = "warn",
  icon,
  title,
  body,
  errorRef,
  primary,
  secondary,
  onClose,
}: ErrorScreenProps) {
  const tint = toneTints[tone];
  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={8}
          >
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        ) : (
          <View style={styles.closeBtn} />
        )}
      </View>

      <View style={styles.center}>
        <View
          style={[
            styles.iconRing,
            { backgroundColor: tint.bg, borderColor: tint.border },
          ]}
        >
          {icon}
        </View>

        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}

        {errorRef ? (
          <View style={styles.refPill}>
            <Text style={styles.refText}>{errorRef}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={primary.onPress}
          style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.primaryLabel}>{primary.label}</Text>
        </Pressable>
        {secondary ? (
          <Pressable
            onPress={secondary.onPress}
            style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.secondaryLabel}>{secondary.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20 },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
  closeGlyph: { color: color.text, fontSize: 18, lineHeight: 20, fontFamily: font.sans[500] },
  center: { alignItems: "center", marginTop: 24 },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: font.sans[600],
    fontSize: 26,
    color: color.text,
    letterSpacing: -0.65,
    marginTop: 32,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 31,
  },
  body: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: color.textSoft,
    marginTop: 12,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 22,
  },
  refPill: {
    marginTop: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 10,
  },
  refText: {
    fontFamily: font.mono[400],
    fontSize: 10.5,
    color: color.textMute,
    letterSpacing: 0.6,
  },
  actions: { marginTop: "auto", gap: 10 },
  primaryBtn: {
    height: 56,
    borderRadius: 14,
    backgroundColor: color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    fontFamily: font.sans[700],
    fontWeight: "700",
    fontSize: 15,
    color: color.accentInk,
    letterSpacing: -0.07,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.line2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  secondaryLabel: {
    fontFamily: font.sans[500],
    fontWeight: "500",
    fontSize: 14,
    color: color.textSoft,
  },
});
