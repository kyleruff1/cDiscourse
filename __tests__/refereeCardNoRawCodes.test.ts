/**
 * REF-003 — RefereeCardView no-raw-codes scan.
 *
 * The card renders ONLY plain-language view-model strings. Raw internal codes
 * — `snake_case` tokens, family IDs, mark `rawKey`s, the `issue.id`,
 * `nextBestMoves[].actEntryId`, `recoveredFromCode`, numeric confidence — must
 * NEVER reach the visible surface (those stay in Inspect — QOL-032). A
 * Family-J mark in `machineObservations` is gated at the MODEL and never
 * reaches the card. A verbatim `targetQuote` containing underscores is user
 * content rendered as-is and is excluded from the internal-code scan.
 *
 * `.test.ts` (no JSX) — components are mounted via `React.createElement`.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { RefereeCardView } from '../src/features/arguments/cardView/RefereeCardView';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
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

const ANCHOR_TEST_ID = 'referee-card-anchor';

/** Banner-seeded fixture — carries a non-trivial `id`, a banner `sourceCode`,
 *  and ≥1 move `actEntryId` on the contract object. */
function bannerIssue(): DisagreementContract {
  return buildOpenIssue(
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
  )!;
}

/** Collect visible string children, SKIPPING any subtree under `excludeTestId`
 *  (the anchor renders verbatim user content, excluded from the code scan). */
function collectVisibleText(node: unknown, excludeTestId: string | null, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectVisibleText(child, excludeTestId, out);
    return out;
  }
  const n = node as { props?: Record<string, unknown>; children?: unknown };
  if (excludeTestId != null && n.props && n.props.testID === excludeTestId) return out;
  if (n.children != null) collectVisibleText(n.children, excludeTestId, out);
  return out;
}

describe('REF-003 no-raw-codes — no internal code in the visible tree', () => {
  it('no rendered (non-anchor) string looks like an internal code or carries snake_case', () => {
    const text = collectVisibleText(render(React.createElement(RefereeCardView, { issue: bannerIssue() })).toJSON(), ANCHOR_TEST_ID);
    expect(text.length).toBeGreaterThan(0);
    for (const s of text) {
      expect(looksLikeInternalCode(s)).toBe(false);
      // No embedded snake_case token (family id / rawKey shape).
      expect(s).not.toMatch(/[a-z0-9]_[a-z0-9]/i);
      // No numeric confidence on the surface.
      expect(s).not.toMatch(/\bconfidence\b/i);
    }
  });

  it('the issue.id, every actEntryId, and every recoveredFromCode are absent from the visible tree', () => {
    const issue = bannerIssue();
    const joined = collectVisibleText(render(React.createElement(RefereeCardView, { issue })).toJSON(), ANCHOR_TEST_ID).join('\n');
    // present on the contract object…
    expect(issue.id).toMatch(/^issue:/);
    expect(issue.nextBestMoves.length).toBeGreaterThan(0);
    // …never rendered.
    expect(joined).not.toContain(issue.id);
    for (const move of issue.nextBestMoves) {
      expect(joined).not.toContain(move.actEntryId);
      if (move.recoveredFromCode) expect(joined).not.toContain(move.recoveredFromCode);
    }
  });

  it('every refereeObservation sourceCode (banner bannerCode / mark rawKey) is absent from the visible tree', () => {
    const issue = bannerIssue();
    expect(issue.refereeObservations.length).toBeGreaterThan(0);
    const joined = collectVisibleText(render(React.createElement(RefereeCardView, { issue })).toJSON(), ANCHOR_TEST_ID).join('\n');
    for (const obs of issue.refereeObservations) {
      expect(joined).not.toContain(obs.sourceCode);
    }
  });
});

describe('REF-003 no-raw-codes — Family-J mark gated at the model, never on the card', () => {
  it('a Family-J machine-observation mark never reaches the rendered tree (the model gated it)', () => {
    const jRawKey = 'shifts_to_person_or_intent';
    const issue = buildOpenIssue(
      makeInput({
        // No banner → the mark path is taken; the model drops the J mark.
        machineObservations: [makeMark({ rawKey: jRawKey, source: 'semantic_referee' })],
      }),
    )!;
    // The model gated it out of the public observations.
    expect(issue.refereeObservations.some((o) => o.sourceCode === jRawKey)).toBe(false);
    const joined = collectVisibleText(render(React.createElement(RefereeCardView, { issue })).toJSON(), ANCHOR_TEST_ID).join('\n');
    expect(joined).not.toContain(jRawKey);
  });
});

describe('REF-003 no-raw-codes — verbatim underscore target quote is user content', () => {
  it('a targetQuote containing underscores renders verbatim and is NOT flagged by the code scan', () => {
    const userText = 'I think snake_case_naming is fine in code';
    const issue = buildOpenIssue(makeInput({ targetExcerpt: userText }))!;
    const json = render(React.createElement(RefereeCardView, { issue })).toJSON();
    // The anchor renders the verbatim user content (underscores preserved).
    const anchorText = collectVisibleText(json, null)
      .find((s) => s.includes(userText));
    expect(anchorText).toBe(`Point under dispute: "${userText}"`);
    // The internal-code scan EXCLUDES the anchor, so the underscores in user
    // text never trip the scan.
    const nonAnchor = collectVisibleText(json, ANCHOR_TEST_ID);
    for (const s of nonAnchor) {
      expect(s).not.toMatch(/[a-z0-9]_[a-z0-9]/i);
    }
    expect(nonAnchor.join('\n')).not.toContain(userText);
  });
});
