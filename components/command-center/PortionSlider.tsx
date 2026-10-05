import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { haptic } from "@/lib/haptics";
import { color as t } from "@/lib/tokens";

/**
 * Horizontal portion slider around an AI-estimated amount. Built on
 * PanResponder (not Gesture Handler) because it lives inside a native Modal,
 * where Gesture Handler needs its own root on Android.
 */
export function portionRange(original: number) {
  const step = original >= 50 ? 5 : original >= 10 ? 1 : 0.5;
  const snap = (value: number) => Math.round(value / step) * step;
  return {
    min: Math.max(step, snap(original * 0.25)),
    max: Math.max(step * 2, snap(original * 3)),
    step,
    snap,
  };
}

const THUMB = 28;

export function PortionSlider({
  value,
  original,
  onChange,
  disabled = false,
}: {
  value: number;
  /** The estimate the range is built around; marked with a tick. */
  original: number;
  onChange: (grams: number) => void;
  disabled?: boolean;
}) {
  const { min, max, snap } = useMemo(() => portionRange(original), [original]);
  const [width, setWidth] = useState(0);
  const last = useRef(value);
  const usable = Math.max(1, width - THUMB);
  const toX = (grams: number) => ((Math.min(max, Math.max(min, grams)) - min) / (max - min)) * usable;
  const fromX = (x: number) => snap(min + (Math.min(usable, Math.max(0, x)) / usable) * (max - min));

  // Refs keep the responder (created once) reading the latest geometry/props.
  const latest = useRef({ fromX, onChange, disabled });
  latest.current = { fromX, onChange, disabled };
  const emit = (x: number) => {
    const grams = latest.current.fromX(x - THUMB / 2);
    if (grams !== last.current) {
      last.current = grams;
      haptic.selection();
      latest.current.onChange(grams);
    }
  };
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onMoveShouldSetPanResponder: () => !latest.current.disabled,
    // Keep the drag even if the finger drifts vertically over the scroll view.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => emit(event.nativeEvent.locationX),
    onPanResponderMove: (event) => emit(event.nativeEvent.locationX),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  last.current = value;
  const thumbX = toX(value);

  return (
    <View
      style={[styles.hitArea, disabled && styles.disabled]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Portion"
      accessibilityValue={{ min, max, now: Math.round(value), text: `${value} grams` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const { step } = portionRange(original);
        const next = event.nativeEvent.actionName === "increment" ? value + step * 2 : value - step * 2;
        onChange(Math.min(max, Math.max(min, snap(next))));
      }}
      testID="cc-ingredient-portion-slider"
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.fill, { width: thumbX + THUMB / 2 }]} />
      </View>
      <View pointerEvents="none" style={[styles.originalTick, { left: toX(original) + THUMB / 2 - 1 }]} />
      <View pointerEvents="none" style={[styles.thumb, { transform: [{ translateX: thumbX }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: { height: 44, justifyContent: "center" },
  disabled: { opacity: 0.5 },
  track: {
    marginHorizontal: THUMB / 2,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.surface2,
    overflow: "hidden",
  },
  fill: { position: "absolute", left: -THUMB / 2, top: 0, bottom: 0, backgroundColor: t.accent },
  originalTick: { position: "absolute", top: 10, width: 2, height: 24, borderRadius: 1, backgroundColor: t.line2 },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line2,
    boxShadow: "0 2px 6px rgba(15,20,25,0.18)",
  },
});
