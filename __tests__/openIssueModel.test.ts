/**
 * REF-002 — Open Issue model: derivation + worked-trace tests.
 *
 * Asserts every derivation row (REF-001 §4B), the full 19-row lifecycle →
 * IssueState map, the four REF-001 worked traces field-for-field on the
 * binding contract fields, and the totality / determinism / non-mutation /
 * JSON-serializability module-discipline guarantees.
 *
 * `nextBestMoves` note: REF-001's worked-trace button arrays are
 * illustrative (the trace inputs are explicitly "abbreviated to the
 * load-bearing fields", and the padding order/count depends on the
 * unstated parent type + rules). REF-001 (the authoritative parent
 * contract) specifies that the intersection is PADDED with the next Act
 * survivors; REF-002's Step-2 prose omitted padding. Per REF-002's own
 * reconciliation rule ("where REF-002 and REF-001 diverge, REF-001 wins
 * and the divergence is recorded"), padding is implemented. The worked
 * traces here therefore assert the binding contract fields field-for-field
 * and assert `nextBestMoves` via the invariants REF-001 actually
 * guarantees (subset of survivors; first move = top suggested mapped
 * entry; real Act labels). The deterministic padding mechanics are pinned
 * in `openIssueModel.actGateParity.test.ts`.
 */

import type { ArgumentType } from '../src/domain/constitution/types';
import type {
  PointLifecycleState,
  PointLifecycleAxis,
} from '../src/features/lifecycle';
import type { ManualTagCode } from '../src/features/metadata';
import type { ActEntryId, ActPopoutGroup } from '../src/features/arguments/oneBox/actPopoutModel';
import { buildActPopout, flattenActPopout } from '../src/features/arguments/oneBox/actPopoutModel';
import {
  buildOpenIssue,
  deriveOpenIssueAxis,
  deriveOpenIssueRelation,
  deriveOpenIssueBurden,
  deriveOpenIssueState,
  deriveNextBestMoves,
  type DisagreementAxis,
  type RelationToParent,
  type IssueState,
} from '../src/features/refereeLoop';
import {
  makeInput,
  makeRules,
  makeDebt,
  makeMark,
  makeBanner,
  makeBannerSelection,
  makeClusterSummary,
  makeSuggestionInput,
} from './fixtures/openIssueFixtures';

function survivorLabels(groups: ActPopoutGroup[]): Set<string> {
  return new Set(flattenActPopout(groups).map((e) => e.label));
}
function survivorIds(groups: ActPopoutGroup[]): Set<ActEntryId> {
  return new Set(flattenActPopout(groups).map((e) => e.id));
}

