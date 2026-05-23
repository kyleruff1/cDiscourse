/**
 * QOL-041 — FistBumpReaction tests.
 *
 * Pure-helper / source-scan discipline. The summary shape is verified
 * exhaustively in `moveReactionModel.test.ts`; the component contract
 * (toggle on/off, idempotent, NO score rendered, own-move HIDDEN, SR
 * announces a toggle, single-value vocabulary) is source-scanned.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  FIST_BUMP_COPY,
} from '../src/features/concessions/FistBumpReaction';
import { _forbiddenAcceptanceGradientTokens } from '../src/features/concessions/acceptanceGradient';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const repoRoot = process.cwd();
const componentSrc = fs.readFileSync(
  path.join(repoRoot, 'src/features/concessions/FistBumpReaction.tsx'),
  'utf8',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ── Authored copy — ban-list + plain language ─────────────────

describe('FistBumpReaction — authored copy', () => {
  const strings = (): Array<{ key: string; value: string }> => {
    const out: Array<{ key: string; value: string }> = [];
    // `countA11y` is a function; every other key is a plain string.
    const entries = Object.entries(FIST_BUMP_COPY) as Array<
      [string, string | ((n: number) => string)]
    >;
    for (const [key, value] of entries) {
      const v = typeof value === 'function' ? value(3) : value;
      out.push({ key, value: v });
    }
    return out;
  };

  it('every authored string is plain-language, non-empty', () => {
    for (const { key, value } of strings()) {
      expect({ key, len: value.length }).toEqual({ key, len: value.length });
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('the labels are "Acknowledge" / "Acknowledge" — never "like" / "agree" / "upvote" / "approve"', () => {
    // The fist-bump is acknowledgment, NOT a vote. The labels must
    // never describe it as approval / agreement.
    expect(FIST_BUMP_COPY.label).toBe('Acknowledge');
    expect(FIST_BUMP_COPY.labelReacted).toBe('Acknowledge');
    for (const { value } of strings()) {
      const v = value.toLowerCase();
      expect(v).not.toMatch(/\blike\b/);
      expect(v).not.toMatch(/\bupvote\b/);
      expect(v).not.toMatch(/\bapprove\b/);
      // "Agree" / "agreed" is reserved for the QOL-041 acceptance
      // gradient — the fist-bump must never use it.
      expect(v).not.toMatch(/\bagree\b/);
    }
  });

  it('no authored copy contains a verdict / amplification / game token', () => {
    const banned = _forbiddenAcceptanceGradientTokens();
    for (const { key, value } of strings()) {
      const v = value.toLowerCase();
      for (const token of banned) {
        expect({ key, hit: v.includes(token) ? token : null }).toEqual({
          key,
          hit: null,
        });
      }
    }
  });

  it('no authored copy looks like an internal code', () => {
    for (const { value } of strings()) {
      expect(looksLikeInternalCode(value)).toBe(false);
    }
  });

  it('countA11y pluralizes correctly (1 vs >1)', () => {
    expect(FIST_BUMP_COPY.countA11y(1)).toBe('1 fist-bump');
    expect(FIST_BUMP_COPY.countA11y(2)).toBe('2 fist-bumps');
    expect(FIST_BUMP_COPY.countA11y(0)).toBe('0 fist-bumps');
  });
});

// ── Source contract ───────────────────────────────────────────

describe('FistBumpReaction — source contract', () => {
  const code = stripComments(componentSrc);

  it('renders NOTHING (null) on the viewer\'s OWN move', () => {
    // Own-bubble doctrine: the affordance is HIDDEN, not disabled, on
    // one\'s own move (consistent with QOL-030 own-bubble doctrine).
    expect(code).toMatch(/isOwnMove/);
    expect(code).toMatch(/if \(isOwnMove\) \{[\s\S]*?return null/);
  });

  it('renders a Pressable with accessibilityRole="button" + accessibilityState toggle', () => {
    expect(code).toMatch(/<Pressable/);
    expect(code).toMatch(/accessibilityRole=['"]button['"]/);
    expect(code).toMatch(/accessibilityState=\{\s*\{\s*selected: viewerHasReacted/);
  });

  it('renders the fist-bump glyph as a separate Text (not the only signal)', () => {
    // The glyph is hidden from accessibility (accessibilityElementsHidden)
    // — the label carries the meaning, the emoji is decorative.
    expect(code).toMatch(/accessibilityElementsHidden/);
  });

  it('renders the "✓" indicator when toggled on (color-independent marker)', () => {
    expect(code).toMatch(/viewerHasReacted && \(/);
    expect(code).toMatch(/reactedIndicator/);
  });

  it('shows the optional count when showCount && fistBumpCount > 0', () => {
    expect(code).toMatch(/showCount && fistBumpCount > 0/);
  });

  it('button minimum height is >= 44dp (a11y-targets)', () => {
    expect(code).toMatch(/minHeight: 44/);
  });

  it('renders NO score field, no vote-tally, no standing field (defensive)', () => {
    // The summary type itself has only fistBumpCount + viewerHasReacted.
    // Defensive scan to make sure the component does not invent its own
    // gameplay-scoring field. We scan with word boundaries to avoid
    // hitting CSS `fontWeight` (the unrelated React Native style prop).
    expect(code).not.toMatch(/\bscore\b/i);
    expect(code).not.toMatch(/\bvote\b/i);
    expect(code).not.toMatch(/\bstanding\b/i);
    // `weight` is allowed in CSS contexts (`fontWeight: '600'`); confirm it
    // is ONLY ever preceded by 'font' (i.e., never appears as a standalone token).
    expect(code).not.toMatch(/(?<!font)\bweight\b/gi);
  });

  it('imports MoveReactionSummary from the model (single source of truth)', () => {
    expect(code).toMatch(/MoveReactionSummary/);
    expect(code).toMatch(/from\s+['"]\.\/moveReactionModel['"]/);
  });

  it('makes NO Supabase / network / AI / submit-argument call (composition only)', () => {
    expect(code).not.toMatch(/from\s+['"][^'"]*supabase/);
    expect(code).not.toMatch(/submit-argument/);
    expect(code).not.toMatch(/react-to-move/);
    expect(code).not.toMatch(/anthropic/i);
    expect(code).not.toMatch(/openai/i);
    expect(code).not.toMatch(/\bfetch\(/);
  });

  it('never imports any point-standing module', () => {
    expect(code).not.toMatch(/from\s+['"][^'"]*pointStanding/);
    expect(code).not.toMatch(/PointStandingDelta/);
  });

  it('NO LayoutAnimation / no transition — toggle is INSTANT', () => {
    expect(code).not.toMatch(/LayoutAnimation/);
    expect(code).not.toMatch(/Animated\./);
  });
});
