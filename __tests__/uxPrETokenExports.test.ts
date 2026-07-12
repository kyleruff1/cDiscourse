/**
 * UX-PR-E — additive dimension / motion / scrim / glyph token contract.
 *
 * Asserts that the six new token families added to
 * `src/lib/designTokens.ts` (plus the new pure-leaf `src/lib/glyphs.ts`)
 * exist, carry the documented shapes and exact values, aggregate into
 * `TOKENS`, are reachable via `getToken`, and carry zero verdict / heat /
 * popularity vocabulary. Also pins that every PRE-EXISTING export stays
 * byte-identical (PR-E is ADD-only: zero consumer migration, zero
 * value mutation).
 *
 * Pure-TS (no React, no Supabase). Per `docs/designs/UX-PR-E.md`.
 */
import {
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  SURFACE,
  SURFACE_TOKENS,
  MOTION,
  SCRIM,
  GLYPHS,
  TOKENS,
  TOUCH_TARGET,
  FOCUS_RING,
  BORDER_WIDTH,
  SPACING_PRESETS,
  getToken,
} from '../src/lib/designTokens';

// ── SPACING interior steps (F-06) ───────────────────────────────

describe('UX-PR-E — SPACING interior steps', () => {
  it('adds xxs / xs6 / m10 with the documented values', () => {
    expect(SPACING.xxs).toBe(2);
    expect(SPACING.xs6).toBe(6);
    expect(SPACING.m10).toBe(10);
  });

  it('is monotonic across base + interior steps (xxs<xs<xs6<s<m10<m<l<xl)', () => {
    expect(SPACING.xxs).toBeLessThan(SPACING.xs);
    expect(SPACING.xs).toBeLessThan(SPACING.xs6);
    expect(SPACING.xs6).toBeLessThan(SPACING.s);
    expect(SPACING.s).toBeLessThan(SPACING.m10);
    expect(SPACING.m10).toBeLessThan(SPACING.m);
    expect(SPACING.m).toBeLessThan(SPACING.l);
    expect(SPACING.l).toBeLessThan(SPACING.xl);
  });

  it('leaves every pre-existing SPACING value byte-identical', () => {
    expect(SPACING.xs).toBe(4);
    expect(SPACING.s).toBe(8);
    expect(SPACING.m).toBe(12);
    expect(SPACING.l).toBe(16);
    expect(SPACING.xl).toBe(24);
  });
});

// ── RADIUS interior steps (F-07) ────────────────────────────────

describe('UX-PR-E — RADIUS interior steps', () => {
  it('adds sm6 / md10 with the documented values', () => {
    expect(RADIUS.sm6).toBe(6);
    expect(RADIUS.md10).toBe(10);
  });

  it('is monotonic across base + interior steps (sm<sm6<md<md10<lg<pill)', () => {
    expect(RADIUS.sm).toBeLessThan(RADIUS.sm6);
    expect(RADIUS.sm6).toBeLessThan(RADIUS.md);
    expect(RADIUS.md).toBeLessThan(RADIUS.md10);
    expect(RADIUS.md10).toBeLessThan(RADIUS.lg);
    expect(RADIUS.lg).toBeLessThan(RADIUS.pill);
  });

  it('leaves every pre-existing RADIUS value byte-identical', () => {
    expect(RADIUS.sm).toBe(4);
    expect(RADIUS.md).toBe(8);
    expect(RADIUS.lg).toBe(12);
    expect(RADIUS.pill).toBe(999);
  });
});

// ── TYPOGRAPHY reading-body + title roles (F-09) ────────────────

