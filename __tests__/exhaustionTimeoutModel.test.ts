/**
 * GAME-001 — Point exhaustion and timeout rules.
 *
 * Doctrine pins:
 *   - blocksSubmit + appliesPointStandingPenalty always false.
 *   - Labels + helper lines read from RULE-003's LIFECYCLE_UX_MAP — never
 *     authored in the deriver.
 *   - No verdict / popularity / amplification / person-attribution tokens
 *     in any produced string.
 *   - Helpers describe the cluster, never the user.
 *   - Pure / total / deterministic. No `Date.now` / `Math.random` / fetch.
 *   - Priority cascade: synthesis_ready > exhausted > ignored_by_both >
 *     ignored_by_<side> > moved_on_by_<side> > null.
 */

import fs from 'fs';
import path from 'path';

import {
  ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES,
  DEFAULT_EXHAUSTION_TIMEOUT_CONFIG,
  buildExhaustionTimeoutInputFromLifecycle,
  deriveExhaustionTimeoutAdvisory,
  _forbiddenExhaustionTimeoutTokens,
  type BuildExhaustionTimeoutInputFromLifecycleInput,
  type ExhaustionTimeoutAdvisory,
  type ExhaustionTimeoutAdvisoryState,
  type ExhaustionTimeoutInput,
} from '../src/features/lifecycle/exhaustionTimeoutModel';
import {
  DEFAULT_LIFECYCLE_ADVISORY_CONFIG,
  type PointLifecycleClusterSummary,
  type PointLifecycleState,
} from '../src/features/lifecycle/pointLifecycleModel';
import type {
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type { SourceChainStatus } from '../src/features/evidence/evidenceModel';
import { LIFECYCLE_UX_MAP } from '../src/features/rulesUx/lifecycleUxMap';

// ── Fixture helpers ───────────────────────────────────────────

function baseInput(over: Partial<ExhaustionTimeoutInput> = {}): ExhaustionTimeoutInput {
  return {
    clusterId: 'cluster-1',
    upstreamClusterState: over.upstreamClusterState ?? null,
    maxSameAxisNonAdditivePressureCount: over.maxSameAxisNonAdditivePressureCount ?? 0,
    turnsSinceAffirmativeEngagedCluster: over.turnsSinceAffirmativeEngagedCluster ?? 0,
    turnsSinceNegativeEngagedCluster: over.turnsSinceNegativeEngagedCluster ?? 0,
    hasConcessionOrNarrowing: over.hasConcessionOrNarrowing ?? false,
    hasUnresolvedEvidenceDebt: over.hasUnresolvedEvidenceDebt ?? false,
    affirmativeHasOpenRequestDirectedAtIt: over.affirmativeHasOpenRequestDirectedAtIt ?? false,
    negativeHasOpenRequestDirectedAtIt: over.negativeHasOpenRequestDirectedAtIt ?? false,
    affirmativeHasEverEngagedCluster: over.affirmativeHasEverEngagedCluster ?? true,
    negativeHasEverEngagedCluster: over.negativeHasEverEngagedCluster ?? true,
    offAxisPressureCount: over.offAxisPressureCount ?? 0,
    roomMoveCountAtEvaluation: over.roomMoveCountAtEvaluation ?? 10,
    clusterRootOrdinal: over.clusterRootOrdinal ?? 1,
    config: over.config,
    ...over,
  };
}

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    actorLabel: over.actorLabel ?? 'You',
    kindLabel: over.kindLabel ?? 'claim',
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: over.bodyPreview ?? 'body',
    badges: over.badges ?? [],
    droppedTags: over.droppedTags ?? [],
    depth: over.depth ?? 0,
    lane: over.lane ?? 0,
    siblingIndex: over.siblingIndex ?? 0,
    replyCount: over.replyCount ?? 0,
    descendantCount: over.descendantCount ?? 0,
    branchId: over.branchId ?? 'branch-root-m1',
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: over.junctionGroupId ?? null,
    isJunction: over.isJunction ?? false,
    junctionChildCount: over.junctionChildCount ?? 0,
    isActive: over.isActive ?? false,
    isLatest: over.isLatest ?? false,
    isDetached: over.isDetached ?? false,
    isActivePath: over.isActivePath ?? false,
    isRoot: over.isRoot ?? false,
    isFirstRebuttal: over.isFirstRebuttal ?? false,
    standingBand: (over.standingBand ?? 'neutral') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    kindColor: over.kindColor ?? '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: over.x ?? 0,
    y: over.y ?? 100,
    accessibilityLabel: over.accessibilityLabel ?? 'm1',
  };
}

function fakeSummary(over: Partial<PointLifecycleClusterSummary> = {}): PointLifecycleClusterSummary {
  return {
    clusterId: over.clusterId ?? 'cluster-1',
    rootMessageId: over.rootMessageId ?? 'm1',
    state: (over.state ?? 'open') as PointLifecycleState,
    plainLabel: over.plainLabel ?? 'Open',
    messageIds: over.messageIds ?? ['m1'],
    memberCount: over.memberCount ?? 1,
    affirmativeMoveCount: over.affirmativeMoveCount ?? 1,
    negativeMoveCount: over.negativeMoveCount ?? 0,
    observerMoveCount: over.observerMoveCount ?? 0,
    hasOpenSourceOrQuoteRequest: over.hasOpenSourceOrQuoteRequest ?? false,
    hasConcessionOrSynthesisMove: over.hasConcessionOrSynthesisMove ?? false,
    worstEvidenceStatus: (over.worstEvidenceStatus ?? 'primary_present') as SourceChainStatus,
    primaryAxis: over.primaryAxis ?? null,
    isAdvisory: over.isAdvisory ?? false,
  };
}

