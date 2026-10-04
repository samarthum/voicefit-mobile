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
      upsertDailyMetrics: async () => {},
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
    platform: { isWeb: () => false, openCoach: () => {}, openSettings: async () => {}, selectPhotoSource: async () => null },
  };
  return { controller: createCommandCenterController(ports, operation), operation, batches, singles, errors,
    originalDraft, draft: () => draft, setDraft: (value: WorkoutReviewDraft) => { draft = value; },
    text: () => text, voice: () => voice, interpretations, counts: () => ({ sessions, closed, refreshed, requestIds: requestIds - classifierIds, successes }),
    classifierIds: () => classifierIds };
}


const exact = [
  '3x12 donkey kicks, bench press 3x8 at 80 kg',
  'bench press 3x8 at 80 kg, 3x12 donkey kicks',
  'bench press 3x8 at 80 kg then 12 reps at 20 kg donkey kicks',
  'bench press 3x8 at 80 kg; 3 sets of 12 donkey kicks at 20 kg',
];
const paths = ['typed', 'voice', 'route', 'direct', 'review'] as const;
async function rejectAtBoundary(transcript: string, name: string, path: typeof paths[number]) {
    const h = boundary(transcript, name);
    if (path === 'typed') await h.controller.submitTypedText();
    if (path === 'voice') await h.controller.interpretVoiceTranscript(transcript);
    if (path === 'route') await expect(h.controller.routeInterpretedEntry(interpretation(name), transcript, 'text')).rejects.toThrow('one exercise');
    if (path === 'direct') await h.controller.runSaveAction({ kind: 'entry', interpreted: interpretation(name), transcript, source: 'text' });
    expect(h.draft()).toBe(h.originalDraft);
    expect(h.voice()).toBe(transcript);
    expect(h.interpretations).toEqual(path === 'typed' || path === 'voice' ? [{ transcript, source: path === 'typed' ? 'text' : 'voice' }] : []);
    // Independently assembled stale review must fail even after any entry callback.
    await h.controller.dispatch({ type: 'review.save' });
    expect(h.batches).toHaveLength(0);
    expect(h.singles).toHaveLength(0);
    expect(h.counts()).toEqual({ sessions: 0, closed: 0, refreshed: 0, requestIds: 0, successes: 0 });
    expect(h.draft()).toBe(h.originalDraft);
    expect(h.text()).toBe(transcript);
    expect(h.errors[h.errors.length - 1]?.detail).toContain('one exercise');
    expect(h.operation.workoutBatch).toBeUndefined();
}
for (const transcript of exact) {
  test(`round3 exact draft rejection: ${transcript}`, () => {
    expect(() => buildWorkoutReviewDraft(interpretation(), transcript, 'text')).toThrow('one exercise');
  });
  for (const path of paths) test(`round3 exact ${path} rejection: ${transcript}`, async () => {
    await rejectAtBoundary(transcript, 'Bench Press', path);
  });
}

