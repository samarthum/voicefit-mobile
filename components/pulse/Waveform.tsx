import type { ReactElement } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { color as token } from "../../lib/tokens";

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

export function Waveform({
  active,
  bars = 6,
  width = 120,
  height = 28,
  color = token.accent,
  reducedMotion = false,
}: WaveformProps): ReactElement {
  // One Animated.Value per bar — initialised at MIN so a static state reads as
  // a calm baseline rather than full-height bars.
  const anims = useRef(
    Array.from({ length: bars }, () => new Animated.Value(MIN_SCALE)),
  ).current;

  // Keep the ref array in sync if the `bars` prop ever changes at runtime.
  if (anims.length !== bars) {
    anims.length = 0;
    for (let i = 0; i < bars; i++) anims.push(new Animated.Value(MIN_SCALE));
  }

  // Per-bar phase offset — staggers peaks so the row feels organic. Memoised so
  // remounts don't reshuffle on every render and cause visual jitter.
  const phaseOffsets = useMemo(
    () => Array.from({ length: bars }, (_, i) => (i / bars) * LOOP_PERIOD),
    [bars],
  );

  // Heights vary slightly per bar to mimic the screens-c.jsx hand-tuned look.
  const peaks = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const t = i / Math.max(bars - 1, 1);
        // Bell-ish curve: middle bars taller, edges shorter.
        const bell = 0.65 + 0.35 * Math.sin(Math.PI * t);
        return Math.min(MAX_SCALE, bell);
      }),
    [bars],
  );

  useEffect(() => {
    if (reducedMotion) {
      anims.forEach((a) => a.setValue(0.5));
      return;
    }
    if (!active) {
      anims.forEach((a) =>
        Animated.timing(a, {
          toValue: MIN_SCALE,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(),
      );
      return;
    }

    const loops = anims.map((a, i) => {
      const peak = peaks[i] ?? MAX_SCALE;
      const half = LOOP_PERIOD / 2;
      const offset = phaseOffsets[i] ?? 0;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(a, {
            toValue: peak,
            duration: half,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
            delay: offset,
          }),
          Animated.timing(a, {
            toValue: MIN_SCALE,
            duration: half,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return loop;
    });

    return () => loops.forEach((l) => l.stop());
  }, [active, reducedMotion, anims, peaks, phaseOffsets]);

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
      {anims.map((a, i) => (
        // Outer wrapper aligns to the baseline; scaleY needs an anchor and RN
        // honours transform-origin via the wrapping View's layout box.
        <View
          key={i}
          style={{
            width: BAR_WIDTH,
            height,
            justifyContent: "flex-end",
            marginLeft: i === 0 ? 0 : gap,
          }}
        >
          <Animated.View
            style={{
              width: BAR_WIDTH,
              height,
              borderRadius: 2,
              backgroundColor: color,
              transform: [{ scaleY: a }, { translateY: 0 }],
              // scaleY scales around centre by default — shift origin to bottom
              // by translating down by half of the unscaled height before scale.
              // RN doesn't expose transformOrigin reliably, so we fake it with
              // a bottom-anchored wrapper above + scaleY on the inner View.
              transformOrigin: "bottom" as never,
            }}
          />
        </View>
      ))}
    </View>
  );
}
