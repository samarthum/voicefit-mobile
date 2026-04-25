import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { color, font } from "../../lib/tokens";

export type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export function EmptyState({ icon, title, body, ctaLabel, onCta }: EmptyStateProps) {
  const showCta = Boolean(ctaLabel && onCta);
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {showCta ? (
        <Pressable
          onPress={onCta}
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.line2,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: font.sans[600],
    fontSize: 18,
    color: color.text,
    letterSpacing: -0.27,
    textAlign: "center",
  },
  body: {
    fontFamily: font.sans[400],
    fontSize: 13,
    color: color.textSoft,
    lineHeight: 19,
    maxWidth: 260,
    marginTop: 8,
    textAlign: "center",
  },
  cta: {
    height: 38,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: color.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  ctaLabel: {
    fontFamily: font.sans[700],
    fontWeight: "700",
    fontSize: 13.5,
    color: color.accentInk,
    letterSpacing: -0.07,
  },
});
