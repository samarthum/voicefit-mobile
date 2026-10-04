import { expect, test } from 'bun:test';
import type { InterpretEntryResponse } from '@voicefit/contracts/types';
import { buildWorkoutReviewDraft, parseWorkoutSetsFromTranscript } from '../../components/command-center/helpers';
import { createCommandCenterController, type CommandCenterPorts, type CommandCenterOperationState } from '../../components/command-center/controller';
import type { CommandState, WorkoutReviewDraft, ReviewDraft } from '../../components/command-center/types';

const interpretation = (name = 'Bench Press'): Extract<InterpretEntryResponse, { intent: 'workout_set' }> => ({
  intent: 'workout_set', payload: { exerciseName: name, exerciseType: 'resistance', reps: 8, weightKg: 80,
    durationMinutes: null, notes: null, confidence: 1, assumptions: [] },
});

// Exercise the real controller with only external/state ports substituted.
// A stale draft is deliberately assembled without the guarded builder to prove
// save-time validation independently of draft-construction validation.
function boundary(transcript: string, name = 'Bench Press') {
  let state: CommandState = 'cc_review_workout';
  let text = transcript;
  let voice = transcript;
  const interpretations: Array<{ transcript: string; source: string }> = [];
  let draft: ReviewDraft | null = {
    kind: 'workout', interpreted: interpretation(name), transcript, source: 'text', confidence: 1,
    exerciseTypeLabel: 'RESISTANCE', sessionLabel: 'Synthetic session',
    sets: parseWorkoutSetsFromTranscript(transcript),
  };
  const originalDraft = draft;
  const batches: Parameters<CommandCenterPorts['backend']['createWorkoutBatch']>[0][] = [];
  const singles: Parameters<CommandCenterPorts['backend']['createWorkoutSet']>[0][] = [];
  const errors: Array<{ subtype: string; detail?: string }> = [];
  // classifierIds: identities sent as deferMeal with the classifier call. They can
  // only ever create a pending meal, so they are tracked apart from write identities.
  let sessions = 0, closed = 0, refreshed = 0, requestIds = 0, successes = 0, classifierIds = 0;
  const operation: CommandCenterOperationState = { generation: 0, saving: false };
  const ports: CommandCenterPorts = {
    state: {
      getCommandState: () => state, getCommandText: () => text, getVoiceTranscript: () => voice,
      getRecordingSeconds: () => 0, getIsInterpretingVoice: () => false, getScreenContext: () => ({}),
      getSelectedMealPhoto: () => null, getActiveRecording: () => null, getReviewDraft: () => draft,
      getCommandToast: () => null, getLastSavedKcalLeft: () => null,
      getCommandErrorSubtype: () => null, getCommandErrorDetail: () => null,
      getQuickAddItems: () => [], getIsWebPreview: () => false, getPendingSaveAction: () => null,
      setCommandState: value => { state = value; },
      setCommandError: (subtype, detail) => { errors.push({ subtype, detail }); state = 'cc_error'; },
      setCommandErrorDetail: () => {}, setReviewDraft: value => { draft = value; },
      setPendingSaveAction: () => {}, setSelectedMealPhoto: () => {}, setCommandText: value => { text = value; },
      setVoiceTranscript: value => { voice = value; }, setRecordingSeconds: () => {}, setActiveRecording: () => {},
      setIsInterpretingVoice: () => {}, setCommandToast: () => { successes++; }, closeCommandCenter: () => { closed++; },
      clearCommandError: () => {},
    },
    backend: {
      interpretEntry: async (transcript, source, _signal, deferMeal) => { interpretations.push({ transcript, source }); if (deferMeal?.requestId) classifierIds++; return interpretation(name); }, createPendingMealFromText: async () => {},
      createPendingMealFromPhoto: async () => {}, transcribeAudio: async () => '', createMeal: async () => {},
      ensureQuickSession: async () => { sessions++; return 'synthetic-session'; },
      createWorkoutBatch: async input => { batches.push(structuredClone(input)); },
      createWorkoutSet: async input => { singles.push(structuredClone(input)); },
      upsertDailyMetrics: async () => {}, createConversation: async () => {},
      fetchInterpretedIngredient: async () => { throw new Error('Unexpected ingredient lookup'); },
    },
    auth: { getToken: async () => 'synthetic-token' },
    cache: { refreshAfterSave: async () => { refreshed++; }, computeKcalLeftAfterMeal: () => null },
    clock: { now: () => new Date('2026-10-02T12:00:00Z'), createRequestId: () => {
      requestIds++; return '00000000-0000-4000-8000-000000000001';
    } },
    preview: { isEnabled: () => false, hasFlag: () => false, delay: async () => {} },
    feedback: { finishWithSaved: () => { successes++; } },
    media: { requestMicrophonePermission: async () => false, startVoiceRecording: async () => { throw new Error('Unexpected recording'); },
      requestPhotoPermission: async () => false, pickMealPhoto: async () => null },
    platform: { isWeb: () => false, openSettings: async () => {}, selectPhotoSource: async () => null },
  };
  return { controller: createCommandCenterController(ports, operation), operation, batches, singles, errors,
    originalDraft, draft: () => draft, setDraft: (value: WorkoutReviewDraft) => { draft = value; },
    text: () => text, voice: () => voice, interpretations, counts: () => ({ sessions, closed, refreshed, requestIds: requestIds - classifierIds, successes }),
    classifierIds: () => classifierIds };
}