// ════════════════════════════════════════════════════════════════
describe('deriveOpenIssueAxis — 6-tier precedence', () => {
  it('tier 1: any open evidence debt → evidence', () => {
    expect(deriveOpenIssueAxis(makeInput({ openEvidenceDebts: [makeDebt({ debtKind: 'source' })] }))).toBe('evidence');
    expect(deriveOpenIssueAxis(makeInput({ openEvidenceDebts: [makeDebt({ debtKind: 'quote' })] }))).toBe('evidence');
    expect(deriveOpenIssueAxis(makeInput({ openEvidenceDebts: [makeDebt({ debtKind: 'receipt' })] }))).toBe('evidence');
    expect(deriveOpenIssueAxis(makeInput({ openEvidenceDebts: [makeDebt({ debtKind: 'context' })] }))).toBe('evidence');
    expect(deriveOpenIssueAxis(makeInput({ openEvidenceDebts: [makeDebt({ debtKind: 'primary_record' })] }))).toBe('evidence');
  });

  it.each(['no_source', 'broken', 'source_no_quote', 'unverified'] as const)(
    'tier 1: sourceChainStatus %s corroborates evidence (no debt)',
    (status) => {
      expect(deriveOpenIssueAxis(makeInput({ sourceChainStatus: status }))).toBe('evidence');
    },
  );

  it.each([
    ['disputes_definition', 'definition'],
    ['disputes_scope', 'scope'],
    ['disputes_causal_link', 'causal'],
    ['disputes_analogy', 'logic'],
    ['disputes_value_weighting', 'value'],
    ['disputes_decision_criterion', 'value'],
    ['disputes_priority_order', 'value'],
    ['disputes_relevance', 'framing'],
    ['disputes_fact', 'evidence'],
    ['disputes_evidence_applicability', 'evidence'],
    ['disputes_interpretation', 'evidence'],
    ['disputes_generalization', 'evidence'],
  ] as const)('tier 2: Family B %s → %s', (rawKey, expected) => {
    const input = makeInput({
      machineObservations: [makeMark({ rawKey, source: 'ai_classifier' })],
    });
    expect(deriveOpenIssueAxis(input)).toBe(expected);
  });

  it('tier 2: generic disagreement_present umbrella is NOT explicit (falls to tier 5 framing)', () => {
    const input = makeInput({
      machineObservations: [makeMark({ rawKey: 'disagreement_present', source: 'ai_classifier' })],
    });
    expect(deriveOpenIssueAxis(input)).toBe('framing');
  });

  it.each([
    ['definition_issue', 'definition'],
    ['scope_issue', 'scope'],
    ['narrowed_claim', 'scope'],
    ['causal_mechanism', 'causal'],
    ['needs_source', 'evidence'],
    ['needs_quote', 'evidence'],
    ['evidence_debt', 'evidence'],
    ['tangent', 'process'],
  ] as [ManualTagCode, DisagreementAxis][])('tier 3: manual tag %s → %s', (tag, expected) => {
    expect(deriveOpenIssueAxis(makeInput({ manualTags: [tag] }))).toBe(expected);
  });

  it.each([
    ['fact', 'evidence'],
    ['evidence', 'evidence'],
    ['source', 'evidence'],
    ['quote', 'evidence'],
    ['definition', 'definition'],
    ['scope', 'scope'],
    ['causal', 'causal'],
    ['value', 'value'],
    ['logic', 'logic'],
  ] as [PointLifecycleAxis, DisagreementAxis][])('tier 4: lifecycle axis %s → %s', (axis, expected) => {
    expect(deriveOpenIssueAxis(makeInput({ lifecycleAxis: axis }))).toBe(expected);
  });

  it('tier 4: lifecycle axis unaxed → no signal → process fallback', () => {
    expect(deriveOpenIssueAxis(makeInput({ lifecycleAxis: 'unaxed' }))).toBe('process');
  });

  it.each([
    ['framing', 'framing'],
    ['context', 'framing'],
    ['fact', 'framing'],
  ] as const)('tier 5: activeDisagreementKind %s → %s', (kind, expected) => {
    expect(deriveOpenIssueAxis(makeInput({ activeDisagreementKind: kind }))).toBe(expected);
  });

  it('tier 5: activeDisagreementKind none → no signal → process fallback', () => {
    expect(deriveOpenIssueAxis(makeInput({ activeDisagreementKind: 'none' }))).toBe('process');
  });

  it('tier 6: nothing resolves → process (never empty)', () => {
    expect(deriveOpenIssueAxis(makeInput())).toBe('process');
  });

  it('NO Open Issue axis is ever literally `fact` — the three fact sources stay distinct', () => {
    // PointLifecycleAxis fact → evidence; Family B disputes_fact → evidence;
    // ActiveDisagreementKind fact → framing.
    expect(deriveOpenIssueAxis(makeInput({ lifecycleAxis: 'fact' }))).toBe('evidence');
    expect(
      deriveOpenIssueAxis(makeInput({ machineObservations: [makeMark({ rawKey: 'disputes_fact', source: 'ai_classifier' })] })),
    ).toBe('evidence');
    expect(deriveOpenIssueAxis(makeInput({ activeDisagreementKind: 'fact' }))).toBe('framing');
  });

  it('precedence: debt (tier 1) beats a Family B definition mark (tier 2)', () => {
    const input = makeInput({
      openEvidenceDebts: [makeDebt({ debtKind: 'source' })],
      machineObservations: [makeMark({ rawKey: 'disputes_definition', source: 'ai_classifier' })],
      lifecycleAxis: 'scope',
    });
    expect(deriveOpenIssueAxis(input)).toBe('evidence');
  });
});

