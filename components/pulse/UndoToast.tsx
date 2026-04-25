import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text } from "react-native";
import { color, font, radius } from "../../lib/tokens";
import { ease } from "../../lib/motion";

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
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  // mounted-state lets the exit animation play before unmount when visible flips false.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 320,
          easing: ease.std,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 320,
          easing: ease.std,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => onDismiss(), durationMs);
      return () => clearTimeout(timer);
    }

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 220,
        easing: ease.exit,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 24,
        duration: 220,
        easing: ease.exit,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, durationMs, onDismiss, fade, slide]);

  if (!mounted) return null;

  return (
    <Animated.View
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
        opacity: fade,
        transform: [{ translateY: slide }],
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
