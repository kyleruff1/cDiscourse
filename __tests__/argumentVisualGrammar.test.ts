/**
 * VG-001 — Argument visual grammar tests.
 *
 * Verifies the pure mapper produces a complete, ban-list-safe,
 * shape-non-only-color visual token for every argument-type × standing-
 * band combination.
 */
import {
  buildArgumentNodeVisualToken,
  MIN_TAP_TARGET_PX,
  FORBIDDEN_TOKEN_TOKENS,
} from '../src/features/arguments/argumentVisualGrammar';
import type { TimelineKindColorFamily, TimelineStandingBand } from '../src/features/arguments/argumentGameSurfaceModel';

const KINDS: TimelineKindColorFamily[] = [
  'claim', 'challenge', 'evidence', 'clarify', 'concede', 'flag', 'default',
];
const BANDS: TimelineStandingBand[] = [
  'pretty_wrong', 'slightly_wrong', 'neutral', 'slightly_right',
  'maybe_right_misguided', 'pretty_right', 'completely_right',
  'unscored', 'not_enough_signal',
];

// ── Coverage ─────────────────────────────────────────────────────

describe('VG-001 buildArgumentNodeVisualToken coverage', () => {
  it('returns a non-null token for every (kind × band) combination', () => {
    for (const k of KINDS) {
      for (const b of BANDS) {
        const t = buildArgumentNodeVisualToken({ argumentType: k, standingBand: b });
        expect(t).toBeTruthy();
        expect(t.shape).toBeTruthy();
        expect(t.color.bg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(t.color.fg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(t.stroke.style).toBeTruthy();
        expect(t.stroke.weight).toBeGreaterThanOrEqual(1);
        expect(t.texture).toBeTruthy();
        expect(t.accessibilityLabel).toBeTruthy();
      }
    }
  });

  it('min tap target is 44px on every token', () => {
    for (const k of KINDS) {
      for (const b of BANDS) {
        const t = buildArgumentNodeVisualToken({ argumentType: k, standingBand: b });
        expect(t.minTapTargetPx).toBe(MIN_TAP_TARGET_PX);
      }
    }
    expect(MIN_TAP_TARGET_PX).toBe(44);
  });
});

// ── Shape is orthogonal to color ─────────────────────────────────

describe('VG-001 shape never depends on color alone', () => {
  it('shape varies by argument kind, independent of color', () => {
    // Confirm at least 4 distinct shapes across the 5 main argument kinds.
    const shapes = new Set<string>();
    for (const k of ['claim', 'challenge', 'evidence', 'clarify', 'concede'] as const) {
      const t = buildArgumentNodeVisualToken({ argumentType: k, standingBand: 'neutral' });
      shapes.add(t.shape);
    }
    expect(shapes.size).toBeGreaterThanOrEqual(4);
  });

  it('every token carries non-color discriminators (shape + stroke + weight + texture + glyph)', () => {
    for (const k of KINDS) {
      for (const b of BANDS) {
        const t = buildArgumentNodeVisualToken({ argumentType: k, standingBand: b });
        // If a viewer can only see shape (no color), each of these fields helps.
        expect(t.shape).toBeTruthy();
        expect(t.stroke.style).toBeTruthy();
        expect(t.stroke.weight).toBeGreaterThanOrEqual(1);
        expect(t.texture).toBeTruthy();
        expect(t.shapeGlyph.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── Strong vs weak distinguishable beyond color ──────────────────

describe('VG-001 strong / weak distinguishable through stroke + weight + texture', () => {
  it('strong (completely_right) and weak (pretty_wrong) differ in stroke style', () => {
    const strong = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'completely_right' });
    const weak = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'pretty_wrong' });
    expect(strong.stroke.style).not.toBe(weak.stroke.style);
  });

  it('strong has heavier stroke weight than weak', () => {
    const strong = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'completely_right' });
    const weak = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'pretty_wrong' });
    expect(strong.stroke.weight).toBeGreaterThan(weak.stroke.weight);
  });

  it('weight ladder is monotonic across the strength bands', () => {
    const w1 = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'pretty_wrong' }).stroke.weight;
    const w2 = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'neutral' }).stroke.weight;
    const w3 = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'slightly_right' }).stroke.weight;
    const w4 = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'pretty_right' }).stroke.weight;
    const w5 = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'completely_right' }).stroke.weight;
    expect(w1).toBeLessThanOrEqual(w2);
    expect(w2).toBeLessThanOrEqual(w3);
    expect(w3).toBeLessThanOrEqual(w4);
    expect(w4).toBeLessThanOrEqual(w5);
  });

  it('weak bands favour dashed / dotted strokes, strong bands favour solid / double', () => {
    const weak = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'pretty_wrong' });
    const strong = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'completely_right' });
    expect(['dashed', 'dotted']).toContain(weak.stroke.style);
    expect(['solid', 'double']).toContain(strong.stroke.style);
  });
});