// ════════════════════════════════════════════════════════════════
describe('deriveOpenIssueRelation — 5-tier precedence + reply-neutrality', () => {
  it.each([
    ['challenge', 'challenges'],
    ['ask_source', 'asks_source'],
    ['ask_quote', 'asks_quote'],
    ['narrow', 'narrows'],
    ['concede', 'concedes'],
    ['offer_concession', 'concedes'],
    ['synthesize', 'synthesizes'],
    ['branch_tangent', 'branches'],
    ['confirm', 'supports'],
    ['add_evidence', 'supports'],
  ] as [ActEntryId, RelationToParent][])('tier 1: ActEntryId %s → %s', (id, expected) => {
    expect(deriveOpenIssueRelation(makeInput({ selectedActEntryId: id }))).toBe(expected);
  });

  it('tier 1: reply / clarify map to the `replies` fallback (not preferred over a lower specific)', () => {
    expect(deriveOpenIssueRelation(makeInput({ selectedActEntryId: 'reply' }))).toBe('replies');
    expect(deriveOpenIssueRelation(makeInput({ selectedActEntryId: 'clarify' }))).toBe('replies');
  });

  it('tier 2: selectedChannel maps when no Act entry', () => {
    expect(deriveOpenIssueRelation(makeInput({ selectedChannel: 'challenge' }))).toBe('challenges');
    expect(deriveOpenIssueRelation(makeInput({ selectedChannel: 'ask_source' }))).toBe('asks_source');
    expect(deriveOpenIssueRelation(makeInput({ selectedChannel: 'meta_process' }))).toBe('replies');
  });

  it.each([
    ['rebuttal', 'challenges'],
    ['counter_rebuttal', 'challenges'],
    ['evidence', 'supports'],
    ['concession', 'concedes'],
    ['synthesis', 'synthesizes'],
    ['claim', 'replies'],
  ] as [ArgumentType, RelationToParent][])('tier 3: stored type %s → %s', (type, expected) => {
    expect(deriveOpenIssueRelation(makeInput({ storedArgumentType: type }))).toBe(expected);
  });

  it.each([
    ['concession_offered', 'concedes'],
    ['narrowed_claim', 'narrows'],
    ['ready_for_synthesis', 'synthesizes'],
    ['tangent', 'branches'],
    ['needs_source', 'asks_source'],
    ['needs_quote', 'asks_quote'],
    ['definition_issue', 'challenges'],
  ] as [ManualTagCode, RelationToParent][])('tier 4: manual tag %s → %s', (tag, expected) => {
    expect(deriveOpenIssueRelation(makeInput({ manualTags: [tag] }))).toBe(expected);
  });

  it.each([
    ['source_requested', 'asks_source'],
    ['quote_requested', 'asks_quote'],
    ['narrowed', 'narrows'],
    ['conceded', 'concedes'],
    ['synthesis_ready', 'synthesizes'],
    ['branch_recommended', 'branches'],
    ['rebutted', 'challenges'],
  ] as [PointLifecycleState, RelationToParent][])('tier 5: lifecycle %s → %s', (state, expected) => {
    expect(deriveOpenIssueRelation(makeInput({ lifecycleState: state }))).toBe(expected);
  });

  it('fallback: nothing specific → replies', () => {
    expect(deriveOpenIssueRelation(makeInput())).toBe('replies');
    expect(deriveOpenIssueRelation(makeInput({ lifecycleState: 'open' }))).toBe('replies');
  });

  it('replies is never preferred over a more specific lower-tier relation', () => {
    // ActEntryId reply → replies (tier 1 fallback), but stored type rebuttal
    // (tier 3) yields the more specific `challenges`.
    const input = makeInput({ selectedActEntryId: 'reply', storedArgumentType: 'rebuttal' });
    expect(deriveOpenIssueRelation(input)).toBe('challenges');
  });

  it('reply-neutrality upgrade: replies + sameSide + supportEvidence → supports', () => {
    const input = makeInput({ sameSideAsParent: true, carriesSupportEvidence: true });
    expect(deriveOpenIssueRelation(input)).toBe('supports');
  });

  it('reply-neutrality: sameSide alone (no support evidence) stays replies — side ≠ agreement', () => {
    expect(deriveOpenIssueRelation(makeInput({ sameSideAsParent: true }))).toBe('replies');
    expect(deriveOpenIssueRelation(makeInput({ carriesSupportEvidence: true }))).toBe('replies');
  });

  it('reply-neutrality never overrides an already-specific relation', () => {
    const input = makeInput({
      selectedActEntryId: 'challenge',
      sameSideAsParent: true,
      carriesSupportEvidence: true,
    });
    expect(deriveOpenIssueRelation(input)).toBe('challenges');
  });
});

