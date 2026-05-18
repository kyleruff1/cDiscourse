/**
 * AN-001 — Tests for `computeBoardDiagnostics`.
 *
 * Pure-model coverage:
 *   - Counts (roots / rebuttals / evidence / branch / concession / synthesis-ready / clarification)
 *   - No-rebuttal root detection
 *   - Evidence-debt flag rollup
 *   - Strong / weak / neutral / not-enough-signal counts via the existing
 *     `inferStandingBand` engine
 *   - Hot-zone detection (depth + recency thresholds, ordering)
 *   - Unresolved-axis detection (concession resolves; evidence does not)
 *   - Determinism: same input → same fingerprint
 *   - Empty input safety
 *   - No verdict / truth tokens in any exported symbol or label
 */

import {
  computeBoardDiagnostics,
  type BoardDiagnosticsArgumentInput,
  type BoardDiagnosticsInput,
  __internal,
} from '../src/features/analytics/boardDiagnostics';

const NOW = new Date('2026-05-18T12:00:00.000Z').getTime();
const MIN = 60 * 1000;
const HR = 60 * MIN;

function arg(
  id: string,
  parentId: string | null,
  argumentType: string,
  createdAt: string,
  extra?: Partial<BoardDiagnosticsArgumentInput>,
): BoardDiagnosticsArgumentInput {
  return {
    id,
    debateId: 'd1',
    parentId,
    authorId: 'u-' + id,
    argumentType,
    body: 'body ' + id,
    createdAt,
    ...extra,
  };
}

function iso(offsetMs: number): string {
  return new Date(NOW - offsetMs).toISOString();
}

describe('computeBoardDiagnostics — counts', () => {
  test('empty input is safe', () => {
    const out = computeBoardDiagnostics({ arguments: [], nowMs: NOW });
    expect(out.totalMessages).toBe(0);
    expect(out.rootCount).toBe(0);
    expect(out.rebuttalCount).toBe(0);
    expect(out.noRebuttalRootCount).toBe(0);
    expect(out.hotZones).toEqual([]);
    expect(out.unresolvedAxes).toEqual([]);
    expect(out.standingBandCounts.neutral).toBe(0);
    expect(out.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  test('roots vs rebuttals are counted on parent_id', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r1', null, 'thesis', iso(2 * HR)),
        arg('r2', null, 'thesis', iso(2 * HR)),
        arg('c1', 'r1', 'rebuttal', iso(HR)),
        arg('c2', 'c1', 'counter_rebuttal', iso(30 * MIN)),
      ],
      nowMs: NOW,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.totalMessages).toBe(4);
    expect(out.rootCount).toBe(2);
    expect(out.rebuttalCount).toBe(2);
    expect(out.noRebuttalRootCount).toBe(1); // r2 has no children
  });

  test('evidence / branch / concession / synthesis / clarification counts', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(2 * HR)),
        arg('e1', 'r', 'evidence', iso(HR)),
        arg('e2', 'r', 'source', iso(HR)),
        arg('b1', 'r', 'branch', iso(HR)),
        arg('cl1', 'r', 'clarification_request', iso(HR)),
        arg('cl2', 'r', 'ask_source', iso(HR)),
        arg('co1', 'r', 'concession', iso(HR)),
        arg('co2', 'r', 'synthesis', iso(HR)),
      ],
      tagsByArgumentId: {
        e1: ['synthesis_ready'],
      },
      nowMs: NOW,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.evidenceCount).toBe(2);
    expect(out.branchCount).toBe(1);
    expect(out.clarificationCount).toBe(2);
    expect(out.concessionCount).toBe(2);
    // synthesis-ready: e1 tagged + co2 typed === 'synthesis'
    expect(out.synthesisReadyCount).toBe(2);
  });

  test('evidence-debt flag rollup picks up all known codes', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(HR)),
        arg('a', 'r', 'rebuttal', iso(MIN)),
        arg('b', 'r', 'rebuttal', iso(MIN)),
        arg('c', 'r', 'rebuttal', iso(MIN)),
        arg('d', 'r', 'rebuttal', iso(MIN)),
      ],
      flagsByArgumentId: {
        a: ['evidence_required'],
        b: ['evidence_debt'],
        c: ['platform_support_warning'],
        d: ['amplification_observed', 'source_chain'],
      },
      nowMs: NOW,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.evidenceDebtCount).toBe(4);
  });
});

