// Actual Home/DayPicker + installed React Query. Only native/services are fixtures.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const app = createRequire(path.join(root, 'package.json'));
const deps = createRequire(path.join(process.env.MEAL_UI_TEST_DEPS, 'package.json'));
const React = deps('react');
const { create, act } = deps('react-test-renderer');
const ts = app('typescript');
global.IS_REACT_ACT_ENVIRONMENT = true;
const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const localDate = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
const empty = () => ({
  today: { calories: { consumed: 0, goal: 2000 }, macros: null, steps: { count: null, goal: 10000 }, weight: null, workoutSessions: 0, workoutSets: 0 },
  weeklyTrends: [], recentMeals: [], recentExercises: [],
});
const meal = (date, calories = 240, status = 'reviewed') => ({
  id: `meal-${date}`, description: `Lunch ${date}`, eatenAt: `${date}T12:00:00Z`, calories,
  mealType: 'lunch', interpretationStatus: status,
});
function fixtureLoader(shims) {
  const cache = new Map();
  function load(name, from = path.join(root, 'index.ts')) {
    if (name in shims) return shims[name];
    let base;
    if (name === '@tanstack/react-query') base = app.resolve(name);
    else if (name.startsWith('@/')) base = path.join(root, name.slice(2));
    else if (name.startsWith('.') || path.isAbsolute(name)) base = path.resolve(path.dirname(from), name);
    else return app(name);
    const file = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
    assert.ok(file, `resolve ${name}`);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = fs.readFileSync(file, 'utf8');
    const code = file.endsWith('.cjs') ? source : ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(n => load(n, file), module, module.exports);
    return module.exports;
  }
  return load;
}
async function screen({ response = () => empty(), restoring = false, seed, deviceSteps } = {}) {
  const OriginalDate = global.Date;
  let now = OriginalDate.parse('2026-10-04T12:00:00Z');
  global.Date = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  const listeners = new Set(), requests = [], routes = [], haptics = [];
  const native = { StyleSheet: { create: x => x }, useWindowDimensions: () => ({ fontScale: 1 }), AppState: { addEventListener: (event, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } } };
  for (const name of ['View', 'Text', 'Pressable', 'ScrollView', 'RefreshControl']) native[name] = name;
  const getToken = async () => 'fixture-token';
  const shims = {
    react: React, 'react/jsx-runtime': deps('react/jsx-runtime'), 'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'View' },
    '@clerk/clerk-expo': { useAuth: () => ({ getToken }) },
    'expo-router': { useRouter: () => ({ push: target => routes.push(target) }) },
    '@/lib/api-client': { apiRequest: async (url, options) => { const params = Object.fromEntries(new URL(url, 'https://fixture.invalid').searchParams); requests.push({ url, ...params, ...options }); return response(params); } },
    '@/lib/performance-log': { appTimingStarted: 0, measureToken: (route, token) => token(), monotonicNow: () => 0, recordTiming() {} },
    '@/hooks/use-screen-timing': { useScreenTiming() {} },
    '@/components/command-center': { useCommandCenter: () => ({ open() {}, startRecording() {} }), toLocalDateString: localDate, COLORS: { bg: '#FAFAFA' } },
    '@/components/command-center/helpers': { toLocalDateString: localDate, getErrorMessage: e => e.message },
    '@/components/FloatingCommandBar': { FloatingCommandBar: 'FloatingCommandBar' },
    '@/components/pulse': { Wordmark: 'Wordmark', LoadingBlock: 'LoadingBlock', OfflineBanner: 'OfflineBanner' },
    '@/lib/web-preview-mode': { isWebPreviewMode: () => false },
    '@react-native-community/netinfo': { __esModule: true, default: { addEventListener: () => () => {} } },
    '@/lib/haptics': { haptic: { tap() {}, selection: () => haptics.push('selection') } },
    '@/hooks/use-health-steps': { useHealthSteps: () => ({ steps: null }), useHealthStepsSync() {} },
    '@/components/Icon': { Icon: 'Icon' },
  };
  const load = fixtureLoader(shims);
  if (deviceSteps != null) {
    shims['expo-secure-store'] = {};
    shims['@/lib/health/steps'] = {};
    delete shims['@/hooks/use-health-steps'];
    const { useHealthStepsSync } = load('@/hooks/use-health-steps');
    shims['@/hooks/use-health-steps'] = { useHealthSteps: () => ({ steps: deviceSteps }), useHealthStepsSync };
  }
  const query = load('@tanstack/react-query');
  const qc = new query.QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000, gcTime: Infinity } } });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (seed) qc.setQueryData(['dashboard', 'full', timezone, '2026-10-04'], seed);
  const { DayPicker } = load('@/components/dashboard/DayPicker');
  shims['@/components/dashboard'] = { DayPicker, CalorieRing: 'CalorieRing', WeightSparkline: 'WeightSparkline', StepsTrendIcon: 'StepsTrendIcon', CoachBadge: 'CoachBadge', MacroBar: 'MacroBar', MealStatusBadge: 'MealStatusBadge' };
  const Component = load('@/app/(tabs)/dashboard').default;
  let r;
  const render = () => React.createElement(query.QueryClientProvider, { client: qc }, React.createElement(query.IsRestoringProvider, { value: restoring }, React.createElement(Component)));
  const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); };
  try { await act(async () => { r = create(render()); }); await settle(); }
  catch (error) { if (r) await act(async () => r.unmount()); qc.clear(); global.Date = OriginalDate; throw error; }
  const byId = id => r.root.findAll(n => typeof n.type === 'string' && n.props.testID === id)[0];
  const dot = date => byId(`home-day-${date}`).findAllByType('View').find(n => flatten(n.props.style).width === 3);
  return {
    r, qc, load, requests, routes, haptics, timezone, byId, settle,
    hasDot: date => flatten(dot(date).props.style).backgroundColor !== 'transparent',
    text: () => r.root.findAllByType('Text').map(n => n.props.children).flat(Infinity).filter(v => typeof v === 'string').join(' ').replace(/\s+/g, ' '),
    select: async date => { await act(async () => byId(`home-day-${date}`).props.onPress()); await settle(); },
    refresh: async () => { now += 100; await act(async () => r.root.findByType('ScrollView').props.refreshControl.props.onRefresh()); await settle(); },
    invalidate: async () => { now += 100; await act(async () => qc.invalidateQueries({ queryKey: ['dashboard'] })); await settle(); },
    restore: async () => { restoring = false; await act(async () => r.update(render())); await settle(); },
    advanceDay: async iso => { now = OriginalDate.parse(iso); await act(async () => { for (const listener of listeners) listener('active'); }); await settle(); },
    close: async () => { await act(async () => r.unmount()); qc.clear(); global.Date = OriginalDate; },
  };
}
module.exports = { screen, empty, meal, act, React, fixtureLoader, flatten };