// ════════════════════════════════════════════════════════════════
describe('deriveOpenIssueBurden — precedence: evidence/quote > clarification > reply > none', () => {
  it('source-class debt → source_owed; quote debt → quote_owed', () => {
    expect(deriveOpenIssueBurden(makeInput({ openEvidenceDebts: [makeDebt({ debtKind: 'source' })] }))).toBe('source_owed');
    expect(deriveOpenIssueBurden(makeInput({ openEvidenceDebts: [makeDebt({ debtKind: 'receipt' })] }))).toBe('source_owed');
    expect(deriveOpenIssueBurden(makeInput({ openEvidenceDebts: [makeDebt({ debtKind: 'quote' })] }))).toBe('quote_owed');
  });

  it('source-class debt outranks a quote debt regardless of array order', () => {
    const input = makeInput({
      openEvidenceDebts: [makeDebt({ debtKind: 'quote' }), makeDebt({ debtKind: 'context' })],
    });
    expect(deriveOpenIssueBurden(input)).toBe('source_owed');
  });

  it('sourceChain corroboration when no explicit debt', () => {
    expect(deriveOpenIssueBurden(makeInput({ sourceChainStatus: 'no_source' }))).toBe('source_owed');
    expect(deriveOpenIssueBurden(makeInput({ sourceChainStatus: 'broken' }))).toBe('source_owed');
    expect(deriveOpenIssueBurden(makeInput({ sourceChainStatus: 'source_no_quote' }))).toBe('quote_owed');
  });

  it('clarification_owed from a definition / clarify signal', () => {
    expect(deriveOpenIssueBurden(makeInput({ manualTags: ['definition_issue'] }))).toBe('clarification_owed');
    expect(deriveOpenIssueBurden(makeInput({ lifecycleAxis: 'definition' }))).toBe('clarification_owed');
    expect(deriveOpenIssueBurden(makeInput({ selectedActEntryId: 'clarify' }))).toBe('clarification_owed');
    expect(deriveOpenIssueBurden(makeInput({ selectedChannel: 'clarify' }))).toBe('clarification_owed');
    expect(deriveOpenIssueBurden(makeInput({ storedArgumentType: 'clarification_request' }))).toBe('clarification_owed');
  });

  it('reply_owed when point is open / rebutted', () => {
    expect(deriveOpenIssueBurden(makeInput({ lifecycleState: 'open' }))).toBe('reply_owed');
    expect(deriveOpenIssueBurden(makeInput({ lifecycleState: 'rebutted' }))).toBe('reply_owed');
  });

  it('reply_owed when relation challenges with no terminal state', () => {
    expect(deriveOpenIssueBurden(makeInput({ selectedActEntryId: 'challenge' }))).toBe('reply_owed');
  });

  it('a bare `replies` relation by itself never creates reply_owed and never clears a debt', () => {
    // selectedActEntryId reply → relation replies; no debt, no open/rebutted state.
    expect(deriveOpenIssueBurden(makeInput({ selectedActEntryId: 'reply' }))).toBe('none');
    // a bare reply does not clear an existing source debt.
    expect(
      deriveOpenIssueBurden(makeInput({ selectedActEntryId: 'reply', openEvidenceDebts: [makeDebt({ debtKind: 'source' })] })),
    ).toBe('source_owed');
  });

  it('terminal states → none', () => {
    expect(deriveOpenIssueBurden(makeInput({ lifecycleState: 'narrowed' }))).toBe('none');
    expect(deriveOpenIssueBurden(makeInput({ lifecycleState: 'conceded' }))).toBe('none');
    expect(deriveOpenIssueBurden(makeInput({ lifecycleState: 'synthesis_ready' }))).toBe('none');
  });

  it('evidence debt outranks a clarify signal', () => {
    const input = makeInput({
      openEvidenceDebts: [makeDebt({ debtKind: 'source' })],
      manualTags: ['definition_issue'],
    });
    expect(deriveOpenIssueBurden(input)).toBe('source_owed');
  });
});

