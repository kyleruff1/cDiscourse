/**
 * MCP-CAT-001-FIXTURE-002 (#453) — Scenario replay: catalog-coverage
 * satire / popularity / routing exhibit (10 moves).
 *
 * Replays the runnable scenario from
 * `fixtures/argument-scenarios/catalog-coverage-satire-popularity-routing.json`
 * through the ALREADY-SHIPPED `composeVisualState` (COMP-001) and asserts the
 * existing runtime produces the expected, doctrine-clean mutation set for the
 * under-exercised catalog ids that the band-space-rent fixture never fires:
 *
 *   m3  contains_playable_hot_take  → playable_hot_take      (R-DM-02)
 *   m3  fits_selected_debate_mode=0 → mode_mismatch_warning  (R-DM-01)
 *   m4  is_satire_or_parody         → satire_marker          (R-DM-03)
 *   m4  uses_satire_as_evidence     → satire_as_evidence_warning (R-EV-05)
 *   m5  uses_popularity_as_evidence → popularity_amplification_warning (R-EV-04)
 *   m6  requests_clarification      → clarification_requested (R-PC-03)
 *   m6  suggests_side_branch        → side_branch_suggested + branch_route_hint (R-BR-01)
 *   m7  answers_clarification       → clarification_answered + clarification_resolved (R-PC-04)
 *   m7  creates_source_chain_gap    → source_chain_gap_flagged (R-EV-07)
 *   m7  suggests_diagonal_tangent   → diagonal_tangent_suggested + tangent_route_hint (R-BR-02)
 *   m7  cites_retraction            → retraction_cited        (R-EV-06)
 *   m8  shifts_to_person_or_intent  → person_shift_warning    (R-BR-03, composer-only)
 *   m8  contains_unplayable_insult_only → unplayable_move     (R-BR-04, composer-only)
 *   m8  needs_pre_send_pause        → pre_send_pause_advised  (R-CM-04, composer-only)
 *   m10 ready_for_synthesis         → synthesis_ready + synthesis_offered (R-CM-03)
 *
 * This test is PURELY ADDITIVE VERIFICATION (#453 conditional): every target id
 * already maps to a live, shipped composition rule and is a member of the 35-id
 * catalog, so NO runtime change is expected or made. If any expected mutation is
 * absent, that is a runtime/catalog FINDING to surface — not a runtime edit.
 *
 * Pure test — no network, no Supabase, no React. The packet builder mirrors the
 * proven helper in `__tests__/compositionLayerRemoteWorkProductivity.test.ts`:
 * root + first-move-per-author are exempt (no packet).
 *
 * Doctrine (cdiscourse-doctrine §1 / §3 / §10a): the composer-only friction ids
 * mark structure, not the text. The ban-list scan block at the bottom asserts
 * the fixture's own strings carry no verdict / person token and none of the
 * validator's FORBIDDEN_TERMS — proving the popularity / satire / person-shift
 * exhibits surface advisory warnings, never verdicts.
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
import { FORBIDDEN_TERMS } from '../src/features/devFixtures/argumentScenarioValidation';

const FIXTURE_PATH = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'argument-scenarios',
  'catalog-coverage-satire-popularity-routing.json',
);

interface FixtureSignal {
  id: string;
  value: 0 | 1;
}
interface FixtureMove {
  moveId: string;
  authorAlias: string;
  parentMoveId: string | null;
  argumentType: string;
  disagreementAxis: string | null;
  targetExcerpt?: string | null;
  body: string;
  evidence?: { label?: string; sourceText?: string; url?: string } | null;
  displayMeta?: { playfulLabel?: string; quoteAnchorCandidate?: string };
  expectedClassifierSignal: FixtureSignal[];
}

const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as {
  title: string;
  resolution: string;
  notes: string;
  personas: { alias: string }[];
  moves: FixtureMove[];
};

function buildPacket(
  move: FixtureMove,
  authorMovePosition: 'first' | 'subsequent',
): SemanticRefereePacket | undefined {
  // Same exemptions the smoke-test runner / hook applies:
  //   - Root has no parent → R-EX-01 exempts; no packet.
  //   - First move per author → R-EX-02 exempts; no packet.
  if (move.parentMoveId == null) {
    return undefined;
  }
  if (authorMovePosition === 'first') {
    return undefined;
  }
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-model-0',
    provider: 'mock',
    authoritative: false,
    inputHash: `inputhash-${move.moveId}`,
    contentHash: `contenthash-${move.moveId}`,
    roomId: 'room-catalog-coverage',
    moveId: move.moveId,
    parentId: move.parentMoveId ?? undefined,
    binaries: move.expectedClassifierSignal.map((s) => ({
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
  mutationsByMoveId: Map<string, ReturnType<typeof composeVisualState>['mutations']>;
}

function replay(): ReplayState {
  let state: CompositionState = EMPTY_COMPOSITION_STATE;
  const metas: MoveMetadata[] = [];
  const mutationsByMoveId = new Map<string, ReturnType<typeof composeVisualState>['mutations']>();
  const aliasToAuthorId = new Map<string, string>();
  for (const m of FIXTURE.moves) {
    if (!aliasToAuthorId.has(m.authorAlias)) {
      aliasToAuthorId.set(m.authorAlias, `author_${aliasToAuthorId.size + 1}`);
    }
  }
  const movesByAuthor = new Map<string, number>();
  const packetsByMoveId = new Map<string, SemanticRefereePacket | undefined>();
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
    const packet = buildPacket(move, meta.authorMovePosition!);
    packetsByMoveId.set(move.moveId, packet);
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
  return { state, metas, mutationsByMoveId };
}

describe('MCP-CAT-001-FIXTURE-002 §B — catalog-coverage replay (10 moves)', () => {
  const rs = replay();
  const m = (id: string) => rs.mutationsByMoveId.get(id) ?? [];
  const has = (id: string, mutation: string, targetMoveId: string) =>
    m(id).some((mu) => mu.mutation === mutation && mu.targetMoveId === targetMoveId);

  it('m1 (root): R-EX-01 fires; opening_claim_marker on m1', () => {
    expect(m('m1')).toHaveLength(1);
    expect(m('m1')[0]).toMatchObject({ targetMoveId: 'm1', mutation: 'opening_claim_marker' });
  });

  it('m2 (first move for Binge): R-EX-02 fires; zero composition mutations', () => {
    expect(m('m2')).toHaveLength(0);
  });

  it('m3: R-DM-02 + R-DM-01 fire; playable_hot_take AND mode_mismatch_warning on m3', () => {
    expect(has('m3', 'playable_hot_take', 'm3')).toBe(true);
    expect(has('m3', 'mode_mismatch_warning', 'm3')).toBe(true);
  });

  it('m4: R-DM-03 + R-EV-05 fire; satire_marker AND satire_as_evidence_warning on m4', () => {
    expect(has('m4', 'satire_marker', 'm4')).toBe(true);
    expect(has('m4', 'satire_as_evidence_warning', 'm4')).toBe(true);
  });

  it('m5: R-EV-04 fires; popularity_amplification_warning on m5 only (never on the ancestor)', () => {
    expect(has('m5', 'popularity_amplification_warning', 'm5')).toBe(true);
    for (const mu of m('m5').filter((x) => x.mutation === 'popularity_amplification_warning')) {
      expect(mu.targetMoveId).toBe('m5');
    }
  });

  it('m6: R-PC-03 + R-BR-01 fire; clarification_requested on m5, side_branch_suggested + branch_route_hint on m6; clarification debt opened', () => {
    expect(has('m6', 'clarification_requested', 'm5')).toBe(true);
    expect(has('m6', 'side_branch_suggested', 'm6')).toBe(true);
    expect(
      m('m6').some(
        (mu) =>
          mu.mutation === 'branch_route_hint' &&
          mu.targetMoveId === 'm6' &&
          mu.edgeOtherEndpointMoveId === 'm5',
      ),
    ).toBe(true);
    expect(rs.state.clarificationDebts.get('m6')).toMatchObject({
      openingMoveId: 'm6',
      targetMoveId: 'm5',
      status: 'resolved', // resolved by m7 — asserted in the m7 block below.
    });
  });

  it('m7: R-PC-04 + R-EV-07 + R-BR-02 fire; clarification answered/resolved, source-chain gap flagged + opened, diagonal tangent suggested', () => {
    expect(has('m7', 'clarification_answered', 'm7')).toBe(true);
    // Cross-node: the asking move (m6) gets clarification_resolved.
    expect(has('m7', 'clarification_resolved', 'm6')).toBe(true);
    expect(has('m7', 'source_chain_gap_flagged', 'm7')).toBe(true);
    expect(rs.state.sourceChainGaps.get('m7')?.status).toBe('open');
    expect(has('m7', 'diagonal_tangent_suggested', 'm7')).toBe(true);
    expect(
      m('m7').some(
        (mu) =>
          mu.mutation === 'tangent_route_hint' &&
          mu.targetMoveId === 'm7' &&
          mu.edgeOtherEndpointMoveId === 'm6',
      ),
    ).toBe(true);
  });

  it('m7: R-EV-06 fires; retraction_cited on m7', () => {
    expect(has('m7', 'retraction_cited', 'm7')).toBe(true);
  });

  it('m8: R-BR-03 + R-BR-04 + R-CM-04 fire; person_shift_warning, unplayable_move, pre_send_pause_advised on m8 (composer-only)', () => {
    expect(has('m8', 'person_shift_warning', 'm8')).toBe(true);
    expect(has('m8', 'unplayable_move', 'm8')).toBe(true);
    expect(has('m8', 'pre_send_pause_advised', 'm8')).toBe(true);
    expect(rs.state.personShiftMoves.has('m8')).toBe(true);
    expect(rs.state.unplayableMoves.has('m8')).toBe(true);
    // Doctrine §10a: composer-only friction Observations target the move itself,
    // never the target's node (no cross-node accusation).
    for (const mu of m('m8').filter(
      (x) =>
        x.mutation === 'person_shift_warning' ||
        x.mutation === 'unplayable_move' ||
        x.mutation === 'pre_send_pause_advised',
    )) {
      expect(mu.targetMoveId).toBe('m8');
    }
  });

  it('m9 (first move for Cuts): R-EX-02 fires; zero composition mutations (move-kind only carries the concession requirement)', () => {
    expect(m('m9')).toHaveLength(0);
  });

  it('m10: R-CM-03 fires; synthesis_ready + synthesis_offered; synthesisReadiness.ready true', () => {
    expect(has('m10', 'synthesis_offered', 'm10')).toBe(true);
    expect(m('m10').some((mu) => mu.mutation === 'synthesis_ready')).toBe(true);
    expect(rs.state.synthesisReadiness.ready).toBe(true);
  });

  it('coverage roll-up: every B.1 primary target mutation is emitted somewhere in the replay', () => {
    const emitted = new Set<string>();
    for (const move of FIXTURE.moves) {
      for (const mu of m(move.moveId)) {
        emitted.add(mu.mutation);
      }
    }
    const expectedTargetMutations = [
      'playable_hot_take',
      'mode_mismatch_warning',
      'satire_marker',
      'satire_as_evidence_warning',
      'popularity_amplification_warning',
      'clarification_requested',
      'side_branch_suggested',
      'branch_route_hint',
      'clarification_answered',
      'clarification_resolved',
      'source_chain_gap_flagged',
      'diagonal_tangent_suggested',
      'tangent_route_hint',
      'retraction_cited',
      'person_shift_warning',
      'unplayable_move',
      'pre_send_pause_advised',
      'synthesis_ready',
      'synthesis_offered',
    ];
    const missing = expectedTargetMutations.filter((mut) => !emitted.has(mut));
    expect(missing).toEqual([]);
  });
});

describe('MCP-CAT-001-FIXTURE-002 §B.6#2 — doctrine ban-list scan of the coverage fixture', () => {
  // Doctrine verdict / person-label tokens (mirrors
  // `mcpCat001NewClassifierIds.test.ts` lines 53-78).
  const DOCTRINE_TOKENS: readonly string[] = [
    'winner',
    'loser',
    'won',
    'lost',
    'right',
    'wrong',
    'true',
    'false',
    'correct',
    'incorrect',
    'proven',
    'defeated',
    'liar',
    'lying',
    'dishonest',
    'manipulative',
    'troll',
    'propagandist',
    'extremist',
    'stupid',
    'idiot',
  ];
  const DOCTRINE_PHRASES: readonly string[] = ['bad faith'];

  function wordBoundaryRe(term: string): RegExp {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i');
  }

  function collectStrings(): { label: string; text: string }[] {
    const out: { label: string; text: string }[] = [];
    out.push({ label: 'title', text: FIXTURE.title });
    out.push({ label: 'resolution', text: FIXTURE.resolution });
    out.push({ label: 'notes', text: FIXTURE.notes });
    for (const p of FIXTURE.personas) {
      out.push({ label: 'persona.alias', text: p.alias });
    }
    for (const mv of FIXTURE.moves) {
      out.push({ label: `${mv.moveId}.body`, text: mv.body });
      if (mv.targetExcerpt) out.push({ label: `${mv.moveId}.targetExcerpt`, text: mv.targetExcerpt });
      if (mv.displayMeta?.playfulLabel) {
        out.push({ label: `${mv.moveId}.displayMeta.playfulLabel`, text: mv.displayMeta.playfulLabel });
      }
      if (mv.displayMeta?.quoteAnchorCandidate) {
        out.push({ label: `${mv.moveId}.displayMeta.quoteAnchorCandidate`, text: mv.displayMeta.quoteAnchorCandidate });
      }
      if (mv.evidence?.label) out.push({ label: `${mv.moveId}.evidence.label`, text: mv.evidence.label });
      if (mv.evidence?.sourceText) out.push({ label: `${mv.moveId}.evidence.sourceText`, text: mv.evidence.sourceText });
    }
    return out.filter((s) => typeof s.text === 'string' && s.text.length > 0);
  }

  const STRINGS = collectStrings();

  it('no doctrine verdict / person token appears in any fixture string', () => {
    const hits: string[] = [];
    for (const { label, text } of STRINGS) {
      for (const token of DOCTRINE_TOKENS) {
        if (wordBoundaryRe(token).test(text)) {
          hits.push(`"${token}" in ${label}: "${text.slice(0, 60)}"`);
        }
      }
      for (const phrase of DOCTRINE_PHRASES) {
        if (text.toLowerCase().replace(/\s+/g, ' ').includes(phrase)) {
          hits.push(`phrase "${phrase}" in ${label}: "${text.slice(0, 60)}"`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("no validator FORBIDDEN_TERM (truth / ban / hide / manipulation / ...) appears in any fixture string", () => {
    const hits: string[] = [];
    for (const { label, text } of STRINGS) {
      for (const term of FORBIDDEN_TERMS) {
        if (wordBoundaryRe(term).test(text)) {
          hits.push(`"${term}" in ${label}: "${text.slice(0, 60)}"`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
