export type ExerciseCatalogItem = {
  name: string;
  equipment: "Barbell" | "Dumbbell" | "Machine" | "Bodyweight" | "Cable";
  group: "Chest" | "Back" | "Shoulders" | "Legs" | "Arms" | "Core" | "Compound";
  accent: string;
  recentDaysAgo?: number;
};

export const EXERCISE_CATALOG: ExerciseCatalogItem[] = [
  { name: "Bench Press", equipment: "Barbell", group: "Chest", accent: "#FF6B6B", recentDaysAgo: 2 },
  { name: "Squat", equipment: "Barbell", group: "Legs", accent: "#34C759", recentDaysAgo: 2 },
  { name: "Overhead Press", equipment: "Barbell", group: "Shoulders", accent: "#AF52DE", recentDaysAgo: 4 },
  { name: "Incline Bench Press", equipment: "Barbell", group: "Chest", accent: "#FF6B6B" },
  { name: "Decline Bench Press", equipment: "Barbell", group: "Chest", accent: "#FF6B6B" },
  { name: "Dumbbell Bench Press", equipment: "Dumbbell", group: "Chest", accent: "#FF6B6B" },
  { name: "Romanian Deadlift", equipment: "Barbell", group: "Legs", accent: "#34C759" },
  { name: "Lat Pulldown", equipment: "Machine", group: "Back", accent: "#007AFF" },
  { name: "Tricep Pushdown", equipment: "Cable", group: "Arms", accent: "#FF9500" },
];

export function getExerciseCatalogItem(name: string) {
  const normalized = name.trim().toLowerCase();
  return EXERCISE_CATALOG.find((item) => item.name.toLowerCase() === normalized) ?? null;
}
