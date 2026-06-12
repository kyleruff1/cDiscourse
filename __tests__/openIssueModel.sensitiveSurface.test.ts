/**
 * REF-002 — Open Issue model: sensitive-surface (Family J) gating.
 *
 * Family J (`sensitive_composer`) marks never reach `refereeObservations`
 * — even when a J-derived mark IS present in `machineObservations`. The
 * public card carries ≤ 1 Observation. The production roster is DERIVED
 * from the `HUB_NON_PRODUCTION_FAMILIES` mirror (complement = A–I), never
 * hardcoded. Person-directed user Allegations carry composer-only /
 * moderator-only visibility and are never merged into the Observations.
 */

import {
  buildOpenIssue,
  OPEN_ISSUE_PRODUCTION_FAMILIES,
} from '../src/features/refereeLoop';
import {
  ALL_MACHINE_OBSERVATION_FAMILIES,
  type MachineObservationFamily,
} from '../src/features/nodeLabels/nodeLabelTypes';
import { HUB_NON_PRODUCTION_FAMILIES } from '../src/features/arguments/detail/argumentDetailModel';
import { makeInput, makeMark } from './fixtures/openIssueFixtures';

// A Family J (`sensitive_composer`) mark — source/rawKey from familyJ registry.
const jMark = () =>
  makeMark({
    id: 'machine_observation:semantic_referee:shifts_to_person_or_intent:node-1',
    rawKey: 'shifts_to_person_or_intent',
    source: 'semantic_referee',
    label: 'Shifts to the person',
    shortLabel: 'Person shift',
    description: 'composer-only sensitive note',
    defaultSurface: 'composer',
    disposition: 'composer_only',
    priority: 1, // would win the lowest-priority pick if NOT gated
  });

// A production-family (Family A — parent_relation) mark.
const productionMark = () =>
  makeMark({
    id: 'machine_observation:auto_metadata:has_rebuttal:node-1',
    rawKey: 'has_rebuttal',
    source: 'auto_metadata',
    label: 'Challenged',
    shortLabel: 'Challenged',
    description: 'A rebuttal was posted.',
    defaultSurface: 'selected_context',
    disposition: 'rendered_now',
    priority: 30,
  });

describe('REF-002 sensitiveSurface — Family J never reaches refereeObservations', () => {
  it('a J mark present alongside a production mark is dropped; the production mark surfaces', () => {
    const issue = buildOpenIssue(
      makeInput({ machineObservations: [jMark(), productionMark()] }),
    )!;
    expect(issue.refereeObservations).toHaveLength(1);
    expect(issue.refereeObservations[0].sourceCode).toBe('has_rebuttal');
    expect(issue.refereeObservations[0].sourceCode).not.toBe('shifts_to_person_or_intent');
  });

  it('a J mark ALONE yields no Observation (dropped, nothing left) even though it has the lowest priority', () => {
    const issue = buildOpenIssue(makeInput({ machineObservations: [jMark()] }))!;
    expect(issue.refereeObservations).toEqual([]);
  });

  it('the public card carries ≤ 1 Observation (multiple production marks → one, by lowest priority)', () => {
    const issue = buildOpenIssue(
      makeInput({
        machineObservations: [
          productionMark(),
          makeMark({ rawKey: 'disputes_definition', source: 'ai_classifier', label: 'Definition disputed', priority: 10 }),
        ],
      }),
    )!;
    expect(issue.refereeObservations.length).toBeLessThanOrEqual(1);
    // Lowest priority value wins.
    expect(issue.refereeObservations[0].sourceCode).toBe('disputes_definition');
  });

  it('an unknown rawKey (family `other`) is kept as a generic observation (hub parity)', () => {
    const issue = buildOpenIssue(
      makeInput({ machineObservations: [makeMark({ rawKey: 'totally_unknown_rawkey_xyz', source: 'auto_metadata', label: 'Generic note', priority: 5 })] }),
    )!;
    expect(issue.refereeObservations).toHaveLength(1);
    expect(issue.refereeObservations[0].sourceCode).toBe('totally_unknown_rawkey_xyz');
  });
});

describe('REF-002 sensitiveSurface — production roster derived from the HUB mirror', () => {
  it('OPEN_ISSUE_PRODUCTION_FAMILIES is the complement of HUB_NON_PRODUCTION_FAMILIES over ALL families', () => {
    const expected = ALL_MACHINE_OBSERVATION_FAMILIES.filter((f) => !HUB_NON_PRODUCTION_FAMILIES.includes(f));
    expect([...OPEN_ISSUE_PRODUCTION_FAMILIES]).toEqual([...expected]);
  });

  it('sensitive_composer (Family J) is excluded; the union of production + non-production is ALL families', () => {
    expect(OPEN_ISSUE_PRODUCTION_FAMILIES).not.toContain<MachineObservationFamily>('sensitive_composer');
    const union = new Set<MachineObservationFamily>([
      ...OPEN_ISSUE_PRODUCTION_FAMILIES,
      ...HUB_NON_PRODUCTION_FAMILIES,
    ]);
    expect(union.size).toBe(ALL_MACHINE_OBSERVATION_FAMILIES.length);
    for (const f of ALL_MACHINE_OBSERVATION_FAMILIES) expect(union.has(f)).toBe(true);
  });

  it('a synthetic registry-rename flows through the mirror (roster size tracks the complement)', () => {
    expect(OPEN_ISSUE_PRODUCTION_FAMILIES.length).toBe(
      ALL_MACHINE_OBSERVATION_FAMILIES.length - HUB_NON_PRODUCTION_FAMILIES.length,
    );
  });
});

describe('REF-002 sensitiveSurface — user Allegations stay separate + person-directed stays off the public card', () => {
  it('composer-only / hidden-sensitive Allegations carry non-public visibility', () => {
    const issue = buildOpenIssue(
      makeInput({
        userAllegations: [
          makeMark({ kind: 'user_allegation', source: 'manual_tag', rawKey: 'alleges_bad_intent', label: 'Concern about intent', disposition: 'composer_only', defaultSurface: 'composer' }),
          makeMark({ kind: 'user_allegation', source: 'manual_tag', rawKey: 'alleges_hidden', label: 'Hidden concern', disposition: 'hidden_sensitive', defaultSurface: 'hidden' }),
          makeMark({ kind: 'user_allegation', source: 'manual_tag', rawKey: 'public_tag', label: 'Public tag', disposition: 'rendered_now', defaultSurface: 'selected_context' }),
        ],
      }),
    )!;
    const byCode = Object.fromEntries(issue.userAllegations.map((a) => [a.sourceCode, a.visibility]));
    expect(byCode.alleges_bad_intent).toBe('composer_only');
    expect(byCode.alleges_hidden).toBe('moderator_only');
    expect(byCode.public_tag).toBe('public');
  });

  it('Allegations are NEVER merged into refereeObservations (the two arrays stay disjoint)', () => {
    const issue = buildOpenIssue(
      makeInput({
        machineObservations: [productionMark()],
        userAllegations: [makeMark({ kind: 'user_allegation', source: 'manual_tag', rawKey: 'alleges_bad_intent', label: 'Concern', disposition: 'composer_only', defaultSurface: 'composer' })],
      }),
    )!;
    for (const o of issue.refereeObservations) expect(o.kind).toBe('machine_observation');
    for (const a of issue.userAllegations) expect(a.kind).toBe('user_allegation');
    const obsCodes = new Set(issue.refereeObservations.map((o) => o.sourceCode));
    for (const a of issue.userAllegations) expect(obsCodes.has(a.sourceCode)).toBe(false);
  });
});
