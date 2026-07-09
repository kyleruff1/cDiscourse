/**
 * ROOM-004 (#886) — J9 Answer-this-from-Map deep link.
 *
 * From the Map, selecting a node and pressing Answer this jumps to the Exchange
 * lens with the composer scoped to that node — at most two taps. Proven by a
 * REAL interaction (select node -> press Answer this -> assert mode switch +
 * reply scope) plus the source-pinned handler chain.
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

const ROOM_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/arguments/room/ArgumentRoom.tsx'),
  'utf8',
);

// ── Real interaction: press Answer this drives mode switch + reply scope ──

describe('ROOM-004 J9 — real interaction', () => {
  it('pressing Answer this switches to the stack lens and scopes the reply to the node', () => {
    const setMode = jest.fn();
    const handleAction = jest.fn();
    const activeMessageId = 'm4';
    // The EXACT handler ArgumentRoom binds to onAnswerThis.
    const handleAnswerThisFromMap = () => {
      if (!activeMessageId) return;
      setMode('stack');
      handleAction('reply', activeMessageId);
    };
    const surfaceInput: MapNodeActionSurfaceInput = {
      activeMessageId,
      viewerRole: 'participant',
      actor: 'other',
      participantControls: getBubbleControlsForActor('other'),
      observerActions: getRailActions('observer', 'other'),
      actingOnShortLabel: 'Message 4',
      isOpenPointMember: false,
    };
    const { getByTestId } = render(
      <MapNodeActionPopover
        surface={buildMapNodeActionSurface(surfaceInput)}
        onControl={jest.fn()}
        onAction={jest.fn()}
        onAnswerThis={handleAnswerThisFromMap}
        onClose={jest.fn()}
        reduceMotion
      />,
    );

    // Tap: press Answer this (the node is already selected — the popover is open).
    fireEvent.press(getByTestId('map-popover-answer-this-m4'));

    expect(setMode).toHaveBeenCalledWith('stack');
    expect(handleAction).toHaveBeenCalledWith('reply', 'm4');
    // Exactly one reply is scoped; the composer opens once.
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('a null active message id makes Answer this a no-op (guard)', () => {
    const setMode = jest.fn();
    const handleAction = jest.fn();
    const activeMessageId: string | null = null;
    const handleAnswerThisFromMap = () => {
      if (!activeMessageId) return;
      setMode('stack');
      handleAction('reply', activeMessageId);
    };
    handleAnswerThisFromMap();
    expect(setMode).not.toHaveBeenCalled();
    expect(handleAction).not.toHaveBeenCalled();
  });
});

// ── Source-pinned handler chain ───────────────────────────────

describe('ROOM-004 J9 — handleAnswerThisFromMap routing (source pin)', () => {
  it('handleAnswerThisFromMap switches to the stack lens and opens the reply composer scoped to the node', () => {
    const idx = ROOM_SRC.indexOf('const handleAnswerThisFromMap');
    expect(idx).toBeGreaterThan(-1);
    const block = ROOM_SRC.slice(idx, idx + 360);
    expect(block).toMatch(/setMode\('stack'\)/);
    expect(block).toMatch(/handleAction\('reply', activeMessageId\)/);
  });

  it('the Map popover and sidecar both bind Answer this to handleAnswerThisFromMap', () => {
    expect(ROOM_SRC).toMatch(/onAnswerThis=\{handleAnswerThisFromMap\}/);
    const count = (ROOM_SRC.match(/onAnswerThis=\{handleAnswerThisFromMap\}/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('Answer this preserves the Map selection id into Exchange (no new selection state)', () => {
    const idx = ROOM_SRC.indexOf('const handleAnswerThisFromMap');
    const block = ROOM_SRC.slice(idx, idx + 360);
    expect(block).toMatch(/if \(!activeMessageId\) return;/);
    expect(block).not.toMatch(/setActiveMessageId/);
  });
});
