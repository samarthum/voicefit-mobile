import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const COLORS = {
  bg: "#FFFFFF",
  border: "#E8E8E8",
  textPrimary: "#1A1A1A",
  textTertiary: "#AEAEB2",
};

function SparkleGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.2 8.2L20.4 10.4L14.2 12.6L12 18.8L9.8 12.6L3.6 10.4L9.8 8.2L12 2Z"
        fill="#D6D6DB"
      />
    </Svg>
  );
}

function MicGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5C10.067 3.5 8.5 5.067 8.5 7V12C8.5 13.933 10.067 15.5 12 15.5C13.933 15.5 15.5 13.933 15.5 12V7C15.5 5.067 13.933 3.5 12 3.5Z"
        stroke="#FFFFFF"
        strokeWidth={2}
      />
      <Path
        d="M5.5 11.5C5.5 15.09 8.41 18 12 18C15.59 18 18.5 15.09 18.5 11.5"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d="M12 18V21" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
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
      <Pressable style={styles.bar} onPress={onPress} testID={testID}>
        <View style={styles.left}>
          <SparkleGlyph />
          <Text style={styles.hint} numberOfLines={1}>
            {hint}
          </Text>
        </View>
        <Pressable style={styles.micButton} onPress={onMicPress ?? onPress}>
          <MicGlyph />
        </Pressable>
      </Pressable>
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
    minHeight: 64,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 18,
    paddingRight: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hint: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textTertiary,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});
