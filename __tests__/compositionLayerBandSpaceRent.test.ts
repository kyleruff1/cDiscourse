/**
 * COMP-001 §7.2.1 — Scenario replay: band-space-rent (8 moves).
 *
 * Replays the 8-move scenario from
 * `fixtures/argument-scenarios/catalog-design-band-space-rent-evidence.json`,
 * accumulating CompositionState, asserting mutations after each move.
 *
 * Mode (a) — 23-id mode (the regression baseline COMP-001 ships against):
 *   The 12 MCP-CAT-001 catalog v1 signals are stripped from packets. Rules
 *   that depend on those signals do not fire — graceful degradation per
 *   the worked-examples document. The scenario still produces a coherent
 *   timeline narrative (m1 root → m2 first-move exempt → m3 quoted engagement
 *   → m4 concession → m5 evidence-debt opens on m4 → m6 evidence-debt resolves
 *   on m4 → m7 narrowing + concession → m8 quoted engagement + synthesis).
 *
 *   The 23-id-mode filter is a HARDCODED LITERAL set so that future catalog
 *   extensions do not silently change this regression baseline. The list is
 *   the exact catalog v0 frozen by MCP-001 §7.
 *
 * 35-id mode (the forward-compat verification): the same fixture is loaded
 * WITHOUT stripping the catalog v1 signals. Post-MCP-CAT-001 the additive
 * catalog v1 rules (`R-CAT-SubAxis`, etc.) may fire on this path; the test
 * asserts the mutation set is a SUPERSET of the 23-id mutation set (no
 * regressions, only additions).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { composeVisualState } from '../src/features/semanticReferee/compositionLayer';
import {
  EMPTY_COMPOSITION_STATE,
  type AncestorMoveSummary,
  type CompositionState,
  type MoveMetadata,
} from '../src/features/semanticReferee/compositionTypes';
import {
  PACKET_VERSION,
  type SemanticBinarySample,
  type SemanticClassifierId,
  type SemanticRefereePacket,
} from '../src/features/semanticReferee/semanticRefereeTypes';

const FIXTURE_PATH = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'argument-scenarios',
  'catalog-design-band-space-rent-evidence.json',
);

interface FixtureSignal {
  id: string;
  value: 0 | 1;
  source?: string;
}
interface FixtureMove {
  moveId: string;
  authorAlias: string;
  parentMoveId: string | null;
  argumentType: string;
  disagreementAxis: string | null;
  expectedClassifierSignal: FixtureSignal[];
  semanticEligible: boolean;
  semanticExemptionReason: string | null;
}

const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as { moves: FixtureMove[] };

/**
 * The exact 23 catalog-v0 ids frozen by MCP-001 §7. Hardcoded as a literal
 * (not derived from `ALL_SEMANTIC_CLASSIFIER_IDS`) so the 23-id regression
 * baseline never drifts when the catalog gains new ids in a later card.
 */
const CURRENT_23_IDS = new Set<string>([
  'responds_to_parent',
  'introduces_new_issue',
  'asks_for_evidence',
  'provides_evidence',
  'evidence_supports_claim',
  'quote_anchors_parent',
  'narrows_claim',
  'concedes_narrow_point',
  'requests_clarification',
  'answers_clarification',
  'shifts_to_person_or_intent',
  'uses_popularity_as_evidence',
  'contains_playable_hot_take',
  'contains_unplayable_insult_only',
  'is_satire_or_parody',
  'uses_satire_as_evidence',
  'cites_retraction',
  'creates_source_chain_gap',
  'suggests_side_branch',
  'suggests_diagonal_tangent',
  'fits_selected_debate_mode',
  'needs_pre_send_pause',
  'ready_for_synthesis',
]);

function buildPacket(
  move: FixtureMove,
  mode: '23-id' | '35-id',
): SemanticRefereePacket | undefined {
  // Exempt moves have no packet — the runner does not call the classifier.
  if (!move.semanticEligible) {
    return undefined;
  }
  const signals = mode === '23-id'
    ? move.expectedClassifierSignal.filter((s) => CURRENT_23_IDS.has(s.id))
    : move.expectedClassifierSignal;
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-model-0',
    provider: 'mock',
    authoritative: false,
    inputHash: `inputhash-${move.moveId}`,
    contentHash: `contenthash-${move.moveId}`,
    roomId: 'room-band-space-rent',
    moveId: move.moveId,
    parentId: move.parentMoveId ?? undefined,
    binaries: signals.map((s) => ({
      classifierId: s.id as SemanticClassifierId,
      value: s.value,
      confidence: 'high',
      reasonCode: `${s.id}_test`,
    })) as readonly SemanticBinarySample[],
    routeSuggestion: 'no_route_change',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 0,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  };
}

interface ReplayState {
  state: CompositionState;
  metas: MoveMetadata[];
  packetsByMoveId: Map<string, SemanticRefereePacket | undefined>;
  mutationsByMoveId: Map<string, ReturnType<typeof composeVisualState>['mutations']>;
}

