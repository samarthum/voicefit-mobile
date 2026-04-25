import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { color, font, radius } from "../lib/tokens";

function PulseDot() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={6} stroke={color.accent} strokeOpacity={0.35} fill="none" />
      <Circle cx={7} cy={7} r={2.5} fill={color.accent} />
    </Svg>
  );
}

function MicGlyph() {
  return (
    <Svg width={14} height={18} viewBox="0 0 14 18" fill="none">
      <Rect x={4} y={0} width={6} height={10} rx={3} fill={color.accentInk} />
      <Path
        d="M1 8C1 11.5 3.8 14 7 14C10.2 14 13 11.5 13 8"
        stroke={color.accentInk}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M7 14V17M4.5 17H9.5" stroke={color.accentInk} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

type FloatingCommandBarProps = {
  hint: string;
  onPress: () => void;
  onMicPress?: () => void;
  testID?: string;
  bottomOffset?: number;
};

export function FloatingCommandBar({
  hint,
  onPress,
  onMicPress,
  testID,
  bottomOffset = 8,
}: FloatingCommandBarProps) {
  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <Pressable style={styles.left} onPress={onPress} testID={testID}>
          <PulseDot />
          <Text style={styles.hint} numberOfLines={1}>
            {hint}
          </Text>
        </Pressable>
        <Pressable style={styles.micButton} onPress={onMicPress ?? onPress}>
          <MicGlyph />
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
