/**
 * UX-001.7 — Annotation primitive bounded tightening verification.
 *
 * Per `docs/designs/UX-001.7.md` §4 (Workstream 3) — the design
 * proposed token consumption inside `AnnotationFocusRing.tsx` +
 * `AnnotationOutline.tsx`. During implementation a UX-001.5 source-scan
 * boundary conflict was discovered: those tests pin the LITERAL form
 * (`borderWidth: isFocused ? 2 : 1` and `borderWidth: 2` / `: 1`),
 * which collides with the §12.B "uxOneOneFive*.test.{ts,tsx} all 18
 * files — read-only" constraint. See design §19.A for the resolution.
 *
 * Workstream 3 in-place tightening is therefore DEFERRED. The primitive
 * literals are preserved verbatim. UX-001.7 instead ships the canonical
 * tokens (`FOCUS_RING.widthPx`, `BORDER_WIDTH.sm`, `BORDER_WIDTH.md`)
 * with documented values, and this test verifies the VALUES MATCH the
 * literals the primitives currently use — proving the future migration
 * (gated on a separate OPS card that updates the UX-001.5 source-scan
 * tests) is runtime-safe.
 *
 * Pure-TS source-scan test — no React render.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  BORDER_WIDTH,
  FOCUS_RING,
  SURFACE_TOKENS,
} from '../src/lib/designTokens';

const ROOT = process.cwd();

const FOCUS_RING_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/nodeAnnotations/AnnotationFocusRing.tsx'),
  'utf8',
);

const OUTLINE_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/nodeAnnotations/AnnotationOutline.tsx'),
  'utf8',
);

// ── Token values match the primitives' literal values ───────────

describe('UX-001.7 — Workstream 3 token values align with primitive literal values (future-migration ready)', () => {
  it('FOCUS_RING.widthPx === 2 — matches AnnotationFocusRing focused literal `borderWidth: isFocused ? 2 : 1`', () => {
    expect(FOCUS_RING.widthPx).toBe(2);
    expect(FOCUS_RING_SRC).toMatch(/borderWidth:\s*isFocused\s*\?\s*2\s*:\s*1/);
  });

  it('BORDER_WIDTH.sm === 1 — matches AnnotationFocusRing selected-only fallback (the `: 1` half)', () => {
    expect(BORDER_WIDTH.sm).toBe(1);
  });

  it('BORDER_WIDTH.md === 2 — matches AnnotationOutline selected state literal `borderWidth: 2`', () => {
    expect(BORDER_WIDTH.md).toBe(2);
    expect(OUTLINE_SRC).toMatch(/selected:\s*\{[\s\S]*?borderWidth:\s*2/);
  });

  it('BORDER_WIDTH.sm === 1 — matches AnnotationOutline active state literal `borderWidth: 1`', () => {
    expect(BORDER_WIDTH.sm).toBe(1);
    expect(OUTLINE_SRC).toMatch(/active:\s*\{[\s\S]*?borderWidth:\s*1/);
  });

  it('BORDER_WIDTH.sm === 1 — matches AnnotationOutline dimmed state literal `borderWidth: 1`', () => {
    expect(BORDER_WIDTH.sm).toBe(1);
    expect(OUTLINE_SRC).toMatch(/dimmed:\s*\{[\s\S]*?borderWidth:\s*1/);
  });
});

// ── Primitive contracts preserved (public API + visual-only) ────

describe('UX-001.7 — Workstream 3 primitive contracts preserved verbatim', () => {
  it('AnnotationFocusRing still exports AnnotationFocusRing (public API preserved)', () => {
    expect(FOCUS_RING_SRC).toMatch(/export\s+function\s+AnnotationFocusRing/);
  });

  it('AnnotationFocusRing still uses pointerEvents="none" (visual-only contract preserved)', () => {
    expect(FOCUS_RING_SRC).toMatch(/pointerEvents="none"/);
  });

  it('AnnotationFocusRing still uses SURFACE_TOKENS.focusRing for borderColor (canonical color preserved)', () => {
    expect(FOCUS_RING_SRC).toMatch(/borderColor:\s*SURFACE_TOKENS\.focusRing/);
  });

  it('AnnotationOutline still exports AnnotationOutline (public API preserved)', () => {
    expect(OUTLINE_SRC).toMatch(/export\s+function\s+AnnotationOutline/);
  });

  it('AnnotationOutline still uses pointerEvents="none" (visual-only contract preserved)', () => {
    expect(OUTLINE_SRC).toMatch(/pointerEvents="none"/);
  });

  it('AnnotationOutline preserves the cream selected border color (BRAND.accent.cream)', () => {
    expect(OUTLINE_SRC).toMatch(/borderColor:\s*BRAND\.accent\.cream/);
  });

  it('AnnotationOutline preserves the indigo active border color (GLOW.activePath.color)', () => {
    expect(OUTLINE_SRC).toMatch(/borderColor:\s*GLOW\.activePath\.color/);
  });
});

// ── No hex literals in primitive files (doctrine preserved) ─────

describe('UX-001.7 — primitive files still contain no hex color literals (doctrine preserved)', () => {
  const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/;

  it('AnnotationFocusRing.tsx has no hex color literals (all colors token-derived)', () => {
    expect(FOCUS_RING_SRC).not.toMatch(HEX_LITERAL);
  });

  it('AnnotationOutline.tsx has no hex color literals (all colors token-derived)', () => {
    expect(OUTLINE_SRC).not.toMatch(HEX_LITERAL);
  });
});

// ── Future-migration JSDoc deferral marker present ──────────────

describe('UX-001.7 — primitive files document the deferred Workstream 3 in-place tightening', () => {
  it('AnnotationFocusRing JSDoc explains UX-001.7 token availability + deferred in-place migration', () => {
    expect(FOCUS_RING_SRC).toMatch(/UX-001\.7/);
    expect(FOCUS_RING_SRC).toMatch(/FOCUS_RING\.widthPx/);
    expect(FOCUS_RING_SRC).toMatch(/BORDER_WIDTH\.sm/);
  });

  it('AnnotationOutline JSDoc explains UX-001.7 token availability + deferred in-place migration', () => {
    expect(OUTLINE_SRC).toMatch(/UX-001\.7/);
    expect(OUTLINE_SRC).toMatch(/BORDER_WIDTH\.md/);
    expect(OUTLINE_SRC).toMatch(/BORDER_WIDTH\.sm/);
  });
});

// ── Semantic distinction preserved (selected ≠ focused, even with same value) ──

describe('UX-001.7 — semantic distinction preserved: selected outline ≠ focus ring (even at the same width value)', () => {
  it('BORDER_WIDTH.md and FOCUS_RING.widthPx coincide at 2 (intentional alignment, not coupling)', () => {
    // The two tokens carry the same NUMERIC value today but represent
    // different semantic intents: BORDER_WIDTH.md is "standard outline
    // emphasis" (object-level selected state); FOCUS_RING.widthPx is
    // "focus ring width" (transient keyboard focus). Future tuning may
    // diverge — a single-token edit, not a global hunt.
    expect(BORDER_WIDTH.md).toBe(2);
    expect(FOCUS_RING.widthPx).toBe(2);
  });

  it('FOCUS_RING.color is canonical to SURFACE_TOKENS.focusRing (one focus-ring color across the app)', () => {
    expect(FOCUS_RING.color).toBe(SURFACE_TOKENS.focusRing);
  });
});