describe('computeBoardDiagnostics — strong / weak / neutral counts', () => {
  test('classifies via inferStandingBand', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('strong', null, 'evidence', iso(HR), { body: 'long body with sources cited' }),
        arg('weak', null, 'thesis', iso(HR)),
        arg('neutral', null, 'thesis', iso(HR)),
      ],
      flagsByArgumentId: {
        weak: ['off_topic'],
        neutral: ['weak_topic'],
      },
      tagsByArgumentId: {
        strong: ['concession_marker'],
      },
      nowMs: NOW,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.strongCount).toBeGreaterThanOrEqual(1);
    expect(out.weakCount).toBeGreaterThanOrEqual(1);
    const sum = Object.values(out.standingBandCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(3);
  });

  test('returns a 9-key standingBandCounts map with all bands present', () => {
    const out = computeBoardDiagnostics({ arguments: [], nowMs: NOW });
    const keys = Object.keys(out.standingBandCounts).sort();
    expect(keys).toEqual([
      'completely_right',
      'maybe_right_misguided',
      'neutral',
      'not_enough_signal',
      'pretty_right',
      'pretty_wrong',
      'slightly_right',
      'slightly_wrong',
      'unscored',
    ]);
  });
});

describe('computeBoardDiagnostics — hot zones', () => {
  test('depth threshold gates inclusion', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(10 * MIN)),
        arg('a', 'r', 'rebuttal', iso(8 * MIN)),
        arg('b', 'a', 'counter_rebuttal', iso(6 * MIN)),
        arg('c', 'b', 'counter_rebuttal', iso(4 * MIN)),
        arg('d', 'c', 'counter_rebuttal', iso(2 * MIN)),
      ],
      nowMs: NOW,
      hotZoneMinDepth: 3,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.hotZoneCount).toBe(1);
    expect(out.hotZones[0].leafArgumentId).toBe('d');
    expect(out.hotZones[0].depth).toBe(4);
    expect(out.hotZones[0].rootArgumentId).toBe('r');
  });

  test('recency threshold gates inclusion', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(48 * HR)),
        arg('a', 'r', 'rebuttal', iso(48 * HR)),
        arg('b', 'a', 'counter_rebuttal', iso(48 * HR)),
        arg('c', 'b', 'counter_rebuttal', iso(48 * HR)),
      ],
      nowMs: NOW,
      hotZoneMinDepth: 3,
      hotZoneRecencyMs: HR,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.hotZoneCount).toBe(0);
  });

  test('ordering — freshest first, then deepest, then id', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(50 * MIN)),
        arg('a', 'r', 'rebuttal', iso(40 * MIN)),
        arg('b', 'a', 'counter_rebuttal', iso(30 * MIN)),
        arg('c', 'b', 'counter_rebuttal', iso(20 * MIN)),
        arg('c2', 'b', 'counter_rebuttal', iso(10 * MIN)),
      ],
      nowMs: NOW,
      hotZoneMinDepth: 3,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.hotZones.length).toBe(2);
    expect(out.hotZones[0].leafArgumentId).toBe('c2');
    expect(out.hotZones[1].leafArgumentId).toBe('c');
  });

  test('respects maxHotZones cap', () => {
    const messages: BoardDiagnosticsArgumentInput[] = [arg('r', null, 'thesis', iso(60 * MIN))];
    for (let i = 0; i < 5; i++) {
      messages.push(arg(`l${i}-1`, 'r', 'rebuttal', iso(50 * MIN - i * MIN)));
      messages.push(arg(`l${i}-2`, `l${i}-1`, 'counter_rebuttal', iso(45 * MIN - i * MIN)));
      messages.push(arg(`l${i}-3`, `l${i}-2`, 'counter_rebuttal', iso(40 * MIN - i * MIN)));
    }
    const out = computeBoardDiagnostics({ arguments: messages, nowMs: NOW, hotZoneMinDepth: 3, maxHotZones: 2 });
    expect(out.hotZoneCount).toBe(5);
    expect(out.hotZones.length).toBe(2);
  });
});

