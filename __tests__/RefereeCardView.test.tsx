/**
 * REF-003 — RefereeCardView: zones, neutral states, late re-derivation,
 * Inspect handoff, the no-second-banner pin, and the post-not-blocked
 * regression.
 *
 * Fixtures build REAL `DisagreementContract`s via the shipped
 * `buildOpenIssue(...)` against real seams (no mocked model), reusing the
 * REF-002 fixture factories.
 *
 * Uses @testing-library/react-native (the repo's RN render harness).
 */

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fireEvent, render } from '@testing-library/react-native';
import { RefereeCardView, REFEREE_CARD_EMPTY_STATE } from '../src/features/arguments/cardView/RefereeCardView';
import { CARD_CLASSIFIER_ADVISORY_CAPTION } from '../src/features/arguments/cardView/cardClassifierStripModel';
import {
  buildOpenIssue,
  buildRefereeCardViewModel,
  ISSUE_STATE_TERMINAL_LINE,
  type DisagreementContract,
} from '../src/features/refereeLoop';
import {
  makeInput,
  makeDebt,
  makeBanner,
  makeBannerSelection,
  makeClusterSummary,
  makeSuggestionInput,
} from './fixtures/openIssueFixtures';

const COMPONENT_PATH = join(
  __dirname,
  '../src/features/arguments/cardView/RefereeCardView.tsx',
);

// ── Issue fixtures (real buildOpenIssue) ─────────────────────────

/** Banner-seeded: zone 1 = banner headline + tone glyph; ≥1 move. */
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

/** No banner, specific relation (challenges) → zone 1 = relation label. */
function noBannerSpecificRelationIssue(): DisagreementContract {
  return buildOpenIssue(makeInput({ selectedChannel: 'challenge', lifecycleState: 'open' }))!;
}

/** No banner + no observation + replies fallback → teaching state. */
function teachingIssue(): DisagreementContract {
  return buildOpenIssue(makeInput({}))!;
}

/** Terminal burden (narrowed, burden=none) → zone 2 = terminal-state line. */
function narrowedTerminalIssue(): DisagreementContract {
  return buildOpenIssue(
    makeInput({
      selectedActEntryId: 'narrow',
      lifecycleState: 'narrowed',
      lifecycleAxis: 'scope',
      suggestionInput: makeSuggestionInput({ clusterSummary: makeClusterSummary('narrowed') }),
    }),
  )!;
}

/** Observer → no constructive Act survivor → zone 3 collapses. */
function observerIssue(): DisagreementContract {
  return buildOpenIssue(makeInput({ viewerRole: 'observer' }))!;
}

/** Own bubble → only view_qualifiers + request_deletion survive → zone 3 collapses. */
function ownBubbleIssue(): DisagreementContract {
  return buildOpenIssue(makeInput({ viewerRole: 'own_bubble' }))!;
}

/** With a verbatim target excerpt → the "point under dispute" anchor renders. */
function anchoredIssue(quote: string): DisagreementContract {
  return buildOpenIssue(makeInput({ targetExcerpt: quote }))!;
}

// ════════════════════════════════════════════════════════════════
describe('RefereeCardView — three zones from the view-model', () => {
  it('banner-seeded zone 1 shows the banner headline + the tone glyph', () => {
    const issue = bannerIssue();
    const vm = buildRefereeCardViewModel(issue);
    const { getByTestId, toJSON } = render(<RefereeCardView issue={issue} />);
    expect(getByTestId('referee-card-zone1').props.children).toBe(vm.zone1RelationLine);
    expect(vm.zone1RelationLine).toBe('This move asks for a source.');
    // The tone glyph is hidden from the accessibility tree (the tone is in the
    // words), so it is queried off the raw render tree, not via a11y queries.
    const glyph = findNodeByTestId(toJSON(), 'referee-card-tone-glyph');
    expect(glyph).not.toBeNull();
    const glyphChar = collectVisibleText(glyph).join('');
    expect(glyphChar.length).toBeGreaterThan(0);
  });

  it('zone 2 renders the open-task line', () => {
    const issue = bannerIssue();
    const vm = buildRefereeCardViewModel(issue);
    const { getByTestId } = render(<RefereeCardView issue={issue} />);
    expect(getByTestId('referee-card-zone2').props.children).toBe(vm.zone2OpenTaskLine);
  });

  it('zone 3 renders 2–3 move buttons matching the view-model', () => {
    const issue = bannerIssue();
    const vm = buildRefereeCardViewModel(issue);
    expect(vm.zone3Moves.length).toBeGreaterThan(0);
    const { getByTestId } = render(<RefereeCardView issue={issue} />);
    for (const move of vm.zone3Moves) {
      expect(getByTestId(`referee-card-move-${move.actEntryId}`)).toBeTruthy();
    }
  });

  it('always renders the imported advisory caption', () => {
    const { getByTestId } = render(<RefereeCardView issue={bannerIssue()} />);
    expect(getByTestId('referee-card-caption').props.children).toBe(
      CARD_CLASSIFIER_ADVISORY_CAPTION,
    );
  });
});

