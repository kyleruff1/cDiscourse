/**
 * GAME-003 — sensitive-mode disclaimer guard.
 *
 * Asserts that every sensitive mode carries a non-empty, plain-language
 * disclaimer that STATES the app gives no legal / therapy advice — and
 * that the disclaimer itself contains no advice. Also asserts the 4 MVP
 * modes are deliberately disclaimer-free (the MVP set ships non-sensitive
 * so no operator copy-approval is needed this card).
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  ALL_ARGUMENT_MODES,
  MVP_ARGUMENT_MODES,
  argumentModeTemplate,
  argumentModeDefinition,
  isSensitiveMode,
  _forbiddenArgumentModeTokens,
} from '../src/features/modes/argumentModeModel';

// ── Sensitive-mode set ─────────────────────────────────────────

describe('sensitive-mode set', () => {
  it('exactly 2 modes are sensitive', () => {
    const sensitive = ALL_ARGUMENT_MODES.filter((m) => isSensitiveMode(m));
    expect(sensitive.length).toBe(2);
  });

  it('the sensitive modes are co_parenting_custody and relationship_repair', () => {
    const sensitive = ALL_ARGUMENT_MODES.filter((m) =>
      isSensitiveMode(m),
    ).sort();
    expect(sensitive).toEqual(
      ['co_parenting_custody', 'relationship_repair'].sort(),
    );
  });

  it('all 4 MVP modes are non-sensitive', () => {
    for (const mode of MVP_ARGUMENT_MODES) {
      expect(argumentModeTemplate(mode).sensitive).toBe(false);
    }
  });

  it('court_record_strict is not sensitive and carries no disclaimer', () => {
    const template = argumentModeTemplate('court_record_strict');
    expect(template.sensitive).toBe(false);
    expect(template.definition.disclaimer).toBeUndefined();
  });
});

// ── Disclaimer presence (edge case 4) ──────────────────────────

describe('sensitive-mode disclaimer presence', () => {
  it('every sensitive mode has a non-empty disclaimer of reasonable length', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      if (!isSensitiveMode(mode)) continue;
      const disclaimer = argumentModeDefinition(mode).disclaimer;
      expect(typeof disclaimer).toBe('string');
      expect((disclaimer ?? '').length).toBeGreaterThanOrEqual(80);
    }
  });

  it('every non-sensitive mode omits the disclaimer', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      if (isSensitiveMode(mode)) continue;
      expect(argumentModeDefinition(mode).disclaimer).toBeUndefined();
    }
  });
});

// ── Disclaimer content — states no advice is given ─────────────

describe('sensitive-mode disclaimer content', () => {
  it('the co-parenting disclaimer states no legal advice is given', () => {
    const disclaimer =
      argumentModeDefinition('co_parenting_custody').disclaimer ?? '';
    expect(disclaimer).toMatch(/does not give .*advice/i);
    expect(disclaimer.toLowerCase()).toContain('legal');
  });

  it('the relationship disclaimer states no therapy advice is given', () => {
    const disclaimer =
      argumentModeDefinition('relationship_repair').disclaimer ?? '';
    expect(disclaimer).toMatch(/does not give .*advice/i);
    expect(disclaimer.toLowerCase()).toMatch(/therap/);
  });

  it('no disclaimer reads like advice-giving instructions', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      if (!isSensitiveMode(mode)) continue;
      const disclaimer = argumentModeDefinition(mode).disclaimer ?? '';
      expect(disclaimer).not.toMatch(/^you should/i);
      expect(disclaimer).not.toMatch(/we recommend you/i);
    }
  });

  it('each disclaimer names a qualified professional to consult instead', () => {
    const custody =
      argumentModeDefinition('co_parenting_custody').disclaimer ?? '';
    expect(custody.toLowerCase()).toMatch(/attorney|family-law professional/);
    const relationship =
      argumentModeDefinition('relationship_repair').disclaimer ?? '';
    expect(relationship.toLowerCase()).toMatch(
      /counselor|therapist|licensed professional/,
    );
  });
});

// ── Defence in depth — ban-list re-scan ────────────────────────

describe('sensitive-mode disclaimer — ban-list re-scan', () => {
  const BANNED = _forbiddenArgumentModeTokens();

  it('no disclaimer contains a forbidden verdict / alarm token', () => {
    for (const mode of ALL_ARGUMENT_MODES) {
      if (!isSensitiveMode(mode)) continue;
      const disclaimer = (
        argumentModeDefinition(mode).disclaimer ?? ''
      ).toLowerCase();
      for (const token of BANNED) {
        // Plain substring scan; the disclaimers are calm prose and
        // contain none of these tokens by design.
        expect({
          mode,
          token,
          hit: disclaimer.includes(token.toLowerCase()),
        }).toEqual({ mode, token, hit: false });
      }
    }
  });
});
