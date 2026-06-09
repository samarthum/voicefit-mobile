/**
 * WorkoutExerciseCard — the per-exercise block: header, note row, table
 * header, set rows, and "Add Set" footer.
 *
 * ALL data fetching, mutations, and state live in the parent route file.
 * This component is purely presentational; it fires callbacks for every
 * user action (menu, note, add-set, row edits).
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { color as token, font } from "@/lib/tokens";
import { WorkoutSetRow } from "./WorkoutSetRow";
import type { ExerciseCardData, RenderRow, SetDraft } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkoutExerciseCardProps {
  card: ExerciseCardData;
  /** Whether the session is finished — disables all editing. */
  sessionFinished: boolean;
  /** Whether this is a preview/demo session — hides interactive controls. */
  isPreview: boolean;
  /** Per-set draft values keyed by set id. */
  drafts: Record<string, SetDraft>;
  /** Existing note text for this exercise (empty string if none). */
  noteText: string;

  // Callbacks
  onExerciseMenu: (exerciseName: string) => void;
  onOpenNoteEditor: (exerciseName: string) => void;
  onChangeDraft: (setId: string, patch: Partial<SetDraft>) => void;
  onToggleComplete: (row: RenderRow) => void;
  onLongPressChip: (row: RenderRow) => void;
  onAddSet: (card: ExerciseCardData) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkoutExerciseCard({
  card,
  sessionFinished,
  isPreview,
  drafts,
  noteText,
  onExerciseMenu,
  onOpenNoteEditor,
  onChangeDraft,
  onToggleComplete,
  onLongPressChip,
  onAddSet,
}: WorkoutExerciseCardProps) {
  const hasNote = noteText.trim().length > 0;

  return (
    <View style={styles.exerciseCard}>
      {/* ── Exercise header ── */}
      <View style={styles.exerciseHeader}>
        <View>
          <Text style={styles.exerciseTitle}>{card.name}</Text>
          <View style={styles.exerciseMetaRow}>
            <View style={styles.exerciseMetaDot} />
            <Text style={styles.exerciseMeta}>{card.meta}</Text>
          </View>
        </View>
        {!isPreview ? (
          <Pressable
            onPress={() => onExerciseMenu(card.name)}
            hitSlop={10}
            style={styles.exerciseDotsButton}
            testID={`exercise-menu-${card.name}`}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${card.name}`}
          >
            <Icon name="ellipsisVertical" size={16} color={token.textMute} />
          </Pressable>
        ) : null}
      </View>

      {/* ── Exercise note ── */}
      {!isPreview ? (
        hasNote ? (
          <Pressable
            onPress={() => onOpenNoteEditor(card.name)}
            style={styles.exerciseNoteRow}
            disabled={sessionFinished}
          >
            <Text style={styles.exerciseNoteText}>{noteText}</Text>
          </Pressable>
        ) : !sessionFinished ? (
          <Pressable
            onPress={() => onOpenNoteEditor(card.name)}
            style={styles.exerciseNoteRow}
          >
            <Text style={styles.exerciseNoteAdd}>＋ Add note</Text>
          </Pressable>
        ) : null
      ) : null}

      {/* ── Table column headers ── */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderLabel, styles.colSet]}>Set</Text>
        <Text style={[styles.tableHeaderLabel, styles.colPrevious]}>Previous</Text>
        {card.exerciseType === "cardio" ? (
          <>
            <Text style={[styles.tableHeaderLabel, styles.colValue]}>Min</Text>
            <Text style={[styles.tableHeaderLabel, styles.colValue]}>—</Text>
          </>
        ) : (
          <>
            <Text style={[styles.tableHeaderLabel, styles.colValue]}>KG</Text>
            <Text style={[styles.tableHeaderLabel, styles.colValue]}>Reps</Text>
          </>
        )}
        <View style={styles.colCheck} />
      </View>

      {/* ── Set rows ── */}
      {card.rows.map((row) => (
        <WorkoutSetRow
          key={row.id}
          row={row}
          draft={drafts[row.live?.id ?? ""]}
          sessionFinished={sessionFinished}
          onChangeDraft={onChangeDraft}
          onToggleComplete={onToggleComplete}
          onLongPressChip={onLongPressChip}
        />
      ))}

      {/* ── Add set footer ── */}
      {!sessionFinished && (
        <Pressable
          style={styles.addSetRow}
          onPress={() => onAddSet(card)}
          hitSlop={8}
        >
          <Text style={styles.addSetText}>＋ Add Set</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  exerciseCard: {
    backgroundColor: "transparent",
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
  },
  exerciseDotsButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseTitle: {
    fontFamily: font.sans[600],
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.27,
    color: token.text,
  },
  exerciseMetaRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  exerciseMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 9999,
    backgroundColor: token.textMute,
  },
  exerciseMeta: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.47,
    textTransform: "uppercase",
    color: token.textMute,
  },
  exerciseNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  exerciseNoteText: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 12.5,
    color: token.text,
    lineHeight: 19,
    letterSpacing: -0.06,
  },
  exerciseNoteAdd: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 12.5,
    color: token.textMute,
    lineHeight: 19,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
  },
  tableHeaderLabel: {
    fontFamily: font.sans[600],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 1.52,
    textTransform: "uppercase",
    color: token.textMute,
  },
  // Column-width helpers (must match WorkoutSetRow's col* styles exactly)
  colSet: { width: 32 },
  colPrevious: { flex: 1.1 },
  colValue: { flex: 0.75, textAlign: "center" },
  colCheck: { width: 38, alignItems: "flex-end" },
  addSetRow: {
    paddingTop: 10,
    paddingHorizontal: 14,
  },
  addSetText: {
    fontFamily: font.sans[600],
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.48,
    color: token.accent,
  },
});
