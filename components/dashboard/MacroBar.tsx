import { StyleSheet, Text, View } from "react-native";
import { color as token, font } from "@/lib/tokens";

export type MacroBarProps = {
  label: string;
  current: number | null;
  goal: number | null;
  tone?: "accent" | "soft";
};

export function MacroBar({ label, current, goal, tone = "soft" }: MacroBarProps) {
  const hasGoal = goal != null && goal > 0;
  const percent = hasGoal && current != null ? Math.max(0, Math.min(1, current / goal)) : 0;
  const fillColor = tone === "accent" ? token.accent : token.textSoft;
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {current != null ? Math.round(current) : "—"}
          {hasGoal ? <Text style={styles.macroValueGoal}>/{goal}g</Text> : <Text style={styles.macroValueGoal}>g</Text>}
        </Text>
      </View>
      {hasGoal ? (
        <View style={styles.macroTrack}>
          <View style={[styles.macroFill, { width: `${percent * 100}%`, backgroundColor: fillColor }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  macroRow: {},
  macroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  macroLabel: {
    fontFamily: font.sans[400],
    fontSize: 11,
    color: token.textSoft,
    letterSpacing: 0.44,
  },
  macroValue: {
    fontFamily: font.mono[500],
    fontSize: 11,
    color: token.text,
  },
  macroValueGoal: {
    color: token.textMute,
  },
  macroTrack: {
    height: 4,
    backgroundColor: token.line,
    borderRadius: 2,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  macroFill: {
    height: "100%",
    borderRadius: 2,
    borderCurve: "continuous",
  },
});
