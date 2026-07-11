/**
 * A11Y-693 — ASP surface accessibility audit (source-scan regression guard).
 *
 * Per `docs/designs/A11Y-693-ASP.md`. This pins every green cell of the audit
 * matrix so a future edit that drops an attribute fails. Mirrors
 * `uxOneOneSixTouchTargets.test.ts`: an enumerated surface list x the
 * 6-viewport grid, asserting per interactive file that it carries
 * accessibilityRole + accessibilityLabel + a 44 target (hitSlop OR a 44+
 * minHeight OR a TOUCH_TARGET token). Delegating surfaces (ProofChip,
 * ExchangeView, RingsideFeed) own no raw Pressable and are asserted as such
 * (delegation, not surprised). Any surface that imports an animator must
 * reference a reduce-motion gate.
 *
 * Comments are apostrophe-free for the naive quote-parity doctrine scanner.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();

/**
 * The interactive ASP component files — each owns at least one Pressable and its
 * own touch-target + role + label contract. Enumerated so the coverage is
 * auditable (a rename surfaces as a file-presence failure).
 */
const ASP_INTERACTIVE_FILES: ReadonlyArray<string> = Object.freeze([
  'src/features/proof/ProofDrawer.tsx',
  'src/features/feedback/BooleanFeedbackBar.tsx',
  'src/features/arguments/room/ArgumentStateRail.tsx',
  'src/features/arguments/room/RingsideCard.tsx',
  'src/features/arguments/markers/TimestampMarker.tsx',
  'src/features/arguments/markers/MarkerPhrasePickerSheet.tsx',
  'src/features/arguments/crossRoom/CallbackEchoStrip.tsx',
  'src/features/arguments/crossRoom/CallbackCaptureSheet.tsx',
  'src/features/arguments/crossRoom/CallbackDraftEcho.tsx',
  'src/features/feedbackFlags/PointFeedbackFlagPill.tsx',
  'src/features/feedbackFlags/PointFeedbackFlagsRow.tsx',
]);

/**
 * Delegating ASP surfaces: they own no raw Pressable and forward their
 * interactive / motion contract to a child (ProofChip -> ReceiptChip +
 * SourceChainPopover; ExchangeView -> the feed; RingsideFeed -> RingsideCard).
 * Listed as an explicit delegation group so the coverage map is auditable and a
 * future Pressable added here surfaces (it must then own a role + label + target).
 */
const ASP_DELEGATING_FILES: ReadonlyArray<string> = Object.freeze([
  'src/features/proof/ProofChip.tsx',
  'src/features/arguments/room/ExchangeView.tsx',
  'src/features/arguments/room/RingsideFeed.tsx',
]);

/**
 * The known animators reachable from the ASP surfaces. Each must gate its motion
 * on reduce-motion. Per the design audit, ONLY these three match the animator
 * antecedent today; the ASP-set contract below proves no other ASP file does.
 */
const MOTION_GATED_FILES: ReadonlyArray<string> = Object.freeze([
  'src/features/arguments/crossRoom/CallbackCaptureSheet.tsx',
  'src/features/mediator/DisagreementPointsRail.tsx',
  'src/features/evidence/SourceChainPopover.tsx',
]);

interface ViewportCell {
  label: string;
  windowWidth: number;
  band: 'phone' | 'tablet' | 'wide';
}

const VIEWPORTS: ReadonlyArray<ViewportCell> = Object.freeze([
  { label: '390x844 phone iOS', windowWidth: 390, band: 'phone' },
  { label: '412x892 phone large Android', windowWidth: 412, band: 'phone' },
  { label: '768x1024 tablet iPad', windowWidth: 768, band: 'tablet' },
  { label: '1024x1366 tablet iPad Pro', windowWidth: 1024, band: 'tablet' },
  { label: '1366x768 narrow browser', windowWidth: 1366, band: 'wide' },
  { label: '1920x1080 wide browser', windowWidth: 1920, band: 'wide' },
]);

