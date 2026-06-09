import type { ReactElement } from "react";
import { useEffect, useMemo } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { View } from "react-native";
import { color as token } from "@/lib/tokens";

export type WaveformProps = {
  active: boolean;
  bars?: number;
  width?: number;
  height?: number;
  color?: string;
  reducedMotion?: boolean;
};

const BAR_WIDTH = 3;
const MIN_SCALE = 0.2;
const MAX_SCALE = 1;
const LOOP_PERIOD = 1000;

// One animated bar — isolated so each bar has its own shared value and
// useAnimatedStyle hook, which is required by the Rules of Hooks.
function WaveBar({
  height,
  color,
  scaleY,
  marginLeft,
}: {
  height: number;
  color: string;
  scaleY: SharedValue<number>;
  marginLeft: number;
}) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return (
    <View
      style={{
        width: BAR_WIDTH,
        height,
        justifyContent: "flex-end",
        marginLeft,
      }}
    >
      <Animated.View
        style={[
          {
            width: BAR_WIDTH,
            height,
            borderRadius: 2,
            backgroundColor: color,
          },
          animStyle,
        ]}
      />
    </View>
  );
}

// We need a fixed-size hook array. React hooks cannot be called conditionally,
// so we pre-allocate MAX_BARS shared values and slice to `bars` at render time.
const MAX_BARS = 12;

export function Waveform({
  active,
  bars = 6,
  width = 120,
  height = 28,
  color = token.accent,
  reducedMotion = false,
}: WaveformProps): ReactElement {
  // Allocate MAX_BARS shared values unconditionally so hook count is stable
  // regardless of the `bars` prop — avoids conditional hook call violations.
  const sv0  = useSharedValue(MIN_SCALE);
  const sv1  = useSharedValue(MIN_SCALE);
  const sv2  = useSharedValue(MIN_SCALE);
  const sv3  = useSharedValue(MIN_SCALE);
  const sv4  = useSharedValue(MIN_SCALE);
  const sv5  = useSharedValue(MIN_SCALE);
  const sv6  = useSharedValue(MIN_SCALE);
  const sv7  = useSharedValue(MIN_SCALE);
  const sv8  = useSharedValue(MIN_SCALE);
  const sv9  = useSharedValue(MIN_SCALE);
  const sv10 = useSharedValue(MIN_SCALE);
  const sv11 = useSharedValue(MIN_SCALE);

  const allSvs = [sv0, sv1, sv2, sv3, sv4, sv5, sv6, sv7, sv8, sv9, sv10, sv11] as const;
  const svs = allSvs.slice(0, Math.min(bars, MAX_BARS));

  // Bell-curve peak per bar: middle bars taller, edges shorter.
  const peaks = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const t = i / Math.max(bars - 1, 1);
        const bell = 0.65 + 0.35 * Math.sin(Math.PI * t);
        return Math.min(MAX_SCALE, bell);
      }),
    [bars],
  );

  // Phase offsets stagger the peaks so the row feels organic.
  const phaseOffsets = useMemo(
    () => Array.from({ length: bars }, (_, i) => (i / bars) * LOOP_PERIOD),
    [bars],
  );

  useEffect(() => {
    if (reducedMotion) {
      svs.forEach((sv) => { sv.value = 0.5; });
      return;
    }

    if (!active) {
      svs.forEach((sv) => {
        sv.value = withTiming(MIN_SCALE, {
          duration: 180,
          easing: Easing.out(Easing.quad),
        });
      });
      return;
    }

    svs.forEach((sv, i) => {
      const peak = peaks[i] ?? MAX_SCALE;
      const half = LOOP_PERIOD / 2;
      const offset = phaseOffsets[i] ?? 0;

      sv.value = withDelay(
        offset,
        withRepeat(
          withSequence(
            withTiming(peak, { duration: half, easing: Easing.inOut(Easing.sin) }),
            withTiming(MIN_SCALE, { duration: half, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      );
    });
  }, [active, reducedMotion, bars]);

  const gap = bars > 1 ? (width - bars * BAR_WIDTH) / (bars - 1) : 0;

  return (
    <View
      style={{
        width,
        height,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      {svs.map((sv, i) => (
        <WaveBar
          key={i}
          height={height}
          color={color}
          scaleY={sv}
          marginLeft={i === 0 ? 0 : gap}
        />
      ))}
    </View>
  );
}
