// Bridges design-token motion values to React Native Animated API helpers.
import { Animated, Easing, type EasingFunction } from "react-native";
import { motion } from "./tokens";

const bezier = (c: { x1: number; y1: number; x2: number; y2: number }): EasingFunction =>
  Easing.bezier(c.x1, c.y1, c.x2, c.y2);

export const ease: Record<keyof typeof motion.ease, EasingFunction> = {
  std: bezier(motion.ease.std),
  snap: bezier(motion.ease.snap),
  emph: bezier(motion.ease.emph),
  exit: bezier(motion.ease.exit),
};

export const dur = motion.dur;

export function timing(
  value: Animated.Value,
  opts: {
    toValue: number;
    duration?: number;
    easing?: EasingFunction;
    useNativeDriver?: boolean;
  },
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue: opts.toValue,
    duration: opts.duration ?? dur.base,
    easing: opts.easing ?? ease.std,
    useNativeDriver: opts.useNativeDriver ?? true,
  });
}

export function reducedTiming(
  value: Animated.Value,
  toValue: number,
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue,
    duration: 200,
    easing: Easing.linear,
    useNativeDriver: true,
  });
}
