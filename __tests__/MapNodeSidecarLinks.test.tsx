/**
 * ROOM-004 (#886) — MapNodeSidecarLinks render + a11y (S2).
 *
 * Answer this + Open disagreement points are real buttons at 44x44; the
 * open-point membership line is display-only text (no button role) and renders
 * nothing for a settled node.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MapNodeSidecarLinks } from '../src/features/arguments/room/MapNodeSidecarLinks';
import {
  buildMapNodeActionSurface,
  type MapNodeActionSurfaceInput,
} from '../src/features/arguments/room/mapNodeActionSurfaceModel';
import { getRailActions } from '../src/features/arguments/ArgumentSideActionRail';

function surfaceFor(isOpenPointMember: boolean) {
  const input: MapNodeActionSurfaceInput = {
    activeMessageId: 'm4',
    viewerRole: 'participant',
    actor: 'other',
    actions: getRailActions('participant', 'other'),
    actingOnShortLabel: 'Message 4',
    isOpenPointMember,
  };
  return buildMapNodeActionSurface(input);
}

function renderLinks(isOpenPointMember: boolean) {
  const onAnswerThis = jest.fn();
  const onOpenDebts = jest.fn();
  const utils = render(
    <MapNodeSidecarLinks
      surface={surfaceFor(isOpenPointMember)}
      onAnswerThis={onAnswerThis}
      onOpenDebts={onOpenDebts}
      reduceMotion
    />,
  );
  return { onAnswerThis, onOpenDebts, ...utils };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {});
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

describe('MapNodeSidecarLinks', () => {
  it('Answer this + Open disagreement points are buttons at 44x44', () => {
    const { getByTestId } = renderLinks(true);
    for (const id of ['map-sidecar-answer-this', 'map-sidecar-open-debts']) {
      const link = getByTestId(id);
      expect(link.props.accessibilityRole).toBe('button');
      const style = flattenStyle(link.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    }
  });

  it('dispatches Answer this and Open disagreement points', () => {
    const { getByTestId, onAnswerThis, onOpenDebts } = renderLinks(true);
    fireEvent.press(getByTestId('map-sidecar-answer-this'));
    expect(onAnswerThis).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('map-sidecar-open-debts'));
    expect(onOpenDebts).toHaveBeenCalledTimes(1);
  });

  it('the membership line is display-only text (no button role)', () => {
    const { getByTestId } = renderLinks(true);
    const line = getByTestId('map-sidecar-point-membership');
    expect(line.props.accessibilityRole).not.toBe('button');
    expect(line.props.children).toBe('Part of an open point');
  });

  it('renders nothing for the membership line on a settled node', () => {
    const { queryByTestId } = renderLinks(false);
    expect(queryByTestId('map-sidecar-point-membership')).toBeNull();
  });
});
