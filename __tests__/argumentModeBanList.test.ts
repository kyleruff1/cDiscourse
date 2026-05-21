/**
 * GAME-003 — argument mode copy ban-list scan.
 *
 * Collects every user-facing string the mode model can produce — all
 * `argumentModeDisplayName`, all `argumentModeDescription`, every
 * `buildModeRuleRows` label + value, every `definition.disclaimer` that is
 * present, and every value in `ARGUMENT_MODE_COPY` — and asserts none
 * contains a forbidden verdict / amplification / block / person-
 * attribution token. Zero matches allowed.
 *
 * Also asserts no user-facing string leaks a raw `ArgumentMode` id
 * (snake_case) and that `buildModeRuleRows` never emits an internal enum
 * value as a rule-row value.
 *
 * Mirrors `channelCopyBanList.test.ts` / `preSendReviewBanList.test.ts` —
 * the precedent safety tests. Pure-TS — no React, no Supabase, no network.
 */
import {
  ALL_ARGUMENT_MODES,
  argumentModeDisplayName,
  argumentModeDescription,
  argumentModeDefinition,
  buildModeRuleRows,
  _forbiddenArgumentModeTokens,
} from '../src/features/modes/argumentModeModel';
import { ARGUMENT_MODE_COPY } from '../src/features/arguments/gameCopy';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

/**
 * Short everyday-English verdict words scanned with word boundaries to
 * avoid false hits ("a record stays true to its source" etc.). Substring
 * tokens are unambiguous.
 */
const WORD_BOUNDARY_TOKENS = new Set([
  'true',
  'false',
  'won',
  'lost',
  'right',
  'wrong',
  'bot',
  'views',
  'proof',
  'shares',
]);

function hitsBanned(s: string, token: string): boolean {
  const lower = s.toLowerCase();
  const t = token.toLowerCase();
  if (WORD_BOUNDARY_TOKENS.has(t)) {
    const re = new RegExp(
      `\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    );
    return re.test(lower);
  }
  return lower.includes(t);
}

// ── Collect every produced user-facing string ──────────────────

function collectUserFacingStrings(): { label: string; text: string }[] {
  const strings: { label: string; text: string }[] = [];

  for (const mode of ALL_ARGUMENT_MODES) {
    strings.push({
      label: `displayName:${mode}`,
      text: argumentModeDisplayName(mode),
    });
    strings.push({
      label: `description:${mode}`,
      text: argumentModeDescription(mode),
    });
    for (const row of buildModeRuleRows(mode)) {
      strings.push({
        label: `ruleRow:${mode}:${row.id}:label`,
        text: row.label,
      });
      strings.push({
        label: `ruleRow:${mode}:${row.id}:value`,
        text: row.value,
      });
    }
    const disclaimer = argumentModeDefinition(mode).disclaimer;
    if (disclaimer !== undefined) {
      strings.push({ label: `disclaimer:${mode}`, text: disclaimer });
    }
  }

  for (const [key, value] of Object.entries(ARGUMENT_MODE_COPY)) {
    strings.push({ label: `ARGUMENT_MODE_COPY.${key}`, text: value });
  }

  return strings;
}

const ALL_STRINGS = collectUserFacingStrings();
const BANNED = _forbiddenArgumentModeTokens();

// ── The scan ───────────────────────────────────────────────────

describe('argument mode copy — doctrine ban-list', () => {
  it('the ban-list helper returns a non-empty token list', () => {
    expect(BANNED.length).toBeGreaterThan(0);
  });

  it('collects a non-trivial set of user-facing strings', () => {
    expect(ALL_STRINGS.length).toBeGreaterThan(50);
  });

  it('no user-facing string contains any forbidden token', () => {
    for (const { label, text } of ALL_STRINGS) {
      for (const token of BANNED) {
        if (hitsBanned(text, token)) {
          throw new Error(
            `Forbidden token "${token}" found in ${label}: "${text}"`,
          );
        }
      }
    }
  });

  it('no user-facing string contains a raw ArgumentMode id (snake_case leak)', () => {
    for (const { label, text } of ALL_STRINGS) {
      for (const mode of ALL_ARGUMENT_MODES) {
        expect({ label, contains: text.includes(mode) }).toEqual({
          label,
          contains: false,
        });
      }
    }
  });

  it('no rule-row label or value looks like an internal code', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      for (const row of buildModeRuleRows(mode)) {
        expect(looksLikeInternalCode(row.label)).toBe(false);
        expect(looksLikeInternalCode(row.value)).toBe(false);
      }
    }
  });

  it('no rule-row value contains a raw internal enum value', () => {
    // Every internal ArgumentModeDefinition enum value mapped to prose.
    const INTERNAL_ENUM_VALUES = [
      'loose',
      'normal',
      'strict',
      'permissive',
      'restricted',
      'metadata_only',
      'metadata_and_chip',
    ];
    for (const mode of ALL_ARGUMENT_MODES) {
      for (const row of buildModeRuleRows(mode)) {
        for (const enumValue of INTERNAL_ENUM_VALUES) {
          // Word-boundary check so prose like "normally" is not a false hit;
          // the enum value itself ("normal") must never stand alone.
          const re = new RegExp(`\\b${enumValue}\\b`);
          expect({
            mode,
            rowId: row.id,
            value: row.value,
            leaks: re.test(row.value.toLowerCase()),
          }).toEqual({
            mode,
            rowId: row.id,
            value: row.value,
            leaks: false,
          });
        }
      }
    }
  });

  it('display names and descriptions never look like internal codes', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      expect(looksLikeInternalCode(argumentModeDisplayName(mode))).toBe(false);
      expect(looksLikeInternalCode(argumentModeDescription(mode))).toBe(false);
    }
  });
});
