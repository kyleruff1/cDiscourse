/**
 * UX-P2-4 (issue 937) — kind/tone palette consolidation.
 *
 * Pure-TS. No React, no Supabase, no network. Verifies:
 *   - Part (a): the kind palette folded into designTokens.TIMELINE_KIND is a
 *     byte-identical relocation, and argumentGameSurfaceModel re-exports the
 *     SAME object under the historical name TIMELINE_KIND_COLORS.
 *   - Part (b): the tone palette collapses to ONE canonical source
 *     designTokens.TIMELINE_TONE (Option C, operator ruled), reached by
 *     reference from all three former copies. The hex values are pinned here
 *     ONCE for the whole suite; every other test asserts by reference so a
 *     retune flows through automatically.
 *   - Part (c): the legacy counter lane is re-hued to challenge orange in both
 *     TRACK_COLORS and TRACK_ACCENT, the other five keys stay byte-identical,
 *     and the two maps remain deep-equal (the intentional duplicate is pinned).
 *   - Doctrine: the Option C tone ramp carries temperature, never a verdict -
 *     no crimson pole, no green pole, and a monotonic (grayscale-legible) ramp.
 *
 * The red / hue classifiers are re-implemented locally (no import from src) so a
 * production refactor cannot silently disarm the doctrine assertions - the same
 * convention cohesionPrinciple9Guard uses.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  TIMELINE_KIND,
  TIMELINE_TONE,
  TOKENS,
} from '../src/lib/designTokens';
import { TIMELINE_KIND_COLORS } from '../src/features/arguments/argumentGameSurfaceModel';
import { TONE_BAND_HEX } from '../src/features/arguments/railSegmentModel';
import {
  deriveTimelineNodeVisualStyle,
  type DeriveTimelineNodeVisualInput,
} from '../src/features/arguments/timelineNodeVisualModel';
import type {
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';

const REPO = process.cwd();
const HEX_6 = /^#[0-9a-f]{6}$/i;
const TONE_BANDS: TimelineToneBand[] = ['calm', 'measured', 'heated', 'hostile', 'unknown'];

// ── Local color helpers (self-contained; no import from src) ─────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function hueDeg(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let H = 0;
  if (d !== 0) {
    if (max === r) H = 60 * (((g - b) / d) % 6);
    else if (max === g) H = 60 * ((b - r) / d + 2);
    else H = 60 * ((r - g) / d + 4);
  }
  if (H < 0) H += 360;
  return H;
}

// Mirrors cohesionPrinciple9Guard.isRedFamily: crimson red only.
function isRedFamily(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const H = hueDeg(hex);
  const sat = max === 0 ? 0 : d / max;
  const nearRed = H <= 12 || H >= 348;
  return nearRed && sat >= 0.15 && max >= 80;
}

// Perceived luminance (Rec.601). The grayscale ramp a colorblind user sees.
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Extract a flat `{ key: '#hex' }` object literal by declaration name from a
// source file, scoped to its own braces so unrelated StyleSheet hex are ignored.
function extractHexMap(source: string, declName: string): Record<string, string> {
  const start = source.indexOf(`const ${declName}`);
  if (start < 0) throw new Error(`decl ${declName} not found`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('};', open);
  const body = source.slice(open + 1, close);
  const out: Record<string, string> = {};
  const re = /(\w+)\s*:\s*'(#[0-9a-fA-F]{3,8})'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out[m[1]] = m[2].toLowerCase();
  return out;
}

function toneInput(toneBand: TimelineToneBand): DeriveTimelineNodeVisualInput {
  return {
    isActive: false,
    isActivePath: true,
    isSelected: false,
    toneBand,
    temperatureBand: 'warm',
    hasEvidenceArtifact: false,
    prefersReducedMotion: false,
  };
}

// ── Part (a) — kind palette fold ────────────────────────────────

describe('UX-P2-4 part (a) — TIMELINE_KIND canonical kind palette', () => {
  it('has exactly the 7 kind-family keys', () => {
    expect(Object.keys(TIMELINE_KIND).sort()).toEqual([
      'challenge',
      'claim',
      'clarify',
      'concede',
      'default',
      'evidence',
      'flag',
    ]);
  });

  // The no-re-hue proof: every value is the byte-identical former hex.
  it('values are byte-identical to the pre-card map', () => {
    expect(TIMELINE_KIND.claim).toBe('#6366f1');
    expect(TIMELINE_KIND.challenge).toBe('#f97316');
    expect(TIMELINE_KIND.evidence).toBe('#06b6d4');
    expect(TIMELINE_KIND.clarify).toBe('#f59e0b');
    expect(TIMELINE_KIND.concede).toBe('#a855f7');
    expect(TIMELINE_KIND.flag).toBe('#ef4444');
    expect(TIMELINE_KIND.default).toBe('#475569');
  });

  it('every value is a valid 6-digit hex', () => {
    for (const v of Object.values(TIMELINE_KIND)) expect(v).toMatch(HEX_6);
  });

  it('argumentGameSurfaceModel re-exports the SAME object (one source, not two)', () => {
    expect(TIMELINE_KIND_COLORS).toBe(TIMELINE_KIND);
  });

  it('TOKENS.timelineKind is the same object (aggregate reachability)', () => {
    expect(TOKENS.timelineKind).toBe(TIMELINE_KIND);
  });
});

// ── Part (b) — tone palette single source (Option C) ────────────

describe('UX-P2-4 part (b) — TIMELINE_TONE canonical tone palette (Option C)', () => {
  it('has exactly the 5 tone-band keys', () => {
    expect(Object.keys(TIMELINE_TONE).sort()).toEqual([
      'calm',
      'heated',
      'hostile',
      'measured',
      'unknown',
    ]);
  });

  // The single literal pin for tone in the whole suite.
  it('values are exactly the operator-ruled Option C ramp', () => {
    expect(TIMELINE_TONE.calm).toBe('#22d3ee');
    expect(TIMELINE_TONE.measured).toBe('#818cf8');
    expect(TIMELINE_TONE.heated).toBe('#f97316');
    expect(TIMELINE_TONE.hostile).toBe('#9a3412');
    expect(TIMELINE_TONE.unknown).toBe('#94a3b8');
  });

  it('every value is a valid 6-digit hex', () => {
    for (const v of Object.values(TIMELINE_TONE)) expect(v).toMatch(HEX_6);
  });

  it('TOKENS.timelineTone is the same object (aggregate reachability)', () => {
    expect(TOKENS.timelineTone).toBe(TIMELINE_TONE);
  });

  // Import-equality replacing the two former byte-pins: one object, three consumers.
  it('railSegmentModel.TONE_BAND_HEX is the SAME object', () => {
    expect(TONE_BAND_HEX).toBe(TIMELINE_TONE);
  });

  it('the node tint hue resolves to TIMELINE_TONE for every band', () => {
    for (const band of TONE_BANDS) {
      const v = deriveTimelineNodeVisualStyle(toneInput(band));
      expect(v.toneTint).not.toBeNull();
      expect(v.toneTint!.color).toBe(TIMELINE_TONE[band]);
    }
  });
});

// ── Part (b) doctrine — the ramp carries temperature, not a verdict ──

describe('UX-P2-4 part (b) doctrine — no verdict-adjacent poles (Option C)', () => {
  it('no TIMELINE_TONE value is crimson red-family (removes the #9 hostile misuse)', () => {
    for (const [band, hex] of Object.entries(TIMELINE_TONE)) {
      expect(`${band}:${isRedFamily(hex)}`).toBe(`${band}:false`);
    }
  });

  it('the calm pole is cyan, not green (deliberate; removes the good/bad reading)', () => {
    // Green hue band is ~90-165deg; calm #22d3ee sits in cyan (~188deg).
    const h = hueDeg(TIMELINE_TONE.calm);
    expect(h).toBeGreaterThan(165);
    expect(h).toBeLessThan(210);
  });

  it('cool half (calm/measured) is blue-dominant; warm half (heated/hostile) is red-dominant', () => {
    for (const cool of ['calm', 'measured'] as const) {
      const { r, b } = hexToRgb(TIMELINE_TONE[cool]);
      expect(b).toBeGreaterThan(r);
    }
    for (const warm of ['heated', 'hostile'] as const) {
      const { r, b } = hexToRgb(TIMELINE_TONE[warm]);
      expect(r).toBeGreaterThan(b);
    }
  });

  it('is a monotonic luminance ramp calm > measured > heated > hostile (grayscale-legible)', () => {
    const ramp: TimelineToneBand[] = ['calm', 'measured', 'heated', 'hostile'];
    for (let i = 1; i < ramp.length; i += 1) {
      expect(luminance(TIMELINE_TONE[ramp[i - 1]])).toBeGreaterThan(
        luminance(TIMELINE_TONE[ramp[i]]),
      );
    }
  });
});

// ── Part (c) — legacy counter re-hue ────────────────────────────

describe('UX-P2-4 part (c) — legacy track counter re-hued to challenge orange', () => {
  const nodeSrc = readFileSync(
    join(REPO, 'src/features/arguments/ArgumentTimelineNode.tsx'),
    'utf8',
  );
  const trackSrc = readFileSync(
    join(REPO, 'src/features/arguments/ArgumentTrack.tsx'),
    'utf8',
  );
  const trackColors = extractHexMap(nodeSrc, 'TRACK_COLORS');
  const trackAccent = extractHexMap(trackSrc, 'TRACK_ACCENT');

  it('counter is challenge orange in both maps', () => {
    expect(trackColors.counter).toBe('#f97316');
    expect(trackAccent.counter).toBe('#f97316');
    expect(trackColors.counter).toBe(TIMELINE_KIND.challenge);
    expect(trackAccent.counter).toBe(TIMELINE_KIND.challenge);
  });

  it('the other five keys stay byte-identical in both maps', () => {
    const expectedRest = {
      core: '#6366f1',
      receipts: '#10b981',
      clarification: '#f59e0b',
      concession: '#8b5cf6',
      tangent: '#6b7280',
    };
    for (const [k, v] of Object.entries(expectedRest)) {
      expect(trackColors[k]).toBe(v);
      expect(trackAccent[k]).toBe(v);
    }
  });

  it('the two maps remain deep-equal (the intentional duplicate is pinned)', () => {
    expect(trackColors).toEqual(trackAccent);
  });

  it('neither map still carries the retired counter red', () => {
    expect(Object.values(trackColors)).not.toContain('#ef4444');
    expect(Object.values(trackAccent)).not.toContain('#ef4444');
  });
});