describe('UX-PR-E — TYPOGRAPHY body / title roles + microLabel floor', () => {
  it('microLabel is exactly 10 / 14 / 600', () => {
    expect(TYPOGRAPHY.microLabel).toEqual({ fontSize: 10, lineHeight: 14, fontWeight: '600' });
  });

  it('bodySm is exactly 13 / 18 / 400', () => {
    expect(TYPOGRAPHY.bodySm).toEqual({ fontSize: 13, lineHeight: 18, fontWeight: '400' });
  });

  it('body is exactly 15 / 21 / 400 (AUDIT §4 reading-body role)', () => {
    expect(TYPOGRAPHY.body).toEqual({ fontSize: 15, lineHeight: 21, fontWeight: '400' });
  });

  it('titleSm is exactly 16 / 22 / 600', () => {
    expect(TYPOGRAPHY.titleSm).toEqual({ fontSize: 16, lineHeight: 22, fontWeight: '600' });
  });

  it('title is exactly 18 / 24 / 700', () => {
    expect(TYPOGRAPHY.title).toEqual({ fontSize: 18, lineHeight: 24, fontWeight: '700' });
  });

  it('every new group clears the min-10 legibility floor and lineHeight >= fontSize', () => {
    const NEW_GROUPS = [
      TYPOGRAPHY.microLabel,
      TYPOGRAPHY.bodySm,
      TYPOGRAPHY.body,
      TYPOGRAPHY.titleSm,
      TYPOGRAPHY.title,
    ];
    for (const g of NEW_GROUPS) {
      expect(g.fontSize).toBeGreaterThanOrEqual(10);
      expect(g.lineHeight).toBeGreaterThanOrEqual(g.fontSize);
    }
  });

  it('leaves the pre-existing TYPOGRAPHY groups byte-identical (spot check)', () => {
    expect(TYPOGRAPHY.chipLabel).toEqual({ fontSize: 11, lineHeight: 14, fontWeight: '600' });
    expect(TYPOGRAPHY.composer).toEqual({ fontSize: 13, lineHeight: 18, fontWeight: '400' });
  });

  it('still contains every one of the original 10 group names', () => {
    const keys = Object.keys(TYPOGRAPHY);
    for (const original of [
      'roomStrip',
      'timelineNode',
      'selectedContext',
      'composer',
      'popoutHeading',
      'popoutBody',
      'chipLabel',
      'badgeLabel',
      'keyboardHint',
      'inspectDetail',
    ]) {
      expect(keys).toContain(original);
    }
  });
});

// ── MOTION duration scale (F-26) ────────────────────────────────

describe('UX-PR-E — MOTION duration scale', () => {
  it('is defined with the documented millisecond values', () => {
    expect(MOTION).toBeDefined();
    expect(MOTION.fastMs).toBe(140);
    expect(MOTION.baseMs).toBe(160);
    expect(MOTION.slowMs).toBe(180);
  });

  it('is ascending (fast < base < slow)', () => {
    expect(MOTION.fastMs).toBeLessThan(MOTION.baseMs);
    expect(MOTION.baseMs).toBeLessThan(MOTION.slowMs);
  });

  it('has exactly 3 keys', () => {
    expect(Object.keys(MOTION)).toHaveLength(3);
  });

  it('is reachable from the TOKENS aggregate and via getToken', () => {
    expect(TOKENS.motion).toBe(MOTION);
    expect(getToken('motion.baseMs')).toBe(160);
  });
});

// ── SCRIM ladder (F-18) ─────────────────────────────────────────

describe('UX-PR-E — SCRIM ladder', () => {
  it('is defined with the three exact rgba strings', () => {
    expect(SCRIM).toBeDefined();
    expect(SCRIM.light).toBe('rgba(2,6,23,0.45)');
    expect(SCRIM.medium).toBe('rgba(2,6,23,0.6)');
    expect(SCRIM.heavy).toBe('rgba(2,6,23,0.8)');
  });

  it('every step is built over the interior base rgb 2,6,23', () => {
    for (const step of Object.values(SCRIM)) {
      expect(step).toContain('2,6,23');
    }
  });

  it('couples to the surface base hex #020617 (= rgb 2,6,23)', () => {
    // If the surface base ever moves, this documents that SCRIM must
    // move with it — the scrim base must not silently desync.
    expect(SURFACE.base.bg).toBe('#020617');
    expect(SURFACE_TOKENS.base).toBe('#020617');
  });

  it('has ascending opacity (0.45 < 0.6 < 0.8)', () => {
    const alphaOf = (rgba: string): number => {
      const m = rgba.match(/,\s*([0-9.]+)\s*\)$/);
      return m ? Number(m[1]) : NaN;
    };
    const light = alphaOf(SCRIM.light);
    const medium = alphaOf(SCRIM.medium);
    const heavy = alphaOf(SCRIM.heavy);
    expect(light).toBe(0.45);
    expect(medium).toBe(0.6);
    expect(heavy).toBe(0.8);
    expect(light).toBeLessThan(medium);
    expect(medium).toBeLessThan(heavy);
  });

  it('has exactly 3 keys', () => {
    expect(Object.keys(SCRIM)).toHaveLength(3);
  });

  it('is reachable from the TOKENS aggregate and via getToken', () => {
    expect(TOKENS.scrim).toBe(SCRIM);
    expect(getToken('scrim.heavy')).toBe('rgba(2,6,23,0.8)');
  });
});

// ── GLYPHS vocabulary (F-20) ────────────────────────────────────

