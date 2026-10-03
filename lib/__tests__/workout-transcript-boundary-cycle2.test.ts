import { expect, test } from 'bun:test';
import type { InterpretEntryResponse } from '@voicefit/contracts/types';
import { buildWorkoutReviewDraft, parseWorkoutSetsFromTranscript } from '../../components/command-center/helpers';
import { createCommandCenterController, type CommandCenterPorts, type CommandCenterOperationState } from '../../components/command-center/controller';
import type { CommandState, WorkoutReviewDraft } from '../../components/command-center/types';

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
  let draft: WorkoutReviewDraft | null = {
    kind: 'workout', interpreted: interpretation(name), transcript, source: 'text', confidence: 1,
    exerciseTypeLabel: 'RESISTANCE', sessionLabel: 'Synthetic session',
    sets: parseWorkoutSetsFromTranscript(transcript),
  };
  const originalDraft = draft;
  const batches: Parameters<CommandCenterPorts['backend']['createWorkoutBatch']>[0][] = [];
  const singles: Parameters<CommandCenterPorts['backend']['createWorkoutSet']>[0][] = [];
  const errors: Array<{ subtype: string; detail?: string }> = [];
  let sessions = 0, closed = 0, refreshed = 0, requestIds = 0;
  const operation: CommandCenterOperationState = { generation: 0, saving: false };
  const ports: CommandCenterPorts = {
    state: {
      getCommandState: () => state, getCommandText: () => text, getVoiceTranscript: () => '',
      getRecordingSeconds: () => 0, getIsInterpretingVoice: () => false, getScreenContext: () => ({}),
      getSelectedMealPhoto: () => null, getActiveRecording: () => null, getReviewDraft: () => draft,
      getCommandToast: () => null, getLastSavedKcalLeft: () => null,
      getCommandErrorSubtype: () => null, getCommandErrorDetail: () => null,
      getQuickAddItems: () => [], getIsWebPreview: () => false, getPendingSaveAction: () => null,
      setCommandState: value => { state = value; },
      setCommandError: (subtype, detail) => { errors.push({ subtype, detail }); state = 'cc_error'; },
      setCommandErrorDetail: () => {}, setReviewDraft: value => { draft = value as WorkoutReviewDraft | null; },
      setPendingSaveAction: () => {}, setSelectedMealPhoto: () => {}, setCommandText: value => { text = value; },
      setVoiceTranscript: () => {}, setRecordingSeconds: () => {}, setActiveRecording: () => {},
      setIsInterpretingVoice: () => {}, setCommandToast: () => {}, closeCommandCenter: () => { closed++; },
      clearCommandError: () => {},
    },
    backend: {
      interpretEntry: async () => interpretation(name), createPendingMealFromText: async () => {},
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
    feedback: { finishWithSaved: () => {} },
    media: { requestMicrophonePermission: async () => false, startVoiceRecording: async () => { throw new Error('Unexpected recording'); },
      requestPhotoPermission: async () => false, pickMealPhoto: async () => null },
    platform: { isWeb: () => false, openSettings: async () => {}, selectPhotoSource: async () => null },
  };
  return { controller: createCommandCenterController(ports, operation), operation, batches, singles, errors,
    originalDraft, draft: () => draft, setDraft: (value: WorkoutReviewDraft) => { draft = value; },
    text: () => text, counts: () => ({ sessions, closed, refreshed, requestIds }) };
}

const countLeading = '3 sets of donkey kicks, 12 reps at 20 kg, bench press 3x8 at 80 kg';
const nameCommaCount = 'donkey kicks, 3x12 and bench press 3x8 at 80 kg';

test('cycle2 exact reviewer count-leading repro rejects the entire draft rather than six Bench rows', () => {
  expect(parseWorkoutSetsFromTranscript(countLeading)).toHaveLength(6);
  expect(() => buildWorkoutReviewDraft(interpretation(), countLeading, 'text')).toThrow('one exercise');
});

test('cycle2 exact reviewer name/comma/count repro rejects a stale draft before any save side effect', async () => {
  const h = boundary(nameCommaCount);
  expect(h.originalDraft.sets).toHaveLength(6);
  await h.controller.saveReviewedEntry();
  expect(h.batches).toHaveLength(0);
  expect(h.singles).toHaveLength(0);
  expect(h.counts()).toEqual({ sessions: 0, closed: 0, refreshed: 0, requestIds: 0 });
  expect(h.draft()).toBe(h.originalDraft);
  expect(h.errors).toEqual([{ subtype: 'auto_save_failure', detail: expect.stringContaining('one exercise') }]);
  expect(h.operation.workoutBatch).toBeUndefined();
});

