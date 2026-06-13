/**
 * REF-006-RAIL — Open Issues rail model (the pure iterator).
 *
 * Pure-model coverage of the four exported helpers:
 *   - `isOpenIssue` — the exact Layer-2 open/closed predicate.
 *   - `ledgerRank` — the frozen seven-tier procedural-urgency rank.
 *   - `compareLedgerCandidates` — rank asc → recency desc → id asc; determinism.
 *   - `buildOpenIssuesLedger` — filter + order + cap + honest overflow + shape.
 * Plus a purity source-scan (no React / RN / Supabase / fetch / Date.now) and
 * a no-engagement-field-reads scan (ordering is procedural only).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildOpenIssuesLedger,
  compareLedgerCandidates,
  isOpenIssue,
  ledgerRank,
  OPEN_ISSUES_RAIL_COPY,
  RAIL_PROPOSITION_CAP,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_MOVES_PER_ENTRY,
  TERMINAL_DISPLAY_STATES,
  CLOSED_LIFECYCLE_STATES,
  CANDIDATE_SIGNAL_TAGS,
  OPEN_ISSUES_RAIL_BUILD_CAP,
  type OpenIssueLedgerCandidate,
} from '../src/features/arguments/openIssuesRail/openIssuesRailModel';
import { ALL_POINT_LIFECYCLE_STATES } from '../src/features/lifecycle';
import {
  ALL_ISSUE_STATES,
  type DisagreementAxis,
  type IssueBurden,
  type IssueState,
  type MoveSuggestion,
  type OpenIssue,
  type RelationToParent,
} from '../src/features/refereeLoop';

const MODEL_PATH = join(
  __dirname,
  '../src/features/arguments/openIssuesRail/openIssuesRailModel.ts',
);

// ── local factories (the model tests build OpenIssue literals directly so
//    the burden / state / axis / id combos are exact) ──

function makeMove(actEntryId: MoveSuggestion['actEntryId'], label: string): MoveSuggestion {
  return {
    actEntryId,
    label,
    accessibilityLabel: `${label} (verbose)`,
    isRecoveryRoute: false,
    recoveredFromCode: null,
  };
}

function makeIssue(overrides: Partial<OpenIssue> = {}): OpenIssue {
  const targetNodeId = overrides.targetNodeId ?? 'node-1';
  const relation: RelationToParent = overrides.relationToParent ?? 'challenges';
  const axis: DisagreementAxis = overrides.axis ?? 'evidence';
  return {
    id: overrides.id ?? `issue:${targetNodeId}:${relation}:${axis}`,
    roomId: overrides.roomId ?? 'room-1',
    targetNodeId,
    targetQuote: overrides.targetQuote ?? null,
    contestedProposition: overrides.contestedProposition ?? 'Cars cause more harm than good in dense cities.',
    axis,
    relationToParent: relation,
    burden: overrides.burden ?? 'reply_owed',
    state: overrides.state ?? 'open',
    refereeObservations: overrides.refereeObservations ?? [],
    userAllegations: overrides.userAllegations ?? [],
    nextBestMoves: overrides.nextBestMoves ?? [],
  };
}

function makeCandidate(
  issue: OpenIssue,
  recencyIndex: number,
  isActive = false,
): OpenIssueLedgerCandidate {
  return { issue, recencyIndex, isActive };
}

// ════════════════════════════════════════════════════════════════
describe('REF-006-RAIL isOpenIssue — the exact Layer-2 predicate', () => {
  it('keeps any issue with a non-`none` burden (even a display-terminal state)', () => {
    for (const burden of ['source_owed', 'quote_owed', 'reply_owed', 'clarification_owed'] as IssueBurden[]) {
      expect(isOpenIssue(makeIssue({ burden, state: 'answered' }))).toBe(true);
    }
  });

  it('keeps open / source_requested / quote_requested / narrowed / conceded / synthesis_ready', () => {
    for (const state of ['open', 'source_requested', 'quote_requested', 'narrowed', 'conceded', 'synthesis_ready'] as IssueState[]) {
      expect(isOpenIssue(makeIssue({ burden: 'none', state }))).toBe(true);
    }
  });

  it('drops answered + none and moved_on + none (the two display-terminal states)', () => {
    expect(isOpenIssue(makeIssue({ burden: 'none', state: 'answered' }))).toBe(false);
    expect(isOpenIssue(makeIssue({ burden: 'none', state: 'moved_on' }))).toBe(false);
  });

  it('TERMINAL_DISPLAY_STATES is exactly {answered, moved_on} (conceded kept per card rule)', () => {
    expect([...TERMINAL_DISPLAY_STATES].sort()).toEqual(['answered', 'moved_on']);
    expect(TERMINAL_DISPLAY_STATES.has('conceded')).toBe(false);
  });

  it('classifies every one of the 8 IssueState codes with a none burden', () => {
    // Defensive completeness: only answered + moved_on drop under a none burden.
    const dropped = ALL_ISSUE_STATES.filter(
      (s) => !isOpenIssue(makeIssue({ burden: 'none', state: s })),
    );
    expect(dropped.sort()).toEqual(['answered', 'moved_on']);
  });
});

// ════════════════════════════════════════════════════════════════
describe('REF-006-RAIL ledgerRank — frozen seven-tier procedural order', () => {
  it('ranks the four owed burdens source(0) → quote(1) → clarification(2) → reply(3)', () => {
    expect(ledgerRank(makeIssue({ burden: 'source_owed' }))).toBe(0);
    expect(ledgerRank(makeIssue({ burden: 'quote_owed' }))).toBe(1);
    expect(ledgerRank(makeIssue({ burden: 'clarification_owed' }))).toBe(2);
    expect(ledgerRank(makeIssue({ burden: 'reply_owed' }))).toBe(3);
  });

  it('ranks the none-burden resolution tail synthesis_ready(4) → narrowed(5) → conceded(6)', () => {
    expect(ledgerRank(makeIssue({ burden: 'none', state: 'synthesis_ready' }))).toBe(4);
    expect(ledgerRank(makeIssue({ burden: 'none', state: 'narrowed' }))).toBe(5);
    expect(ledgerRank(makeIssue({ burden: 'none', state: 'conceded' }))).toBe(6);
  });

  it('ranks any other none-burden state at the defensive tail (7)', () => {
    expect(ledgerRank(makeIssue({ burden: 'none', state: 'open' }))).toBe(7);
  });

  it('burden always outranks state (source_owed beats a synthesis_ready none)', () => {
    const owed = ledgerRank(makeIssue({ burden: 'source_owed', state: 'open' }));
    const tail = ledgerRank(makeIssue({ burden: 'none', state: 'synthesis_ready' }));
    expect(owed).toBeLessThan(tail);
  });

  it('produces a strictly monotonic ladder across the seven tiers', () => {
    const ladder = [
      makeIssue({ burden: 'source_owed' }),
      makeIssue({ burden: 'quote_owed' }),
      makeIssue({ burden: 'clarification_owed' }),
      makeIssue({ burden: 'reply_owed' }),
      makeIssue({ burden: 'none', state: 'synthesis_ready' }),
      makeIssue({ burden: 'none', state: 'narrowed' }),
      makeIssue({ burden: 'none', state: 'conceded' }),
      makeIssue({ burden: 'none', state: 'open' }),
    ].map(ledgerRank);
    expect(ladder).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

// ════════════════════════════════════════════════════════════════
describe('REF-006-RAIL compareLedgerCandidates — rank asc → recency desc → id asc', () => {
  it('orders by rank ascending first', () => {
    const a = makeCandidate(makeIssue({ id: 'b', burden: 'reply_owed' }), 0);
    const b = makeCandidate(makeIssue({ id: 'a', burden: 'source_owed' }), 0);
    expect(compareLedgerCandidates(a, b)).toBeGreaterThan(0); // source(0) sorts before reply(3)
  });

  it('breaks rank ties by recency descending (most-recent first)', () => {
    const older = makeCandidate(makeIssue({ id: 'a', burden: 'reply_owed' }), 1);
    const newer = makeCandidate(makeIssue({ id: 'b', burden: 'reply_owed' }), 9);
    expect(compareLedgerCandidates(older, newer)).toBeGreaterThan(0);
    expect(compareLedgerCandidates(newer, older)).toBeLessThan(0);
  });

  it('breaks rank+recency ties by id lexicographic ascending', () => {
    const x = makeCandidate(makeIssue({ id: 'issue:aaa' }), 3);
    const y = makeCandidate(makeIssue({ id: 'issue:bbb' }), 3);
    expect(compareLedgerCandidates(x, y)).toBeLessThan(0);
    expect(compareLedgerCandidates(y, x)).toBeGreaterThan(0);
    expect(compareLedgerCandidates(x, x)).toBe(0);
  });

  it('is fully deterministic: shuffling the input yields an identical ordered output', () => {
    const base: OpenIssueLedgerCandidate[] = [
      makeCandidate(makeIssue({ id: 'i1', burden: 'reply_owed' }), 2),
      makeCandidate(makeIssue({ id: 'i2', burden: 'source_owed' }), 5),
      makeCandidate(makeIssue({ id: 'i3', burden: 'none', state: 'narrowed' }), 7),
      makeCandidate(makeIssue({ id: 'i4', burden: 'quote_owed' }), 1),
      makeCandidate(makeIssue({ id: 'i5', burden: 'reply_owed' }), 8),
      makeCandidate(makeIssue({ id: 'i6', burden: 'none', state: 'synthesis_ready' }), 0),
    ];
    const sortedOnce = base.slice().sort(compareLedgerCandidates).map((c) => c.issue.id);
    const shuffles = [
      [5, 0, 3, 1, 4, 2],
      [2, 4, 1, 5, 0, 3],
      [3, 2, 5, 0, 4, 1],
    ];
    for (const order of shuffles) {
      const shuffled = order.map((i) => base[i]);
      const out = shuffled.slice().sort(compareLedgerCandidates).map((c) => c.issue.id);
      expect(out).toEqual(sortedOnce);
    }
  });

  it('does not mutate the input array (buildOpenIssuesLedger sorts a copy)', () => {
    const candidates: OpenIssueLedgerCandidate[] = [
      makeCandidate(makeIssue({ id: 'z', burden: 'reply_owed' }), 1),
      makeCandidate(makeIssue({ id: 'a', burden: 'source_owed' }), 2),
    ];
    const snapshot = candidates.map((c) => c.issue.id);
    buildOpenIssuesLedger(candidates);
    expect(candidates.map((c) => c.issue.id)).toEqual(snapshot);
  });
});

// ════════════════════════════════════════════════════════════════
describe('REF-006-RAIL buildOpenIssuesLedger — filter + order + cap + shape', () => {
  it('filters out closed issues and reports an honest total', () => {
    const candidates = [
      makeCandidate(makeIssue({ id: 'open-1', burden: 'reply_owed', state: 'open' }), 1),
      makeCandidate(makeIssue({ id: 'closed-1', burden: 'none', state: 'answered' }), 2),
      makeCandidate(makeIssue({ id: 'closed-2', burden: 'none', state: 'moved_on' }), 3),
      makeCandidate(makeIssue({ id: 'open-2', burden: 'source_owed', state: 'source_requested' }), 4),
    ];
    const ledger = buildOpenIssuesLedger(candidates);
    expect(ledger.entries.map((e) => e.key)).toEqual(['open-2', 'open-1']); // source(0) before reply(3)
    expect(ledger.totalOpenCount).toBe(2);
    expect(ledger.overflowCount).toBe(0);
    expect(ledger.isEmpty).toBe(false);
  });

  it('empty input → isEmpty true, no entries, zero counts', () => {
    const ledger = buildOpenIssuesLedger([]);
    expect(ledger.entries).toHaveLength(0);
    expect(ledger.totalOpenCount).toBe(0);
    expect(ledger.overflowCount).toBe(0);
    expect(ledger.isEmpty).toBe(true);
  });

  it('all-closed input → isEmpty true (the teaching empty state)', () => {
    const ledger = buildOpenIssuesLedger([
      makeCandidate(makeIssue({ id: 'a', burden: 'none', state: 'answered' }), 1),
      makeCandidate(makeIssue({ id: 'b', burden: 'none', state: 'moved_on' }), 2),
    ]);
    expect(ledger.isEmpty).toBe(true);
    expect(ledger.entries).toHaveLength(0);
  });

  it('caps entries at maxEntries and reports the overflow honestly', () => {
    const candidates = Array.from({ length: 6 }, (_, i) =>
      makeCandidate(makeIssue({ id: `i${i}`, burden: 'reply_owed' }), i),
    );
    const ledger = buildOpenIssuesLedger(candidates, { maxEntries: 2 });
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.totalOpenCount).toBe(6);
    expect(ledger.overflowCount).toBe(4);
  });

  it('folds host-omitted candidates (beyond the K cap) into total + overflow', () => {
    const candidates = Array.from({ length: 3 }, (_, i) =>
      makeCandidate(makeIssue({ id: `i${i}`, burden: 'reply_owed' }), i),
    );
    const ledger = buildOpenIssuesLedger(candidates, { maxEntries: 2, omittedCandidateCount: 5 });
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.totalOpenCount).toBe(8); // 3 kept + 5 omitted
    expect(ledger.overflowCount).toBe(6); // 8 total - 2 displayed
  });

  it('defaults: maxEntries=8, maxMovesPerEntry=2', () => {
    expect(DEFAULT_MAX_ENTRIES).toBe(8);
    expect(DEFAULT_MAX_MOVES_PER_ENTRY).toBe(2);
    const candidates = Array.from({ length: 12 }, (_, i) =>
      makeCandidate(makeIssue({ id: `i${i}`, burden: 'reply_owed' }), i),
    );
    expect(buildOpenIssuesLedger(candidates).entries).toHaveLength(8);
  });

  it('truncates nextBestMoves to maxMovesPerEntry (default 2)', () => {
    const moves = [
      makeMove('ask_source', 'Ask for a source'),
      makeMove('narrow', 'Narrow the scope'),
      makeMove('confirm', 'Confirm'),
    ];
    const ledger = buildOpenIssuesLedger([
      makeCandidate(makeIssue({ id: 'i', burden: 'reply_owed', nextBestMoves: moves }), 0),
    ]);
    expect(ledger.entries[0].nextBestMoves).toHaveLength(2);
    expect(ledger.entries[0].nextBestMoves.map((m) => m.actEntryId)).toEqual(['ask_source', 'narrow']);

    const single = buildOpenIssuesLedger(
      [makeCandidate(makeIssue({ id: 'i', burden: 'reply_owed', nextBestMoves: moves }), 0)],
      { maxMovesPerEntry: 1 },
    );
    expect(single.entries[0].nextBestMoves).toHaveLength(1);
  });

  it('propagates isActive onto the matching row only', () => {
    const ledger = buildOpenIssuesLedger([
      makeCandidate(makeIssue({ id: 'a', burden: 'source_owed' }), 1, true),
      makeCandidate(makeIssue({ id: 'b', burden: 'reply_owed' }), 2, false),
    ]);
    const active = ledger.entries.filter((e) => e.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].key).toBe('a');
  });

  it('openTaskLine = `Burden · Axis` when a task is owed', () => {
    const ledger = buildOpenIssuesLedger([
      makeCandidate(makeIssue({ id: 'a', burden: 'source_owed', axis: 'evidence' }), 1),
    ]);
    expect(ledger.entries[0].openTaskLine).toBe('Source owed · Evidence');
    expect(ledger.entries[0].stateLabel.length).toBeGreaterThan(0);
  });

  it('openTaskLine = the terminal-state line when burden is none', () => {
    const ledger = buildOpenIssuesLedger([
      makeCandidate(makeIssue({ id: 'a', burden: 'none', state: 'narrowed' }), 1),
    ]);
    expect(ledger.entries[0].openTaskLine).toBe('Narrowed.');
  });

  it('truncates contestedProposition at RAIL_PROPOSITION_CAP on a word boundary', () => {
    const long =
      'This is a deliberately very long contested proposition that runs well past the rail excerpt cap so truncation must kick in cleanly';
    const ledger = buildOpenIssuesLedger([
      makeCandidate(makeIssue({ id: 'a', burden: 'reply_owed', contestedProposition: long }), 1),
    ]);
    const prop = ledger.entries[0].contestedProposition;
    expect(prop.length).toBeLessThanOrEqual(RAIL_PROPOSITION_CAP + 1); // +1 for the ellipsis
    expect(prop.endsWith('…')).toBe(true);
    expect(RAIL_PROPOSITION_CAP).toBe(88);
  });

  it('carries the tone glyph from the first referee observation, else null', () => {
    const withGlyph = buildOpenIssuesLedger([
      makeCandidate(
        makeIssue({
          id: 'a',
          burden: 'reply_owed',
          refereeObservations: [
            { sourceCode: 'banner', line: 'This move asks for a source.', toneGlyph: 'arrow', kind: 'machine_observation' },
          ],
        }),
        1,
      ),
    ]);
    expect(withGlyph.entries[0].toneGlyph).toBe('arrow');

    const noGlyph = buildOpenIssuesLedger([
      makeCandidate(makeIssue({ id: 'b', burden: 'reply_owed' }), 1),
    ]);
    expect(noGlyph.entries[0].toneGlyph).toBeNull();
  });

  it('the row key equals issue.id and is never an empty string for a real node', () => {
    const ledger = buildOpenIssuesLedger([
      makeCandidate(makeIssue({ id: 'issue:node-7:challenges:evidence', targetNodeId: 'node-7' }), 1),
    ]);
    expect(ledger.entries[0].key).toBe('issue:node-7:challenges:evidence');
    expect(ledger.entries[0].targetNodeId).toBe('node-7');
  });

  it('builds a complete, non-empty accessibilityLabel per row', () => {
    const ledger = buildOpenIssuesLedger([
      makeCandidate(
        makeIssue({
          id: 'a',
          burden: 'source_owed',
          axis: 'evidence',
          state: 'source_requested',
          contestedProposition: 'Bikes are safer than cars downtown.',
          nextBestMoves: [makeMove('ask_source', 'Ask for a source')],
        }),
        1,
        true,
      ),
    ]);
    const label = ledger.entries[0].accessibilityLabel;
    expect(label.length).toBeGreaterThan(0);
    expect(label).toContain('Source owed · Evidence');
    expect(label).toContain('Currently active');
    expect(label).not.toMatch(/\s{2,}/); // no double spaces
  });
});

// ════════════════════════════════════════════════════════════════
describe('REF-006-RAIL OPEN_ISSUES_RAIL_COPY — the frozen authored chrome set', () => {
  it('is frozen and carries the expected anchor strings', () => {
    expect(Object.isFrozen(OPEN_ISSUES_RAIL_COPY)).toBe(true);
    expect(OPEN_ISSUES_RAIL_COPY.railTitle).toBe('Open issues');
    expect(OPEN_ISSUES_RAIL_COPY.emptyPrimary).toBe('No open issues right now.');
    expect(OPEN_ISSUES_RAIL_COPY.overflowWord).toBe('more');
  });
});

// ════════════════════════════════════════════════════════════════
describe('REF-006-RAIL Layer-1 pre-filter vocabulary (D2)', () => {
  it('the build cap is the documented K = 48', () => {
    expect(OPEN_ISSUES_RAIL_BUILD_CAP).toBe(48);
  });

  it('CLOSED + the open complement partition all 19 lifecycle states exactly', () => {
    const OPEN_COMPLEMENT = [
      'open',
      'rebutted',
      'quote_requested',
      'source_requested',
      'narrowed',
      'conceded',
      'synthesis_ready',
    ];
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const closed = CLOSED_LIFECYCLE_STATES.has(state);
      const open = OPEN_COMPLEMENT.includes(state);
      // Every state is in EXACTLY one partition (closed XOR open-complement).
      expect(closed !== open).toBe(true);
    }
    expect(CLOSED_LIFECYCLE_STATES.size + OPEN_COMPLEMENT.length).toBe(
      ALL_POINT_LIFECYCLE_STATES.length,
    );
  });

  it('CANDIDATE_SIGNAL_TAGS holds the frozen debt / clarify / scope signal codes', () => {
    for (const code of [
      'needs_source',
      'needs_quote',
      'definition_issue',
      'scope_issue',
      'causal_mechanism',
      'evidence_debt',
      'concession_offered',
      'narrowed_claim',
      'ready_for_synthesis',
      'tangent',
      'branch_suggested',
      'no_response_after_n_turns',
    ]) {
      expect(CANDIDATE_SIGNAL_TAGS.has(code)).toBe(true);
    }
    expect(CANDIDATE_SIGNAL_TAGS.size).toBe(12);
  });
});

// ════════════════════════════════════════════════════════════════
describe('REF-006-RAIL purity — the model is a pure projection', () => {
  const src = readFileSync(MODEL_PATH, 'utf8');

  it('imports no React / React Native / Supabase / Expo / router', () => {
    expect(src).not.toMatch(/from\s+'react'/);
    expect(src).not.toMatch(/from\s+'react-native'/);
    expect(src).not.toMatch(/@supabase\/supabase-js/);
    expect(src).not.toMatch(/from\s+'expo-/);
    expect(src).not.toMatch(/expo-router/);
    expect(src).not.toMatch(/react-navigation/);
  });

  it('calls no fetch / XMLHttpRequest / Date.now (deterministic, no clock)', () => {
    expect(/\bfetch\s*\(/.test(src)).toBe(false);
    expect(src.includes('XMLHttpRequest')).toBe(false);
    expect(/\bDate\.now\s*\(/.test(src)).toBe(false);
  });

  it('re-derives nothing — makes no call to buildOpenIssue / buildActPopout / selectBanner / deriveSuggestedMoves / adaptAllSourcesForNode', () => {
    // Scan for CALL syntax (the "re-derives nothing" contract); the doctrine
    // header may NAME these helpers in prose without invoking them.
    expect(/\bbuildOpenIssue\s*\(/.test(src)).toBe(false);
    expect(/\bbuildActPopout\s*\(/.test(src)).toBe(false);
    expect(/\bselectBanner\s*\(/.test(src)).toBe(false);
    expect(/\bderiveSuggestedMoves\s*\(/.test(src)).toBe(false);
    expect(/\badaptAllSourcesForNode\s*\(/.test(src)).toBe(false);
  });

  it('contains no console.log and references no secret', () => {
    expect(/\bconsole\.log\s*\(/.test(src)).toBe(false);
    expect(src.includes('ANTHROPIC_API_KEY')).toBe(false);
    expect(src.includes('SERVICE_ROLE')).toBe(false);
    expect(src.includes('XAI_API_KEY')).toBe(false);
  });

  it('reads NO engagement / popularity / strength field (ordering is procedural only)', () => {
    // Member-access scan: the iterator must never read a heat / popularity /
    // virality / view / engagement / standing / strength / score field.
    const ENGAGEMENT_MEMBER = /\.(heat|popularity|virality|viral|viewCount|views|engagement|standingBand|strengthBand|score|trending|retweet|likeCount|followerCount)\b/;
    expect(ENGAGEMENT_MEMBER.test(src)).toBe(false);
  });
});
