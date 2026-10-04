const { test } = require('node:test');
const assert = require('node:assert/strict');
const { screen, empty, meal, act } = require('./date-history-harness.cjs');

test('Home shows prior logged days when its fast selected-day payload has no trends', async () => {
  const history = { ...empty(), weeklyTrends: [
    { date: '2026-09-28', calories: 400, steps: null, weight: null, workouts: 0 },
    { date: '2026-09-29', calories: 0, steps: 1500, weight: null, workouts: 0 },
    { date: '2026-09-30', calories: 0, steps: null, weight: 72, workouts: 0 },
    { date: '2026-10-01', calories: 0, steps: null, weight: null, workouts: 1 },
    { date: '2026-10-02', calories: 0, steps: null, weight: null, workouts: 0 },
    { date: '2026-10-03', calories: 0, steps: null, weight: null, workouts: 0 },
    { date: '2026-10-04', calories: 0, steps: null, weight: null, workouts: 0 },
  ] };
  const s = await screen({ response: ({ scope }) => scope === 'full' ? history : empty() });
  try {
    assert.equal(s.hasDot('2026-09-28'), true, 'prior logged meal day must show a dot despite home weeklyTrends=[]');
    for (const date of ['2026-09-29', '2026-09-30', '2026-10-01']) assert.equal(s.hasDot(date), true, `logged ${date}`);
    assert.equal(s.hasDot('2026-10-02'), false, 'empty prior day');
    assert.equal(s.requests.filter(r => r.scope === 'full').length, 1);
    const full = s.requests.find(r => r.scope === 'full');
    assert.equal(full.date, '2026-10-04');
    assert.equal(full.timezone, s.timezone);
  } finally { await s.close(); }
});

test('Home counts pending/nullable history meals and zero-calorie selected-day meals without losing indicators on selection', async () => {
  const history = { ...empty(), recentMeals: [meal('2026-10-02', null, 'interpreting')] };
  const selected = { ...empty(), recentMeals: [meal('2026-10-03', 0)] };
  const s = await screen({ response: ({ scope, date }) => scope === 'full' ? history : date === '2026-10-03' ? selected : empty() });
  try {
    assert.equal(s.hasDot('2026-10-02'), true, 'pending meal is logged even with no counted nutrition');
    assert.equal(s.hasDot('2026-10-04'), false, 'empty today must not claim logged activity');
    await s.select('2026-10-03');
    assert.equal(s.hasDot('2026-10-03'), true, 'zero calories do not erase an actual meal');
    assert.equal(s.hasDot('2026-10-02'), true, 'history stays stable while another date loads');
    assert.equal(Boolean(s.byId('home-meal-row-meal-2026-10-03')), true);
    await s.select('2026-10-04');
    assert.equal(s.hasDot('2026-10-03'), true, 'visited selected-day evidence stays available from cache');
    assert.equal(s.hasDot('2026-10-04'), false);
    assert.equal(s.requests.filter(r => r.scope === 'full').length, 1, 'selection does not refetch or re-anchor history');
  } finally { await s.close(); }
});

