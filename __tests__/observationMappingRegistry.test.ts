/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — registry review-gate,
 * reconciliation, plain-language, §10a-leak, and no-suppression tests.
 *
 * The review gate is programmatic (per-row hand-review of ~1,268 rows is
 * infeasible): this scans EVERY adopted rule's labels + diagnostic for the
 * verdict-token ban-list, author-labeling, safety_note presence, A-G family,
 * and deployed-rawKey reconciliation.
 */

import {
  OBSERVATION_MAPPING_REGISTRY,
  OBSERVATION_MAPPING_ADOPTION_MANIFEST,
} from '../src/features/nodeLabels/observationMapping/observationMappingRegistry';
import {
  DEPLOYED_AG_RAW_KEYS,
  FROZEN_HIJ_FAMILIES,
  PRODUCTION_AG_FAMILIES,
} from '../src/features/nodeLabels/observationMapping/deployedAgRawKeys';
import { evaluateObservationMapping } from '../src/features/nodeLabels/observationMapping/observationMappingEvaluator';
import {
  looksLikeInternalCode,
  toPlainLanguageOrSuppress,
} from '../src/features/arguments/gameCopy';
import type { ObservationMappingRule } from '../src/features/nodeLabels/observationMapping/observationMappingTypes';

const VERDICT_BAN_LIST = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'true',
  'false',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'troll',
  'astroturfer',
];

const AUTHOR_LABEL_PATTERNS = [
  'this person',
  'this user',
  'the author is',
  'you are a',
  'they are a',
];

const AG_FAMILY_SET = new Set<string>(PRODUCTION_AG_FAMILIES);
const HIJ_FAMILY_SET = new Set<string>(FROZEN_HIJ_FAMILIES);

function labelFieldsOf(rule: ObservationMappingRule): string[] {
  return [rule.labelShort, rule.labelNeutral, rule.diagnosticSentence];
}

function familyParts(familyKey: string): string[] {
  return familyKey.split('+');
}

describe('observationMappingRegistry — review gate (verdict-free)', () => {
  for (const rule of OBSERVATION_MAPPING_REGISTRY) {
    for (const field of labelFieldsOf(rule)) {
      for (const banned of VERDICT_BAN_LIST) {
        it(`rule ${rule.mappingId} field has no banned token "${banned}"`, () => {
          // Word-boundary scan so "true" doesn't match inside "construe", etc.
          const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          expect(re.test(field)).toBe(false);
        });
      }
    }
  }
});

describe('observationMappingRegistry — review gate (no author labeling)', () => {
  for (const rule of OBSERVATION_MAPPING_REGISTRY) {
    for (const field of labelFieldsOf(rule)) {
      for (const pattern of AUTHOR_LABEL_PATTERNS) {
        it(`rule ${rule.mappingId} field does not label the author ("${pattern}")`, () => {
          expect(field.toLowerCase()).not.toContain(pattern);
        });
      }
    }
  }
});

describe('observationMappingRegistry — review gate (safety_note present)', () => {
  for (const rule of OBSERVATION_MAPPING_REGISTRY) {
    it(`rule ${rule.mappingId} carries a no-block/route/suppress/delay safety note`, () => {
      expect(typeof rule.safetyNote).toBe('string');
      expect(rule.safetyNote.length).toBeGreaterThan(0);
      const note = rule.safetyNote.toLowerCase();
      expect(note).toContain('do not block');
      expect(note).toContain('display-only');
    });
  }
});

describe('observationMappingRegistry — A-G only, H/I/J never', () => {
  for (const rule of OBSERVATION_MAPPING_REGISTRY) {
    it(`rule ${rule.mappingId} family is A-G only`, () => {
      for (const part of familyParts(rule.familyKey)) {
        expect(AG_FAMILY_SET.has(part)).toBe(true);
        expect(HIJ_FAMILY_SET.has(part)).toBe(false);
      }
    });
  }

  it('no rule references a frozen H/I/J family anywhere', () => {
    for (const rule of OBSERVATION_MAPPING_REGISTRY) {
      for (const part of familyParts(rule.familyKey)) {
        expect(HIJ_FAMILY_SET.has(part)).toBe(false);
      }
    }
  });
});

describe('observationMappingRegistry — reconciliation (flags are deployed rawKeys)', () => {
  for (const rule of OBSERVATION_MAPPING_REGISTRY) {
    const allFlags = [...rule.requiredTrueFlags, ...rule.requiredFalseFlags];
    for (const flag of allFlags) {
      it(`rule ${rule.mappingId} flag "${flag}" is a deployed A-G rawKey`, () => {
        expect(DEPLOYED_AG_RAW_KEYS.has(flag)).toBe(true);
      });
    }
  }

  it('every rule references at least one flag and can actually fire', () => {
    for (const rule of OBSERVATION_MAPPING_REGISTRY) {
      const count = rule.requiredTrueFlags.length + rule.requiredFalseFlags.length;
      expect(count).toBeGreaterThan(0);
    }
  });
});

describe('observationMappingRegistry — plain-language routing', () => {
  for (const rule of OBSERVATION_MAPPING_REGISTRY) {
    it(`rule ${rule.mappingId} observationCode resolves to a verdict-free, snake-free string`, () => {
      const mapped = toPlainLanguageOrSuppress(rule.observationCode);
      // Either gameCopy maps it (non-null, not a raw code) OR it falls back to
      // the verdict-free labelNeutral. In both cases the displayed string must
      // never be a raw internal code.
      const display = mapped !== null && mapped.length > 0 ? mapped : rule.labelNeutral;
      expect(display.length).toBeGreaterThan(0);
      expect(looksLikeInternalCode(display)).toBe(false);
      expect(display).not.toMatch(/_/); // no snake_case leak
    });
  }
});

