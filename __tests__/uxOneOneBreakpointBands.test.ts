/**
 * UX-001.1 — 3-band breakpoint contract tests (Q1, Q3, Q5 verdicts).
 *
 * Pure-TS coverage of the new `BRAND.breakpoints`, `BRAND.logoHeightByBand`,
 * `BRAND.headerHeightByBand`, the `resolveBand` helper, and the
 * `band` field exposed on `HeaderBreakpoint`. Also pins the legacy
 * back-compat constants (`BRAND.logoHeightPxWide` / `headerHeightPxWide`)
 * so a future deprecation in UX-001.7 is a conscious test update.
 *
 * The existing `useHeaderBreakpoint.test.ts` covers Stage 1 + Stage 2
 * invariants and the back-compat behaviour of `isWide`. This file
 * covers only the NEW UX-001.1 surface so the two contracts stay
 * separable.
 */
import { BRAND } from '../src/lib/designTokens';
import {
  resolveBand,
  resolveHeaderBreakpoint,
} from '../src/hooks/useHeaderBreakpoint';

// ── Q1 — BRAND.breakpoints object shape ─────────────────────────

describe('UX-001.1 — 3-band breakpoint contract (Q1)', () => {
  it('Q1.1: BRAND.breakpoints has exactly phone, tablet, wide keys', () => {
    expect(Object.keys(BRAND.breakpoints).sort()).toEqual(
      ['phone', 'tablet', 'wide'].sort(),
    );
  });

  it('Q1.2: phone band has minPx=0, maxPx=599', () => {
    expect(BRAND.breakpoints.phone.minPx).toBe(0);
    expect(BRAND.breakpoints.phone.maxPx).toBe(599);
  });

  it('Q1.3: tablet band has minPx=600, maxPx=1279', () => {
    expect(BRAND.breakpoints.tablet.minPx).toBe(600);
    expect(BRAND.breakpoints.tablet.maxPx).toBe(1279);
  });

  it('Q1.4: wide band has minPx=1280, maxPx=Infinity', () => {
    expect(BRAND.breakpoints.wide.minPx).toBe(1280);
    expect(BRAND.breakpoints.wide.maxPx).toBe(Number.POSITIVE_INFINITY);
  });

  it('Q1.5a: bands are contiguous — phone.maxPx + 1 === tablet.minPx', () => {
    expect(BRAND.breakpoints.phone.maxPx + 1).toBe(
      BRAND.breakpoints.tablet.minPx,
    );
  });

  it('Q1.5b: bands are contiguous — tablet.maxPx + 1 === wide.minPx', () => {
    expect(BRAND.breakpoints.tablet.maxPx + 1).toBe(
      BRAND.breakpoints.wide.minPx,
    );
  });

  it('Q1.6: bands cover [0, ∞) with no gap and no overlap', () => {
    // Lower bound covers 0.
    expect(BRAND.breakpoints.phone.minPx).toBe(0);
    // Upper bound is infinite.
    expect(BRAND.breakpoints.wide.maxPx).toBe(Number.POSITIVE_INFINITY);
    // Sorted ascending by minPx.
    const sorted = [
      BRAND.breakpoints.phone.minPx,
      BRAND.breakpoints.tablet.minPx,
      BRAND.breakpoints.wide.minPx,
    ];
    expect([...sorted].sort((a, b) => a - b)).toEqual(sorted);
  });
});

// ── Q1 — resolveBand pure helper ────────────────────────────────

describe('UX-001.1 — resolveBand pure helper (Q1)', () => {
  it('Q1.7: resolveBand(0) === "wide" (SSR safety, preserved from Stage 2)', () => {
    expect(resolveBand(0)).toBe('wide');
  });

  it('Q1.8: resolveBand(-1) === "wide" (defensive)', () => {
    expect(resolveBand(-1)).toBe('wide');
  });

  it('Q1.9: resolveBand(1) === "phone"', () => {
    expect(resolveBand(1)).toBe('phone');
  });

  it('Q1.10: resolveBand(320) === "phone" (small Android)', () => {
    expect(resolveBand(320)).toBe('phone');
  });

  it('Q1.11: resolveBand(390) === "phone" (iPhone portrait)', () => {
    expect(resolveBand(390)).toBe('phone');
  });

  it('Q1.12: resolveBand(599) === "phone" (boundary upper of phone)', () => {
    expect(resolveBand(599)).toBe('phone');
  });

  it('Q1.13: resolveBand(600) === "tablet" (boundary lower of tablet)', () => {
    expect(resolveBand(600)).toBe('tablet');
  });

  it('Q1.14: resolveBand(720) === "tablet" (legacy isWide boundary)', () => {
    expect(resolveBand(720)).toBe('tablet');
  });

  it('Q1.15: resolveBand(768) === "tablet" (iPad portrait)', () => {
    expect(resolveBand(768)).toBe('tablet');
  });

  it('Q1.16: resolveBand(1024) === "tablet" (iPad landscape)', () => {
    expect(resolveBand(1024)).toBe('tablet');
  });

  it('Q1.17: resolveBand(1279) === "tablet" (boundary upper of tablet)', () => {
    expect(resolveBand(1279)).toBe('tablet');
  });

  it('Q1.18: resolveBand(1280) === "wide" (boundary lower of wide)', () => {
    expect(resolveBand(1280)).toBe('wide');
  });

  it('Q1.19: resolveBand(1440) === "wide" (typical laptop)', () => {
    expect(resolveBand(1440)).toBe('wide');
  });

  it('Q1.20: resolveBand(3440) === "wide" (ultrawide)', () => {
    expect(resolveBand(3440)).toBe('wide');
  });
});

// ── Q1 — useHeaderBreakpoint exposes band ───────────────────────

