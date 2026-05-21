/**
 * SC-002 — Timeline node popover model tests.
 *
 * Pure-TS tests for the popover view-model builder, the tap-effect
 * dispatcher, and the action-set parity with the side rail.
 */
import {
  buildTimelineNodePopoverModel,
  decideInfoIconEffect,
  decideNodeTapEffect,
} from '../src/features/arguments/timelineNodePopoverModel';
import {
  getBubbleControlsForActor,
  type ArgumentBubbleActor,
  type ArgumentTimelineMapNode,
} from '../src/features/arguments/argumentGameSurfaceModel';

function fakeNode(partial: Partial<ArgumentTimelineMapNode> & { messageId: string }): ArgumentTimelineMapNode {
  return {
    messageId: partial.messageId,
    parentId: partial.parentId ?? null,
    ordinal: partial.ordinal ?? 1,
    createdAt: partial.createdAt ?? '2026-05-18T00:00:00Z',
    createdAtLabel: partial.createdAtLabel ?? '2026-05-18 00:00',
    relativeLabel: partial.relativeLabel ?? 'just now',
    actorLabel: partial.actorLabel ?? 'You',
    kindLabel: partial.kindLabel ?? 'Claim',
    sideLabel: partial.sideLabel ?? '—',
    bodyPreview: partial.bodyPreview ?? 'A short body preview.',
    badges: partial.badges ?? [],
    droppedTags: partial.droppedTags ?? [],
    depth: partial.depth ?? 0,
    lane: partial.lane ?? 0,
    siblingIndex: partial.siblingIndex ?? 0,
    replyCount: partial.replyCount ?? 0,
    descendantCount: partial.descendantCount ?? 0,
    branchId: partial.branchId ?? 'branch-root',
    branchRootMessageId: partial.branchRootMessageId ?? partial.messageId,
    junctionGroupId: partial.junctionGroupId ?? null,
    isJunction: partial.isJunction ?? false,
    junctionChildCount: partial.junctionChildCount ?? 0,
    isActive: partial.isActive ?? true,
    isLatest: partial.isLatest ?? true,
    isDetached: partial.isDetached ?? false,
    isActivePath: partial.isActivePath ?? true,
    isRoot: partial.isRoot ?? true,
    isFirstRebuttal: partial.isFirstRebuttal ?? false,
    standingBand: partial.standingBand ?? 'neutral',
    toneBand: partial.toneBand ?? 'calm',
    temperatureBand: partial.temperatureBand ?? 'cool',
    kindColor: partial.kindColor ?? '#6366f1',
    kindColorFamily: partial.kindColorFamily ?? 'claim',
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    accessibilityLabel: partial.accessibilityLabel ?? 'Message 1',
  };
}

