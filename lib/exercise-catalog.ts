export type ExerciseCatalogItem = {
  name: string;
  equipment: "Barbell" | "Dumbbell" | "Machine" | "Bodyweight" | "Cable" | "Kettlebell";
  group: "Chest" | "Back" | "Shoulders" | "Legs" | "Arms" | "Core" | "Cardio";
  accent: string;
  recentDaysAgo?: number;
};

const ACCENT = {
  chest: "#FF6B6B",
  back: "#007AFF",
  shoulders: "#AF52DE",
  legs: "#34C759",
  arms: "#FF9500",
  core: "#FF2D55",
  cardio: "#5AC8FA",
};

export const EXERCISE_CATALOG: ExerciseCatalogItem[] = [
  // ── Chest ──
  { name: "Bench Press", equipment: "Barbell", group: "Chest", accent: ACCENT.chest },
  { name: "Incline Bench Press", equipment: "Barbell", group: "Chest", accent: ACCENT.chest },
  { name: "Decline Bench Press", equipment: "Barbell", group: "Chest", accent: ACCENT.chest },
  { name: "Dumbbell Bench Press", equipment: "Dumbbell", group: "Chest", accent: ACCENT.chest },
  { name: "Incline Dumbbell Press", equipment: "Dumbbell", group: "Chest", accent: ACCENT.chest },
  { name: "Dumbbell Fly", equipment: "Dumbbell", group: "Chest", accent: ACCENT.chest },
  { name: "Cable Fly", equipment: "Cable", group: "Chest", accent: ACCENT.chest },
  { name: "Push-Up", equipment: "Bodyweight", group: "Chest", accent: ACCENT.chest },
  { name: "Chest Dip", equipment: "Bodyweight", group: "Chest", accent: ACCENT.chest },
  { name: "Floor Press", equipment: "Barbell", group: "Chest", accent: ACCENT.chest },

  // ── Back ──
  { name: "Deadlift", equipment: "Barbell", group: "Back", accent: ACCENT.back },
  { name: "Barbell Row", equipment: "Barbell", group: "Back", accent: ACCENT.back },
  { name: "Dumbbell Row", equipment: "Dumbbell", group: "Back", accent: ACCENT.back },
  { name: "Pull-Up", equipment: "Bodyweight", group: "Back", accent: ACCENT.back },
  { name: "Chin-Up", equipment: "Bodyweight", group: "Back", accent: ACCENT.back },
  { name: "Lat Pulldown", equipment: "Machine", group: "Back", accent: ACCENT.back },
  { name: "Seated Cable Row", equipment: "Cable", group: "Back", accent: ACCENT.back },
  { name: "T-Bar Row", equipment: "Barbell", group: "Back", accent: ACCENT.back },
  { name: "Face Pull", equipment: "Cable", group: "Back", accent: ACCENT.back },

  // ── Shoulders ──
  { name: "Overhead Press", equipment: "Barbell", group: "Shoulders", accent: ACCENT.shoulders },
  { name: "Dumbbell Shoulder Press", equipment: "Dumbbell", group: "Shoulders", accent: ACCENT.shoulders },
  { name: "Arnold Press", equipment: "Dumbbell", group: "Shoulders", accent: ACCENT.shoulders },
  { name: "Lateral Raise", equipment: "Dumbbell", group: "Shoulders", accent: ACCENT.shoulders },
  { name: "Front Raise", equipment: "Dumbbell", group: "Shoulders", accent: ACCENT.shoulders },
  { name: "Rear Delt Fly", equipment: "Dumbbell", group: "Shoulders", accent: ACCENT.shoulders },
  { name: "Upright Row", equipment: "Barbell", group: "Shoulders", accent: ACCENT.shoulders },
  { name: "Shrug", equipment: "Barbell", group: "Shoulders", accent: ACCENT.shoulders },

  // ── Legs ──
  { name: "Squat", equipment: "Barbell", group: "Legs", accent: ACCENT.legs },
  { name: "Front Squat", equipment: "Barbell", group: "Legs", accent: ACCENT.legs },
  { name: "Leg Press", equipment: "Machine", group: "Legs", accent: ACCENT.legs },
  { name: "Lunge", equipment: "Dumbbell", group: "Legs", accent: ACCENT.legs },
  { name: "Bulgarian Split Squat", equipment: "Dumbbell", group: "Legs", accent: ACCENT.legs },
  { name: "Romanian Deadlift", equipment: "Barbell", group: "Legs", accent: ACCENT.legs },
  { name: "Leg Curl", equipment: "Machine", group: "Legs", accent: ACCENT.legs },
  { name: "Leg Extension", equipment: "Machine", group: "Legs", accent: ACCENT.legs },
  { name: "Calf Raise", equipment: "Machine", group: "Legs", accent: ACCENT.legs },
  { name: "Hip Thrust", equipment: "Barbell", group: "Legs", accent: ACCENT.legs },
  { name: "Goblet Squat", equipment: "Dumbbell", group: "Legs", accent: ACCENT.legs },

  // ── Arms ──
  { name: "Bicep Curl", equipment: "Dumbbell", group: "Arms", accent: ACCENT.arms },
  { name: "Hammer Curl", equipment: "Dumbbell", group: "Arms", accent: ACCENT.arms },
  { name: "Preacher Curl", equipment: "Barbell", group: "Arms", accent: ACCENT.arms },
  { name: "Tricep Pushdown", equipment: "Cable", group: "Arms", accent: ACCENT.arms },
  { name: "Tricep Extension", equipment: "Cable", group: "Arms", accent: ACCENT.arms },
  { name: "Skull Crusher", equipment: "Barbell", group: "Arms", accent: ACCENT.arms },
  { name: "Close-Grip Bench Press", equipment: "Barbell", group: "Arms", accent: ACCENT.arms },
  { name: "Dip", equipment: "Bodyweight", group: "Arms", accent: ACCENT.arms },

  // ── Core ──
  { name: "Plank", equipment: "Bodyweight", group: "Core", accent: ACCENT.core },
  { name: "Crunch", equipment: "Bodyweight", group: "Core", accent: ACCENT.core },
  { name: "Leg Raise", equipment: "Bodyweight", group: "Core", accent: ACCENT.core },
  { name: "Russian Twist", equipment: "Bodyweight", group: "Core", accent: ACCENT.core },
  { name: "Ab Wheel Rollout", equipment: "Bodyweight", group: "Core", accent: ACCENT.core },
  { name: "Cable Crunch", equipment: "Cable", group: "Core", accent: ACCENT.core },

  // ── Cardio / Olympic ──
  { name: "Kettlebell Swing", equipment: "Kettlebell", group: "Cardio", accent: ACCENT.cardio },
  { name: "Clean", equipment: "Barbell", group: "Cardio", accent: ACCENT.cardio },
  { name: "Snatch", equipment: "Barbell", group: "Cardio", accent: ACCENT.cardio },
  { name: "Thruster", equipment: "Barbell", group: "Cardio", accent: ACCENT.cardio },
  { name: "Burpee", equipment: "Bodyweight", group: "Cardio", accent: ACCENT.cardio },
];

export function getExerciseCatalogItem(name: string) {
  const normalized = name.trim().toLowerCase();
  return EXERCISE_CATALOG.find((item) => item.name.toLowerCase() === normalized) ?? null;
}
