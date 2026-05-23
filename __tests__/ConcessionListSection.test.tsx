/**
 * QOL-041 — ConcessionListSection tests.
 *
 * Follows the repo's pure-helper / source-scan test discipline (see
 * `RespondToEvidenceForm.test.tsx`): every visual decision is driven
 * by the pure `validateConcessionListDraft` model exercised in
 * `concessionListModel.test.ts`. The component contract (forced-list
 * shape, no single body field, 44px targets, no AI parsing, plain-
 * language copy, ban-list scan) is asserted by source-scan + the
 * authored `CONCESSION_LIST_SECTION_COPY` map.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  CONCESSION_LIST_SECTION_COPY,
} from '../src/features/arguments/oneBox/schemas/ConcessionListSection';
import { _forbiddenAcceptanceGradientTokens } from '../src/features/concessions/acceptanceGradient';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const repoRoot = process.cwd();
const sectionSrc = fs.readFileSync(
  path.join(
    repoRoot,
    'src/features/arguments/oneBox/schemas/ConcessionListSection.tsx',
  ),
  'utf8',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ── Authored copy — ban-list + plain language ─────────────────

describe('ConcessionListSection — authored copy', () => {
  // All values are strings (no parameterised templates), so iterating
  // is a simple Object.entries cast to a string-value map.
  const entries = Object.entries(CONCESSION_LIST_SECTION_COPY) as Array<
    [string, string]
  >;

  it('every piece of authored copy is a non-empty plain-language string', () => {
    for (const [key, value] of entries) {
      expect({ key, len: value.length }).toEqual({ key, len: value.length });
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('no authored copy contains a verdict / amplification / game token', () => {
    const banned = _forbiddenAcceptanceGradientTokens();
    for (const [key, value] of entries) {
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
    for (const [, value] of entries) {
      expect(looksLikeInternalCode(value)).toBe(false);
    }
  });

  it('the header describes a REPAIR, not a defeat (doctrine)', () => {
    // "Concede points" is the act of narrowing, not a "loss".
    expect(CONCESSION_LIST_SECTION_COPY.header).toMatch(/Concede points/);
    // Defensive — no loss / defeat / wrong / loser tokens.
    const text = CONCESSION_LIST_SECTION_COPY.header.toLowerCase();
    expect(text).not.toContain('lost');
    expect(text).not.toContain('defeat');
    expect(text).not.toContain('loser');
  });

  it('the add-button label declares the action (`+ Add a point`)', () => {
    expect(CONCESSION_LIST_SECTION_COPY.addButtonLabel).toBe('+ Add a point');
  });

  it('the disabled-add hint names the cap (8 items — design §15 Q1)', () => {
    expect(CONCESSION_LIST_SECTION_COPY.addDisabledHint).toMatch(/8/);
  });
});

// ── Source contract ───────────────────────────────────────────

describe('ConcessionListSection — source contract', () => {
  const code = stripComments(sectionSrc);

  it('imports the pure model — addConcessionItem / removeConcessionItem / updateConcessionItemText / validateConcessionListDraft', () => {
    expect(code).toMatch(/addConcessionItem/);
    expect(code).toMatch(/removeConcessionItem/);
    expect(code).toMatch(/updateConcessionItemText/);
    expect(code).toMatch(/validateConcessionListDraft/);
  });

  it('renders each item as a SEPARATE TextInput (no single body)', () => {
    // The section maps over draft.items and renders a per-item input.
    expect(code).toMatch(/draft\.items\.map/);
    expect(code).toMatch(/<TextInput/);
    // Defensive: there is exactly ONE TextInput JSX (the per-item one) —
    // no aggregate "section body" input is permitted.
    const tiOccurrences = (code.match(/<TextInput/g) || []).length;
    expect(tiOccurrences).toBe(1);
  });

  it('provides a [+ Add a point] affordance', () => {
    expect(code).toMatch(/handleAdd/);
    expect(code).toMatch(/addConcessionItem/);
  });

  it('every Pressable provides accessibilityRole + accessibilityLabel', () => {
    // The header toggle, the remove button, and the add button all
    // declare button role + label. We assert the literal strings appear
    // in the source.
    expect(code).toMatch(/accessibilityRole=['"]button['"]/);
    expect(code).toMatch(/accessibilityLabel=/);
  });

  it('minimum tap targets are >= 44dp (header / remove / add buttons)', () => {
    // The styles object literal sets minHeight 44 in several places.
    const minHeight44Count = (code.match(/minHeight:\s*44/g) || []).length;
    expect(minHeight44Count).toBeGreaterThanOrEqual(3);
  });

  it('renders the validation firstReason as a visible single line', () => {
    expect(code).toMatch(/validation\.firstReason/);
    // The reason is rendered with a live-region for screen readers.
    expect(code).toMatch(/accessibilityLiveRegion=['"]polite['"]/);
  });

  it('makes NO AI / network call', () => {
    expect(code).not.toMatch(/anthropic/i);
    expect(code).not.toMatch(/api\.x\.ai/i);
    expect(code).not.toMatch(/openai/i);
    expect(code).not.toMatch(/\bfetch\(/);
  });

  it('imports no Supabase / submit-argument primitive (composition only)', () => {
    expect(code).not.toMatch(/from\s+['"][^'"]*supabase/);
    expect(code).not.toMatch(/submit-argument/);
  });

  it('uses placeholder color via the SURFACE_TOKENS — never a literal hue', () => {
    // Accessibility-targets: placeholder must come from the design
    // tokens, not a magic hex.
    expect(code).toMatch(/SURFACE_TOKENS\.placeholder/);
  });
});
