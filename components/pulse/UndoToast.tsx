import { useEffect, useRef } from "react";
import { Pressable, Text } from "react-native";
import Animated, { FadeInUp, FadeOut, LinearTransition } from "react-native-reanimated";
import { color, font, radius } from "@/lib/tokens";

// onUndo fires when the user taps Undo — caller should reverse the action.
// onDismiss fires *only* when the timer expires — caller should commit the
// pending action. They are mutually exclusive: a single toast fires exactly one
// of them, never both.
type UndoToastProps = {
  visible: boolean;
  message: string;
  durationMs?: number;
  onUndo: () => void;
  onDismiss: () => void;
};

export function UndoToast({
  visible,
  message,
  durationMs = 6000,
  onUndo,
  onDismiss,
}: UndoToastProps) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOut.duration(180)}
      layout={LinearTransition}
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: 24,
        left: 16,
        right: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: color.surface2,
        borderColor: color.line2,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingVertical: 12,
        paddingHorizontal: 18,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontFamily: font.sans[500],
          fontSize: 14,
          fontWeight: "500",
          color: color.text,
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={onUndo}
        hitSlop={8}
        style={{ marginLeft: 8 }}
      >
        <Text
          style={{
            fontFamily: font.sans[700],
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 1.008,
            textTransform: "uppercase",
            color: color.accent,
          }}
        >
          Undo
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default UndoToast;
