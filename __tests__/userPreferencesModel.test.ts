/**
 * PR-001 — pure-model + storage + copy + VG-004-wire coverage for the
 * "My preferences" feature.
 *
 * The repo's preference logic lives in pure helpers (this file) and the
 * component is validated by a separate source-scan
 * (`preferencesDoctrine.test.ts`). No React-Testing-Library `render()`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  ALL_COLOR_ACCESSIBILITY_MODES,
  ALL_DENSITY_PREFERENCES,
  ALL_REDUCE_MOTION_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
  applyPreferencePatch,
  densityToTimelineMode,
  isHighContrast,
  mergeWithDefaults,
  resolveEffectiveReduceMotion,
  type ColorAccessibilityMode,
  type ReduceMotionPreference,
  type UserPreferences,
} from '../src/features/preferences/userPreferencesModel';
import {
  loadUserPreferences,
  saveUserPreferences,
} from '../src/features/preferences/preferencesStorage';
import {
  COLOR_MODE_COPY,
  CONTACT_EMAIL_COPY,
  DENSITY_COPY,
  DISPLAY_NAME_COPY,
  NOTIFICATIONS_COPY,
  PREFERENCES_COPY,
  REDUCE_MOTION_COPY,
  ROOM_ENTRY_COPY,
  SIDE_LABEL_COPY,
} from '../src/features/preferences/preferencesCopy';
import { userPreferencesKey } from '../src/features/session/sessionKeys';
import {
  resolveNodeGapPx,
} from '../src/features/arguments/timelineNodeVisualModel';
import {
  deriveAvatarColor,
  deriveAvatarInitials,
  hashAvatarSeed,
} from '../src/features/preferences/GeneratedAvatar';

const FULL: UserPreferences = {
  schemaVersion: 1,
  density: 'expanded',
  reduceMotion: 'on',
  colorMode: 'high_contrast',
  defaultRoomEntry: 'last_used',
  defaultSideLabel: 'side_a_b',
  notificationsOptInStub: true,
};

// ── mergeWithDefaults ───────────────────────────────────────────

describe('mergeWithDefaults', () => {
  it('round-trips a full valid blob unchanged', () => {
    expect(mergeWithDefaults(FULL)).toEqual(FULL);
  });

  it.each([null, undefined, [], 'a string', 42, true])(
    'returns the defaults for non-object input %p',
    (bad) => {
      expect(mergeWithDefaults(bad)).toEqual(DEFAULT_USER_PREFERENCES);
    },
  );

  it('fills missing keys from the defaults', () => {
    const result = mergeWithDefaults({ density: 'compact' });
    expect(result.density).toBe('compact');
    expect(result.reduceMotion).toBe(DEFAULT_USER_PREFERENCES.reduceMotion);
    expect(result.colorMode).toBe(DEFAULT_USER_PREFERENCES.colorMode);
    expect(result.notificationsOptInStub).toBe(
      DEFAULT_USER_PREFERENCES.notificationsOptInStub,
    );
  });

  it('replaces a wrong-typed value with the default', () => {
    const result = mergeWithDefaults({ density: 123, notificationsOptInStub: 'yes' });
    expect(result.density).toBe(DEFAULT_USER_PREFERENCES.density);
    expect(result.notificationsOptInStub).toBe(
      DEFAULT_USER_PREFERENCES.notificationsOptInStub,
    );
  });

  it('replaces an out-of-range enum value with the default', () => {
    const result = mergeWithDefaults({ colorMode: 'rainbow', reduceMotion: 'maybe' });
    expect(result.colorMode).toBe(DEFAULT_USER_PREFERENCES.colorMode);
    expect(result.reduceMotion).toBe(DEFAULT_USER_PREFERENCES.reduceMotion);
  });

  it('drops unknown keys', () => {
    const result = mergeWithDefaults({ density: 'normal', evilFlag: true });
    expect(Object.keys(result).sort()).toEqual(
      Object.keys(DEFAULT_USER_PREFERENCES).sort(),
    );
    expect((result as unknown as Record<string, unknown>).evilFlag).toBeUndefined();
  });

  it('always pins schemaVersion to 1', () => {
    expect(mergeWithDefaults({ schemaVersion: 99 }).schemaVersion).toBe(1);
  });
});

// ── applyPreferencePatch ────────────────────────────────────────

describe('applyPreferencePatch', () => {
  it('updates a single field and preserves the rest', () => {
    const next = applyPreferencePatch(DEFAULT_USER_PREFERENCES, 'density', 'compact');
    expect(next.density).toBe('compact');
    expect(next.reduceMotion).toBe(DEFAULT_USER_PREFERENCES.reduceMotion);
    expect(next.colorMode).toBe(DEFAULT_USER_PREFERENCES.colorMode);
  });

  it('is immutable — the previous object is not mutated', () => {
    const prev = { ...DEFAULT_USER_PREFERENCES };
    const snapshot = { ...prev };
    const next = applyPreferencePatch(prev, 'notificationsOptInStub', true);
    expect(prev).toEqual(snapshot);
    expect(next).not.toBe(prev);
  });
});

// ── resolveEffectiveReduceMotion ────────────────────────────────

describe('resolveEffectiveReduceMotion', () => {
  it('system follows the OS value', () => {
    expect(resolveEffectiveReduceMotion('system', true)).toBe(true);
    expect(resolveEffectiveReduceMotion('system', false)).toBe(false);
  });

  it('on always returns true regardless of the OS', () => {
    expect(resolveEffectiveReduceMotion('on', true)).toBe(true);
    expect(resolveEffectiveReduceMotion('on', false)).toBe(true);
  });

  it('off always returns false regardless of the OS', () => {
    expect(resolveEffectiveReduceMotion('off', true)).toBe(false);
    expect(resolveEffectiveReduceMotion('off', false)).toBe(false);
  });

  it('covers the full truth table', () => {
    const prefs: ReduceMotionPreference[] = ['system', 'on', 'off'];
    for (const p of prefs) {
      for (const os of [true, false]) {
        const out = resolveEffectiveReduceMotion(p, os);
        expect(typeof out).toBe('boolean');
      }
    }
  });
});

// ── densityToTimelineMode ───────────────────────────────────────

describe('densityToTimelineMode', () => {
  it('maps every density preference to a valid TimelineDensityMode', () => {
    for (const d of ALL_DENSITY_PREFERENCES) {
      const mode = densityToTimelineMode(d);
      // resolveNodeGapPx accepts a TimelineDensityMode and returns a
      // finite px gap — if the mapping produced a junk value it would
      // fall through to the 'normal' default.
      expect(Number.isFinite(resolveNodeGapPx(mode))).toBe(true);
      expect(mode).toBe(d);
    }
  });
});

// ── isHighContrast ──────────────────────────────────────────────

describe('isHighContrast', () => {
  it('is true only for high_contrast', () => {
    expect(isHighContrast('high_contrast')).toBe(true);
    const others: ColorAccessibilityMode[] = [
      'default',
      'protanopia',
      'deuteranopia',
      'tritanopia',
    ];
    for (const m of others) {
      expect(isHighContrast(m)).toBe(false);
    }
  });
});

// ── DEFAULT_USER_PREFERENCES ────────────────────────────────────

describe('DEFAULT_USER_PREFERENCES', () => {
  it('has schemaVersion 1', () => {
    expect(DEFAULT_USER_PREFERENCES.schemaVersion).toBe(1);
  });

  it('defaults density to normal so wiring it does not move the board', () => {
    expect(DEFAULT_USER_PREFERENCES.density).toBe('normal');
  });

  it('defaults reduceMotion to system (today behaviour: obey the OS)', () => {
    expect(DEFAULT_USER_PREFERENCES.reduceMotion).toBe('system');
  });

  it('defaults the notification stub to off', () => {
    expect(DEFAULT_USER_PREFERENCES.notificationsOptInStub).toBe(false);
  });

  it('defaults room entry to observe (matches the Observer-first default)', () => {
    expect(DEFAULT_USER_PREFERENCES.defaultRoomEntry).toBe('observe');
  });
});

// ── VG-004 density wire ─────────────────────────────────────────

describe('VG-004 density wire', () => {
  it('the preference default and the un-wired default render identically', () => {
    // resolveNodeGapPx(undefined) is what an un-threaded caller gets;
    // densityToTimelineMode('normal') is what the preference default
    // produces. They must agree so soldering the wire does not move
    // every existing user's board.
    expect(resolveNodeGapPx(densityToTimelineMode('normal'))).toBe(
      resolveNodeGapPx(undefined),
    );
  });

  it('compact and expanded produce a distinct gap from normal', () => {
    const normal = resolveNodeGapPx(densityToTimelineMode('normal'));
    expect(resolveNodeGapPx(densityToTimelineMode('compact'))).toBeLessThan(normal);
    expect(resolveNodeGapPx(densityToTimelineMode('expanded'))).toBeGreaterThan(
      normal,
    );
  });
});

// ── Storage ─────────────────────────────────────────────────────

describe('preferencesStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('save -> load round-trips the blob', async () => {
    await saveUserPreferences('user-1', FULL);
    const loaded = await loadUserPreferences('user-1');
    expect(loaded).toEqual(FULL);
  });

  it('load with no key returns the defaults', async () => {
    const loaded = await loadUserPreferences('never-saved');
    expect(loaded).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('load with corrupt JSON returns the defaults without throwing', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('{not json');
    const loaded = await loadUserPreferences('user-1');
    expect(loaded).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('load with a garbage (non-object) blob rebuilds the defaults', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('[1,2,3]');
    const loaded = await loadUserPreferences('user-1');
    expect(loaded).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('load with a storage error returns the defaults', async () => {
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('storage error'));
    const loaded = await loadUserPreferences('user-1');
    expect(loaded).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('save swallows a storage error (non-fatal)', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(saveUserPreferences('user-1', FULL)).resolves.toBeUndefined();
  });

  it('uses the userPreferencesKey shape', async () => {
    const setSpy = jest.spyOn(AsyncStorage, 'setItem');
    await saveUserPreferences('user-9', FULL);
    expect(setSpy).toHaveBeenCalledWith(
      userPreferencesKey('user-9'),
      expect.any(String),
    );
  });

  it('keys a null userId under the anon key', async () => {
    const setSpy = jest.spyOn(AsyncStorage, 'setItem');
    await saveUserPreferences(null, FULL);
    expect(setSpy).toHaveBeenCalledWith(
      userPreferencesKey('anon'),
      expect.any(String),
    );
  });
});

// ── Copy ────────────────────────────────────────────────────────

describe('preferencesCopy', () => {
  const allStrings = (obj: unknown): string[] => {
    const out: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') out.push(v);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(obj);
    return out;
  };

  it('every exported string is non-empty', () => {
    const groups = [
      PREFERENCES_COPY,
      DISPLAY_NAME_COPY,
      CONTACT_EMAIL_COPY,
      NOTIFICATIONS_COPY,
      ROOM_ENTRY_COPY,
      DENSITY_COPY,
      COLOR_MODE_COPY,
      REDUCE_MOTION_COPY,
      SIDE_LABEL_COPY,
    ];
    for (const g of groups) {
      for (const s of allStrings(g)) {
        expect(s.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('the notification copy is an honest "not available" stub', () => {
    expect(NOTIFICATIONS_COPY.helper.toLowerCase()).toMatch(
      /not available|coming|aren.?t available/,
    );
  });

  it('the colour-blind modes carry an honest "coming" line', () => {
    expect(COLOR_MODE_COPY.comingSoonNote.toLowerCase()).toContain('coming');
  });

  it('the contact-email note honestly says email cannot be changed here', () => {
    expect(CONTACT_EMAIL_COPY.notAvailableNote.toLowerCase()).toMatch(
      /can.?t change|coming/,
    );
  });

  it('the side-label note honestly says the choice is saved but not yet applied', () => {
    expect(SIDE_LABEL_COPY.persistOnlyNote.toLowerCase()).toMatch(
      /saved|will apply/,
    );
  });

  it('exposes a copy option for every colour-accessibility mode', () => {
    for (const m of ALL_COLOR_ACCESSIBILITY_MODES) {
      expect(
        (COLOR_MODE_COPY.options as Record<string, string>)[m],
      ).toBeTruthy();
    }
  });

  it('exposes a copy option for every reduce-motion preference', () => {
    for (const m of ALL_REDUCE_MOTION_PREFERENCES) {
      expect(
        (REDUCE_MOTION_COPY.options as Record<string, string>)[m],
      ).toBeTruthy();
    }
  });
});

// ── GeneratedAvatar pure helpers ────────────────────────────────

describe('GeneratedAvatar helpers', () => {
  it('hashAvatarSeed is deterministic and non-negative', () => {
    expect(hashAvatarSeed('abc')).toBe(hashAvatarSeed('abc'));
    expect(hashAvatarSeed('abc')).toBeGreaterThanOrEqual(0);
  });

  it('deriveAvatarInitials returns up to two uppercase initials', () => {
    expect(deriveAvatarInitials('Ada Lovelace')).toBe('AL');
    expect(deriveAvatarInitials('cher')).toBe('CH');
    expect(deriveAvatarInitials('  ')).toBe('?');
    expect(deriveAvatarInitials(null)).toBe('?');
  });

  it('deriveAvatarColor is deterministic for the same seed', () => {
    expect(deriveAvatarColor('user-1')).toBe(deriveAvatarColor('user-1'));
    expect(deriveAvatarColor('user-1')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
