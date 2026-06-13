import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFetching } from "@tanstack/react-query";
import { color as token } from "@/lib/tokens";

const BAR_HEIGHT = 2.5;
// The moving highlight spans this fraction of the bar width as it sweeps.
const SEGMENT_RATIO = 0.4;
const SWEEP_DURATION = 1100;

/**
 * A thin indeterminate progress bar pinned just below the status bar. It lights
 * up whenever ANY React Query is fetching — including the silent background
 * refresh that runs after the persisted cache is rehydrated on a cold start —
 * so the user gets a quiet "updating…" signal instead of numbers changing under
 * them with no explanation. Hidden entirely when nothing is in flight.
 */
export function TopLoadingBar() {
  const insets = useSafeAreaInsets();
  const isFetching = useIsFetching() > 0;
  const [width, setWidth] = useState(0);

  // 0..1 sweep position, looped while visible.
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isFetching) {
      opacity.value = withTiming(1, { duration: 150 });
      // Reset before looping so each show starts a full-width sweep (withRepeat
      // captures the start value, so a stale frozen position would shorten it).
      progress.value = 0;
      progress.value = withRepeat(
        withTiming(1, { duration: SWEEP_DURATION, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      );
    } else {
      // Fade out, then stop the loop so it isn't running invisibly.
      opacity.value = withDelay(150, withTiming(0, { duration: 250 }));
      cancelAnimation(progress);
    }
  }, [isFetching, opacity, progress]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const segmentStyle = useAnimatedStyle(() => {
    const segmentWidth = width * SEGMENT_RATIO;
    return {
      width: segmentWidth,
      transform: [{ translateX: interpolate(progress.value, [0, 1], [-segmentWidth, width]) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.container, { top: insets.top }, containerStyle]}
    >
      <Animated.View style={[styles.segment, segmentStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    overflow: "hidden",
    zIndex: 1000,
    elevation: 1000,
  },
  segment: {
    height: BAR_HEIGHT,
    backgroundColor: token.accent,
    borderRadius: BAR_HEIGHT,
  },
});
