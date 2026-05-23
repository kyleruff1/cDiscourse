/**
 * COMP-001 §7.2.2 — Scenario replay: remote-work-productivity (8 moves).
 *
 * Replays the 8-move scenario from
 * `fixtures/argument-scenarios/smoke-test-mcp-remote-work-productivity.json`.
 *
 * This scenario uses ONLY current 23-id classifiers — no PROPOSED markers.
 * It is the cleanest regression test for COMP-001 at ship time.
 *
 * After 8 moves, the composition layer's view of the timeline:
 *   - m1: opening claim, narrowed downstream, synthesis-ready
 *   - m3: unverified evidence + source-chain gap (no clarification req
 *     because R-EX-02 exempted m2 from filing the debt)
 *   - m5: amplification warning + a second source-chain gap
 *   - m6: clarification + evidence-debt opened against m5
 *   - m7: narrowing + concession
 *   - m8: synthesis offered + side-branch suggested
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
  'smoke-test-mcp-remote-work-productivity.json',
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
  expectedClassifierSignal: FixtureSignal[];
}

const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as { moves: FixtureMove[] };

function buildPacket(
  move: FixtureMove,
  authorMovePosition: 'first' | 'subsequent',
): SemanticRefereePacket | undefined {
  // Apply the SAME exemption rules the smoke-test runner / hook would apply:
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
    roomId: 'room-remote-work',
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
      const prev = metas.find((mm) => mm.moveId === cursor);
      if (!prev) {
        break;
      }
      upchain.push(prev);
      cursor = prev.parentId;
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

describe('COMP-001 §7.2.2 — remote-work-productivity (8 moves, 23-id only)', () => {
  const rs = replay();
  const m = (id: string) => rs.mutationsByMoveId.get(id) ?? [];

  it('m1 (root): R-EX-01 fires; opening_claim_marker on m1', () => {
    expect(m('m1')).toHaveLength(1);
    expect(m('m1')[0]).toMatchObject({ targetMoveId: 'm1', mutation: 'opening_claim_marker' });
  });

  it('m2 (first move per Revocateur): R-EX-02 fires; zero composition mutations', () => {
    expect(m('m2')).toHaveLength(0);
  });

  it('m3: R-EV-03 + R-EV-07 fire; evidence_attached_unverified + source_chain_gap_flagged on m3', () => {
    const muts = m('m3');
    expect(muts.find((mu) => mu.mutation === 'evidence_attached_unverified' && mu.targetMoveId === 'm3')).toBeTruthy();
    expect(muts.find((mu) => mu.mutation === 'source_chain_gap_flagged' && mu.targetMoveId === 'm3')).toBeTruthy();
    expect(rs.state.sourceChainGaps.get('m3')?.status).toBe('open');
  });

  it('m4: R-PC-03 fires; clarification_requested on m3', () => {
    const muts = m('m4');
    expect(muts.find((mu) => mu.mutation === 'clarification_requested' && mu.targetMoveId === 'm3')).toBeTruthy();
    expect(rs.state.clarificationDebts.get('m4')).toMatchObject({
      openingMoveId: 'm4',
      targetMoveId: 'm3',
      status: 'open',
    });
  });

  it('m5: R-EV-04 + R-EV-07 fire; amplification warning + 2nd source-chain gap', () => {
    const muts = m('m5');
    expect(muts.find((mu) => mu.mutation === 'popularity_amplification_warning' && mu.targetMoveId === 'm5')).toBeTruthy();
    expect(muts.find((mu) => mu.mutation === 'source_chain_gap_flagged' && mu.targetMoveId === 'm5')).toBeTruthy();
    // Doctrine — amplification warning is ON CURRENT ONLY, never on the ancestor.
    for (const mu of muts.filter((x) => x.mutation === 'popularity_amplification_warning')) {
      expect(mu.targetMoveId).toBe('m5');
    }
  });

  it('m6: R-EV-01 + R-PC-03 fire; evidence_debt_opened on m5 + 2nd clarification debt opens', () => {
    const muts = m('m6');
    expect(muts.find((mu) => mu.mutation === 'evidence_debt_opened' && mu.targetMoveId === 'm5')).toBeTruthy();
    expect(muts.find((mu) => mu.mutation === 'clarification_requested' && mu.targetMoveId === 'm5')).toBeTruthy();
  });

  it('m7: R-CM-01 + R-CM-02 fire; point_narrowed targets a same-author ancestor; point_conceded targets the upstream challenger', () => {
    const muts = m('m7');
    const narrowed = muts.find((mu) => mu.mutation === 'point_narrowed');
    expect(narrowed).toBeTruthy();
    // m7's author = Provocateur; same-author ancestors are m1, m3, m5.
    // The helper's most-recent same-author is m5.
    expect(['m1', 'm3', 'm5']).toContain(narrowed?.targetMoveId);
    const conceded = muts.find((mu) => mu.mutation === 'point_conceded');
    expect(conceded).toBeTruthy();
    // m7's axis is null in the fixture; no axis-filter match; the helper
    // falls back to "any upstream different-author" → m6 (Revocateur).
    expect(conceded?.targetMoveId).toBe('m6');
    expect(muts.find((mu) => mu.mutation === 'concession_landed' && mu.targetMoveId === 'm7')).toBeTruthy();
    expect(rs.state.narrowingLinks.get('m7')).toBeTruthy();
  });

  it('m8: R-CM-02 + R-CM-03 + R-BR-01 fire; synthesis offered + side-branch suggested', () => {
    const muts = m('m8');
    expect(muts.find((mu) => mu.mutation === 'synthesis_offered' && mu.targetMoveId === 'm8')).toBeTruthy();
    expect(muts.find((mu) => mu.mutation === 'side_branch_suggested' && mu.targetMoveId === 'm8')).toBeTruthy();
    const synthReady = muts.find((mu) => mu.mutation === 'synthesis_ready');
    expect(synthReady).toBeTruthy();
    // 23-id mode: no sub-axis state → R-CM-03 falls back to the room root.
    expect(synthReady?.targetMoveId).toBe('m1');
    expect(rs.state.synthesisReadiness.ready).toBe(true);
    // The branch_route_hint edge mutation should also be emitted.
    expect(muts.find((mu) => mu.mutation === 'branch_route_hint' && mu.edgeOtherEndpointMoveId === 'm7')).toBeTruthy();
  });
});
