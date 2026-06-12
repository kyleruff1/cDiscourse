/**
 * REF-003 — RefereeCardView ban-list scan.
 *
 * Scans EVERY rendered string the card emits — the anchor, zone 1 (incl. the
 * teaching state), zone 2, every zone-3 move label + accessibility label, the
 * advisory caption, and `vm.accessibilityLabel` — across a spread of fixtures
 * (banner / narrowed-terminal / observer / own-bubble / teaching / anchored /
 * challenges / concede / synthesis) for the 16 prohibited verdict / person
 * tokens (the SAME set REF-002's `openIssueModel.banlist` uses).
 *
 * The advisory caption legitimately AFFIRMS the doctrine with the sanctioned
 * negation "advisory, not a verdict." — so the scan strips that exact
 * sanctioned phrase before checking for the `verdict` token (mirroring the
 * established `cardClassifierProvenance` frame-vs-span pattern), and a separate
 * drift guard pins the caption to the imported constant.
 *
 * `.test.ts` (no JSX) — components are mounted via `React.createElement`.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  RefereeCardView,
  REFEREE_CARD_EMPTY_STATE,
} from '../src/features/arguments/cardView/RefereeCardView';
import { CARD_CLASSIFIER_ADVISORY_CAPTION } from '../src/features/arguments/cardView/cardClassifierStripModel';
import { buildOpenIssue, type DisagreementContract } from '../src/features/refereeLoop';
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

/** The sanctioned doctrine negation in the advisory caption. Stripped before
 *  the token scan — it AFFIRMS "not a verdict", the opposite of a verdict. */
const SANCTIONED_NEGATIONS: ReadonlyArray<string> = ['not a verdict'];

function stripSanctioned(s: string): string {
  let out = s.toLowerCase();
  for (const phrase of SANCTIONED_NEGATIONS) out = out.split(phrase).join('');
  return out;
}

function assertClean(label: string): void {
  const scanned = stripSanctioned(label);
  for (const token of PROHIBITED_TOKENS) {
    expect(scanned).not.toContain(token);
  }
}

/** Collect every rendered string — string children AND every accessibility
 *  label prop value — from a react-test-renderer JSON tree. */
function collectAllStrings(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectAllStrings(child, out);
    return out;
  }
  const n = node as { props?: Record<string, unknown>; children?: unknown };
  if (n.props) {
    const a11y = n.props.accessibilityLabel;
    if (typeof a11y === 'string' && a11y.length > 0) out.push(a11y);
  }
  if (n.children != null) collectAllStrings(n.children, out);
  return out;
}

/** A spread of issues exercising every burden / state / relation / banner /
 *  role / anchor path the card can render. */
function sampleIssues(): DisagreementContract[] {
  return [
    // banner-seeded + ask-source debt
    buildOpenIssue(
      makeInput({
        selectedActEntryId: 'ask_source',
        openEvidenceDebts: [makeDebt({ debtKind: 'source' })],
        lifecycleState: 'source_requested',
        sourceChainStatus: 'no_source',
        bannerSelection: makeBannerSelection(makeBanner()),
        suggestionInput: makeSuggestionInput({
          clusterSummary: makeClusterSummary('source_requested'),
          sourceChainStatus: 'no_source',
        }),
      }),
    )!,
    // narrowed terminal
    buildOpenIssue(
      makeInput({
        selectedActEntryId: 'narrow',
        lifecycleState: 'narrowed',
        lifecycleAxis: 'scope',
        suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('narrowed') }),
      }),
    )!,
    // observer (zone 3 collapses)
    buildOpenIssue(makeInput({ viewerRole: 'observer' }))!,
    // own bubble (zone 3 collapses)
    buildOpenIssue(makeInput({ viewerRole: 'own_bubble' }))!,
    // teaching state (no banner, no obs, replies fallback)
    buildOpenIssue(makeInput({}))!,
    // anchored verbatim excerpt
    buildOpenIssue(makeInput({ targetExcerpt: 'Cars cause more harm than good in cities.' }))!,
    // challenges relation
    buildOpenIssue(makeInput({ selectedChannel: 'challenge', lifecycleState: 'open' }))!,
    // concede relation
    buildOpenIssue(makeInput({ selectedActEntryId: 'concede', lifecycleState: 'conceded' }))!,
    // synthesis-ready
    buildOpenIssue(
      makeInput({
        lifecycleState: 'synthesis_ready',
        suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('synthesis_ready') }),
      }),
    )!,
  ];
}

describe('REF-003 ban-list — every rendered string carries no prohibited token', () => {
  const issues = sampleIssues();
  it.each(issues.map((issue, i) => [i, issue] as const))(
    'fixture %i: anchor / zones / move labels / a11y labels / caption are token-clean',
    (_i, issue) => {
      const strings = collectAllStrings(render(React.createElement(RefereeCardView, { issue })).toJSON());
      expect(strings.length).toBeGreaterThan(0);
      for (const s of strings) assertClean(s);
    },
  );
});

describe('REF-003 ban-list — locked copy constants are clean + drift-guarded', () => {
  it('REFEREE_CARD_EMPTY_STATE is ban-list clean', () => {
    assertClean(REFEREE_CARD_EMPTY_STATE);
    expect(REFEREE_CARD_EMPTY_STATE).toBe('No referee notes yet on this move.');
  });

  it('the advisory caption is the IMPORTED constant (drift guard) and clean after the sanctioned negation', () => {
    // The card renders the imported constant verbatim — proven by the rendered
    // caption equalling the imported module constant.
    const strings = collectAllStrings(
      render(React.createElement(RefereeCardView, { issue: sampleIssues()[0] })).toJSON(),
    );
    expect(strings).toContain(CARD_CLASSIFIER_ADVISORY_CAPTION);
    // The caption's only prohibited token is the sanctioned "not a verdict".
    assertClean(CARD_CLASSIFIER_ADVISORY_CAPTION);
    // Pin the exact sanctioned phrasing so a future drift toward a real verdict
    // is caught.
    expect(CARD_CLASSIFIER_ADVISORY_CAPTION).toBe(
      'What the referee noticed — advisory, not a verdict.',
    );
  });
});
