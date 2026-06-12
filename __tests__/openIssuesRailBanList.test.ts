/**
 * REF-006-RAIL — ban-list scan.
 *
 * Scans every string the rail can emit — `OPEN_ISSUES_RAIL_COPY`, every
 * REF-002 label atom the rail composes from (`ISSUE_STATE_LABEL` /
 * `BURDEN_LABEL` / `RELATION_LABEL` / `AXIS_LABEL` / `ISSUE_STATE_TERMINAL_LINE`),
 * and every emitted `OpenIssueLedgerEntry` string (stateLabel / openTaskLine /
 * contestedProposition / accessibilityLabel / move labels) — against the 16
 * prohibited verdict / person tokens (verbatim from
 * `openIssueModel.banlist.test.ts:34`).
 */

import {
  buildOpenIssuesLedger,
  OPEN_ISSUES_RAIL_COPY,
  type OpenIssueLedgerEntry,
} from '../src/features/arguments/openIssuesRail/openIssuesRailModel';
import {
  ISSUE_STATE_LABEL,
  BURDEN_LABEL,
  RELATION_LABEL,
  AXIS_LABEL,
  ISSUE_STATE_TERMINAL_LINE,
} from '../src/features/refereeLoop';
import { makeRailCandidate, makeRailIssue, makeRailMove } from './fixtures/openIssuesRailFixtures';

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

/** A spread of entries exercising every burden / state / axis + a banner glyph + moves. */
function sampleEntries(): OpenIssueLedgerEntry[] {
  const candidates = [
    makeRailCandidate(
      makeRailIssue({
        id: 'i-source',
        burden: 'source_owed',
        axis: 'evidence',
        state: 'source_requested',
        nextBestMoves: [makeRailMove('ask_source', 'Ask for a source')],
        refereeObservations: [
          { sourceCode: 'banner', line: 'This move asks for a source.', toneGlyph: 'arrow', kind: 'machine_observation' },
        ],
      }),
      6,
      true,
    ),
    makeRailCandidate(makeRailIssue({ id: 'i-quote', burden: 'quote_owed', axis: 'definition', state: 'quote_requested' }), 5),
    makeRailCandidate(makeRailIssue({ id: 'i-clar', burden: 'clarification_owed', axis: 'scope', state: 'open' }), 4),
    makeRailCandidate(makeRailIssue({ id: 'i-reply', burden: 'reply_owed', axis: 'causal', state: 'open' }), 3),
    makeRailCandidate(makeRailIssue({ id: 'i-syn', burden: 'none', axis: 'value', state: 'synthesis_ready', nextBestMoves: [makeRailMove('synthesize', 'Synthesize')] }), 2),
    makeRailCandidate(makeRailIssue({ id: 'i-narrow', burden: 'none', axis: 'logic', state: 'narrowed' }), 1),
    makeRailCandidate(makeRailIssue({ id: 'i-conc', burden: 'none', axis: 'framing', state: 'conceded' }), 0),
  ];
  return [...buildOpenIssuesLedger(candidates, { maxEntries: 48 }).entries];
}

describe('REF-006-RAIL ban-list — the frozen authored chrome set is clean', () => {
  it.each(Object.entries(OPEN_ISSUES_RAIL_COPY))('OPEN_ISSUES_RAIL_COPY.%s', (_k, value) => {
    assertClean(value);
  });
});

describe('REF-006-RAIL ban-list — every REF-002 label atom the rail composes from is clean', () => {
  const everyAtom = [
    ...Object.values(ISSUE_STATE_LABEL),
    ...Object.values(BURDEN_LABEL),
    ...Object.values(RELATION_LABEL),
    ...Object.values(AXIS_LABEL),
    ...Object.values(ISSUE_STATE_TERMINAL_LINE),
  ];
  it.each(everyAtom)('atom "%s" carries no prohibited token', (atom) => {
    assertClean(atom);
  });
});

describe('REF-006-RAIL ban-list — every emitted ledger-entry string is clean', () => {
  it('stateLabel / openTaskLine / contestedProposition / a11y label / move labels are token-clean', () => {
    const entries = sampleEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const strings = [
        entry.stateLabel,
        entry.openTaskLine,
        entry.contestedProposition,
        entry.accessibilityLabel,
        ...entry.nextBestMoves.flatMap((m) => [m.label, m.accessibilityLabel]),
      ];
      for (const s of strings) assertClean(s);
    }
  });

  it('the active-suffix word and overflow word never read as a verdict', () => {
    assertClean(OPEN_ISSUES_RAIL_COPY.activeSuffix);
    assertClean(OPEN_ISSUES_RAIL_COPY.overflowWord);
  });
});