/** Build minimal input that fires the given state (used by no-block / ban-list iteration). */
function buildInputThatFires(state: ExhaustionTimeoutAdvisoryState): ExhaustionTimeoutInput {
  switch (state) {
    case 'synthesis_ready':
      return baseInput({
        clusterId: 'sr',
        hasConcessionOrNarrowing: true,
        hasUnresolvedEvidenceDebt: false,
        roomMoveCountAtEvaluation: 10,
        clusterRootOrdinal: 1,
      });
    case 'exhausted':
      return baseInput({
        clusterId: 'ex',
        maxSameAxisNonAdditivePressureCount: 3,
        roomMoveCountAtEvaluation: 10,
        clusterRootOrdinal: 1,
      });
    case 'ignored_by_both':
      return baseInput({
        clusterId: 'ib',
        turnsSinceAffirmativeEngagedCluster: 6,
        turnsSinceNegativeEngagedCluster: 6,
        affirmativeHasOpenRequestDirectedAtIt: true,
        roomMoveCountAtEvaluation: 20,
        clusterRootOrdinal: 1,
      });
    case 'ignored_by_affirmative':
      return baseInput({
        clusterId: 'ia',
        turnsSinceAffirmativeEngagedCluster: 3,
        turnsSinceNegativeEngagedCluster: 0,
        affirmativeHasOpenRequestDirectedAtIt: true,
        roomMoveCountAtEvaluation: 10,
        clusterRootOrdinal: 1,
      });
    case 'ignored_by_negative':
      return baseInput({
        clusterId: 'in',
        turnsSinceAffirmativeEngagedCluster: 0,
        turnsSinceNegativeEngagedCluster: 3,
        negativeHasOpenRequestDirectedAtIt: true,
        roomMoveCountAtEvaluation: 10,
        clusterRootOrdinal: 1,
      });
    case 'moved_on_by_affirmative':
      return baseInput({
        clusterId: 'ma',
        turnsSinceAffirmativeEngagedCluster: 4,
        turnsSinceNegativeEngagedCluster: 0,
        affirmativeHasEverEngagedCluster: true,
        roomMoveCountAtEvaluation: 10,
        clusterRootOrdinal: 1,
      });
    case 'moved_on_by_negative':
      return baseInput({
        clusterId: 'mn',
        turnsSinceAffirmativeEngagedCluster: 0,
        turnsSinceNegativeEngagedCluster: 4,
        negativeHasEverEngagedCluster: true,
        roomMoveCountAtEvaluation: 10,
        clusterRootOrdinal: 1,
      });
    default: {
      // Compile-time exhaustiveness — switch is total over the 7 states.
      const never: never = state;
      throw new Error(`unhandled state: ${String(never)}`);
    }
  }
}

// ── 1. Fixture suite: repeated-axis exhaustion ────────────────

describe('GAME-001 — repeated-axis exhaustion fixture', () => {
  it('fires `exhausted` at threshold with correct RULE-003 label + helper', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ maxSameAxisNonAdditivePressureCount: 3 }),
    );
    expect(advisory.state).toBe('exhausted');
    expect(advisory.label).toBe(LIFECYCLE_UX_MAP.exhausted.label);
    expect(advisory.helperLine).toBe(LIFECYCLE_UX_MAP.exhausted.helperLine);
    expect(advisory.ruleFired).toBe('exhaustion.repeatThreshold');
  });

  it('does NOT fire at pressure = 2 (< threshold)', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ maxSameAxisNonAdditivePressureCount: 2 }),
    );
    expect(advisory.state).toBeNull();
    expect(advisory.ruleFired).toBeNull();
  });

  it('fires at pressure = 3 (exactly threshold)', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ maxSameAxisNonAdditivePressureCount: 3 }),
    );
    expect(advisory.state).toBe('exhausted');
  });

  it('fires at pressure = 4 (idempotent above threshold)', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ maxSameAxisNonAdditivePressureCount: 4 }),
    );
    expect(advisory.state).toBe('exhausted');
  });
});

// ── 2. Fixture suite: one-party ignored ───────────────────────

describe('GAME-001 — one-party ignored fixture', () => {
  it('fires `ignored_by_affirmative` when aff has open request + dormant', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 3,
        affirmativeHasOpenRequestDirectedAtIt: true,
      }),
    );
    expect(advisory.state).toBe('ignored_by_affirmative');
    expect(advisory.label).toBe(LIFECYCLE_UX_MAP.ignored_by_affirmative.label);
    expect(advisory.helperLine).toBe(LIFECYCLE_UX_MAP.ignored_by_affirmative.helperLine);
    expect(advisory.ruleFired).toBe('ignoredBySide.turnThreshold');
  });

  it('helper line describes the cluster (not the user)', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 3,
        affirmativeHasOpenRequestDirectedAtIt: true,
      }),
    );
    // Helper says "Affirmative has an open request unanswered." — describes
    // the cluster-side state. It must NOT say "the user" or "you" or "they".
    expect(advisory.helperLine.toLowerCase()).toContain('affirmative');
    expect(advisory.helperLine.toLowerCase()).not.toContain('the user');
    expect(advisory.helperLine.toLowerCase()).not.toContain('your opponent');
  });

  it('does NOT fire at turns = 2 (< threshold)', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 2,
        affirmativeHasOpenRequestDirectedAtIt: true,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('fires `ignored_by_negative` symmetrically', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceNegativeEngagedCluster: 3,
        negativeHasOpenRequestDirectedAtIt: true,
      }),
    );
    expect(advisory.state).toBe('ignored_by_negative');
  });

  it('does NOT fire when no open request is directed at the side', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 5,
        affirmativeHasOpenRequestDirectedAtIt: false,
        affirmativeHasEverEngagedCluster: false,
      }),
    );
    expect(advisory.state).toBeNull();
  });
});

