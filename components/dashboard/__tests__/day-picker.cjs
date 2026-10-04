const { test } = require('node:test');
const assert = require('node:assert/strict');
const deps = require('node:module').createRequire(require('node:path').join(process.env.MEAL_UI_TEST_DEPS, 'package.json'));
const { create } = deps('react-test-renderer');
const { React, act, fixtureLoader, flatten } = require('./date-history-harness.cjs');

test('DayPicker marks only logged activity, separately from selected-day styling and accessibility', async () => {
  const selections = [], haptics = [];
  const load = fixtureLoader({ react: React, 'react/jsx-runtime': deps('react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x } },
    '@/lib/haptics': { haptic: { selection: () => haptics.push('selection') } },
  });
  const { DayPicker } = load('@/components/dashboard/DayPicker');
  const { color } = load('@/lib/tokens');
  const dayOptions = [{ date: '2026-10-03', dayNum: '3', dayLabel: 'S' }, { date: '2026-10-04', dayNum: '4', dayLabel: 'S' }];
  const render = selectedDate => React.createElement(DayPicker, { dayOptions, selectedDate, loggedDates: new Set(['2026-10-03']), onSelectDate: d => selections.push(d) });
  let r;
  await act(async () => { r = create(render('2026-10-04')); });
  const button = date => r.root.findAllByType('Pressable').find(n => n.props.testID === `home-day-${date}`);
  const dotColor = date => flatten(button(date).findByType('View').props.style).backgroundColor;
  try {
    assert.equal(dotColor('2026-10-04'), 'transparent', 'selection alone must not paint a logging dot');
    assert.equal(flatten(button('2026-10-04').props.style).backgroundColor, color.accent, 'selection stays green');
    assert.deepEqual(button('2026-10-04').props.accessibilityState, { selected: true });
    assert.doesNotMatch(button('2026-10-04').props.accessibilityLabel, /logged activity/i);
    assert.match(button('2026-10-03').props.accessibilityLabel, /Saturday, October 3.*logged activity/i);
    assert.equal(dotColor('2026-10-03'), color.accent);
    await act(async () => button('2026-10-03').props.onPress());
    assert.deepEqual(selections, ['2026-10-03']);
    assert.deepEqual(haptics, ['selection']);
    await act(async () => r.update(render('2026-10-03')));
    assert.equal(dotColor('2026-10-03'), color.accentInk, 'logged selected dot is visible on green');
    assert.equal(dotColor('2026-10-04'), 'transparent');
    assert.deepEqual(button('2026-10-03').props.accessibilityState, { selected: true });
  } finally { await act(async () => r.unmount()); }
});
