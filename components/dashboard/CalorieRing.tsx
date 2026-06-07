import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle as SvgCircle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { color as token, font } from "@/lib/tokens";

function progressPercent(current: number, goal: number) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(1, current / goal));
}

type Props = { consumed: number; goal: number };

export function CalorieRing({ consumed, goal }: Props) {
  const size = 150;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = progressPercent(consumed, goal);

  return (
    <View style={[styles.heroRingWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="limeRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={token.accent} />
            <Stop offset="1" stopColor={token.accentDim} />
          </LinearGradient>
        </Defs>
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={token.accentRingTrack}
          strokeWidth={stroke}
          fill="none"
        />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#limeRing)"
          strokeWidth={stroke}
          strokeDasharray={`${circumference * progress} ${circumference}`}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.heroRingCenter}>
        <Text style={styles.heroRingNumber} selectable>{consumed.toLocaleString()}</Text>
        <Text style={styles.heroRingLabel}>kcal in</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroRingWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroRingCenter: {
    position: "absolute",
    alignItems: "center",
  },
  heroRingNumber: {
    fontFamily: font.mono[500],
    fontSize: 38,
    fontWeight: "500",
    color: token.text,
    letterSpacing: -1.52,
    lineHeight: 38,
  },
  heroRingLabel: {
    marginTop: 4,
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.84,
    textTransform: "uppercase",
    color: token.textMute,
  },
});
