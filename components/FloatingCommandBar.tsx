import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
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

// Reserve the native bar's content height separately from the safe area.
// The previous 83pt iOS value already included a home-indicator inset.
const TAB_BAR_CONTENT_HEIGHT = Platform.OS === "ios" ? 49 : 83;
const TAB_BAR_GAP = Platform.OS === "ios" ? 8 : 0;

type FloatingCommandBarProps = {
  hint: string;
  onPress: () => void;
  onMicPress?: () => void;
  testID?: string;
  bottomOffset?: number;
  /**
   * Add the bottom safe-area inset to the bar's offset. Only needed on
   * full-bleed screens (no tab bar) so the bar clears the home indicator.
   */
  safeAreaBottom?: boolean;
  /**
   * The screen sits over the native bottom tab bar. The native tab content
   * renders full-height *behind* the tab bar (react-native-screens lays it out
   * at 100% height), so a bar pinned to `bottom: 0` is hidden underneath the
   * tab bar. Lift it by the tab-bar height + the bottom safe-area inset (which
   * the native tab bar itself consumes) so it docks just above the nav.
   */
  overTabBar?: boolean;
};

export function FloatingCommandBar({
  hint,
  onPress,
  onMicPress,
  testID,
  bottomOffset = 0,
  safeAreaBottom = false,
  overTabBar = false,
}: FloatingCommandBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = overTabBar
    ? TAB_BAR_CONTENT_HEIGHT + insets.bottom + TAB_BAR_GAP + bottomOffset
    : bottomOffset + (safeAreaBottom ? insets.bottom : 0);
  return (
    <View
      style={overTabBar ? [styles.docked, { marginBottom: bottom }] : [styles.wrap, { bottom }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        <Pressable
          style={({ pressed }) => [styles.left, pressed && styles.pressed]}
          onPress={onPress}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel="Log an entry"
        >
          <PulseDot />
          <Text style={styles.hint} numberOfLines={1}>
            {hint}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.micButton, pressed && styles.pressed]}
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
  pressed: { opacity: 0.65 },
  docked: {
    marginHorizontal: 12,
    marginTop: 8,
  },
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
    minHeight: 56,
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
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
