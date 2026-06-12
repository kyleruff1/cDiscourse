/**
 * REF-004 — Recovery-route conversion: an engine-invalid intended move is
 * never rendered active; the recovery routes through the SAME Act flow.
 *
 *   1. When the engine gate removes `narrow`'s `concession` child,
 *      `buildOpenIssue(input).nextBestMoves` surfaces the `branch_tangent`
 *      recovery (`isRecoveryRoute: true`, `recoveredFromCode` set) and NEVER
 *      the invalid `narrow` entry → "invalid never active."
 *   2. The recovery target `branch_tangent` is itself a `buildActPopout`
 *      survivor (the recovery enters an ENGINE-VALID box — no bypass).
 *   3. `enterBoxForActEntry`'s pure mapping for the recovery —
 *      `actEntryToQuickAction('branch_tangent') === 'branch'` — targets the
 *      branch box (the surface routes `handleRefereeMove(recovery)` →
 *      `enterBoxForActEntry('branch_tangent')`).
 *   4. Observer role: the recovery is DROPPED (branch_tangent also gated out)
 *      → zone 3 is empty; no fabricated action.
 *
 * REF-002 owns the model half (`deriveNextBestMoves`); REF-004 consumes it.
 * This suite re-pins the doctrine at the REF-004 surface boundary.
 */

import {
  buildActPopout,
  flattenActPopout,
  actEntryToQuickAction,
  type ActEntryId,
  type ActPopoutGroup,
} from '../src/features/arguments/oneBox/actPopoutModel';
import { buildOpenIssue } from '../src/features/refereeLoop';
import {
  makeInput,
  makeRules,
  makeSuggestionInput,
  makeClusterSummary,
} from './fixtures/openIssueFixtures';

/** Survivor ids for an Act-popout build. */
function survivorIds(groups: ActPopoutGroup[]): Set<ActEntryId> {
  return new Set(flattenActPopout(groups).map((e) => e.id));
}

/** A claim parent whose allowed children EXCLUDE `concession` — so the engine
 *  gate removes `narrow` (a concession move) while `branch_tangent`
 *  (argumentType null, engine-exempt) survives. */
const RULES_NO_CONCESSION = makeRules({
  claim: ['evidence', 'rebuttal', 'clarification_request', 'synthesis'],
});

describe('REF-004 recovery — invalid never active; branch_tangent recovery surfaces', () => {
  it('a gated-out narrow surfaces the branch_tangent recovery, never the invalid narrow', () => {
    const issue = buildOpenIssue(
      makeInput({
        parentType: 'claim',
        rules: RULES_NO_CONCESSION,
        viewerRole: 'participant_other',
        lifecycleState: 'exhausted',
        suggestionInput: makeSuggestionInput({
          clusterSummary: makeClusterSummary('exhausted'),
        }),
      }),
    )!;

    // The invalid entry is never an active button.
    expect(issue.nextBestMoves.some((m) => m.actEntryId === 'narrow')).toBe(false);

    // The recovery is present, flagged, and names what it recovered from.
    const recovery = issue.nextBestMoves.find((m) => m.isRecoveryRoute);
    expect(recovery).toBeDefined();
    expect(recovery!.actEntryId).toBe('branch_tangent');
    expect(recovery!.recoveredFromCode).toBe('narrow');

    // The recovery label is the NORMAL Act-entry label — never "invalid" /
    // "rejected" / the removed move's name.
    expect(recovery!.label.toLowerCase()).not.toContain('invalid');
    expect(recovery!.label.toLowerCase()).not.toContain('rejected');
    expect(recovery!.label.toLowerCase()).not.toContain('narrow');
  });

  it('branch_tangent is itself a buildActPopout survivor (recovery enters an engine-valid box)', () => {
    const groups = buildActPopout({
      targetKind: 'node',
      role: 'participant_other',
      stage: 'exhausted',
      parentType: 'claim',
      rules: RULES_NO_CONCESSION,
    });
    const survivors = survivorIds(groups);
    expect(survivors.has('branch_tangent')).toBe(true);
    expect(survivors.has('narrow')).toBe(false);
  });

  it('enterBoxForActEntry maps the recovery to the branch box (no bypass)', () => {
    // The surface routes handleRefereeMove(recovery) → enterBoxForActEntry(
    // 'branch_tangent'); the pure mapping it uses opens the branch box.
    expect(actEntryToQuickAction('branch_tangent')).toBe('branch');
  });

  it('every nextBestMoves entry is an engine+role survivor (the card holds no rejectable button)', () => {
    const groups = buildActPopout({
      targetKind: 'node',
      role: 'participant_other',
      stage: 'exhausted',
      parentType: 'claim',
      rules: RULES_NO_CONCESSION,
    });
    const survivors = survivorIds(groups);
    const issue = buildOpenIssue(
      makeInput({
        parentType: 'claim',
        rules: RULES_NO_CONCESSION,
        viewerRole: 'participant_other',
        lifecycleState: 'exhausted',
        suggestionInput: makeSuggestionInput({
          clusterSummary: makeClusterSummary('exhausted'),
        }),
      }),
    )!;
    for (const move of issue.nextBestMoves) {
      expect(survivors.has(move.actEntryId)).toBe(true);
    }
  });
});

describe('REF-004 recovery — observer role drops the recovery (no fabricated action)', () => {
  it('observer → branch_tangent gated out → recovery dropped → zone 3 empty', () => {
    const groups = buildActPopout({
      targetKind: 'node',
      role: 'observer',
      stage: 'exhausted',
      parentType: 'claim',
      rules: makeRules(),
    });
    // Observer removes both narrow AND branch_tangent.
    expect(survivorIds(groups).has('branch_tangent')).toBe(false);

    const issue = buildOpenIssue(
      makeInput({
        parentType: 'claim',
        viewerRole: 'observer',
        lifecycleState: 'exhausted',
        suggestionInput: makeSuggestionInput({
          clusterSummary: makeClusterSummary('exhausted'),
        }),
      }),
    )!;
    expect(issue.nextBestMoves).toEqual([]);
  });

  it('own_bubble → no constructive survivors → zone 3 empty', () => {
    const issue = buildOpenIssue(
      makeInput({
        parentType: 'claim',
        viewerRole: 'own_bubble',
        lifecycleState: 'exhausted',
        suggestionInput: makeSuggestionInput({
          clusterSummary: makeClusterSummary('exhausted'),
        }),
      }),
    )!;
    expect(issue.nextBestMoves).toEqual([]);
  });
});
