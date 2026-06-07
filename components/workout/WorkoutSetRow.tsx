/**
 * WorkoutSetRow — one SET | PREVIOUS | KG | REPS | checkmark row.
 *
 * Two modes driven by `row.live`:
 *  - No live set (preview / static): read-only display row, non-interactive.
 *  - Live set (real API data): editable TextInputs + tappable checkmark.
 *
 * ALL data fetching, mutations, and state live in the parent route file.
 * This component is purely presentational — it only fires callbacks.
 */

import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { color as token, font } from "@/lib/tokens";
import type { RenderRow, SetDraft } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkoutSetRowProps {
  row: RenderRow;
  /** Current draft value for this row (live rows only). */
  draft?: SetDraft;
  /** Whether the session is finished — disables editing. */
  sessionFinished: boolean;
  /** Called when the user edits the weight/duration/reps field. Live rows only. */
  onChangeDraft?: (setId: string, patch: Partial<SetDraft>) => void;
  /** Called when the user taps the checkmark to save. Live rows only. */
  onToggleComplete?: (row: RenderRow) => void;
  /** Called on long-press of the set-number chip to trigger delete. Live rows only. */
  onLongPressChip?: (row: RenderRow) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkoutSetRow({
  row,
  draft,
  sessionFinished,
  onChangeDraft,
  onToggleComplete,
  onLongPressChip,
}: WorkoutSetRowProps) {
  const isPreviewRow = !row.live;

  if (isPreviewRow) {
    // Static / preview row — no inputs or callbacks needed.
    return (
      <View style={[styles.setRow, row.checked ? styles.setRowChecked : null]}>
        <View style={[styles.setChip, row.isWarmup ? styles.warmupChip : null]}>
          <Text style={[styles.setChipText, row.isWarmup ? styles.warmupChipText : null]}>
            {row.setLabel}
          </Text>
        </View>
        <Text style={[styles.rowText, styles.colPrevious]}>{row.previous}</Text>
        {row.checked ? (
          <>
            <Text style={[styles.rowText, styles.colValue]}>{row.displayWeight ?? "—"}</Text>
            <Text style={[styles.rowText, styles.colValue]}>{row.displayReps ?? "—"}</Text>
          </>
        ) : (
          <>
            <View style={[styles.previewInputPill, styles.colValue]}>
              <Text style={styles.previewInputText}>{row.displayWeight ?? ""}</Text>
            </View>
            <View style={[styles.previewInputPill, styles.colValue]}>
              <Text style={styles.previewInputText}>{row.displayReps ?? ""}</Text>
            </View>
          </>
        )}
        <View style={[styles.checkCell, row.checked ? styles.checkCellFilled : null]}>
          {row.checked ? <Icon name="check" size={12} color={token.accentInk} /> : null}
        </View>
      </View>
    );
  }

  // Live row — editable.
  const liveSet = row.live!;
  const effectiveDraft: SetDraft = draft ?? {
    reps: liveSet.reps == null ? "" : String(liveSet.reps),
    weightKg: liveSet.weightKg == null ? "" : String(liveSet.weightKg),
    durationMinutes: liveSet.durationMinutes == null ? "" : String(liveSet.durationMinutes),
  };

  return (
    <View>
      <View style={[styles.setRow, row.checked ? styles.setRowChecked : null]}>
        <Pressable
          onLongPress={() => onLongPressChip?.(row)}
          delayLongPress={400}
          style={[styles.setChip, row.isWarmup ? styles.warmupChip : null]}
          hitSlop={6}
        >
          <Text style={[styles.setChipText, row.isWarmup ? styles.warmupChipText : null]}>
            {row.setLabel}
          </Text>
        </Pressable>
        <Text style={[styles.rowText, styles.colPrevious]}>{row.previous}</Text>
        <TextInput
          style={[styles.rowInput, styles.colValue]}
          value={effectiveDraft.weightKg}
          onChangeText={(value) =>
            onChangeDraft?.(liveSet.id, { weightKg: value.replace(/[^\d.]/g, "") })
          }
          keyboardType="decimal-pad"
          placeholder="-"
          placeholderTextColor={token.textMute}
          editable={!sessionFinished}
        />
        <TextInput
          style={[styles.rowInput, styles.colValue]}
          value={
            liveSet.exerciseType === "cardio"
              ? effectiveDraft.durationMinutes
              : effectiveDraft.reps
          }
          onChangeText={(value) =>
            onChangeDraft?.(
              liveSet.id,
              liveSet.exerciseType === "cardio"
                ? { durationMinutes: value.replace(/[^\d]/g, "") }
                : { reps: value.replace(/[^\d]/g, "") }
            )
          }
          keyboardType="number-pad"
          placeholder="-"
          placeholderTextColor={token.textMute}
          editable={!sessionFinished}
        />
        <Pressable
          style={[styles.checkCell, row.checked ? styles.checkCellFilled : null]}
          onPress={() => onToggleComplete?.(row)}
          disabled={sessionFinished}
          accessibilityRole="button"
          accessibilityLabel={row.checked ? "Set saved" : "Save set"}
        >
          {row.checked ? <Icon name="check" size={12} color={token.accentInk} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles (private to this file)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: token.surface,
    borderWidth: 1,
    borderColor: token.line,
    marginBottom: 6,
  },
  setRowChecked: {
    backgroundColor: token.accentTintBg,
    borderColor: token.accentTintBorder,
  },
  setChip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  warmupChip: {},
  setChipText: {
    fontFamily: font.mono[500],
    fontSize: 14,
    fontWeight: "500",
    color: token.text,
  },
  warmupChipText: { color: token.accent },
  rowText: {
    fontFamily: font.mono[400],
    fontSize: 12,
    fontWeight: "400",
    color: token.textMute,
  },
  rowInput: {
    minHeight: 30,
    borderRadius: 8,
    borderCurve: "continuous",
    backgroundColor: "transparent",
    fontFamily: font.mono[500],
    fontSize: 16,
    fontWeight: "500",
    color: token.text,
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  previewInputPill: {
    minHeight: 30,
    borderRadius: 8,
    borderCurve: "continuous",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  previewInputText: {
    fontFamily: font.mono[500],
    fontSize: 16,
    fontWeight: "500",
    color: token.text,
  },
  checkCell: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: token.line2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  checkCellFilled: {
    backgroundColor: token.accent,
    borderColor: token.accent,
  },
  // Column-width helpers reused by ExerciseCard's table header row too
  colSet: { width: 32 },
  colPrevious: { flex: 1.1 },
  colValue: { flex: 0.75, textAlign: "center" },
  colCheck: { width: 38, alignItems: "flex-end" },
});