// ── Evidence + source-chain markers ──────────────────────────────

describe('VG-001 evidence + source-chain pressure markers', () => {
  it('evidence-backed input produces an evidence marker; default is none', () => {
    const plain = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'neutral' });
    const evidenced = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'neutral', hasEvidence: true });
    expect(plain.evidenceMarker).toBe('none');
    expect(evidenced.evidenceMarker).not.toBe('none');
  });

  it('source-chain pressure produces its own marker; default is none', () => {
    const plain = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'neutral' });
    const pressured = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'neutral', sourceChainPressure: true });
    expect(plain.sourceChainPressureMarker).toBe('none');
    expect(pressured.sourceChainPressureMarker).not.toBe('none');
  });

  it('evidence and source-chain pressure markers are independent (can co-occur)', () => {
    const both = buildArgumentNodeVisualToken({
      argumentType: 'claim',
      standingBand: 'neutral',
      hasEvidence: true,
      sourceChainPressure: true,
    });
    expect(both.evidenceMarker).not.toBe('none');
    expect(both.sourceChainPressureMarker).not.toBe('none');
  });
});

// ── Accessibility labels ─────────────────────────────────────────

describe('VG-001 accessibility labels', () => {
  it('combines plain-language kind + soft band label', () => {
    const t = buildArgumentNodeVisualToken({ argumentType: 'claim', standingBand: 'completely_right' });
    expect(t.accessibilityLabel).toBe('Claim · Strongly supported');
  });

  it('uses Concession or synthesis for the concede kind', () => {
    const t = buildArgumentNodeVisualToken({ argumentType: 'concede', standingBand: 'neutral' });
    expect(t.accessibilityLabel).toBe('Concession or synthesis · Neutral');
  });

  it('never contains snake_case internal codes', () => {
    for (const k of KINDS) {
      for (const b of BANDS) {
        const t = buildArgumentNodeVisualToken({ argumentType: k, standingBand: b });
        expect(t.accessibilityLabel).not.toMatch(/[a-z]_[a-z]/);
      }
    }
  });
});

// ── Ban-list ─────────────────────────────────────────────────────

describe('VG-001 ban-list — no truth/winner/loser copy in any token field', () => {
  function wordBoundary(t: string): RegExp {
    return new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i');
  }

  it('FORBIDDEN_TOKEN_TOKENS is re-exported from designTokens', () => {
    expect(FORBIDDEN_TOKEN_TOKENS).toContain('winner');
    expect(FORBIDDEN_TOKEN_TOKENS).toContain('loser');
    expect(FORBIDDEN_TOKEN_TOKENS).toContain('truth');
    expect(FORBIDDEN_TOKEN_TOKENS).toContain('liar');
  });

  it('no accessibility label contains a forbidden word', () => {
    for (const k of KINDS) {
      for (const b of BANDS) {
        const t = buildArgumentNodeVisualToken({ argumentType: k, standingBand: b });
        for (const banned of FORBIDDEN_TOKEN_TOKENS) {
          expect(t.accessibilityLabel).not.toMatch(wordBoundary(banned));
        }
      }
    }
  });

  it('no string-valued token field contains a forbidden word', () => {
    for (const k of KINDS) {
      for (const b of BANDS) {
        const t = buildArgumentNodeVisualToken({ argumentType: k, standingBand: b });
        const strings = [t.shape, t.stroke.style, t.texture, t.shapeGlyph, t.evidenceMarker, t.sourceChainPressureMarker];
        for (const s of strings) {
          for (const banned of FORBIDDEN_TOKEN_TOKENS) {
            expect(s).not.toMatch(wordBoundary(banned));
          }
        }
      }
    }
  });
});
