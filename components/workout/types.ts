/**
 * Shared domain types for workout-session components.
 * All data-fetching and mutations stay in the route file;
 * these types flow DOWN as props.
 */

export type ExerciseType = "resistance" | "cardio";

export interface WorkoutSet {
  id: string;
  sessionId: string;
  performedAt: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  reps: number | null;
  weightKg: number | null;
  durationMinutes: number | null;
  notes: string | null;
  transcriptRaw: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SetDraft = {
  reps: string;
  weightKg: string;
  durationMinutes: string;
};

export type RenderRow = {
  id: string;
  setLabel: string;
  previous: string;
  isWarmup: boolean;
  checked: boolean;
  live?: WorkoutSet;
  displayWeight?: string;
  displayReps?: string;
};

export type ExerciseCardData = {
  name: string;
  meta: string;
  exerciseType: ExerciseType;
  rows: RenderRow[];
};
