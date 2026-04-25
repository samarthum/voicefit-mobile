import { View, Text } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { color, font } from "../../lib/tokens";

export function Wordmark({ size = 22 }: { size?: number }) {
  const glyph = size * 0.7;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={11} stroke={color.accent} strokeWidth={1.5} fill="none" />
        <Path
          d="M7 12L10 15L17 8"
          stroke={color.accent}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <Text
        style={{
          fontFamily: font.sans[700],
          fontWeight: "700",
          fontSize: size,
          letterSpacing: -0.66,
          color: color.text,
        }}
      >
        voicefit
      </Text>
    </View>
  );
}