test('Home immediately marks a late inactive day response without another selection', async () => {
  let resolvePrior;
  const prior = new Promise(resolve => { resolvePrior = resolve; });
  // Backend-reachable history: five newer meals hide this older pending meal,
  // whose unknown calories also contribute no aggregate activity.
  const history = { ...empty(),
    recentMeals: Array.from({ length: 5 }, (_, i) => ({ ...meal('2026-10-02'), id: `newer-${i}` })),
    weeklyTrends: ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map(date => ({
      date, calories: date === '2026-10-02' ? 1200 : 0, steps: null, weight: null, workouts: 0,
    })),
  };
  const s = await screen({ response: ({ scope, date }) => scope === 'full' ? history : date === '2026-09-29' ? prior : empty() });
  try {
    await s.select('2026-09-29');
    await s.select('2026-10-04');
    const key = ['dashboard', 'home', s.timezone, '2026-09-29'];
    const query = s.qc.getQueryCache().find({ queryKey: key });
    assert.equal(query.getObserversCount(), 0, 'the historical Home query is inactive before completion');
    assert.equal(s.hasDot('2026-09-29'), false);
    assert.doesNotMatch(s.byId('home-day-2026-09-29').props.accessibilityLabel, /logged activity/);
    const requestCount = s.requests.length;
    await act(async () => resolvePrior({ ...empty(), recentMeals: [meal('2026-09-29', null, 'interpreting')] }));
    await s.settle();
    assert.equal(s.qc.getQueryState(key).status, 'success');
    assert.equal(s.qc.getQueryState(key).isInvalidated, false);
    assert.equal(s.qc.getQueryData(key).recentMeals.length, 1);
    assert.equal(query.getObserversCount(), 0);
    assert.equal(s.byId('home-day-2026-10-04').props.accessibilityState.selected, true);
    assert.equal(Boolean(s.byId('home-meal-row-meal-2026-09-29')), false, 'late history must not replace today details');
    assert.match(s.text(), /No meals logged today/);
    assert.equal(s.hasDot('2026-10-04'), false, 'empty selected today remains unlogged');
    assert.equal(s.requests.length, requestCount, 'reactivity must not issue another request');
    assert.equal(s.requests.filter(r => r.scope === 'full').length, 1, 'history stays today-anchored');
    assert.equal(s.hasDot('2026-09-29'), true, 'completed inactive evidence must render without another selection');
    assert.match(s.byId('home-day-2026-09-29').props.accessibilityLabel, /logged activity/);
  } finally { resolvePrior(empty()); await s.close(); }
});

