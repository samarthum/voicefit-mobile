import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { color, motion } from "../../lib/tokens";

export type VoiceRingState = "idle" | "listening" | "interpreting" | "saved" | "error";

export type VoiceRingProps = {
  state: VoiceRingState;
  size?: number;
  reducedMotion?: boolean;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.View;

const easeStd = Easing.bezier(motion.ease.std.x1, motion.ease.std.y1, motion.ease.std.x2, motion.ease.std.y2);
const easeEmph = Easing.bezier(0.34, 1.56, 0.64, 1);

export function VoiceRing({ state, size = 200, reducedMotion = false }: VoiceRingProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const savedScale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      easing: easeStd,
      useNativeDriver: true,
    }).start();

    if (reducedMotion) return;

    let pulseLoop: Animated.CompositeAnimation | null = null;
    let spinLoop: Animated.CompositeAnimation | null = null;
    let savedAnim: Animated.CompositeAnimation | null = null;

    if (state === "listening") {
      pulse.setValue(0);
      pulseLoop = Animated.loop(
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: easeStd,
          useNativeDriver: true,
        })
      );
      pulseLoop.start();
    } else if (state === "interpreting") {
      spin.setValue(0);
      spinLoop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinLoop.start();
    } else if (state === "saved") {
      savedScale.setValue(0.6);
      savedAnim = Animated.timing(savedScale, {
        toValue: 1,
        duration: motion.dur.expr,
        easing: easeEmph,
        useNativeDriver: true,
      });
      savedAnim.start();
    }

    return () => {
      pulseLoop?.stop();
      spinLoop?.stop();
      savedAnim?.stop();
    };
  }, [state, reducedMotion, pulse, spin, savedScale, fade]);

  const half = size / 2;
  const stroke = 3;
  const r = half - stroke / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * 0.3;

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const containerStyle = [styles.container, { width: size, height: size, opacity: fade }];
  const glow = null;

  if (state === "idle") {
    return (
      <AnimatedView style={containerStyle}>
        <Svg width={size} height={size}>
          <Circle cx={half} cy={half} r={r} stroke={color.line2} strokeWidth={1} fill="none" />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <MicIcon size={size} stroke={color.text} />
        </View>
      </AnimatedView>
    );
  }

  if (state === "listening") {
    return (
      <AnimatedView style={[containerStyle, glow]}>
        {!reducedMotion && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          >
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
      </AnimatedView>
    );
  }

  if (state === "interpreting") {
    return (
      <AnimatedView style={containerStyle}>
        <Svg width={size} height={size}>
          <Circle cx={half} cy={half} r={r - stroke / 2} fill={color.accentTintBg} />
          <Circle cx={half} cy={half} r={r} stroke={color.accentRingTrack} strokeWidth={stroke} fill="none" />
        </Svg>
        {/* stroke-dasharray trick: dash = arcLength, gap = circumference, rotate the whole svg */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ rotate: reducedMotion ? "0deg" : spinDeg }] }]}
        >
          <Svg width={size} height={size}>
            <AnimatedCircle
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
      </AnimatedView>
    );
  }

  if (state === "saved") {
    const scale = reducedMotion ? 1 : savedScale;
    return (
      <AnimatedView style={containerStyle}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
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
      </AnimatedView>
    );
  }

  return (
    <AnimatedView style={containerStyle}>
      <Svg width={size} height={size}>
        <Circle cx={half} cy={half} r={r} stroke={color.negative} strokeWidth={stroke} fill="none" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Svg width={size * 0.1} height={size * 0.32}>
          <Rect x={size * 0.035} y={0} width={size * 0.03} height={size * 0.22} rx={size * 0.015} fill={color.negative} />
          <Circle cx={size * 0.05} cy={size * 0.28} r={size * 0.022} fill={color.negative} />
        </Svg>
      </View>
    </AnimatedView>
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
