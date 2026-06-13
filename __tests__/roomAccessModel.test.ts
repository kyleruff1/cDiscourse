/**
 * ARG-ROOM-006 — roomAccessModel pure-model tests.
 *
 * Covers items (a) public listed, (b) private hidden (belt-and-suspenders
 * predicate), (c) deep-link resolver (the no-enumeration invariant), (e) full +
 * reserved seat states, (f) observer/participant distinction — plus cap parity,
 * the shared action-label policy, and the doctrine ban-list. The model is pure:
 * imported directly, no React / Supabase / network.
 */
import {
  deriveRoomAccessView,
  deriveGalleryActionLabel,
  resolveRoomDeepLinkAccess,
  feedVisibilityForCard,
  _forbiddenRoomAccessTokens,
  type RoomSeatStateSummary,
  type RoomAccessState,
} from '../src/features/debates/roomAccessModel';
import { roomActiveSeatCap, canJoinActive } from '../src/features/debates/roomCapacityModel';
import { deriveSeatAvailability } from '../src/features/debates/seatClaimModel';
import { ROOM_ACCESS_COPY, ROOM_VISIBILITY_COPY, looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import { classifyCardToSection } from '../src/features/debates/conversationGalleryModel';
import type { ConversationGalleryCard } from '../src/features/debates/conversationGalleryModel';

function summary(over: Partial<RoomSeatStateSummary> = {}): RoomSeatStateSummary {
  return {
    visibility: 'public',
    openStatus: 'open',
    isMember: false,
    activeCount: null,
    reservedCount: null,
    ...over,
  };
}

// ── deriveRoomAccessView — public (items a / e / f) ─────────────

describe('deriveRoomAccessView — public', () => {
  it('counts absent → public_open, listed, observable, Observe →, openSlots null', () => {
    const v = deriveRoomAccessView(summary({ visibility: 'public', activeCount: null }));
    expect(v.state).toBe('public_open');
    expect(v.feedVisibility).toBe('listed');
    expect(v.canObserve).toBe(true);
    expect(v.canClaimSeat).toBe(true); // open + not a member
    expect(v.actionLabel).toBe('Observe →');
    expect(v.openSlots).toBeNull();
    expect(v.cap).toBe(5);
  });

  it('active + reserved = cap → public_full, observe-only (observers uncapped)', () => {
    const v = deriveRoomAccessView(summary({ activeCount: 4, reservedCount: 1 }));
    expect(v.state).toBe('public_full');
    expect(v.canClaimSeat).toBe(false);
    expect(v.canObserve).toBe(true); // doctrine: "full" is a seat fact, not a wall
    expect(v.openSlots).toBe(0);
  });

  it('active alone = cap → public_full', () => {
    const v = deriveRoomAccessView(summary({ activeCount: 5, reservedCount: 0 }));
    expect(v.state).toBe('public_full');
    expect(v.canClaimSeat).toBe(false);
    expect(v.canObserve).toBe(true);
  });

  it('reserved=1, active=1 (viewer-visible) → public_reserved, openSlots 3', () => {
    const v = deriveRoomAccessView(summary({ activeCount: 1, reservedCount: 1 }));
    expect(v.state).toBe('public_reserved');
    expect(v.openSlots).toBe(3);
    expect(v.canObserve).toBe(true);
    expect(v.canClaimSeat).toBe(true);
  });

  it('active present, reserved hidden (null) → public_open (degrade, no enumeration)', () => {
    const v = deriveRoomAccessView(summary({ activeCount: 4, reservedCount: null }));
    expect(v.state).toBe('public_open');
    expect(v.openSlots).toBe(1);
  });

  it('reserved present but zero → public_open (not "reserved")', () => {
    const v = deriveRoomAccessView(summary({ activeCount: 2, reservedCount: 0 }));
    expect(v.state).toBe('public_open');
    expect(v.openSlots).toBe(3);
  });

  it('a member of a public room → Continue →', () => {
    const v = deriveRoomAccessView(summary({ activeCount: 2, reservedCount: 0, isMember: true }));
    expect(v.actionLabel).toBe('Continue →');
    expect(v.canClaimSeat).toBe(false); // already a member
  });

  it('locked / draft / archived public room → Open →, cannot claim', () => {
    for (const openStatus of ['locked', 'draft', 'archived'] as const) {
      const v = deriveRoomAccessView(summary({ openStatus, activeCount: 1, reservedCount: 0 }));
      expect(v.actionLabel).toBe('Open →');
      expect(v.canClaimSeat).toBe(false);
      expect(v.canObserve).toBe(true);
    }
  });

  it('always reports the public badge label', () => {
    const v = deriveRoomAccessView(summary({ activeCount: 1 }));
    expect(v.badgeLabel).toBe(ROOM_VISIBILITY_COPY.option_public_label);
  });
});

// ── deriveRoomAccessView — private (items b / f) ────────────────

describe('deriveRoomAccessView — private', () => {
  it('non-member → private_no_access: hidden, no observe, no claim, NO "Private" badge', () => {
    const v = deriveRoomAccessView(summary({ visibility: 'private', isMember: false }));
    expect(v.state).toBe('private_no_access');
    expect(v.feedVisibility).toBe('hidden');
    expect(v.canObserve).toBe(false);
    expect(v.canClaimSeat).toBe(false);
    // No enumeration: a non-member is never told a private room exists.
    expect(v.badgeLabel).toBe('');
    expect(v.accessLine).toBe(ROOM_ACCESS_COPY.unavailable_body);
  });

  it('member → private_member: Continue →, observable, hidden from discovery', () => {
    const v = deriveRoomAccessView(summary({ visibility: 'private', isMember: true }));
    expect(v.state).toBe('private_member');
    expect(v.actionLabel).toBe('Continue →');
    expect(v.canObserve).toBe(true);
    expect(v.feedVisibility).toBe('hidden');
    expect(v.badgeLabel).toBe(ROOM_VISIBILITY_COPY.option_private_label);
    expect(v.accessLine).toBe(ROOM_ACCESS_COPY.private_member_line);
  });

  it('private cap is 2 (1v1) via roomActiveSeatCap — never re-literaled', () => {
    const v = deriveRoomAccessView(summary({ visibility: 'private', isMember: true }));
    expect(v.cap).toBe(roomActiveSeatCap('private'));
    expect(v.cap).toBe(2);
  });
});

// ── cap parity (no re-literal) ─────────────────────────────────

describe('deriveRoomAccessView — cap parity with roomActiveSeatCap', () => {
  it('public cap === 5, private cap === 2', () => {
    expect(deriveRoomAccessView(summary({ visibility: 'public', activeCount: 1 })).cap).toBe(
      roomActiveSeatCap('public'),
    );
    expect(deriveRoomAccessView(summary({ visibility: 'private', isMember: true })).cap).toBe(
      roomActiveSeatCap('private'),
    );
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(deriveRoomAccessView(summary({ activeCount: 1 })))).toBe(true);
  });
});

