/**
 * MealActionsBar
 *
 * The delete + save/confirm action row at the bottom of the meal-edit screen.
 * Entirely presentational — all business logic and mutation state come from
 * the route file as props.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { color as t, font } from "@/lib/tokens";

export interface MealActionsBarProps {
  /** Label shown on the primary action button */
  primaryLabel: string;
  /** Whether the primary button should be shown as disabled */
  primaryDisabled: boolean;
  /** Whether a primary mutation is in-flight (shows spinner) */
  primaryPending: boolean;
  /** Whether the delete mutation is in-flight */
  deletePending: boolean;
  onPrimaryAction: () => void;
  onDelete: () => void;
}

export function MealActionsBar({
  primaryLabel,
  primaryDisabled,
  primaryPending,
  deletePending,
  onPrimaryAction,
  onDelete,
}: MealActionsBarProps) {
  return (
    <View style={styles.actions}>
      <Pressable
        style={styles.deleteButton}
        onPress={onDelete}
        disabled={deletePending}
        testID="meal-edit-delete"
      >
        <Text style={styles.deleteButtonText}>
          {deletePending ? "Deleting…" : "Delete meal"}
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.saveButton,
          primaryDisabled ? styles.saveButtonDisabled : null,
        ]}
        onPress={onPrimaryAction}
        disabled={primaryDisabled}
        testID="meal-edit-save"
      >
        {primaryPending ? (
          <ActivityIndicator color={t.accentInk} />
        ) : (
          <Text style={styles.saveButtonText}>{primaryLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  deleteButton: {
    width: 130,
    height: 52,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.negative,
  },
  saveButton: {
    flex: 1,
    height: 52,
    backgroundColor: t.accent,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    color: t.accentInk,
    letterSpacing: 0.28,
  },
});