test('Home removes inactive historical evidence after a foreground refetch error and restores it on success', async () => {
  const date = '2026-09-29';
  const today = '2026-10-04';
  const historical = { ...empty(), recentMeals: [meal(date, null, 'failed')] };
  let pending = false, rejectRequest;
  const request = new Promise((_, reject) => { rejectRequest = reject; });
  const s = await screen({ response: ({ scope, date: requested }) =>
    scope === 'home' && requested === date ? pending ? request : historical : empty() });
  const { focusManager } = s.load('@tanstack/react-query');
  const key = ['dashboard', 'home', s.timezone, date];
  const todayKey = ['dashboard', 'home', s.timezone, today];
  const historyKey = ['dashboard', 'full', s.timezone, today];
  const events = [];
  const unsubscribe = s.qc.getQueryCache().subscribe(event => {
    if (JSON.stringify(event.query.queryKey) === JSON.stringify(key)) {
      events.push({ type: event.type, action: event.action?.type });
    }
  });
  try {
    await s.select(date);
    assert.equal(s.hasDot(date), true);
    assert.match(s.byId(`home-day-${date}`).props.accessibilityLabel, /logged activity/);
    await act(async () => s.qc.setQueryData(key, s.qc.getQueryData(key), { updatedAt: Date.now() - 61000 }));
    pending = true;
    await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); });
    await s.settle();
    const query = s.qc.getQueryCache().find({ queryKey: key, exact: true });
    assert.equal(query.state.fetchStatus, 'fetching', 'installed foreground focus must start a stale historical Home request');
    assert.equal(query.getObserversCount(), 1);
    assert.equal(s.requests.filter(r => r.scope === 'home' && r.date === date).length, 2);
    await s.select(today);
    assert.equal(query.getObserversCount(), 0, 'historical observer is gone before its request rejects');
    assert.equal(query.state.isInvalidated, false);
    assert.equal(s.hasDot(date), true);
    const requestsBeforeError = [...s.requests];
    const todayData = s.qc.getQueryData(todayKey);
    const historyData = s.qc.getQueryData(historyKey);
    const todayText = s.text();
    const assertTodayUnchanged = () => {
      assert.equal(s.byId(`home-day-${today}`).props.accessibilityState.selected, true);
      assert.equal(s.qc.getQueryData(todayKey), todayData);
      assert.equal(s.qc.getQueryData(historyKey), historyData);
      assert.equal(s.text(), todayText, 'historical cache transitions must not replace today data or headings');
      assert.match(s.text(), /Nutrition/);
      assert.match(s.text(), /Today’s meals/);
      assert.match(s.text(), /No meals logged today/);
      assert.equal(Boolean(s.byId(`home-meal-row-meal-${date}`)), false);
      assert.equal(s.hasDot(today), false);
      assert.equal(s.requests.filter(r => r.scope === 'home' && r.date === today).length, 1);
      assert.equal(s.requests.filter(r => r.scope === 'full').length, 1);
      assert.equal(s.requests.find(r => r.scope === 'full').date, today, 'full history stays today-anchored');
    };
    await act(async () => rejectRequest(Error('fixture historical focus refresh unavailable')));
    await s.settle();
    assert.equal(query.state.status, 'error');
    assert.equal(query.state.fetchStatus, 'idle');
    assert.equal(query.state.isInvalidated, true, 'installed refetch error invalidates retained data');
    assert.equal(query.state.data, historical, 'failure retains historical payload, so data identity alone cannot notify Home');
    assert.equal(query.getObserversCount(), 0);
    assert.equal(s.qc.getQueriesData({ queryKey: ['dashboard', 'home', s.timezone],
      predicate: q => !q.state.isInvalidated }).some(([k]) => JSON.stringify(k) === JSON.stringify(key)), false);
    assert.equal(events.some(e => e.type === 'updated' && e.action === 'error'), true);
    assert.deepEqual(s.requests, requestsBeforeError, 'error reactivity must not issue additional requests');
    assert.equal(s.requests.length, 4);
    assertTodayUnchanged();
    assert.equal(s.hasDot(date), false, 'late foreground refetch error must remove ineligible inactive evidence without another selection');
    assert.doesNotMatch(s.byId(`home-day-${date}`).props.accessibilityLabel, /logged activity/);

    pending = false;
    await act(async () => s.qc.refetchQueries({ queryKey: key, exact: true, type: 'inactive' }));
    await s.settle();
    assert.equal(query.state.status, 'success');
    assert.equal(query.state.isInvalidated, false);
    assert.equal(query.state.data, historical, 'structurally identical successful refresh restores evidence');
    assert.equal(query.getObserversCount(), 0);
    assert.equal(s.requests.length, requestsBeforeError.length + 1);
    assert.deepEqual(s.requests.slice(0, -1), requestsBeforeError);
    assert.equal(s.requests.at(-1).scope, 'home');
    assert.equal(s.requests.at(-1).date, date);
    assertTodayUnchanged();
    assert.equal(s.hasDot(date), true);
    assert.match(s.byId(`home-day-${date}`).props.accessibilityLabel, /logged activity/);
  } finally {
    unsubscribe();
    rejectRequest(Error('fixture cleanup'));
    await s.close();
    focusManager.setFocused(undefined);
  }
});

test('Home pull-to-refresh reloads history as well as the selected-day payload', async () => {
  let logged = false;
  const s = await screen({ response: ({ scope }) => {
    if (scope === 'full' && logged) return { ...empty(), weeklyTrends: [{ date: '2026-10-02', calories: 0, steps: null, weight: 72, workouts: 0 }] };
    return empty();
  } });
  try {
    assert.equal(s.hasDot('2026-10-02'), false);
    logged = true;
    await s.refresh();
    assert.equal(s.hasDot('2026-10-02'), true, 'refresh must pick up newly logged history');
    assert.equal(s.requests.filter(r => r.scope === 'home').length, 2);
    assert.equal(s.requests.filter(r => r.scope === 'full').length, 2);
    logged = false;
    await s.refresh();
    assert.equal(s.hasDot('2026-10-02'), false, 'refresh must also remove deleted historical evidence');
  } finally { await s.close(); }
});