function replay(mode: '23-id' | '35-id'): ReplayState {
  let state: CompositionState = EMPTY_COMPOSITION_STATE;
  const metas: MoveMetadata[] = [];
  const packetsByMoveId = new Map<string, SemanticRefereePacket | undefined>();
  const mutationsByMoveId = new Map<string, ReturnType<typeof composeVisualState>['mutations']>();
  const aliasToAuthorId = new Map<string, string>();
  for (const m of FIXTURE.moves) {
    if (!aliasToAuthorId.has(m.authorAlias)) {
      aliasToAuthorId.set(m.authorAlias, `author_${aliasToAuthorId.size + 1}`);
    }
  }
  // Track per-author move position to drive R-EX-02.
  const movesByAuthor = new Map<string, number>();
  for (const move of FIXTURE.moves) {
    const authorId = aliasToAuthorId.get(move.authorAlias)!;
    const prev = movesByAuthor.get(authorId) ?? 0;
    const isFirst = prev === 0;
    movesByAuthor.set(authorId, prev + 1);
    const meta: MoveMetadata = {
      moveId: move.moveId,
      parentId: move.parentMoveId ?? null,
      authorId,
      argumentType: move.argumentType,
      disagreementAxis: move.disagreementAxis,
      authorMovePosition: isFirst ? 'first' : 'subsequent',
    };
    const packet = buildPacket(move, mode);
    packetsByMoveId.set(move.moveId, packet);
    // Build the ancestor chain from metas-so-far + already-known packets.
    const ancestors: AncestorMoveSummary[] = [];
    let cursor: string | null = meta.parentId;
    const upchain: MoveMetadata[] = [];
    while (cursor != null) {
      const prevMeta = metas.find((mm) => mm.moveId === cursor);
      if (!prevMeta) {
        break;
      }
      upchain.push(prevMeta);
      cursor = prevMeta.parentId;
    }
    // Reverse so the array is oldest-first.
    upchain.reverse();
    for (const a of upchain) {
      ancestors.push({
        moveId: a.moveId,
        parentId: a.parentId,
        authorId: a.authorId,
        argumentType: a.argumentType,
        disagreementAxis: a.disagreementAxis,
        packet: packetsByMoveId.get(a.moveId),
      });
    }
    const result = composeVisualState({
      packet,
      threadState: state,
      moveMeta: meta,
      ancestors,
    });
    state = result.nextState;
    metas.push(meta);
    mutationsByMoveId.set(move.moveId, result.mutations);
  }
  return { state, metas, packetsByMoveId, mutationsByMoveId };
}

// ── 23-id mode tests ────────────────────────────────────────────

describe('COMP-001 §7.2.1 — band-space-rent — 23-id mode (regression baseline)', () => {
  const replayState = replay('23-id');
  const m = (id: string) => replayState.mutationsByMoveId.get(id) ?? [];

  it('m1 (root): R-EX-01 fires; opening_claim_marker on m1', () => {
    const muts = m('m1');
    expect(muts.length).toBe(1);
    expect(muts[0]).toMatchObject({ targetMoveId: 'm1', mutation: 'opening_claim_marker' });
  });

  it('m2 (first move for Bandmate B): R-EX-02 fires; zero composition mutations', () => {
    expect(m('m2')).toHaveLength(0);
  });

  it('m3: R-PC-01 fires (responds + quote_anchors); parent_engaged_quoted on m2 in the muts', () => {
    const muts = m('m3');
    expect(muts.find((mu) => mu.mutation === 'parent_engaged_quoted' && mu.targetMoveId === 'm2')).toBeTruthy();
  });

  it('m4: R-PC-01 fires; R-CM-02 fires; point_conceded targets a different-author ancestor', () => {
    const muts = m('m4');
    expect(muts.find((mu) => mu.mutation === 'parent_engaged_quoted' && mu.targetMoveId === 'm3')).toBeTruthy();
    const conceded = muts.find((mu) => mu.mutation === 'point_conceded');
    expect(conceded).toBeTruthy();
    // m4 is Bandmate B; the upstream different-author with matching axis
    // (applicability_of_evidence) is m3 (Bandmate A).
    expect(conceded?.targetMoveId).toBe('m3');
    expect(muts.find((mu) => mu.mutation === 'concession_landed' && mu.targetMoveId === 'm4')).toBeTruthy();
    expect(replayState.state.concessionChains.has('m4')).toBe(true);
  });

  it('m5: R-EV-01 fires; evidence debt opens on m4', () => {
    const muts = m('m5');
    expect(muts.find((mu) => mu.mutation === 'evidence_debt_opened' && mu.targetMoveId === 'm4')).toBeTruthy();
    expect(muts.find((mu) => mu.mutation === 'parent_engaged_quoted' && mu.targetMoveId === 'm4')).toBeTruthy();
    expect(replayState.state.evidenceDebts.get('m5')).toMatchObject({
      openingMoveId: 'm5',
      targetMoveId: 'm4',
      status: 'resolved', // will be resolved by m6 — assertion below.
    });
  });

  it('m6: R-EV-02 fires; evidence debt opened by m5 against m4 resolves', () => {
    const muts = m('m6');
    expect(muts.find((mu) => mu.mutation === 'evidence_debt_resolved' && mu.targetMoveId === 'm4')).toBeTruthy();
    expect(muts.find((mu) => mu.mutation === 'evidence_attached_supporting' && mu.targetMoveId === 'm6')).toBeTruthy();
  });

  it('m7: R-CM-01 fires (narrows_claim); broader same-author ancestor is m1 (or m3/m5 — author A)', () => {
    const muts = m('m7');
    const narrowed = muts.find((mu) => mu.mutation === 'point_narrowed');
    expect(narrowed).toBeTruthy();
    // m7 author = Bandmate A; same-author ancestors in chain are m1, m3, m5.
    // The helper walks newest-first → m5 is the most-recent same-author ancestor.
    expect(['m1', 'm3', 'm5']).toContain(narrowed?.targetMoveId);
    expect(muts.find((mu) => mu.mutation === 'narrowing_landed' && mu.targetMoveId === 'm7')).toBeTruthy();
    // R-CM-02 fires too (concedes_narrow_point).
    expect(muts.find((mu) => mu.mutation === 'concession_landed' && mu.targetMoveId === 'm7')).toBeTruthy();
  });

  it('m8: R-CM-03 fires (ready_for_synthesis); synthesis_ready targets the room root in 23-id mode', () => {
    const muts = m('m8');
    const synthReady = muts.find((mu) => mu.mutation === 'synthesis_ready');
    expect(synthReady).toBeTruthy();
    // 23-id mode: no sub-axis state (introduces_sub_axis is PROPOSED and
    // stripped). R-CM-03 falls back to the room root (m1).
    expect(synthReady?.targetMoveId).toBe('m1');
    expect(muts.find((mu) => mu.mutation === 'synthesis_offered' && mu.targetMoveId === 'm8')).toBeTruthy();
    expect(replayState.state.synthesisReadiness.ready).toBe(true);
  });
});