test('cycle2 continuation words must not hide a counted second exercise at draft/save boundaries', async () => {
  const transcript = 'bench press 3x8 at 80 kg then another 3 sets of donkey kicks, 12 reps at 20 kg';
  const h = boundary(transcript);
  await h.controller.saveReviewedEntry();
  expect(h.batches).toHaveLength(0);
  expect(() => buildWorkoutReviewDraft(interpretation(), transcript, 'text')).toThrow('one exercise');
});

test('cycle2 spoken introductory count phrases retain a valid single exercise', async () => {
  const transcript = 'I did 3 sets of bench press, 8 reps at 80 kg';
  const draft = buildWorkoutReviewDraft(interpretation(), transcript, 'text');
  expect(draft.sets.map(set => [set.reps, set.weightKg])).toEqual([['8', '80'], ['8', '80'], ['8', '80']]);
  const h = boundary(transcript);
  h.setDraft(draft);
  await h.controller.saveReviewedEntry();
  expect(h.errors).toHaveLength(0);
  expect(h.batches[0].sets).toHaveLength(3);
});

for (const transcript of ["bench press 3x8 at 80 kg then farmer's carry 3x12 at 20 kg",
  'donkey kicks: 3x12, bench press 3x8 at 80 kg']) {
  test(`cycle2 unsupported punctuation in an extra named clause fails closed: ${transcript}`, async () => {
    const h = boundary(transcript);
    await h.controller.saveReviewedEntry();
    expect(h.batches).toHaveLength(0);
    expect(() => buildWorkoutReviewDraft(interpretation(), transcript, 'text')).toThrow('one exercise');
  });
}

const separators = [', ', '; ', '\n', '\r\n', ' and ', ' then ', ', then '];
const namedForms = [
  (name: string) => `${name} 3x12 at 20 kg`,
  (name: string) => `3 sets of ${name}, 12 reps at 20 kg`,
  (name: string) => `${name}, 3x12`,
  (name: string) => `${name} 12 reps at 20 kg`,
];
const known = 'bench press 3x8 at 80 kg';
const compoundCases = separators.flatMap(separator => namedForms.flatMap(form => [
  { separator, transcript: `${form('donkey kicks')}${separator}${known}`, name: 'Bench Press' },
  { separator, transcript: `${known}${separator}${form('donkey kicks')}`, name: 'Bench Press' },
  { separator, transcript: `${form('donkey kicks')}${separator}${form('fire hydrants')}`, name: 'Donkey Kick' },
  { separator, transcript: `${form('donkey kicks')}${separator}${form('fire hydrants')}`, name: 'Fire Hydrant' },
  { separator, transcript: `${known}${separator}backoff 2x6 at 70 kg${separator}${form('fire hydrants')}`, name: 'Bench Press' },
  { separator, transcript: `${known}${separator}another ${form('donkey kicks')}${separator}${known}`, name: 'Bench Press' },
]));

for (const separator of separators) {
  test(`cycle2 bounded named-clause permutations fail closed at draft/route/direct-save/review-save: ${JSON.stringify(separator)}`, async () => {
    for (const { transcript, name } of compoundCases.filter(item => item.separator === separator)) {
      expect(() => buildWorkoutReviewDraft(interpretation(name), transcript, 'text')).toThrow('one exercise');
      const reviewed = boundary(transcript, name);
      await reviewed.controller.saveReviewedEntry();
      expect(reviewed.batches).toHaveLength(0);
      expect(reviewed.singles).toHaveLength(0);
      expect(reviewed.counts()).toEqual({ sessions: 0, closed: 0, refreshed: 0, requestIds: 0 });
      expect(reviewed.draft()).toBe(reviewed.originalDraft);
      expect(reviewed.errors).toEqual([{ subtype: 'auto_save_failure', detail: expect.stringContaining('one exercise') }]);
      expect(reviewed.operation.workoutBatch).toBeUndefined();

      const routed = boundary(transcript, name);
      await expect(routed.controller.routeInterpretedEntry(interpretation(name), transcript, 'text')).rejects.toThrow('one exercise');
      expect(routed.draft()).toBe(routed.originalDraft);
      expect(routed.batches).toHaveLength(0);
      expect(routed.singles).toHaveLength(0);

      const direct = boundary(transcript, name);
      await direct.controller.runSaveAction({ kind: 'entry', interpreted: interpretation(name), transcript, source: 'text' });
      expect(direct.batches).toHaveLength(0);
      expect(direct.singles).toHaveLength(0);
      expect(direct.text()).toBe(transcript);
      expect(direct.errors).toEqual([{ subtype: 'typed_interpret_failure', detail: expect.stringContaining('one exercise') }]);
      expect(direct.counts()).toEqual({ sessions: 0, closed: 0, refreshed: 0, requestIds: 0 });
    }
  });
}

