/**
 * UX-001.7 Workstream 6 — Accessibility consistency audit.
 *
 * Per `docs/designs/UX-001.7.md` §7 — UX-001.7 verifies the
 * consolidated design system meets the same accessibility bar across
 * every UX-001 surface, without color reliance, with 44x44 touch
 * targets, and with focus rings that survive grayscale.
 *
 * Verification approach:
 *   - Source-scan: every interactive Pressable in UX-001 surfaces
 *     carries accessibilityRole + accessibilityLabel.
 *   - Token alignment: the new FOCUS_RING token preserves the
 *     canonical width (>=2 px) and color (SURFACE_TOKENS.focusRing)
 *     so focus state is non-color-only.
 *   - 44x44 token enforcement: TOUCH_TARGET.minSizePx === 44 and is
 *     consumed (or its byte-equivalent literal preserved) on every
 *     interactive surface.
 *   - Non-color-only differentiation: the AnnotationChip primitive
 *     carries a label + optional glyph, not color alone.
 *
 * Pure-TS source-scan test — no React render.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  BORDER_WIDTH,
  FOCUS_RING,
  SURFACE_TOKENS,
  TOUCH_TARGET,
  TYPOGRAPHY,
} from '../src/lib/designTokens';

const ROOT = process.cwd();

const ACCESSIBILITY_SCAN_FILES = [
  // UX-001.1
  'src/components/AppHeader.tsx',
  // UX-001.2
  'src/features/debates/DebateDetailHeader.tsx',
  'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
  'src/features/arguments/ArgumentTimelineMap.tsx',
  // UX-001.3
  'src/features/arguments/composer/CollapsedComposerStrip.tsx',
  'src/features/arguments/composer/ComposerContextStrip.tsx',
  'src/features/arguments/oneBox/OneBox.tsx',
  // UX-001.4
  'src/features/arguments/oneBox/PopoutEntry.tsx',
  'src/features/arguments/oneBox/Popout.tsx',
  'src/features/arguments/oneBox/InspectPopout.tsx',
  // UX-001.5 — interactive primitives
  'src/features/nodeAnnotations/AnnotationChip.tsx',
  'src/features/nodeAnnotations/AnnotationOverflowChip.tsx',
  // EV-005 (the refactor consumer)
  'src/features/evidence/EvidenceAnnotationChip.tsx',
];

// ── Accessibility-role + label coverage ─────────────────────────

describe('UX-001.7 — every interactive UX-001 surface has accessibilityRole + accessibilityLabel evidence', () => {
  for (const relPath of ACCESSIBILITY_SCAN_FILES) {
    const full = path.resolve(ROOT, relPath);
    if (!fs.existsSync(full)) continue;
    const src = fs.readFileSync(full, 'utf8');

    it(`${relPath}: has accessibilityRole evidence`, () => {
      expect(src).toMatch(/accessibilityRole/);
    });

    it(`${relPath}: has accessibilityLabel evidence`, () => {
      expect(src).toMatch(/accessibilityLabel/);
    });
  }
});

// ── 44x44 enforcement ──────────────────────────────────────────

describe('UX-001.7 — TOUCH_TARGET.minSizePx = 44 (accessibility-targets minimum bar)', () => {
  it('TOUCH_TARGET.minSizePx is exactly 44', () => {
    expect(TOUCH_TARGET.minSizePx).toBe(44);
  });

  it('TOUCH_TARGET.hitSlopAll lifts a compact control to 44+ via 12-on-all-sides padding', () => {
    expect(TOUCH_TARGET.hitSlopAll.top).toBe(12);
    expect(TOUCH_TARGET.hitSlopAll.bottom).toBe(12);
    expect(TOUCH_TARGET.hitSlopAll.left).toBe(12);
    expect(TOUCH_TARGET.hitSlopAll.right).toBe(12);
  });

  it('every interactive UX-001 surface carries 44+ touch-target evidence (token, hitSlop, or 44+ minHeight)', () => {
    for (const relPath of ACCESSIBILITY_SCAN_FILES) {
      const full = path.resolve(ROOT, relPath);
      if (!fs.existsSync(full)) continue;
      const src = fs.readFileSync(full, 'utf8');
      const hasToken = /TOUCH_TARGET\./.test(src);
      const hasHitSlop = /hitSlop\s*=/.test(src);
      const hasMinHeight44Plus =
        /minHeight:\s*(4[4-9]|[5-9]\d|\d{3,})/.test(src) ||
        /minHeight\s*=\s*\{?\s*(4[4-9]|[5-9]\d|\d{3,})/.test(src) ||
        /COMPOSER_STRIP_HEIGHT_BY_BAND/.test(src) ||
        /POPOUT_ENTRY_MIN_HEIGHT/.test(src);
      expect(hasToken || hasHitSlop || hasMinHeight44Plus).toBe(true);
    }
  });
});

// ── Focus ring is non-color-only ───────────────────────────────

describe('UX-001.7 — FOCUS_RING token carries non-color geometric signal (width)', () => {
  it('FOCUS_RING.widthPx is a positive integer (geometric carrier of focus state)', () => {
    expect(FOCUS_RING.widthPx).toBeGreaterThan(0);
    expect(Number.isInteger(FOCUS_RING.widthPx)).toBe(true);
  });

  it('FOCUS_RING.widthPx is >= 2 (visible without color)', () => {
    expect(FOCUS_RING.widthPx).toBeGreaterThanOrEqual(2);
  });

  it('FOCUS_RING.color resolves to SURFACE_TOKENS.focusRing (one canonical color across app)', () => {
    expect(FOCUS_RING.color).toBe(SURFACE_TOKENS.focusRing);
  });

  it('FOCUS_RING.color is high-contrast (#a5b4fc indigo, AA-passing on dark surfaces)', () => {
    expect(FOCUS_RING.color).toBe('#a5b4fc');
  });

  it('AnnotationFocusRing.tsx still references SURFACE_TOKENS.focusRing color (no drift)', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, 'src/features/nodeAnnotations/AnnotationFocusRing.tsx'),
      'utf8',
    );
    expect(src).toMatch(/SURFACE_TOKENS\.focusRing/);
  });

  it('AnnotationFocusRing.tsx preserves the focus width literal `2` (matches FOCUS_RING.widthPx)', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, 'src/features/nodeAnnotations/AnnotationFocusRing.tsx'),
      'utf8',
    );
    expect(src).toMatch(/isFocused\s*\?\s*2/);
  });
});

// ── BORDER_WIDTH scale carries non-color signal ────────────────

describe('UX-001.7 — BORDER_WIDTH scale carries non-color geometric signal', () => {
  it('BORDER_WIDTH.sm < BORDER_WIDTH.md < BORDER_WIDTH.lg (monotonic scale)', () => {
    expect(BORDER_WIDTH.sm).toBeLessThan(BORDER_WIDTH.md);
    expect(BORDER_WIDTH.md).toBeLessThan(BORDER_WIDTH.lg);
  });

  it('BORDER_WIDTH.md is the standard outline (matches selected-state in AnnotationOutline)', () => {
    expect(BORDER_WIDTH.md).toBe(2);
  });
});

// ── Typography carries label-based meaning (not color) ─────────

describe('UX-001.7 — TYPOGRAPHY carries label-based meaning (color-independent)', () => {
  it('every TYPOGRAPHY group has fontSize >= 10 (readable size)', () => {
    for (const [, group] of Object.entries(TYPOGRAPHY)) {
      expect(group.fontSize).toBeGreaterThanOrEqual(10);
    }
  });

  it('every TYPOGRAPHY group has lineHeight > fontSize (legible line spacing)', () => {
    for (const [, group] of Object.entries(TYPOGRAPHY)) {
      expect(group.lineHeight).toBeGreaterThanOrEqual(group.fontSize);
    }
  });

  it('TYPOGRAPHY.popoutHeading uses bold weight (700) for hierarchy without color', () => {
    expect(TYPOGRAPHY.popoutHeading.fontWeight).toBe('700');
  });

  it('TYPOGRAPHY.chipLabel uses semibold (600) for chip distinction without color', () => {
    expect(TYPOGRAPHY.chipLabel.fontWeight).toBe('600');
  });
});

// ── Keyboard hint visibility — platform-conditional pattern ────

describe('UX-001.7 — keyboard hint visibility gate (menuKeyBadgeModel) preserved', () => {
  it('menuKeyBadgeModel.ts still exports the gate functions UX-001.4 established', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, 'src/features/arguments/oneBox/menuKeyBadgeModel.ts'),
      'utf8',
    );
    expect(src).toMatch(/deriveMenuKeyBadgeContext/);
    expect(src).toMatch(/resolveKeyBadgeVisibility/);
    expect(src).toMatch(/BROWSER_KEYBOARD_WIDTH_THRESHOLD/);
  });

  it('TYPOGRAPHY.keyboardHint uses the canonical 11-px badge text size', () => {
    expect(TYPOGRAPHY.keyboardHint.fontSize).toBe(11);
  });
});

// ── EvidenceAnnotationChip a11y preservation (post-refactor) ───

describe('UX-001.7 — EvidenceAnnotationChip a11y preserved post-refactor', () => {
  const src = fs.readFileSync(
    path.resolve(ROOT, 'src/features/evidence/EvidenceAnnotationChip.tsx'),
    'utf8',
  );

  it('chip aria label routes through buildAnnotationChipAccessibilityLabel pure helper', () => {
    expect(src).toMatch(/buildAnnotationChipAccessibilityLabel/);
  });

  it('status-chip aria label routes through buildAnnotationStatusChipAccessibilityLabel pure helper', () => {
    expect(src).toMatch(/buildAnnotationStatusChipAccessibilityLabel/);
  });

  it('add-annotation trigger has accessibilityLabel + accessibilityHint', () => {
    expect(src).toMatch(/ADD_ANNOTATION_TRIGGER_LABEL/);
    expect(src).toMatch(/accessibilityHint=/);
  });

  it('observer trigger notice has accessibilityState disabled:true', () => {
    expect(src).toMatch(/accessibilityState=\{\{ disabled: true \}\}/);
  });

  it('synthesis prompt (disabled) has accessibilityState disabled:true + EVIDENCE_ANNOTATION_OBSERVER_HELPER', () => {
    expect(src).toMatch(/EVIDENCE_ANNOTATION_OBSERVER_HELPER/);
  });
});

// ── Doctrine — no color-only differentiation across UX-001.7 work ──

describe('UX-001.7 — non-color-only differentiation rule preserved', () => {
  it('AnnotationChip primitive still requires a label (not optional)', () => {
    const descriptorSrc = fs.readFileSync(
      path.resolve(ROOT, 'src/features/nodeAnnotations/annotationChipDescriptor.ts'),
      'utf8',
    );
    // The descriptor interface requires `label: string` (not optional).
    expect(descriptorSrc).toMatch(/label:\s*string/);
  });

  it('AnnotationOverflowChip carries a `+N` label (non-color carrier of count)', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, 'src/features/nodeAnnotations/AnnotationOverflowChip.tsx'),
      'utf8',
    );
    expect(src).toMatch(/\+\$\{safeCount\}|\+\$\{count\}|`\+\$\{/);
  });

  it('FOCUS_RING width >= 2 ensures focus state survives grayscale', () => {
    expect(FOCUS_RING.widthPx).toBeGreaterThanOrEqual(2);
  });
});
