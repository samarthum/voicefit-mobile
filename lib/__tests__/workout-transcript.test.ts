import { expect, test } from 'bun:test';
import { parseWorkoutSetsFromTranscript } from '../../components/command-center/helpers';
const values = (text: string) => parseWorkoutSetsFromTranscript(text).map(({weightKg,reps})=>[weightKg,reps]);
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
