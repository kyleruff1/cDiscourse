/**
 * REF-004 — Inspect is the only home for raw keys; the card stays raw-free.
 *
 *   1. `InspectOpenIssueDetail` renders the issue's raw provenance — the raw
 *      `issue.id`, every `refereeObservations[].sourceCode`, every
 *      `userAllegations[].sourceCode` — inside Inspect (the raw home).
 *   2. `RefereeCardView` (with `onRefereeNavigate` wired, so the new
 *      affordance row renders) shows NONE of those raw strings anywhere in
 *      its tree (re-pins REF-003 `refereeCardNoRawCodes` for the REF-004
 *      surface, INCLUDING the affordance row).
 *   3. Ban-list scan: the overlay's plain-language strings + the affordance
 *      copy carry no prohibited verdict / person token, and no `snake_case`
 *      code leaks into a user-facing (non-diagnostic) string. The raw
 *      provenance block (clearly diagnostic, Inspect-only) is the sole place
 *      `snake_case` may appear.
 *
 * `.test.tsx` — RN render harness.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  InspectOpenIssueDetail,
  INSPECT_OPEN_ISSUE_COPY,
} from '../src/features/arguments/cardView/InspectOpenIssueDetail';
import {
  RefereeCardView,
  type RefereeNavVerb,
} from '../src/features/arguments/cardView/RefereeCardView';
import { buildInspectOpenIssueDetail } from '../src/features/arguments/oneBox/inspectContentBuilder';
import { buildOpenIssue, type DisagreementContract } from '../src/features/refereeLoop';
import {
  makeInput,
  makeMark,
  makeDebt,
  makeBanner,
  makeBannerSelection,
  makeClusterSummary,
  makeSuggestionInput,
} from './fixtures/openIssueFixtures';

/** The 16 prohibited verdict / person tokens (same set REF-002/REF-003 use). */
const PROHIBITED_TOKENS: ReadonlyArray<string> = [
  'winner', 'loser', 'correct', 'incorrect', 'truth', 'untrue', 'dishonest',
  'liar', 'manipulative', 'extremist', 'propagandist', 'stupid', 'idiot',
  'verdict', 'bad faith', 'proof of',
];

const SNAKE_CASE = /[a-z0-9]_[a-z0-9]/i;
const noop = (_verb: RefereeNavVerb): void => {};

/** Issue carrying a banner observation sourceCode AND a user allegation
 *  sourceCode, with a non-trivial raw id. */
function rawIssue(): DisagreementContract {
  return buildOpenIssue(
    makeInput({
      selectedActEntryId: 'ask_source',
      openEvidenceDebts: [makeDebt({ debtKind: 'source' })],
      lifecycleState: 'source_requested',
      sourceChainStatus: 'no_source',
      bannerSelection: makeBannerSelection(makeBanner({ bannerCode: 'source_chain_gap' })),
      userAllegations: [
        makeMark({ rawKey: 'disputes_scope', label: 'Scope disputed', source: 'manual_tag' }),
      ],
      suggestionInput: makeSuggestionInput({
        clusterSummary: makeClusterSummary('source_requested'),
        sourceChainStatus: 'no_source',
      }),
    }),
  )!;
}

/** Collect every visible string child + every accessibilityLabel/Hint, skipping
 *  the subtree under `excludeTestId` (the verbatim-quote anchor). */
function collectAllStrings(
  node: unknown,
  excludeTestId: string | null,
  out: string[] = [],
): string[] {
  if (node == null) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectAllStrings(child, excludeTestId, out);
    return out;
  }
  const n = node as { props?: Record<string, unknown>; children?: unknown };
  if (excludeTestId != null && n.props && n.props.testID === excludeTestId) return out;
  if (n.props) {
    for (const key of ['accessibilityLabel', 'accessibilityHint']) {
      const v = n.props[key];
      if (typeof v === 'string' && v.length > 0) out.push(v);
    }
  }
  if (n.children != null) collectAllStrings(n.children, excludeTestId, out);
  return out;
}