// ════════════════════════════════════════════════════════════════
describe('deriveOpenIssueState — 19-row lifecycle base map + debt override', () => {
  const ROWS: [PointLifecycleState, IssueState][] = [
    ['open', 'open'],
    ['answered', 'answered'],
    ['rebutted', 'answered'],
    ['clarified', 'answered'],
    ['sourced', 'answered'],
    ['quote_requested', 'quote_requested'],
    ['source_requested', 'source_requested'],
    ['narrowed', 'narrowed'],
    ['conceded', 'conceded'],
    ['confirmed', 'answered'],
    ['synthesis_ready', 'synthesis_ready'],
    ['moved_on_by_affirmative', 'moved_on'],
    ['moved_on_by_negative', 'moved_on'],
    ['ignored_by_affirmative', 'moved_on'],
    ['ignored_by_negative', 'moved_on'],
    ['ignored_by_both', 'moved_on'],
    ['exhausted', 'moved_on'],
    ['branch_recommended', 'moved_on'],
    ['archived_or_resolved', 'answered'],
  ];

  it.each(ROWS)('lifecycle %s → IssueState %s', (lifecycleState, expected) => {
    expect(deriveOpenIssueState(makeInput({ lifecycleState }))).toBe(expected);
  });

  it('enumerates all 19 live PointLifecycleState values', () => {
    expect(ROWS).toHaveLength(19);
    expect(new Set(ROWS.map((r) => r[0])).size).toBe(19);
  });

  it('null lifecycleState defaults to open', () => {
    expect(deriveOpenIssueState(makeInput({ lifecycleState: null }))).toBe('open');
  });

  it('Step B — source debt override fires even over an `answered` base (lifecycle sourced + fresh quote debt)', () => {
    const input = makeInput({
      lifecycleState: 'sourced',
      openEvidenceDebts: [makeDebt({ debtKind: 'quote', status: 'requested' })],
    });
    expect(deriveOpenIssueState(input)).toBe('quote_requested');
  });

  it('Step B — source-class debt override → source_requested', () => {
    const input = makeInput({
      lifecycleState: 'answered',
      openEvidenceDebts: [makeDebt({ debtKind: 'context', status: 'unresolved' })],
    });
    expect(deriveOpenIssueState(input)).toBe('source_requested');
  });
});

