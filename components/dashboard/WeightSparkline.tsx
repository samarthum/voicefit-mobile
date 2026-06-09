import Svg, { Path } from "react-native-svg";
import { color as token } from "@/lib/tokens";

export function WeightSparkline() {
  return (
    <Svg width="100%" height={18} viewBox="0 0 120 18" preserveAspectRatio="none">
      <Path
        d="M0 8 L20 10 L40 6 L60 9 L80 7 L100 11 L120 14"
        stroke={token.accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