function readIfExists(relPath: string): string | null {
  const full = path.resolve(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

const ALL_FILES = Array.from(
  new Set([...ASP_INTERACTIVE_FILES, ...ASP_DELEGATING_FILES, ...MOTION_GATED_FILES]),
);
const FILE_CACHE: Record<string, string | null> = Object.fromEntries(
  ALL_FILES.map((f) => [f, readIfExists(f)]),
);

// The 44 target evidence: a hitSlop literal, OR a 44+ minHeight literal, OR a
// TOUCH_TARGET token (minSizePx is 44).
function hasTouchTargetEvidence(src: string): boolean {
  const hasHitSlop = /hitSlop/.test(src);
  const hasMin44Literal = /minHeight:\s*(4[4-9]|[5-9]\d|\d{3,})/.test(src);
  const hasTouchToken = /TOUCH_TARGET/.test(src);
  return hasHitSlop || hasMin44Literal || hasTouchToken;
}

// The animator antecedent: an imported RN Animated / LayoutAnimation /
// reanimated primitive, or a Modal animationType prop.
const MOTION_ANTECEDENT = /\bAnimated\b|\bLayoutAnimation\b|reanimated|animationType/;
// The reduce-motion consequent: a reduceMotion prop / useReduceMotion hook /
// effectiveReducedMotion value / reduceMotionOverride prop, or AccessibilityInfo.
function referencesReduceMotionGate(src: string): boolean {
  return /reduce\w*motion/i.test(src) || /AccessibilityInfo/.test(src);
}

// ── File presence ────────────────────────────────────────────────

describe('A11Y-693 ASP audit — every enumerated surface exists', () => {
  for (const rel of [...ASP_INTERACTIVE_FILES, ...ASP_DELEGATING_FILES, ...MOTION_GATED_FILES]) {
    it(`${rel} exists`, () => {
      expect(FILE_CACHE[rel]).not.toBeNull();
    });
  }
});

// ── Interactive surfaces: role + label + 44 target (per viewport) ──

describe('A11Y-693 ASP audit — interactive surfaces carry role + label + a 44 target', () => {
  for (const rel of ASP_INTERACTIVE_FILES) {
    const src = FILE_CACHE[rel];
    if (!src) continue;
    const hasPressable = /<Pressable/.test(src);
    for (const vp of VIEWPORTS) {
      it(`${rel} @ ${vp.label}: contains <Pressable> usage`, () => {
        expect(hasPressable).toBe(true);
      });
      it(`${rel} @ ${vp.label}: sets accessibilityRole`, () => {
        expect(src).toMatch(/accessibilityRole/);
      });
      it(`${rel} @ ${vp.label}: sets accessibilityLabel`, () => {
        expect(src).toMatch(/accessibilityLabel/);
      });
      it(`${rel} @ ${vp.label}: references hitSlop OR a 44+ minHeight OR TOUCH_TARGET`, () => {
        expect(hasTouchTargetEvidence(src)).toBe(true);
      });
    }
  }
});

// ── Delegating surfaces own no raw Pressable ─────────────────────

describe('A11Y-693 ASP audit — delegating surfaces own no raw Pressable (they delegate)', () => {
  for (const rel of ASP_DELEGATING_FILES) {
    it(`${rel} exists`, () => {
      expect(FILE_CACHE[rel]).not.toBeNull();
    });
    it(`${rel} owns no raw <Pressable> (its interactive contract is delegated)`, () => {
      const src = FILE_CACHE[rel];
      expect(src).not.toBeNull();
      if (!src) return;
      expect(/<Pressable/.test(src)).toBe(false);
    });
  }
});

// ── Reduce-motion contract over the ASP set ──────────────────────

describe('A11Y-693 ASP audit — any ASP surface that animates gates on reduce-motion', () => {
  for (const rel of [...ASP_INTERACTIVE_FILES, ...ASP_DELEGATING_FILES]) {
    const src = FILE_CACHE[rel];
    if (!src) continue;
    it(`${rel}: importing an animator implies a reduce-motion gate`, () => {
      // A file that does not animate is trivially compliant; one that imports an
      // animator must reference a reduce-motion gate. Single unconditional expect.
      const animates = MOTION_ANTECEDENT.test(src);
      expect(!animates || referencesReduceMotionGate(src)).toBe(true);
    });
  }
});

// ── The known ASP animators gate on reduce-motion ────────────────

describe('A11Y-693 ASP audit — the three ASP animators gate on reduce-motion', () => {
  for (const rel of MOTION_GATED_FILES) {
    it(`${rel} exists`, () => {
      expect(FILE_CACHE[rel]).not.toBeNull();
    });
    it(`${rel} matches the animator antecedent`, () => {
      const src = FILE_CACHE[rel];
      expect(src).not.toBeNull();
      if (!src) return;
      expect(MOTION_ANTECEDENT.test(src)).toBe(true);
    });
    it(`${rel} references a reduce-motion gate`, () => {
      const src = FILE_CACHE[rel];
      expect(src).not.toBeNull();
      if (!src) return;
      expect(referencesReduceMotionGate(src)).toBe(true);
    });
  }
});

// ── Coverage-count guard (a rename or drop surfaces here) ────────

describe('A11Y-693 ASP audit — enumeration is stable', () => {
  it('covers 14 auditable ASP component files (11 interactive + 3 delegating)', () => {
    expect(ASP_INTERACTIVE_FILES.length + ASP_DELEGATING_FILES.length).toBe(14);
  });

  it('every ASP surface path is unique (the animator list may overlap by design)', () => {
    // CallbackCaptureSheet is both an interactive surface AND an animator, so the
    // motion list overlaps the surface list; uniqueness is asserted over the
    // 14 ASP surface files where a duplicate would be a real coverage bug.
    const surfacePaths = [...ASP_INTERACTIVE_FILES, ...ASP_DELEGATING_FILES];
    expect(new Set(surfacePaths).size).toBe(surfacePaths.length);
  });
});
