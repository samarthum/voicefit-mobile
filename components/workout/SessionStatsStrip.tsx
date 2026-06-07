import { StyleSheet, Text, View } from "react-native";
import { color as token, font, radius as rad } from "@/lib/tokens";

interface Props {
  duration: string;
  volume: string;
  sets: string;
}

export function SessionStatsStrip({ duration, volume, sets }: Props) {
  return (
    <View style={styles.statsStrip}>
      <View style={styles.statCell}>
        <Text selectable style={styles.statValue}>{duration}</Text>
        <Text style={styles.statLabel}>Duration</Text>
      </View>
      <View style={styles.statCell}>
        <Text selectable style={styles.statValue}>{volume}</Text>
        <Text style={styles.statLabel}>Volume</Text>
      </View>
      <View style={styles.statCell}>
        <Text selectable style={styles.statValue}>{sets}</Text>
        <Text style={styles.statLabel}>Sets</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsStrip: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  statCell: {
    flex: 1,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: rad.sm,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  statValue: {
    fontFamily: font.mono[500],
    fontSize: 20,
    fontWeight: "500",
    letterSpacing: -0.6,
    color: token.text,
  },
  statLabel: {
    marginBottom: 4,
    fontFamily: font.sans[600],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.52,
    textTransform: "uppercase",
    color: token.textMute,
  },
});
