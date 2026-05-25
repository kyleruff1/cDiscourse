/**
 * UX-001.5A — Machine Observation registry tests.
 *
 * Maps acceptance criteria AC 9, 10, 11 (registry coverage + sensitive
 * composer-only + low-confidence not default).
 */

import {
  ALL_AUTO_METADATA_CODES,
  type AutoMetadataCode,
} from '../src/features/metadata/moveMetadataLedger';
import { ALL_POINT_LIFECYCLE_STATES } from '../src/features/lifecycle/pointLifecycleModel';
import {
  ALL_MACHINE_OBSERVATION_KEYS,
  ALL_MACHINE_OBSERVATION_RAW_KEYS,
  MACHINE_OBSERVATION_BY_RAW_KEY,
  MACHINE_OBSERVATION_REGISTRY,
  _INTERNAL_RAW_KEY_GROUPS,
  getMachineObservationByRawKey,
  isKnownMachineObservationRawKey,
  lookupMachineObservation,
  makeMachineObservationKey,
} from '../src/features/nodeLabels/machineObservationRegistry';

describe('UX-001.5A — machineObservationRegistry — coverage', () => {
  describe('Total entry count (compound keys)', () => {
    // Design §4.5 forecast was 64 (16 + 18 + 25 + 5). The PointLifecycleState
    // union actually has 19 values (18 explicit + archived_or_resolved). The
    // mechanical coverage requirement (every union member has a registry
    // entry) requires 19 lifecycle entries → 65 total. See design §4.2
    // "Implementer note" appended at the end of UX-001.5A.md.
    it('contains exactly 65 compound-key entries (16 auto + 19 lifecycle + 25 AI + 5 sensitive)', () => {
      expect(ALL_MACHINE_OBSERVATION_KEYS.length).toBe(65);
    });

    it('breakdown matches the union exactly', () => {
      expect(_INTERNAL_RAW_KEY_GROUPS.autoMetadata.length).toBe(16);
      expect(_INTERNAL_RAW_KEY_GROUPS.lifecycle.length).toBe(19);
      expect(_INTERNAL_RAW_KEY_GROUPS.aiClassifier.length).toBe(25);
      expect(_INTERNAL_RAW_KEY_GROUPS.sensitive.length).toBe(5);
    });

    it('total adds to 65 exactly', () => {
      const total =
        _INTERNAL_RAW_KEY_GROUPS.autoMetadata.length +
        _INTERNAL_RAW_KEY_GROUPS.lifecycle.length +
        _INTERNAL_RAW_KEY_GROUPS.aiClassifier.length +
        _INTERNAL_RAW_KEY_GROUPS.sensitive.length;
      expect(total).toBe(65);
    });

    it('byRawKey collapses overlapping rawKeys (63 distinct rawKeys)', () => {
      // 65 entries; source_requested and quote_requested are shared between
      // auto_metadata + lifecycle → 63 distinct rawKeys.
      expect(ALL_MACHINE_OBSERVATION_RAW_KEYS.length).toBe(63);
    });
  });

  describe('Every AutoMetadataCode has a compound-key entry (mechanical coverage)', () => {
    for (const code of ALL_AUTO_METADATA_CODES) {
      it(`auto metadata code "${code}" has a registry entry under auto_metadata`, () => {
        const entry = lookupMachineObservation('auto_metadata', code);
        expect(entry).not.toBeNull();
        expect(entry?.source).toBe('auto_metadata');
        expect(entry?.kind).toBe('machine_observation');
      });
    }
  });

  describe('Every PointLifecycleState has a compound-key entry (mechanical coverage)', () => {
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      it(`lifecycle state "${state}" has a registry entry under lifecycle`, () => {
        const entry = lookupMachineObservation('lifecycle', state);
        expect(entry).not.toBeNull();
        expect(entry?.source).toBe('lifecycle');
        expect(entry?.kind).toBe('machine_observation');
      });
    }
  });

  describe('Sensitive composer-only entries (5)', () => {
    const sensitiveRawKeys = [
      'shifts_to_person_or_intent',
      'contains_unplayable_insult_only',
      'needs_pre_send_pause',
      'uses_popularity_as_evidence',
      'uses_satire_as_evidence',
    ];

    for (const rawKey of sensitiveRawKeys) {
      it(`sensitive entry "${rawKey}" exists under semantic_referee`, () => {
        expect(lookupMachineObservation('semantic_referee', rawKey)).not.toBeNull();
      });

      it(`sensitive entry "${rawKey}" has source 'semantic_referee'`, () => {
        expect(lookupMachineObservation('semantic_referee', rawKey)?.source).toBe(
          'semantic_referee',
        );
      });

      it(`sensitive entry "${rawKey}" is NEVER visibleByDefault`, () => {
        expect(lookupMachineObservation('semantic_referee', rawKey)?.visibleByDefault).toBe(false);
      });
    }

    it('three composer-only sensitive entries have composer_only disposition', () => {
      expect(
        lookupMachineObservation('semantic_referee', 'shifts_to_person_or_intent')?.disposition,
      ).toBe('composer_only');
      expect(
        lookupMachineObservation('semantic_referee', 'contains_unplayable_insult_only')
          ?.disposition,
      ).toBe('composer_only');
      expect(
        lookupMachineObservation('semantic_referee', 'needs_pre_send_pause')?.disposition,
      ).toBe('composer_only');
    });

    it('two inspect-only sensitive entries have inspect_only disposition', () => {
      expect(
        lookupMachineObservation('semantic_referee', 'uses_popularity_as_evidence')?.disposition,
      ).toBe('inspect_only');
      expect(
        lookupMachineObservation('semantic_referee', 'uses_satire_as_evidence')?.disposition,
      ).toBe('inspect_only');
    });

    it('composer-only entries have defaultSurface === "composer"', () => {
      expect(
        lookupMachineObservation('semantic_referee', 'shifts_to_person_or_intent')?.defaultSurface,
      ).toBe('composer');
      expect(
        lookupMachineObservation('semantic_referee', 'contains_unplayable_insult_only')
          ?.defaultSurface,
      ).toBe('composer');
      expect(
        lookupMachineObservation('semantic_referee', 'needs_pre_send_pause')?.defaultSurface,
      ).toBe('composer');
    });
  });

  describe('AI classifier entries — disposition + visibility constraints', () => {
    for (const rawKey of _INTERNAL_RAW_KEY_GROUPS.aiClassifier) {
      it(`AI classifier "${rawKey}" has disposition future_source OR inspect_only`, () => {
        const entry = lookupMachineObservation('ai_classifier', rawKey);
        expect(entry).not.toBeNull();
        // evidence_supports_claim is inspect_only per design §4.3; rest are future_source.
        expect(['future_source', 'inspect_only']).toContain(entry?.disposition);
      });

      it(`AI classifier "${rawKey}" has source 'ai_classifier'`, () => {
        expect(lookupMachineObservation('ai_classifier', rawKey)?.source).toBe('ai_classifier');
      });

      it(`AI classifier "${rawKey}" is never visibleByDefault`, () => {
        expect(lookupMachineObservation('ai_classifier', rawKey)?.visibleByDefault).toBe(false);
      });
    }
  });

  describe('Plain labels — non-empty + no snake_case leaks', () => {
    const SNAKE_CASE_LEAK = /[a-z][a-z0-9]*_[a-z0-9_]+/;

    for (const key of ALL_MACHINE_OBSERVATION_KEYS) {
      it(`"${key}" has a non-empty plain label`, () => {
        const entry = MACHINE_OBSERVATION_REGISTRY[key];
        expect(typeof entry.label).toBe('string');
        expect(entry.label.length).toBeGreaterThan(0);
      });

      it(`"${key}" label has no snake_case leak`, () => {
        const entry = MACHINE_OBSERVATION_REGISTRY[key];
        expect(entry.label).not.toMatch(SNAKE_CASE_LEAK);
      });

      it(`"${key}" shortLabel has no snake_case leak`, () => {
        const entry = MACHINE_OBSERVATION_REGISTRY[key];
        expect(entry.shortLabel).not.toMatch(SNAKE_CASE_LEAK);
      });
    }
  });

  describe('Lookup helpers', () => {
    it('lookupMachineObservation returns auto_metadata source for source_requested when asked', () => {
      const entry = lookupMachineObservation('auto_metadata', 'source_requested');
      expect(entry).not.toBeNull();
      expect(entry?.source).toBe('auto_metadata');
    });

    it('lookupMachineObservation returns lifecycle source for source_requested when asked', () => {
      const entry = lookupMachineObservation('lifecycle', 'source_requested');
      expect(entry).not.toBeNull();
      expect(entry?.source).toBe('lifecycle');
    });

    it('getMachineObservationByRawKey returns the higher-priority entry for overlapping rawKey', () => {
      // Lifecycle wins per priority order (PRIORITY_BY_SOURCE: lifecycle 20 < auto_metadata 30).
      const entry = getMachineObservationByRawKey('source_requested');
      expect(entry).not.toBeNull();
      expect(entry?.source).toBe('lifecycle');
    });

    it('getMachineObservationByRawKey returns the entry for a known rawKey', () => {
      const entry = getMachineObservationByRawKey('rebutted');
      expect(entry).not.toBeNull();
      expect(entry?.source).toBe('lifecycle');
    });

    it('getMachineObservationByRawKey returns null for an unknown rawKey', () => {
      expect(getMachineObservationByRawKey('nonexistent_classifier_id')).toBeNull();
    });

    it('getMachineObservationByRawKey returns null for empty string', () => {
      expect(getMachineObservationByRawKey('')).toBeNull();
    });

    it('isKnownMachineObservationRawKey returns true for known', () => {
      expect(isKnownMachineObservationRawKey('has_evidence')).toBe(true);
    });

    it('isKnownMachineObservationRawKey returns false for unknown', () => {
      expect(isKnownMachineObservationRawKey('some_unknown_id')).toBe(false);
    });

    it('isKnownMachineObservationRawKey returns false for empty', () => {
      expect(isKnownMachineObservationRawKey('')).toBe(false);
    });

    it('lookupMachineObservation returns null for an unknown rawKey', () => {
      expect(lookupMachineObservation('ai_classifier', 'nonexistent_id')).toBeNull();
    });

    it('makeMachineObservationKey composes the compound key', () => {
      expect(makeMachineObservationKey('lifecycle', 'rebutted')).toBe('lifecycle:rebutted');
    });
  });

  describe('Frozen registry', () => {
    it('MACHINE_OBSERVATION_REGISTRY is frozen', () => {
      expect(Object.isFrozen(MACHINE_OBSERVATION_REGISTRY)).toBe(true);
    });

    it('MACHINE_OBSERVATION_BY_RAW_KEY is frozen', () => {
      expect(Object.isFrozen(MACHINE_OBSERVATION_BY_RAW_KEY)).toBe(true);
    });

    it('ALL_MACHINE_OBSERVATION_KEYS is frozen', () => {
      expect(Object.isFrozen(ALL_MACHINE_OBSERVATION_KEYS)).toBe(true);
    });

    it('ALL_MACHINE_OBSERVATION_RAW_KEYS is frozen', () => {
      expect(Object.isFrozen(ALL_MACHINE_OBSERVATION_RAW_KEYS)).toBe(true);
    });

    it('each entry is frozen', () => {
      const entry = MACHINE_OBSERVATION_REGISTRY['lifecycle:rebutted'];
      expect(Object.isFrozen(entry)).toBe(true);
    });
  });

  describe('Every entry has kind === "machine_observation"', () => {
    for (const key of ALL_MACHINE_OBSERVATION_KEYS) {
      it(`"${key}" has kind machine_observation`, () => {
        expect(MACHINE_OBSERVATION_REGISTRY[key].kind).toBe('machine_observation');
      });
    }
  });

  describe('Type contract — exhaustiveness using AutoMetadataCode', () => {
    it('AutoMetadataCode type covers every auto-metadata registry entry', () => {
      // Pivots through the typed union — narrowing must accept each member.
      for (const code of ALL_AUTO_METADATA_CODES) {
        const c: AutoMetadataCode = code;
        expect(lookupMachineObservation('auto_metadata', c)).not.toBeNull();
      }
    });
  });
});
