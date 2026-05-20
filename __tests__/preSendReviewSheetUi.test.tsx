/**
 * RULE-004 — PreSendReviewSheet UI contract.
 *
 * Follows the repo's established `.test.tsx` discipline (see
 * ChannelChipRow.test.tsx / AdminCreateUserForm.test.tsx): the sheet's
 * load-bearing decisions — "Post anyway" visibility, the strict-mode
 * gating branch, transformation labels, accessibility labels, the hit
 * target — are extracted into pure helpers and exercised here without an
 * RN renderer, plus a static source scan that proves the component wires
 * those helpers to the right JSX (roles, hit slop, testIDs, reduce-motion
 * snap, color-independent section markers).
 *
 * .tsx extension matches the sibling ChannelChipRow.test.tsx convention.
 */
import fs from 'fs';
import path from 'path';
import {
  PRESEND_HIT_SLOP,
  PRESEND_MIN_TARGET,
  actionableTransformations,
  buildAdvisoryAccessibilityLabel,
  isPostAnywayEnabled,
  isPostAnywayVisible,
  isSaveDraftVisible,
  transformationButtonLabel,
} from '../src/features/arguments/PreSendReviewSheet';
import {
  ALL_ADVISORY_KINDS,
  type AdvisoryKind,
  type PreSendAdvisory,
  type PreSendReview,
} from '../src/features/arguments/preSendReviewModel';

const SHEET_SRC = fs.readFileSync(
  path.join(
    process.cwd(),
    'src',
    'features',
    'arguments',
    'PreSendReviewSheet.tsx',
  ),
  'utf8',
);

function advisory(kind: AdvisoryKind, severity: 'info' | 'soft'): PreSendAdvisory {
  return {
    kind,
    severity,
    suggested: ['narrow', 'post_anyway'],
    plainLanguage: 'A plain-language advisory line.',
  };
}

function review(overrides: Partial<PreSendReview> = {}): PreSendReview {
  return {
    advisories: [],
    structuralBlocks: [],
    hasStructuralBlock: false,
    shouldShowSheet: true,
    ...overrides,
  };
}

// ── 1. "Post anyway" visibility ────────────────────────────────

describe('PreSendReviewSheet — Post anyway visibility', () => {
  it('is visible when there is no structural block', () => {
    expect(isPostAnywayVisible(review({ hasStructuralBlock: false }))).toBe(true);
  });

  it('is hidden when a structural block is present', () => {
    expect(
      isPostAnywayVisible(
        review({
          hasStructuralBlock: true,
          structuralBlocks: [
            { kind: 'invalid_transition', plainLanguage: 'blocked' },
          ],
        }),
      ),
    ).toBe(false);
  });
});

// ── 2. "Save draft" is always visible ──────────────────────────

describe('PreSendReviewSheet — Save draft visibility', () => {
  it('is always visible regardless of block state', () => {
    expect(isSaveDraftVisible()).toBe(true);
  });
});

// ── 3. Strict-mode gating (dead-but-tested in v1) ──────────────

describe('PreSendReviewSheet — strict-mode gating', () => {
  it('casual mode never gates Post anyway on advisory dismissal', () => {
    const r = review({ advisories: [advisory('broad_claim', 'soft')] });
    expect(isPostAnywayEnabled(r, 'casual', new Set())).toBe(true);
  });

  it('strict mode disables Post anyway until every soft advisory is dismissed', () => {
    const r = review({ advisories: [advisory('broad_claim', 'soft')] });
    expect(isPostAnywayEnabled(r, 'strict', new Set())).toBe(false);
    expect(
      isPostAnywayEnabled(r, 'strict', new Set<AdvisoryKind>(['broad_claim'])),
    ).toBe(true);
  });

  it('strict mode ignores info advisories — they need no dismissal', () => {
    const r = review({ advisories: [advisory('depth_warning', 'info')] });
    expect(isPostAnywayEnabled(r, 'strict', new Set())).toBe(true);
  });

  it('a structural block disables Post anyway in either mode', () => {
    const r = review({ hasStructuralBlock: true });
    expect(isPostAnywayEnabled(r, 'casual', new Set())).toBe(false);
    expect(isPostAnywayEnabled(r, 'strict', new Set())).toBe(false);
  });
});

// ── 4. Transformation labels ───────────────────────────────────

