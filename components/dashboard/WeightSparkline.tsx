import { Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { color as token, font } from "@/lib/tokens";
import { buildSparklinePath } from "@/lib/sparkline";

export function WeightSparkline({ values }: { values: (number | null)[] }) {
  const path = buildSparklinePath(values);
  if (!path) {
    return <Text style={{ color: token.textSoft, fontFamily: font.sans[400], fontSize: 11 }}>Log weight to see your trend</Text>;
  }
  return (
    <Svg width="100%" height={18} viewBox="0 0 120 18" preserveAspectRatio="none" accessible={false}>
      <Path d={path} stroke={token.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
