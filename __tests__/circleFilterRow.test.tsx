/**
 * HOME-003 (#840) — CircleFilterRow RNTL + a11y tests.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CircleFilterRow } from '../src/features/circles/CircleFilterRow';
import type { CircleLens } from '../src/features/circles/circleHomeFilter';

const CIRCLES: CircleLens[] = [
  { id: 'c1', name: 'Book Club', memberCount: 4 },
  { id: 'c2', name: 'Study Group', memberCount: 1 },
];

// Verdict / amplification tokens scanned over the rendered chip labels (not the
// serialized tree, whose boolean props would false-trip a bare "true"/"false").
const BANNED = [
  'winner', 'loser', 'liar', 'dishonest', 'bad faith',
  'popular', 'viral', 'trending', 'verdict', 'ranking',
];

describe('CircleFilterRow', () => {
  it('renders an All chip plus one chip per circle', () => {
    const { getByTestId } = render(
      <CircleFilterRow circles={CIRCLES} selectedCircleId={null} onSelect={jest.fn()} />,
    );
    expect(getByTestId('home-circle-filter-row')).toBeTruthy();
    expect(getByTestId('home-circle-chip-all')).toBeTruthy();
    expect(getByTestId('home-circle-chip-c1')).toBeTruthy();
    expect(getByTestId('home-circle-chip-c2')).toBeTruthy();
  });

  it('returns null (no empty shell) when there are no circles', () => {
    const { queryByTestId } = render(
      <CircleFilterRow circles={[]} selectedCircleId={null} onSelect={jest.fn()} />,
    );
    expect(queryByTestId('home-circle-filter-row')).toBeNull();
  });

  it('pressing a circle chip fires onSelect(id); pressing All fires onSelect(null)', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <CircleFilterRow circles={CIRCLES} selectedCircleId="c1" onSelect={onSelect} />,
    );
    fireEvent.press(getByTestId('home-circle-chip-c2'));
    expect(onSelect).toHaveBeenLastCalledWith('c2');
    fireEvent.press(getByTestId('home-circle-chip-all'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('tracks accessibilityState.selected against the current selection', () => {
    const { getByTestId } = render(
      <CircleFilterRow circles={CIRCLES} selectedCircleId="c1" onSelect={jest.fn()} />,
    );
    expect(getByTestId('home-circle-chip-c1').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('home-circle-chip-all').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('home-circle-chip-c2').props.accessibilityState.selected).toBe(false);
  });

  it('every chip is a 44px button with role + label + state', () => {
    const { getByTestId } = render(
      <CircleFilterRow circles={CIRCLES} selectedCircleId={null} onSelect={jest.fn()} />,
    );
    for (const id of ['home-circle-chip-all', 'home-circle-chip-c1', 'home-circle-chip-c2']) {
      const el = getByTestId(id);
      expect(el.props.accessibilityRole).toBe('button');
      expect(typeof el.props.accessibilityLabel).toBe('string');
      expect(el.props.accessibilityLabel.length).toBeGreaterThan(0);
      expect(el.props.accessibilityState).toHaveProperty('selected');
      expect(el.props.hitSlop).toBeTruthy();
      // 44px floor via the chip style's minHeight (flattened).
      const flat = Array.isArray(el.props.style)
        ? Object.assign({}, ...el.props.style.filter(Boolean))
        : el.props.style;
      expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('the selected chip carries non-color signals (check glyph + bold label)', () => {
    const view = render(
      <CircleFilterRow circles={CIRCLES} selectedCircleId="c1" onSelect={jest.fn()} />,
    );
    // A check glyph is rendered (on the selected chip) — a non-color signal.
    expect(JSON.stringify(view.toJSON())).toContain('✓');
    // Selection is also signaled by a heavier font weight (not color alone):
    // the selected label is bold vs the unselected one.
    const flat = (el: { props: { style: unknown } }) =>
      (Array.isArray(el.props.style)
        ? Object.assign({}, ...el.props.style.filter(Boolean))
        : el.props.style) as { fontWeight?: string };
    expect(flat(view.getByText('Book Club')).fontWeight).toBe('800'); // selected
    expect(flat(view.getByText('Study Group')).fontWeight).toBe('600'); // unselected
  });

  it('member count renders as a size, and no chip label carries a verdict token', () => {
    const { getByTestId } = render(
      <CircleFilterRow circles={CIRCLES} selectedCircleId={null} onSelect={jest.fn()} />,
    );
    // "4 members" size (plural) and "1 member" (singular).
    const c1Label = getByTestId('home-circle-chip-c1').props.accessibilityLabel as string;
    const c2Label = getByTestId('home-circle-chip-c2').props.accessibilityLabel as string;
    expect(c1Label).toContain('4 members');
    expect(c2Label).toContain('1 member');
    for (const label of [
      c1Label,
      c2Label,
      getByTestId('home-circle-chip-all').props.accessibilityLabel as string,
    ]) {
      for (const token of BANNED) expect(label.toLowerCase()).not.toContain(token);
    }
  });
});
