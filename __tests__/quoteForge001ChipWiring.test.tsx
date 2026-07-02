/**
 * QUOTE-FORGE-001 — chip-wiring integration test (RNTL).
 *
 * Proves the previously-dark wire is lit: ArgumentGameSurface in timeline
 * mode forwards linkedPriorChips into the already-wired ArgumentTimelineMap
 * seams, the chip row renders, onOpenLinkedPrior fires with the link id on
 * an authorized Open, and the create affordance renders when onOpenLinkPicker
 * is supplied. Empty chips render no row (calm default).
 *
 * Mocks mirror ArgumentGameSurface.integration.test.tsx.
 */
import React from 'react';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    SUPABASE_CONFIGURED: true,
    supabase: {
      ...actual.supabase,
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
  };
});

jest.mock('../src/features/arguments/useConstitution', () => {
  const c = jest.requireActual('../src/domain/constitution');
  return {
    useConstitution: () => ({
      loading: false,
      error: null,
      source: 'local_fallback',
      activeConstitution: c.constitutionVersion,
      activeRules: c.constitutionRules,
      tagDefinitions: c.tagDefinitions,
      flagDefinitions: c.flagDefinitions,
    }),
  };
});

import { render, fireEvent } from '@testing-library/react-native';
import { ArgumentGameSurface } from '../src/features/arguments/ArgumentGameSurface';
import type { ArgumentMessageInput } from '../src/features/arguments/argumentGameSurfaceModel';
import {
  buildLinkedPriorArgumentChip,
  type ArgumentRoomLink,
  type LinkedPriorArgumentChip,
} from '../src/features/arguments/crossRoom/linkedPriorArgumentModel';

const DEBATE_ID = 'd-qf-001';
const RESOLUTION = 'The city should fund weeknight library hours.';

function buildMessages(): ArgumentMessageInput[] {
  return [
    {
      id: 'm1',
      debateId: DEBATE_ID,
      parentId: null,
      authorId: 'u-host',
      argumentType: 'opening_statement',
      side: 'affirmative',
      body: 'Weeknight library hours raise civic participation in the surrounding ward.',
      status: 'posted',
      createdAt: '2026-06-25T12:00:00.000Z',
      updatedAt: '2026-06-25T12:00:00.000Z',
    },
    {
      id: 'm2',
      debateId: DEBATE_ID,
      parentId: 'm1',
      authorId: 'u-other',
      argumentType: 'rebuttal',
      side: 'negative',
      body: 'Weeknight visits in the quarterly report are concentrated on weekends.',
      status: 'posted',
      createdAt: '2026-06-25T12:05:00.000Z',
      updatedAt: '2026-06-25T12:05:00.000Z',
    },
  ];
}

function link(over: Partial<ArgumentRoomLink> = {}): ArgumentRoomLink {
  return {
    id: over.id ?? 'link-1',
    sourceDebateId: DEBATE_ID,
    targetDebateId: over.targetDebateId ?? 'room-prior',
    createdBy: 'user-a',
    targetTitleSnapshot: over.targetTitleSnapshot ?? 'A settled prior argument',
    note: over.note ?? '',
    isRemoved: false,
    createdAt: '2026-05-01T00:00:00.000Z',
  };
}

function authorizedChip(id = 'link-1'): LinkedPriorArgumentChip {
  return buildLinkedPriorArgumentChip({
    link: link({ id }),
    priorRoomSummary: { liveTitle: 'A settled prior argument', moveCount: 3, resolvedTangentCount: 0 },
    viewerAccess: 'authorized',
  });
}

describe('QUOTE-FORGE-001 — chip wiring', () => {
  it('renders the linked-prior chip row in timeline mode when chips exist', () => {
    const { getByTestId } = render(
      <ArgumentGameSurface
        debate={{ id: DEBATE_ID, title: 'Weeknight hours', rootBody: RESOLUTION }}
        messages={buildMessages()}
        currentUserId="u-host"
        initialMode="timeline"
        reduceMotionOverride
        linkedPriorChips={[authorizedChip()]}
      />,
    );
    expect(getByTestId('argument-timeline-map')).toBeTruthy();
    expect(getByTestId('linked-prior-chip-row')).toBeTruthy();
    expect(getByTestId('linked-prior-chip-link-1')).toBeTruthy();
  });

  it('fires onOpenLinkedPrior with the link id when an authorized Open is pressed', () => {
    const onOpenLinkedPrior = jest.fn();
    const { getByTestId } = render(
      <ArgumentGameSurface
        debate={{ id: DEBATE_ID, title: 'Weeknight hours', rootBody: RESOLUTION }}
        messages={buildMessages()}
        currentUserId="u-host"
        initialMode="timeline"
        reduceMotionOverride
        linkedPriorChips={[authorizedChip('link-42')]}
        onOpenLinkedPrior={onOpenLinkedPrior}
      />,
    );
    fireEvent.press(getByTestId('linked-prior-action-open_prior-link-42'));
    expect(onOpenLinkedPrior).toHaveBeenCalledWith('link-42');
  });

  it('renders NO chip row when linkedPriorChips is empty (calm default)', () => {
    const { queryByTestId } = render(
      <ArgumentGameSurface
        debate={{ id: DEBATE_ID, title: 'Weeknight hours', rootBody: RESOLUTION }}
        messages={buildMessages()}
        currentUserId="u-host"
        initialMode="timeline"
        reduceMotionOverride
        linkedPriorChips={[]}
      />,
    );
    expect(queryByTestId('argument-timeline-map')).toBeTruthy();
    expect(queryByTestId('linked-prior-chip-row')).toBeNull();
  });

  it('renders the create-link affordance only when onOpenLinkPicker is supplied', () => {
    const onOpenLinkPicker = jest.fn();
    const { getByTestId, queryByTestId, rerender } = render(
      <ArgumentGameSurface
        debate={{ id: DEBATE_ID, title: 'Weeknight hours', rootBody: RESOLUTION }}
        messages={buildMessages()}
        currentUserId="u-host"
        initialMode="timeline"
        reduceMotionOverride
      />,
    );
    expect(queryByTestId('link-target-create-affordance-entry')).toBeNull();

    rerender(
      <ArgumentGameSurface
        debate={{ id: DEBATE_ID, title: 'Weeknight hours', rootBody: RESOLUTION }}
        messages={buildMessages()}
        currentUserId="u-host"
        initialMode="timeline"
        reduceMotionOverride
        onOpenLinkPicker={onOpenLinkPicker}
      />,
    );
    const affordance = getByTestId('link-target-create-affordance-entry');
    expect(affordance).toBeTruthy();
    fireEvent.press(affordance);
    expect(onOpenLinkPicker).toHaveBeenCalled();
  });
});
