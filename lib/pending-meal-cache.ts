import type { DashboardData } from '@voicefit/contracts/types';
export type PendingMeal = Omit<DashboardData['recentMeals'][number], 'calories'> & {
  calories: number | null;
  interpretationStatus: string;
};
export type PendingMealDashboard = Omit<DashboardData, 'recentMeals'> & { recentMeals: PendingMeal[] };
// Insert only server-acknowledged rows. Nutrition stays unchanged until the
// authoritative dashboard response arrives; unknown calories never become zero.
export function insertAcknowledgedMeal(data: PendingMealDashboard | undefined, meal: PendingMeal) {
  if (!data) return data;
  if (data.recentMeals.some(row => row.id === meal.id)) return data;
  return { ...data, recentMeals: [meal, ...data.recentMeals].sort((a,b)=>Date.parse(b.eatenAt)-Date.parse(a.eatenAt)) };
}
