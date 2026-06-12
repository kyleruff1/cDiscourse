/**
 * REF-006-RAIL — shared test fixtures for the Open Issues rail.
 *
 * NOT a test file (no `.test.` suffix) — pure factory helpers imported by the
 * openIssuesRail* suites. Mirrors `openIssueFixtures.ts`: every factory returns
 * a fully-typed object so the suites override only the load-bearing fields.
 */

import type {
  DisagreementAxis,
  IssueBurden,
  IssueState,
  MoveSuggestion,
  OpenIssue,
  RelationToParent,
} from '../../src/features/refereeLoop';
import type { OpenIssueLedgerCandidate } from '../../src/features/arguments/openIssuesRail/openIssuesRailModel';

export function makeRailMove(
  actEntryId: MoveSuggestion['actEntryId'],
  label: string,
): MoveSuggestion {
  return {
    actEntryId,
    label,
    accessibilityLabel: `${label} on this point`,
    isRecoveryRoute: false,
    recoveredFromCode: null,
  };
}

export function makeRailIssue(overrides: Partial<OpenIssue> = {}): OpenIssue {
  const targetNodeId = overrides.targetNodeId ?? 'node-1';
  const relation: RelationToParent = overrides.relationToParent ?? 'challenges';
  const axis: DisagreementAxis = overrides.axis ?? 'evidence';
  const burden: IssueBurden = overrides.burden ?? 'reply_owed';
  const state: IssueState = overrides.state ?? 'open';
  return {
    id: overrides.id ?? `issue:${targetNodeId}:${relation}:${axis}`,
    roomId: overrides.roomId ?? 'room-1',
    targetNodeId,
    targetQuote: overrides.targetQuote ?? null,
    contestedProposition:
      overrides.contestedProposition ?? 'Cars cause more harm than good in dense cities.',
    axis,
    relationToParent: relation,
    burden,
    state,
    refereeObservations: overrides.refereeObservations ?? [],
    userAllegations: overrides.userAllegations ?? [],
    nextBestMoves: overrides.nextBestMoves ?? [],
  };
}

export function makeRailCandidate(
  issue: OpenIssue,
  recencyIndex: number,
  isActive = false,
): OpenIssueLedgerCandidate {
  return { issue, recencyIndex, isActive };
}
