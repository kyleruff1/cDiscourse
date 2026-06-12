/**
 * REF-002 — Open Issue model: Act-gate parity.
 *
 * The headline doctrine invariant: `nextBestMoves ⊆ buildActPopout`
 * survivors — the card can never present a button the engine or role gate
 * would reject. Plus: gate-removed suggestions surface their recovery
 * route (never the invalid action); observer + own-bubble roles yield an
 * empty move list; the `SuggestedMoveCode → ActEntryId` map is exhaustive;
 * the recovery route is dropped (not forced) when branch_tangent is itself
 * gated out.
 */

import type {
  ActEntryId,
  ActViewerRole,
  ActPopoutGroup,
} from '../src/features/arguments/oneBox/actPopoutModel';
import {
  buildActPopout,
  flattenActPopout,
  ALL_ACT_ENTRY_IDS,
} from '../src/features/arguments/oneBox/actPopoutModel';
import type { ArgumentType } from '../src/domain/constitution/types';
import type { PointLifecycleState } from '../src/features/lifecycle';
import {
  deriveNextBestMoves,
  SUGGESTED_CODE_TO_ACT_ENTRY,
} from '../src/features/refereeLoop';
import { ALL_SUGGESTED_MOVE_CODES } from '../src/features/arguments/suggestedMovesModel';
import { makeRules, makeSuggestionInput, makeClusterSummary } from './fixtures/openIssueFixtures';

const ROLES: ActViewerRole[] = ['observer', 'participant_other', 'own_bubble'];
const PARENTS: (ArgumentType | null)[] = [null, 'thesis', 'claim', 'rebuttal', 'evidence', 'concession', 'synthesis'];
const STAGES: PointLifecycleState[] = ['open', 'source_requested', 'narrowed', 'exhausted', 'branch_recommended', 'synthesis_ready'];

function groupsFor(role: ActViewerRole, parentType: ArgumentType | null, stage: PointLifecycleState): ActPopoutGroup[] {
  return buildActPopout({ targetKind: 'node', role, stage, parentType, rules: makeRules() });
}
function survivorIds(groups: ActPopoutGroup[]): Set<ActEntryId> {
  return new Set(flattenActPopout(groups).map((e) => e.id));
}

describe('REF-002 actGateParity — nextBestMoves ⊆ buildActPopout survivors (property)', () => {
  it('every move is a surviving Act entry across roles × parents × stages', () => {
    for (const role of ROLES) {
      for (const parentType of PARENTS) {
        for (const stage of STAGES) {
          const groups = groupsFor(role, parentType, stage);
          const ids = survivorIds(groups);
          const moves = deriveNextBestMoves({
            suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary(stage), sourceChainStatus: 'no_source' }),
            actGroups: groups,
          });
          for (const m of moves) {
            expect(ids.has(m.actEntryId)).toBe(true);
          }
          // Never more than maxMoves; never a duplicate.
          expect(moves.length).toBeLessThanOrEqual(3);
          expect(new Set(moves.map((m) => m.actEntryId)).size).toBe(moves.length);
        }
      }
    }
  });
});

describe('REF-002 actGateParity — observer + own-bubble yield no constructive moves', () => {
  it.each(STAGES)('observer role → [] (stage %s)', (stage) => {
    const groups = groupsFor('observer', 'claim', stage);
    const moves = deriveNextBestMoves({
      suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary(stage), sourceChainStatus: 'no_source' }),
      actGroups: groups,
    });
    expect(moves).toEqual([]);
  });

  it('own_bubble role → [] (only qualifiers + request-deletion survive)', () => {
    const groups = groupsFor('own_bubble', 'claim', 'open');
    const moves = deriveNextBestMoves({
      suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('source_requested'), sourceChainStatus: 'no_source' }),
      actGroups: groups,
    });
    expect(moves).toEqual([]);
  });
});

describe('REF-002 actGateParity — gate-removed suggestion → recovery route', () => {
  it('a gated-out `narrow` surfaces the branch_tangent recovery, never the invalid action', () => {
    // Parent allows no concession child → the `narrow` Act entry is removed.
    const rules = makeRules({ claim: ['evidence', 'rebuttal', 'clarification_request', 'synthesis'] });
    const groups = buildActPopout({ targetKind: 'node', role: 'participant_other', stage: 'exhausted', parentType: 'claim', rules });
    expect(survivorIds(groups).has('narrow')).toBe(false);
    expect(survivorIds(groups).has('branch_tangent')).toBe(true);

    const moves = deriveNextBestMoves({
      // lifecycle exhausted → suggested [narrow, branch_tangent].
      suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('exhausted') }),
      actGroups: groups,
    });
    const recovery = moves.find((m) => m.isRecoveryRoute);
    expect(recovery).toBeDefined();
    expect(recovery!.actEntryId).toBe('branch_tangent');
    expect(recovery!.recoveredFromCode).toBe('narrow');
    for (const m of moves) expect(m.actEntryId).not.toBe('narrow');
  });

  it('recovery route is DROPPED (not forced) when branch_tangent is itself gated out', () => {
    // Observer role removes branch_tangent (and narrow); a gated-out suggestion
    // cannot recover → it is dropped, never forced.
    const groups = buildActPopout({ targetKind: 'node', role: 'observer', stage: 'exhausted', parentType: 'claim', rules: makeRules() });
    expect(survivorIds(groups).has('branch_tangent')).toBe(false);
    const moves = deriveNextBestMoves({
      suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('exhausted') }),
      actGroups: groups,
    });
    expect(moves).toEqual([]);
  });
});

describe('REF-002 actGateParity — SuggestedMoveCode → ActEntryId map is exhaustive + valid', () => {
  it('every SuggestedMoveCode has a mapping', () => {
    for (const code of ALL_SUGGESTED_MOVE_CODES) {
      expect(SUGGESTED_CODE_TO_ACT_ENTRY[code]).toBeDefined();
    }
    expect(Object.keys(SUGGESTED_CODE_TO_ACT_ENTRY).sort()).toEqual([...ALL_SUGGESTED_MOVE_CODES].sort());
  });

  it('every mapped ActEntryId is a real Act entry', () => {
    const valid = new Set<ActEntryId>(ALL_ACT_ENTRY_IDS);
    for (const code of ALL_SUGGESTED_MOVE_CODES) {
      expect(valid.has(SUGGESTED_CODE_TO_ACT_ENTRY[code])).toBe(true);
    }
  });
});