const paths = ['typed', 'voice', 'route', 'direct', 'review'] as const;
const exact = [
  ['Bench Press', 'barbell bench press 3x8 at 80 kg'],
  ['Deadlift', 'barbell deadlift 3 sets of 8 at80kg'],
  ['Overhead Press', 'barbell overhead press 3x8 at80kg'],
];
async function acceptAtBoundary(transcript: string, name: string, path: typeof paths[number], expected: Array<[number, number | null]> = [[8, 80], [8, 80], [8, 80]]) {
  const h = boundary(transcript, name);
  if (path === 'typed') await h.controller.submitTypedText();
  if (path === 'voice') await h.controller.interpretVoiceTranscript(transcript);
  if (path === 'route') await h.controller.routeInterpretedEntry(interpretation(name), transcript, 'text');
  if (path === 'direct') await h.controller.runSaveAction({ kind: 'entry', interpreted: interpretation(name), transcript, source: 'text' });
  // Review path intentionally starts with an independently assembled stale draft.
  await h.controller.dispatch({ type: 'review.save' });
  expect(h.errors).toHaveLength(0);
  expect(h.batches).toHaveLength(1);
  expect(h.singles).toHaveLength(0);
  expect(h.batches[0].sets.map(row => [row.exerciseName, row.reps, row.weightKg])).toEqual(expected.map(([reps, weight]) => [name, reps, weight]));
  expect(h.counts().sessions).toBe(1);
  expect(h.counts().requestIds).toBe(1);
  expect(h.counts().refreshed).toBe(1);
  // Typed and voice entries reach the classifier with a deferred-meal identity.
  expect(h.classifierIds()).toBe(path === 'typed' || path === 'voice' ? 1 : 0);
}
for (const [canonical, transcript] of exact) for (const name of [canonical, `Barbell ${canonical}`]) {
  test(`round4 matching equipment draft: ${name}: ${transcript}`, () => {
    const draft = buildWorkoutReviewDraft(interpretation(name), transcript, 'text');
    expect(draft.interpreted.payload.exerciseName).toBe(name);
    expect(draft.exerciseTypeLabel).toBe('BARBELL');
    expect(draft.sets.map(row => [row.reps, row.weightKg])).toEqual([['8', '80'], ['8', '80'], ['8', '80']]);
  });
  for (const path of paths) test(`round4 matching equipment ${path}: ${name}: ${transcript}`, async () => {
    await acceptAtBoundary(transcript, name, path);
  });
}
export const round4PositiveVectors = [
  ...exact.flatMap(([name, transcript]) => [name, `Barbell ${name}`].map(name => ({ name, transcript }))),
  ...['Bench Press', 'Deadlift', 'Overhead Press'].flatMap(name => [
    { name, transcript: `BARBELLS ${name.toUpperCase().replace(/ /g, '-')} 3x8 at80kg` },
    { name: `Barbell ${name}`, transcript: `I did 3 sets of barbell-${name.toLowerCase().replace(/ /g, '')}, 8 reps at80kg` },
  ]),
  { name: 'Deadlift', transcript: 'barbells deadlifts 3x8 at80kg' },
  { name: 'Barbell Squat', transcript: 'barbells squats 3x8 at80kg' },
  { name: 'Push-Up', transcript: 'bodyweight pushups 3x8 at80kg' },
  { name: 'Close-Grip Bench Press', transcript: 'barbell close-grip bench press 3x8 at80kg' },
  { name: 'Lateral Raise', transcript: 'dumbbells lateral raise 3x8 at80kg' },
  { name: 'Leg Press', transcript: 'machine leg press 3x8 at80kg' },
  { name: 'Tricep Extension', transcript: 'cable tricep extension 3x8 at80kg' },
  { name: 'Barbell Clean and Jerk', transcript: 'barbell clean and jerk 3x8 at80kg' },
  { name: 'Dumbbell Romanian Deadlift', transcript: 'dumbbell romanian deadlift 3x8 at80kg' },
];
for (const vector of round4PositiveVectors.slice(6)) test(`round4 validated alias/catalog/full identity ${vector.name}: ${vector.transcript}`, async () => {
  const draft = buildWorkoutReviewDraft(interpretation(vector.name), vector.transcript, 'text');
  expect(draft.sets.map(row => [row.reps, row.weightKg])).toEqual([['8', '80'], ['8', '80'], ['8', '80']]);
  for (const path of paths) await acceptAtBoundary(vector.transcript, vector.name, path);
});