// ── 3. Fixture suite: two-party ignored ───────────────────────

describe('GAME-001 — two-party ignored fixture', () => {
  it('fires `ignored_by_both` when both sides dormant at >= J + an open request still active', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 6,
        turnsSinceNegativeEngagedCluster: 6,
        affirmativeHasOpenRequestDirectedAtIt: true,
        roomMoveCountAtEvaluation: 20,
      }),
    );
    expect(advisory.state).toBe('ignored_by_both');
    expect(advisory.label).toBe(LIFECYCLE_UX_MAP.ignored_by_both.label);
    expect(advisory.helperLine).toBe(LIFECYCLE_UX_MAP.ignored_by_both.helperLine);
    expect(advisory.ruleFired).toBe('ignoredBoth.turnThreshold');
  });

  it('falls through to `ignored_by_affirmative` when one side at threshold and the other not', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 6,
        turnsSinceNegativeEngagedCluster: 5,
        affirmativeHasOpenRequestDirectedAtIt: true,
        roomMoveCountAtEvaluation: 20,
      }),
    );
    // Both-side threshold (6/6) not met. Aff has open request and is past
    // ignoredBySideTurnThreshold (3) — `ignored_by_affirmative` fires.
    expect(advisory.state).toBe('ignored_by_affirmative');
  });

  it('fires `ignored_by_both` at exactly J = 6', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 6,
        turnsSinceNegativeEngagedCluster: 6,
        negativeHasOpenRequestDirectedAtIt: true,
        roomMoveCountAtEvaluation: 20,
      }),
    );
    expect(advisory.state).toBe('ignored_by_both');
  });
});

// ── 4. Fixture suite: synthesis-ready ─────────────────────────

describe('GAME-001 — synthesis-ready fixture', () => {
  it('fires `synthesis_ready` with concession + no debt + age >= floor', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        hasConcessionOrNarrowing: true,
        hasUnresolvedEvidenceDebt: false,
      }),
    );
    expect(advisory.state).toBe('synthesis_ready');
    expect(advisory.label).toBe(LIFECYCLE_UX_MAP.synthesis_ready.label);
    expect(advisory.helperLine).toBe(LIFECYCLE_UX_MAP.synthesis_ready.helperLine);
    expect(advisory.ruleFired).toBe('synthesis.concessionAndNoDebt');
  });

  it('does NOT fire synthesis when evidence debt is unresolved (interlock)', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        hasConcessionOrNarrowing: true,
        hasUnresolvedEvidenceDebt: true,
        maxSameAxisNonAdditivePressureCount: 3,
      }),
    );
    expect(advisory.state).not.toBe('synthesis_ready');
    // Falls through to next qualifying rule.
    expect(advisory.state).toBe('exhausted');
  });

  it('does NOT fire synthesis without concession', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        hasConcessionOrNarrowing: false,
        hasUnresolvedEvidenceDebt: false,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('does NOT fire synthesis when age = 1 (below floor)', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        hasConcessionOrNarrowing: true,
        hasUnresolvedEvidenceDebt: false,
        roomMoveCountAtEvaluation: 8,
        clusterRootOrdinal: 7,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('defers when upstream state is `rebutted`', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        upstreamClusterState: 'rebutted',
        hasConcessionOrNarrowing: true,
        hasUnresolvedEvidenceDebt: false,
      }),
    );
    expect(advisory.state).toBeNull();
  });
});

// ── 5. Fixture suite: moved-on ────────────────────────────────

describe('GAME-001 — moved-on fixture', () => {
  it('fires `moved_on_by_affirmative` when aff dormant >= M and has ever engaged', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 4,
        affirmativeHasEverEngagedCluster: true,
        affirmativeHasOpenRequestDirectedAtIt: false,
      }),
    );
    expect(advisory.state).toBe('moved_on_by_affirmative');
    expect(advisory.ruleFired).toBe('movedOn.turnThreshold');
  });

  it('fires `moved_on_by_negative` symmetrically', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceNegativeEngagedCluster: 4,
        negativeHasEverEngagedCluster: true,
        negativeHasOpenRequestDirectedAtIt: false,
      }),
    );
    expect(advisory.state).toBe('moved_on_by_negative');
  });

  it('does NOT fire at turns = 3 (< threshold)', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 3,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('routes to `ignored_by_<side>` instead of `moved_on_by_<side>` when side has open request', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 4,
        affirmativeHasOpenRequestDirectedAtIt: true,
        affirmativeHasEverEngagedCluster: true,
      }),
    );
    expect(advisory.state).toBe('ignored_by_affirmative');
  });

  it('does NOT fire `moved_on` when the side has never engaged', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 5,
        affirmativeHasEverEngagedCluster: false,
        affirmativeHasOpenRequestDirectedAtIt: false,
      }),
    );
    expect(advisory.state).toBeNull();
  });
});

