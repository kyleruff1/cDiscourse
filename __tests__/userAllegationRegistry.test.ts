/**
 * UX-001.5A — User Allegation registry tests.
 *
 * Maps acceptance criteria AC 1, 7, 8 (every manual tag = Allegation +
 * no raw codes + full coverage).
 */

import {
  ALL_MANUAL_TAG_CODES,
  getManualTagPlainLabel,
} from '../src/features/metadata/moveMetadataLedger';
import {
  ALL_USER_ALLEGATION_RAW_KEYS,
  USER_ALLEGATION_REGISTRY,
  getUserAllegationByRawKey,
  isKnownUserAllegationRawKey,
} from '../src/features/nodeLabels/userAllegationRegistry';

describe('UX-001.5A — userAllegationRegistry — coverage', () => {
  describe('Total entry count', () => {
    it('contains exactly 10 entries', () => {
      expect(ALL_USER_ALLEGATION_RAW_KEYS.length).toBe(10);
    });

    it('every `ManualTagCode` has a registry entry', () => {
      for (const code of ALL_MANUAL_TAG_CODES) {
        expect(USER_ALLEGATION_REGISTRY[code]).toBeDefined();
      }
    });

    it('registry has no entries beyond ManualTagCode', () => {
      const registryKeys = Object.keys(USER_ALLEGATION_REGISTRY);
      const expectedKeys = ALL_MANUAL_TAG_CODES.slice().sort();
      expect(registryKeys.sort()).toEqual(expectedKeys);
    });
  });

  describe('Every entry has kind === "user_allegation" + source === "manual_tag"', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      it(`"${code}" has kind user_allegation`, () => {
        expect(USER_ALLEGATION_REGISTRY[code].kind).toBe('user_allegation');
      });

      it(`"${code}" has source manual_tag`, () => {
        expect(USER_ALLEGATION_REGISTRY[code].source).toBe('manual_tag');
      });

      it(`"${code}" has defaultSurface timeline_node`, () => {
        expect(USER_ALLEGATION_REGISTRY[code].defaultSurface).toBe('timeline_node');
      });

      it(`"${code}" has disposition rendered_now`, () => {
        expect(USER_ALLEGATION_REGISTRY[code].disposition).toBe('rendered_now');
      });

      it(`"${code}" is visibleByDefault`, () => {
        expect(USER_ALLEGATION_REGISTRY[code].visibleByDefault).toBe(true);
      });
    }
  });

  describe('Plain labels match getManualTagPlainLabel verbatim', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      it(`"${code}" label is the plain-label helper output`, () => {
        expect(USER_ALLEGATION_REGISTRY[code].label).toBe(getManualTagPlainLabel(code));
      });
    }
  });

  describe('Plain labels — non-empty + no snake_case leaks', () => {
    const SNAKE_CASE_LEAK = /[a-z][a-z0-9]*_[a-z0-9_]+/;

    for (const code of ALL_MANUAL_TAG_CODES) {
      it(`"${code}" has a non-empty plain label`, () => {
        const entry = USER_ALLEGATION_REGISTRY[code];
        expect(typeof entry.label).toBe('string');
        expect(entry.label.length).toBeGreaterThan(0);
      });

      it(`"${code}" label has no snake_case leak`, () => {
        expect(USER_ALLEGATION_REGISTRY[code].label).not.toMatch(SNAKE_CASE_LEAK);
      });

      it(`"${code}" shortLabel has no snake_case leak`, () => {
        expect(USER_ALLEGATION_REGISTRY[code].shortLabel).not.toMatch(SNAKE_CASE_LEAK);
      });

      it(`"${code}" description has no snake_case leak`, () => {
        expect(USER_ALLEGATION_REGISTRY[code].description).not.toMatch(SNAKE_CASE_LEAK);
      });
    }
  });

  describe('Lookup helpers', () => {
    it('getUserAllegationByRawKey returns the entry for a known code', () => {
      const entry = getUserAllegationByRawKey('needs_source');
      expect(entry).not.toBeNull();
      expect(entry?.rawKey).toBe('needs_source');
    });

    it('getUserAllegationByRawKey returns null for an unknown code', () => {
      expect(getUserAllegationByRawKey('not_a_real_code')).toBeNull();
    });

    it('getUserAllegationByRawKey returns null for empty string', () => {
      expect(getUserAllegationByRawKey('')).toBeNull();
    });

    it('isKnownUserAllegationRawKey returns true for known', () => {
      expect(isKnownUserAllegationRawKey('definition_issue')).toBe(true);
    });

    it('isKnownUserAllegationRawKey returns false for unknown', () => {
      expect(isKnownUserAllegationRawKey('foo')).toBe(false);
    });

    it('isKnownUserAllegationRawKey returns false for empty', () => {
      expect(isKnownUserAllegationRawKey('')).toBe(false);
    });
  });

  describe('Frozen registry', () => {
    it('USER_ALLEGATION_REGISTRY is frozen', () => {
      expect(Object.isFrozen(USER_ALLEGATION_REGISTRY)).toBe(true);
    });

    it('ALL_USER_ALLEGATION_RAW_KEYS is frozen', () => {
      expect(Object.isFrozen(ALL_USER_ALLEGATION_RAW_KEYS)).toBe(true);
    });

    it('each entry is frozen', () => {
      const entry = USER_ALLEGATION_REGISTRY['needs_source'];
      expect(Object.isFrozen(entry)).toBe(true);
    });
  });

  describe('Priority ordering — manual tags occupy 10-19 slot', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      it(`"${code}" has priority between 10 and 19 inclusive`, () => {
        const entry = USER_ALLEGATION_REGISTRY[code];
        expect(entry.priority).toBeGreaterThanOrEqual(10);
        expect(entry.priority).toBeLessThanOrEqual(19);
      });
    }
  });
});
