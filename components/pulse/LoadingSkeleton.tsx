import { useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import { color } from "../../lib/tokens";

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
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1);
      return;
    }
    pulse.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: color.surface2,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

export default LoadingBlock;
