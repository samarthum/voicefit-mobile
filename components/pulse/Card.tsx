import { View, type ViewProps } from "react-native";
import { color, radius } from "../../lib/tokens";

type CardProps = ViewProps & {
  variant?: "surface" | "accentTint";
  rounded?: keyof typeof radius;
  padded?: boolean;
};

export function Card({
  variant = "surface",
  rounded = "md",
  padded = true,
  style,
  children,
  ...rest
}: CardProps) {
  const isAccent = variant === "accentTint";
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: isAccent ? color.accentTintBg : color.surface,
          borderColor: isAccent ? color.accentTintBorder : color.line,
          borderWidth: 1,
          borderRadius: radius[rounded],
          padding: padded ? 16 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
