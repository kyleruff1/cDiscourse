/**
 * MCP-BUILD2e — Family E (argument_scheme) +3 booleans + mapping rows.
 *
 * Build 2e of the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 Build-2
 * manifest (§4, Family E). Adds 3 argument-structure quality booleans to
 * Family E + their adopted mapping rows. This Jest suite mirrors the Family-A
 * (Build 2b) + Family-C (Build 2c) suites for the THR-4 forecast (§4 of the
 * spawn card):
 *
 *   1. Client ≡ Edge parity for the 3 new definitions (byte-equal logic via
 *      the Deno bridge helper); unique rawKeys.
 *   2. The 3 new defs are deployed A-G rawKeys (reconciliation) + Family E is
 *      still productionEnabled (no familyRegistry flip).
 *   3. The new registry rules FIRE on the new positive rawKeys via
 *      evaluateObservationMapping; composite-supersedes respected.
 *   4. Verdict-free + describes-the-MOVE-not-the-author ban-list over the 3
 *      new defs + their mapping rows, with WORD-BOUNDARY matching.
 *   5. Theory-term-not-surfaced: the user-facing labels / plain-language strings
 *      NEVER contain the raw theory terms `linked` / `convergent` / `enthymeme`
 *      (GATE-A §8.2 rule 4); the classifier-facing definitions MAY name them.
 *   6. Adversarial fixtures for enthymeme_gap_detected (a fully-stated-premise
 *      move must NOT trip it; an unstated-load-bearing-premise move does; it
 *      never labels the author; gap-is-not-a-verdict — never frames it as a
 *      weakness / defeat).
 *   7. NO schema-version bump (byte-equal regression on the constant, client +
 *      Edge mirror).
 *   8. The 3 new observation codes route through gameCopy to verdict-free,
 *      snake-free plain language.
 *
 * Pure-model tests: no React, no Supabase, no network. The Edge mirror loads
 * via __tests__/_helpers/booleanObservationEdgeDeno.ts (babel-transformed
 * require of the Deno tree).
 */

import {
  getDefinitionsForFamily,
  lookupMachineObservationDefinition,
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
} from '../src/features/nodeLabels/machineObservationDefinitions';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import {
  OBSERVATION_MAPPING_REGISTRY,
  OBSERVATION_MAPPING_ADOPTION_MANIFEST,
} from '../src/features/nodeLabels/observationMapping/observationMappingRegistry';
import { evaluateObservationMapping } from '../src/features/nodeLabels/observationMapping/observationMappingEvaluator';
import { DEPLOYED_AG_RAW_KEYS } from '../src/features/nodeLabels/observationMapping/deployedAgRawKeys';
import {
  looksLikeInternalCode,
  toPlainLanguageOrSuppress,
} from '../src/features/arguments/gameCopy';
import {
  EDGE_INTERNAL_ALL_DEFINITIONS,
  edgeLookupMachineObservationDefinition,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  edgeGetDefinitionsForFamily,
} from './_helpers/booleanObservationEdgeDeno';

const NEW_RAW_KEYS = [
  'linked_premise_structure',
  'convergent_premise_structure',
  'enthymeme_gap_detected',
] as const;

const NEW_OBSERVATION_CODES = [
  'argument_scheme.single_true.linked_premise_structure',
  'argument_scheme.single_false.linked_premise_structure',
  'argument_scheme.single_true.convergent_premise_structure',
  'argument_scheme.single_false.convergent_premise_structure',
  'argument_scheme.single_true.enthymeme_gap_detected',
  'argument_scheme.single_false.enthymeme_gap_detected',
];

// The raw argumentation-theory terms that MUST stay internal (GATE-A §8.2
// rule 4). They appear in rawKeys / classifier definitions, NEVER in any
// user-facing display string.
const THEORY_TERMS = ['linked', 'convergent', 'enthymeme'];

