/**
 * ROOM-004 (#886) — MapNodeActionPopover render + a11y (S2).
 *
 * RNTL: the popover MIRRORS the Ringside card. Participant-other shows the FULL
 * 7-control allowedControls set (dispatched through onControl); own node shows
 * view_qualifiers + request_deletion only; observer shows watch / join / share
 * (dispatched through onAction). Every action target carries role + label + at
 * least 44x44; reduce-motion snaps (no Animated in source).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MapNodeActionPopover } from '../src/features/arguments/room/MapNodeActionPopover';
import {
  buildMapNodeActionSurface,
  type MapNodeActionSurfaceInput,
} from '../src/features/arguments/room/mapNodeActionSurfaceModel';
import { getBubbleControlsForActor } from '../src/features/arguments/argumentGameSurfaceModel';
import { getRailActions } from '../src/features/arguments/ArgumentSideActionRail';
import type { RailBubbleActor, RailViewerRole } from '../src/features/arguments/railActionCategories';

function surfaceFor(viewerRole: RailViewerRole, actor: RailBubbleActor) {
  const input: MapNodeActionSurfaceInput = {
    activeMessageId: 'm4',
    viewerRole,
    actor,
    participantControls: getBubbleControlsForActor(actor),
    observerActions: getRailActions('observer', actor),
    actingOnShortLabel: 'Message 4',
    isOpenPointMember: false,
  };
  return buildMapNodeActionSurface(input);
}

function renderPopover(viewerRole: RailViewerRole, actor: RailBubbleActor) {
  const onControl = jest.fn();
  const onAction = jest.fn();
  const onAnswerThis = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <MapNodeActionPopover
      surface={surfaceFor(viewerRole, actor)}
      onControl={onControl}
      onAction={onAction}
      onAnswerThis={onAnswerThis}
      onClose={onClose}
      reduceMotion
    />,
  );
  return { onControl, onAction, onAnswerThis, onClose, ...utils };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {});
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

describe('MapNodeActionPopover — actor matrix mirrors the Ringside card', () => {
  it('participant-other renders the FULL 7-control set (not just reply/disagree)', () => {
    const { getByTestId } = renderPopover('participant', 'other');
    for (const control of [
      'reply',
      'disagree',
      'flag',
      'ask_for_source',
      'ask_for_quote',
      'branch',
      'view_qualifiers',
    ]) {
      expect(getByTestId(`map-popover-control-${control}-m4`)).toBeTruthy();
    }
  });

  it('participant-self (own node) renders view_qualifiers + request_deletion ONLY', () => {
    const { getByTestId, queryByTestId } = renderPopover('participant', 'self');
    expect(getByTestId('map-popover-control-view_qualifiers-m4')).toBeTruthy();
    expect(getByTestId('map-popover-control-request_deletion-m4')).toBeTruthy();
    expect(queryByTestId('map-popover-control-reply-m4')).toBeNull();
    expect(queryByTestId('map-popover-control-disagree-m4')).toBeNull();
    expect(queryByTestId('map-popover-control-flag-m4')).toBeNull();
  });

  it('observer renders watch / join / share', () => {
    const { getByTestId } = renderPopover('observer', 'other');
    for (const code of ['watch', 'join_aff', 'join_neg', 'share']) {
      expect(getByTestId(`map-popover-action-${code}-m4`)).toBeTruthy();
    }
  });
});

describe('MapNodeActionPopover — a11y + dispatch', () => {
  it('every participant chip has role + label + at least 44x44', () => {
    const { getByTestId } = renderPopover('participant', 'other');
    for (const control of ['reply', 'disagree', 'flag']) {
      const chip = getByTestId(`map-popover-control-${control}-m4`);
      const style = flattenStyle(chip.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
      expect(chip.props.accessibilityRole).toBe('button');
      expect((chip.props.accessibilityLabel as string).length).toBeGreaterThan(0);
    }
    const answer = getByTestId('map-popover-answer-this-m4');
    expect(flattenStyle(answer.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(answer.props.accessibilityLabel).toBe('Answer this');
  });

  it('participant controls dispatch onControl; Answer this + Close fire their handlers', () => {
    const { getByTestId, onControl, onAnswerThis, onClose } = renderPopover('participant', 'other');
    fireEvent.press(getByTestId('map-popover-control-flag-m4'));
    expect(onControl).toHaveBeenCalledWith('flag');
    fireEvent.press(getByTestId('map-popover-answer-this-m4'));
    expect(onAnswerThis).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('map-popover-close-m4'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('observer actions dispatch onAction (handleRailAction path)', () => {
    const { getByTestId, onAction } = renderPopover('observer', 'other');
    fireEvent.press(getByTestId('map-popover-action-join_aff-m4'));
    expect(onAction).toHaveBeenCalledWith('join_aff');
  });

  it('is band-free and reduce-motion safe (no Animated / no band chips in source)', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/arguments/room/MapNodeActionPopover.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/\bAnimated\b/);
    expect(src).not.toMatch(/standingBand|toneBand|temperatureBand|StrengthBand/);
  });
});
