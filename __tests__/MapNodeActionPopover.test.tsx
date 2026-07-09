/**
 * ROOM-004 (#886) — MapNodeActionPopover render + a11y (S2).
 *
 * RNTL spot checks: participant-other shows reply / disagree; observer shows
 * watch / join / share; own move shows Open Act and NO reply / disagree; every
 * action Pressable carries role + label + at least 44x44; dispatch fires the
 * injected code; reduce-motion snaps (no Animated in source).
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
import { getRailActions } from '../src/features/arguments/ArgumentSideActionRail';
import type { RailBubbleActor, RailViewerRole } from '../src/features/arguments/railActionCategories';

function surfaceFor(viewerRole: RailViewerRole, actor: RailBubbleActor) {
  const input: MapNodeActionSurfaceInput = {
    activeMessageId: 'm4',
    viewerRole,
    actor,
    actions: getRailActions(viewerRole, actor),
    actingOnShortLabel: 'Message 4',
    isOpenPointMember: false,
  };
  return buildMapNodeActionSurface(input);
}

function renderPopover(viewerRole: RailViewerRole, actor: RailBubbleActor) {
  const onAction = jest.fn();
  const onAnswerThis = jest.fn();
  const onOpenAct = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <MapNodeActionPopover
      surface={surfaceFor(viewerRole, actor)}
      onAction={onAction}
      onAnswerThis={onAnswerThis}
      onOpenAct={onOpenAct}
      onClose={onClose}
      reduceMotion
    />,
  );
  return { onAction, onAnswerThis, onOpenAct, onClose, ...utils };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s) }), {});
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

describe('MapNodeActionPopover — actor matrix', () => {
  it('participant-other renders reply + disagree', () => {
    const { getByTestId } = renderPopover('participant', 'other');
    expect(getByTestId('map-popover-action-reply-m4')).toBeTruthy();
    expect(getByTestId('map-popover-action-disagree-m4')).toBeTruthy();
  });

  it('observer renders watch / join / share', () => {
    const { getByTestId } = renderPopover('observer', 'other');
    for (const code of ['watch', 'join_aff', 'join_neg', 'share']) {
      expect(getByTestId(`map-popover-action-${code}-m4`)).toBeTruthy();
    }
  });

  it('own move shows Open Act and NO reply / disagree', () => {
    const { getByTestId, queryByTestId } = renderPopover('participant', 'self');
    expect(getByTestId('map-popover-open-act-m4')).toBeTruthy();
    expect(queryByTestId('map-popover-action-reply-m4')).toBeNull();
    expect(queryByTestId('map-popover-action-disagree-m4')).toBeNull();
  });
});

describe('MapNodeActionPopover — a11y + dispatch', () => {
  it('every action chip has role + label + at least 44x44', () => {
    const { getByTestId } = renderPopover('participant', 'other');
    for (const code of ['reply', 'disagree']) {
      const chip = getByTestId(`map-popover-action-${code}-m4`);
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

  it('dispatches the injected action code, Answer this, and Close', () => {
    const { getByTestId, onAction, onAnswerThis, onClose } = renderPopover('participant', 'other');
    fireEvent.press(getByTestId('map-popover-action-reply-m4'));
    expect(onAction).toHaveBeenCalledWith('reply');
    fireEvent.press(getByTestId('map-popover-answer-this-m4'));
    expect(onAnswerThis).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('map-popover-close-m4'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('own-move Open Act dispatches onOpenAct', () => {
    const { getByTestId, onOpenAct } = renderPopover('participant', 'self');
    fireEvent.press(getByTestId('map-popover-open-act-m4'));
    expect(onOpenAct).toHaveBeenCalledTimes(1);
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