// ── 6. Doctrine pin: blocksSubmit + appliesPointStandingPenalty ──

describe('GAME-001 — no blocking / no penalty pin', () => {
  it.each(ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES)(
    '%s: blocksSubmit === false AND appliesPointStandingPenalty === false',
    (state) => {
      const advisory = deriveExhaustionTimeoutAdvisory(buildInputThatFires(state));
      expect(advisory.state).toBe(state);
      expect(advisory.blocksSubmit).toBe(false);
      expect(advisory.appliesPointStandingPenalty).toBe(false);
    },
  );

  it('null advisory also pins blocksSubmit === false / penalty === false', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(baseInput());
    expect(advisory.state).toBeNull();
    expect(advisory.blocksSubmit).toBe(false);
    expect(advisory.appliesPointStandingPenalty).toBe(false);
  });
});

// ── 7. Doctrine pin: copy ban-list ────────────────────────────

describe('GAME-001 — copy ban-list scan', () => {
  it.each(ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES)(
    '%s: label + helperLine contain no forbidden tokens',
    (state) => {
      const advisory = deriveExhaustionTimeoutAdvisory(buildInputThatFires(state));
      const banned = _forbiddenExhaustionTimeoutTokens();
      const lowerLabel = advisory.label.toLowerCase();
      const lowerHelper = advisory.helperLine.toLowerCase();
      for (const token of banned) {
        const t = token.toLowerCase();
        // Word-boundary scan to avoid false positives. Some entries (like
        // "ignored you") are multi-word phrases.
        const re = /\s/.test(t)
          ? new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          : new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        expect(lowerLabel).not.toMatch(re);
        expect(lowerHelper).not.toMatch(re);
      }
    },
  );
});

// ── 8. Doctrine pin: person-attribution scan ──────────────────

describe('GAME-001 — person-attribution scan', () => {
  it.each(ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES)(
    '%s: helperLine describes the CLUSTER, never the user',
    (state) => {
      const advisory = deriveExhaustionTimeoutAdvisory(buildInputThatFires(state));
      const helper = advisory.helperLine;
      expect(helper).not.toMatch(/\bthe user\b/i);
      expect(helper).not.toMatch(/\bthe author\b/i);
      expect(helper).not.toMatch(/\bthe poster\b/i);
      expect(helper).not.toMatch(/\bthe participant\b/i);
      expect(helper).not.toMatch(/\byour opponent\b/i);
      // The verb form "ignored" attached to a side noun is forbidden. The
      // RULE-003 helper for `ignored_by_<side>` says "has an open request
      // unanswered." (cluster shape) — never "Affirmative ignored you".
      expect(helper).not.toMatch(/\b(affirmative|negative)\s+ignored\b/i);
      expect(helper).not.toMatch(/\bthey\b.{0,30}(ignored|silent|absent|skipped)/i);
    },
  );
});

// ── 9. Priority cascade ───────────────────────────────────────

describe('GAME-001 — priority cascade', () => {
  function maximalInput(): ExhaustionTimeoutInput {
    return baseInput({
      hasConcessionOrNarrowing: true,
      hasUnresolvedEvidenceDebt: false,
      maxSameAxisNonAdditivePressureCount: 5,
      turnsSinceAffirmativeEngagedCluster: 6,
      turnsSinceNegativeEngagedCluster: 6,
      affirmativeHasOpenRequestDirectedAtIt: true,
      negativeHasOpenRequestDirectedAtIt: true,
      affirmativeHasEverEngagedCluster: true,
      negativeHasEverEngagedCluster: true,
      roomMoveCountAtEvaluation: 20,
      clusterRootOrdinal: 1,
    });
  }

  it('all rules qualify → synthesis_ready wins', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(maximalInput());
    expect(advisory.state).toBe('synthesis_ready');
  });

  it('strip synthesis prereq (debt = true) → exhausted', () => {
    const advisory = deriveExhaustionTimeoutAdvisory({
      ...maximalInput(),
      hasUnresolvedEvidenceDebt: true,
    });
    expect(advisory.state).toBe('exhausted');
  });

  it('strip exhaustion prereq (pressure = 0) → ignored_by_both', () => {
    const advisory = deriveExhaustionTimeoutAdvisory({
      ...maximalInput(),
      hasUnresolvedEvidenceDebt: true,
      maxSameAxisNonAdditivePressureCount: 0,
    });
    expect(advisory.state).toBe('ignored_by_both');
  });

  it('strip both-side prereq (one side at 5, other at 6) → ignored_by_<higher-turn>', () => {
    const advisory = deriveExhaustionTimeoutAdvisory({
      ...maximalInput(),
      hasUnresolvedEvidenceDebt: true,
      maxSameAxisNonAdditivePressureCount: 0,
      turnsSinceAffirmativeEngagedCluster: 6,
      turnsSinceNegativeEngagedCluster: 5,
    });
    expect(advisory.state).toBe('ignored_by_affirmative');
  });

  it('strip the open-request flag → moved_on_by_<side>', () => {
    const advisory = deriveExhaustionTimeoutAdvisory({
      ...maximalInput(),
      hasUnresolvedEvidenceDebt: true,
      maxSameAxisNonAdditivePressureCount: 0,
      turnsSinceAffirmativeEngagedCluster: 5,
      turnsSinceNegativeEngagedCluster: 4,
      affirmativeHasOpenRequestDirectedAtIt: false,
      negativeHasOpenRequestDirectedAtIt: false,
    });
    // Higher turn wins → affirmative.
    expect(advisory.state).toBe('moved_on_by_affirmative');
  });
});