describe('REF-004 InspectRawKeys — the overlay renders the raw provenance', () => {
  it('the raw issue.id + every observation/allegation sourceCode appears in the Inspect overlay', () => {
    const issue = rawIssue();
    expect(issue.refereeObservations.length).toBeGreaterThan(0);
    expect(issue.userAllegations.length).toBeGreaterThan(0);

    const joined = collectAllStrings(
      render(<InspectOpenIssueDetail issue={issue} />).toJSON(),
      null,
    ).join('\n');

    expect(joined).toContain(issue.id); // issue:node-1:asks_source:source
    for (const obs of issue.refereeObservations) {
      expect(joined).toContain(obs.sourceCode); // source_chain_gap
    }
    for (const alg of issue.userAllegations) {
      expect(joined).toContain(alg.sourceCode); // disputes_scope
    }
  });

  it('the diagnostic block carries the empty-note when an issue has no raw provenance', () => {
    // A plain teaching issue (no banner, no allegations) → no raw provenance.
    const teaching = buildOpenIssue(makeInput({}))!;
    expect(teaching.refereeObservations.length).toBe(0);
    expect(teaching.userAllegations.length).toBe(0);
    const { getByTestId, queryByTestId } = render(
      <InspectOpenIssueDetail issue={teaching} testID="ov" />,
    );
    expect(getByTestId('ov-raw-empty').props.children).toBe(INSPECT_OPEN_ISSUE_COPY.emptyNote);
    expect(queryByTestId('ov-raw-id')).toBeNull();
  });

  it('renders null when there is no issue', () => {
    // @ts-expect-error — exercising the defensive null guard.
    const out = render(<InspectOpenIssueDetail issue={null} />).toJSON();
    expect(out).toBeNull();
  });
});

describe('REF-004 InspectRawKeys — the card stays raw-free (incl. the affordance row)', () => {
  it('no raw issue.id / observation / allegation sourceCode appears anywhere on the card', () => {
    const issue = rawIssue();
    // The affordance row renders (onRefereeNavigate wired) — the scan covers it.
    const strings = collectAllStrings(
      render(<RefereeCardView issue={issue} onRefereeNavigate={noop} />).toJSON(),
      'referee-card-anchor',
    );
    const joined = strings.join('\n');
    expect(strings.length).toBeGreaterThan(0);

    expect(joined).not.toContain(issue.id);
    for (const obs of issue.refereeObservations) {
      expect(joined).not.toContain(obs.sourceCode);
    }
    for (const alg of issue.userAllegations) {
      expect(joined).not.toContain(alg.sourceCode);
    }
  });

  it('no non-anchor card string carries a snake_case token (the affordance copy is plain)', () => {
    const issue = rawIssue();
    const strings = collectAllStrings(
      render(<RefereeCardView issue={issue} onRefereeNavigate={noop} />).toJSON(),
      'referee-card-anchor',
    );
    for (const s of strings) {
      expect(s).not.toMatch(SNAKE_CASE);
    }
  });
});

describe('REF-004 InspectRawKeys — ban-list + plain-language scan', () => {
  it('the overlay plain-language lines + affordance copy carry no prohibited token', () => {
    const detail = buildInspectOpenIssueDetail(rawIssue());
    const userFacing = [
      detail.relationLine,
      detail.axisLine,
      detail.burdenLine,
      detail.stateLine,
      INSPECT_OPEN_ISSUE_COPY.plainHeader,
      INSPECT_OPEN_ISSUE_COPY.rawHeader,
      INSPECT_OPEN_ISSUE_COPY.emptyNote,
      'View details',
      'Focus on board',
      'View the full detail for this open issue',
      'Focus the board on this open issue',
    ];
    for (const s of userFacing) {
      const lower = s.toLowerCase();
      for (const token of PROHIBITED_TOKENS) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no snake_case leaks into the plain-language block or the affordance copy', () => {
    const detail = buildInspectOpenIssueDetail(rawIssue());
    const nonDiagnostic = [
      detail.relationLine,
      detail.axisLine,
      detail.burdenLine,
      detail.stateLine,
      INSPECT_OPEN_ISSUE_COPY.plainHeader,
      'View details',
      'Focus on board',
      'View the full detail for this open issue',
      'Focus the board on this open issue',
    ];
    for (const s of nonDiagnostic) {
      expect(s).not.toMatch(SNAKE_CASE);
    }
  });

  it('the plain block testIDs carry plain strings; only the raw block carries snake_case', () => {
    const issue = rawIssue();
    const { getByTestId } = render(<InspectOpenIssueDetail issue={issue} testID="ov" />);
    // Plain block — snake_case-free.
    for (const id of ['ov-plain-header', 'ov-relation', 'ov-axis', 'ov-burden', 'ov-state']) {
      expect(String(getByTestId(id).props.children)).not.toMatch(SNAKE_CASE);
    }
    // Raw block — the diagnostic home where snake_case raw codes appear.
    expect(String(getByTestId('ov-raw-id').props.children)).toMatch(/^issue:/);
  });
});
