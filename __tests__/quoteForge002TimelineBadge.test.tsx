/**
 * QUOTE-FORGE-002 (#842) — Timeline node callback badge.
 *
 * Renders ArgumentTimelineMap with a deterministic map + a callback echo map;
 * asserts the corner badge appears only on callback nodes and the node a11y
 * label gains the callback fragment (never the excerpt) only there.
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
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    },
  };
});

import { render } from '@testing-library/react-native';
import { ArgumentTimelineMap } from '../src/features/arguments/ArgumentTimelineMap';
import {
  buildArgumentTimelineMap,
  type ArgumentTimelineMapMessageInput,
} from '../src/features/arguments/argumentGameSurfaceModel';
import {
  deriveCallbackEcho,
  type CallbackEchoViewModel,
} from '../src/features/arguments/crossRoom/callbackEchoModel';

function isoAt(ms: number): string {
  return new Date(1715000000000 + ms).toISOString();
}

function msg(p: Partial<ArgumentTimelineMapMessageInput> & { id: string }): ArgumentTimelineMapMessageInput {
  return {
    id: p.id,
    debateId: 'd-qf002',
    parentId: p.parentId ?? null,
    authorId: 'author-a',
    argumentType: p.argumentType ?? 'claim',
    side: p.side ?? 'affirmative',
    body: p.body ?? 'A claim body.',
    status: 'posted',
    createdAt: p.createdAt ?? isoAt(0),
    updatedAt: p.createdAt ?? isoAt(0),
    isBot: false,
    qualifierLabels: [],
    flagCodes: [],
    tagCodes: [],
    topicScore: null,
    hasEvidence: false,
  };
}

const EXCERPT = 'Protected lanes reduce collisions on arterials.';

function echoFor(messageId: string): CallbackEchoViewModel {
  return deriveCallbackEcho({
    messageId,
    ref: {
      targetDebateId: 'debate-prior-1',
      excerpt: EXCERPT,
      targetTitleSnapshot: 'Bike-lane baseline',
      capturedFromArgumentId: null,
      v: 1,
    },
    link: { targetDebateId: 'debate-prior-1', accessState: 'authorized', title: 'Bike-lane baseline' },
  })!;
}

function buildMap() {
  return buildArgumentTimelineMap({
    messages: [
      msg({ id: 'm1', argumentType: 'opening_statement', createdAt: isoAt(0) }),
      msg({ id: 'm2', parentId: 'm1', argumentType: 'rebuttal', side: 'negative', createdAt: isoAt(1000) }),
    ],
    currentUserId: 'author-a',
    activeMessageId: 'm2',
  });
}

const baseProps = {
  onActivate: jest.fn(),
  onPrev: jest.fn(),
  onNext: jest.fn(),
  onJumpLatest: jest.fn(),
  reduceMotionOverride: true as const,
};

describe('QUOTE-FORGE-002 timeline badge', () => {
  it('renders the badge only on the callback node', () => {
    // The badge is accessibility-hidden (decorative; the node a11y label carries
    // the callback fragment), so queries must include hidden elements — the
    // receipt-mark pattern in ArgumentTimelineMap.test.tsx.
    const { getByTestId, queryByTestId } = render(
      <ArgumentTimelineMap {...baseProps} map={buildMap()} callbackEchoByMessageId={{ m2: echoFor('m2') }} />,
    );
    expect(getByTestId('timeline-node-callback-m2', { includeHiddenElements: true })).toBeTruthy();
    expect(queryByTestId('timeline-node-callback-m1', { includeHiddenElements: true })).toBeNull();
  });

  it('renders no badge when no echo map is threaded (byte-identical)', () => {
    const { queryByTestId } = render(<ArgumentTimelineMap {...baseProps} map={buildMap()} />);
    expect(queryByTestId('timeline-node-callback-m2', { includeHiddenElements: true })).toBeNull();
  });

  it('appends the callback a11y fragment on the callback node only, never the excerpt', () => {
    const { getAllByRole } = render(
      <ArgumentTimelineMap {...baseProps} map={buildMap()} callbackEchoByMessageId={{ m2: echoFor('m2') }} />,
    );
    // Node Pressables carry a "... of N ..." position fragment unique to node labels.
    const nodeLabels = getAllByRole('button')
      .map((b) => (b.props as { accessibilityLabel?: string }).accessibilityLabel ?? '')
      .filter((label) => /\bof\s+\d+\b/.test(label));
    expect(nodeLabels.length).toBe(2);
    const withCallback = nodeLabels.filter((l) => l.includes('callback to a prior argument'));
    expect(withCallback.length).toBe(1);
    for (const label of nodeLabels) {
      expect(label).not.toContain(EXCERPT);
    }
  });
});