// cdiscourse-doctrine §1 + §10a verdict / author-label ban-lists.
const VERDICT_BAN_LIST = [
  'winner',
  'loser',
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

// E3-specific verdict tokens banned in the label + diagnostic (manifest §4).
// "Enthymeme gap detected" / "gap" can read as a deficiency verdict; the
// user-facing strings must NOT contain a standalone weakness verdict token.
const E3_BANNED_TOKENS = ['weak', 'wrong', 'flawed', 'invalid', 'fallacy', 'fallacious'];

const AUTHOR_LABEL_PATTERNS = [
  'this person',
  'this user',
  'the author is',
  'the author was',
  'you are a',
  'they are a',
  'reasons sloppily',
];

describe('MCP-BUILD2e — the 3 new Family E definitions exist + are well-formed', () => {
  it('Family E now contains exactly 19 definitions (16 baseline + 3 Build-2e)', () => {
    expect(getDefinitionsForFamily('argument_scheme')).toHaveLength(19);
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" exists with family argument_scheme + source ai_classifier`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def).not.toBeNull();
      expect(def?.family).toBe('argument_scheme');
      expect(def?.source).toBe('ai_classifier');
      expect(def?.kind).toBe('machine_observation');
    });

    it(`"${rawKey}" is Inspect-only + never visibleByDefault (display-only posture)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def?.defaultSurface).toBe('inspect');
      expect(def?.visibleByDefault).toBe(false);
      // §10a / acceptance-gate: a future_source disposition means the adapter
      // returns [] in v1 — post-storage display-only, never a gate.
      expect(def?.disposition).toBe('future_source');
    });

    it(`"${rawKey}" carries a non-empty booleanQuestion + positive/negative definitions + guards`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def?.booleanQuestion.length).toBeGreaterThan(20);
      expect(def?.positiveDefinition.length).toBeGreaterThan(0);
      expect(def?.negativeDefinition.length).toBeGreaterThan(0);
      expect(def?.positiveExamples.length).toBeGreaterThanOrEqual(2);
      expect(def?.negativeExamples.length).toBeGreaterThanOrEqual(2);
      expect(def?.falsePositiveGuards.length).toBeGreaterThanOrEqual(1);
      expect(def?.doctrineNotes.length).toBeGreaterThanOrEqual(1);
    });
  }

  it('the 3 new rawKeys are unique (no duplicate within Family E)', () => {
    const familyE = getDefinitionsForFamily('argument_scheme');
    const keys = familyE.map((d) => d.rawKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const rawKey of NEW_RAW_KEYS) {
      expect(keys.filter((k) => k === rawKey)).toHaveLength(1);
    }
  });
});

describe('MCP-BUILD2e — client ≡ Edge mirror parity for the 3 new definitions', () => {
  it('Edge mirror Family E also has 19 definitions', () => {
    expect(edgeGetDefinitionsForFamily('argument_scheme')).toHaveLength(19);
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" is byte-equal (deep-equal) between client and Edge mirror`, () => {
      const client = lookupMachineObservationDefinition(rawKey);
      const edge = edgeLookupMachineObservationDefinition(rawKey);
      expect(client).not.toBeNull();
      expect(edge).not.toBeNull();
      // The two definition objects must be JSON-deep-equal (the mirror is
      // byte-equal except the import specifier, which is not part of the data).
      expect(JSON.parse(JSON.stringify(edge))).toEqual(
        JSON.parse(JSON.stringify(client)),
      );
    });
  }

  it('client + Edge both expose exactly the same set of new rawKeys', () => {
    const clientKeys = new Set(
      EDGE_INTERNAL_ALL_DEFINITIONS.map((d) => d.rawKey),
    );
    for (const rawKey of NEW_RAW_KEYS) {
      expect(clientKeys.has(rawKey)).toBe(true);
      expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey]).toBeDefined();
    }
  });
});

describe('MCP-BUILD2e — NO schema-version bump (byte-equal regression)', () => {
  it('client schema version constant is unchanged (v1, byte-equal)', () => {
    expect(MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION).toBe(
      'mcp-021.machine-observations.boolean.v1',
    );
  });

  it('Edge mirror schema version constant equals the client constant (no drift)', () => {
    expect(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION).toBe(
      MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    );
  });
});

describe('MCP-BUILD2e — reconciliation (new rawKeys are deployed A-G rawKeys)', () => {
  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" is in the deployed A-G rawKey set`, () => {
      expect(DEPLOYED_AG_RAW_KEYS.has(rawKey)).toBe(true);
    });
  }
});

