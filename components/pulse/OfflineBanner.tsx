import { Text, View } from "react-native";
import { color, font } from "../../lib/tokens";

type OfflineBannerProps = {
  queuedCount?: number;
  message?: string;
};

// rgba derived from color.warn (#FFB347) at 0.08 / 0.30 alpha — kept as inline literals
// because tokens.ts doesn't expose pre-baked alpha variants for warn.
const WARN_BG = "rgba(255,179,71,0.08)";
const WARN_BORDER = "rgba(255,179,71,0.3)";

export function OfflineBanner({
  queuedCount = 0,
  message = "Offline · logging to queue",
}: OfflineBannerProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: WARN_BG,
        borderColor: WARN_BORDER,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: color.warn,
        }}
      />
      <Text
        style={{
          flex: 1,
          fontFamily: font.sans[500],
          fontSize: 12.5,
          fontWeight: "500",
          color: color.text,
        }}
      >
        {message}
      </Text>
      {queuedCount > 0 ? (
        <Text
          style={{
            fontFamily: font.mono[600],
            fontSize: 10.5,
            fontWeight: "700",
            letterSpacing: 1.05,
            color: color.warn,
          }}
        >
          {queuedCount} QUEUED
        </Text>
      ) : null}
    </View>
  );
}

export default OfflineBanner;
