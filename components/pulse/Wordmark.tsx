import { View, Text } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { color, font } from "@/lib/tokens";

// A filled badge carries the same visual weight as the bold lowercase word;
// the old 1.5pt outline read as a separate, lighter element. "voicefit" has no
// descenders, so its ink sits below the line box's center. The fixed line
// height plus a small downward nudge puts the badge on the x-height's optical
// center instead of the box center.
export function Wordmark({ size = 22 }: { size?: number }) {
  const glyph = Math.round(size * 0.8);
  const lineHeight = Math.round(size * 1.2);
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: size * 0.3 }}
      accessible
      accessibilityRole="header"
      accessibilityLabel="VoiceFit"
    >
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24" style={{ marginTop: size * 0.075 }}>
        <Circle cx={12} cy={12} r={12} fill={color.accent} />
        <Path
          d="M7.2 12.4L10.4 15.5L16.8 8.9"
          stroke={color.accentInk}
          strokeWidth={2.4}
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
          lineHeight,
          letterSpacing: -size * 0.03,
          color: color.text,
          includeFontPadding: false,
        }}
      >
        voicefit
      </Text>
    </View>
  );
}