const separators = [', ', '; ', '\n', '\r\n', ' and ', ' then ', '. Then ', '! then ', '? then '];
const unknownForms = [
  (n: string) => `${n} 3x12 at20kg`,
  (n: string) => `3x12 ${n}`,
  (n: string) => `12reps at20kg ${n}`,
  (n: string) => `3sets of12 ${n}`,
  (n: string) => `3 ${n} sets of12 at20kg`,
  (n: string) => `3x12 at ${n} 20kg`,
  (n: string) => `${n},3x12`,
];
export const round4NegativeVectors = [...new Map([
  ...separators.flatMap(separator => unknownForms.flatMap(form => [
    { name: 'Bench Press', transcript: `${form('barbell donkey kicks')}${separator}barbell bench press 3x8 at80kg` },
    { name: 'Bench Press', transcript: `barbell bench press 3x8 at80kg${separator}${form('barbell donkey kicks')}` },
    { name: 'Bench Press', transcript: `${form('barbell deadlift')}${separator}barbell bench press 3x8 at80kg` },
    { name: 'Bench Press', transcript: `barbell bench press 3x8 at80kg${separator}${form('barbell overhead press')}` },
    { name: 'Barbell Clean and Jerk', transcript: `barbell clean and jerk 3x8 at80kg${separator}${form('barbell donkeykicks')}` },
  ])),
  ...['dumbbell', 'dumbbells', 'kettlebell', 'kettlebells', 'cable', 'machine', 'bodyweight'].flatMap(equipment => [
    { name: 'Bench Press', transcript: `${equipment} bench press 3x8 at20kg` },
    { name: 'Barbell Bench Press', transcript: `${equipment} bench press 3x8 at20kg` },
  ]),
  ...['incline', 'decline', 'romanian', 'sumo', 'close grip'].map(variant => ({ name: 'Bench Press', transcript: `barbell ${variant} bench press 3x8 at80kg` })),
  ...[
    'barbell 3x8 at80kg then bench press 3x8 at80kg',
    'barbell, bench press 3x8 at80kg',
    'barbell\nbench press 3x8 at80kg',
    'barbell\r\nbench press 3x8 at80kg',
    'barbell: bench press 3x8 at80kg',
    'barbell then bench press 3x8 at80kg',
    'barbell 3 sets of bench press, 8 reps at80kg',
    'barbell bench press 3x8 at80kg then barbell 2x6 at70kg',
    'barbell bench press 3x8 at80kg then 2x6 at70kg barbell',
    'barbell bench press 3x8 at80kg then 2x6 at barbell 70kg',
    'barbell donkeykicks 3x12 then barbell bench press 3x8 at80kg',
    '3sets of12 barbelldonkeykicks, barbell bench press 3x8 at80kg',
    'barbell bench press 3x8 at80kg then dumbbell bench press 3x8 at20kg',
  ].map(transcript => ({ name: 'Bench Press', transcript })),
  { name: 'Deadlift', transcript: 'barbell romanian deadlift 3x8 at80kg' },
  { name: 'Lateral Raise', transcript: 'barbell lateral raise 3x8 at80kg' },
  { name: 'Clean and Jerk', transcript: 'barbell clean and jerk 3x8 at80kg' },
].map(vector => [JSON.stringify(vector), vector])).values()];
async function rejectAtBoundary(transcript: string, name: string, path: typeof paths[number]) {
  const h = boundary(transcript, name);
  if (path === 'typed') await h.controller.submitTypedText();
  if (path === 'voice') await h.controller.interpretVoiceTranscript(transcript);
  if (path === 'route') await expect(h.controller.routeInterpretedEntry(interpretation(name), transcript, 'text')).rejects.toThrow();
  if (path === 'direct') await h.controller.runSaveAction({ kind: 'entry', interpreted: interpretation(name), transcript, source: 'text' });
  expect(h.draft()).toBe(h.originalDraft);
  await h.controller.dispatch({ type: 'review.save' });
  expect(h.errors.length > 0).toBe(true);
  expect(h.batches).toHaveLength(0);
  expect(h.singles).toHaveLength(0);
  expect(h.counts()).toEqual({ sessions: 0, closed: 0, refreshed: 0, requestIds: 0, successes: 0 });
  expect(h.draft()).toBe(h.originalDraft);
  expect(h.text()).toBe(transcript);
  expect(h.voice()).toBe(transcript);
  expect(h.operation.workoutBatch).toBeUndefined();
}
test('round4 equipment tokens never hide extra identities or quantities at any boundary', async () => {
  expect(new Set(round4NegativeVectors.map(vector => JSON.stringify(vector))).size).toBe(round4NegativeVectors.length);
  for (const { name, transcript } of round4NegativeVectors) {
    expect(() => buildWorkoutReviewDraft(interpretation(name), transcript, 'text')).toThrow();
    for (const path of paths) await rejectAtBoundary(transcript, name, path);
  }
});

