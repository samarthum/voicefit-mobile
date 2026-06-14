import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCommandCenterOverlay } from "@/components/command-center/CommandCenterProvider";
import { confidenceLabel } from "@/components/command-center/helpers";
import { color as t, font } from "@/lib/tokens";

export function WorkoutReviewState() {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const insets = useSafeAreaInsets();
  const reviewDraft = snapshot.review?.kind === "workout" ? snapshot.review : null;
  if (!reviewDraft) return null;

  const workout = reviewDraft.interpreted.payload;
  const confidence = confidenceLabel(reviewDraft.confidence);
  const segmentCount = Math.max(0, Math.min(4, Math.round(reviewDraft.confidence * 4)));
  const eyebrow = reviewDraft.exerciseTypeLabel.toUpperCase();
  const sessionLabel = snapshot.screenContext.sessionId ? "Current session" : reviewDraft.sessionLabel;

  return (
    <BottomSheetScrollView
      contentContainerStyle={[styles.mealReviewContent, { paddingBottom: insets.bottom + 96 }]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
      <View style={styles.mealReviewYouSaidRow}>
        <Text style={styles.mealReviewYouSaidLabel}>YOU SAID</Text>
        <Pressable onPress={() => dispatch({ type: "review.transcript.edit" })} testID="cc-review-edit-transcript">
          <Text style={styles.mealReviewEditLink}>EDIT</Text>
        </Pressable>
      </View>
      <Text style={styles.mealReviewTranscript} selectable>{`"${reviewDraft.transcript}"`}</Text>

      <View style={styles.mealReviewBigCard}>
        <View style={styles.mealReviewHeroRow}>
          <View style={styles.mealReviewHeroLeft}>
            <Text style={styles.mealReviewEyebrow}>{eyebrow}</Text>
            <Text style={styles.mealReviewName} selectable>{workout.exerciseName}</Text>
          </View>
        </View>

        <View style={styles.mealReviewDivider} />

        <View style={styles.mealReviewIngredientsHeader}>
          <Text style={styles.mealReviewIngredientsTitle}>SETS</Text>
        </View>

        <View style={styles.workoutSetTableHeader}>
          <Text style={[styles.workoutSetColLabel, styles.workoutSetColSet]}>SET</Text>
          <Text style={[styles.workoutSetColLabel, styles.workoutSetColKg]}>KG</Text>
          <Text style={[styles.workoutSetColLabel, styles.workoutSetColReps]}>REPS</Text>
          <Text style={[styles.workoutSetColLabel, styles.workoutSetColNotes]}>NOTES</Text>
        </View>

        {reviewDraft.sets.map((set, index) => (
          <View
            key={set.id}
            style={[
              styles.workoutSetTableRow,
              index === 0 ? null : styles.workoutSetTableRowDivider,
            ]}
          >
            <Text style={[styles.workoutSetCellNumber, styles.workoutSetColSet]}>
              {set.setNumber}
            </Text>
            <BottomSheetTextInput
              style={[styles.workoutSetCellInput, styles.workoutSetColKg]}
              value={set.weightKg}
              onChangeText={(v) =>
                dispatch({ type: "workout-set.update", index, patch: { weightKg: v.replace(/[^0-9.]/g, "") } })
              }
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={t.textMute}
              testID={`cc-review-workout-kg-${index}`}
            />
            <BottomSheetTextInput
              style={[styles.workoutSetCellInput, styles.workoutSetColReps]}
              value={set.reps}
              onChangeText={(v) =>
                dispatch({ type: "workout-set.update", index, patch: { reps: v.replace(/[^0-9]/g, "") } })
              }
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={t.textMute}
              testID={`cc-review-workout-reps-${index}`}
            />
            <BottomSheetTextInput
              style={[styles.workoutSetCellNotesInput, styles.workoutSetColNotes]}
              value={set.notes}
              onChangeText={(v) => dispatch({ type: "workout-set.update", index, patch: { notes: v } })}
              placeholder="—"
              placeholderTextColor={t.textMute}
              testID={`cc-review-workout-notes-${index}`}
            />
          </View>
        ))}

        <Pressable
          style={styles.workoutAddSetButton}
          onPress={() => dispatch({ type: "workout-set.add" })}
          testID="cc-review-add-set"
        >
          <Text style={styles.workoutAddSetButtonText}>+ ADD SET</Text>
        </Pressable>
      </View>

      <View style={styles.mealReviewConfidenceRow}>
        <View style={styles.mealReviewConfidenceBar}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.mealReviewConfidenceSegment,
                { backgroundColor: i < segmentCount ? t.accent : t.line },
              ]}
            />
          ))}
        </View>
        <Text style={styles.mealReviewConfidenceText}>{confidence.text}</Text>
      </View>

      <View style={styles.workoutSessionRowNew}>
        <Text style={styles.workoutSessionLabelNew}>Add to session</Text>
        <Text style={styles.workoutSessionValueNew}>{sessionLabel}</Text>
      </View>

    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  mealReviewContent: { paddingHorizontal: 22, paddingBottom: 8 },
  mealReviewYouSaidRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  mealReviewYouSaidLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewEditLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewTranscript: {
    fontFamily: font.sans[400],
    fontSize: 13.5,
    lineHeight: 19,
    color: t.textSoft,
    marginBottom: 16,
  },
  mealReviewBigCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 20,
    borderCurve: "continuous",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  mealReviewHeroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  mealReviewHeroLeft: { flex: 1 },
  mealReviewEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewName: {
    fontFamily: font.sans[600],
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.44,
    color: t.text,
    marginTop: 6,
    lineHeight: 25,
  },
  mealReviewDivider: {
    height: 1,
    backgroundColor: t.line,
    marginTop: 18,
    marginBottom: 12,
  },
  mealReviewIngredientsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  mealReviewIngredientsTitle: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.textMute,
  },
  workoutSetTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  workoutSetTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  workoutSetTableRowDivider: {
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  workoutSetColLabel: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: t.textMute,
  },
  workoutSetColSet: { width: 36, textAlign: "left" },
  workoutSetColKg: { width: 64, textAlign: "center" },
  workoutSetColReps: { width: 56, textAlign: "center" },
  workoutSetColNotes: { flex: 1, textAlign: "left", paddingLeft: 8 },
  workoutSetCellNumber: {
    fontFamily: font.mono[500],
    fontSize: 14,
    color: t.text,
  },
  workoutSetCellInput: {
    fontFamily: font.mono[500],
    fontSize: 15,
    color: t.text,
    height: 32,
    paddingVertical: 0,
  },
  workoutSetCellNotesInput: {
    fontFamily: font.sans[400],
    fontSize: 13,
    color: t.text,
    height: 32,
    paddingVertical: 0,
    paddingLeft: 8,
  },
  workoutAddSetButton: {
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  workoutAddSetButtonText: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewConfidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  mealReviewConfidenceBar: {
    flexDirection: "row",
    gap: 3,
  },
  mealReviewConfidenceSegment: {
    width: 14,
    height: 3,
    borderRadius: 2,
    borderCurve: "continuous",
  },
  mealReviewConfidenceText: {
    fontFamily: font.sans[400],
    fontSize: 11,
    color: t.textSoft,
    flexShrink: 1,
  },
  workoutSessionRowNew: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: t.line,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  workoutSessionLabelNew: {
    fontFamily: font.sans[400],
    fontSize: 13.5,
    color: t.textSoft,
  },
  workoutSessionValueNew: {
    fontFamily: font.sans[600],
    fontSize: 13.5,
    fontWeight: "600",
    color: t.text,
  },
});
