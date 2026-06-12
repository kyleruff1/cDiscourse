/**
 * REF-002 — Open Issue model: ban-list + plain-language coverage.
 *
 * Every emitted user-facing string (the four frozen label maps, the
 * terminal-state lines, every `RefereeCardViewModel` field, and every
 * `MoveSuggestion` label / accessibilityLabel) is scanned for the 16
 * prohibited verdict/person tokens and for raw snake_case leaks. The 8
 * `IssueState` codes each resolve through `toPlainLanguageOrSuppress`
 * (pinning the `moved_on` addition).
 */

import {
  buildOpenIssue,
  openIssueToRefereeCard,
  RELATION_LABEL,
  BURDEN_LABEL,
  ISSUE_STATE_LABEL,
  AXIS_LABEL,
  ISSUE_STATE_TERMINAL_LINE,
  ALL_ISSUE_STATES,
  type DisagreementContract,
} from '../src/features/refereeLoop';
import { looksLikeInternalCode, toPlainLanguageOrSuppress } from '../src/features/arguments/gameCopy';
import {
  makeInput,
  makeDebt,
  makeBanner,
  makeBannerSelection,
  makeClusterSummary,
  makeSuggestionInput,
} from './fixtures/openIssueFixtures';

/** The 16 prohibited verdict / person tokens (REF-002 design Test plan). */
const PROHIBITED_TOKENS: ReadonlyArray<string> = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'truth',
  'untrue',
  'dishonest',
  'liar',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'verdict',
  'bad faith',
  'proof of',
];

function assertClean(label: string): void {
  const lower = label.toLowerCase();
  for (const token of PROHIBITED_TOKENS) {
    expect(lower).not.toContain(token);
  }
}

/** A spread of issues exercising every burden / state / axis / banner path. */
function sampleIssues(): DisagreementContract[] {
  const out: DisagreementContract[] = [];
  out.push(
    buildOpenIssue(
      makeInput({
        selectedActEntryId: 'ask_source',
        openEvidenceDebts: [makeDebt({ debtKind: 'source' })],
        lifecycleState: 'source_requested',
        sourceChainStatus: 'no_source',
        bannerSelection: makeBannerSelection(makeBanner()),
        suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('source_requested'), sourceChainStatus: 'no_source' }),
      }),
    )!,
  );
  out.push(buildOpenIssue(makeInput({ selectedActEntryId: 'narrow', lifecycleState: 'narrowed', lifecycleAxis: 'scope', suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('narrowed') }) }))!);
  out.push(buildOpenIssue(makeInput({ selectedActEntryId: 'branch_tangent', lifecycleState: 'branch_recommended', manualTags: ['tangent'], suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('branch_recommended') }) }))!);
  out.push(buildOpenIssue(makeInput({ selectedActEntryId: 'concede', lifecycleState: 'conceded' }))!);
  out.push(buildOpenIssue(makeInput({ selectedChannel: 'challenge', lifecycleState: 'open' }))!);
  out.push(buildOpenIssue(makeInput({ lifecycleState: 'synthesis_ready', suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('synthesis_ready') }) }))!);
  out.push(buildOpenIssue(makeInput({ storedArgumentType: 'clarification_request', lifecycleAxis: 'definition' }))!);
  return out;
}

describe('REF-002 ban-list — frozen label maps carry no prohibited token', () => {
  it.each(Object.entries(RELATION_LABEL))('RELATION_LABEL.%s', (_k, label) => assertClean(label));
  it.each(Object.entries(BURDEN_LABEL))('BURDEN_LABEL.%s', (_k, label) => assertClean(label));
  it.each(Object.entries(ISSUE_STATE_LABEL))('ISSUE_STATE_LABEL.%s', (_k, label) => assertClean(label));
  it.each(Object.entries(AXIS_LABEL))('AXIS_LABEL.%s', (_k, label) => assertClean(label));
  it.each(Object.entries(ISSUE_STATE_TERMINAL_LINE))('ISSUE_STATE_TERMINAL_LINE.%s', (_k, label) => assertClean(label));
});

describe('REF-002 ban-list — no raw snake_case in any frozen label', () => {
  const everyLabel = [
    ...Object.values(RELATION_LABEL),
    ...Object.values(BURDEN_LABEL),
    ...Object.values(ISSUE_STATE_LABEL),
    ...Object.values(AXIS_LABEL),
    ...Object.values(ISSUE_STATE_TERMINAL_LINE),
  ];
  it.each(everyLabel)('%s is not an internal code', (label) => {
    expect(looksLikeInternalCode(label)).toBe(false);
  });
});

describe('REF-002 ban-list — every emitted RefereeCardViewModel string is clean', () => {
  const issues = sampleIssues();
  it('zone lines, referee note, a11y label, and move labels are token-clean + not snake_case', () => {
    for (const issue of issues) {
      const vm = openIssueToRefereeCard(issue);
      const strings = [
        vm.zone1RelationLine,
        vm.zone2OpenTaskLine,
        vm.refereeNoteSentence,
        vm.accessibilityLabel,
        ...vm.zone3Moves.flatMap((m) => [m.label, m.accessibilityLabel]),
      ];
      for (const s of strings) {
        assertClean(s);
        expect(looksLikeInternalCode(s)).toBe(false);
      }
    }
  });

  it('the contested proposition / target quote are never AI-synthesized verdict copy', () => {
    for (const issue of issues) {
      assertClean(issue.contestedProposition);
      if (issue.targetQuote) assertClean(issue.targetQuote);
    }
  });
});

describe('REF-002 plain-language coverage — each of the 8 IssueState codes resolves (pins moved_on)', () => {
  it('has exactly 8 IssueState codes', () => {
    expect(ALL_ISSUE_STATES).toHaveLength(8);
  });

  it.each([...ALL_ISSUE_STATES])('toPlainLanguageOrSuppress(%s) is non-null + not snake_case', (state) => {
    const plain = toPlainLanguageOrSuppress(state);
    expect(plain).not.toBeNull();
    expect(plain!.length).toBeGreaterThan(0);
    expect(looksLikeInternalCode(plain!)).toBe(false);
    assertClean(plain!);
  });

  it('moved_on specifically resolves (the REF-002 PLAIN_LANGUAGE_COPY addition)', () => {
    expect(toPlainLanguageOrSuppress('moved_on')).toBe('Moved on');
  });
});