describe('RefereeCardView — zone 1 relation fallback + teaching state', () => {
  it('no-banner specific relation falls back to the relation label', () => {
    const issue = noBannerSpecificRelationIssue();
    const vm = buildRefereeCardViewModel(issue);
    const { getByTestId, queryByText } = render(<RefereeCardView issue={issue} />);
    expect(getByTestId('referee-card-zone1').props.children).toBe(vm.zone1RelationLine);
    expect(vm.zone1RelationLine).toBe('Challenges evidence');
    expect(queryByText(REFEREE_CARD_EMPTY_STATE)).toBeNull();
  });

  it('no banner + no observation + replies fallback shows the teaching state', () => {
    const issue = teachingIssue();
    expect(issue.refereeObservations.length).toBe(0);
    expect(issue.relationToParent).toBe('replies');
    const { getByTestId } = render(<RefereeCardView issue={issue} />);
    expect(getByTestId('referee-card-zone1').props.children).toBe(REFEREE_CARD_EMPTY_STATE);
    // Zones 2 still render their deterministic content.
    expect(getByTestId('referee-card-zone2')).toBeTruthy();
  });

  it('teaching state never renders a tone glyph', () => {
    const { toJSON } = render(<RefereeCardView issue={teachingIssue()} />);
    expect(findNodeByTestId(toJSON(), 'referee-card-tone-glyph')).toBeNull();
  });
});

describe('RefereeCardView — terminal burden', () => {
  it('narrowed (burden none) → zone 2 reads the terminal-state line', () => {
    const issue = narrowedTerminalIssue();
    expect(issue.burden).toBe('none');
    expect(issue.state).toBe('narrowed');
    const { getByTestId } = render(<RefereeCardView issue={issue} />);
    expect(getByTestId('referee-card-zone2').props.children).toBe(
      ISSUE_STATE_TERMINAL_LINE.narrowed,
    );
    expect(getByTestId('referee-card-zone2').props.children).toBe('Narrowed.');
  });
});

describe('RefereeCardView — empty / collapsed zone 3', () => {
  it('observer → zero move buttons; zones 1–2 still render', () => {
    const issue = observerIssue();
    expect(issue.nextBestMoves.length).toBe(0);
    const { queryByTestId, getByTestId } = render(<RefereeCardView issue={issue} />);
    expect(queryByTestId('referee-card-moves')).toBeNull();
    expect(getByTestId('referee-card-zone1')).toBeTruthy();
    expect(getByTestId('referee-card-zone2')).toBeTruthy();
  });

  it('own bubble → zero move buttons (no edit/disagree/flag/score on your own move)', () => {
    const issue = ownBubbleIssue();
    expect(issue.nextBestMoves.length).toBe(0);
    const { queryByTestId } = render(<RefereeCardView issue={issue} />);
    expect(queryByTestId('referee-card-moves')).toBeNull();
  });

  it('the card never fabricates a button when there are no survivors', () => {
    const { queryAllByTestId } = render(<RefereeCardView issue={observerIssue()} />);
    expect(queryAllByTestId(/^referee-card-move-/)).toHaveLength(0);
  });
});

describe('RefereeCardView — point-under-dispute anchor', () => {
  it('renders the quoted anchor when issue.targetQuote != null', () => {
    const issue = anchoredIssue('Cars cause more harm than good in cities.');
    expect(issue.targetQuote).toBe('Cars cause more harm than good in cities.');
    const { getByTestId } = render(<RefereeCardView issue={issue} />);
    expect(getByTestId('referee-card-anchor').props.children).toBe(
      'Point under dispute: "Cars cause more harm than good in cities."',
    );
  });

  it('omits the anchor when targetQuote is null', () => {
    const issue = teachingIssue();
    expect(issue.targetQuote).toBeNull();
    const { queryByTestId } = render(<RefereeCardView issue={issue} />);
    expect(queryByTestId('referee-card-anchor')).toBeNull();
  });
});

describe('RefereeCardView — late-arriving observation re-derivation', () => {
  it('re-render with a banner flips zone 1 from the teaching state to the observation line', () => {
    const { getByTestId, rerender } = render(<RefereeCardView issue={teachingIssue()} />);
    expect(getByTestId('referee-card-zone1').props.children).toBe(REFEREE_CARD_EMPTY_STATE);
    // A classifier banner lands; the surface re-derives the issue and re-renders.
    rerender(<RefereeCardView issue={bannerIssue()} />);
    expect(getByTestId('referee-card-zone1').props.children).toBe('This move asks for a source.');
  });
});