describe('UX-001.1 — useHeaderBreakpoint exposes band (Q1)', () => {
  it('Q1.21: resolveHeaderBreakpoint(0).band === "wide"', () => {
    expect(resolveHeaderBreakpoint(0).band).toBe('wide');
  });

  it('Q1.22: resolveHeaderBreakpoint(390).band === "phone"', () => {
    expect(resolveHeaderBreakpoint(390).band).toBe('phone');
  });

  it('Q1.23: resolveHeaderBreakpoint(768).band === "tablet"', () => {
    expect(resolveHeaderBreakpoint(768).band).toBe('tablet');
  });

  it('Q1.24: resolveHeaderBreakpoint(1440).band === "wide"', () => {
    expect(resolveHeaderBreakpoint(1440).band).toBe('wide');
  });
});

// ── Q1 — isWide back-compat alias ───────────────────────────────

describe('UX-001.1 — isWide back-compat alias (Q1)', () => {
  it('Q1.25: resolveHeaderBreakpoint(0).isWide === true (SSR preserved)', () => {
    expect(resolveHeaderBreakpoint(0).isWide).toBe(true);
  });

  it('Q1.26: resolveHeaderBreakpoint(720).isWide === true (legacy boundary preserved; now tablet band)', () => {
    expect(resolveHeaderBreakpoint(720).isWide).toBe(true);
  });

  it('Q1.27: resolveHeaderBreakpoint(390).isWide === false (phone)', () => {
    expect(resolveHeaderBreakpoint(390).isWide).toBe(false);
  });

  it('Q1.28: resolveHeaderBreakpoint(1280).isWide === true (wide)', () => {
    expect(resolveHeaderBreakpoint(1280).isWide).toBe(true);
  });
});

// ── Q3 + Q5 — header + logo heights per band ────────────────────

describe('UX-001.1 — header + logo heights per band (Q3, Q5)', () => {
  it('Q3+Q5.29a: BRAND.logoHeightByBand.phone === 44', () => {
    expect(BRAND.logoHeightByBand.phone).toBe(44);
  });

  it('Q3+Q5.29b: BRAND.logoHeightByBand.tablet === 80', () => {
    expect(BRAND.logoHeightByBand.tablet).toBe(80);
  });

  it('Q3+Q5.29c: BRAND.logoHeightByBand.wide === 96', () => {
    expect(BRAND.logoHeightByBand.wide).toBe(96);
  });

  it('Q3+Q5.30a: BRAND.headerHeightByBand.phone === 64', () => {
    expect(BRAND.headerHeightByBand.phone).toBe(64);
  });

  it('Q3+Q5.30b: BRAND.headerHeightByBand.tablet === 96', () => {
    expect(BRAND.headerHeightByBand.tablet).toBe(96);
  });

  it('Q3+Q5.30c: BRAND.headerHeightByBand.wide === 120', () => {
    expect(BRAND.headerHeightByBand.wide).toBe(120);
  });

  it('Q3+Q5.31: legacy BRAND.logoHeightPxWide preserved at 110 (back-compat)', () => {
    expect(BRAND.logoHeightPxWide).toBe(110);
  });

  it('Q3+Q5.32: legacy BRAND.headerHeightPxWide preserved at 152 (back-compat)', () => {
    expect(BRAND.headerHeightPxWide).toBe(152);
  });

  it('Q5.33: wide header is shorter than legacy (120 < 152) — frees viewport', () => {
    expect(BRAND.headerHeightByBand.wide).toBeLessThan(BRAND.headerHeightPxWide);
  });

  it('Q5.34: each band header has padding budget — header >= logo + 16dp', () => {
    expect(BRAND.headerHeightByBand.phone - BRAND.logoHeightByBand.phone).toBeGreaterThanOrEqual(16);
    expect(BRAND.headerHeightByBand.tablet - BRAND.logoHeightByBand.tablet).toBeGreaterThanOrEqual(16);
    expect(BRAND.headerHeightByBand.wide - BRAND.logoHeightByBand.wide).toBeGreaterThanOrEqual(16);
  });

  it('Q3.35: logo grows monotonically with band (phone < tablet < wide)', () => {
    expect(BRAND.logoHeightByBand.phone).toBeLessThan(BRAND.logoHeightByBand.tablet);
    expect(BRAND.logoHeightByBand.tablet).toBeLessThan(BRAND.logoHeightByBand.wide);
  });

  it('Q5.36: header grows monotonically with band (phone < tablet < wide)', () => {
    expect(BRAND.headerHeightByBand.phone).toBeLessThan(BRAND.headerHeightByBand.tablet);
    expect(BRAND.headerHeightByBand.tablet).toBeLessThan(BRAND.headerHeightByBand.wide);
  });

  it('Q3+Q5.37: resolveHeaderBreakpoint(390) returns phone band heights', () => {
    const r = resolveHeaderBreakpoint(390);
    expect(r.logoHeightPx).toBe(BRAND.logoHeightByBand.phone);
    expect(r.headerHeightPx).toBe(BRAND.headerHeightByBand.phone);
  });

  it('Q3+Q5.38: resolveHeaderBreakpoint(768) returns tablet band heights', () => {
    const r = resolveHeaderBreakpoint(768);
    expect(r.logoHeightPx).toBe(BRAND.logoHeightByBand.tablet);
    expect(r.headerHeightPx).toBe(BRAND.headerHeightByBand.tablet);
  });

  it('Q3+Q5.39: resolveHeaderBreakpoint(1440) returns wide band heights', () => {
    const r = resolveHeaderBreakpoint(1440);
    expect(r.logoHeightPx).toBe(BRAND.logoHeightByBand.wide);
    expect(r.headerHeightPx).toBe(BRAND.headerHeightByBand.wide);
  });
});