describe('MCP-BUILD2e — verdict-free + describes-the-MOVE-not-the-author (definitions)', () => {
  function userFacingFieldsOf(rawKey: string): string[] {
    const def = lookupMachineObservationDefinition(rawKey);
    if (!def) return [];
    return [def.label, def.shortLabel, def.description];
  }

  for (const rawKey of NEW_RAW_KEYS) {
    for (const banned of VERDICT_BAN_LIST) {
      it(`"${rawKey}" user-facing fields contain no verdict token "${banned}"`, () => {
        for (const field of userFacingFieldsOf(rawKey)) {
          const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          expect(re.test(field)).toBe(false);
        }
      });
    }

    it(`"${rawKey}" user-facing fields never label the author`, () => {
      for (const field of userFacingFieldsOf(rawKey)) {
        for (const pattern of AUTHOR_LABEL_PATTERNS) {
          expect(field.toLowerCase()).not.toContain(pattern);
        }
      }
    });

    it(`"${rawKey}" label + shortLabel are snake-free (no rawKey leak)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def?.label.includes('_')).toBe(false);
      expect(def?.shortLabel.includes('_')).toBe(false);
    });
  }
});

describe('MCP-BUILD2e — theory terms stay INTERNAL (GATE-A §8.2 rule 4)', () => {
  // The raw theory terms linked / convergent / enthymeme must NEVER appear in
  // any user-facing display string: the definition label / shortLabel /
  // description, nor any mapping-row labelShort / labelNeutral /
  // diagnosticSentence, nor any plain-language gameCopy value. They MAY appear
  // in the classifier-facing booleanQuestion / positive/negative definitions /
  // falsePositiveGuards / doctrineNotes (those are internal taxonomy).
  function displayFieldsOf(rawKey: string): string[] {
    const def = lookupMachineObservationDefinition(rawKey);
    if (!def) return [];
    return [def.label, def.shortLabel, def.description];
  }

  for (const rawKey of NEW_RAW_KEYS) {
    for (const term of THEORY_TERMS) {
      it(`"${rawKey}" display fields never surface the raw theory term "${term}"`, () => {
        const re = new RegExp(`\\b${term}\\b`, 'i');
        for (const field of displayFieldsOf(rawKey)) {
          expect(re.test(field)).toBe(false);
        }
      });
    }
  }

  it('no Family E Build-2e mapping-row user-facing string contains a raw theory term', () => {
    const e2eRows = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) =>
        r.familyKey === 'argument_scheme' &&
        [...r.requiredTrueFlags, ...r.requiredFalseFlags].some((f) =>
          (NEW_RAW_KEYS as readonly string[]).includes(f),
        ),
    );
    expect(e2eRows.length).toBe(15);
    for (const row of e2eRows) {
      for (const field of [row.labelShort, row.labelNeutral, row.diagnosticSentence]) {
        for (const term of THEORY_TERMS) {
          const re = new RegExp(`\\b${term}\\b`, 'i');
          expect(re.test(field)).toBe(false);
        }
      }
    }
  });

  it('every Build-2e plain-language gameCopy string is free of raw theory terms', () => {
    for (const code of NEW_OBSERVATION_CODES) {
      const mapped = toPlainLanguageOrSuppress(code);
      expect(mapped).not.toBeNull();
      for (const term of THEORY_TERMS) {
        const re = new RegExp(`\\b${term}\\b`, 'i');
        expect(re.test(mapped!)).toBe(false);
      }
    }
  });

  it('the theory terms ARE present in the classifier-facing definitions (proves they are internal, not dropped)', () => {
    // Sanity: the booleanQuestion for the two premise-structure keys names its
    // theory term so the classifier prompt is unambiguous; this is internal.
    const linked = lookupMachineObservationDefinition('linked_premise_structure');
    const convergent = lookupMachineObservationDefinition('convergent_premise_structure');
    const enthymeme = lookupMachineObservationDefinition('enthymeme_gap_detected');
    expect(linked?.booleanQuestion.toLowerCase()).toContain('linked');
    expect(convergent?.booleanQuestion.toLowerCase()).toContain('convergent');
    expect(enthymeme?.booleanQuestion.toLowerCase()).toContain('enthymeme');
  });
});

describe('MCP-BUILD2e — enthymeme_gap_detected is fenced (verdict-adjacent E3, gap-is-not-a-verdict)', () => {
  const def = lookupMachineObservationDefinition('enthymeme_gap_detected');

  it('its falsePositiveGuards declare it describes the MOVE, never the author', () => {
    expect(def).not.toBeNull();
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    expect(guards).toContain('describes a structural feature of the move');
    expect(guards).toContain('never the author');
  });

  it('its guards frame a gap as an invitation to state the premise, NOT a defeat / weakness', () => {
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    // cdiscourse-doctrine §1: a gap is an invitation to state the premise.
    expect(guards).toContain('invitation to state the premise, not a defeat');
    expect(guards).toContain('never a verdict that the argument is weak');
  });

  it('its guards frame PRESENCE/ABSENCE as not-a-criticism (no sloppy-author implication)', () => {
    const guards = (def?.falsePositiveGuards ?? []).join(' ').toLowerCase();
    expect(guards).toContain('absence');
    expect(guards).toContain('never');
    // explicit author-protection fence.
    expect(guards).toContain('this person reasons sloppily');
  });

  it('its doctrineNotes anchor cdiscourse-doctrine §1 (a gap is an invitation, not a defeat)', () => {
    const notes = (def?.doctrineNotes ?? []).join(' ').toLowerCase();
    expect(notes).toContain('a gap is an invitation to state the premise, not a defeat');
  });

  it('its user-facing label + every E3 mapping row avoid standalone weakness verdict tokens', () => {
    const defFields = [
      def?.label,
      def?.shortLabel,
      def?.description,
    ].filter((x): x is string => typeof x === 'string');
    const e3Rows = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) =>
        r.requiredTrueFlags.includes('enthymeme_gap_detected') ||
        r.requiredFalseFlags.includes('enthymeme_gap_detected'),
    );
    const e3RowFields: string[] = [];
    for (const r of e3Rows) {
      e3RowFields.push(r.labelShort, r.labelNeutral, r.diagnosticSentence);
    }
    for (const field of [...defFields, ...e3RowFields]) {
      for (const banned of E3_BANNED_TOKENS) {
        const re = new RegExp(`\\b${banned}\\b`, 'i');
        expect(re.test(field)).toBe(false);
      }
    }
  });

  it('adversarial: a fully-stated-premise move must NOT trip the flag (only the absence-rule fires)', () => {
    // The classifier returns enthymeme_gap_detected=false for a move that states
    // its load-bearing premise. The evaluator must then NOT emit any
    // single_true / pair rule that REQUIRES enthymeme_gap_detected, and may emit
    // the single_false rule.
    const out = evaluateObservationMapping(
      ['causal_reasoning_present'], // a normal scheme present, no gap
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const firedIds = new Set(out.map((m) => m.mappingId));
    // The enthymeme single_true (MBOM-00123) must NOT fire.
    expect(firedIds.has('MBOM-00123')).toBe(false);
    // No fired rule may REQUIRE enthymeme_gap_detected as a positive flag —
    // look the fired rules up in the registry and confirm none requires it.
    const requiresEnthymemeTrue = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) => firedIds.has(r.mappingId) && r.requiredTrueFlags.includes('enthymeme_gap_detected'),
    );
    expect(requiresEnthymemeTrue).toHaveLength(0);
  });

  it('adversarial: an unstated-load-bearing-premise move DOES trip the flag (the true-rule fires)', () => {
    const single = OBSERVATION_MAPPING_REGISTRY.find((r) => r.mappingId === 'MBOM-00123');
    expect(single).toBeDefined();
    const out = evaluateObservationMapping(
      ['enthymeme_gap_detected'],
      [single!],
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00123')).toBe(true);
  });

  it('its positive examples include a genuine unstated-premise move', () => {
    const positives = (def?.positiveExamples ?? []).join(' ').toLowerCase();
    expect(positives).toContain('unstated');
  });

  it('its negative examples include a fully-stated-premise move (does not trip the flag)', () => {
    const negatives = (def?.negativeExamples ?? []).join(' ').toLowerCase();
    expect(negatives).toContain('stated');
  });
});

describe('MCP-BUILD2e — E1/E2 are not verdict-adjacent (no fence required)', () => {
  for (const rawKey of ['linked_premise_structure', 'convergent_premise_structure'] as const) {
    it(`"${rawKey}" doctrineNotes anchor §10a structural framing (not a verdict)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      const notes = (def?.doctrineNotes ?? []).join(' ').toLowerCase();
      expect(notes).toContain('§10a');
    });
  }
});

