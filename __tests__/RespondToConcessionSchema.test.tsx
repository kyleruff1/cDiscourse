/**
 * QOL-041 — RespondToConcessionSchema tests.
 *
 * Pure-helper / source-scan discipline. The schema's postability logic
 * is driven by the pure `respondToConcessionModel` (exercised
 * exhaustively in `respondToConcessionModel.test.ts`). The component
 * contract (one row per incoming item, conditional clarification
 * appears, visible disabled reason, no silent disabled Post, ban-list)
 * is source-scanned.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  RESPOND_TO_CONCESSION_SCHEMA_COPY,
} from '../src/features/arguments/oneBox/schemas/RespondToConcessionSchema';
import { _forbiddenAcceptanceGradientTokens } from '../src/features/concessions/acceptanceGradient';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const repoRoot = process.cwd();
const schemaSrc = fs.readFileSync(
  path.join(
    repoRoot,
    'src/features/arguments/oneBox/schemas/RespondToConcessionSchema.tsx',
  ),
  'utf8',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ── Authored copy — ban-list + plain language ─────────────────

describe('RespondToConcessionSchema — authored copy', () => {
  // `introTemplate` is a function — call it with a representative
  // count; every other key is a plain string.
  const entries = Object.entries(RESPOND_TO_CONCESSION_SCHEMA_COPY) as Array<
    [string, string | ((n: number) => string)]
  >;

  it('every authored string is plain-language, non-empty', () => {
    for (const [key, value] of entries) {
      const v = typeof value === 'function' ? value(1) : value;
      expect({ key, len: v.length }).toEqual({ key, len: v.length });
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it('no authored copy contains a verdict / amplification / game token', () => {
    const banned = _forbiddenAcceptanceGradientTokens();
    for (const [key, value] of entries) {
      const v = (typeof value === 'function' ? value(1) : value).toLowerCase();
      for (const token of banned) {
        expect({ key, hit: v.includes(token) ? token : null }).toEqual({
          key,
          hit: null,
        });
      }
    }
  });

  it('no authored copy looks like an internal code', () => {
    for (const [, value] of entries) {
      const v = typeof value === 'function' ? value(1) : value;
      expect(looksLikeInternalCode(v)).toBe(false);
    }
  });

  it('the intro singularizes correctly for 1 vs >1 items', () => {
    expect(RESPOND_TO_CONCESSION_SCHEMA_COPY.introTemplate(1)).toMatch(/One conceded point/);
    expect(RESPOND_TO_CONCESSION_SCHEMA_COPY.introTemplate(2)).toMatch(/^2 conceded points/);
    expect(RESPOND_TO_CONCESSION_SCHEMA_COPY.introTemplate(5)).toMatch(/^5 conceded points/);
  });

  it('the pick-level prompt is plain-language', () => {
    expect(RESPOND_TO_CONCESSION_SCHEMA_COPY.pickLevelPrompt).toBe('Pick how you see this point.');
  });
});

// ── Source contract ───────────────────────────────────────────

describe('RespondToConcessionSchema — source contract', () => {
  const code = stripComments(schemaSrc);

  it('mirrors EVERY incoming item to a row via draft.rows.map', () => {
    expect(code).toMatch(/draft\.rows\.map/);
  });

  it('renders the AcceptanceGradientControl on every row', () => {
    expect(code).toMatch(/<AcceptanceGradientControl/);
  });

  it('conditionally renders the clarification field for non-`agree` levels only', () => {
    // The `needsClarification` flag drives the conditional render.
    expect(code).toMatch(/needsClarification/);
    expect(code).toMatch(/acceptanceRequiresClarification/);
    // The clarification field is wrapped in a JSX conditional.
    expect(code).toMatch(/needsClarification && \(/);
  });

  it('Post button is disabled when isPostable returns false', () => {
    expect(code).toMatch(/isPostable\(draft\)/);
    expect(code).toMatch(/postDisabled/);
  });

  it('shows the postability firstDisabledReason as a VISIBLE inline message', () => {
    // Never silent — a disabled Post always carries a reason.
    expect(code).toMatch(/disabledReason/);
    expect(code).toMatch(/firstDisabledReason/);
    expect(code).toMatch(/accessibilityLiveRegion=['"]polite['"]/);
  });

  it('the Post button has accessibilityRole="button"', () => {
    expect(code).toMatch(/accessibilityRole=['"]button['"]/);
  });

  it('the Post button accessibilityLabel includes the disabled reason when disabled', () => {
    expect(code).toMatch(
      /postDisabled && disabledReason\s*\n?\s*\?\s*`[^`]*Disabled\.\s*\$\{disabledReason\}/,
    );
  });

  it('builds the acceptances payload via buildConcessionAcceptancesPayload', () => {
    expect(code).toMatch(/buildConcessionAcceptancesPayload/);
  });

  it('Post button minimum height is >= 44dp', () => {
    expect(code).toMatch(/minHeight: 44/);
  });

  it('imports no Supabase / submit-argument primitive (composition only)', () => {
    expect(code).not.toMatch(/from\s+['"][^'"]*supabase/);
    expect(code).not.toMatch(/submit-argument/);
  });

  it('makes NO AI / network call', () => {
    expect(code).not.toMatch(/anthropic/i);
    expect(code).not.toMatch(/api\.x\.ai/i);
    expect(code).not.toMatch(/openai/i);
    expect(code).not.toMatch(/\bfetch\(/);
  });

  it('never imports any point-standing module (no scoring)', () => {
    expect(code).not.toMatch(/from\s+['"][^'"]*pointStanding/);
    expect(code).not.toMatch(/PointStandingDelta/);
    expect(code).not.toMatch(/gradeRepair/);
  });

  it('the clarification field uses the model MAX_CLARIFICATION_LENGTH for maxLength', () => {
    expect(code).toMatch(/MAX_CLARIFICATION_LENGTH/);
    expect(code).toMatch(/maxLength=\{MAX_CLARIFICATION_LENGTH\}/);
  });
});