// ════════════════════════════════════════════════════════════════
describe('deriveNextBestMoves — map + intersect + recovery + pad', () => {
  const PARTICIPANT_GROUPS = (): ActPopoutGroup[] =>
    buildActPopout({
      targetKind: 'node',
      role: 'participant_other',
      stage: 'open',
      parentType: 'claim',
      rules: makeRules(),
    });

  it('maps the top suggested code to its Act entry as the first move', () => {
    const moves = deriveNextBestMoves({
      suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('source_requested'), sourceChainStatus: 'no_source' }),
      actGroups: PARTICIPANT_GROUPS(),
    });
    expect(moves.length).toBeGreaterThanOrEqual(1);
    expect(moves[0].actEntryId).toBe('ask_source');
    expect(moves[0].label).toBe('Ask for a source');
    expect(moves[0].isRecoveryRoute).toBe(false);
  });

  it('every move is a subset of the Act survivors', () => {
    const groups = PARTICIPANT_GROUPS();
    const ids = survivorIds(groups);
    const moves = deriveNextBestMoves({
      suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('branch_recommended') }),
      actGroups: groups,
    });
    for (const m of moves) expect(ids.has(m.actEntryId)).toBe(true);
  });

  it('pads toward maxMoves with constructive survivors when suggestions are few', () => {
    const moves = deriveNextBestMoves({
      suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('source_requested'), sourceChainStatus: 'no_source' }),
      actGroups: PARTICIPANT_GROUPS(),
      maxMoves: 3,
    });
    expect(moves.length).toBe(3);
    expect(new Set(moves.map((m) => m.actEntryId)).size).toBe(3); // no duplicates
  });

  it('respects maxMoves; maxMoves <= 0 returns []', () => {
    expect(deriveNextBestMoves({ suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('source_requested') }), actGroups: PARTICIPANT_GROUPS(), maxMoves: 0 })).toEqual([]);
    const two = deriveNextBestMoves({ suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('source_requested'), sourceChainStatus: 'no_source' }), actGroups: PARTICIPANT_GROUPS(), maxMoves: 2 });
    expect(two.length).toBe(2);
  });

  it('observer role → no constructive survivors → []', () => {
    const groups = buildActPopout({ targetKind: 'node', role: 'observer', stage: 'open', parentType: 'claim', rules: makeRules() });
    const moves = deriveNextBestMoves({ suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('source_requested'), sourceChainStatus: 'no_source' }), actGroups: groups });
    expect(moves).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════
