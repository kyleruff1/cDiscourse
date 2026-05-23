/**
 * QOL-041 — AcceptanceGradientControl tests.
 *
 * Pure-helper / source-scan discipline (mirrors
 * `BranchCollapseStub.test.tsx`). The selection logic is exercised
 * through the pure `acceptanceGradient` model; the component contract
 * (5 rendered segments, radio group role, color-independent selection
 * marker, 44dp targets, screen-reader labels) is source-scanned.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_ACCEPTANCE_LEVELS,
  ACCEPTANCE_LEVEL_COPY,
  _forbiddenAcceptanceGradientTokens,
} from '../src/features/concessions/acceptanceGradient';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const repoRoot = process.cwd();
const componentSrc = fs.readFileSync(
  path.join(
    repoRoot,
    'src/features/arguments/oneBox/schemas/AcceptanceGradientControl.tsx',
  ),
  'utf8',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ── Label copy ────────────────────────────────────────────────

describe('AcceptanceGradientControl — segment labels', () => {
  it('every level has a non-empty label rendered by the component', () => {
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(ACCEPTANCE_LEVEL_COPY[level].label.length).toBeGreaterThan(0);
    }
  });

  it('no segment label contains a verdict / amplification / game token', () => {
    const banned = _forbiddenAcceptanceGradientTokens();
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      const label = ACCEPTANCE_LEVEL_COPY[level].label.toLowerCase();
      for (const t of banned) {
        expect({ level, hit: label.includes(t) ? t : null }).toEqual({
          level,
          hit: null,
        });
      }
    }
  });

  it('no segment label looks like an internal code (no snake_case leak)', () => {
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(looksLikeInternalCode(ACCEPTANCE_LEVEL_COPY[level].label)).toBe(false);
    }
  });
});

// ── Source contract ───────────────────────────────────────────

describe('AcceptanceGradientControl — source contract', () => {
  const code = stripComments(componentSrc);

  it('iterates ALL_ACCEPTANCE_LEVELS to render one segment per level', () => {
    // Maps over the frozen array so adding a level is a vocabulary
    // change, not a component change.
    expect(code).toMatch(/ALL_ACCEPTANCE_LEVELS\.map/);
  });

  it('uses Pressable with accessibilityRole="radio" for each segment', () => {
    expect(code).toMatch(/accessibilityRole=['"]radio['"]/);
    expect(code).toMatch(/accessibilityRole=['"]radiogroup['"]/);
  });

  it('passes accessibilityState={{ selected, disabled }} per segment', () => {
    expect(code).toMatch(/accessibilityState=\{\s*\{\s*selected/);
  });

  it('renders a "✓ " prefix on the SELECTED segment (color-independent marker)', () => {
    // The check mark is the non-color selection marker.
    expect(code).toMatch(/✓ /);
    expect(code).toMatch(/segmentCheck/);
  });

  it('segment minimum height is >= 44dp (a11y-targets minimum tap target)', () => {
    expect(code).toMatch(/SEGMENT_MIN_HEIGHT = 44/);
    expect(code).toMatch(/minHeight: SEGMENT_MIN_HEIGHT/);
  });

  it('every segment carries a TEXT label (not color-only)', () => {
    expect(code).toMatch(/copy\.label/);
  });

  it('screen-reader label includes both the level label AND the helper line', () => {
    // The a11y composition is "Selected. <label>. <helper>." OR
    // "<label>. <helper>." — the receiver hears both before tapping.
    expect(code).toMatch(/\$\{copy\.label\}\. \$\{copy\.helper\}/);
  });

  it('NO LayoutAnimation / no transition — selection is INSTANT (reduce-motion respected by default)', () => {
    expect(code).not.toMatch(/LayoutAnimation/);
    expect(code).not.toMatch(/Animated\./);
  });

  it('imports no Supabase / network / AI primitive', () => {
    expect(code).not.toMatch(/from\s+['"][^'"]*supabase/);
    expect(code).not.toMatch(/anthropic/i);
    expect(code).not.toMatch(/openai/i);
    expect(code).not.toMatch(/\bfetch\(/);
  });
});
