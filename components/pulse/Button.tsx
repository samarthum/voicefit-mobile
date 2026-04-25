import { Pressable, Text, type PressableProps } from "react-native";
import { color, elevation, font, radius } from "../../lib/tokens";

type ButtonProps = Omit<PressableProps, "children"> & {
  title: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "lg" | "md";
};

export function Button({
  title,
  variant = "primary",
  size = "lg",
  style,
  ...rest
}: ButtonProps) {
  const height = size === "lg" ? 56 : 48;

  const palette =
    variant === "primary"
      ? { bg: color.accent, fg: color.accentInk, border: color.accent, weight: "700" as const, shadow: elevation.primaryCTA }
      : variant === "secondary"
        ? { bg: color.surface, fg: color.text, border: color.line, weight: "600" as const, shadow: undefined }
        : { bg: "transparent", fg: color.text, border: color.line, weight: "600" as const, shadow: undefined };

  return (
    <Pressable
      {...rest}
      style={(state) => [
        {
          height,
          width: "100%",
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === "primary" ? 0 : 1,
          borderRadius: radius.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          opacity: state.pressed ? 0.85 : 1,
          ...(palette.shadow ?? {}),
        },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <Text
        style={{
          fontFamily: font.sans[700],
          fontSize: 15,
          fontWeight: palette.weight,
          letterSpacing: 0.2,
          color: palette.fg,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
