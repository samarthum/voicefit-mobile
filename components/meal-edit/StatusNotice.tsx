import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import type { AsyncMealStatus } from "@/lib/meal-status";
import { color as t, font, radius as r } from "@/lib/tokens";

interface Props {
  status: AsyncMealStatus;
  message?: string | null;
}

export function StatusNotice({ status, message }: Props) {
  if (status === "reviewed") return null;

  const title =
    status === "interpreting"
      ? "Estimating nutrition…"
      : status === "needs_review"
      ? "AI estimate"
      : "Couldn't estimate this meal";

  const body =
    status === "interpreting"
      ? "This usually takes a few seconds. Nutrition appears here when it's ready."
      : status === "needs_review"
      ? "Tap an ingredient to fix anything that looks off."
      : message || "Delete it and log it again, or add the ingredients yourself.";

  return (
    <View
      style={[
        styles.statusNotice,
        status === "failed" ? styles.statusNoticeFailed : null,
      ]}
    >
      <View style={styles.statusNoticeTitleRow}>
        {status === "interpreting" ? (
          <ActivityIndicator size="small" color={t.textMute} />
        ) : status === "needs_review" ? (
          <Icon name="sparkle" size={14} color={t.accent} />
        ) : null}
        <Text
          style={[
            styles.statusNoticeTitle,
            status === "failed" ? styles.statusNoticeTitleFailed : null,
          ]}
        >
          {title}
        </Text>
      </View>
      <Text style={styles.statusNoticeBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusNotice: {
    borderRadius: r.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: t.surface,
    padding: 14,
    gap: 6,
  },
  statusNoticeFailed: {
    borderColor: t.negative,
  },
  statusNoticeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusNoticeTitle: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.text,
  },
  statusNoticeTitleFailed: {
    color: t.negative,
  },
  statusNoticeBody: {
    fontFamily: font.sans[400],
    fontSize: 12.5,
    lineHeight: 18,
    color: t.textSoft,
  },
});