describe('RefereeCardView — move button press', () => {
  it('calls onMove with the correct MoveSuggestion (carrying actEntryId)', () => {
    const issue = bannerIssue();
    const first = issue.nextBestMoves[0];
    const onMove = jest.fn();
    const { getByTestId } = render(<RefereeCardView issue={issue} onMove={onMove} />);
    fireEvent.press(getByTestId(`referee-card-move-${first.actEntryId}`));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(first);
    expect(onMove.mock.calls[0][0].actEntryId).toBe(first.actEntryId);
  });

  it('pressing a move with no onMove handler does not throw', () => {
    const issue = bannerIssue();
    const first = issue.nextBestMoves[0];
    const { getByTestId } = render(<RefereeCardView issue={issue} />);
    expect(() => fireEvent.press(getByTestId(`referee-card-move-${first.actEntryId}`))).not.toThrow();
  });
});

describe('RefereeCardView — no-second-banner pin', () => {
  it('renders NO testID="referee-banner-view" anywhere in the tree', () => {
    const { queryByTestId } = render(<RefereeCardView issue={bannerIssue()} />);
    expect(queryByTestId('referee-banner-view')).toBeNull();
  });

  it('imports the glyph-char map only, never the RefereeBannerView component, and never renders it', () => {
    const src = readFileSync(COMPONENT_PATH, 'utf8');
    // The glyph-char map IS imported (zone 1 renders the banner meaning).
    expect(src).toMatch(/import\s*\{[^}]*\bBANNER_TONE_GLYPH_CHAR\b[^}]*\}/);
    // The RefereeBannerView COMPONENT is never imported as a binding (the path
    // string contains the substring, but no import binding does).
    expect(src).not.toMatch(/import\s*\{[^}]*\bRefereeBannerView\b[^}]*\}/);
    // ...and is never rendered.
    expect(src).not.toMatch(/<RefereeBannerView[\s/>]/);
    // ...and selectBanner is never CALLED (the word may appear in a doctrine
    // comment, but there is no call expression).
    expect(src).not.toMatch(/selectBanner\s*\(/);
  });
});

describe('RefereeCardView — Inspect handoff (no raw codes on the surface)', () => {
  it('renders no issue.id, mark sourceCode, or actEntryId string in the visible tree', () => {
    const issue = bannerIssue();
    const text = collectVisibleText(render(<RefereeCardView issue={issue} />).toJSON());
    const joined = text.join('\n');
    expect(joined).not.toContain(issue.id); // issue:node-1:asks_source:source
    for (const obs of issue.refereeObservations) {
      expect(joined).not.toContain(obs.sourceCode); // banner bannerCode
    }
    for (const move of issue.nextBestMoves) {
      expect(joined).not.toContain(move.actEntryId); // e.g. ask_source
      if (move.recoveredFromCode) expect(joined).not.toContain(move.recoveredFromCode);
    }
  });
});

describe('RefereeCardView — post-not-blocked regression', () => {
  it('the component has no submit / Edge / Supabase dependency in its source', () => {
    const src = readFileSync(COMPONENT_PATH, 'utf8');
    expect(src).not.toMatch(/submit-argument/);
    expect(src).not.toMatch(/submitArgument/);
    expect(src).not.toMatch(/supabase/i);
    expect(src).not.toMatch(/edgeFunction/i);
    expect(src).not.toMatch(/fetch\(/);
  });

  it('mounting then unmounting invokes no callback (the card is never in a submit closure)', () => {
    const onMove = jest.fn();
    const { unmount } = render(<RefereeCardView issue={bannerIssue()} onMove={onMove} />);
    unmount();
    expect(onMove).not.toHaveBeenCalled();
  });
});

// ── Helpers ──────────────────────────────────────────────────────

/** Recursively collect every visible string child from a react-test-renderer
 *  JSON tree. */
function collectVisibleText(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectVisibleText(child, out);
    return out;
  }
  const n = node as { children?: unknown };
  if (n.children != null) collectVisibleText(n.children, out);
  return out;
}

/** Find the first node in a react-test-renderer JSON tree carrying a given
 *  testID — including accessibility-hidden nodes (which a11y queries skip). */
function findNodeByTestId(node: unknown, testID: string): { props?: Record<string, unknown>; children?: unknown } | null {
  if (node == null || typeof node === 'string') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNodeByTestId(child, testID);
      if (found) return found;
    }
    return null;
  }
  const n = node as { props?: Record<string, unknown>; children?: unknown };
  if (n.props && n.props.testID === testID) return n;
  if (n.children != null) return findNodeByTestId(n.children, testID);
  return null;
}
