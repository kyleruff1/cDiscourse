/**
 * QOL-042 — linkedPriorArgumentCopy doctrine + shape tests.
 *
 * Every user-facing string on the linked-prior-argument surface is held
 * to the doctrine ban-list — no verdict / truth / amplification token, no
 * "access denied" error verdict, no internal code.
 */
import {
  ALL_LINKED_PRIOR_ARGUMENT_COPY,
  LINKED_PRIOR_ARGUMENT_COPY,
  getChipHeaderCopy,
  _forbiddenLinkedPriorTokens,
} from '../src/features/arguments/crossRoom/linkedPriorArgumentCopy';

describe('LINKED_PRIOR_ARGUMENT_COPY — shape', () => {
  it('exposes every required copy key', () => {
    for (const key of [
      'chipHeaderPublic',
      'chipHeaderPrivate',
      'titleOnlyLockLine',
      'openDisabledReason',
      'unavailable',
      'createAffordance',
      'pickerEmpty',
      'inspectSectionHeader',
      'noTangentContext',
      'couldNotRefresh',
      'openActionLabel',
      'viewContextActionLabel',
    ]) {
      expect(LINKED_PRIOR_ARGUMENT_COPY).toHaveProperty(key);
      expect(
        (LINKED_PRIOR_ARGUMENT_COPY as Record<string, string>)[key].length,
      ).toBeGreaterThan(0);
    }
  });

  it('has both public and private chip headers', () => {
    expect(LINKED_PRIOR_ARGUMENT_COPY.chipHeaderPublic).toBe('Linked prior argument');
    expect(LINKED_PRIOR_ARGUMENT_COPY.chipHeaderPrivate).toBe(
      'Linked prior private argument',
    );
  });

  it('the title-only lock line is neutral — it frames the title as context', () => {
    const line = LINKED_PRIOR_ARGUMENT_COPY.titleOnlyLockLine.toLowerCase();
    expect(line).toContain('context');
    expect(line).not.toContain('denied');
    expect(line).not.toContain('forbidden');
  });

  it('the Inspect section header is "From the linked prior argument"', () => {
    expect(LINKED_PRIOR_ARGUMENT_COPY.inspectSectionHeader).toBe(
      'From the linked prior argument',
    );
  });
});

describe('getChipHeaderCopy', () => {
  it('returns the private header for a private prior room', () => {
    expect(getChipHeaderCopy(true)).toBe(LINKED_PRIOR_ARGUMENT_COPY.chipHeaderPrivate);
  });

  it('returns the public header for a public prior room', () => {
    expect(getChipHeaderCopy(false)).toBe(LINKED_PRIOR_ARGUMENT_COPY.chipHeaderPublic);
  });
});

describe('linkedPriorArgumentCopy — doctrine ban-list', () => {
  // "settled" is the ONLY allowed end-state word; "private" and the
  // verb "open" are structural, not verdicts. Every banned token below
  // is a whole-word scan over every exported string.
  it('contains no verdict / amplification / "access denied" token', () => {
    for (const str of ALL_LINKED_PRIOR_ARGUMENT_COPY) {
      const lower = str.toLowerCase();
      for (const token of _forbiddenLinkedPriorTokens()) {
        if (token.includes(' ')) {
          // multi-word phrase — substring scan
          expect(lower).not.toContain(token);
        } else {
          const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          expect(re.test(str)).toBe(false);
        }
      }
    }
  });

  it('never says "game"; uses "argument" not "debate"', () => {
    for (const str of ALL_LINKED_PRIOR_ARGUMENT_COPY) {
      const lower = str.toLowerCase();
      expect(lower).not.toMatch(/\bgame\b/);
      expect(lower).not.toMatch(/\bdebate\b/);
      expect(lower).not.toMatch(/\bdebates\b/);
    }
  });

  it('"settled" is the only end-state word — no "case closed"', () => {
    for (const str of ALL_LINKED_PRIOR_ARGUMENT_COPY) {
      expect(str.toLowerCase()).not.toContain('case closed');
    }
  });

  it('contains no snake_case internal code leak', () => {
    for (const str of ALL_LINKED_PRIOR_ARGUMENT_COPY) {
      // No bare lower_snake token (an internal code) in user copy.
      expect(str).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
    }
  });
});

// ── QUOTE-FORGE-001 — new picker-model / sheet strings ban-list ──
//
// The create-link picker sheet carries inline user-facing strings that are
// NOT part of LINKED_PRIOR_ARGUMENT_COPY. Scan the sheet + model source for
// any string literal carrying a forbidden token (same doctrine bar).
describe('QUOTE-FORGE-001 — picker source strings ban-list', () => {
  const fs = require('fs');
  const path = require('path');
  const REPO = process.cwd();

  const SCANNED_FILES = [
    'src/features/arguments/crossRoom/LinkTargetPickerSheet.tsx',
    'src/features/arguments/crossRoom/linkTargetPickerModel.ts',
  ];

  // Extract every quoted string literal from source (like the doctrine
  // scanner) — we only care about copy, not identifiers / comments.
  const STRING_RE = /(['"`])(?:(?!\1|\\)[\s\S]|\\[\s\S])*?\1/g;
  function extractStrings(src: string): string[] {
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = STRING_RE.exec(src))) out.push(m[0].slice(1, -1));
    return out;
  }

  // Strip comments before extracting string literals — a doctrine doc
  // comment legitimately names the banned tokens it forbids ("won / proved
  // / correct" signal); only actual copy literals are scanned.
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
  }

  for (const rel of SCANNED_FILES) {
    it(`${rel} has no string literal with a forbidden token`, () => {
      const src = stripComments(fs.readFileSync(path.join(REPO, rel), 'utf8'));
      const literals = extractStrings(src);
      for (const lit of literals) {
        for (const token of _forbiddenLinkedPriorTokens()) {
          if (token.includes(' ')) {
            expect(lit.toLowerCase()).not.toContain(token);
          } else {
            const re = new RegExp(
              `\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
              'i',
            );
            expect(re.test(lit)).toBe(false);
          }
        }
      }
    });
  }
});
