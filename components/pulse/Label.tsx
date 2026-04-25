import { Text, type TextProps } from "react-native";
import { color, font } from "../../lib/tokens";

type LabelProps = TextProps & {
  tone?: "default" | "primary" | "accent" | "soft";
};

export function Label({ tone = "default", style, children, ...rest }: LabelProps) {
  const palette = {
    default: color.textMute,
    primary: color.text,
    accent: color.accent,
    soft: color.textSoft,
  }[tone];

  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: font.sans[600],
          fontSize: 10.5,
          fontWeight: "600",
          letterSpacing: 1.68,
          textTransform: "uppercase",
          color: palette,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
