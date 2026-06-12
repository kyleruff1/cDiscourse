/**
 * REF-003 — RefereeCardView accessibility.
 *
 * Per `accessibility-targets`:
 *   - Each zone-3 move is a Pressable with role=button, a populated
 *     accessibilityLabel (the Act-entry verbose label, no key badge), an
 *     accessibilityState, and a ≥44×44 target (minHeight + hitSlop tokens).
 *   - The note block exposes ONE complete accessibilityLabel; the tone glyph
 *     is hidden from the accessibility tree (the tone is in the words).
 *   - Color-independence: the tone glyph is a non-empty geometric mark; meaning
 *     is carried by shape + text.
 *   - Reduce-motion: nothing animates; `reduceMotionOverride` changes nothing.
 *   - Focus / reading order: anchor → note → move buttons (source order).
 */

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { RefereeCardView } from '../src/features/arguments/cardView/RefereeCardView';
import { TOUCH_TARGET } from '../src/lib/designTokens';
import { BANNER_TONE_GLYPH_CHAR } from '../src/features/refereeBanners/RefereeBannerView';
import {
  buildOpenIssue,
  buildRefereeCardViewModel,
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

/** Banner-seeded + anchored + ≥1 move → exercises every a11y element. */
function richIssue(): DisagreementContract {
  return buildOpenIssue(
    makeInput({
      targetExcerpt: 'Cars cause more harm than good in cities.',
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

/** Document-order list of every testID in the tree (depth-first). */
function testIdOrder(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === 'string') return out;
  if (Array.isArray(node)) {
    for (const child of node) testIdOrder(child, out);
    return out;
  }
  const n = node as { props?: Record<string, unknown>; children?: unknown };
  if (n.props && typeof n.props.testID === 'string') out.push(n.props.testID);
  if (n.children != null) testIdOrder(n.children, out);
  return out;
}

describe('REF-003 a11y — zone-3 move buttons', () => {
  it('each move is a button with role, populated label (no key badge), state, and a ≥44×44 target', () => {
    const issue = richIssue();
    expect(issue.nextBestMoves.length).toBeGreaterThan(0);
    const { getByTestId } = render(<RefereeCardView issue={issue} />);
    for (const move of issue.nextBestMoves) {
      const btn = getByTestId(`referee-card-move-${move.actEntryId}`);
      expect(btn.props.accessibilityRole).toBe('button');
      expect(typeof btn.props.accessibilityLabel).toBe('string');
      expect((btn.props.accessibilityLabel as string).length).toBeGreaterThan(0);
      expect(btn.props.accessibilityLabel).toBe(move.accessibilityLabel);
      // The a11y label is the verbose action name — never a single-letter key
      // badge like "[A]".
      expect(btn.props.accessibilityLabel).not.toMatch(/\[[A-Za-z]\]/);
      expect(btn.props.accessibilityState).toEqual({ disabled: false });
      // ≥44×44: hitSlop token + minHeight token.
      expect(btn.props.hitSlop).toEqual(TOUCH_TARGET.hitSlopAll);
      const flat = StyleSheet.flatten(btn.props.style);
      expect(flat.minHeight).toBe(TOUCH_TARGET.minSizePx);
      expect(TOUCH_TARGET.minSizePx).toBe(44);
    }
  });
});

describe('REF-003 a11y — note block + tone glyph', () => {
  it('the note block exposes ONE complete accessibilityLabel (the full sentence)', () => {
    const issue = richIssue();
    const vm = buildRefereeCardViewModel(issue);
    const { getByTestId } = render(<RefereeCardView issue={issue} />);
    const note = getByTestId('referee-card-note-block');
    expect(note.props.accessibilityRole).toBe('text');
    expect(note.props.accessibilityLabel).toBe(vm.accessibilityLabel);
    expect((note.props.accessibilityLabel as string).length).toBeGreaterThan(0);
  });

  it('the tone glyph is hidden from the accessibility tree', () => {
    const { toJSON } = render(<RefereeCardView issue={richIssue()} />);
    const glyph = findNodeByTestId(toJSON(), 'referee-card-tone-glyph');
    expect(glyph).not.toBeNull();
    expect(glyph!.props!.accessibilityElementsHidden).toBe(true);
    expect(glyph!.props!.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('REF-003 a11y — color independence (shape + text carry meaning)', () => {
  it('the tone glyph is a non-empty geometric mark from the glyph-char map', () => {
    const issue = richIssue();
    const vm = buildRefereeCardViewModel(issue);
    expect(vm.zone1ToneGlyph).not.toBeNull();
    const { toJSON } = render(<RefereeCardView issue={issue} />);
    const glyph = findNodeByTestId(toJSON(), 'referee-card-tone-glyph');
    const glyphChar = (glyph!.children as string[]).join('');
    expect(glyphChar.length).toBeGreaterThan(0);
    expect(Object.values(BANNER_TONE_GLYPH_CHAR)).toContain(glyphChar);
  });

  it('the state is also carried in words (zone 1 + zone 2 text), not color alone', () => {
    const { getByTestId } = render(<RefereeCardView issue={richIssue()} />);
    expect((getByTestId('referee-card-zone1').props.children as string).length).toBeGreaterThan(0);
    expect((getByTestId('referee-card-zone2').props.children as string).length).toBeGreaterThan(0);
  });
});

describe('REF-003 a11y — reduce motion', () => {
  it('the component never imports or uses Animated (the card is fully static)', () => {
    const src = readFileSync(COMPONENT_PATH, 'utf8');
    // No Animated import binding and no `Animated.` member access (the word may
    // appear in a doctrine comment, but there is no import / usage).
    expect(src).not.toMatch(/import\s*\{[^}]*\bAnimated\b[^}]*\}/);
    expect(src).not.toMatch(/\bAnimated\./);
    expect(src).not.toMatch(/useNativeDriver/);
  });

  it('reduceMotionOverride changes no rendered output (it is a no-op)', () => {
    const issue = richIssue();
    const off = render(<RefereeCardView issue={issue} reduceMotionOverride={false} />).toJSON();
    const on = render(<RefereeCardView issue={issue} reduceMotionOverride />).toJSON();
    expect(JSON.stringify(on)).toBe(JSON.stringify(off));
  });
});

describe('REF-003 a11y — focus / reading order', () => {
  it('the reading order is anchor → note block → move buttons', () => {
    const issue = richIssue();
    const order = testIdOrder(render(<RefereeCardView issue={issue} />).toJSON());
    const anchorIdx = order.indexOf('referee-card-anchor');
    const noteIdx = order.indexOf('referee-card-note-block');
    const movesIdx = order.indexOf('referee-card-moves');
    expect(anchorIdx).toBeGreaterThanOrEqual(0);
    expect(noteIdx).toBeGreaterThan(anchorIdx);
    expect(movesIdx).toBeGreaterThan(noteIdx);
  });
});
