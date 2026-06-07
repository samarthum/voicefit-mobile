import { StyleSheet, View } from "react-native";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";
import { color as token } from "@/lib/tokens";

export function CoachBadge() {
  return (
    <View style={styles.coachBadge}>
      <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <SvgCircle cx={20} cy={20} r={20} fill={token.accent} />
        <Path
          d="M20 9L23.5 17L31 19L23.5 21L20 30L16.5 21L9 19L16.5 17L20 9Z"
          fill={token.accentInk}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  coachBadge: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
