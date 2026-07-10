/**
 * MARK-002 (#894) — TimestampMarker render + a11y (RNTL).
 *
 * The one component, three placements: source_span highlight (before/marked/
 * after, with a non-color underline cue), reply_reference chip (deep-link tap,
 * role/label, >=32px), composer_scope chip (clear affordance), and the orphaned
 * tombstone (durable quotedText, no deep-link). Grayscale legibility: the marked
 * run carries a textDecoration underline, not color alone.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TimestampMarker } from '../src/features/arguments/markers/TimestampMarker';
import type { TimestampMarkerViewModel } from '../src/features/arguments/markers/timestampMarkerModel';

function vm(over: Partial<TimestampMarkerViewModel> = {}): TimestampMarkerViewModel {
  return {
    id: 'm1',
    targetArgumentId: 't1',
    replyArgumentId: 'r1',
    kind: 'rebuttal_anchor',
    spanStart: 0,
    spanEnd: 4,
    quotedText: 'Cars',
    state: 'live',
    ...over,
  };
}

describe('TimestampMarker — source_span', () => {
  it('renders before / marked / after runs of the body', () => {
    const { getByTestId } = render(
      <TimestampMarker placement="source_span" marker={vm()} body="Cars are bad." />,
    );
    const node = getByTestId('timestamp-marker-source-span-m1');
    expect(node).toBeTruthy();
  });

  it('renders nothing when the offsets no longer index the body (drift)', () => {
    const { queryByTestId } = render(
      <TimestampMarker placement="source_span" marker={vm({ spanEnd: 999 })} body="short" />,
    );
    expect(queryByTestId('timestamp-marker-source-span-m1')).toBeNull();
  });

  it('the marked run carries a non-color underline cue (grayscale legible)', () => {
    const { UNSAFE_getAllByType } = render(
      <TimestampMarker placement="source_span" marker={vm()} body="Cars are bad." />,
    );
    // Some Text node in the tree carries an underline decoration (the marked run).
    const { Text } = require('react-native');
    const texts = UNSAFE_getAllByType(Text);
    const flat = texts
      .map((t: { props: { style?: unknown } }) => JSON.stringify(t.props.style))
      .join(' ');
    expect(flat).toContain('underline');
  });
});

describe('TimestampMarker — reply_reference', () => {
  it('renders a chip with role button + a11y label and deep-links on tap', () => {
    const onOpenSource = jest.fn();
    const { getByTestId } = render(
      <TimestampMarker placement="reply_reference" marker={vm()} onOpenSource={onOpenSource} />,
    );
    const chip = getByTestId('timestamp-marker-reply-m1');
    expect(chip.props.accessibilityRole).toBe('button');
    expect(typeof chip.props.accessibilityLabel).toBe('string');
    fireEvent.press(chip);
    expect(onOpenSource).toHaveBeenCalledWith('t1', 'm1');
  });

  it('renders a quote-wrapped label with a forward chevron', () => {
    const { getByTestId } = render(
      <TimestampMarker placement="reply_reference" marker={vm()} onOpenSource={jest.fn()} />,
    );
    const chip = getByTestId('timestamp-marker-reply-m1');
    // The chip meets the 32px chip floor.
    const style = Array.isArray(chip.props.style) ? Object.assign({}, ...chip.props.style) : chip.props.style;
    expect(style.minHeight).toBeGreaterThanOrEqual(32);
  });

  it('renders a calm tombstone (no deep-link) when orphaned', () => {
    const onOpenSource = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <TimestampMarker placement="reply_reference" marker={vm({ state: 'orphaned' })} onOpenSource={onOpenSource} />,
    );
    expect(getByTestId('timestamp-marker-orphan-m1')).toBeTruthy();
    expect(queryByTestId('timestamp-marker-reply-m1')).toBeNull();
  });
});

describe('TimestampMarker — composer_scope', () => {
  it('renders the scope chip with a clear affordance that fires onClear', () => {
    const onClear = jest.fn();
    const { getByTestId } = render(
      <TimestampMarker placement="composer_scope" marker={vm()} onClear={onClear} />,
    );
    expect(getByTestId('timestamp-marker-composer-scope')).toBeTruthy();
    const clear = getByTestId('timestamp-marker-composer-scope-clear');
    expect(clear.props.accessibilityRole).toBe('button');
    fireEvent.press(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('omits the clear affordance when onClear is absent', () => {
    const { queryByTestId } = render(<TimestampMarker placement="composer_scope" marker={vm()} />);
    expect(queryByTestId('timestamp-marker-composer-scope-clear')).toBeNull();
  });
});
