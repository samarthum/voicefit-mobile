import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { color, motion } from "@/lib/tokens";

export type VoiceRingState = "idle" | "listening" | "interpreting" | "saved" | "error";

export type VoiceRingProps = {
  state: VoiceRingState;
  size?: number;
  reducedMotion?: boolean;
};

// Reanimated v4 — Animated.createAnimatedComponent is on the Reanimated namespace.
// For SVG circles driven by spin we keep the rotate on a wrapping Animated.View.

const easeStd = Easing.bezier(
  motion.ease.std.x1,
  motion.ease.std.y1,
  motion.ease.std.x2,
  motion.ease.std.y2,
);

export function VoiceRing({ state, size = 200, reducedMotion = false }: VoiceRingProps) {
  // --- shared values ---
  const fade = useSharedValue(0);
  const pulse = useSharedValue(0);        // 0→1 cycling for listening ring
  const spin = useSharedValue(0);         // 0→360 cycling for interpreting arc
  const savedScale = useSharedValue(0.6); // 0.6→1 spring for saved checkmark

  // --- fade in on every state change ---
  useEffect(() => {
    fade.value = 0;
    fade.value = withTiming(1, { duration: 200, easing: easeStd });
  }, [state]);

  // --- per-state animations ---
  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 0;
      spin.value = 0;
      savedScale.value = 1;
      return;
    }

    if (state === "listening") {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1400, easing: easeStd }),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(0, { duration: 150 });
    }

    if (state === "interpreting") {
      spin.value = 0;
      spin.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      spin.value = withTiming(0, { duration: 150 });
    }

    if (state === "saved") {
      savedScale.value = 0.6;
      savedScale.value = withSpring(1, {
        damping: 8,
        stiffness: 100,
      });
    }
  }, [state, reducedMotion]);

  // --- animated styles ---
  const containerStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.18 }],
    opacity: 0.5 - pulse.value * 0.5,
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const savedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: savedScale.value }],
  }));

  const half = size / 2;
  const stroke = 3;
  const r = half - stroke / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * 0.3;

  if (state === "idle") {
    return (
      <Animated.View style={[styles.container, { width: size, height: size }, containerStyle]}>
        <Svg width={size} height={size}>
          <Circle cx={half} cy={half} r={r} stroke={color.line2} strokeWidth={1} fill="none" />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <MicIcon size={size} stroke={color.text} />
        </View>
      </Animated.View>
    );
  }

  if (state === "listening") {
    return (
      <Animated.View style={[styles.container, { width: size, height: size }, containerStyle]}>
        {!reducedMotion && (
          <Animated.View style={[StyleSheet.absoluteFill, pulseRingStyle]}>
            <Svg width={size} height={size}>
              <Circle cx={half} cy={half} r={r} stroke={color.accent} strokeWidth={stroke} fill="none" />
            </Svg>
          </Animated.View>
        )}
        <Svg width={size} height={size}>
          <Circle cx={half} cy={half} r={r} stroke={color.accent} strokeWidth={stroke} fill="none" />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <MicIcon size={size} stroke={color.accent} />
        </View>
      </Animated.View>
    );
  }

  if (state === "interpreting") {
    return (
      <Animated.View style={[styles.container, { width: size, height: size }, containerStyle]}>
        <Svg width={size} height={size}>
          <Circle cx={half} cy={half} r={r - stroke / 2} fill={color.accentTintBg} />
          <Circle cx={half} cy={half} r={r} stroke={color.accentRingTrack} strokeWidth={stroke} fill="none" />
        </Svg>
        {/* Rotating arc overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            reducedMotion ? undefined : spinStyle,
          ]}
        >
          <Svg width={size} height={size}>
            <Circle
              cx={half}
              cy={half}
              r={r}
              stroke={color.accent}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
            />
          </Svg>
        </Animated.View>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Dots />
        </View>
      </Animated.View>
    );
  }

  if (state === "saved") {
    return (
      <Animated.View style={[styles.container, { width: size, height: size }, containerStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, reducedMotion ? undefined : savedScaleStyle]}>
          <Svg width={size} height={size}>
            <Circle cx={half} cy={half} r={r} fill={color.accent} />
            <Path
              d={`M ${half - size * 0.13} ${half} L ${half - size * 0.03} ${half + size * 0.1} L ${half + size * 0.15} ${half - size * 0.1}`}
              stroke={color.accentInk}
              strokeWidth={size * 0.04}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    );
  }

  // error state
  return (
    <Animated.View style={[styles.container, { width: size, height: size }, containerStyle]}>
      <Svg width={size} height={size}>
        <Circle cx={half} cy={half} r={r} stroke={color.negative} strokeWidth={stroke} fill="none" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Svg width={size * 0.1} height={size * 0.32}>
          <Rect x={size * 0.035} y={0} width={size * 0.03} height={size * 0.22} rx={size * 0.015} fill={color.negative} />
          <Circle cx={size * 0.05} cy={size * 0.28} r={size * 0.022} fill={color.negative} />
        </Svg>
      </View>
    </Animated.View>
  );
}

function MicIcon({ size, stroke }: { size: number; stroke: string }) {
  const w = size * 0.18;
  const h = w * (28 / 22);
  return (
    <View style={styles.center}>
      <Svg width={w} height={h} viewBox="0 0 22 28" fill="none">
        <Rect x={7} y={1} width={8} height={14} rx={4} stroke={stroke} strokeWidth={1.8} fill="none" />
        <Path d="M3 13C3 17.5 6.5 21 11 21C15.5 21 19 17.5 19 13" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" fill="none" />
        <Path d="M11 21V26M7 26H15" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function Dots() {
  return (
    <View style={[styles.center, { flexDirection: "row", gap: 6 }]}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color.accent,
            opacity: i === 1 ? 1 : 0.3,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
