/**
 * ADMIN-ARGUMENTS-003 — pure-model tests for the Admin Arguments view-prefs
 * (`src/features/admin/adminArgumentsPrefsModel.ts`).
 *
 * Covers:
 *  - DEFAULT_ADMIN_ARGUMENTS_PREFS reproduces the pre-card table behaviour.
 *  - mergeWithDefaults defensive parse (missing keys, wrong types, garbage,
 *    null/array, partial blob, unknown keys dropped).
 *  - round-trip: a saved blob restores byte-for-byte through mergeWithDefaults.
 *  - applyPrefsPatch immutability + single-field update.
 *  - densityToCellPaddingY mapping.
 *  - doctrine: the blob carries only cosmetic enums + one bounded int — no
 *    auth / secret / role field, and the limit is always an allowed value.
 */
import {
  DEFAULT_ADMIN_ARGUMENTS_PREFS,
  mergeWithDefaults,
  applyPrefsPatch,
  densityToCellPaddingY,
  ALL_ADMIN_ARGUMENTS_LIMITS,
  ALL_ADMIN_ARGUMENTS_DENSITIES,
  ALL_ADMIN_ARGUMENTS_PARTICIPANT_KINDS,
  type AdminArgumentsPrefs,
} from '../src/features/admin/adminArgumentsPrefsModel';

describe('DEFAULT_ADMIN_ARGUMENTS_PREFS', () => {
  it('reproduces the pre-card table behaviour', () => {
    expect(DEFAULT_ADMIN_ARGUMENTS_PREFS).toEqual({
      schemaVersion: 1,
      density: 'comfortable',
      sortField: 'updated_at',
      sortDirection: 'desc',
      runTagFilter: 'all',
      participantKind: 'all',
      limit: 50,
    });
  });

  it('is frozen (callers cannot mutate the shared default)', () => {
    expect(Object.isFrozen(DEFAULT_ADMIN_ARGUMENTS_PREFS)).toBe(true);
  });
});

describe('mergeWithDefaults — defensive parse', () => {
  it('returns the defaults for null / non-object / array', () => {
    expect(mergeWithDefaults(null)).toEqual(DEFAULT_ADMIN_ARGUMENTS_PREFS);
    expect(mergeWithDefaults(undefined)).toEqual(DEFAULT_ADMIN_ARGUMENTS_PREFS);
    expect(mergeWithDefaults(42)).toEqual(DEFAULT_ADMIN_ARGUMENTS_PREFS);
    expect(mergeWithDefaults('str')).toEqual(DEFAULT_ADMIN_ARGUMENTS_PREFS);
    expect(mergeWithDefaults([])).toEqual(DEFAULT_ADMIN_ARGUMENTS_PREFS);
  });

  it('fills missing keys from defaults', () => {
    expect(mergeWithDefaults({ density: 'compact' })).toEqual({
      ...DEFAULT_ADMIN_ARGUMENTS_PREFS,
      density: 'compact',
    });
  });

  it('replaces wrong-typed / out-of-range values with the default', () => {
    const parsed = mergeWithDefaults({
      density: 'galaxy',
      sortField: 'nope',
      sortDirection: 'sideways',
      runTagFilter: 'not-a-family',
      participantKind: 'aliens',
      limit: 999,
    });
    expect(parsed).toEqual(DEFAULT_ADMIN_ARGUMENTS_PREFS);
  });

  it('accepts a fully-valid non-default blob', () => {
    const blob: AdminArgumentsPrefs = {
      schemaVersion: 1,
      density: 'compact',
      sortField: 'created_at',
      sortDirection: 'asc',
      runTagFilter: 'xai_adv',
      participantKind: 'bots',
      limit: 200,
    };
    expect(mergeWithDefaults(blob)).toEqual(blob);
  });

  it('drops unknown keys', () => {
    const parsed = mergeWithDefaults({ density: 'compact', evilFlag: true, role: 'admin' });
    expect(parsed).not.toHaveProperty('evilFlag');
    expect(parsed).not.toHaveProperty('role');
  });

  it('only ever returns an allowed limit', () => {
    for (const bad of [0, 1, 49, 51, 100.5, 201, -50, NaN]) {
      expect(ALL_ADMIN_ARGUMENTS_LIMITS).toContain(mergeWithDefaults({ limit: bad }).limit);
    }
  });

  it('round-trips a JSON-serialised blob (storage shape)', () => {
    const blob: AdminArgumentsPrefs = {
      schemaVersion: 1,
      density: 'compact',
      sortField: 'created_at',
      sortDirection: 'asc',
      runTagFilter: 'stress',
      participantKind: 'humans',
      limit: 100,
    };
    expect(mergeWithDefaults(JSON.parse(JSON.stringify(blob)))).toEqual(blob);
  });
});

describe('applyPrefsPatch', () => {
  it('updates exactly one field and preserves the rest', () => {
    const next = applyPrefsPatch(DEFAULT_ADMIN_ARGUMENTS_PREFS, 'runTagFilter', 'ai_corpus');
    expect(next.runTagFilter).toBe('ai_corpus');
    expect(next.density).toBe(DEFAULT_ADMIN_ARGUMENTS_PREFS.density);
    expect(next.limit).toBe(DEFAULT_ADMIN_ARGUMENTS_PREFS.limit);
  });

  it('never mutates the input', () => {
    const before = { ...DEFAULT_ADMIN_ARGUMENTS_PREFS };
    applyPrefsPatch(DEFAULT_ADMIN_ARGUMENTS_PREFS, 'limit', 200);
    expect(DEFAULT_ADMIN_ARGUMENTS_PREFS).toEqual(before);
  });
});

describe('densityToCellPaddingY', () => {
  it('comfortable reproduces the existing 6px padding', () => {
    expect(densityToCellPaddingY('comfortable')).toBe(6);
  });

  it('compact tightens to 3px', () => {
    expect(densityToCellPaddingY('compact')).toBe(3);
  });

  it('produces a positive padding for every density', () => {
    for (const d of ALL_ADMIN_ARGUMENTS_DENSITIES) {
      expect(densityToCellPaddingY(d)).toBeGreaterThan(0);
    }
  });
});

describe('doctrine — blob carries only cosmetic view state', () => {
  it('has no auth / secret / role field', () => {
    const keys = Object.keys(DEFAULT_ADMIN_ARGUMENTS_PREFS);
    for (const forbidden of ['token', 'secret', 'role', 'authorization', 'serviceRole', 'apiKey']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('participantKind is persisted but the only effective v1 value is all (filter deferred)', () => {
    // The schema persists all three kinds (the card lists participantKind among
    // the persistable prefs); the active bot/human filter is deferred (B1).
    expect(ALL_ADMIN_ARGUMENTS_PARTICIPANT_KINDS).toEqual(['all', 'humans', 'bots']);
    expect(DEFAULT_ADMIN_ARGUMENTS_PREFS.participantKind).toBe('all');
  });
});