describe('SC-002 buildTimelineNodePopoverModel', () => {
  it('returns null when node is missing', () => {
    expect(buildTimelineNodePopoverModel({
      node: null as unknown as ArgumentTimelineMapNode,
      actor: 'other',
      totalCount: 1,
    })).toBeNull();
  });

  it('builds a popover model with header / preview / standing / actions for a non-own bubble', () => {
    const node = fakeNode({ messageId: 'm1', ordinal: 3, kindLabel: 'Rebuttal', sideLabel: 'For' });
    const model = buildTimelineNodePopoverModel({ node, actor: 'other', totalCount: 7 });
    expect(model).not.toBeNull();
    expect(model!.messageId).toBe('m1');
    expect(model!.headerLine).toBe('Message 3 of 7 · Rebuttal · For');
    expect(model!.bodyPreview).toBe('A short body preview.');
    expect(model!.standingLabel).toMatch(/\sNeutral$/);
    expect(model!.toneBand).toBe('calm');
    expect(model!.temperatureBand).toBe('cool');
    expect(model!.isOwn).toBe(false);
  });

  it('action set for non-own bubble matches getBubbleControlsForActor("other")', () => {
    const node = fakeNode({ messageId: 'm1' });
    const model = buildTimelineNodePopoverModel({ node, actor: 'other', totalCount: 1 });
    expect(model!.actions).toEqual(getBubbleControlsForActor('other'));
  });

  it('action set for OWN bubble is locked to view_qualifiers + request_deletion', () => {
    const node = fakeNode({ messageId: 'm1' });
    const model = buildTimelineNodePopoverModel({ node, actor: 'self', totalCount: 1 });
    expect(model!.isOwn).toBe(true);
    expect(model!.actions).toEqual(['view_qualifiers', 'request_deletion']);
  });

  it('OWN bubble never exposes edit / disagree / flag / score', () => {
    const node = fakeNode({ messageId: 'm1' });
    const model = buildTimelineNodePopoverModel({ node, actor: 'self', totalCount: 1 });
    const forbidden = ['reply', 'disagree', 'flag', 'ask_for_source', 'ask_for_quote', 'branch'];
    for (const c of forbidden) {
      expect(model!.actions).not.toContain(c);
    }
  });

  it('respects controlsContext.hasOpenDeletionRequest by dropping request_deletion for own bubble', () => {
    const node = fakeNode({ messageId: 'm1' });
    const model = buildTimelineNodePopoverModel({
      node,
      actor: 'self',
      totalCount: 1,
      controlsContext: { hasOpenDeletionRequest: true },
    });
    expect(model!.actions).toEqual(['view_qualifiers']);
  });

  it('omits side fragment from header when sideLabel is the placeholder dash', () => {
    const node = fakeNode({ messageId: 'm1', ordinal: 1, kindLabel: 'Thesis', sideLabel: '—' });
    const model = buildTimelineNodePopoverModel({ node, actor: 'other', totalCount: 1 });
    expect(model!.headerLine).toBe('Message 1 of 1 · Thesis');
  });

  it('caps body preview defensively', () => {
    const long = 'x'.repeat(500);
    const node = fakeNode({ messageId: 'm1', bodyPreview: long });
    const model = buildTimelineNodePopoverModel({ node, actor: 'other', totalCount: 1 });
    expect(model!.bodyPreview.length).toBeLessThanOrEqual(240);
  });

  it('accessibility label names own vs other bubbles in plain language', () => {
    const ownModel = buildTimelineNodePopoverModel({ node: fakeNode({ messageId: 'm1' }), actor: 'self', totalCount: 1 });
    const otherModel = buildTimelineNodePopoverModel({ node: fakeNode({ messageId: 'm2' }), actor: 'other', totalCount: 1 });
    expect(ownModel!.accessibilityLabel).toMatch(/your message/);
    expect(otherModel!.accessibilityLabel).toMatch(/reply from another participant/);
  });

  it('parity check: popover actions match side-rail actions for every actor', () => {
    const actors: ArgumentBubbleActor[] = ['self', 'other', 'admin', 'bot', 'unknown'];
    for (const a of actors) {
      const node = fakeNode({ messageId: 'm1' });
      const model = buildTimelineNodePopoverModel({ node, actor: a, totalCount: 1 });
      expect(model!.actions).toEqual(getBubbleControlsForActor(a));
    }
  });

  it('header line contains no internal codes / verdict tokens', () => {
    const forbidden = /\b(winner|loser|truth|liar|dishonest|extremist|propagandist|topic_satisfaction|evidence_debt)\b/i;
    const snake = /[a-z]_[a-z]/;
    const model = buildTimelineNodePopoverModel({
      node: fakeNode({ messageId: 'm1', kindLabel: 'Claim', sideLabel: 'For' }),
      actor: 'other',
      totalCount: 5,
    });
    expect(model!.headerLine).not.toMatch(forbidden);
    expect(model!.headerLine).not.toMatch(snake);
    expect(model!.standingLabel).not.toMatch(forbidden);
    expect(model!.accessibilityLabel).not.toMatch(forbidden);
  });
});

// ── Tap-effect dispatcher ────────────────────────────────────────