// ── 10. N boundary: exhaustion ────────────────────────────────

describe('GAME-001 — exhaustion threshold boundaries', () => {
  const N = DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.exhaustionRepeatThreshold;
  it(`pressure = N-1 (${N - 1}): no state`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ maxSameAxisNonAdditivePressureCount: N - 1 }),
    );
    expect(advisory.state).toBeNull();
  });
  it(`pressure = N (${N}): exhausted`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ maxSameAxisNonAdditivePressureCount: N }),
    );
    expect(advisory.state).toBe('exhausted');
  });
  it(`pressure = N+1 (${N + 1}): exhausted (idempotent)`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ maxSameAxisNonAdditivePressureCount: N + 1 }),
    );
    expect(advisory.state).toBe('exhausted');
  });
});

// ── 11. M boundary: moved-on ──────────────────────────────────

describe('GAME-001 — moved-on threshold boundaries', () => {
  const M = DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.movedOnTurnThreshold;
  it(`turns = M-1 (${M - 1}): no state`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ turnsSinceAffirmativeEngagedCluster: M - 1 }),
    );
    expect(advisory.state).toBeNull();
  });
  it(`turns = M (${M}): moved_on_by_affirmative`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ turnsSinceAffirmativeEngagedCluster: M }),
    );
    expect(advisory.state).toBe('moved_on_by_affirmative');
  });
  it(`turns = M+1 (${M + 1}): moved_on_by_affirmative`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ turnsSinceAffirmativeEngagedCluster: M + 1 }),
    );
    expect(advisory.state).toBe('moved_on_by_affirmative');
  });
});

// ── 12. K boundary: ignored-by-side ───────────────────────────

describe('GAME-001 — ignored-by-side threshold boundaries', () => {
  const K = DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.ignoredBySideTurnThreshold;
  it(`turns = K-1 (${K - 1}) with open request: no state`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: K - 1,
        affirmativeHasOpenRequestDirectedAtIt: true,
      }),
    );
    expect(advisory.state).toBeNull();
  });
  it(`turns = K (${K}) with open request: ignored_by_affirmative`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: K,
        affirmativeHasOpenRequestDirectedAtIt: true,
      }),
    );
    expect(advisory.state).toBe('ignored_by_affirmative');
  });
  it(`turns = K+1 (${K + 1}) with open request: ignored_by_affirmative`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: K + 1,
        affirmativeHasOpenRequestDirectedAtIt: true,
      }),
    );
    expect(advisory.state).toBe('ignored_by_affirmative');
  });
});

// ── 13. J boundary: ignored-by-both ───────────────────────────

describe('GAME-001 — ignored-by-both threshold boundaries', () => {
  const J = DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.ignoredByBothTurnThreshold;
  it(`turns = J-1 / J (5/6): falls to single-side`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: J - 1,
        turnsSinceNegativeEngagedCluster: J,
        negativeHasOpenRequestDirectedAtIt: true,
        roomMoveCountAtEvaluation: 20,
      }),
    );
    expect(advisory.state).toBe('ignored_by_negative');
  });
  it(`turns = J / J (6/6): ignored_by_both`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: J,
        turnsSinceNegativeEngagedCluster: J,
        negativeHasOpenRequestDirectedAtIt: true,
        roomMoveCountAtEvaluation: 20,
      }),
    );
    expect(advisory.state).toBe('ignored_by_both');
  });
  it(`turns = J+1 / J+1 (7/7): ignored_by_both`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: J + 1,
        turnsSinceNegativeEngagedCluster: J + 1,
        affirmativeHasOpenRequestDirectedAtIt: true,
        roomMoveCountAtEvaluation: 20,
      }),
    );
    expect(advisory.state).toBe('ignored_by_both');
  });
});

// ── 14. minClusterAgeForTimeoutAdvisory floor ─────────────────

describe('GAME-001 — minClusterAgeForTimeoutAdvisory floor', () => {
  const floor = DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.minClusterAgeForTimeoutAdvisory;

  it(`age = floor-1 (${floor - 1}): no state even with every rule otherwise qualifying`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        maxSameAxisNonAdditivePressureCount: 99,
        hasConcessionOrNarrowing: true,
        roomMoveCountAtEvaluation: floor, // floor - (floor-1) = 1 < floor
        clusterRootOrdinal: 1,
        // age = floor - 1 (since roomMoveCount - rootOrdinal = floor - 1)
      }),
    );
    // Recompute roomMoveCount so age = floor - 1: rootOrdinal = 1,
    // roomMoveCount = floor (so age = floor - 1).
    expect(advisory.state).toBeNull();
  });

  it(`age = floor (${floor}): fires`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        maxSameAxisNonAdditivePressureCount: 3,
        roomMoveCountAtEvaluation: floor + 1,
        clusterRootOrdinal: 1,
      }),
    );
    expect(advisory.state).toBe('exhausted');
  });

  it(`age = floor+1 (${floor + 1}): fires`, () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        maxSameAxisNonAdditivePressureCount: 3,
        roomMoveCountAtEvaluation: floor + 2,
        clusterRootOrdinal: 1,
      }),
    );
    expect(advisory.state).toBe('exhausted');
  });

  it('synthesis_ready also respects the floor', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        hasConcessionOrNarrowing: true,
        hasUnresolvedEvidenceDebt: false,
        roomMoveCountAtEvaluation: floor, // age = floor - 1
        clusterRootOrdinal: 1,
      }),
    );
    expect(advisory.state).toBeNull();
  });
});