test('Home uses selected-day metric evidence immediately while history is unavailable', async () => {
  for (const todayPatch of [{ weight: 72 }, { steps: { count: 300, goal: 10000 } }, { calories: { consumed: 300, goal: 2000 } }, { workoutSessions: 1 }]) {
    const selected = empty();
    Object.assign(selected.today, todayPatch);
    const s = await screen({ response: ({ scope }) => { if (scope === 'full') throw Error('History unavailable'); return selected; } });
    try {
      assert.equal(s.hasDot('2026-10-04'), true, `selected metric ${Object.keys(todayPatch)[0]} is logged`);
      assert.equal(s.text().includes('Could not load Home'), false, 'history errors do not block day details');
    } finally { await s.close(); }
  }
});

test('Date taps fetch the actual day summary and complete Home meal payload, not capped full recent meals', async () => {
  const history = { ...empty(), today: { ...empty().today, calories: { consumed: 999, goal: 2000 } }, recentMeals: [meal('2026-10-04')] };
  const selected = { ...empty(), today: { ...empty().today, calories: { consumed: 432, goal: 2000 } }, recentMeals: [meal('2026-10-03'), { ...meal('2026-10-03', null, 'interpreting'), id: 'pending' }, { ...meal('2026-10-03'), id: 'third' }, { ...meal('2026-10-03'), id: 'fourth' }] };
  const s = await screen({ response: ({ scope, date }) => scope === 'full' ? history : date === '2026-10-03' ? selected : empty() });
  try {
    await s.select('2026-10-03');
    assert.equal(s.requests.at(-1).scope, 'home');
    assert.equal(s.requests.at(-1).date, '2026-10-03');
    assert.equal(s.requests.at(-1).timezone, s.timezone);
    assert.equal(s.r.root.findByType('CalorieRing').props.consumed, 432);
    assert.match(s.text(), /Nutrition · Oct 3/);
    assert.match(s.text(), /Meals · Oct 3/);
    for (const id of ['meal-2026-10-03', 'pending', 'third']) assert.equal(Boolean(s.byId(`home-meal-row-${id}`)), true);
    assert.equal(Boolean(s.byId('home-meal-row-meal-2026-10-04')), false);
    assert.equal(Boolean(s.byId('home-meal-row-fourth')), false, 'only existing three-row presentation is capped');
    assert.equal(s.qc.getQueryData(['dashboard', 'home', s.timezone, '2026-10-03']).recentMeals.length, 4, 'Home payload is not truncated by full history');
    await act(async () => s.byId('home-recent-meals-see-all').props.onPress());
    assert.deepEqual(s.routes.at(-1), { pathname: '/meals', params: { date: '2026-10-03' } });
    await act(async () => s.byId('home-meal-row-pending').props.onPress());
    assert.deepEqual(s.routes.at(-1), { pathname: '/meal-edit/[id]', params: { id: 'pending' } });
    assert.equal(s.requests.filter(r => r.scope === 'full').length, 1);
  } finally { await s.close(); }
});

test('History loading does not block a loaded Home or invent dots', async () => {
  let resolveHistory;
  const pendingHistory = new Promise(resolve => { resolveHistory = resolve; });
  const s = await screen({ response: ({ scope }) => scope === 'full' ? pendingHistory : empty() });
  try {
    assert.equal(s.r.root.findAllByType('LoadingBlock').length, 0);
    assert.match(s.text(), /No meals logged today/);
    assert.equal(s.hasDot('2026-10-04'), false);
    await act(async () => resolveHistory({ ...empty(), recentMeals: [meal('2026-10-02', null, 'failed')] }));
    await s.settle();
    assert.equal(s.hasDot('2026-10-02'), true);
  } finally { await s.close(); }
});

test('Restoration reuses the Trends full cache key without premature network requests', async () => {
  const history = { ...empty(), recentMeals: [meal('2026-10-02')] };
  const s = await screen({ restoring: true, seed: history });
  try {
    assert.deepEqual(s.requests, []);
    assert.equal(s.hasDot('2026-10-02'), true, 'persisted full history renders during restoration');
    await s.restore();
    assert.equal(s.requests.filter(r => r.scope === 'home').length, 1);
    assert.equal(s.requests.filter(r => r.scope === 'full').length, 0, 'fresh Trends cache is reused');
    assert.equal(s.hasDot('2026-10-04'), false);
  } finally { await s.close(); }
});