describe('MCP-BUILD2e — new mapping rows fire via evaluateObservationMapping', () => {
  it('linked_premise_structure single_true rule (MBOM-00119) fires in isolation', () => {
    const single = OBSERVATION_MAPPING_REGISTRY.find((r) => r.mappingId === 'MBOM-00119');
    expect(single).toBeDefined();
    const out = evaluateObservationMapping(
      ['linked_premise_structure'],
      [single!],
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00119')).toBe(true);
  });

  it('lone linked_premise_structure positive → its asymmetric pairs supersede the bare single', () => {
    const out = evaluateObservationMapping(
      ['linked_premise_structure'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('MBOM-01326'); // linked present, convergent absent
    expect(ids).toContain('MBOM-01329'); // linked present, enthymeme-gap absent
    expect(ids).not.toContain('MBOM-00119'); // bare single superseded by the pairs
  });

  it('linked_premise_structure absent → its single_false rule fires', () => {
    const out = evaluateObservationMapping(
      ['causal_reasoning_present'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00120')).toBe(true);
  });

  it('all 3 structure booleans positive → the pair rules fire and supersede consumed singles', () => {
    const out = evaluateObservationMapping(
      ['linked_premise_structure', 'convergent_premise_structure', 'enthymeme_gap_detected'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('MBOM-01325'); // linked × convergent
    expect(ids).toContain('MBOM-01328'); // linked × enthymeme-gap
    expect(ids).toContain('MBOM-01331'); // convergent × enthymeme-gap
    expect(ids).not.toContain('MBOM-00119'); // consumed
    expect(ids).not.toContain('MBOM-00121'); // consumed
    expect(ids).not.toContain('MBOM-00123'); // consumed
  });

  it('every emitted mark for the new rules is machine_observation + carries no gate field', () => {
    const out = evaluateObservationMapping(
      ['linked_premise_structure', 'convergent_premise_structure'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.length).toBeGreaterThan(0);
    for (const mark of out) {
      expect(mark.kind).toBe('machine_observation');
      const rec = mark as unknown as Record<string, unknown>;
      expect(rec.block).toBeUndefined();
      expect(rec.route).toBeUndefined();
      expect(rec.suppress).toBeUndefined();
      expect(rec.delay).toBeUndefined();
      expect(rec.gate).toBeUndefined();
    }
  });
});

describe('MCP-BUILD2e — mapping rows manifest + plain-language routing', () => {
  it('the manifest records exactly 15 adopted Build-2e Family E rules', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2eFamilyEAdoptedRules).toBe(15);
  });

  it('15 registry rules reference at least one of the 3 new rawKeys', () => {
    const newKeySet = new Set<string>(NEW_RAW_KEYS);
    const build2eRules = OBSERVATION_MAPPING_REGISTRY.filter((r) => {
      const flags = [...r.requiredTrueFlags, ...r.requiredFalseFlags];
      return flags.some((f) => newKeySet.has(f));
    });
    expect(build2eRules).toHaveLength(15);
    // Every flag in those rules is exactly one of the 3 new keys (the adopted
    // rows are scoped to the 3-flag subset per the design's adopt list).
    for (const rule of build2eRules) {
      for (const flag of [...rule.requiredTrueFlags, ...rule.requiredFalseFlags]) {
        expect(newKeySet.has(flag)).toBe(true);
      }
      // All Build-2e rows are argument_scheme (no cross-family in this card).
      expect(rule.familyKey).toBe('argument_scheme');
    }
  });

  for (const code of NEW_OBSERVATION_CODES) {
    it(`observationCode "${code}" routes to a verdict-free, snake-free plain-language string`, () => {
      const mapped = toPlainLanguageOrSuppress(code);
      expect(mapped).not.toBeNull();
      expect(mapped!.length).toBeGreaterThan(0);
      expect(looksLikeInternalCode(mapped!)).toBe(false);
      expect(mapped!).not.toMatch(/_/);
      for (const banned of VERDICT_BAN_LIST) {
        const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        expect(re.test(mapped!)).toBe(false);
      }
    });
  }

  it('every E3 (enthymeme_gap_detected) plain-language string avoids weakness verdict tokens', () => {
    const e3Codes = NEW_OBSERVATION_CODES.filter((c) => c.includes('enthymeme_gap_detected'));
    expect(e3Codes.length).toBeGreaterThan(0);
    for (const code of e3Codes) {
      const mapped = toPlainLanguageOrSuppress(code);
      expect(mapped).not.toBeNull();
      for (const banned of E3_BANNED_TOKENS) {
        const re = new RegExp(`\\b${banned}\\b`, 'i');
        expect(re.test(mapped!)).toBe(false);
      }
    }
  });
});
