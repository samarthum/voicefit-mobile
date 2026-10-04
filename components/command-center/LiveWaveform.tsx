import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { color as t } from "@/lib/tokens";

/** Anything with expo-audio's AudioRecorder.getStatus() shape. */
export interface MeteredRecorder {
  getStatus?: () => { metering?: number; isRecording?: boolean };
}

const TICK_MS = 60;
// Speech on a phone mic sits roughly between -50 dB (quiet) and -5 dB (close,
// loud). Map that band onto 0..1 so normal talking fills most of the height.
const FLOOR_DB = -52;
const RANGE_DB = 44;

export function meterToLevel(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  const linear = Math.min(1, Math.max(0, (db - FLOOR_DB) / RANGE_DB));
  // Ease-in so background hiss stays flat and syllables pop.
  return linear ** 1.6;
}

/**
 * Polls the recorder's meter and keeps a rolling history, newest last.
 * Polling lives in this leaf hook so only the waveform re-renders at ~16 Hz,
 * never the command-center provider.
 */
export function useMicLevels(recorder: MeteredRecorder | null | undefined, bars: number, active = true) {
  const [levels, setLevels] = useState<number[]>(() => Array(bars).fill(0));
  const smoothed = useRef(0);

  useEffect(() => {
    if (!active || typeof recorder?.getStatus !== "function") return;
    const id = setInterval(() => {
      let raw = 0;
      try {
        raw = meterToLevel(recorder.getStatus?.().metering);
      } catch {
        raw = 0;
      }
      // Fast attack, slower release reads as a voice rather than a strobe.
      const prev = smoothed.current;
      smoothed.current = raw > prev ? prev + (raw - prev) * 0.7 : prev + (raw - prev) * 0.35;
      const next = smoothed.current;
      setLevels((current) => {
        const out = current.slice(1);
        out.push(next);
        return out;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [recorder, active]);

  return levels;
}

export function LiveWaveform({
  levels,
  height = 64,
  barWidth = 3,
  gap = 3,
  testID,
}: {
  levels: number[];
  height?: number;
  barWidth?: number;
  gap?: number;
  testID?: string;
}) {
  const last = levels.length - 1;
  return (
    <View
      style={[styles.row, { height, gap }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Recording audio level"
      testID={testID}
    >
      {levels.map((level, i) => {
        // Older samples fade toward the left edge so the newest sound reads
        // as "now" at the right.
        const age = (last - i) / Math.max(1, last);
        const barHeight = Math.max(barWidth + 1, level * height);
        return (
          <View
            key={i}
            style={{
              width: barWidth,
              height: barHeight,
              borderRadius: barWidth,
              backgroundColor: t.accent,
              opacity: 0.25 + 0.75 * (1 - age) ** 1.4,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