describe('SC-002 decideNodeTapEffect', () => {
  it('non-active node tap → activate', () => {
    const e = decideNodeTapEffect({ tappedMessageId: 'm2', activeMessageId: 'm1', popoverMessageId: null });
    expect(e).toEqual({ type: 'activate', messageId: 'm2' });
  });

  it('non-active node tap with popover open → still activate (popover should close in the caller)', () => {
    const e = decideNodeTapEffect({ tappedMessageId: 'm2', activeMessageId: 'm1', popoverMessageId: 'm1' });
    expect(e).toEqual({ type: 'activate', messageId: 'm2' });
  });

  it('active node tap with popover closed → open popover', () => {
    const e = decideNodeTapEffect({ tappedMessageId: 'm1', activeMessageId: 'm1', popoverMessageId: null });
    expect(e).toEqual({ type: 'open_popover', messageId: 'm1' });
  });

  it('active node tap with popover already open on same node → close popover (toggle)', () => {
    const e = decideNodeTapEffect({ tappedMessageId: 'm1', activeMessageId: 'm1', popoverMessageId: 'm1' });
    expect(e).toEqual({ type: 'close_popover' });
  });

  it('active node tap with popover open on a different (stale) node → opens popover on active', () => {
    // Defensive — should not happen in practice since popover closes on activate.
    const e = decideNodeTapEffect({ tappedMessageId: 'm1', activeMessageId: 'm1', popoverMessageId: 'm99' });
    expect(e).toEqual({ type: 'open_popover', messageId: 'm1' });
  });
});

describe('SC-002 decideInfoIconEffect', () => {
  it('always opens the popover (never toggles or activates)', () => {
    expect(decideInfoIconEffect('m1')).toEqual({ type: 'open_popover', messageId: 'm1' });
    expect(decideInfoIconEffect('m99')).toEqual({ type: 'open_popover', messageId: 'm99' });
  });
});

// ── EV-002 — evidenceContract pass-through ─────────────────────

describe('EV-002 buildTimelineNodePopoverModel — optional evidenceContract', () => {
  it('omits the evidenceContract field when none is passed', () => {
    const node = fakeNode({ messageId: 'm1' });
    const model = buildTimelineNodePopoverModel({ node, actor: 'other', totalCount: 1 });
    expect(model).not.toBeNull();
    expect('evidenceContract' in model!).toBe(false);
  });

  it('threads evidenceContract through untouched when provided', () => {
    // Lazy-require so the test file does not need to import EV-001 at top.
    // (Mirrors the existing test style which uses fakeNode for inputs.)
    // We construct a minimal but realistic TimelineEvidenceContract.
    const contract = {
      rendersAsEvidenceNode: false,
      rendersSourceChainRing: true,
      accessibilityLabelSuffix: 'Has attached receipt: no source yet.',
      receiptChip: {
        label: 'No source yet',
        helper: 'helper',
        tone: 'info' as const,
        invitesFollowup: true,
        showsSourceChainPressure: true,
        status: 'no_source' as const,
        kinds: [],
        count: 0,
      },
    };
    const node = fakeNode({ messageId: 'm1' });
    const model = buildTimelineNodePopoverModel({
      node,
      actor: 'other',
      totalCount: 1,
      evidenceContract: contract,
    });
    expect(model).not.toBeNull();
    expect(model!.evidenceContract).toBe(contract);
  });
});

// ── EV-003 — evidenceDebtSummary pass-through ──────────────────

describe('EV-003 buildTimelineNodePopoverModel — optional evidenceDebtSummary', () => {
  it('omits the evidenceDebtSummary field when none is passed', () => {
    const node = fakeNode({ messageId: 'm1' });
    const model = buildTimelineNodePopoverModel({ node, actor: 'other', totalCount: 1 });
    expect(model).not.toBeNull();
    expect('evidenceDebtSummary' in model!).toBe(false);
  });

  it('threads evidenceDebtSummary through untouched, beside evidenceContract', () => {
    const debtSummary = {
      nodeId: 'm1',
      debts: [
        {
          id: 'ask:debt',
          debateId: 'room',
          nodeId: 'm1',
          requestArgumentId: 'ask',
          debtKind: 'source' as const,
          requestedByUserId: 'user-a',
          requestedAt: '2026-05-18T00:00:00Z',
          status: 'requested' as const,
          ageDays: 1,
          isStale: false,
        },
      ],
      openCount: 1,
      settledCount: 0,
      hasOpenDebt: true,
      chipStatus: 'requested' as const,
    };
    const node = fakeNode({ messageId: 'm1' });
    const model = buildTimelineNodePopoverModel({
      node,
      actor: 'other',
      totalCount: 1,
      evidenceDebtSummary: debtSummary,
    });
    expect(model).not.toBeNull();
    // Same reference, copied onto the model untouched.
    expect(model!.evidenceDebtSummary).toBe(debtSummary);
  });
});