// ── 15. Override-threshold tests ──────────────────────────────

describe('GAME-001 — caller-passed override thresholds', () => {
  const customConfig = {
    ...DEFAULT_EXHAUSTION_TIMEOUT_CONFIG,
    exhaustionRepeatThreshold: 5,
  };

  it('pressure = 4 (< override 5): no state', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        maxSameAxisNonAdditivePressureCount: 4,
        config: customConfig,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('pressure = 5 (= override 5): exhausted', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        maxSameAxisNonAdditivePressureCount: 5,
        config: customConfig,
      }),
    );
    expect(advisory.state).toBe('exhausted');
  });

  it('pressure = 6 (> override 5): exhausted', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        maxSameAxisNonAdditivePressureCount: 6,
        config: customConfig,
      }),
    );
    expect(advisory.state).toBe('exhausted');
  });
});

// ── 16. Defaults parity with LIFE-001 ─────────────────────────

describe('GAME-001 — defaults parity with LIFE-001', () => {
  it('exhaustionRepeatThreshold matches LIFE-001 default', () => {
    expect(DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.exhaustionRepeatThreshold)
      .toBe(DEFAULT_LIFECYCLE_ADVISORY_CONFIG.exhaustionRepeatThreshold);
  });
  it('movedOnTurnThreshold matches LIFE-001 default', () => {
    expect(DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.movedOnTurnThreshold)
      .toBe(DEFAULT_LIFECYCLE_ADVISORY_CONFIG.movedOnTurnThreshold);
  });
  it('ignoredBySideTurnThreshold matches LIFE-001 default', () => {
    expect(DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.ignoredBySideTurnThreshold)
      .toBe(DEFAULT_LIFECYCLE_ADVISORY_CONFIG.ignoredBySideTurnThreshold);
  });
  it('ignoredByBothTurnThreshold matches LIFE-001 default', () => {
    expect(DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.ignoredByBothTurnThreshold)
      .toBe(DEFAULT_LIFECYCLE_ADVISORY_CONFIG.ignoredByBothTurnThreshold);
  });
});

// ── 17. Edge cases ────────────────────────────────────────────

describe('GAME-001 — edge cases', () => {
  it('empty cluster (age 0): no state', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        maxSameAxisNonAdditivePressureCount: 99,
        hasConcessionOrNarrowing: true,
        roomMoveCountAtEvaluation: 0,
        clusterRootOrdinal: 0,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('upstream `archived_or_resolved`: no state', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        upstreamClusterState: 'archived_or_resolved',
        maxSameAxisNonAdditivePressureCount: 99,
        hasConcessionOrNarrowing: true,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('upstream `conceded`: no state', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        upstreamClusterState: 'conceded',
        maxSameAxisNonAdditivePressureCount: 9,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('upstream `synthesis_ready` (LIFE-001 strict): defers', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        upstreamClusterState: 'synthesis_ready',
        hasConcessionOrNarrowing: true,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('open request at aff with turns = 0: no state (zero-turns nonsense)', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        affirmativeHasOpenRequestDirectedAtIt: true,
        turnsSinceAffirmativeEngagedCluster: 0,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('cluster root ordinal > room move count (malformed): no state, no throw', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        maxSameAxisNonAdditivePressureCount: 9,
        roomMoveCountAtEvaluation: 1,
        clusterRootOrdinal: 5,
      }),
    );
    expect(advisory.state).toBeNull();
  });

  it('negative override threshold: clamped to 0, fires on any positive pressure', () => {
    const customConfig = {
      ...DEFAULT_EXHAUSTION_TIMEOUT_CONFIG,
      exhaustionRepeatThreshold: -1,
    };
    const advisory = deriveExhaustionTimeoutAdvisory(
      baseInput({
        maxSameAxisNonAdditivePressureCount: 1,
        config: customConfig,
      }),
    );
    expect(advisory.state).toBe('exhausted');
  });

  it('both moved_on sides qualify: higher turn wins; ties go to negative', () => {
    const adv1 = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 5,
        turnsSinceNegativeEngagedCluster: 4,
      }),
    );
    expect(adv1.state).toBe('moved_on_by_affirmative');

    const adv2 = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 4,
        turnsSinceNegativeEngagedCluster: 5,
      }),
    );
    expect(adv2.state).toBe('moved_on_by_negative');

    const adv3 = deriveExhaustionTimeoutAdvisory(
      baseInput({
        turnsSinceAffirmativeEngagedCluster: 4,
        turnsSinceNegativeEngagedCluster: 4,
      }),
    );
    expect(adv3.state).toBe('moved_on_by_negative'); // tie → negative
  });

  it('null return shape is fully populated', () => {
    const advisory = deriveExhaustionTimeoutAdvisory(baseInput());
    expect(advisory.state).toBeNull();
    expect(advisory.label).toBe('');
    expect(advisory.helperLine).toBe('');
    expect(advisory.ruleFired).toBeNull();
    expect(advisory.clusterId).toBe('cluster-1');
    expect(advisory.blocksSubmit).toBe(false);
    expect(advisory.appliesPointStandingPenalty).toBe(false);
  });
});

// ── 18. Adapter: buildExhaustionTimeoutInputFromLifecycle ─────

