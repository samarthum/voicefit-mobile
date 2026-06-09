import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import type { StyleProp, ViewStyle } from "react-native";
import { color } from "@/lib/tokens";

type LoadingBlockProps = {
  width?: number | `${number}%` | "100%";
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  reducedMotion?: boolean;
};

export function LoadingBlock({
  width = "100%",
  height,
  radius = 8,
  style,
  reducedMotion = false,
}: LoadingBlockProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = 1;
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          borderCurve: "continuous",
          backgroundColor: color.surface2,
        },
        animStyle,
        style,
      ]}
    />
  );
}

export default LoadingBlock;
