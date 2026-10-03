import type { SetDraft, WorkoutSet } from "@/components/workout/types";

export function workoutSetDraft(set: WorkoutSet): SetDraft {
  return {
    reps: set.reps == null ? "" : String(set.reps),
    weightKg: set.weightKg == null ? "" : String(set.weightKg),
    durationMinutes: set.durationMinutes == null ? "" : String(set.durationMinutes),
  };
}

export function isWorkoutDraftChanged(set: WorkoutSet, draft?: SetDraft): boolean {
  if (!draft) return false;
  return (Object.keys(workoutSetDraft(set)) as Array<keyof SetDraft>).some((field) => {
    const raw = draft[field].trim();
    const value = raw === "" ? null : Number(raw);
    return !Number.isFinite(value ?? 0) || value !== set[field];
  });
}

export function workoutDraftUpdate(set: WorkoutSet, draft: SetDraft) {
  const parse = (raw: string, integer: boolean) => {
    if (raw.trim() === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
      throw new Error("Reps and duration must be non-negative whole numbers; weight must be a non-negative number.");
    }
    return value;
  };
  return {
    setId: set.id, exerciseName: set.exerciseName, exerciseType: set.exerciseType,
    reps: parse(draft.reps, true), weightKg: parse(draft.weightKg, false),
    durationMinutes: parse(draft.durationMinutes, true), notes: set.notes,
  };
}

export function changedWorkoutSets(sets: WorkoutSet[], drafts: Record<string, SetDraft>) {
  return sets.filter((set) => isWorkoutDraftChanged(set, drafts[set.id]));
}