describe('GAME-001 — adapter (buildExhaustionTimeoutInputFromLifecycle)', () => {
  function adapterInput(
    over: Partial<BuildExhaustionTimeoutInputFromLifecycleInput> = {},
  ): BuildExhaustionTimeoutInputFromLifecycleInput {
    const m1 = fakeNode({ messageId: 'm1', sideLabel: 'Aff', ordinal: 1, isRoot: true });
    const m2 = fakeNode({
      messageId: 'm2',
      parentId: 'm1',
      sideLabel: 'Neg',
      ordinal: 2,
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'logic_axis', label: 'logic', color: '' }],
    });
    return {
      clusterSummary: over.clusterSummary ?? fakeSummary({
        clusterId: 'cluster-1',
        rootMessageId: 'm1',
        messageIds: ['m1', 'm2'],
        memberCount: 2,
        state: 'open',
      }),
      clusterMembers: over.clusterMembers ?? [m1, m2],
      sideTurnSequence: over.sideTurnSequence ?? new Map([
        ['affirmative', ['m1', 'm3']],
        ['negative', ['m2']],
      ]),
      artifactStatusByMessageId: over.artifactStatusByMessageId ?? new Map(),
      roomMoveCountAtEvaluation: over.roomMoveCountAtEvaluation ?? 5,
      clusterRootOrdinal: over.clusterRootOrdinal ?? 1,
      config: over.config,
    };
  }

  it('produces a record carrying the cluster id from the summary', () => {
    const out = buildExhaustionTimeoutInputFromLifecycle(adapterInput());
    expect(out.clusterId).toBe('cluster-1');
  });

  it('passes the upstream cluster state through', () => {
    const out = buildExhaustionTimeoutInputFromLifecycle(adapterInput({
      clusterSummary: fakeSummary({ clusterId: 'cluster-1', state: 'rebutted' }),
    }));
    expect(out.upstreamClusterState).toBe('rebutted');
  });

  it('counts non-additive same-axis pressure', () => {
    // Three rebuttals on the same `logic_axis` with no additive info.
    const root = fakeNode({ messageId: 'r', sideLabel: 'Aff', isRoot: true });
    const r1 = fakeNode({
      messageId: 'r1', parentId: 'r', sideLabel: 'Neg',
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'logic_axis', label: '', color: '' }],
    });
    const r2 = fakeNode({
      messageId: 'r2', parentId: 'r1', sideLabel: 'Aff',
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'logic_axis', label: '', color: '' }],
    });
    const r3 = fakeNode({
      messageId: 'r3', parentId: 'r2', sideLabel: 'Neg',
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'logic_axis', label: '', color: '' }],
    });
    const out = buildExhaustionTimeoutInputFromLifecycle(adapterInput({
      clusterMembers: [root, r1, r2, r3],
    }));
    expect(out.maxSameAxisNonAdditivePressureCount).toBe(3);
  });

  it('subtracts additive moves from the pressure count', () => {
    const root = fakeNode({ messageId: 'r', sideLabel: 'Aff', isRoot: true });
    const r1 = fakeNode({
      messageId: 'r1', parentId: 'r', sideLabel: 'Neg',
      kindLabel: 'rebuttal',
      droppedTags: [{ code: 'logic_axis', label: '', color: '' }],
    });
    const r2 = fakeNode({
      messageId: 'r2', parentId: 'r1', sideLabel: 'Aff',
      kindLabel: 'rebuttal',
      droppedTags: [
        { code: 'logic_axis', label: '', color: '' },
        { code: 'narrow_scope', label: '', color: '' }, // additive
      ],
    });
    const out = buildExhaustionTimeoutInputFromLifecycle(adapterInput({
      clusterMembers: [root, r1, r2],
    }));
    expect(out.maxSameAxisNonAdditivePressureCount).toBe(1);
  });

  it('detects concession-or-narrowing via argument type or qualifier', () => {
    const m1 = fakeNode({ messageId: 'm1', sideLabel: 'Aff', isRoot: true });
    const mConcession = fakeNode({
      messageId: 'm2', parentId: 'm1', sideLabel: 'Neg', kindLabel: 'concession',
    });
    const out = buildExhaustionTimeoutInputFromLifecycle(adapterInput({
      clusterMembers: [m1, mConcession],
    }));
    expect(out.hasConcessionOrNarrowing).toBe(true);
  });

  it('detects evidence debt from cluster summary OR worst status', () => {
    const out1 = buildExhaustionTimeoutInputFromLifecycle(adapterInput({
      clusterSummary: fakeSummary({
        clusterId: 'cluster-1',
        hasOpenSourceOrQuoteRequest: true,
      }),
    }));
    expect(out1.hasUnresolvedEvidenceDebt).toBe(true);

    const root = fakeNode({ messageId: 'r', sideLabel: 'Aff', isRoot: true, kindLabel: 'claim' });
    const out2 = buildExhaustionTimeoutInputFromLifecycle(adapterInput({
      clusterMembers: [root],
      artifactStatusByMessageId: new Map([['r', 'no_source' as SourceChainStatus]]),
    }));
    expect(out2.hasUnresolvedEvidenceDebt).toBe(true);
  });

  it('detects has-ever-engaged for each side', () => {
    const m1 = fakeNode({ messageId: 'm1', sideLabel: 'Aff', isRoot: true });
    const out = buildExhaustionTimeoutInputFromLifecycle(adapterInput({
      clusterMembers: [m1],
    }));
    expect(out.affirmativeHasEverEngagedCluster).toBe(true);
    expect(out.negativeHasEverEngagedCluster).toBe(false);
  });

  it('is idempotent (same input → deep-equal output)', () => {
    const input = adapterInput();
    const out1 = buildExhaustionTimeoutInputFromLifecycle(input);
    const out2 = buildExhaustionTimeoutInputFromLifecycle(input);
    expect(out1).toEqual(out2);
  });

  it('does not mutate its inputs', () => {
    const input = adapterInput();
    const snapshot = JSON.stringify({
      ...input,
      sideTurnSequence: Array.from(input.sideTurnSequence.entries()),
      artifactStatusByMessageId: Array.from(input.artifactStatusByMessageId.entries()),
    });
    buildExhaustionTimeoutInputFromLifecycle(input);
    const after = JSON.stringify({
      ...input,
      sideTurnSequence: Array.from(input.sideTurnSequence.entries()),
      artifactStatusByMessageId: Array.from(input.artifactStatusByMessageId.entries()),
    });
    expect(after).toBe(snapshot);
  });

  it('round-trips through the deriver to fire a synthesis_ready advisory', () => {
    const root = fakeNode({ messageId: 'r', sideLabel: 'Aff', isRoot: true, kindLabel: 'claim' });
    const concession = fakeNode({
      messageId: 'c', parentId: 'r', sideLabel: 'Neg', kindLabel: 'concession', ordinal: 2,
    });
    const input = buildExhaustionTimeoutInputFromLifecycle({
      clusterSummary: fakeSummary({
        clusterId: 'cluster-1',
        rootMessageId: 'r',
        state: 'narrowed', // permissive upstream — but narrowed defers in the deriver
        memberCount: 2,
      }),
      clusterMembers: [root, concession],
      sideTurnSequence: new Map([
        ['affirmative', ['r', 'm3']],
        ['negative', ['c']],
      ]),
      artifactStatusByMessageId: new Map(),
      roomMoveCountAtEvaluation: 5,
      clusterRootOrdinal: 1,
    });
    const advisory = deriveExhaustionTimeoutAdvisory(input);
    // `narrowed` is in the defer set — advisory returns null.
    expect(advisory.state).toBeNull();
  });
});

