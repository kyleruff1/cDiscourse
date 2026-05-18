/**
 * TL-002 — Timeline onboarding focus on the first point.
 *
 * Pure-model tests for the root / first-rebuttal / first-clash /
 * onboarding-hint / back-to-root surface added to
 * `buildArgumentTimelineMap` in argumentGameSurfaceModel.ts.
 */
import {
  buildArgumentTimelineMap,
  BACK_TO_ROOT_MIN_MESSAGES,
  TL_ROOT_HINT_BE_FIRST_REBUTTAL,
  TL_ROOT_HINT_OPENING_CLAIM,
  type ArgumentTimelineMapMessageInput,
} from '../src/features/arguments/argumentGameSurfaceModel';

function isoAt(offsetMs: number): string {
  return new Date(1715000000000 + offsetMs).toISOString();
}

function msg(partial: Partial<ArgumentTimelineMapMessageInput> & { id: string }): ArgumentTimelineMapMessageInput {
  return {
    id: partial.id,
    debateId: partial.debateId ?? 'd1',
    parentId: partial.parentId ?? null,
    authorId: partial.authorId ?? 'author-a',
    argumentType: partial.argumentType ?? 'claim',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A claim body.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(0),
    updatedAt: partial.updatedAt ?? partial.createdAt ?? isoAt(0),
    isBot: partial.isBot ?? false,
    qualifierLabels: partial.qualifierLabels ?? [],
    flagCodes: partial.flagCodes ?? [],
    tagCodes: partial.tagCodes ?? [],
    topicScore: partial.topicScore ?? null,
    hasEvidence: partial.hasEvidence ?? false,
  };
}

// ── Root identification ──────────────────────────────────────────

describe('TL-002 root identification', () => {
  it('marks the first chronological message with no parent as root', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'm1', argumentType: 'thesis', createdAt: isoAt(0) }),
        msg({ id: 'm2', argumentType: 'rebuttal', parentId: 'm1', createdAt: isoAt(1000) }),
      ],
      currentUserId: 'me',
    });

    expect(map.rootMessageId).toBe('m1');
    expect(map.nodes[0].isRoot).toBe(true);
    expect(map.nodes[1].isRoot).toBe(false);
  });

  it('exposes rootMessageId even when active is the latest, not root', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'm1', argumentType: 'thesis', createdAt: isoAt(0) }),
        msg({ id: 'm2', argumentType: 'rebuttal', parentId: 'm1', createdAt: isoAt(1000) }),
        msg({ id: 'm3', argumentType: 'evidence', parentId: 'm2', createdAt: isoAt(2000) }),
      ],
      currentUserId: 'me',
      activeMessageId: 'm3',
    });

    expect(map.rootMessageId).toBe('m1');
    expect(map.activeNode?.messageId).toBe('m3');
    // Root remains a navigable node — accessibility label is preserved.
    const root = map.nodes.find((n) => n.messageId === 'm1');
    expect(root?.isRoot).toBe(true);
    expect(root?.accessibilityLabel).toMatch(/Message 1 of 3/);
  });

  it('returns null rootMessageId on an empty timeline', () => {
    const map = buildArgumentTimelineMap({ messages: [], currentUserId: 'me' });
    expect(map.rootMessageId).toBeNull();
    expect(map.firstRebuttalMessageId).toBeNull();
    expect(map.hasRebuttal).toBe(false);
    expect(map.rootOnboardingHint).toBeNull();
    expect(map.showBackToRootControl).toBe(false);
  });
});

// ── First rebuttal + first-clash edge ────────────────────────────

describe('TL-002 first rebuttal + first-clash edge', () => {
  it('identifies the first chronological child of the root as firstRebuttal', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'root', argumentType: 'thesis', createdAt: isoAt(0) }),
        msg({ id: 'second-child', parentId: 'root', argumentType: 'rebuttal', createdAt: isoAt(2000) }),
        msg({ id: 'first-child', parentId: 'root', argumentType: 'rebuttal', createdAt: isoAt(1000) }),
      ],
      currentUserId: 'me',
    });

    expect(map.firstRebuttalMessageId).toBe('first-child');
    expect(map.nodes.find((n) => n.messageId === 'first-child')?.isFirstRebuttal).toBe(true);
    expect(map.nodes.find((n) => n.messageId === 'second-child')?.isFirstRebuttal).toBe(false);
  });

  it('marks the root → first-rebuttal edge as isFirstClash', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'root', argumentType: 'thesis', createdAt: isoAt(0) }),
        msg({ id: 'r1', parentId: 'root', argumentType: 'rebuttal', createdAt: isoAt(1000) }),
        msg({ id: 'r2', parentId: 'root', argumentType: 'rebuttal', createdAt: isoAt(2000) }),
        msg({ id: 'r3', parentId: 'r1', argumentType: 'evidence', createdAt: isoAt(3000) }),
      ],
      currentUserId: 'me',
    });

    const firstClashEdges = map.edges.filter((e) => e.isFirstClash);
    expect(firstClashEdges).toHaveLength(1);
    expect(firstClashEdges[0].fromMessageId).toBe('root');
    expect(firstClashEdges[0].toMessageId).toBe('r1');

    // Other edges are NOT marked as first-clash.
    expect(map.edges.find((e) => e.toMessageId === 'r2')?.isFirstClash).toBe(false);
    expect(map.edges.find((e) => e.toMessageId === 'r3')?.isFirstClash).toBe(false);
  });

  it('no isFirstClash edge when the root has no children', () => {
    const map = buildArgumentTimelineMap({
      messages: [msg({ id: 'lonely-root', argumentType: 'thesis', createdAt: isoAt(0) })],
      currentUserId: 'me',
    });

    expect(map.firstRebuttalMessageId).toBeNull();
    expect(map.hasRebuttal).toBe(false);
    expect(map.edges).toHaveLength(0);
  });
});