export const numericControls: Array<{ transcript: string; expected: Array<[number, number | null]> }> = [
  { transcript: 'barbell bench press 3x8 at80kg then backoff 2x6 at70kg', expected: [[8,80], [8,80], [8,80], [6,70], [6,70]] },
  { transcript: 'barbells bench press 3x8 at80kg; warmup 2x6 at70kg', expected: [[8,80], [8,80], [8,80], [6,70], [6,70]] },
  { transcript: 'barbell bench press 3x8 at80kg and another 2 sets of6 at70kg', expected: [[8,80], [8,80], [8,80], [6,70], [6,70]] },
  { transcript: 'barbell bench press 3x8 at80kg then barbell bench press 2x6 at70kg', expected: [[8,80], [8,80], [8,80], [6,70], [6,70]] },
  { transcript: 'barbell bench press 8reps at135lbs then 6reps at12.5kg', expected: [[8,61.23496995], [6,12.5]] },
  { transcript: 'barbell bench press 3x8', expected: [[8,null], [8,null], [8,null]] },
  { transcript: 'barbell bench press 3sets of8 at135', expected: [[8,null], [8,null], [8,null]] },
  { transcript: 'barbell bench press 100sets of8 at80kg', expected: Array.from({ length: 100 }, () => [8,80]) },
];
for (const { transcript, expected } of numericControls) test(`round4 equipment row preservation: ${transcript}`, async () => {
  const draft = buildWorkoutReviewDraft(interpretation(), transcript, 'text');
  expect(draft.sets.map(row => [Number(row.reps), row.weightKg ? Number(row.weightKg) : null])).toEqual(expected);
  for (const path of paths) await acceptAtBoundary(transcript, 'Bench Press', path, expected);
});
test('round4 matching equipment never bypasses the existing 100-set limit', () => {
  expect(() => buildWorkoutReviewDraft(interpretation(), 'barbell bench press 101sets of8 at80kg', 'text')).toThrow('100');
});
export { boundary, interpretation };