// ── 19. Purity / determinism / source-scan ────────────────────

describe('GAME-001 — purity and determinism', () => {
  it('same input → same output across 10 invocations', () => {
    const input = baseInput({ maxSameAxisNonAdditivePressureCount: 3 });
    const first = deriveExhaustionTimeoutAdvisory(input);
    for (let i = 0; i < 10; i += 1) {
      expect(deriveExhaustionTimeoutAdvisory(input)).toEqual(first);
    }
  });

  it('does not mutate the input', () => {
    const input = baseInput({ maxSameAxisNonAdditivePressureCount: 3 });
    const snapshot = JSON.stringify(input);
    deriveExhaustionTimeoutAdvisory(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('source file contains no AI / network / time / random imports', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'features', 'lifecycle', 'exhaustionTimeoutModel.ts'),
      'utf8',
    );
    // No React / React Native / Expo / Supabase / anthropic / xai imports.
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/from\s+['"]react-native['"]/);
    expect(src).not.toMatch(/from\s+['"]expo['"]/);
    expect(src).not.toMatch(/from\s+['"]@supabase\//);
    expect(src).not.toMatch(/from\s+['"]\.\.\/\.\.\/lib\/supabase['"]/);
    expect(src).not.toMatch(/@anthropic-ai\/sdk/);
    expect(src).not.toMatch(/from\s+['"]@anthropic/);
    expect(src).not.toMatch(/api\.x\.ai/);
    // No fetch / XMLHttpRequest / WebSocket.
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
    // No time / random reads.
    expect(src).not.toMatch(/Date\.now\s*\(/);
    expect(src).not.toMatch(/Math\.random\s*\(/);
    // No process.env reads.
    expect(src).not.toMatch(/process\.env/);
    // No console.* calls.
    expect(src).not.toMatch(/\bconsole\.(log|warn|error|info|debug)\s*\(/);
    // No import from sacred engine.
    expect(src).not.toMatch(/from\s+['"][^'"]*constitution\/engine/);
  });

  it('does not import submit-argument or validation paths', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'features', 'lifecycle', 'exhaustionTimeoutModel.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/submit-argument/);
    expect(src).not.toMatch(/from\s+['"][^'"]*validation\//);
  });
});

// ── 20. Every producible state has a RULE-003 entry ───────────

describe('GAME-001 — RULE-003 coverage', () => {
  it.each(ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES)(
    '%s has a non-empty label + helperLine in LIFECYCLE_UX_MAP',
    (state) => {
      const entry = LIFECYCLE_UX_MAP[state];
      expect(entry).toBeDefined();
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.helperLine.length).toBeGreaterThan(0);
    },
  );
});

// ── 21. Sanity check on returned advisory shape ───────────────

describe('GAME-001 — advisory record shape', () => {
  it('exposes every expected field', () => {
    const advisory: ExhaustionTimeoutAdvisory = deriveExhaustionTimeoutAdvisory(
      baseInput({ maxSameAxisNonAdditivePressureCount: 3 }),
    );
    expect(advisory).toEqual({
      clusterId: 'cluster-1',
      state: 'exhausted',
      label: LIFECYCLE_UX_MAP.exhausted.label,
      helperLine: LIFECYCLE_UX_MAP.exhausted.helperLine,
      ruleFired: 'exhaustion.repeatThreshold',
      blocksSubmit: false,
      appliesPointStandingPenalty: false,
    });
  });
});