describe('computeBoardDiagnostics — unresolved axes', () => {
  test('concession resolves the axis', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(2 * HR)),
        arg('ch', 'r', 'rebuttal', iso(HR)),
        arg('co', 'ch', 'concession', iso(30 * MIN)),
      ],
      nowMs: NOW,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.unresolvedAxisCount).toBe(0);
  });

  test('evidence reply alone does NOT resolve the axis', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(2 * HR)),
        arg('ch', 'r', 'rebuttal', iso(HR)),
        arg('ev', 'ch', 'evidence', iso(30 * MIN)),
      ],
      nowMs: NOW,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.unresolvedAxisCount).toBe(1);
    expect(out.unresolvedAxes[0].hasEvidenceReply).toBe(true);
    expect(out.unresolvedAxes[0].hasConcession).toBe(false);
  });

  test('axes ordered by descendant count desc, then age desc', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(3 * HR)),
        arg('chA', 'r', 'rebuttal', iso(2 * HR)),
        arg('chA1', 'chA', 'rebuttal', iso(2 * HR)),
        arg('chA2', 'chA', 'rebuttal', iso(HR)),
        arg('chB', 'r', 'disagree', iso(2 * HR)),
        arg('chB1', 'chB', 'rebuttal', iso(HR)),
      ],
      nowMs: NOW,
    };
    const out = computeBoardDiagnostics(input);
    expect(out.unresolvedAxes.map((a) => a.challengeArgumentId)).toEqual([
      'chA', 'chB', 'chA1', 'chA2', 'chB1',
    ]);
  });

  test('respects maxUnresolvedAxes cap', () => {
    const messages: BoardDiagnosticsArgumentInput[] = [arg('r', null, 'thesis', iso(HR))];
    for (let i = 0; i < 15; i++) {
      messages.push(arg(`ch${i}`, 'r', 'rebuttal', iso(HR - i * MIN)));
    }
    const out = computeBoardDiagnostics({ arguments: messages, nowMs: NOW, maxUnresolvedAxes: 5 });
    expect(out.unresolvedAxisCount).toBe(15);
    expect(out.unresolvedAxes.length).toBe(5);
  });
});

describe('computeBoardDiagnostics — determinism + fingerprint', () => {
  test('same input → same fingerprint', () => {
    const input: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(HR)),
        arg('a', 'r', 'rebuttal', iso(30 * MIN)),
        arg('b', 'a', 'counter_rebuttal', iso(15 * MIN)),
      ],
      nowMs: NOW,
    };
    const a = computeBoardDiagnostics(input);
    const b = computeBoardDiagnostics(input);
    expect(a).toEqual(b);
  });

  test('different shape → different fingerprint', () => {
    const base: BoardDiagnosticsInput = {
      arguments: [arg('r', null, 'thesis', iso(HR))],
      nowMs: NOW,
    };
    const enriched: BoardDiagnosticsInput = {
      arguments: [
        arg('r', null, 'thesis', iso(HR)),
        arg('a', 'r', 'rebuttal', iso(30 * MIN)),
      ],
      nowMs: NOW,
    };
    expect(computeBoardDiagnostics(base).fingerprint).not.toEqual(
      computeBoardDiagnostics(enriched).fingerprint,
    );
  });

  test('fingerprint is 8 hex chars', () => {
    const out = computeBoardDiagnostics({ arguments: [], nowMs: NOW });
    expect(out.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('computeBoardDiagnostics — language / safety', () => {
  test('exported labels never contain verdict or truth tokens', () => {
    const sets = [
      __internal.STRONG_BANDS,
      __internal.WEAK_BANDS,
      [...__internal.EVIDENCE_ARG_TYPES],
      [...__internal.BRANCH_ARG_TYPES],
      [...__internal.CONCESSION_ARG_TYPES],
      [...__internal.CLARIFICATION_ARG_TYPES],
      [...__internal.CHALLENGE_ARG_TYPES],
      [...__internal.EVIDENCE_DEBT_FLAG_CODES],
      [...__internal.SYNTHESIS_READY_TAG_CODES],
    ];
    const banned = /\b(winner|loser|liar|dishonest|extremist|propagandist|stupid|idiot|astroturfer|manipulative)\b/i;
    for (const set of sets) {
      for (const v of set) {
        expect(String(v)).not.toMatch(banned);
      }
    }
  });
});