describe('observationMappingRegistry — §10a non-exposure (no moderation reason)', () => {
  it('no rule field contains inactive_reason or a moderation-reason label', () => {
    for (const rule of OBSERVATION_MAPPING_REGISTRY) {
      const blob = JSON.stringify(rule).toLowerCase();
      expect(blob).not.toContain('inactive_reason');
      expect(blob).not.toContain('moderation_reason');
    }
  });

  it('no emitted result exposes inactive_reason', () => {
    // Drive a fire and inspect the emitted marks.
    const positives = OBSERVATION_MAPPING_REGISTRY.flatMap((r) => r.requiredTrueFlags);
    const out = evaluateObservationMapping(positives, OBSERVATION_MAPPING_REGISTRY, {
      surface: 'card',
    });
    for (const mark of out) {
      const blob = JSON.stringify(mark).toLowerCase();
      expect(blob).not.toContain('inactive_reason');
    }
  });
});

describe('observationMappingRegistry — no-suppression / display-only output', () => {
  it('emitted marks carry no block/route/suppress/delay field', () => {
    const positives = OBSERVATION_MAPPING_REGISTRY.flatMap((r) => r.requiredTrueFlags);
    const out = evaluateObservationMapping(positives, OBSERVATION_MAPPING_REGISTRY, {
      surface: 'card',
    });
    expect(out.length).toBeGreaterThan(0);
    for (const mark of out) {
      const rec = mark as unknown as Record<string, unknown>;
      expect(rec.block).toBeUndefined();
      expect(rec.route).toBeUndefined();
      expect(rec.suppress).toBeUndefined();
      expect(rec.delay).toBeUndefined();
      expect(rec.gate).toBeUndefined();
      expect(mark.kind).toBe('machine_observation');
    }
  });

  it('every emitted displayLabel is verdict-free and snake-free', () => {
    const positives = OBSERVATION_MAPPING_REGISTRY.flatMap((r) => r.requiredTrueFlags);
    const out = evaluateObservationMapping(positives, OBSERVATION_MAPPING_REGISTRY, {
      surface: 'card',
    });
    for (const mark of out) {
      expect(looksLikeInternalCode(mark.displayLabel)).toBe(false);
      for (const banned of VERDICT_BAN_LIST) {
        const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        expect(re.test(mark.displayLabel)).toBe(false);
        expect(re.test(mark.diagnosticSentence)).toBe(false);
      }
    }
  });
});

describe('observationMappingRegistry — adoption manifest', () => {
  it('total active rules equals the registry length', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.totalActiveRules).toBe(
      OBSERVATION_MAPPING_REGISTRY.length,
    );
  });

  it('adopted-from-CSV + curated + build2a + build2b + build2c + build2e + build2f counts add up', () => {
    const m = OBSERVATION_MAPPING_ADOPTION_MANIFEST;
    expect(
      m.adoptedFromCsv +
        m.curatedFireableRules +
        m.build2aFamilyBAdoptedRules +
        m.build2bFamilyAAdoptedRules +
        m.build2cFamilyCAdoptedRules +
        m.build2eFamilyEAdoptedRules +
        m.build2fFamilyFAdoptedRules,
    ).toBe(m.totalActiveRules);
  });

  it('MCP-BUILD2a Family B adopted 15 disagreement-quality mapping rows', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2aFamilyBAdoptedRules).toBe(15);
  });

  it('MCP-BUILD2b Family A adopted 15 parent-relation mapping rows', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2bFamilyAAdoptedRules).toBe(15);
  });

  it('MCP-BUILD2c Family C adopted 15 misunderstanding-repair mapping rows', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2cFamilyCAdoptedRules).toBe(15);
  });

  it('MCP-BUILD2e Family E adopted 15 argument-scheme mapping rows', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2eFamilyEAdoptedRules).toBe(15);
  });

  it('MCP-BUILD2f Family F adopted 16 critical-question mapping rows (6 singles + 9 pairs + 1 curated_triple)', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2fFamilyFAdoptedRules).toBe(16);
  });

  it('CSV deferral accounting is internally consistent', () => {
    const m = OBSERVATION_MAPPING_ADOPTION_MANIFEST;
    expect(m.csvAgRowsFullyDeployedFlags + m.csvAgRowsDeferredPlannedVocab).toBe(
      m.csvFitsExistingAgRows,
    );
    expect(m.csvAgRowsFullyDeployedFlags).toBe(m.adoptedFromCsv);
  });

  it('frozen families adopted is exactly 0', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.frozenFamiliesAdopted).toBe(0);
  });
});

describe('observationMappingRegistry — every rule actually fires on its flags', () => {
  for (const rule of OBSERVATION_MAPPING_REGISTRY) {
    it(`rule ${rule.mappingId} fires for a positive set built from its required-true flags`, () => {
      // Build a positive set: all required-true present, all required-false absent.
      const positive = new Set(rule.requiredTrueFlags);
      // single_false rules have no required-true; seed an unrelated positive so
      // the evaluator runs.
      if (positive.size === 0) positive.add('challenges_parent');
      const out = evaluateObservationMapping(positive, [rule], { surface: 'card' });
      // The rule must be present (it may be the only one).
      expect(out.some((m) => m.mappingId === rule.mappingId)).toBe(true);
    });
  }
});