test('cycle2 matrix stays bounded and contains all generated boundary cases', () => {
  expect(compoundCases).toHaveLength(168);
  expect(new Set(compoundCases.map(item => `${item.name}:${item.transcript}`)).size).toBe(168);
});

for (const separator of separators) {
  test(`cycle2 valid single-identity continuations retain every row at actual save: ${JSON.stringify(separator)}`, async () => {
    for (const continuation of ['2x6 at 70 kg', 'backoff 2x6 at 70 kg', 'warmup 2x6 at 70 kg',
      'another 2 sets of 6 at 70 kg', 'bench press 2x6 at 70 kg']) {
      const transcript = `${known}${separator}${continuation}`;
      const draft = buildWorkoutReviewDraft(interpretation(), transcript, 'text');
      expect(draft.sets.map(set => [set.reps, set.weightKg])).toEqual([
        ['8', '80'], ['8', '80'], ['8', '80'], ['6', '70'], ['6', '70'],
      ]);
      const h = boundary(transcript);
      await h.controller.saveReviewedEntry();
      expect(h.errors).toHaveLength(0);
      expect(h.batches).toHaveLength(1);
      expect(h.batches[0].sets.map(set => [set.exerciseName, set.reps, set.weightKg])).toEqual([
        ['Bench Press', 8, 80], ['Bench Press', 8, 80], ['Bench Press', 8, 80],
        ['Bench Press', 6, 70], ['Bench Press', 6, 70],
      ]);
    }
  });
}

test('cycle2 units, decimal and missing weights are preserved through the actual batch save', async () => {
  const cases: Array<{ text: string; normalized: number | null; expected: Array<[number, number | null]> }> = [
    { text: 'bench press 3 sets of 8 at 135 lbs', normalized: 61.23, expected: [[8, 61.23], [8, 61.23], [8, 61.23]] },
    { text: 'bench press 8 reps at 135 lb, then 6 reps at 12.5 kg', normalized: 61.23, expected: [[8, 61.23496995], [6, 12.5]] },
    { text: 'bench press 3 sets of 8 reps at 135', normalized: 80, expected: [[8, null], [8, null], [8, null]] },
    { text: 'bench press 9 sets of 3', normalized: null, expected: Array.from({ length: 9 }, () => [3, null]) },
    { text: 'bench press 8 reps at 12.5 kg, then 20 kg for 6, then 2 sets of 5 reps at 15 kg', normalized: 80,
      expected: [[8, 12.5], [6, 20], [5, 15], [5, 15]] },
  ];
  for (const { text, normalized, expected } of cases) {
    const response = interpretation();
    response.payload.weightKg = normalized;
    const draft = buildWorkoutReviewDraft(response, text, 'text');
    const h = boundary(text);
    h.setDraft(draft);
    await h.controller.saveReviewedEntry();
    expect(h.errors).toHaveLength(0);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0].sets.map(set => [set.reps, set.weightKg])).toEqual(expected);
  }
});

test('cycle2 the parser/draft retain the 100-set cap rather than truncating excess rows', () => {
  const response = interpretation();
  response.payload.weightKg = 20;
  expect(buildWorkoutReviewDraft(response, 'bench press 100 sets of 8 at 20 kg', 'text').sets).toHaveLength(100);
  for (const text of ['bench press 101 sets of 8 at 20 kg', 'bench press 60x8 at 20 kg and backoff 41x6 at 10 kg',
    'bench press 0 sets of 8 at 20 kg']) {
    expect(() => buildWorkoutReviewDraft(response, text, 'text')).toThrow('100');
  }
});

test('cycle2 qualified and unknown single identities keep count-leading/name-comma/reps-first rows', async () => {
  for (const [name, spoken] of [['Donkey Kick', 'donkey kicks'], ['Dumbbell Romanian Deadlift', 'dumbbell romanian deadlift'],
    ['Incline Bench Press', 'incline bench press'], ['Clean and Jerk', 'clean and jerk']]) {
    for (const form of namedForms) {
      const transcript = form(spoken);
      const draft = buildWorkoutReviewDraft(interpretation(name), transcript, 'text');
      const rawSets = parseWorkoutSetsFromTranscript(transcript);
      expect(draft.interpreted.payload.exerciseName).toBe(name);
      expect(draft.sets).toHaveLength(rawSets.length);
      expect(draft.sets.map(set => set.reps)).toEqual(rawSets.map(set => set.reps));
      const h = boundary(transcript, name);
      await h.controller.saveReviewedEntry();
      expect(h.errors).toHaveLength(0);
      expect(h.batches).toHaveLength(1);
      expect(h.batches[0].sets.map(set => set.exerciseName)).toEqual(rawSets.map(() => name));
    }
  }
});