describe('UX-PR-E — GLYPHS vocabulary', () => {
  const EXPECTED_KEYS = [
    'circleOutline',
    'circleFilled',
    'triangleDown',
    'triangleRight',
    'check',
    'arrowRight',
    'diamondOutline',
    'diamondFilled',
    'bullet',
    'arrowUp',
    'arrowDown',
    'callback',
    'replyReturn',
  ];

  it('has all 13 documented keys', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...EXPECTED_KEYS].sort());
    expect(Object.keys(GLYPHS)).toHaveLength(13);
  });

  it('every value is a non-empty string', () => {
    for (const [key, value] of Object.entries(GLYPHS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThanOrEqual(1);
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('callback glyph equals the canonical U+2934 char', () => {
    expect(GLYPHS.callback).toBe('⤴');
  });

  it('is reachable from the TOKENS aggregate and via getToken', () => {
    expect(TOKENS.glyphs).toBe(GLYPHS);
    expect(getToken('glyphs.arrowRight')).toBe('→');
  });
});

// ── Byte-identity of pre-existing exports (ADD-only guard) ──────

describe('UX-PR-E — pre-existing exports stay reference-identical', () => {
  it('TOKENS.spacing === SPACING', () => {
    expect(TOKENS.spacing).toBe(SPACING);
  });
  it('TOKENS.radius === RADIUS', () => {
    expect(TOKENS.radius).toBe(RADIUS);
  });
  it('TOKENS.typography === TYPOGRAPHY', () => {
    expect(TOKENS.typography).toBe(TYPOGRAPHY);
  });
  it('TOKENS.surfaceTokens === SURFACE_TOKENS', () => {
    expect(TOKENS.surfaceTokens).toBe(SURFACE_TOKENS);
  });
});

// ── Doctrine ban-list over the NEW tokens ───────────────────────

describe('UX-PR-E — new tokens carry zero verdict / heat / popularity vocabulary', () => {
  const FORBIDDEN = [
    'winner', 'loser', 'liar', 'truth', 'verdict', 'correct', 'incorrect',
    'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
    'popular', 'trending', 'viral', 'amplification', 'engagement',
  ];

  function scanKeysAndStringValues(obj: unknown, accum: string[]): void {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'string') {
      accum.push(obj);
      return;
    }
    if (typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const v of obj) scanKeysAndStringValues(v, accum);
      return;
    }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      accum.push(k);
      scanKeysAndStringValues(v, accum);
    }
  }

  // Only the NEW tokens PR-E introduces — the SPACING/RADIUS/TYPOGRAPHY
  // additions plus the three new families. Existing keys are pinned by
  // their own ban-list guards.
  const NEW_TOKEN_SUBSET = {
    spacing: { xxs: SPACING.xxs, xs6: SPACING.xs6, m10: SPACING.m10 },
    radius: { sm6: RADIUS.sm6, md10: RADIUS.md10 },
    typography: {
      microLabel: TYPOGRAPHY.microLabel,
      bodySm: TYPOGRAPHY.bodySm,
      body: TYPOGRAPHY.body,
      titleSm: TYPOGRAPHY.titleSm,
      title: TYPOGRAPHY.title,
    },
    motion: MOTION,
    scrim: SCRIM,
    glyphs: GLYPHS,
  };

  it('no new key or string value carries forbidden vocabulary', () => {
    const tokens: string[] = [];
    scanKeysAndStringValues(NEW_TOKEN_SUBSET, tokens);
    const joined = tokens.join(' ').toLowerCase();
    for (const f of FORBIDDEN) {
      expect(joined).not.toContain(f);
    }
  });
});

// ── Count sanity (ADD-only accounting) ──────────────────────────

describe('UX-PR-E — additive counts', () => {
  it('SPACING grew by 3 interior keys (5 -> 8)', () => {
    expect(Object.keys(SPACING)).toHaveLength(8);
  });
  it('RADIUS grew by 2 interior keys (4 -> 6)', () => {
    expect(Object.keys(RADIUS)).toHaveLength(6);
  });
  it('TYPOGRAPHY grew by 5 role keys (10 -> 15)', () => {
    expect(Object.keys(TYPOGRAPHY)).toHaveLength(15);
  });
  it('MOTION / SCRIM add 3 keys each; GLYPHS adds 13', () => {
    expect(Object.keys(MOTION)).toHaveLength(3);
    expect(Object.keys(SCRIM)).toHaveLength(3);
    expect(Object.keys(GLYPHS)).toHaveLength(13);
  });

  it('the UX-001.7-family total recomputes to 32 (<= 50 ceiling)', () => {
    const total =
      Object.keys(TOUCH_TARGET).length +
      Object.keys(FOCUS_RING).length +
      Object.keys(BORDER_WIDTH).length +
      Object.keys(TYPOGRAPHY).length +
      Object.keys(SPACING_PRESETS).length;
    expect(total).toBe(32);
    expect(total).toBeLessThanOrEqual(50);
  });
});
