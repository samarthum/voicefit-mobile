import { expect, test } from 'bun:test';
import { insertAcknowledgedMeal, type PendingMealDashboard, type PendingMeal } from '../pending-meal-cache';
const meal: PendingMeal={id:'test-meal',description:'Test',calories:null,interpretationStatus:'interpreting',mealType:'snack',eatenAt:'2026-09-05T12:00:00Z'};
test('acknowledged pending meal appears without inventing calories or changing totals',()=>{
 const today={calories:{consumed:400,goal:2000}};
 const data={today,recentMeals:[]} as unknown as PendingMealDashboard;
 const next=insertAcknowledgedMeal(data,meal)!;
 expect(next.recentMeals).toEqual([meal]);
 expect(next.today).toBe(today);
 expect(next.recentMeals[0].calories).toBeNull();
 expect(data.recentMeals).toEqual([]);
});
test('acknowledgement cannot duplicate or regress an already interpreted row',()=>{
 const ready={...meal,calories:105,interpretationStatus:'needs_review'};
 const data={recentMeals:[ready]} as PendingMealDashboard;
 expect(insertAcknowledgedMeal(data,meal)).toBe(data);
 expect(insertAcknowledgedMeal(undefined,meal)).toBe(undefined);
});
