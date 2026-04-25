import { Text, type TextProps } from "react-native";
import { color, font } from "../../lib/tokens";

const SIZES = {
  xs: { fontFamily: font.mono[400], fontSize: 11, lineHeight: 14, letterSpacing: 0 },
  sm: { fontFamily: font.mono[500], fontSize: 16, lineHeight: 16, letterSpacing: -0.32 },
  md: { fontFamily: font.mono[500], fontSize: 22, lineHeight: 22, letterSpacing: -0.66 },
  lg: { fontFamily: font.mono[500], fontSize: 26, lineHeight: 26, letterSpacing: -0.78 },
  xl: { fontFamily: font.mono[500], fontSize: 38, lineHeight: 38, letterSpacing: -1.52 },
  xl2: { fontFamily: font.mono[500], fontSize: 44, lineHeight: 44, letterSpacing: -1.76 },
  xl3: { fontFamily: font.mono[500], fontSize: 58, lineHeight: 58, letterSpacing: -2.61 },
} as const;

type NumeralProps = TextProps & {
  size?: keyof typeof SIZES;
  tone?: "primary" | "accent" | "soft" | "mute" | "positive" | "negative";
};

export function Numeral({ size = "md", tone = "primary", style, children, ...rest }: NumeralProps) {
  const palette = {
    primary: color.text,
    accent: color.accent,
    soft: color.textSoft,
    mute: color.textMute,
    positive: color.positive,
    negative: color.negative,
  }[tone];

  return (
    <Text
      {...rest}
      style={[
        SIZES[size],
        { color: palette, fontVariant: ["tabular-nums"] },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
