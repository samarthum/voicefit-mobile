import { Pressable, Text, View, type PressableProps } from "react-native";
import { color, font, radius } from "../../lib/tokens";

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: PressableProps["onPress"];
};

export function Chip({ label, active = false, onPress }: ChipProps) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      style={{
        height: 32,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: active ? color.accent : "transparent",
        borderWidth: active ? 0 : 1,
        borderColor: color.line,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: font.sans[600],
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 0.4,
          color: active ? color.accentInk : color.textSoft,
        }}
      >
        {label}
      </Text>
    </Wrap>
  );
}