const separators = [', ', '; ', '\n', '\r\n', ' and ', ' then ', ', then ', '; then ', '. Then '];
const forms = [
  (n: string) => `${n} 3x12 at 20 kg`,
  (n: string) => `3x12 ${n}`,
  (n: string) => `12 reps ${n} at 20 kg`,
  (n: string) => `12 reps at 20 kg ${n}`,
  (n: string) => `3 sets of 12 ${n} at 20 kg`,
  (n: string) => `3 sets of ${n}, 12 reps at 20 kg`,
  (n: string) => `20kg ${n} for 12 reps`,
  (n: string) => `3 ${n} sets of 12 at 20 kg`,
  (n: string) => `3x12 at ${n} 20 kg`,
];
const known = 'bench press 3x8 at 80 kg';
const matrix = [...new Map(separators.flatMap(separator => forms.flatMap(form => [
  { separator, name: 'Bench Press', transcript: `${known}${separator}${form('donkey kicks')}` },
  { separator, name: 'Bench Press', transcript: `${form('donkey kicks')}${separator}${known}` },
  { separator, name: 'Donkey Kick', transcript: `${form('donkey kicks')}${separator}${form('fire hydrants')}` },
  { separator, name: 'Fire Hydrant', transcript: `${form('donkey kicks')}${separator}${form('fire hydrants')}` },
  { separator, name: 'Bench Press', transcript: `${known}${separator}warmup 2x6 at 70kg${separator}${form('fire hydrants')}` },
  { separator, name: 'Bench Press', transcript: `${known}${separator}another ${form('donkey kicks')}${separator}${known}` },
])).map(item => [`${item.name}:${item.transcript}`, item])).values()];
for (const separator of separators) test(`round3 generated position matrix: ${JSON.stringify(separator)}`, async () => {
  for (const { transcript, name } of matrix.filter(item => item.separator === separator)) {
    expect(() => buildWorkoutReviewDraft(interpretation(name), transcript, 'text')).toThrow('one exercise');
    for (const path of paths) await rejectAtBoundary(transcript, name, path);
  }
});
test('round3 generated matrix has exactly 486 unique identity/position/order/separator vectors', () => {
  expect(matrix).toHaveLength(486);
  expect(new Set(matrix.map(item => `${item.name}:${item.transcript}`)).size).toBe(486);
});
for (const name of ['Donkey Kick', 'Fire Hydrant', 'Dumbbell Romanian Deadlift', 'Incline Bench Press',
  'Clean and Jerk', "Farmer's Carry", 'Bench Press', 'Barbell Squat', 'Dumbbell Bench Press']) {
  test(`round3 single full identity survives numeric-leading/quantity-interleaved forms: ${name}`, async () => {
    const spoken = name === 'Barbell Squat' ? 'squats' : name === 'Donkey Kick' ? 'donkey kicks' : name.toLowerCase();
    // Preserve existing parsing/fallback behavior without expanding its grammar.
    for (const form of forms) {
      const transcript = form(spoken);
      const response = interpretation(name);
      const draft = buildWorkoutReviewDraft(response, transcript, 'text');
      const raw = parseWorkoutSetsFromTranscript(transcript);
      expect(draft.interpreted.payload.exerciseName).toBe(name);
      expect(draft.sets.map(set => [set.reps, set.weightKg])).toEqual(raw.length
        ? raw.map(set => [set.reps, set.weightKg ? '80' : '']) : [['8', '80']]);
      const h = boundary(transcript, name);
      h.setDraft(draft);
      await h.controller.saveReviewedEntry();
      expect(h.errors).toHaveLength(0);
      expect(h.batches).toHaveLength(1);
      expect(h.batches[0].sets.map(set => set.exerciseName)).toEqual(draft.sets.map(() => name));
    }
  });
}
test('round3 interpreted notes and edited row notes survive validation without being interpreted as identity', async () => {
  const response = interpretation('Clean and Jerk');
  response.payload.notes = 'felt strong; warmup then working sets';
  const draft = buildWorkoutReviewDraft(response, 'clean and jerk', 'text');
  expect(draft.sets[0].notes).toBe(response.payload.notes);
  draft.sets[0].notes = 'controlled tempo, no pain';
  const h = boundary('clean and jerk', 'Clean and Jerk'); h.setDraft(draft);
  await h.controller.saveReviewedEntry();
  expect(h.errors).toHaveLength(0);
  expect(h.batches[0].sets[0].notes).toBe('controlled tempo, no pain');
});

for (const transcript of [
  'bench press 3x8 at80kg then12 reps at20kg donkeykicks',
  '3x12donkeykicks; bench press 3x8 at80kg',
  'bench press 3x8 at80kg;3 sets of12 donkeykicks at20kg',
]) test(`round3 compact spacing cannot hide a numeric-leading extra identity: ${transcript}`, async () => {
  expect(() => buildWorkoutReviewDraft(interpretation(), transcript, 'text')).toThrow('one exercise');
  for (const path of paths) await rejectAtBoundary(transcript, 'Bench Press', path);
});
for (const [name, spoken] of [['Push-Up', 'pushups'], ['Pull-Up', 'pullups'], ['Barbell Bench Press', 'bench press'],
  ['Close-Grip Bench Press', 'close grip bench press'], ['Goblet Squat', 'goblet squats'], ['Romanian Deadlift', 'romanian deadlift']]) {
  test(`round3 preserved aliases/equipment/variants work through every entry and save callback: ${name}`, async () => {
    const transcript = `I did 3 sets of ${spoken}, 8 reps at80kg then backoff 2x6 at70kg`;
    for (const path of paths) {
      const h = boundary(transcript, name);
      if (path === 'typed') await h.controller.submitTypedText();
      if (path === 'voice') await h.controller.interpretVoiceTranscript(transcript);
      if (path === 'route') await h.controller.routeInterpretedEntry(interpretation(name), transcript, 'text');
      if (path === 'direct') await h.controller.runSaveAction({ kind: 'entry', interpreted: interpretation(name), transcript, source: 'text' });
      if (path === 'review') h.setDraft(buildWorkoutReviewDraft(interpretation(name), transcript, 'text'));
      await h.controller.dispatch({ type: 'review.save' });
      expect(h.errors).toHaveLength(0);
      expect(h.batches).toHaveLength(1);
      expect(h.singles).toHaveLength(0);
      expect(h.batches[0].sets.map(set => [set.exerciseName, set.reps, set.weightKg])).toEqual([
        [name, 8, 80], [name, 8, 80], [name, 8, 80], [name, 6, 70], [name, 6, 70],
      ]);
    }
  });
}