// ── parity with ARG-ROOM-005 seat model (matches 005 seat states) ──

describe('deriveRoomAccessView — full/open parity with deriveSeatAvailability', () => {
  it('public_full ⟺ seat.isFull AND openSlots match, across the count grid', () => {
    for (let active = 0; active <= 6; active += 1) {
      for (let reserved = 0; reserved <= 6; reserved += 1) {
        const view = deriveRoomAccessView(
          summary({ visibility: 'public', activeCount: active, reservedCount: reserved }),
        );
        const seat = deriveSeatAvailability({
          visibility: 'public',
          activeParticipantCount: active,
          knownReservedInviteCount: reserved,
          viewerSide: null,
          reservedCountIsAuthoritative: true,
        });
        expect(view.state === 'public_full').toBe(seat.isFull);
        expect(view.openSlots).toBe(seat.openSlots);
        // Whenever a seat is claimable per the shared primitive, the view agrees.
        expect(view.state === 'public_full').toBe(!canJoinActive(active, reserved, 5));
      }
    }
  });
});

// ── resolveRoomDeepLinkAccess (item c) — no enumeration ────────

describe('resolveRoomDeepLinkAccess', () => {
  it('id present in an array → resolved', () => {
    expect(
      resolveRoomDeepLinkAccess({ requestedDebateId: 'b', loadedDebateIds: ['a', 'b', 'c'] }).outcome,
    ).toBe('resolved');
  });

  it('id present in a Set → resolved', () => {
    expect(
      resolveRoomDeepLinkAccess({ requestedDebateId: 'b', loadedDebateIds: new Set(['a', 'b']) }).outcome,
    ).toBe('resolved');
  });

  it('id absent → unavailable', () => {
    expect(
      resolveRoomDeepLinkAccess({ requestedDebateId: 'zzz', loadedDebateIds: ['a', 'b'] }).outcome,
    ).toBe('unavailable');
  });

  it('empty / non-string id → unavailable', () => {
    expect(resolveRoomDeepLinkAccess({ requestedDebateId: '', loadedDebateIds: ['a'] }).outcome).toBe(
      'unavailable',
    );
    expect(
      resolveRoomDeepLinkAccess({ requestedDebateId: null as unknown as string, loadedDebateIds: ['a'] })
        .outcome,
    ).toBe('unavailable');
  });

  it('THE ENUMERATION INVARIANT: a private-no-access id and a nonexistent id return the IDENTICAL outcome', () => {
    // Caller sees only ids RLS returned. A private room the viewer is not in is
    // withheld by RLS → its id is absent, exactly like a typo'd/nonexistent id.
    const loaded = ['public-room-1', 'public-room-2'];
    const privateNoAccessId = 'private-room-the-viewer-cannot-see';
    const nonexistentId = 'this-id-was-never-real';
    const a = resolveRoomDeepLinkAccess({ requestedDebateId: privateNoAccessId, loadedDebateIds: loaded });
    const b = resolveRoomDeepLinkAccess({ requestedDebateId: nonexistentId, loadedDebateIds: loaded });
    expect(a).toEqual(b);
    expect(a.outcome).toBe('unavailable');
  });

  it('returns a frozen object', () => {
    expect(
      Object.isFrozen(resolveRoomDeepLinkAccess({ requestedDebateId: 'a', loadedDebateIds: ['a'] })),
    ).toBe(true);
  });
});