describe('buildOpenIssue — guards, id, traces', () => {
  it('returns null when roomId is null', () => {
    expect(buildOpenIssue(makeInput({ roomId: null }))).toBeNull();
  });
  it('returns null when targetNodeId is null', () => {
    expect(buildOpenIssue(makeInput({ targetNodeId: null }))).toBeNull();
  });

  it('id is deterministic and stable: issue:<node>:<relation>:<debtKind|axis>', () => {
    const input = makeInput({ selectedActEntryId: 'ask_source', openEvidenceDebts: [makeDebt({ debtKind: 'source' })] });
    const issue = buildOpenIssue(input)!;
    expect(issue.id).toBe('issue:node-1:asks_source:source');
    expect(buildOpenIssue(input)!.id).toBe(issue.id);
  });

  it('id falls back to axis when there is no open debt', () => {
    const issue = buildOpenIssue(makeInput({ selectedActEntryId: 'narrow', lifecycleAxis: 'scope' }))!;
    expect(issue.id).toBe('issue:node-1:narrows:scope');
  });

  // ── Worked trace 1 — Source requested ──
  it('Trace 1 — Source requested (binding fields field-for-field)', () => {
    const groups = buildActPopout({ targetKind: 'node', role: 'participant_other', stage: 'source_requested', parentType: 'claim', rules: makeRules() });
    const labels = survivorLabels(groups);
    const issue = buildOpenIssue(
      makeInput({
        selectedActEntryId: 'ask_source',
        openEvidenceDebts: [makeDebt({ debtKind: 'source', status: 'requested' })],
        lifecycleState: 'source_requested',
        lifecycleAxis: 'source',
        sourceChainStatus: 'no_source',
        bannerSelection: makeBannerSelection(makeBanner({ bannerCode: 'source_chain_gap', headline: 'This move asks for a source.', toneGlyph: 'arrow' })),
        suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('source_requested'), sourceChainStatus: 'no_source' }),
      }),
    )!;
    expect(issue.relationToParent).toBe('asks_source');
    expect(issue.axis).toBe('evidence');
    expect(issue.burden).toBe('source_owed');
    expect(issue.state).toBe('source_requested');
    expect(issue.refereeObservations).toEqual([
      { sourceCode: 'source_chain_gap', line: 'This move asks for a source.', toneGlyph: 'arrow', kind: 'machine_observation' },
    ]);
    expect(issue.nextBestMoves[0].actEntryId).toBe('ask_source');
    expect(issue.nextBestMoves[0].label).toBe('Ask for a source');
    // The narrated trace buttons are all renderable Act survivors.
    for (const label of ['Ask for a source', 'Add evidence', 'Narrow the claim']) expect(labels.has(label)).toBe(true);
  });

  // ── Worked trace 2 — Quote requested ──
  it('Trace 2 — Quote requested (binding fields field-for-field)', () => {
    const groups = buildActPopout({ targetKind: 'node', role: 'participant_other', stage: 'quote_requested', parentType: 'claim', rules: makeRules() });
    const labels = survivorLabels(groups);
    const issue = buildOpenIssue(
      makeInput({
        selectedActEntryId: 'ask_quote',
        openEvidenceDebts: [makeDebt({ debtKind: 'quote', status: 'requested' })],
        sourceChainStatus: 'source_no_quote',
        lifecycleState: 'quote_requested',
        manualTags: ['needs_quote'],
        bannerSelection: makeBannerSelection(makeBanner({ bannerCode: 'quote_needed', headline: 'This move asks for a quote.', toneGlyph: 'arrow' })),
        suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('quote_requested'), sourceChainStatus: 'source_no_quote' }),
      }),
    )!;
    expect(issue.relationToParent).toBe('asks_quote');
    expect(issue.axis).toBe('evidence');
    expect(issue.burden).toBe('quote_owed');
    expect(issue.state).toBe('quote_requested');
    expect(issue.refereeObservations).toEqual([
      { sourceCode: 'quote_needed', line: 'This move asks for a quote.', toneGlyph: 'arrow', kind: 'machine_observation' },
    ]);
    expect(issue.nextBestMoves[0].actEntryId).toBe('ask_quote');
    expect(issue.nextBestMoves[0].label).toBe('Ask for a quote');
    for (const label of ['Ask for a quote', 'Add evidence', 'Open a side issue']) expect(labels.has(label)).toBe(true);
  });

  // ── Worked trace 3 — Scope narrowed ──
  it('Trace 3 — Scope narrowed (terminal: burden none; no banner; obs empty)', () => {
    const issue = buildOpenIssue(
      makeInput({
        selectedActEntryId: 'narrow',
        storedArgumentType: 'concession',
        lifecycleState: 'narrowed',
        lifecycleAxis: 'scope',
        manualTags: ['narrowed_claim'],
        openEvidenceDebts: [],
        bannerSelection: makeBannerSelection(null),
        suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('narrowed') }),
      }),
    )!;
    expect(issue.relationToParent).toBe('narrows');
    expect(issue.axis).toBe('scope');
    expect(issue.burden).toBe('none');
    expect(issue.state).toBe('narrowed');
    expect(issue.refereeObservations).toEqual([]);
    expect(issue.nextBestMoves[0].actEntryId).toBe('confirm');
    expect(issue.nextBestMoves[0].label).toBe('Confirm');
  });

  // ── Worked trace 4 — Tangent branched ──
  it('Trace 4 — Tangent branched (state moved_on via branch_recommended; process axis)', () => {
    const issue = buildOpenIssue(
      makeInput({
        selectedActEntryId: 'branch_tangent',
        manualTags: ['tangent'],
        autoMetadata: ['branch_suggested'],
        lifecycleState: 'branch_recommended',
        lifecycleAxis: 'unaxed',
        bannerSelection: makeBannerSelection(makeBanner({ bannerCode: 'tangent_suggestion', headline: 'This belongs on its own branch.', toneGlyph: 'branch' })),
        suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('branch_recommended') }),
      }),
    )!;
    expect(issue.relationToParent).toBe('branches');
    expect(issue.axis).toBe('process');
    expect(issue.burden).toBe('none');
    expect(issue.state).toBe('moved_on');
    expect(issue.refereeObservations).toEqual([
      { sourceCode: 'tangent_suggestion', line: 'This belongs on its own branch.', toneGlyph: 'branch', kind: 'machine_observation' },
    ]);
    expect(issue.nextBestMoves[0].actEntryId).toBe('branch_tangent');
    expect(issue.nextBestMoves[0].label).toBe('Open a side issue');
  });

  // ── 5th illustrative case — gate-removed narrow → branch_tangent recovery ──
  it('Trace 5 — gate-removed suggestion → branch_tangent recovery route (never the invalid action)', () => {
    // Parent allows NO concession child → `narrow` Act entry is engine-gated
    // out; the `narrow` suggestion must surface the branch_tangent recovery.
    const rules = makeRules({ claim: ['evidence', 'rebuttal', 'clarification_request', 'synthesis'] });
    const groups = buildActPopout({ targetKind: 'node', role: 'participant_other', stage: 'exhausted', parentType: 'claim', rules });
    expect(survivorIds(groups).has('narrow')).toBe(false);
    const moves = deriveNextBestMoves({
      // lifecycle exhausted → suggested [narrow, branch_tangent]; narrow is gated out.
      suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('exhausted') }),
      actGroups: groups,
    });
    const recovery = moves.find((m) => m.isRecoveryRoute);
    expect(recovery).toBeDefined();
    expect(recovery!.actEntryId).toBe('branch_tangent');
    expect(recovery!.recoveredFromCode).toBe('narrow');
    // The invalid `narrow` action is never rendered.
    for (const m of moves) expect(m.actEntryId).not.toBe('narrow');
  });
});