test('Refreshing history drops invalidated visited-day evidence after a meal is deleted', async () => {
  for (const refresh of ['invalidate', 'refresh']) {
    let exists = true;
    const s = await screen({ response: ({ scope, date }) => scope === 'home' && date === '2026-10-03' && exists ? { ...empty(), recentMeals: [meal('2026-10-03', 0)] } : empty() });
    try {
      await s.select('2026-10-03');
      await s.select('2026-10-04');
      assert.equal(s.hasDot('2026-10-03'), true);
      exists = false;
      await s[refresh]();
      assert.equal(s.hasDot('2026-10-03'), false, `${refresh} must not retain an invalidated historical meal`);
    } finally { await s.close(); }
  }
});

test('Dashboard-prefix invalidation refreshes the full history observer', async () => {
  let logged = false;
  const s = await screen({ response: ({ scope }) => scope === 'full' && logged ? { ...empty(), recentMeals: [meal('2026-10-02', null, 'interpreting')] } : empty() });
  try {
    logged = true;
    await s.invalidate();
    assert.equal(s.hasDot('2026-10-02'), true);
    assert.equal(s.requests.filter(r => r.scope === 'full').length, 2);
    assert.equal(s.requests.filter(r => r.scope === 'home').length, 2);
  } finally { await s.close(); }
});

test('Actual health-step sync invalidation refreshes the history query', async () => {
  let synced = false;
  const s = await screen({ deviceSteps: 300, response: ({ scope }) => {
    if (!scope) { synced = true; return {}; }
    const data = empty();
    if (synced) {
      data.today.steps.count = 300;
      if (scope === 'full') data.weeklyTrends = [{ date: '2026-10-04', calories: 0, steps: 300, weight: null, workouts: 0 }];
    }
    return data;
  } });
  try {
    const writes = s.requests.filter(r => r.method === 'POST');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, '/api/daily-metrics');
    assert.deepEqual(JSON.parse(writes[0].body), { date: '2026-10-04', steps: 300 });
    assert.equal(s.requests.filter(r => r.scope === 'full').length, 2);
    assert.equal(s.hasDot('2026-10-04'), true);
  } finally { await s.close(); }
});

test('History recent meal indicators use device-local dates', async () => {
  const boundaryMeal = { ...meal('2026-10-03'), eatenAt: '2026-10-03T00:30:00Z' };
  const s = await screen({ response: ({ scope }) => scope === 'full' ? { ...empty(), recentMeals: [boundaryMeal] } : empty() });
  try {
    const date = s.load('@/components/command-center/helpers').toLocalDateString(new Date(boundaryMeal.eatenAt));
    assert.equal(s.hasDot(date), true);
    if (process.env.TZ === 'America/Los_Angeles') {
      assert.equal(date, '2026-10-02');
      assert.equal(s.hasDot('2026-10-03'), false, 'UTC next-day key must not misplace this local meal');
    }
    assert.equal(s.requests.find(r => r.scope === 'full').timezone, s.timezone);
  } finally { await s.close(); }
});

test('Local-day rollover updates the strip and full-history key without moving a historical selection', async () => {
  for (const historical of [false, true]) {
    const s = await screen();
    try {
      if (historical) await s.select('2026-10-03');
      await s.advanceDay('2026-10-05T00:00:01Z');
      assert.equal(Boolean(s.byId('home-day-2026-09-28')), false);
      assert.equal(Boolean(s.byId('home-day-2026-10-05')), true);
      assert.equal(s.byId(`home-day-${historical ? '2026-10-03' : '2026-10-05'}`).props.accessibilityState.selected, true);
      assert.equal(s.requests.filter(r => r.scope === 'full').at(-1).date, '2026-10-05');
      assert.equal(s.requests.filter(r => r.scope === 'full').length, 2);
      assert.equal(s.requests.filter(r => r.scope === 'home').at(-1).date, historical ? '2026-10-03' : '2026-10-05');
    } finally { await s.close(); }
  }
});