// ── feedVisibilityForCard (item b) ─────────────────────────────

describe('feedVisibilityForCard', () => {
  it('private + non-member → hidden', () => {
    expect(feedVisibilityForCard({ visibility: 'private', isMember: false })).toBe('hidden');
  });

  it('private + member → hidden (belongs in My rooms, never a public lane)', () => {
    expect(feedVisibilityForCard({ visibility: 'private', isMember: true })).toBe('hidden');
  });

  it('public → listed', () => {
    expect(feedVisibilityForCard({ visibility: 'public', isMember: false })).toBe('listed');
    expect(feedVisibilityForCard({ visibility: 'public', isMember: true })).toBe('listed');
  });

  it('agrees with deriveRoomAccessView().feedVisibility for the same inputs', () => {
    for (const visibility of ['public', 'private'] as const) {
      for (const isMember of [true, false]) {
        const predicate = feedVisibilityForCard({ visibility, isMember });
        const view = deriveRoomAccessView(summary({ visibility, isMember, activeCount: 1, reservedCount: 0 }));
        expect(predicate).toBe(view.feedVisibility);
      }
    }
  });
});

// ── item (b) — pin the shipped classifyCardToSection rule (do not weaken) ──

describe('item (b) — private cards route to my_rooms AND the feed predicate hides them', () => {
  function card(over: Partial<ConversationGalleryCard>): ConversationGalleryCard {
    return {
      debateId: 'd1',
      canonicalConversationKey: 'k1',
      duplicateCount: 1,
      duplicateDebateIds: ['d1'],
      title: 'T',
      fallbackTitle: 'T',
      starterDisplayName: 'u',
      starterSide: null,
      mySide: null,
      firstPostExcerpt: '',
      latestPostExcerpt: '',
      latestPostAuthor: '',
      createdAt: '',
      updatedAt: '',
      moveCount: 0,
      rebuttalCount: 0,
      participantCount: 1,
      hasNoRebuttal: false,
      hasUserJoined: false,
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

  it('a private source_chain_fight card still routes to my_rooms (shipped rule unchanged)', () => {
    expect(classifyCardToSection(card({ visibility: 'private', bucket: 'source_chain_fight' }))).toBe(
      'my_rooms',
    );
    expect(feedVisibilityForCard({ visibility: 'private', isMember: false })).toBe('hidden');
  });

  it('a public card with a discovery bucket is NOT routed to my_rooms (item a — listed)', () => {
    expect(classifyCardToSection(card({ visibility: 'public', bucket: 'source_chain_fight' }))).toBe(
      'source_trail',
    );
    expect(feedVisibilityForCard({ visibility: 'public', isMember: false })).toBe('listed');
  });
});

// ── deriveGalleryActionLabel (shared policy) ───────────────────

describe('deriveGalleryActionLabel', () => {
  it('member → Continue →', () => {
    expect(deriveGalleryActionLabel({ hasUserJoined: true, openStatus: 'open' })).toBe('Continue →');
    expect(deriveGalleryActionLabel({ hasUserJoined: true, openStatus: 'locked' })).toBe('Continue →');
  });
  it('non-member + open → Observe →', () => {
    expect(deriveGalleryActionLabel({ hasUserJoined: false, openStatus: 'open' })).toBe('Observe →');
  });
  it('non-member + not open → Open →', () => {
    for (const openStatus of ['draft', 'locked', 'archived'] as const) {
      expect(deriveGalleryActionLabel({ hasUserJoined: false, openStatus })).toBe('Open →');
    }
  });
});

// ── doctrine ban-list + plain-language (no verdict / no internal code) ──

describe('roomAccessModel — doctrine ban-list', () => {
  // Every state the deriver can produce, so we scan every emitted string.
  const allStates: RoomAccessState[] = [
    'public_open',
    'public_reserved',
    'public_full',
    'private_member',
    'private_no_access',
  ];

  const emitted: { state: RoomAccessState; view: ReturnType<typeof deriveRoomAccessView> }[] = [
    { state: 'public_open', view: deriveRoomAccessView(summary({ activeCount: 1, reservedCount: 0 })) },
    { state: 'public_reserved', view: deriveRoomAccessView(summary({ activeCount: 1, reservedCount: 1 })) },
    { state: 'public_full', view: deriveRoomAccessView(summary({ activeCount: 5, reservedCount: 0 })) },
    { state: 'private_member', view: deriveRoomAccessView(summary({ visibility: 'private', isMember: true })) },
    { state: 'private_no_access', view: deriveRoomAccessView(summary({ visibility: 'private', isMember: false })) },
  ];

  it('covers every RoomAccessState exactly once', () => {
    expect(emitted.map((e) => e.state).sort()).toEqual([...allStates].sort());
  });

  it('no emitted accessLine / badgeLabel contains a forbidden token (word-boundary)', () => {
    const banned = _forbiddenRoomAccessTokens();
    for (const { view } of emitted) {
      for (const s of [view.accessLine, view.badgeLabel]) {
        const lower = s.toLowerCase();
        for (const token of banned) {
          expect(lower).not.toMatch(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
        }
      }
    }
  });

  it('no emitted string looks like an internal code (no snake_case leak)', () => {
    for (const { view } of emitted) {
      expect(looksLikeInternalCode(view.accessLine)).toBe(false);
      if (view.badgeLabel.length > 0) {
        expect(looksLikeInternalCode(view.badgeLabel)).toBe(false);
      }
    }
  });

  it('renderable states (public_* + private_member) have a non-empty badge + line', () => {
    for (const { state, view } of emitted) {
      expect(view.accessLine.length).toBeGreaterThan(0);
      if (state !== 'private_no_access') {
        expect(view.badgeLabel.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('ROOM_ACCESS_COPY — doctrine scan', () => {
  const values = Object.values(ROOM_ACCESS_COPY);

  it('every string is non-empty and not an internal code', () => {
    for (const v of values) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
      expect(looksLikeInternalCode(v)).toBe(false);
    }
  });

  it('every string is ban-list-clean (verdict / amplification / person tokens)', () => {
    const banned = _forbiddenRoomAccessTokens();
    for (const v of values) {
      const lower = v.toLowerCase();
      for (const token of banned) {
        expect(lower).not.toMatch(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
      }
    }
  });

  it('no string says "debate" or "game" (terminology scrub)', () => {
    for (const v of values) {
      expect(v.toLowerCase()).not.toMatch(/\bdebate\b/);
      expect(v.toLowerCase()).not.toMatch(/\bgame\b/);
    }
  });

  it('the deep-link unavailable copy NEVER asserts the room is private (no enumeration)', () => {
    // It must read identically for a nonexistent id, so it cannot claim "it is
    // private" the way ROOM_VISIBILITY_COPY.no_access_body does.
    expect(ROOM_ACCESS_COPY.unavailable_body.toLowerCase()).not.toContain('it is private');
    expect(ROOM_ACCESS_COPY.unavailable_body.toLowerCase()).not.toContain('only invited');
    // And it is genuinely distinct from the positive-knowledge no-access copy.
    expect(ROOM_ACCESS_COPY.unavailable_body).not.toBe(ROOM_VISIBILITY_COPY.no_access_body);
  });
});