describe('PreSendReviewSheet — transformation labels', () => {
  it('every transformation maps to a non-empty plain-language label', () => {
    const all = [
      'narrow',
      'branch_tangent',
      'ask_source',
      'add_quote',
      'add_evidence',
      'save_draft',
      'post_anyway',
    ] as const;
    for (const t of all) {
      const label = transformationButtonLabel(t);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/_/); // no snake_case leak
    }
  });

  it('actionableTransformations never includes post_anyway', () => {
    for (const kind of ALL_ADVISORY_KINDS) {
      const actionable = actionableTransformations(kind);
      expect(actionable).not.toContain('post_anyway');
      expect(actionable.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── 5. Accessibility labels ────────────────────────────────────

describe('PreSendReviewSheet — accessibility', () => {
  it('builds a verbose advisory accessibility label with the spoken severity', () => {
    const softLabel = buildAdvisoryAccessibilityLabel(
      advisory('broad_claim', 'soft'),
    );
    const infoLabel = buildAdvisoryAccessibilityLabel(
      advisory('depth_warning', 'info'),
    );
    // Severity is spoken as a WORD — color is not the only signal.
    expect(softLabel).toContain('Worth a look');
    expect(infoLabel).toContain('Heads up');
    expect(softLabel).toContain('A plain-language advisory line.');
  });

  it('the hit slop yields a >= 44x44 effective tap target', () => {
    // PRESEND_MIN_TARGET visual + the hit slop comfortably clears 44.
    expect(PRESEND_MIN_TARGET).toBeGreaterThanOrEqual(44);
    const effectiveWidth =
      0 + PRESEND_HIT_SLOP.left + PRESEND_HIT_SLOP.right + PRESEND_MIN_TARGET;
    const effectiveHeight =
      0 + PRESEND_HIT_SLOP.top + PRESEND_HIT_SLOP.bottom + PRESEND_MIN_TARGET;
    expect(effectiveWidth).toBeGreaterThanOrEqual(44);
    expect(effectiveHeight).toBeGreaterThanOrEqual(44);
  });
});

// ── 6. Source scan — component wiring ──────────────────────────

describe('PreSendReviewSheet.tsx — component wiring (source scan)', () => {
  it('every Pressable declares accessibilityRole="button"', () => {
    const pressables = SHEET_SRC.split('<Pressable').slice(1);
    // The scrim Pressable is intentionally accessibility-hidden; every
    // other Pressable must be a labelled button.
    let buttonCount = 0;
    for (const block of pressables) {
      const head = block.slice(0, 600);
      if (head.includes('accessibilityElementsHidden')) continue;
      expect(head).toMatch(/accessibilityRole="button"/);
      expect(head).toMatch(/accessibilityLabel=/);
      buttonCount += 1;
    }
    expect(buttonCount).toBeGreaterThanOrEqual(4);
  });

  it('every interactive Pressable threads the hit slop', () => {
    const pressables = SHEET_SRC.split('<Pressable').slice(1);
    for (const block of pressables) {
      const head = block.slice(0, 600);
      if (head.includes('accessibilityElementsHidden')) continue;
      expect(head).toMatch(/hitSlop=\{PRESEND_HIT_SLOP\}/);
    }
  });

  it('hides "Post anyway" behind isPostAnywayVisible', () => {
    expect(SHEET_SRC).toMatch(/postAnywayVisible \? \(/);
    expect(SHEET_SRC).toMatch(/isPostAnywayVisible\(review\)/);
  });

  it('renders structural-block and advisory sections with distinct headings + glyphs', () => {
    // Color-independent: a heading word + a leading glyph carry meaning.
    expect(SHEET_SRC).toMatch(/blocksHeading/);
    expect(SHEET_SRC).toMatch(/advisoriesHeading/);
    expect(SHEET_SRC).toContain("blockGlyph");
    expect(SHEET_SRC).toContain("advisoryGlyph");
  });

  it('does not import Animated — the sheet snaps (reduce-motion safe)', () => {
    // RULE-004 §7 #12: the sheet appearance must snap. The simplest
    // honoured form is no enter animation at all.
    expect(SHEET_SRC).not.toMatch(/\bAnimated\b/);
  });

  it('accepts reduceMotionOverride as a prop (threaded by the dock)', () => {
    expect(SHEET_SRC).toMatch(/reduceMotionOverride\?: boolean/);
  });

  it('sets accessibilityViewIsModal so the sheet traps focus over the composer', () => {
    expect(SHEET_SRC).toMatch(/accessibilityViewIsModal/);
  });

  it('the scrim is inert — onPress is a no-op (a stray tap does not close)', () => {
    expect(SHEET_SRC).toMatch(/onPress=\{\(\) => undefined\}/);
  });

  it('imports the model — it does not re-implement advisory logic', () => {
    expect(SHEET_SRC).toMatch(/from '\.\/preSendReviewModel'/);
  });

  it('contains no console.log', () => {
    expect(SHEET_SRC).not.toMatch(/console\.log/);
  });
});

// ── 7. Dock wiring source scan (no AI, no service-role) ────────

describe('ArgumentComposerDock.tsx — RULE-004 wiring (source scan)', () => {
  const DOCK_SRC = fs.readFileSync(
    path.join(
      process.cwd(),
      'src',
      'features',
      'arguments',
      'ArgumentComposerDock.tsx',
    ),
    'utf8',
  );

  it('builds the review with buildPreSendReview and renders the sheet', () => {
    expect(DOCK_SRC).toMatch(/buildPreSendReview\(/);
    expect(DOCK_SRC).toMatch(/<PreSendReviewSheet/);
  });

  it('always passes mode "casual" to the model and the sheet (v1 — OD-1)', () => {
    expect(DOCK_SRC).toMatch(/mode: 'casual'/);
    expect(DOCK_SRC).toMatch(/mode="casual"/);
  });

  it('passes RULE-005 channelSuggestion into buildPreSendReview (channel_mismatch absorbed)', () => {
    expect(DOCK_SRC).toMatch(/channelSuggestion,/);
  });

  it('threads onBeforeSubmit + postSignal into ArgumentComposer', () => {
    expect(DOCK_SRC).toMatch(/onBeforeSubmit=\{handleBeforeSubmit\}/);
    expect(DOCK_SRC).toMatch(/postSignal=\{postSignal\}/);
  });

  it('makes no AI / network call and no service-role reference', () => {
    expect(DOCK_SRC).not.toMatch(/anthropic/i);
    expect(DOCK_SRC).not.toMatch(/SERVICE_ROLE/);
    expect(DOCK_SRC).not.toMatch(/fetch\(/);
  });
});