// ════════════════════════════════════════════════════════════════
describe('targetQuote / contestedProposition — verbatim, never synthesized', () => {
  it('prefers the exact quoteAnchor', () => {
    const issue = buildOpenIssue(makeInput({ quoteAnchor: 'exact quote', targetExcerpt: 'an excerpt' }))!;
    expect(issue.targetQuote).toBe('exact quote');
    expect(issue.contestedProposition).toBe('exact quote');
  });
  it('falls back to the excerpt, else null', () => {
    expect(buildOpenIssue(makeInput({ targetExcerpt: 'just an excerpt' }))!.targetQuote).toBe('just an excerpt');
    expect(buildOpenIssue(makeInput())!.targetQuote).toBeNull();
    expect(buildOpenIssue(makeInput())!.contestedProposition).toBe('');
  });
  it('contestedProposition truncates deterministically at a word boundary (≤ 160 + ellipsis)', () => {
    const long = 'word '.repeat(50).trim(); // 249 chars
    const issue = buildOpenIssue(makeInput({ targetExcerpt: long }))!;
    expect(issue.contestedProposition.length).toBeLessThanOrEqual(161);
    expect(issue.contestedProposition.endsWith('…')).toBe(true);
    expect(issue.contestedProposition.length).toBeLessThan(long.length); // truncated, not full text
    // Deterministic — the same input truncates identically.
    expect(buildOpenIssue(makeInput({ targetExcerpt: long }))!.contestedProposition).toBe(issue.contestedProposition);
  });
});

// ════════════════════════════════════════════════════════════════
describe('module discipline — total, deterministic, non-mutating, JSON-serializable', () => {
  it('never throws on an all-empty well-typed input (total)', () => {
    expect(() => buildOpenIssue(makeInput())).not.toThrow();
    const issue = buildOpenIssue(makeInput())!;
    expect(issue.axis).toBe('process');
    expect(issue.relationToParent).toBe('replies');
  });

  it('deterministic — same input yields a deep-equal contract', () => {
    const input = makeInput({ selectedActEntryId: 'challenge', lifecycleState: 'rebutted', machineObservations: [makeMark({ rawKey: 'disputes_scope', source: 'ai_classifier' })] });
    expect(buildOpenIssue(input)).toEqual(buildOpenIssue(input));
  });

  it('non-mutating — the input is unchanged after derivation', () => {
    const input = makeInput({ selectedActEntryId: 'ask_source', openEvidenceDebts: [makeDebt({ debtKind: 'source' })], machineObservations: [makeMark()] });
    const before = JSON.stringify(input);
    buildOpenIssue(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('JSON-serializable — round-trips deep-equal', () => {
    const issue = buildOpenIssue(makeInput({ selectedActEntryId: 'narrow', lifecycleState: 'narrowed', lifecycleAxis: 'scope', suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('narrowed') }) }))!;
    expect(JSON.parse(JSON.stringify(issue))).toEqual(issue);
  });
});
