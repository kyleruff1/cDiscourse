/**
 * BR-004 — branchGrammarRenderContract pure-model tests.
 *
 * No React, no Supabase, no network. Covers:
 *   - buildBranchDirectionVisual token coverage for all four directions.
 *   - evidence_passthrough returns 'inherit' for every render token.
 *   - Color-independence: the three non-evidence directions are pairwise
 *     distinguishable by (positionToken, shapeToken, strokeToken) alone.
 *   - subordinateUntilSelected is true only for chime_in_vertical.
 *   - No token value falls outside the closed VG-001/VG-002 vocabulary.
 */
import {
  ALL_BRANCH_POSITION_TOKENS,
  ALL_BRANCH_SHAPE_TOKENS,
  ALL_BRANCH_STROKE_TOKENS,
  buildBranchDirectionVisual,
} from '../src/features/arguments/branchGrammarRenderContract';
import { ALL_BRANCH_DIRECTIONS } from '../src/features/arguments/branchGrammarModel';

describe('buildBranchDirectionVisual — token coverage', () => {
  it('returns a visual for every BranchDirection', () => {
    for (const direction of ALL_BRANCH_DIRECTIONS) {
      const v = buildBranchDirectionVisual(direction);
      expect(v.direction).toBe(direction);
    }
  });

  it('mainline → horizontal + spine + solid_prominent, not subordinate', () => {
    const v = buildBranchDirectionVisual('mainline');
    expect(v.positionToken).toBe('horizontal');
    expect(v.shapeToken).toBe('spine');
    expect(v.strokeToken).toBe('solid_prominent');
    expect(v.subordinateUntilSelected).toBe(false);
  });

  it('chime_in_vertical → vertical_offset + bracket + solid_subordinate, subordinate', () => {
    const v = buildBranchDirectionVisual('chime_in_vertical');
    expect(v.positionToken).toBe('vertical_offset');
    expect(v.shapeToken).toBe('bracket');
    expect(v.strokeToken).toBe('solid_subordinate');
    expect(v.subordinateUntilSelected).toBe(true);
  });

  it('tangent_diagonal → diagonal_kink + kink + dashed, not subordinate', () => {
    const v = buildBranchDirectionVisual('tangent_diagonal');
    expect(v.positionToken).toBe('diagonal_kink');
    expect(v.shapeToken).toBe('kink');
    expect(v.strokeToken).toBe('dashed');
    expect(v.subordinateUntilSelected).toBe(false);
  });
});

describe('buildBranchDirectionVisual — evidence pass-through', () => {
  it('returns inherit for every render token', () => {
    const v = buildBranchDirectionVisual('evidence_passthrough');
    expect(v.positionToken).toBe('inherit');
    expect(v.shapeToken).toBe('inherit');
    expect(v.strokeToken).toBe('inherit');
  });

  it('is never subordinate (BR-004 yields entirely)', () => {
    expect(buildBranchDirectionVisual('evidence_passthrough').subordinateUntilSelected).toBe(
      false,
    );
  });
});

describe('buildBranchDirectionVisual — color independence', () => {
  it('the three non-evidence directions have pairwise-unique (position, shape, stroke) triples', () => {
    const triples = (['mainline', 'chime_in_vertical', 'tangent_diagonal'] as const).map(
      (d) => {
        const v = buildBranchDirectionVisual(d);
        return `${v.positionToken}|${v.shapeToken}|${v.strokeToken}`;
      },
    );
    expect(new Set(triples).size).toBe(3);
  });

  it('no two non-evidence directions share a position token', () => {
    const positions = (['mainline', 'chime_in_vertical', 'tangent_diagonal'] as const).map(
      (d) => buildBranchDirectionVisual(d).positionToken,
    );
    expect(new Set(positions).size).toBe(3);
  });

  it('no two non-evidence directions share a shape token', () => {
    const shapes = (['mainline', 'chime_in_vertical', 'tangent_diagonal'] as const).map(
      (d) => buildBranchDirectionVisual(d).shapeToken,
    );
    expect(new Set(shapes).size).toBe(3);
  });

  it('no two non-evidence directions share a stroke token', () => {
    const strokes = (['mainline', 'chime_in_vertical', 'tangent_diagonal'] as const).map(
      (d) => buildBranchDirectionVisual(d).strokeToken,
    );
    expect(new Set(strokes).size).toBe(3);
  });
});

describe('buildBranchDirectionVisual — closed token vocabulary', () => {
  it('every produced positionToken is a member of ALL_BRANCH_POSITION_TOKENS', () => {
    for (const d of ALL_BRANCH_DIRECTIONS) {
      expect(ALL_BRANCH_POSITION_TOKENS).toContain(
        buildBranchDirectionVisual(d).positionToken,
      );
    }
  });

  it('every produced shapeToken is a member of ALL_BRANCH_SHAPE_TOKENS', () => {
    for (const d of ALL_BRANCH_DIRECTIONS) {
      expect(ALL_BRANCH_SHAPE_TOKENS).toContain(buildBranchDirectionVisual(d).shapeToken);
    }
  });

  it('every produced strokeToken is a member of ALL_BRANCH_STROKE_TOKENS', () => {
    for (const d of ALL_BRANCH_DIRECTIONS) {
      expect(ALL_BRANCH_STROKE_TOKENS).toContain(
        buildBranchDirectionVisual(d).strokeToken,
      );
    }
  });

  it('subordinateUntilSelected is true only for chime_in_vertical', () => {
    for (const d of ALL_BRANCH_DIRECTIONS) {
      const subordinate = buildBranchDirectionVisual(d).subordinateUntilSelected;
      expect(subordinate).toBe(d === 'chime_in_vertical');
    }
  });

  it('is deterministic — same direction yields an equal visual', () => {
    for (const d of ALL_BRANCH_DIRECTIONS) {
      expect(buildBranchDirectionVisual(d)).toEqual(buildBranchDirectionVisual(d));
    }
  });
});
