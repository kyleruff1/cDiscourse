/**
 * HOME-001 (#874) — homeModel pure view-model tests (Slice 2 model layer).
 *
 * Covers collectFixtureDebateIds, collectUnreadDebateIds, and
 * buildArgumentHomeViewModel. Pure TS: no React, no Supabase, no network.
 */
import {
  buildArgumentHomeViewModel,
  collectFixtureDebateIds,
  collectUnreadDebateIds,
} from '../src/features/home/homeModel';
import {
  LATEST_AUTHOR_LABEL,
  type ConversationGalleryCard,
} from '../src/features/debates/conversationGalleryModel';
import type { Debate } from '../src/features/debates/types';
import type { RoomNotification } from '../src/features/notifications/notificationModel';

// ── Fixtures ────────────────────────────────────────────────────

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

function debate(partial: Partial<Debate> & { id: string }): Debate {
  return {
    id: partial.id,
    createdBy: partial.createdBy ?? 'creator',
    title: partial.title ?? 'A debate title',
    resolution: partial.resolution ?? 'A resolution.',
    description: partial.description ?? '',
    status: partial.status ?? 'open',
    constitutionId: partial.constitutionId ?? 'c1',
    createdAt: partial.createdAt ?? isoAt(1715000000000),
    updatedAt: partial.updatedAt ?? isoAt(1715000000000),
    myParticipantSide: partial.myParticipantSide ?? null,
    visibility: partial.visibility ?? 'public',
    inactiveAt: partial.inactiveAt ?? null,
  };
}

function notif(partial: Partial<RoomNotification> & { id: string; debateId: string }): RoomNotification {
  return {
    id: partial.id,
    recipientId: partial.recipientId ?? 'me',
    debateId: partial.debateId,
    argumentId: partial.argumentId ?? null,
    type: partial.type ?? 'new_response',
    roomTitle: partial.roomTitle ?? 'Room',
    meta: partial.meta ?? {},
    readAt: partial.readAt === undefined ? null : partial.readAt,
    createdAt: partial.createdAt ?? isoAt(1715000000000),
  };
}

function baseCard(over: Partial<ConversationGalleryCard> = {}): ConversationGalleryCard {
  return {
    debateId: 'd1',
    canonicalConversationKey: 'k1',
    duplicateCount: 1,
    duplicateDebateIds: ['d1'],
    title: 'T',
    fallbackTitle: 'T',
    starterDisplayName: 'u',
    starterSide: null,
    mySide: 'affirmative',
    firstPostExcerpt: '',
    latestPostExcerpt: '',
    latestPostAuthor: LATEST_AUTHOR_LABEL.other,
    createdAt: '',
    updatedAt: '',
    moveCount: 4,
    rebuttalCount: 1,
    participantCount: 2,
    hasNoRebuttal: false,
    hasUserJoined: true,
    openStatus: 'open',
    visibility: 'public',
    bucket: 'all_open',
    heatLevel: 'cold',
    temperament: 'plain',
    issueFrame: 'unknown',
    dominantAxis: 'none',
    sourceChainRisk: 'unknown',
    evidentiaryRisk: 'unknown',
    amplificationRisk: 'none_observed',
    platformSupportWarning: false,
    evidenceDebtSummary: {
      debateId: 'd1',
      totalCount: 0,
      openCount: 0,
      staleCount: 0,
      settledCount: 0,
      hasOpenEvidenceDebt: false,
      statusLine: '',
    },
    unresolvedReason: null,
    stopReason: null,
    timelinePreviewSegments: [],
    signals: [],
    searchText: '',
    voteScorePreview: null,
    winnerPreview: null,
    promotedArgumentCount: 0,
    sortKeys: {
      latestActivityMs: 0,
      createdAtMs: 0,
      heatScore: 0,
      needsRebuttalFlag: 0,
      moveCount: 0,
      oldestUnresolvedMs: Number.POSITIVE_INFINITY,
    },
    ...over,
  };
}

const withRecency = (card: ConversationGalleryCard, ms: number): ConversationGalleryCard => ({
  ...card,
  sortKeys: { ...card.sortKeys, latestActivityMs: ms },
});

// ── collectFixtureDebateIds ─────────────────────────────────────

describe('HOME-001 — collectFixtureDebateIds', () => {
  it('collects debateIds whose RAW title matches a bot/corpus/reseed tag', () => {
    const debates = [
      debate({ id: 'd-plain', title: 'Should cities expand bike lanes?' }),
      debate({ id: 'd-xai', title: 'Bike lanes [xai-adv 9018694f]' }),
      debate({ id: 'd-reseed', title: 'Remote work [reseed-baseline-20260708-1a2b3c4d]' }),
    ];
    const ids = collectFixtureDebateIds(debates);
    expect(ids.has('d-plain')).toBe(false);
    expect(ids.has('d-xai')).toBe(true);
    expect(ids.has('d-reseed')).toBe(true);
  });

  it('returns an empty set for an empty debate list', () => {
    expect(collectFixtureDebateIds([]).size).toBe(0);
  });
});

// ── collectUnreadDebateIds ──────────────────────────────────────

