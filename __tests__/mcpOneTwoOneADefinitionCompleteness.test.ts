/**
 * MCP-021A — Test category 2: Boolean definition completeness.
 *
 * Per design §8.2 + Trigger 12. Verifies every MachineObservationDefinition
 * carries all 8 verbose fields. Aggregate approach (per design §8.9
 * implementer choice) — ~30 tests, not 150.
 */

import { _INTERNAL_ALL_DEFINITIONS } from '../src/features/nodeLabels/machineObservationDefinitions';

describe('MCP-021A — definition completeness (8 verbose fields per entry)', () => {
  it('every definition has non-empty booleanQuestion (length 20-300)', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(typeof def.booleanQuestion).toBe('string');
      expect(def.booleanQuestion.length).toBeGreaterThanOrEqual(20);
      expect(def.booleanQuestion.length).toBeLessThanOrEqual(300);
    }
  });

  it('every definition has non-empty positiveDefinition (length >=15, <=600)', () => {
    // Length floor 15 — accommodates concise structural entries (e.g.
    // some auto_metadata / lifecycle retroactive backfills where the
    // positive definition is a brief structural statement). Most entries
    // are 50-400 chars.
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(typeof def.positiveDefinition).toBe('string');
      expect(def.positiveDefinition.length).toBeGreaterThanOrEqual(15);
      expect(def.positiveDefinition.length).toBeLessThanOrEqual(600);
    }
  });

  it('every definition has non-empty negativeDefinition (length >=10, <=600)', () => {
    // Length floor 10 — accommodates very-short negative definitions for
    // structural auto-metadata facts (e.g. "No children.").
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(typeof def.negativeDefinition).toBe('string');
      expect(def.negativeDefinition.length).toBeGreaterThanOrEqual(10);
      expect(def.negativeDefinition.length).toBeLessThanOrEqual(600);
    }
  });

  it('every definition has at least 1 positiveExample (cap 5)', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(Array.isArray(def.positiveExamples)).toBe(true);
      expect(def.positiveExamples.length).toBeGreaterThanOrEqual(1);
      expect(def.positiveExamples.length).toBeLessThanOrEqual(5);
    }
  });

  it('every definition has at least 1 negativeExample (cap 5)', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(Array.isArray(def.negativeExamples)).toBe(true);
      expect(def.negativeExamples.length).toBeGreaterThanOrEqual(1);
      expect(def.negativeExamples.length).toBeLessThanOrEqual(5);
    }
  });

  it('every definition has ≥1 falsePositiveGuards (Trigger 12)', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(Array.isArray(def.falsePositiveGuards)).toBe(true);
      expect(def.falsePositiveGuards.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every definition has ≥1 doctrineNote (Trigger 12)', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(Array.isArray(def.doctrineNotes)).toBe(true);
      expect(def.doctrineNotes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every definition has confidenceEligibility with 3 thresholds', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(def.confidenceEligibility).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(
        def.confidenceEligibility.timelineMinConfidence,
      );
      expect(['low', 'medium', 'high']).toContain(
        def.confidenceEligibility.selectedContextMinConfidence,
      );
      expect(['low', 'medium', 'high']).toContain(
        def.confidenceEligibility.inspectMinConfidence,
      );
    }
  });

  it('every definition has all 8 MCP-021A new fields present (Trigger 12)', () => {
    const requiredNewFields = [
      'family',
      'booleanQuestion',
      'positiveDefinition',
      'negativeDefinition',
      'positiveExamples',
      'negativeExamples',
      'falsePositiveGuards',
      'doctrineNotes',
      'confidenceEligibility',
    ] as const;
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      for (const field of requiredNewFields) {
        expect(def).toHaveProperty(field);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((def as any)[field]).toBeDefined();
      }
    }
  });

  it('every definition has the 11 echoed NodeLabelMark fields', () => {
    const echoedFields = [
      'id',
      'rawKey',
      'kind',
      'source',
      'label',
      'shortLabel',
      'description',
      'defaultSurface',
      'disposition',
      'priority',
      'visibleByDefault',
    ] as const;
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      for (const field of echoedFields) {
        expect(def).toHaveProperty(field);
      }
    }
  });
});
