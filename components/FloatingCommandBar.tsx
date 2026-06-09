import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { color, font, radius } from "@/lib/tokens";
import { Icon } from "@/components/Icon";
import { haptic } from "@/lib/haptics";

function PulseDot() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={6} stroke={color.accent} strokeOpacity={0.35} fill="none" />
      <Circle cx={7} cy={7} r={2.5} fill={color.accent} />
    </Svg>
  );
}

type FloatingCommandBarProps = {
  hint: string;
  onPress: () => void;
  onMicPress?: () => void;
  testID?: string;
  bottomOffset?: number;
  /**
   * Add the bottom safe-area inset to the bar's offset. Only needed on
   * full-bleed screens (no tab bar) so the bar clears the home indicator.
   * Tab screens sit above the tab bar — which already consumes the bottom
   * inset — so they leave this off and dock flush against the nav.
   */
  safeAreaBottom?: boolean;
};

export function FloatingCommandBar({
  hint,
  onPress,
  onMicPress,
  testID,
  bottomOffset = 0,
  safeAreaBottom = false,
}: FloatingCommandBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.wrap, { bottom: bottomOffset + (safeAreaBottom ? insets.bottom : 0) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        <Pressable
          style={styles.left}
          onPress={onPress}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel="Open command center"
        >
          <PulseDot />
          <Text style={styles.hint} numberOfLines={1}>
            {hint}
          </Text>
        </Pressable>
        <Pressable
          style={styles.micButton}
          onPress={() => { haptic.press(); (onMicPress ?? onPress)(); }}
          accessibilityRole="button"
          accessibilityLabel="Start voice input"
        >
          <Icon name="mic" size={18} color={color.accentInk} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
  },
  bar: {
    minHeight: 58,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 18,
    paddingRight: 8,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hint: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 14.5,
    color: color.textSoft,
    letterSpacing: -0.07,
  },
  micButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