describe('HOME-001 — collectUnreadDebateIds', () => {
  it('collects debateIds with an unread notification (readAt null)', () => {
    const notifications = [
      notif({ id: 'n1', debateId: 'd-unread', readAt: null }),
      notif({ id: 'n2', debateId: 'd-read', readAt: isoAt(1715000001000) }),
    ];
    const ids = collectUnreadDebateIds(notifications);
    expect(ids.has('d-unread')).toBe(true);
    expect(ids.has('d-read')).toBe(false);
  });

  it('returns an empty set for an empty notification list', () => {
    expect(collectUnreadDebateIds([]).size).toBe(0);
  });
});

// ── buildArgumentHomeViewModel ──────────────────────────────────

describe('HOME-001 — buildArgumentHomeViewModel', () => {
  it('isFirstRun is true when there is nothing waiting and nothing ongoing', () => {
    const vm = buildArgumentHomeViewModel({ cards: [], debates: [], isAdminViewer: false });
    expect(vm.isFirstRun).toBe(true);
    expect(vm.yourTurn).toHaveLength(0);
    expect(vm.ongoing).toHaveLength(0);
  });

  it('splits waiting-on-me into yourTurn and other joined rooms into ongoing (recency-ranked)', () => {
    const waiting = baseCard({
      debateId: 'd-wait',
      hasNoRebuttal: true,
      moveCount: 1,
      latestPostAuthor: LATEST_AUTHOR_LABEL.other,
    });
    const ongoingOld = withRecency(
      baseCard({ debateId: 'd-old', latestPostAuthor: LATEST_AUTHOR_LABEL.you }),
      100,
    );
    const ongoingNew = withRecency(
      baseCard({ debateId: 'd-new', latestPostAuthor: LATEST_AUTHOR_LABEL.you }),
      500,
    );
    const observer = baseCard({ debateId: 'd-obs', hasUserJoined: false });

    const vm = buildArgumentHomeViewModel({
      cards: [ongoingOld, waiting, observer, ongoingNew],
      debates: [debate({ id: 'd-wait' }), debate({ id: 'd-old' }), debate({ id: 'd-new' })],
      isAdminViewer: false,
    });

    expect(vm.yourTurn.map((i) => i.card.debateId)).toEqual(['d-wait']);
    // ongoing excludes the your-turn card + the observer room; newest first.
    expect(vm.ongoing.map((c) => c.debateId)).toEqual(['d-new', 'd-old']);
    expect(vm.isFirstRun).toBe(false);
  });

  it('threads unread notifications through to the your-turn hasUnread flag', () => {
    const a = baseCard({ debateId: 'd-a', hasNoRebuttal: true, moveCount: 1 });
    const vm = buildArgumentHomeViewModel({
      cards: [a],
      debates: [debate({ id: 'd-a' })],
      unreadDebateIds: new Set(['d-a']),
      isAdminViewer: false,
    });
    expect(vm.yourTurn[0].hasUnread).toBe(true);
  });

  describe('fixture exclusion (D8/Q12)', () => {
    const waitingFixture = baseCard({
      debateId: 'd-fix',
      hasNoRebuttal: true,
      moveCount: 1,
      latestPostAuthor: LATEST_AUTHOR_LABEL.other,
    });
    const ongoingFixture = baseCard({
      debateId: 'd-fix2',
      latestPostAuthor: LATEST_AUTHOR_LABEL.you,
    });
    const realWaiting = baseCard({
      debateId: 'd-real',
      hasNoRebuttal: true,
      moveCount: 1,
      latestPostAuthor: LATEST_AUTHOR_LABEL.other,
    });
    const debates = [
      debate({ id: 'd-fix', title: 'Seeded [reseed-baseline-20260708-1a2b3c4d]' }),
      debate({ id: 'd-fix2', title: 'Corpus [xai-adv 9018694f]' }),
      debate({ id: 'd-real', title: 'A genuine human topic' }),
    ];

    it('drops fixture rooms from both yourTurn and ongoing for a non-admin viewer', () => {
      const vm = buildArgumentHomeViewModel({
        cards: [waitingFixture, ongoingFixture, realWaiting],
        debates,
        isAdminViewer: false,
      });
      expect(vm.yourTurn.map((i) => i.card.debateId)).toEqual(['d-real']);
      expect(vm.ongoing.map((c) => c.debateId)).toEqual([]);
    });

    it('keeps fixture rooms for an admin viewer', () => {
      const vm = buildArgumentHomeViewModel({
        cards: [waitingFixture, ongoingFixture, realWaiting],
        debates,
        isAdminViewer: true,
      });
      const turnIds = vm.yourTurn.map((i) => i.card.debateId).sort();
      expect(turnIds).toEqual(['d-fix', 'd-real']);
      expect(vm.ongoing.map((c) => c.debateId)).toEqual(['d-fix2']);
    });
  });

  it('is a pure projection: same input twice yields deeply-equal output', () => {
    const cards = [
      baseCard({ debateId: 'd-a', hasNoRebuttal: true, moveCount: 1 }),
      baseCard({ debateId: 'd-b', latestPostAuthor: LATEST_AUTHOR_LABEL.you }),
    ];
    const debates = [debate({ id: 'd-a' }), debate({ id: 'd-b' })];
    const input = { cards, debates, isAdminViewer: false };
    expect(buildArgumentHomeViewModel(input)).toEqual(buildArgumentHomeViewModel(input));
  });
});