// ── 35-id mode forward-compatibility check ──────────────────────

describe('COMP-001 §7.2.1 — band-space-rent — 35-id mode (catalog v1)', () => {
  // Post-MCP-CAT-001: the catalog declares all 35 ids. Additive
  // composition rules (R-CAT-SubAxis, R-EV-APP-01, etc.) fire on the
  // catalog v1 signals. The 35-id-mode mutation set is MOSTLY a superset
  // of the 23-id-mode mutation set with one INTENTIONAL DIFFERENCE: the
  // R-CM-03 (`ready_for_synthesis`) rule retargets from the room root
  // (23-id fallback) to the sub-axis root once the sub-axis state is
  // populated by R-CAT-SubAxis. This is the documented 35-id-mode tightening
  // (`docs/designs/COMP-001-worked-examples.md` §m8 "Tightened R-CM-03").
  const r23 = replay('23-id');
  const r35 = replay('35-id');

  it('every catalog-v0 mutation still appears in 35-id mode with the same target (except R-CM-03 retarget on m8)', () => {
    for (const move of FIXTURE.moves) {
      const baseline = r23.mutationsByMoveId.get(move.moveId) ?? [];
      const extended = r35.mutationsByMoveId.get(move.moveId) ?? [];
      for (const b of baseline) {
        // m8 R-CM-03 retarget: documented 35-id-mode tightening.
        if (move.moveId === 'm8' && b.mutation === 'synthesis_ready') {
          continue;
        }
        const found = extended.find(
          (e) => e.mutation === b.mutation && e.targetMoveId === b.targetMoveId,
        );
        expect({ move: move.moveId, missing: !!found, mutation: b.mutation, target: b.targetMoveId }).toEqual({
          move: move.moveId,
          missing: true,
          mutation: b.mutation,
          target: b.targetMoveId,
        });
      }
      // The extended set is the same size or larger.
      expect(extended.length).toBeGreaterThanOrEqual(baseline.length);
    }
  });

  it('m7 fires the catalog v1 R-CAT-SubAxis rule — sub_axis_opened on m7', () => {
    const muts = r35.mutationsByMoveId.get('m7') ?? [];
    // `introduces_sub_axis` is set on m7 in the fixture; R-CAT-SubAxis
    // (now active post-MCP-CAT-001) emits `sub_axis_opened` on the current move.
    expect(
      muts.find(
        (mu) => mu.mutation === 'sub_axis_opened' && mu.targetMoveId === 'm7',
      ),
    ).toBeTruthy();
  });

  it('m8 R-CM-03 retargets from m1 (23-id fallback) to m7 (35-id sub-axis root)', () => {
    const baseMuts = r23.mutationsByMoveId.get('m8') ?? [];
    const extMuts = r35.mutationsByMoveId.get('m8') ?? [];
    const baseSynth = baseMuts.find((mu) => mu.mutation === 'synthesis_ready');
    const extSynth = extMuts.find((mu) => mu.mutation === 'synthesis_ready');
    expect(baseSynth?.targetMoveId).toBe('m1');
    expect(extSynth?.targetMoveId).toBe('m7');
  });
});
