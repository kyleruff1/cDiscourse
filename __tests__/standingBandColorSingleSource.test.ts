/**
 * UX-PR-F — standing-band color-map single-source guard.
 *
 * The 9-band STANDING_BAND_COLOR ramp used to be maintained in three
 * hand-kept places (the canonical export in argumentGameSurfaceModel.ts,
 * a byte-identical module-local const in argumentScoreModel.ts, and a
 * four-arm inline hex ternary in the ArgumentScoreTracker.tsx sparkline).
 * PR-F collapses them to ONE canonical export referenced by all three.
 * This suite is the divergence backstop:
 *
 *   (a) object identity — the scoreModel re-export IS the canonical object,
 *       so a future edit to one is an edit to all;
 *   (b) routing — standingBandColor() resolves the canonical for all 9 bands;
 *   (c) tracker static source scan — the sparkline imports the symbol,
 *       references the four canonical keys, and no longer holds any of the
 *       four removed hex literals (the unrelated muted-text #64748b stays);
 *   (d) VALUE PIN — the canonical ramp is the re-ramped 9 hexes applied under
 *       the operator doctrine ruling (issue 931): hue now encodes standing
 *       MAGNITUDE in one indigo family, not valence. PR-F-prime (P1-7b) landed
 *       this ramp; the 3 slate keys stay unchanged.
 *
 * Pure-model + static source scan. No React, no Supabase, no network, no
 * snapshot. Per cdiscourse-doctrine the bands are gameplay-analysis, never
 * truth verdicts; PR-F-prime changes only hue values, no labels or
 * user-facing strings.
 */
import * as fs from 'fs';
import * as path from 'path';
import { STANDING_BAND_COLOR as CANON } from '../src/features/arguments/argumentGameSurfaceModel';
import {
  STANDING_BAND_COLOR as VIA_SCORE,
  standingBandColor,
} from '../src/features/arguments/argumentScoreModel';

describe('UX-PR-F — STANDING_BAND_COLOR single source', () => {
  it('(a) the scoreModel re-export is the same object as the canonical', () => {
    // A re-export preserves the binding, so both names point at ONE map.
    // If a future author copies the map back into scoreModel, this fails.
    expect(VIA_SCORE).toBe(CANON);
  });

  it('(b) standingBandColor() routes every band through the canonical', () => {
    const bands = Object.keys(CANON) as Array<keyof typeof CANON>;
    expect(bands.length).toBe(9);
    for (const band of bands) {
      expect(standingBandColor(band)).toBe(CANON[band]);
    }
  });
});

describe('UX-PR-F — ArgumentScoreTracker sparkline consumes the canonical', () => {
  const trackerSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/arguments/ArgumentScoreTracker.tsx'),
    'utf8',
  );

  it('(c1) imports the STANDING_BAND_COLOR symbol', () => {
    expect(trackerSrc).toContain('STANDING_BAND_COLOR');
  });

  it('(c2) references the four canonical sparkline keys', () => {
    for (const key of ['completely_right', 'slightly_right', 'slightly_wrong', 'pretty_wrong']) {
      expect(trackerSrc).toContain(`STANDING_BAND_COLOR.${key}`);
    }
  });

  it('(c3) no longer holds any of the four removed sparkline hex literals', () => {
    // Negative scan targets ONLY the four removed sparkline hexes. Do NOT
    // add #64748b — it stays as the unrelated muted-text style color for
    // the count/note styles, which is not part of the dedupe.
    for (const hex of ['#10b981', '#22d3ee', '#f97316', '#b91c1c']) {
      expect(trackerSrc).not.toContain(hex);
    }
  });
});

describe('UX-PR-F-prime — VALUE PIN (the applied re-ramp)', () => {
  it('the canonical ramp is the re-ramped 9 hexes applied under the operator ruling (issue 931)', () => {
    expect(CANON).toEqual({
      pretty_wrong: '#6366f1',
      slightly_wrong: '#818cf8',
      neutral: '#64748b',
      slightly_right: '#818cf8',
      maybe_right_misguided: '#6366f1',
      pretty_right: '#6366f1',
      completely_right: '#4f46e5',
      unscored: '#475569',
      not_enough_signal: '#374151',
    });
  });
});
