import { expect, test } from 'bun:test';
import { parseWorkoutSetsFromTranscript, buildWorkoutReviewDraft } from '../../components/command-center/helpers';
import type { InterpretEntryResponse } from '@voicefit/contracts/types';
const interpreted: Extract<InterpretEntryResponse, { intent: 'workout_set' }> = {
  intent: 'workout_set', payload: { exerciseName: 'Bench Press', exerciseType: 'resistance', weightKg: 61.23496995, reps: 8, durationMinutes: null, notes: null, confidence: 0.96, assumptions: [] },
};
test('single-identity review refuses to assign squats and bench sets to one lift', () => {
  expect(() => buildWorkoutReviewDraft(interpreted, 'bench press 8 reps at 80 kg, then squats 6 reps at 100 kg', 'text')).toThrow('one exercise');
});
test('a recognized lift plus an ambiguous or unknown second exercise cannot collapse into one', () => {
  expect(() => buildWorkoutReviewDraft(interpreted, 'bench press 8 reps at 80 kg then curls 3x8', 'text')).toThrow('one exercise');
  expect(() => buildWorkoutReviewDraft(interpreted, 'bench press 8 reps at 80 kg then donkey kicks 3x12', 'text')).toThrow('one exercise');
});
test('comma-separated unknown exercise cannot contribute sets to Bench Press', () => {
  expect(() => buildWorkoutReviewDraft(interpreted, 'bench press 3x8 at 80 kg, donkey kicks 3x12', 'text')).toThrow('one exercise');
});
test('two non-catalog exercise clauses cannot collapse into Donkey Kick sets', () => {
  const donkey = { ...interpreted, payload: { ...interpreted.payload, exerciseName: 'Donkey Kick', weightKg: null } };
  expect(() => buildWorkoutReviewDraft(donkey, 'donkey kicks 3x12 then fire hydrants 3x15', 'text')).toThrow('one exercise');
});
for (const separator of [',', '; ', '\n', '\r\n', ' and ', ' then ', ', then ']) {
  for (const first of [
    { name: 'Bench Press', text: 'bench press 3x8 at 80 kg' },
    { name: 'Donkey Kick', text: 'donkey kicks 3x12' },
  ]) {
    test(`additional named sets fail closed after ${JSON.stringify(separator)} with ${first.name}`, () => {
      const response = { ...interpreted, payload: { ...interpreted.payload, exerciseName: first.name } };
      expect(() => buildWorkoutReviewDraft(response, `${first.text}${separator}fire hydrants 3x15`, 'text')).toThrow('one exercise');
    });
  }
}
for (const text of [
  'bench press 3x8 at 80 kg, then 2x6 at 70 kg',
  'bench press 3 sets of 8 at 80 kg and 2 sets of 6 at 70 kg',
  'bench press 3x8 at 80 kg; 2x6 at 70 kg',
  'bench press 3x8 at 80 kg\n2x6 at 70 kg',
  'bench press 3x8 at 80 kg then backoff 2x6 at 70 kg',
  'bench press 3x8 at 80 kg and another 2 sets of 6 at 70 kg',
  'bench press 3x8 at 80 kg then warmup 2x6 at 70 kg',
  'bench press 3x8 at 80 kg and bench press 2x6 at 70 kg',
]) {
  test(`numeric same-exercise clauses preserve all sets: ${JSON.stringify(text)}`, () => {
    expect(buildWorkoutReviewDraft(interpreted, text, 'text').sets.map((set) => set.reps)).toEqual(['8', '8', '8', '6', '6']);
  });
}
test('a second unknown named set-count clause is rejected even when its count precedes its name', () => {
  expect(() => buildWorkoutReviewDraft(interpreted, 'bench press 3x8 at 80 kg, 3 sets of donkey kicks, 12 reps', 'text')).toThrow('one exercise');
});
test('an unknown first exercise cannot collapse into a cataloged second exercise', () => {
  expect(() => buildWorkoutReviewDraft(interpreted, 'donkey kicks 3x12 and bench press 3x8 at 80 kg', 'text')).toThrow('one exercise');
});
test('single qualified or non-catalog names remain reviewable', () => {
  for (const [name, text] of [
    ['Donkey Kick', 'donkey kicks, 3x12'],
    ['Dumbbell Romanian Deadlift', 'dumbbell romanian deadlift, 3 sets of 8 at 20 kg'],
    ['Incline Bench Press', 'incline bench press 3x8 at 80 kg'],
  ]) {
    const response = { ...interpreted, payload: { ...interpreted.payload, exerciseName: name } };
    expect(buildWorkoutReviewDraft(response, text, 'text').sets).toHaveLength(3);
  }
});
test('explicit non-catalog variants preserve their full server identity', () => {
  const variant = { ...interpreted, payload: { ...interpreted.payload, exerciseName: 'Dumbbell Romanian Deadlift' } };
  const draft = buildWorkoutReviewDraft(variant, 'dumbbell romanian deadlift 3 sets of 8 at 20 kg', 'text');
  expect(draft.interpreted.payload.exerciseName).toBe('Dumbbell Romanian Deadlift');
  expect(draft.exerciseTypeLabel).toBe('DUMBBELL');
});
test('non-catalog equipment modifiers and ambiguous shorthand fail closed', () => {
  const squat = { ...interpreted, payload: { ...interpreted.payload, exerciseName: 'Barbell Squat' } };
  expect(() => buildWorkoutReviewDraft(squat, 'dumbbell squats 3 sets of 8 at 20 kg', 'text')).toThrow('equipment');
  expect(() => buildWorkoutReviewDraft(interpreted, 'bench press with dumbbells 8 reps at 20 kg', 'text')).toThrow('equipment');
  const curl = { ...interpreted, payload: { ...interpreted.payload, exerciseName: 'Bicep Curl' } };
  expect(() => buildWorkoutReviewDraft(curl, 'curls 3x8', 'text')).toThrow('exact exercise');
});
test('server-normalized kilograms are not replaced by locally reparsed pounds', () => {
  const normalized = { ...interpreted, payload: { ...interpreted.payload, weightKg: 61.23 } };
  expect(buildWorkoutReviewDraft(normalized, 'bench press 3 sets of 8 at 135 lbs', 'text').sets.map((set) => set.weightKg)).toEqual(['61.23', '61.23', '61.23']);
});
test('explicit dumbbell and incline identity cannot be silently simplified by interpretation', () => {
  expect(() => buildWorkoutReviewDraft(interpreted, 'dumbbell bench press 8 reps at 20 kg', 'text')).toThrow('exercise');
  expect(() => buildWorkoutReviewDraft(interpreted, 'incline bench press 8 reps at 20 kg', 'text')).toThrow('exercise');
  const dumbbell = { ...interpreted, payload: { ...interpreted.payload, exerciseName: 'Dumbbell Bench Press' } };
  expect(buildWorkoutReviewDraft(dumbbell, 'dumbbell bench press 8 reps at 20 kg', 'text').exerciseTypeLabel).toBe('DUMBBELL');
});
test('an explicitly preserved single exercise identity can contain the word and', () => {
  const response = { ...interpreted, payload: { ...interpreted.payload, exerciseName: 'Clean and Jerk' } };
  const draft = buildWorkoutReviewDraft(response, 'clean and jerk, 3x8 at 80 kg', 'text');
  expect(draft.interpreted.payload.exerciseName).toBe('Clean and Jerk');
  expect(draft.sets.map(set => set.reps)).toEqual(['8', '8', '8']);
});
const values = (text: string) => parseWorkoutSetsFromTranscript(text).map(({weightKg,reps})=>[weightKg,reps]);
test('exercise names between set count and reps do not lose repeated sets', () => {
  expect(values('3 sets of squats, 8 reps at 80 kg')).toEqual([['80','8'],['80','8'],['80','8']]);
});
test('explicit pounds are normalized once while mixed units retain their original values', () => {
  expect(values('8 reps at 135 lb, then 6 reps at 12.5 kg')).toEqual([['61.23496995','8'],['12.5','6']]);
  expect(parseWorkoutSetsFromTranscript('8 reps at 135 lb')[0]?.notes).toContain('135 lb');
});
test('unitless weights remain unknown rather than silently becoming kilograms', () => {
  expect(values('3 sets of 8 reps at 135')).toEqual([['','8'],['','8'],['','8']]);
});
test('compact set counts preserve every set without inventing weights', () => {
  expect(values('lat pulldown 3x12')).toEqual([['','12'],['','12'],['','12']]);
});
test('oversized counts fail closed instead of silently dropping sets', () => {
  expect(() => values('101 sets of 8 at 20 kg')).toThrow('100');
});
test('multi-set phrases do not double count their nested rep and weight phrase', () => {
  expect(values('UI audit test: bench press 2 sets of 8 reps at 10 kg')).toEqual([['10','8'],['10','8']]);
  expect(values('3 sets of 10 at 80 kg')).toEqual([['80','10'],['80','10'],['80','10']]);
});
test('mixed single and repeated sets preserve spoken order and decimal weights', () => {
  expect(values('8 reps at 12.5 kg, then 20 kg for 6, then 2 sets of 5 reps at 15 kg')).toEqual([['12.5','8'],['20','6'],['15','5'],['15','5']]);
});
test('missing weights stay empty and nine sets are not silently reduced to eight', () => {
  expect(values('2 sets of 8 reps')).toEqual([['','8'],['','8']]);
  expect(values('9 sets of 3 at 10 kg')).toHaveLength(9);
});