// ── Root onboarding hint ─────────────────────────────────────────

describe('TL-002 rootOnboardingHint', () => {
  it('surfaces "Be the first rebuttal." in a no-rebuttal room', () => {
    const map = buildArgumentTimelineMap({
      messages: [msg({ id: 'root', argumentType: 'thesis', createdAt: isoAt(0) })],
      currentUserId: 'me',
    });

    expect(map.rootOnboardingHint).toBe(TL_ROOT_HINT_BE_FIRST_REBUTTAL);
    expect(TL_ROOT_HINT_BE_FIRST_REBUTTAL).toBe('Be the first rebuttal.');
  });

  it('surfaces "This is the opening claim." when root is active and a rebuttal exists', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'root', argumentType: 'thesis', createdAt: isoAt(0) }),
        msg({ id: 'r1', parentId: 'root', argumentType: 'rebuttal', createdAt: isoAt(1000) }),
      ],
      currentUserId: 'me',
      activeMessageId: 'root',
    });

    expect(map.rootOnboardingHint).toBe(TL_ROOT_HINT_OPENING_CLAIM);
    expect(TL_ROOT_HINT_OPENING_CLAIM).toBe('This is the opening claim.');
  });

  it('returns null when root is not active AND at least one rebuttal exists', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'root', argumentType: 'thesis', createdAt: isoAt(0) }),
        msg({ id: 'r1', parentId: 'root', argumentType: 'rebuttal', createdAt: isoAt(1000) }),
      ],
      currentUserId: 'me',
      activeMessageId: 'r1',
    });

    expect(map.rootOnboardingHint).toBeNull();
  });

  it('hint copy contains no internal codes or verdict tokens', () => {
    const forbidden = /\b(winner|loser|truth|liar|dishonest|extremist|propagandist|topic_satisfaction|evidence_debt|max_depth)\b/i;
    const snake = /[a-z]_[a-z]/;
    expect(TL_ROOT_HINT_BE_FIRST_REBUTTAL).not.toMatch(forbidden);
    expect(TL_ROOT_HINT_BE_FIRST_REBUTTAL).not.toMatch(snake);
    expect(TL_ROOT_HINT_OPENING_CLAIM).not.toMatch(forbidden);
    expect(TL_ROOT_HINT_OPENING_CLAIM).not.toMatch(snake);
  });
});

// ── Back-to-root control ─────────────────────────────────────────

describe('TL-002 showBackToRootControl', () => {
  it('is false when the active node IS the root', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'root', createdAt: isoAt(0) }),
        ...Array.from({ length: 7 }, (_, i) =>
          msg({ id: `m${i + 2}`, parentId: 'root', argumentType: 'rebuttal', createdAt: isoAt(1000 * (i + 1)) }),
        ),
      ],
      currentUserId: 'me',
      activeMessageId: 'root',
    });

    expect(map.nodes.length).toBeGreaterThanOrEqual(BACK_TO_ROOT_MIN_MESSAGES);
    expect(map.showBackToRootControl).toBe(false);
  });

  it('is false on a short timeline even if active is not root', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'root', createdAt: isoAt(0) }),
        msg({ id: 'r1', parentId: 'root', argumentType: 'rebuttal', createdAt: isoAt(1000) }),
      ],
      currentUserId: 'me',
      activeMessageId: 'r1',
    });

    expect(map.nodes.length).toBeLessThan(BACK_TO_ROOT_MIN_MESSAGES);
    expect(map.showBackToRootControl).toBe(false);
  });

  it('is true on a long timeline when active is not the root', () => {
    const messages = [
      msg({ id: 'root', createdAt: isoAt(0) }),
      ...Array.from({ length: BACK_TO_ROOT_MIN_MESSAGES }, (_, i) =>
        msg({ id: `m${i + 2}`, parentId: 'root', argumentType: 'rebuttal', createdAt: isoAt(1000 * (i + 1)) }),
      ),
    ];
    const map = buildArgumentTimelineMap({
      messages,
      currentUserId: 'me',
      activeMessageId: messages[messages.length - 1].id,
    });

    expect(map.nodes.length).toBeGreaterThanOrEqual(BACK_TO_ROOT_MIN_MESSAGES);
    expect(map.showBackToRootControl).toBe(true);
  });

  it('threshold is at least 5 messages', () => {
    // Documenting the contract — UI relies on this not silently shrinking.
    expect(BACK_TO_ROOT_MIN_MESSAGES).toBeGreaterThanOrEqual(5);
  });
});

// ── No-rebuttal card activates root (gallery contract) ───────────

describe('TL-002 no-rebuttal-room: activates root', () => {
  it('a no-rebuttal room can pass activeMessageId === rootMessageId and stays consistent', () => {
    const map = buildArgumentTimelineMap({
      messages: [msg({ id: 'root', createdAt: isoAt(0) })],
      currentUserId: 'me',
      activeMessageId: 'root',
    });

    expect(map.rootMessageId).toBe('root');
    expect(map.activeNode?.messageId).toBe('root');
    expect(map.activeNode?.isRoot).toBe(true);
    // The onboarding hint nudges the user to be the first rebuttal.
    expect(map.rootOnboardingHint).toBe(TL_ROOT_HINT_BE_FIRST_REBUTTAL);
  });

  it('omitting activeMessageId still defaults active to latest, which equals root in a no-rebuttal room', () => {
    const map = buildArgumentTimelineMap({
      messages: [msg({ id: 'root', createdAt: isoAt(0) })],
      currentUserId: 'me',
    });

    expect(map.activeNode?.messageId).toBe('root');
    expect(map.activeNode?.isRoot).toBe(true);
  });
});
