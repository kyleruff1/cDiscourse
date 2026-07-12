/**
 * ROOM-002 (#885) — ringsideFeedModel unit matrix (S1).
 *
 * Pure-model coverage: card projection, kind-color spine join, actor-aware
 * action-row derivation (reusing allowedControls + the injected observer set),
 * quote / proof / owed / branch-pill fields, active / latest / own flags,
 * the doctrine ban-list, and empty input.
 */
import {
  actorLabelFor,
  buildBranchPill,
  buildRingsideFeed,
  type RingsideFeedInput,
} from '../src/features/arguments/room/ringsideFeedModel';
import {
  getBubbleControlsForActor,
  type ArgumentBubbleActor,
  type ArgumentBubbleControl,
  type ArgumentBubbleViewModel,
  type TimelineKindColorFamily,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { getRailActions } from '../src/features/arguments/ArgumentSideActionRail';
import type { RailViewerRole } from '../src/features/arguments/railActionCategories';
import { deriveCallbackEcho } from '../src/features/arguments/crossRoom/callbackEchoModel';

// ── Fixtures ──────────────────────────────────────────────────

function makeVm(over: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  const actor: ArgumentBubbleActor = over.actor ?? 'other';
  return {
    messageId: over.messageId ?? 'm1',
    ordinal: over.ordinal ?? 1,
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? '2m ago',
    body: over.body ?? 'A plain move body.',
    kindLabel: over.kindLabel ?? 'claim',
    actor,
    sideLabel: over.sideLabel ?? 'Aff',
    isLatest: over.isLatest ?? false,
    isActive: over.isActive ?? false,
    parentHint: over.parentHint ?? null,
    qualifierBadges: over.qualifierBadges ?? [],
    pointStandingHint: over.pointStandingHint ?? null,
    allowedControls: over.allowedControls ?? getBubbleControlsForActor(actor),
    deletionRequested: over.deletionRequested ?? false,
  };
}

function makeInput(
  viewModels: ArgumentBubbleViewModel[],
  over: Partial<RingsideFeedInput> = {},
): RingsideFeedInput {
  return {
    viewModels,
    viewerRole: over.viewerRole ?? 'participant',
    activeMessageId: over.activeMessageId ?? null,
    kindColorFamilyFor: over.kindColorFamilyFor ?? (() => 'default'),
    descendantCountFor: over.descendantCountFor ?? (() => 0),
    parentMessageIdFor: over.parentMessageIdFor ?? (() => null),
    proofChipCountFor: over.proofChipCountFor ?? (() => 0),
    owedReceiptFor: over.owedReceiptFor ?? (() => false),
    observerActionsFor:
      over.observerActionsFor ?? ((actor) => getRailActions('observer', actor)),
    friendlyFlagCountFor: over.friendlyFlagCountFor,
    callbackEchoFor: over.callbackEchoFor,
  };
}

const KIND_COLOR: Record<TimelineKindColorFamily, string> = {
  claim: '#6366f1',
  challenge: '#f97316',
  evidence: '#06b6d4',
  clarify: '#f59e0b',
  concede: '#a855f7',
  flag: '#ef4444',
  default: '#475569',
};

// ── Kind-color spine matrix ───────────────────────────────────

describe('ringsideFeedModel — kind-color spine join', () => {
  for (const family of Object.keys(KIND_COLOR) as TimelineKindColorFamily[]) {
    it(`joins spineColor for the ${family} family from the timeline node`, () => {
      const feed = buildRingsideFeed(
        makeInput([makeVm({ messageId: 'm1' })], {
          kindColorFamilyFor: () => family,
        }),
      );
      expect(feed.cards[0].kindColorFamily).toBe(family);
      expect(feed.cards[0].spineColor).toBe(KIND_COLOR[family]);
    });
  }
});

// ── Actor → action row matrix ─────────────────────────────────

describe('ringsideFeedModel — actor-aware action row', () => {
  it('participant + self → participant controls [view_qualifiers, request_deletion]', () => {
    const vm = makeVm({ actor: 'self' });
    const feed = buildRingsideFeed(makeInput([vm], { viewerRole: 'participant' }));
    expect(feed.cards[0].actionRow).toEqual({
      kind: 'participant',
      controls: ['view_qualifiers', 'request_deletion'] as ArgumentBubbleControl[],
    });
    expect(feed.cards[0].isOwn).toBe(true);
  });

  it('participant + other → the full 7-control other set', () => {
    const vm = makeVm({ actor: 'other' });
    const feed = buildRingsideFeed(makeInput([vm], { viewerRole: 'participant' }));
    expect(feed.cards[0].actionRow).toEqual({
      kind: 'participant',
      controls: [
        'reply',
        'disagree',
        'flag',
        'ask_for_source',
        'ask_for_quote',
        'branch',
        'view_qualifiers',
      ] as ArgumentBubbleControl[],
    });
    expect(feed.cards[0].isOwn).toBe(false);
  });

  it('observer → the injected observer set [watch, join_aff, join_neg] (UX-PR-G #920 removed share)', () => {
    const vm = makeVm({ actor: 'other' });
    const feed = buildRingsideFeed(makeInput([vm], { viewerRole: 'observer' as RailViewerRole }));
    const row = feed.cards[0].actionRow;
    expect(row.kind).toBe('observer');
    if (row.kind === 'observer') {
      // UX-PR-G (#920) P1-12 — share removed (guaranteed no-op, no room URLs).
      expect(row.actions.map((a) => a.code)).toEqual(['watch', 'join_aff', 'join_neg']);
    }
  });

  it('own set drops request_deletion when the view-model reflects an open request', () => {
    const vm = makeVm({
      actor: 'self',
      allowedControls: getBubbleControlsForActor('self', { hasOpenDeletionRequest: true }),
      deletionRequested: true,
    });
    const feed = buildRingsideFeed(makeInput([vm], { viewerRole: 'participant' }));
    expect(feed.cards[0].actionRow).toEqual({
      kind: 'participant',
      controls: ['view_qualifiers'] as ArgumentBubbleControl[],
    });
    expect(feed.cards[0].deletionRequested).toBe(true);
  });
});

// ── Card field projection ─────────────────────────────────────

describe('ringsideFeedModel — card fields', () => {
  it('quoteChip is parentHint (null for a root move)', () => {
    const root = buildRingsideFeed(makeInput([makeVm({ messageId: 'm1', parentHint: null })]));
    expect(root.cards[0].quoteChip).toBeNull();
    const reply = buildRingsideFeed(
      makeInput([makeVm({ messageId: 'm2', parentHint: "replying to: 'narrow the scope'" })]),
    );
    expect(reply.cards[0].quoteChip).toBe("replying to: 'narrow the scope'");
  });

  it('parentMessageId is joined from the injected node lookup (null at root)', () => {
    const root = buildRingsideFeed(
      makeInput([makeVm({ messageId: 'm1' })], { parentMessageIdFor: () => null }),
    );
    expect(root.cards[0].parentMessageId).toBeNull();
    const reply = buildRingsideFeed(
      makeInput([makeVm({ messageId: 'm2' })], { parentMessageIdFor: () => 'm1' }),
    );
    expect(reply.cards[0].parentMessageId).toBe('m1');
  });

  it('proofChipCount comes from the injected artifact count', () => {
    const feed = buildRingsideFeed(
      makeInput([makeVm({ messageId: 'm1' })], { proofChipCountFor: () => 3 }),
    );
    expect(feed.cards[0].proofChipCount).toBe(3);
  });

  it('owedReceiptChip comes from the injected debt signal', () => {
    const feed = buildRingsideFeed(
      makeInput([makeVm({ messageId: 'm1' })], { owedReceiptFor: () => true }),
    );
    expect(feed.cards[0].owedReceiptChip).toBe(true);
  });

  it('branchPill is null at 0 descendants and plural / singular otherwise', () => {
    expect(buildBranchPill(0)).toBeNull();
    expect(buildBranchPill(1)).toEqual({ descendantCount: 1, label: '1 reply' });
    expect(buildBranchPill(4)).toEqual({ descendantCount: 4, label: '4 replies' });
    const feed = buildRingsideFeed(
      makeInput([makeVm({ messageId: 'm1' })], { descendantCountFor: () => 2 }),
    );
    expect(feed.cards[0].branchPill).toEqual({ descendantCount: 2, label: '2 replies' });
  });

  it('friendlyFlagCount defaults to 0 and reads the injected count when supplied', () => {
    const zero = buildRingsideFeed(makeInput([makeVm({ messageId: 'm1' })]));
    expect(zero.cards[0].friendlyFlagCount).toBe(0);
    const some = buildRingsideFeed(
      makeInput([makeVm({ messageId: 'm1' })], { friendlyFlagCountFor: () => 2 }),
    );
    expect(some.cards[0].friendlyFlagCount).toBe(2);
  });

  it('actorLabel is color-independent for every actor', () => {
    expect(actorLabelFor('self')).toBe('You');
    expect(actorLabelFor('other')).toBe('Other voice');
    expect(actorLabelFor('bot')).toBe('Bot');
    expect(actorLabelFor('admin')).toBe('Admin');
    expect(actorLabelFor('unknown')).toBe('Other voice');
  });

  it('propagates activeMessageId and per-card isActive / isLatest', () => {
    const feed = buildRingsideFeed(
      makeInput(
        [
          makeVm({ messageId: 'm1', ordinal: 1 }),
          makeVm({ messageId: 'm2', ordinal: 2, isActive: true }),
          makeVm({ messageId: 'm3', ordinal: 3, isLatest: true }),
        ],
        { activeMessageId: 'm2' },
      ),
    );
    expect(feed.activeMessageId).toBe('m2');
    expect(feed.cards.map((c) => c.isActive)).toEqual([false, true, false]);
    expect(feed.cards.map((c) => c.isLatest)).toEqual([false, false, true]);
  });
});

// ── Doctrine ban-list ─────────────────────────────────────────

describe('ringsideFeedModel — doctrine ban-list', () => {
  const BANNED = [
    'winner',
    'loser',
    'correct',
    'incorrect',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    'truth',
  ];

  it('no produced label contains a banned verdict token', () => {
    const feed = buildRingsideFeed(
      makeInput(
        [
          makeVm({ messageId: 'm1', actor: 'self' }),
          makeVm({ messageId: 'm2', actor: 'other' }),
        ],
        { descendantCountFor: () => 5, observerActionsFor: (a) => getRailActions('observer', a) },
      ),
    );
    const labels: string[] = [];
    for (const c of feed.cards) {
      labels.push(c.actorLabel, c.kindLabel, c.sideLabel);
      if (c.branchPill) labels.push(c.branchPill.label);
      if (c.actionRow.kind === 'observer') {
        for (const a of c.actionRow.actions) labels.push(a.label, a.helper);
      }
    }
    for (const label of labels) {
      for (const tok of BANNED) {
        expect(label.toLowerCase()).not.toContain(tok);
      }
    }
  });
});

// ── Empty / defensive input ───────────────────────────────────

describe('ringsideFeedModel — empty input', () => {
  it('empty view-models → empty cards + null active', () => {
    const feed = buildRingsideFeed(makeInput([]));
    expect(feed.cards).toEqual([]);
    expect(feed.activeMessageId).toBeNull();
  });

  it('null / malformed input → empty feed', () => {
    expect(buildRingsideFeed(null as unknown as RingsideFeedInput)).toEqual({
      cards: [],
      activeMessageId: null,
    });
  });
});

// ── QUOTE-FORGE-002 callback echo join ────────────────────────

describe('ringsideFeedModel — callbackEcho join (#842)', () => {
  const echoVm = deriveCallbackEcho({
    messageId: 'm1',
    ref: {
      targetDebateId: 'debate-prior-1',
      excerpt: 'An echoed prior line.',
      targetTitleSnapshot: 'Prior room',
      capturedFromArgumentId: null,
      v: 1,
    },
    link: { targetDebateId: 'debate-prior-1', accessState: 'authorized', title: 'Prior room' },
  });

  it('populates card.callbackEcho from the injected join', () => {
    const feed = buildRingsideFeed(
      makeInput([makeVm({ messageId: 'm1' })], {
        callbackEchoFor: (id) => (id === 'm1' ? echoVm : null),
      }),
    );
    expect(feed.cards[0].callbackEcho).toBe(echoVm);
  });

  it('defaults callbackEcho to null when no join is threaded (byte-identical)', () => {
    const feed = buildRingsideFeed(makeInput([makeVm({ messageId: 'm1' })]));
    expect(feed.cards[0].callbackEcho).toBeNull();
  });
});
